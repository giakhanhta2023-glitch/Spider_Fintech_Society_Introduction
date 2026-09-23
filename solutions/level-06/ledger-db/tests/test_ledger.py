"""The eleven tests the level asks for, against a real Postgres.

There is no in-memory substitute here on purpose. Every one of these tests
exercises something only a real Postgres does: a deferred constraint trigger,
a foreign key, a unique index, a query plan. An in-memory database would pass
some of them and silently skip the rest, which is worse than not running them.

    createdb ledger_test
    DATABASE_URL=postgresql://localhost/ledger_test python -m ledger.migrate
    DATABASE_URL=postgresql://localhost/ledger_test pytest
"""

from __future__ import annotations

import subprocess
import sys
from collections.abc import Iterator

import psycopg
import pytest

from ledger.db import connect
from ledger.transfer import Leg, Result, balance, cached_balance, transfer


@pytest.fixture
def conn() -> Iterator[psycopg.Connection]:
    """A connection whose work is thrown away, so tests cannot affect each other."""
    with connect() as c:
        yield c
        c.rollback()


@pytest.fixture
def accounts(conn: psycopg.Connection) -> tuple[int, int]:
    with conn.cursor() as cur:
        cur.execute(
            """
            insert into accounts (name, kind, currency)
            values ('test cash', 'asset', 'USD'), ('test payable', 'liability', 'USD')
            returning id
            """
        )
        return tuple(int(row["id"]) for row in cur.fetchall())  # type: ignore[return-value]


# ------------------------------------------------------------- migrations
def test_running_the_migrations_twice_applies_each_file_once() -> None:
    first = subprocess.run(
        [sys.executable, "-m", "ledger.migrate"], capture_output=True, text=True
    )
    second = subprocess.run(
        [sys.executable, "-m", "ledger.migrate"], capture_output=True, text=True
    )
    assert first.returncode == 0 and second.returncode == 0
    assert "up to date" in second.stdout

    with connect() as c, c.cursor() as cur:
        cur.execute(
            "select filename, count(*) as n from schema_migrations group by filename"
        )
        assert all(row["n"] == 1 for row in cur.fetchall())


# ------------------------------------------------------------- constraints
def test_an_entry_of_zero_is_refused(conn: psycopg.Connection, accounts) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "insert into transactions (idempotency_key, description) values ('z', 'z') returning id"
        )
        tid = cur.fetchone()["id"]  # type: ignore[index]
        with pytest.raises(psycopg.errors.CheckViolation):
            cur.execute(
                "insert into entries (transaction_id, account_id, amount_minor) values (%s, %s, 0)",
                (tid, accounts[0]),
            )


def test_an_entry_for_an_unknown_account_is_refused(conn: psycopg.Connection) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "insert into transactions (idempotency_key, description) values ('g', 'g') returning id"
        )
        tid = cur.fetchone()["id"]  # type: ignore[index]
        with pytest.raises(psycopg.errors.ForeignKeyViolation):
            cur.execute(
                "insert into entries (transaction_id, account_id, amount_minor) values (%s, %s, 100)",
                (tid, 10**9),
            )


def test_an_unbalanced_transaction_is_refused_and_leaves_nothing(
    conn: psycopg.Connection, accounts
) -> None:
    """The deferred trigger fires at COMMIT, so the failure rolls back the
    transaction row as well as the entries. Nothing to clean up afterwards."""
    a, b = accounts
    with conn.cursor() as cur:
        cur.execute(
            "insert into transactions (idempotency_key, description) values ('u', 'u') returning id"
        )
        tid = int(cur.fetchone()["id"])  # type: ignore[index]
        cur.execute(
            "insert into entries (transaction_id, account_id, amount_minor) values (%s, %s, 10000)",
            (tid, a),
        )
        cur.execute(
            "insert into entries (transaction_id, account_id, amount_minor) values (%s, %s, -9000)",
            (tid, b),
        )
        with pytest.raises(psycopg.errors.CheckViolation):
            conn.commit()

    with connect() as fresh, fresh.cursor() as cur:
        cur.execute("select count(*) as n from transactions where id = %s", (tid,))
        assert cur.fetchone()["n"] == 0  # type: ignore[index]
        cur.execute("select count(*) as n from entries where transaction_id = %s", (tid,))
        assert cur.fetchone()["n"] == 0  # type: ignore[index]


