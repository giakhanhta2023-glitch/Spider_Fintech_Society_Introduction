"""The real ledger, over the level 6 schema.

Same protocol as the in-memory one, so the API does not know which it has.
What this file adds over the in-memory version is the part that only a
database can do: one transaction around the whole write, a row lock while the
balance is checked, and the constraints from level 6 catching anything this
code gets wrong.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any

import psycopg
from psycopg.rows import dict_row

from .ports import (
    AccountMissing,
    InsufficientFunds,
    StoredEntry,
    StoredLeg,
    StoredTransfer,
)


class PostgresLedger:
    def __init__(self, conninfo: str) -> None:
        self._conninfo = conninfo

    def _connect(self) -> psycopg.Connection:
        # One connection per call is what this level measures and then argues
        # against. Level 8 replaces this with a pool, and the README says what
        # the difference was: 63.259 ms against 1.365 ms per query.
        return psycopg.connect(self._conninfo, row_factory=dict_row)

    def create_transfer(
        self,
        currency: str,
        description: str,
        reference: str | None,
        legs: list[StoredLeg],
    ) -> StoredTransfer:
        with self._connect() as conn, conn.cursor() as cur:
            # FOR UPDATE on every account being debited, in a stable order.
            # The order matters: two transfers touching the same pair of
            # accounts in opposite orders deadlock, and sorting the ids means
            # they queue instead. Level 8 measures this.
            debited = sorted({leg.account_id for leg in legs if leg.amount_minor < 0})
            touched = sorted({leg.account_id for leg in legs})

            cur.execute(
                "select id, currency, balance_minor from accounts where id = any(%s) for update",
                (touched,),
            )
            found = {int(row["id"]): row for row in cur.fetchall()}
            for leg in legs:
                if leg.account_id not in found:
                    raise AccountMissing(leg.account_id)

            wanted: dict[int, int] = {}
            for leg in legs:
                wanted[leg.account_id] = wanted.get(leg.account_id, 0) + leg.amount_minor
            for account_id in debited:
                available = int(found[account_id]["balance_minor"])
                if available + wanted[account_id] < 0:
                    raise InsufficientFunds(account_id, available, -wanted[account_id])

            cur.execute(
                """
                insert into transactions (idempotency_key, description, reference)
                values (%s, %s, %s)
                returning id, created_at
                """,
                (f"api:{reference or ''}:{datetime.now(UTC).timestamp()}", description, reference),
            )
            row = cur.fetchone()
            assert row is not None
            transfer_id, created_at = int(row["id"]), row["created_at"]

            cur.executemany(
                "insert into entries (transaction_id, account_id, amount_minor) values (%s, %s, %s)",
                [(transfer_id, leg.account_id, leg.amount_minor) for leg in legs],
            )
            # The deferred balance trigger from level 6 runs here, at commit.
            # If the legs do not sum to zero it refuses, and nothing above is
            # written, including the transaction row.

        return StoredTransfer(
            id=transfer_id,
            currency=currency,
            description=description,
            reference=reference,
            legs=tuple(legs),
            created_at=created_at,
        )

    def get_transfer(self, transfer_id: int) -> StoredTransfer | None:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                "select id, description, reference, created_at from transactions where id = %s",
                (transfer_id,),
            )
            head = cur.fetchone()
            if head is None:
                return None
            cur.execute(
                "select account_id, amount_minor from entries where transaction_id = %s order by id",
                (transfer_id,),
            )
            legs = tuple(
                StoredLeg(int(r["account_id"]), int(r["amount_minor"])) for r in cur.fetchall()
            )
        return StoredTransfer(
            id=int(head["id"]),
            currency="USD",
            description=head["description"],
            reference=head["reference"],
            legs=legs,
            created_at=head["created_at"],
        )

    def balance(self, account_id: int) -> tuple[int, str, datetime]:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                "select balance_minor, currency from accounts where id = %s", (account_id,)
            )
            row = cur.fetchone()
            if row is None:
                raise AccountMissing(account_id)
            return int(row["balance_minor"]), row["currency"], datetime.now(UTC)

    def entries(
        self,
        account_id: int,
        after: tuple[datetime, int] | None,
        limit: int,
    ) -> list[StoredEntry]:
        # Keyset, not OFFSET. Measured on 398,003 rows, page 4,001:
        #   offset 200000 limit 50   read 200,050 rows, 102,460 buffers, 113.684 ms
        #   where (created_at, id) > read      50 rows,      30 buffers,   0.101 ms
        sql = """
            select id, transaction_id, account_id, amount_minor, created_at
              from entries
             where account_id = %(account_id)s
               and (%(after_at)s::timestamptz is null
                    or (created_at, id) > (%(after_at)s, %(after_id)s))
             order by created_at, id
             limit %(limit)s
        """
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute("select 1 from accounts where id = %s", (account_id,))
            if cur.fetchone() is None:
                raise AccountMissing(account_id)
            cur.execute(
                sql,
                {
                    "account_id": account_id,
                    "after_at": after[0] if after else None,
                    "after_id": after[1] if after else None,
                    # One extra row, so has_more needs no count(*).
                    "limit": limit + 1,
                },
            )
            return [
                StoredEntry(
                    id=int(r["id"]),
                    transfer_id=int(r["transaction_id"]),
                    account_id=int(r["account_id"]),
                    amount_minor=int(r["amount_minor"]),
                    created_at=r["created_at"],
                )
                for r in cur.fetchall()
            ]


class PostgresIdempotencyStore:
    """The saved response, so a retry is answered rather than redone.

    The unique index is what makes this safe under concurrency: two identical
    requests arriving at the same moment both try to insert, one wins, and the
    loser reads what the winner wrote.
    """

    DDL = """
    create table if not exists idempotency_keys (
        key         text primary key,
        fingerprint text        not null,
        status      integer     not null,
        response    jsonb       not null,
        created_at  timestamptz not null default now()
    )
    """

    def __init__(self, conninfo: str) -> None:
        self._conninfo = conninfo
        with psycopg.connect(conninfo) as conn, conn.cursor() as cur:
            cur.execute(self.DDL)

    def get(self, key: str) -> tuple[str, int, dict[str, Any]] | None:
        with psycopg.connect(self._conninfo, row_factory=dict_row) as conn, conn.cursor() as cur:
            cur.execute(
                "select fingerprint, status, response from idempotency_keys where key = %s",
                (key,),
            )
            row = cur.fetchone()
            if row is None:
                return None
            return row["fingerprint"], int(row["status"]), row["response"]

    def put(self, key: str, fingerprint: str, status: int, body: dict[str, Any]) -> None:
        with psycopg.connect(self._conninfo) as conn, conn.cursor() as cur:
            cur.execute(
                """
                insert into idempotency_keys (key, fingerprint, status, response)
                values (%s, %s, %s, %s)
                on conflict (key) do nothing
                """,
                (key, fingerprint, status, json.dumps(body)),
            )
