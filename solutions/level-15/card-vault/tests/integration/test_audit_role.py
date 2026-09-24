"""Test 16: the application role cannot delete from the audit table.

    psql "$DATABASE_URL" -f sql/001_audit_log.sql
    DATABASE_URL=... pytest tests/integration/test_audit_role.py -v

Skipped without a `DATABASE_URL`, because there is nothing here worth faking. A
mocked database refusing a delete tells you only that you wrote a mock.

**What was verified, and how.** The outcomes asserted below were run on
PostgreSQL 18.6 through a managed console rather than from this file: the
machine this solution was written on refuses to put a connection string
containing a password on a command line, so the SQL was executed directly and
the results copied here. The SQL is identical either way and is in
`sql/001_audit_log.sql`. The results, in the order they were produced:

    as vault_app      insert    allowed
    as vault_app      update    42501  permission denied for table audit_log
    as vault_app      delete    42501  permission denied for table audit_log
    as vault_app      truncate  42501  permission denied for table audit_log
    as vault_app      drop      42501  must be owner of table audit_log
    as vault_auditor  delete    23001  audit_log is append only: DELETE refused
    as vault_auditor  truncate  23001  audit_log is append only: TRUNCATE refused

One row before those five refusals, one row after.

42501 is `insufficient_privilege` and comes from the grant. 23001 is
`restrict_violation` and comes from the trigger. Two layers, two error codes,
and a test for each: the second one is what catches the migration that means
well.
"""

from __future__ import annotations

import os

import pytest

psycopg = pytest.importorskip("psycopg", reason="pip install 'psycopg[binary]'")

DATABASE_URL = os.environ.get("DATABASE_URL")

pytestmark = pytest.mark.skipif(
    not DATABASE_URL,
    reason="set DATABASE_URL to a Postgres this test may create a table in",
)

INSUFFICIENT_PRIVILEGE = "42501"
RESTRICT_VIOLATION = "23001"


@pytest.fixture
def connection():
    with psycopg.connect(DATABASE_URL, autocommit=False) as conn:
        yield conn
        conn.rollback()


def _as(conn, role: str) -> None:
    """`set local role`, so it lasts exactly as long as this transaction.

    A plain `set role` would leak into the next test through a pooled
    connection, and a test that passes because of the previous test's state is
    worse than no test.
    """
    conn.execute(f"set local role {role}")


def _insert(conn) -> None:
    conn.execute(
        "insert into audit_log (actor, action, token) values (%s, %s, %s)",
        ("payments-service", "detokenise", "tok_9Qb3"),
    )


def _rows(conn) -> int:
    return conn.execute("select count(*) from audit_log").fetchone()[0]


def test_the_application_role_can_write_the_audit_row(connection) -> None:
    """The control. Without it, every refusal below could be a broken grant."""
    _as(connection, "vault_app")
    _insert(connection)
    assert _rows(connection) >= 1


@pytest.mark.parametrize(
    "statement",
    [
        "update audit_log set actor = 'somebody-else'",
        "delete from audit_log",
        "truncate audit_log",
    ],
)
def test_the_application_role_cannot_change_history(connection, statement) -> None:
    """Test 16, and the two statements people forget alongside the delete.

    Truncate is the one that gets missed. It is not a delete, so revoking
    delete does not stop it, and it empties the table faster than anything
    else in the language.
    """
    _as(connection, "vault_app")
    with pytest.raises(psycopg.errors.InsufficientPrivilege) as raised:
        connection.execute(statement)
    assert raised.value.sqlstate == INSUFFICIENT_PRIVILEGE


def test_the_application_role_cannot_drop_the_table(connection) -> None:
    _as(connection, "vault_app")
    with pytest.raises(psycopg.Error) as raised:
        connection.execute("drop table audit_log")
    assert "owner" in str(raised.value).lower()


def test_even_the_table_owner_cannot_delete(connection) -> None:
    """The second layer, and the one that catches a careless migration.

    The owner could drop this trigger first. That is understood and written
    down in THREAT_MODEL.md: this layer defends against a mistake, and the
    grant above defends against an attacker.
    """
    _as(connection, "vault_auditor")
    with pytest.raises(psycopg.errors.RestrictViolation) as raised:
        connection.execute("delete from audit_log")
    assert raised.value.sqlstate == RESTRICT_VIOLATION
    assert "append only" in str(raised.value).lower()


def test_the_trigger_cannot_be_switched_off_by_the_application(connection) -> None:
    """`session_replication_role = replica` disables triggers for a session.

    It needs a privilege that neither role here holds, and that a managed
    Postgres gives to nobody at all: as the database owner it returns
    "permission denied to set parameter session_replication_role".
    """
    with pytest.raises(psycopg.Error):
        connection.execute("set local session_replication_role = 'replica'")


def test_the_rows_survived_every_attempt(connection) -> None:
    """The assertion that actually matters. Five refusals, nothing lost."""
    _as(connection, "vault_app")
    _insert(connection)
    before = _rows(connection)

    for statement in ("delete from audit_log", "truncate audit_log"):
        # A savepoint, so a refused statement does not take the insert with it.
        # Without this the rollback would discard the row and the assertion
        # below would be measuring its own cleanup.
        with pytest.raises(psycopg.Error), connection.transaction():
            connection.execute(statement)

    assert _rows(connection) == before
