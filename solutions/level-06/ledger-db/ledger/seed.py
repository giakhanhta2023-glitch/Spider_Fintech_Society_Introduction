"""2,000 accounts and 400,000 balanced entries, the same every time.

Deterministic on purpose. A seed built from random() gives a different database
on every machine, so a measured query plan cannot be compared with anybody
else's and a failing test cannot be reproduced. Everything here comes from the
row number through fixed arithmetic.

The one subtlety is the trigger. The balanced check is a per-row deferred
constraint trigger, so seeding 400,000 entries inside one transaction queues
400,000 checks to run at COMMIT, each of which sums the entries of its
transaction. That turns a ten second load into a very long one. The seed
disables it for the bulk load and verifies the whole ledger afterwards, which
is stronger than the per-transaction check it skipped: it proves every
transaction balances AND that the ledger as a whole sums to zero.
"""

from __future__ import annotations

import sys
import time

from .db import connect

ACCOUNTS = 2_000
TRANSACTIONS = 200_000

# Two coprime multipliers, so the accounts are spread rather than clustered.
# The offset is what guarantees the two legs never land on the same account,
# which would produce a transaction with one net movement of zero.
ENTRIES_SQL = """
insert into entries (transaction_id, account_id, amount_minor, created_at)
select t.id, leg.account_id, leg.amount, t.created_at
  from generate_series(1, %(n)s) as i
  join transactions t on t.idempotency_key = 'seed-' || i
 cross join lateral (
        values (1 + (i::bigint * 7919) %% %(accounts)s,
                 (100 + (i::bigint * 3571) %% 50000)),
               (1 + ((i::bigint * 7919) + 1 + i %% (%(accounts)s - 1)) %% %(accounts)s,
                -(100 + (i::bigint * 3571) %% 50000))
      ) as leg(account_id, amount)
"""

ACCOUNTS_SQL = """
insert into accounts (name, kind, currency)
select 'account ' || i,
       (array['asset', 'liability', 'income'])[1 + i %% 3],
       'USD'
  from generate_series(1, %(n)s) as i
"""

TRANSACTIONS_SQL = """
insert into transactions (idempotency_key, description, created_at)
select 'seed-' || i,
       'seeded payment ' || i,
       timestamptz '2025-01-01' + (i %% 365) * interval '1 day'
  from generate_series(1, %(n)s) as i
"""


def step(cur, label: str, sql: str, params: dict[str, int]) -> None:
    started = time.perf_counter()
    cur.execute(sql, params)
    print(f"  {label:32s} {cur.rowcount:>9,} rows  {(time.perf_counter() - started):6.1f} s")


def main() -> int:
    with connect() as conn, conn.cursor() as cur:
        cur.execute("select count(*) as n from accounts")
        row = cur.fetchone()
        assert row is not None
        if row["n"]:
            print("the ledger already has accounts: truncate first if you want a fresh seed")
            return 1

        print(f"seeding {ACCOUNTS:,} accounts and {TRANSACTIONS * 2:,} entries")

        # See the module docstring. Re-enabled and verified below.
        cur.execute("alter table entries disable trigger entries_must_balance")
        cur.execute("alter table entries disable trigger entries_maintain_balance")

        step(cur, "accounts", ACCOUNTS_SQL, {"n": ACCOUNTS})
        step(cur, "transactions", TRANSACTIONS_SQL, {"n": TRANSACTIONS})
        step(cur, "entries", ENTRIES_SQL, {"n": TRANSACTIONS, "accounts": ACCOUNTS})

        cur.execute("alter table entries enable trigger entries_must_balance")
        cur.execute("alter table entries enable trigger entries_maintain_balance")

        # The cached balances were not maintained during the bulk load, so set
        # them from the entries once, here, rather than leaving them wrong.
        step(
            cur,
            "cached balances",
            """
            update accounts a
               set balance_minor = coalesce(s.total, 0)
              from (select account_id, sum(amount_minor) as total
                      from entries group by account_id) s
             where s.account_id = a.id
            """,
            {},
        )

        cur.execute("analyze accounts, transactions, entries")

        # The verification that replaces the checks skipped during the load.
        cur.execute("select coalesce(sum(amount_minor), 0) as total from entries")
        row = cur.fetchone()
        assert row is not None
        total = int(row["total"])

        cur.execute(
            """
            select count(*) as n from (
                select transaction_id from entries
                 group by transaction_id having sum(amount_minor) <> 0) q
            """
        )
        row = cur.fetchone()
        assert row is not None
        unbalanced = int(row["n"])

        print(f"\n  ledger sums to             {total}")
        print(f"  unbalanced transactions    {unbalanced}")

        if total != 0 or unbalanced != 0:
            print("\nthe seed produced a ledger that does not balance. Nothing is committed.")
            conn.rollback()
            return 1

    print("\nseeded and verified")
    return 0


if __name__ == "__main__":
    sys.exit(main())
