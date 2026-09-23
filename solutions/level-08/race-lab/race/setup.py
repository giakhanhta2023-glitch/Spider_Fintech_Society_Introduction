"""Schema and seed, safe to run as many times as you like.

The seed writes a balanced transaction rather than setting a number, because
the account this lab overdraws is the same shape as the level 6 ledger: a
balance is the consequence of entries, and a test that starts by writing a
balance directly is testing something the real system never does.
"""

from __future__ import annotations

import os
import sys

import psycopg
from psycopg.rows import dict_row

SCHEMA = """
create table if not exists accounts (
    id            bigint primary key,
    name          text        not null,
    balance_minor bigint      not null default 0,
    version       bigint      not null default 0
);

create table if not exists entries (
    id           bigserial primary key,
    account_id   bigint      not null references accounts (id),
    amount_minor bigint      not null check (amount_minor <> 0),
    created_at   timestamptz not null default now()
);
"""

# Added separately, because a mode exists specifically to run without it and
# the README compares the two.
CONSTRAINT = """
alter table accounts
    add constraint balance_never_negative check (balance_minor >= 0)
"""


def url() -> str:
    value = os.environ.get("DATABASE_URL")
    if not value:
        raise SystemExit("DATABASE_URL is not set, and there is no default")
    return value


def setup(conninfo: str, with_constraint: bool = False) -> None:
    with psycopg.connect(conninfo, autocommit=True) as conn, conn.cursor() as cur:
        cur.execute(SCHEMA)
        cur.execute(
            "select conname from pg_constraint where conname = 'balance_never_negative'"
        )
        exists = cur.fetchone() is not None
        if with_constraint and not exists:
            cur.execute(CONSTRAINT)
        if not with_constraint and exists:
            cur.execute("alter table accounts drop constraint balance_never_negative")


def reset_account(conninfo: str, account_id: int = 1, balance: int = 10000) -> None:
    """Back to a known starting point, through entries rather than by decree."""
    with psycopg.connect(conninfo, row_factory=dict_row) as conn, conn.cursor() as cur:
        cur.execute("delete from entries where account_id = %s", (account_id,))
        cur.execute(
            """
            insert into accounts (id, name, balance_minor, version)
            values (%s, 'the contended account', %s, 0)
            on conflict (id) do update
                set balance_minor = excluded.balance_minor, version = 0
            """,
            (account_id, balance),
        )
        cur.execute(
            "insert into entries (account_id, amount_minor) values (%s, %s)",
            (account_id, balance),
        )
        conn.commit()


def main() -> int:
    conninfo = url()
    with_constraint = "--with-constraint" in sys.argv
    setup(conninfo, with_constraint=with_constraint)
    reset_account(conninfo)
    print(
        "ready: account 1 holds 10,000, constraint "
        + ("on" if with_constraint else "off")
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
