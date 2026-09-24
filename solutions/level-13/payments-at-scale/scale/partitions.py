"""Creating next month's partition, and alerting before it is too late.

A partitioned table with no partition covering tomorrow fails every insert at
midnight on the first. It is the most predictable outage in this entire level
and it still happens, because the job that creates partitions runs monthly and
nothing watches the job.

So: a job that creates them, and a check that alerts when fewer than two future
months exist. Two rather than one, because one month of warning means the alert
and the failure can land in the same week, and this should be a ticket rather
than a page.
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import date

import psycopg

CREATE = """
create table if not exists {name} partition of payments
    for values from (%(start)s) to (%(end)s)
"""

FUTURE_PARTITIONS = """
select count(*) as future_months
  from pg_class c
  join pg_inherits i on i.inhrelid = c.oid
  join pg_class parent on parent.oid = i.inhparent
 where parent.relname = 'payments'
   and c.relname > 'payments_' || to_char(%(today)s::date, 'YYYY_MM')
"""


def month_after(when: date, months: int) -> date:
    total = when.year * 12 + when.month - 1 + months
    return date(total // 12, total % 12 + 1, 1)


def ensure(conn, ahead: int = 3, today: date | None = None) -> list[str]:
    """Create partitions for the next `ahead` months. Safe to run repeatedly.

    `if not exists` rather than a check-then-create, because two schedulers
    firing at the same minute is exactly the sort of thing that happens at
    midnight on the first.
    """
    today = today or date.today()
    created = []
    with conn.cursor() as cur:
        for offset in range(ahead + 1):
            start = month_after(today.replace(day=1), offset)
            end = month_after(start, 1)
            name = f"payments_{start:%Y_%m}"
            cur.execute(
                CREATE.format(name=name), {"start": start, "end": end}
            )
            created.append(name)
    conn.commit()
    return created


def check(conn, minimum: int = 2, today: date | None = None) -> tuple[bool, int]:
    """Returns (healthy, how many future months exist)."""
    today = today or date.today()
    with conn.cursor() as cur:
        cur.execute(FUTURE_PARTITIONS, {"today": today})
        count = int(cur.fetchone()[0])
    return count >= minimum, count


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="partitions")
    parser.add_argument("--ensure", action="store_true")
    parser.add_argument("--ahead", type=int, default=3)
    parser.add_argument("--minimum", type=int, default=2)
    args = parser.parse_args(argv)

    conninfo = os.environ.get("DATABASE_URL")
    if not conninfo:
        print("DATABASE_URL is not set")
        return 1

    with psycopg.connect(conninfo) as conn:
        if args.ensure:
            for name in ensure(conn, args.ahead):
                print(f"  ensured {name}")

        healthy, count = check(conn, args.minimum)
        print(f"  future partitions: {count} (minimum {args.minimum})")

        if not healthy:
            print(
                f"\n  ALERT: only {count} future month(s) of partitions exist.\n"
                f"  Inserts will start failing when the last one ends."
            )
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
