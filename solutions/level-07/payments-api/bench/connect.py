"""What a new connection per request costs, against reusing one.

Run it against the database you actually deploy to, because the answer is
almost entirely network and TLS: on a socket to a Postgres on the same machine
it is a millisecond, and across a network to a hosted database it is tens of
milliseconds, every request, before any of your code runs.

    DATABASE_URL=... python -m bench.connect
"""

from __future__ import annotations

import os
import statistics
import sys
import time

import psycopg

QUERY = "select 1"
RUNS = 30


def new_connection_each_time(conninfo: str) -> list[float]:
    times = []
    for _ in range(RUNS):
        started = time.perf_counter()
        with psycopg.connect(conninfo) as conn, conn.cursor() as cur:
            cur.execute(QUERY)
            cur.fetchone()
        times.append((time.perf_counter() - started) * 1000)
    return times


def one_connection_reused(conninfo: str) -> list[float]:
    times = []
    with psycopg.connect(conninfo) as conn, conn.cursor() as cur:
        cur.execute(QUERY)  # warm up: the first query on a new connection
        cur.fetchone()      # pays for parsing and planning that later ones do not
        for _ in range(RUNS):
            started = time.perf_counter()
            cur.execute(QUERY)
            cur.fetchone()
            times.append((time.perf_counter() - started) * 1000)
    return times


def report(label: str, times: list[float]) -> float:
    median = statistics.median(times)
    print(
        f"  {label:28s} median {median:8.3f} ms   "
        f"min {min(times):7.3f}   max {max(times):8.3f}"
    )
    return median


def main() -> int:
    conninfo = os.environ.get("DATABASE_URL")
    if not conninfo:
        print("DATABASE_URL is not set")
        return 1

    print(f"the same trivial query, {RUNS} times each\n")
    fresh = report("a new connection each time", new_connection_each_time(conninfo))
    reused = report("one connection, reused", one_connection_reused(conninfo))

    print(
        f"\n  connecting costs {fresh - reused:.1f} ms per request, "
        f"which is {fresh / reused:.0f}x the query itself."
    )
    print("  That is the entire argument for the connection pool in level 8.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
