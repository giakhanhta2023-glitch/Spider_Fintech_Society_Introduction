"""Traffic throughout the migration, and an honest report afterwards.

    DATABASE_URL=... python -m scale.loadgen --seconds 300 &
    DATABASE_URL=... psql -f migrations/002_dual_write.sql
    ...

The acceptance test for the whole level is one number: failed requests, and it
must be zero. A latency bump during the migration is acceptable and gets
reported; a single failure means the migration is wrong.

Open loop, for the reason level 14 measures: a generator that waits for each
response before sending the next slows down when the database does, so it can
never show you overload and every number it produces is optimistic.
"""

from __future__ import annotations

import argparse
import os
import random
import statistics
import sys
import threading
import time
from collections import Counter
from dataclasses import dataclass, field

import psycopg


@dataclass
class Report:
    latencies_ms: list[float] = field(default_factory=list)
    errors: Counter = field(default_factory=Counter)
    started: float = field(default_factory=time.perf_counter)

    def pct(self, p: float) -> float:
        if not self.latencies_ms:
            return float("nan")
        ordered = sorted(self.latencies_ms)
        return ordered[min(len(ordered) - 1, int(p / 100 * (len(ordered) - 1)))]

    def print(self) -> None:
        elapsed = time.perf_counter() - self.started
        failures = sum(self.errors.values())
        print(f"\n  requests         {len(self.latencies_ms) + failures:>8,}")
        print(f"  succeeded        {len(self.latencies_ms):>8,}")
        print(f"  FAILED           {failures:>8,}")
        print(f"  throughput       {len(self.latencies_ms) / elapsed:>8,.0f} /s")
        print(f"  p50              {self.pct(50):>8.1f} ms")
        print(f"  p99              {self.pct(99):>8.1f} ms")
        print(f"  max              {max(self.latencies_ms, default=0):>8.1f} ms")
        if self.errors:
            print("\n  the failures, which mean the migration is wrong:")
            for kind, n in self.errors.most_common():
                print(f"    {n:>6,}  {kind}")


def worker(conninfo: str, report: Report, until: float, lock: threading.Lock) -> None:
    rng = random.Random()
    with psycopg.connect(conninfo, autocommit=True) as conn, conn.cursor() as cur:
        while time.perf_counter() < until:
            started = time.perf_counter()
            try:
                if rng.random() < 0.3:
                    cur.execute(
                        """
                        insert into payments (merchant_id, amount_minor, status, created_at)
                        values (%s, %s, 'captured', now())
                        """,
                        (rng.randrange(1, 5000), rng.randrange(100, 50_000)),
                    )
                else:
                    cur.execute(
                        "select count(*) from payments where merchant_id = %s",
                        (rng.randrange(1, 5000),),
                    )
                    cur.fetchall()
                took = (time.perf_counter() - started) * 1000
                with lock:
                    report.latencies_ms.append(took)
            except Exception as exc:  # noqa: BLE001 - every failure is the finding
                with lock:
                    report.errors[f"{type(exc).__name__}: {str(exc)[:80]}"] += 1


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="loadgen")
    parser.add_argument("--seconds", type=float, default=60)
    parser.add_argument("--workers", type=int, default=8)
    args = parser.parse_args(argv)

    conninfo = os.environ.get("DATABASE_URL")
    if not conninfo:
        print("DATABASE_URL is not set")
        return 1

    report = Report()
    lock = threading.Lock()
    until = time.perf_counter() + args.seconds

    print(f"  {args.workers} workers for {args.seconds:.0f}s. Run the migration now.")
    threads = [
        threading.Thread(target=worker, args=(conninfo, report, until, lock))
        for _ in range(args.workers)
    ]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    report.print()
    # Non-zero on any failure, so this can gate a deploy.
    return 1 if sum(report.errors.values()) else 0


if __name__ == "__main__":
    sys.exit(main())