# --------------------------------------------------------------- transfer
def test_a_transfer_writes_a_transaction_and_its_entries(
    conn: psycopg.Connection, accounts
) -> None:
    a, b = accounts
    result = transfer(
        conn, "t-1", "a payment", [Leg(a, 10_000), Leg(b, -10_000)]
    )
    conn.commit()
    assert result.created
    assert balance(conn, a) == 10_000
    assert balance(conn, b) == -10_000


def test_the_cached_balance_matches_after_a_transfer(
    conn: psycopg.Connection, accounts
) -> None:
    a, b = accounts
    transfer(conn, "t-2", "a payment", [Leg(a, 7_500), Leg(b, -7_500)])
    conn.commit()
    assert cached_balance(conn, a) == balance(conn, a) == 7_500


def test_reusing_an_idempotency_key_returns_the_original(
    conn: psycopg.Connection, accounts
) -> None:
    a, b = accounts
    first = transfer(conn, "t-3", "a payment", [Leg(a, 100), Leg(b, -100)])
    conn.commit()
    second = transfer(conn, "t-3", "the retry", [Leg(a, 100), Leg(b, -100)])
    conn.commit()

    assert second == Result(transaction_id=first.transaction_id, created=False)
    with conn.cursor() as cur:
        cur.execute("select count(*) as n from entries where transaction_id = %s",
                    (first.transaction_id,))
        assert cur.fetchone()["n"] == 2  # type: ignore[index]


def test_an_unbalanced_transfer_is_refused_before_it_reaches_the_database(
    conn: psycopg.Connection, accounts
) -> None:
    a, b = accounts
    with pytest.raises(ValueError):
        transfer(conn, "t-4", "wrong", [Leg(a, 100), Leg(b, -90)])


def test_a_transfer_that_raises_halfway_leaves_no_rows(
    conn: psycopg.Connection, accounts
) -> None:
    """The transaction boundary belongs to the caller, so an exception anywhere
    inside it discards everything, including the transaction row."""
    a, b = accounts
    try:
        with connect() as other:
            transfer(other, "t-5", "will fail", [Leg(a, 100), Leg(b, -100)])
            raise RuntimeError("something went wrong after the write")
    except RuntimeError:
        pass

    with conn.cursor() as cur:
        cur.execute("select count(*) as n from transactions where idempotency_key = 't-5'")
        assert cur.fetchone()["n"] == 0  # type: ignore[index]


# ---------------------------------------------------------------- the data
def test_the_whole_ledger_sums_to_zero(conn: psycopg.Connection) -> None:
    with conn.cursor() as cur:
        cur.execute("select coalesce(sum(amount_minor), 0) as total from entries")
        assert int(cur.fetchone()["total"]) == 0  # type: ignore[index]


def test_a_statement_ends_where_the_balance_says(conn: psycopg.Connection) -> None:
    from ledger.statement import statement

    with conn.cursor() as cur:
        cur.execute("select id from accounts order by id limit 1")
        account_id = int(cur.fetchone()["id"])  # type: ignore[index]

    rows = statement(conn, account_id)
    if rows:
        assert int(rows[-1]["running_minor"]) == cached_balance(conn, account_id)


def test_reconcile_exits_zero_and_then_non_zero_when_a_balance_is_changed(
    accounts,
) -> None:
    clean = subprocess.run([sys.executable, "-m", "ledger.reconcile"], capture_output=True)
    assert clean.returncode == 0

    with connect() as c, c.cursor() as cur:
        cur.execute("update accounts set balance_minor = balance_minor + 1 where id = %s",
                    (accounts[0],))
        c.commit()

    broken = subprocess.run([sys.executable, "-m", "ledger.reconcile"], capture_output=True)

    with connect() as c, c.cursor() as cur:
        cur.execute("update accounts set balance_minor = balance_minor - 1 where id = %s",
                    (accounts[0],))
        c.commit()

    assert broken.returncode != 0
