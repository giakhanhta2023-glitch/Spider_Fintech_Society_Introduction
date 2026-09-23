"""The balance query, three ways, with the plan printed each time.

Run it yourself. The numbers in the README came from this script against
398,003 entries on Postgres 18, and yours will differ; what should not differ
is the shape, which is a sequential scan becoming a bitmap heap scan becoming
an index only scan with Heap Fetches: 0.
"""

from __future__ import annotations

import re
import sys

from .db import connect

QUERY = "select coalesce(sum(amount_minor), 0) from entries where account_id = %s"

INDEXES = {
    "plain": "create index entries_account_id_idx on entries (account_id)",
    "covering": (
        "create index entries_account_covering_idx on entries (account_id) "
        "include (amount_minor)"
    ),
}


def plan(cur, account_id: int) -> tuple[str, int, float]:
    """Run EXPLAIN (ANALYZE, BUFFERS) and pull out the three things that matter."""
    cur.execute("explain (analyze, buffers, costs off) " + QUERY, (account_id,))
    text = "\n".join(row["QUERY PLAN"] for row in cur.fetchall())

    scan = next(
        (
            line.strip().split(" (")[0]
            for line in text.splitlines()
            if "Scan" in line
        ),
        "unknown",
    )
    # The top node's Buffers line is the total for the whole plan. Take the
    # first one rather than summing every line: a child's buffers are already
    # included in its parent's, so adding them counts the same page twice.
    top = next((line for line in text.splitlines() if "Buffers:" in line), "")
    buffers = sum(int(n) for n in re.findall(r"shared (?:hit|read)=(\d+)", top))
    ms = float(re.search(r"Execution Time: ([\d.]+) ms", text).group(1))  # type: ignore[union-attr]
    return scan, buffers, ms


def warm(cur, account_id: int, times: int = 3) -> None:
    """A cold first run measures the disk, not the plan."""
    for _ in range(times):
        cur.execute(QUERY, (account_id,))
        cur.fetchall()


def main(account_id: int = 137) -> int:
    with connect(autocommit=True) as conn, conn.cursor() as cur:
        for name in INDEXES:
            cur.execute(f"drop index if exists entries_account_{'id' if name == 'plain' else 'covering'}_idx")

        cur.execute("select count(*) as n from entries")
        rows = int(cur.fetchone()["n"])
        print(f"balance of account {account_id}, over {rows:,} entries\n")
        print(f"{'index':10s} {'plan':34s} {'buffers':>9s} {'time':>10s}")

        warm(cur, account_id)
        scan, buffers, ms = plan(cur, account_id)
        print(f"{'none':10s} {scan:34s} {buffers:>9,} {ms:>9.3f} ms")

        for name, ddl in INDEXES.items():
            cur.execute(ddl)
            cur.execute("analyze entries")
            warm(cur, account_id)
            scan, buffers, ms = plan(cur, account_id)
            print(f"{name:10s} {scan:34s} {buffers:>9,} {ms:>9.3f} ms")

        print()
        cur.execute(
            """
            select indexrelname as name, pg_size_pretty(pg_relation_size(indexrelid)) as size
              from pg_stat_user_indexes
             where relname = 'entries'
             order by pg_relation_size(indexrelid) desc
            """
        )
        for row in cur.fetchall():
            print(f"  {row['name']:34s} {row['size']:>10s}")

    return 0


if __name__ == "__main__":
    sys.exit(main(int(sys.argv[1]) if len(sys.argv) > 1 else 137))
