"""Moving money: one transaction row, its entries, and one database transaction.

Three properties, and each one is enforced by the database rather than by this
file being careful:

  balanced      the deferred constraint trigger checks at COMMIT, so an
                unbalanced transfer leaves no transaction row and no entries
  idempotent    the unique index on idempotency_key refuses the second insert,
                and this code turns that refusal into the original transaction
  atomic        one connection, one transaction, so a crash halfway writes
                nothing at all
"""

from __future__ import annotations

from dataclasses import dataclass

import psycopg


@dataclass(frozen=True, slots=True)
class Leg:
    """One movement: which account, and how much, in minor units."""

    account_id: int
    amount_minor: int


@dataclass(frozen=True, slots=True)
class Result:
    transaction_id: int
    created: bool  # False when the idempotency key had been seen before


def transfer(
    conn: psycopg.Connection,
    idempotency_key: str,
    description: str,
    legs: list[Leg],
    reference: str | None = None,
) -> Result:
    """Write a transaction and its entries, or return the one already written.

    The caller controls the transaction boundary by passing a connection, so a
    transfer can be part of a larger unit of work. Nothing here commits.
    """
    if len(legs) < 2:
        raise ValueError("a transfer needs at least two legs")
    if sum(leg.amount_minor for leg in legs) != 0:
        # Checked here as well as in the database, because a clear error at the
        # call site is friendlier than a constraint violation at commit. The
        # database check is the one that matters: this one can be bypassed by
        # any other writer, and the trigger cannot.
        raise ValueError("the legs of a transfer must sum to zero")

    with conn.cursor() as cur:
        # A savepoint, so that catching the unique violation does not leave the
        # caller's transaction aborted. Without it, the duplicate key poisons
        # the whole transaction and the caller cannot continue.
        cur.execute("savepoint transfer_insert")
        try:
            cur.execute(
                """
                insert into transactions (idempotency_key, description, reference)
                values (%s, %s, %s)
                returning id
                """,
                (idempotency_key, description, reference),
            )
            row = cur.fetchone()
            assert row is not None
            transaction_id = int(row["id"])
        except psycopg.errors.UniqueViolation:
            cur.execute("rollback to savepoint transfer_insert")
            cur.execute(
                "select id from transactions where idempotency_key = %s",
                (idempotency_key,),
            )
            row = cur.fetchone()
            assert row is not None, "unique violation but no row: impossible"
            return Result(transaction_id=int(row["id"]), created=False)

        cur.execute("release savepoint transfer_insert")
        cur.executemany(
            """
            insert into entries (transaction_id, account_id, amount_minor)
            values (%s, %s, %s)
            """,
            [(transaction_id, leg.account_id, leg.amount_minor) for leg in legs],
        )

    return Result(transaction_id=transaction_id, created=True)


def balance(conn: psycopg.Connection, account_id: int) -> int:
    """The truth: summed from the entries, not read from the cache."""
    with conn.cursor() as cur:
        cur.execute(
            "select coalesce(sum(amount_minor), 0) as total from entries where account_id = %s",
            (account_id,),
        )
        row = cur.fetchone()
        assert row is not None
        return int(row["total"])


def cached_balance(conn: psycopg.Connection, account_id: int) -> int:
    """The cache: one row read, maintained by the trigger in migration 004."""
    with conn.cursor() as cur:
        cur.execute("select balance_minor from accounts where id = %s", (account_id,))
        row = cur.fetchone()
        assert row is not None
        return int(row["balance_minor"])
