"""Every number the README publishes, reproducible with one command.

    python -m lab.experiments

Takes a few minutes: five configurations, three runs each, median reported.
A single run on a laptop varies by about twenty percent, and publishing one as
a result is the measurement equivalent of a lucky test.

Capacity is computed before anything is measured, so the measurements have
something to disagree with:

    8 worker slots / 0.070 s mean service time = 114 requests per second

Little's law, and it is arithmetic rather than opinion. Every offered load
below is quoted as a share of it.
"""

from __future__ import annotations

import asyncio
import statistics
import sys

from .load import run

BASE = {
    "workers": 8,
    "fast_ms": 50.0,
    "slow_ms": 250.0,
    "slow_share": 0.10,      # mean service time 70 ms
    "cache_hit_ratio": 0.0,
    "cache_ms": 1.0,
    "limit_rps": None,
    "burst": 50.0,
    "shed_queue": None,
}

CAPACITY = 8 / 0.070
REPEATS = 3


def cfg(**kw) -> dict:
    out = dict(BASE)
    out.update(kw)
    return out


async def median_of_three(label: str, rate: float, seconds: float, **kw) -> dict:
    runs = [await run(rate, seconds, **kw) for _ in range(REPEATS)]
    out = {
        k: statistics.median(r[k] for r in runs)
        for k in ("offered_rps", "goodput_rps", "mean", "p50", "p90", "p99", "max",
                  "n", "attempts")
    }
    codes: dict[int, list[int]] = {}
    for r in runs:
        for code, n in r["codes"].items():
            codes.setdefault(code, []).append(n)
    out["codes"] = {c: int(statistics.median(v)) for c, v in sorted(codes.items())}
    print(
        f"{label:30s} offered {out['offered_rps']:6.0f}/s  good {out['goodput_rps']:6.0f}/s  "
        f"p50 {out['p50']:7.1f}  p99 {out['p99']:8.1f}  {out['codes']}"
    )
    return out


async def main() -> int:
    print(f"8 workers, 50 ms service time with a 10% tail at 250 ms")
    print(f"mean 70 ms, so capacity = 8 / 0.070 = {CAPACITY:.0f} rps\n")

    print("--- 1. what load does to the tail ---")
    for rate in (40, 70, 90, 100, 108):
        await median_of_three(
            f"{rate} rps ({rate / CAPACITY:.0%} of capacity)", rate, 15, config=cfg()
        )

    print("\n--- 2. a cache, offered 100 rps (88% of capacity) ---")
    for hit in (0.0, 0.5, 0.8, 0.95):
        await median_of_three(
            f"hit ratio {hit:.0%}", 100, 15, config=cfg(cache_hit_ratio=hit)
        )

    print("\n--- 3. retries, offered 100 rps, client timeout 250 ms ---")
    for retries in (0, 2):
        await median_of_three(
            f"retries {retries}", 100, 15, timeout_s=0.25, retries=retries, config=cfg()
        )

    print("\n--- 4. shedding, offered 250 rps (219% of capacity) ---")
    for shed in (None, 20):
        await median_of_three(
            f"shed queue {shed}", 250, 12, timeout_s=3.0, config=cfg(shed_queue=shed)
        )

    print("\n--- 5. a token bucket at 100 rps, offered 250 rps ---")
    await median_of_three(
        "limiter on", 250, 12, timeout_s=3.0, config=cfg(limit_rps=100.0, burst=20.0)
    )

    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
