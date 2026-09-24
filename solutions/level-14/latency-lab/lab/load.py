"""Open loop load: arrivals happen on a clock, not when the last one finished.

This is the file that decides whether any number in this repository means
anything. A CLOSED loop generator sends the next request when the last one
returns, so when the service slows down the generator politely slows down too
and a queue can never form. It is incapable of showing you overload, and every
measurement it produces is optimistic.

Check this property before trusting any load testing tool, including the ones
you pay for.
"""
from __future__ import annotations

import asyncio
import ctypes
import random
import statistics
import sys
import time

import httpx

try:
    ctypes.windll.winmm.timeBeginPeriod(1)
except Exception:
    pass

BASE = "http://t"
GENERATORS = 8


def pct(xs: list[float], p: float) -> float:
    if not xs:
        return float("nan")
    xs = sorted(xs)
    i = min(len(xs) - 1, int(round(p / 100 * (len(xs) - 1))))
    return xs[i]


async def one(client: httpx.AsyncClient, out: list, timeout_s: float,
              retries: int) -> None:
    started = time.perf_counter()
    attempts = 0
    while True:
        attempts += 1
        try:
            r = await asyncio.wait_for(
                client.get(f"/pay/{random.randrange(10_000)}"), timeout_s)
            out.append((r.status_code, (time.perf_counter() - started) * 1000, attempts, time.perf_counter()))
            return
        except (asyncio.TimeoutError, httpx.TimeoutException):
            if attempts > retries:
                out.append((408, (time.perf_counter() - started) * 1000, attempts, time.perf_counter()))
                return
        except Exception:
            out.append((599, (time.perf_counter() - started) * 1000, attempts, time.perf_counter()))
            return


async def generator(client, out, rate, seconds, timeout_s, retries, tasks) -> None:
    rng = random.Random()
    deadline = time.perf_counter() + seconds
    while time.perf_counter() < deadline:
        await asyncio.sleep(rng.expovariate(rate))
        tasks.append(asyncio.create_task(one(client, out, timeout_s, retries)))


async def run(rate: float, seconds: float, timeout_s: float = 30.0,
              retries: int = 0, config: dict | None = None) -> dict:
    from .service import app
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url=BASE) as client:
        if config is not None:
            await client.post("/config", json=config)
        await client.get("/pay/0")          # warm up
        out: list = []
        tasks: list = []
        gens = [asyncio.create_task(
            generator(client, out, rate / GENERATORS, seconds, timeout_s, retries, tasks))
            for _ in range(GENERATORS)]
        t0 = time.perf_counter()
        await asyncio.gather(*gens)
        if tasks:
            await asyncio.gather(*tasks)
        elapsed = seconds
        for _ in range(120):                    # let abandoned work drain
            stats = (await client.get("/stats")).json()
            if stats["waiting"] <= 0:
                break
            await asyncio.sleep(0.25)

    window_end = t0 + seconds
    good = [ms for code, ms, _, _ in out if code == 200]
    in_window = [1 for code, _, _, done in out if code == 200 and done <= window_end]
    return {
        "offered_rps": len(out) / elapsed,
        "n": len(out),
        "ok": len(good),
        "goodput_rps": len(in_window) / elapsed,
        "p50": pct(good, 50), "p90": pct(good, 90), "p99": pct(good, 99),
        "max": max(good) if good else float("nan"),
        "mean": statistics.mean(good) if good else float("nan"),
        "codes": {c: sum(1 for x in out if x[0] == c) for c in sorted({x[0] for x in out})},
        "attempts": sum(a for _, _, a, _ in out),
        "server": stats,
    }


def show(label: str, r: dict) -> None:
    print(f"{label:34s} offered {r['offered_rps']:6.0f}/s  good {r['goodput_rps']:6.0f}/s  "
          f"mean {r['mean']:7.1f}  p50 {r['p50']:7.1f}  p99 {r['p99']:8.1f}  "
          f"max {r['max']:8.1f}  {r['codes']}")


if __name__ == "__main__":
    rate = float(sys.argv[1]) if len(sys.argv) > 1 else 100
    secs = float(sys.argv[2]) if len(sys.argv) > 2 else 12
    show(f"{rate:.0f} rps", asyncio.run(run(rate, secs)))
