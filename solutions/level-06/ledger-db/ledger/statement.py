"""A statement: every movement on one account, with a running balance.

The running balance is a window function rather than a loop in Python, because
the database can carry the total across rows as it reads them and returning
100,000 rows to add them up in the application is the thing level 6 is trying
to talk you out of.

The ordering inside the window is (created_at, id) rather than created_at
alone. Two entries can share a timestamp, and without the tiebreak the running
balance is not deterministic: the same query can return different intermediate
numbers on two runs, which is impossible to explain to anybody looking at a
statement.
"""

from __future__ import annotations

import sys
from datetime import datetime

from .db import connect

STATEMENT = """
select e.id,
       e.created_at,
       t.description,
       t.reference,
       e.amount_minor,
       sum(e.amount_minor) over (order by e.created_at, e.id
                                 rows between unbounded preceding and current row)
           as running_minor
  from entries e
  join transactions t on t.id = e.transaction_id
 where e.account_id = %(account_id)s
   and (%(since)s::timestamptz is null or e.created_at >= %(since)s)
   and (%(until)s::timestamptz is null or e.created_at <  %(until)s)
 order by e.created_at, e.id
"""


def statement(
    conn,
    account_id: int,
    since: datetime | None = None,
    until: datetime | None = None,
) -> list[dict]:
    with conn.cursor() as cur:
        cur.execute(STATEMENT, {"account_id": account_id, "since": since, "until": until})
        return cur.fetchall()


def main(account_id: int) -> int:
    with connect() as conn:
        rows = statement(conn, account_id)
        if not rows:
            print(f"account {account_id} has no entries")
            return 0

        print(f"{'date':12s} {'description':32s} {'amount':>14s} {'balance':>14s}")
        for row in rows[:40]:
            print(
                f"{row['created_at']:%Y-%m-%d} "
                f"{row['description'][:32]:32s} "
                f"{row['amount_minor']:>+14,} "
                f"{row['running_minor']:>14,}"
            )
        if len(rows) > 40:
            print(f"... {len(rows) - 40:,} more")

        # The check worth having: the statement has to end where the balance
        # says it is. If these ever differ, one of them is lying and the
        # entries are the one to believe.
        with conn.cursor() as cur:
            cur.execute(
                "select balance_minor from accounts where id = %s", (account_id,)
            )
            row = cur.fetchone()
            assert row is not None
            cached = int(row["balance_minor"])

        ends_at = int(rows[-1]["running_minor"])
        print(f"\n  statement ends at  {ends_at:>14,}")
        print(f"  cached balance     {cached:>14,}")
        if ends_at != cached:
            print("  THESE DISAGREE. Run reconcile.py.")
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(int(sys.argv[1]) if len(sys.argv) > 1 else 137))
