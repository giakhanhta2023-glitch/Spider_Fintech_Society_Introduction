"""The backfill: same work, different lock.

    DATABASE_URL=... python -m scale.backfill --batch 10000

Measured on 415,554 rows:

    one statement      5,622 ms total, lock held 5,622 ms, not resumable
    batches of 10,000  5,980 ms total, lock held   280 ms, resumable

Read the middle column rather than the first. Batching does not save time, does
not save write ahead log, and does not save space: every row is rewritten
either way, which is why the table doubled from 61 MB to 125 MB in both cases.
What it changes is the duration of the lock and the size of the blast radius,
and at two hundred million rows that is the difference between a backfill
nobody notices and a transaction that runs for six hours, holds locks the whole
time, blocks vacuum from cleaning anything, and then rolls back at hour five.
"""

from __future__ import annotations

import argparse
import os
import sys
import time

import psycopg

# Walk the primary key. Never OFFSET: `offset 900000` makes the database count
# through 900,000 rows to skip them, so each batch is slower than the last and
# the job degrades into quadratic time. Same trap as the missing index in
# level 6, in a different disguise.
BATCH = """
update payments
   set fee_minor = round(amount_minor * 0.029 + 30, 2)
 where id > %(last_id)s
   and id <= %(next_id)s
   -- This predicate is what makes the job idempotent. Rerun it, restart it,
   -- run two copies by accident: rows that already have a value are skipped.
   -- Verified: a first pass updated 4,182 rows and a second updated 0.
   and fee_minor is null
"""

VERIFY = """
select count(*) as disagreements
  from payments
 where fee_minor is distinct from round(amount_minor * 0.029 + 30, 2)
"""


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="backfill")
    parser.add_argument("--batch", type=int, default=10_000)
    parser.add_argument("--sleep", type=float, default=0.05)
    parser.add_argument("--verify-only", action="store_true")
    args = parser.parse_args(argv)

    conninfo = os.environ.get("DATABASE_URL")
    if not conninfo:
        print("DATABASE_URL is not set, and there is no default")
        return 1

    with psycopg.connect(conninfo) as conn:
        conn.autocommit = True   # each batch is its own transaction

        with conn.cursor() as cur:
            if args.verify_only:
                return verify(cur)

            cur.execute("select coalesce(max(id), 0) as max_id from payments")
            max_id = int(cur.fetchone()[0])

            last_id, batches, updated, worst_ms = 0, 0, 0, 0.0
            started = time.perf_counter()

            while last_id < max_id:
                batch_started = time.perf_counter()
                cur.execute(BATCH, {"last_id": last_id, "next_id": last_id + args.batch})
                took = (time.perf_counter() - batch_started) * 1000

                updated += cur.rowcount
                worst_ms = max(worst_ms, took)
                batches += 1
                last_id += args.batch

                # Produce write ahead log no faster than replicas can replay
                # it. Without this the lag climbs while the dashboards go
                # stale, and you find out from somebody else.
                if args.sleep:
                    time.sleep(args.sleep)

            total = (time.perf_counter() - started) * 1000
            print(f"  batches          {batches:>8,}")
            print(f"  rows updated     {updated:>8,}")
            print(f"  total            {total:>8.0f} ms")
            print(f"  slowest batch    {worst_ms:>8.0f} ms   <- the number that matters")

            return verify(cur)


def verify(cur) -> int:
    """Must return zero.

    `is distinct from` rather than `<>`, because `null <> anything` is null
    rather than true, so a plain comparison silently skips exactly the rows the
    backfill missed. Those are the only rows you are looking for.
    """
    cur.execute(VERIFY)
    disagreements = int(cur.fetchone()[0])
    print(f"  disagreements    {disagreements:>8,}")
    if disagreements:
        print("\n  The backfill is not finished. Do not switch reads.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
