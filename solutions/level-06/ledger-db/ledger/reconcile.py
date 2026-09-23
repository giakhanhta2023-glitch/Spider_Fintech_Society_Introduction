"""Does the cache still agree with the truth?

Exits 0 when every cached balance matches the entries, and non-zero when any
account disagrees. That exit code is the whole point: this runs on a schedule,
and a cron job that prints a warning nobody reads is not a control.

Three checks, in order of how bad the answer would be:

  1. every account's cached balance equals the sum of its entries
  2. every transaction's entries sum to zero
  3. the ledger as a whole sums to zero

The third is implied by the second, and it is checked anyway because it is one
query and it is the number you would put on a dashboard.
"""

from __future__ import annotations

import sys

from .db import connect

DISAGREEING_ACCOUNTS = """
select a.id,
       a.name,
       a.balance_minor                as cached,
       coalesce(e.total, 0)           as from_entries,
       a.balance_minor - coalesce(e.total, 0) as difference
  from accounts a
  left join (select account_id, sum(amount_minor) as total
               from entries group by account_id) e
         on e.account_id = a.id
 where a.balance_minor is distinct from coalesce(e.total, 0)
 order by abs(a.balance_minor - coalesce(e.total, 0)) desc
"""

UNBALANCED_TRANSACTIONS = """
select transaction_id, sum(amount_minor) as imbalance
  from entries
 group by transaction_id
having sum(amount_minor) <> 0
 order by abs(sum(amount_minor)) desc
 limit 20
"""


def main() -> int:
    problems = 0

    with connect() as conn, conn.cursor() as cur:
        cur.execute(DISAGREEING_ACCOUNTS)
        rows = cur.fetchall()
        if rows:
            problems += len(rows)
            print(f"{len(rows)} account(s) disagree with their entries:")
            for row in rows[:20]:
                print(
                    f"  account {row['id']:>6} {row['name']:<24} "
                    f"cached {row['cached']:>14,}  entries {row['from_entries']:>14,}  "
                    f"difference {row['difference']:>+12,}"
                )
        else:
            print("cached balances: every account agrees with its entries")

        cur.execute(UNBALANCED_TRANSACTIONS)
        rows = cur.fetchall()
        if rows:
            problems += len(rows)
            print(f"\n{len(rows)} transaction(s) do not balance:")
            for row in rows:
                print(f"  transaction {row['transaction_id']:>8}  off by {row['imbalance']:>+12,}")
        else:
            print("transactions:     every transaction sums to zero")

        cur.execute("select coalesce(sum(amount_minor), 0) as total from entries")
        row = cur.fetchone()
        assert row is not None
        total = int(row["total"])
        print(f"ledger total:     {total}")
        if total != 0:
            problems += 1

    if problems:
        print(f"\n{problems} problem(s). This is a page, not a log line.")
        return 1

    print("\nnothing to report")
    return 0


if __name__ == "__main__":
    sys.exit(main())
