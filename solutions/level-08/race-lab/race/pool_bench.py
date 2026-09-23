"""What a connection pool is worth, and what a badly sized one costs.

Three configurations, same workload:

    no pool          a fresh connection per request
    right sized      a pool roughly the size of the concurrency
    too small        a pool of 2, so everybody queues

The metric that matters and is usually missing is the WAIT: how long a request
spent waiting for a connection before any query ran. Without it, a too-small
pool looks like a slow database, and people go and optimise the query.
"""

from __future__ import annotations

import os
import statistics
import sys
import threading
import time
from dataclasses import dataclass, field

import psycopg
from psycopg_pool import ConnectionPool

QUERY = "select balance_minor from accounts where id = 1"


@dataclass
class Sample:
    wait_ms: float
    query_ms: float

    @property
    def total_ms(self) -> float:
        return self.wait_ms + self.query_ms


@dataclass
class BenchResult:
    label: str
    samples: list[Sample] = field(default_factory=list)
    wall_s: float = 0.0

    def pct(self, values: list[float], p: float) -> float:
        if not values:
            return float("nan")
        ordered = sorted(values)
        return ordered[min(len(ordered) - 1, int(p / 100 * (len(ordered) - 1)))]

    def line(self) -> str:
        totals = [s.total_ms for s in self.samples]
        waits = [s.wait_ms for s in self.samples]
        return (
            f"  {self.label:16s} "
            f"p50 {self.pct(totals, 50):7.1f} ms   "
            f"p95 {self.pct(totals, 95):8.1f} ms   "
            f"wait p95 {self.pct(waits, 95):8.1f} ms   "
            f"{len(self.samples) / self.wall_s:7.0f} req/s"
        )


def drive(label: str, acquire, requests: int, concurrency: int) -> BenchResult:
    """acquire() is a context manager yielding a connection. Everything else
    about the three configurations is identical, which is the point."""
    result = BenchResult(label)
    lock = threading.Lock()
    barrier = threading.Barrier(concurrency)
    per_thread = requests // concurrency

    def worker() -> None:
        local: list[Sample] = []
        barrier.wait()
        for _ in range(per_thread):
            asked = time.perf_counter()
            with acquire() as conn:
                got = time.perf_counter()
                with conn.cursor() as cur:
                    cur.execute(QUERY)
                    cur.fetchone()
                done = time.perf_counter()
            local.append(Sample((got - asked) * 1000, (done - got) * 1000))
        with lock:
            result.samples.extend(local)

    threads = [threading.Thread(target=worker) for _ in range(concurrency)]
    started = time.perf_counter()
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    result.wall_s = time.perf_counter() - started
    return result


def main() -> int:
    conninfo = os.environ.get("DATABASE_URL")
    if not conninfo:
        print("DATABASE_URL is not set")
        return 1

    requests, concurrency = 240, 12
    print(f"{requests} requests at concurrency {concurrency}\n")

    import contextlib

    @contextlib.contextmanager
    def fresh():
        with psycopg.connect(conninfo) as conn:
            yield conn

    print(drive("no pool", fresh, requests, concurrency).line())

    for label, size in (("right sized", concurrency), ("too small", 2)):
        pool = ConnectionPool(conninfo, min_size=size, max_size=size, open=True)
        pool.wait()
        try:
            print(drive(label, pool.connection, requests, concurrency).line())
        finally:
            pool.close()

    print(
        "\n  Read the wait column. A too small pool is not a slow database:\n"
        "  the query is the same speed and the request is queueing to start it."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
