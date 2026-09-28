"""The sustained load test, and the report it writes.

    python -m bench.load --minutes 60          # the level's hour
    python -m bench.load --minutes 5 --rps 400 # what fits in a coffee break

Open loop, which is the only kind that can measure overload: arrivals happen on a
schedule regardless of whether the platform is keeping up, so the queue is allowed
to grow and the measurement is allowed to get worse. A closed loop generator waits
for each response and therefore never offers more than the platform can serve,
which makes every number it produces a description of itself.

Three things are recorded that a naive benchmark leaves out:

**Goodput, not throughput.** A response after the caller has given up is not a
success. The deadline is the latency objective, and anything slower counts as
failed even when it returns 201.

**A warm up that is discarded.** The first seconds are import time, empty caches
and cold branch predictors, and including them moves the p50 without telling you
anything about the platform.

**The utilisation at which the objective breaks**, by sweeping rather than by
asking one question at one rate. That number is the capacity plan.
"""

from __future__ import annotations

import argparse
import json
import statistics
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path

from platform_.platform import Platform
from recon.daily import reconcile

# Windows sleeps in 15.6 millisecond chunks by default, so `time.sleep(0.002)`
# takes fifteen milliseconds and an open loop generator asking for 500 arrivals a
# second gets about 64. The first run of this file measured a mean latency of
# 776 ms against a service time of 0.04 ms, which was entirely the clock: the
# platform was fine and the generator could not keep time.
#
# Level 14 hit the same wall and this is the same fix, with the same caveat: it
# changes a process wide timer setting, so it is done once, at import, in a file
# whose only job is measurement.
if sys.platform == "win32":
    try:
        import ctypes

        ctypes.windll.winmm.timeBeginPeriod(1)
    except (AttributeError, OSError):       # not Windows after all, or no winmm
        pass


def wait_until(deadline: float) -> None:
    """Sleep most of the way, then spin.

    A bare sleep cannot land inside a millisecond on any common platform, and
    spinning the whole way burns a core. Sleeping until a millisecond before and
    spinning the rest keeps the schedule honest at four figure arrival rates,
    which is the difference between measuring the platform and measuring sleep().
    """
    while True:
        remaining = deadline - time.perf_counter()
        if remaining <= 0:
            return
        if remaining > 0.002:
            time.sleep(remaining - 0.001)
        # The last millisecond, spun rather than slept.

# The latency objective, from level 16's SLO document. A response slower than
# this is not a success, whatever status code it carries.
OBJECTIVE_MS = 500.0
WARMUP_SECONDS = 5.0


@dataclass
class Result:
    offered: int = 0
    accepted: int = 0
    refused: int = 0
    slower_than_objective: int = 0
    latencies_ms: list[float] = field(default_factory=list)
    # Time spent doing the work, without the queueing delay in front of it. The
    # pair is what separates "the platform got slower" from "the platform is
    # behind", which need different fixes.
    service_ms: list[float] = field(default_factory=list)
    seconds: float = 0.0
    warmed_up_at: float = 0.0

    def percentile(self, p: float) -> float:
        if not self.latencies_ms:
            return 0.0
        ordered = sorted(self.latencies_ms)
        index = min(int(len(ordered) * p / 100), len(ordered) - 1)
        return ordered[index]

    @property
    def goodput_per_second(self) -> float:
        """Successful and inside the objective, per second. The honest number."""
        good = self.accepted - self.slower_than_objective
        return good / self.seconds if self.seconds else 0.0

    @property
    def throughput_per_second(self) -> float:
        return self.accepted / self.seconds if self.seconds else 0.0

    def as_dict(self) -> dict:
        return {
            "offered": self.offered,
            "accepted": self.accepted,
            "refused": self.refused,
            "slower_than_objective": self.slower_than_objective,
            "seconds": round(self.seconds, 2),
            "p50_ms": round(self.percentile(50), 3),
            "p95_ms": round(self.percentile(95), 3),
            "p99_ms": round(self.percentile(99), 3),
            "max_ms": round(max(self.latencies_ms, default=0.0), 3),
            "mean_ms": round(statistics.fmean(self.latencies_ms), 3)
            if self.latencies_ms else 0.0,
            "service_p50_ms": round(
                sorted(self.service_ms)[len(self.service_ms) // 2], 3
            ) if self.service_ms else 0.0,
            "service_p99_ms": round(
                sorted(self.service_ms)[min(int(len(self.service_ms) * 0.99),
                                            len(self.service_ms) - 1)], 3
            ) if self.service_ms else 0.0,
            "throughput_per_second": round(self.throughput_per_second, 1),
            "goodput_per_second": round(self.goodput_per_second, 1),
        }


def run(platform: Platform, rps: float, seconds: float,
        warmup: float = WARMUP_SECONDS) -> Result:
    """Offer `rps` payments a second for `seconds`, regardless of what happens.

    The schedule is computed from the start time rather than by sleeping between
    requests, so a slow request does not push every later arrival back. That is
    the difference between an open loop and a closed one, and it is four lines.
    """
    result = Result()
    interval = 1.0 / rps
    started = time.perf_counter()
    deadline = started + seconds + warmup
    warm_at = started + warmup
    result.warmed_up_at = warmup

    arrival = started
    # The platform settles itself in its own thread, so the generator does
    # nothing but offer payments. A generator that also does the platform's
    # background work measures the two together and blames the wrong one.
    platform.start()

    while time.perf_counter() < deadline:
        if arrival > time.perf_counter():
            wait_until(arrival)

        scheduled = arrival
        request_started = time.perf_counter()
        response = platform.payment(1999 + (result.offered % 5) * 100)
        finished = time.perf_counter()
        # Measured from the moment the request was *due*, not from the moment it
        # started. That difference is coordinated omission, and it is the single
        # most common way a load test lies: when the generator falls behind, the
        # requests it has not sent yet are the slow ones, and timing only the
        # ones it managed to send reports a healthy p99 during an overload.
        took_ms = (finished - scheduled) * 1000
        service_ms = (finished - request_started) * 1000
        arrival += interval

        counting = request_started >= warm_at
        if counting:
            result.offered += 1
            result.latencies_ms.append(took_ms)
            result.service_ms.append(service_ms)
            if response["status"] == 201:
                result.accepted += 1
                if took_ms > OBJECTIVE_MS:
                    result.slower_than_objective += 1
            else:
                result.refused += 1

    result.seconds = time.perf_counter() - warm_at
    platform.stop()            # stops the settler and drains what is left
    return result


def sweep(rates: tuple[float, ...], seconds_each: float) -> list[dict]:
    """The same test at several rates, to find where the objective breaks.

    A fresh platform per rate, so one rate's backlog is not the next rate's
    starting condition.
    """
    rows = []
    for rate in rates:
        platform = Platform()
        # The sweep is looking for the rate at which the *latency* objective
        # breaks, and the bank's millisecond per payout would otherwise decide
        # the answer: one worker calling a 1 ms bank is a thousand payouts a
        # second whatever the API can do. So the sweep uses a fast bank and the
        # payout ceiling is reported separately, as its own number, rather than
        # hidden inside this one.
        platform.bank.latency_seconds = 0.00005
        result = run(platform, rps=rate, seconds=seconds_each, warmup=1.0)

        # Measured before the final drain, because the question is whether the
        # asynchronous half kept up while the load was arriving. Draining first
        # and then reporting zero backlog is how a load test reports that
        # everything was fine.
        backlog = platform.outbox.backlog
        awaiting_payout = sum(
            1 for p in platform.api.payments.values() if p.payout_state == "pending"
        )
        # A bounded drain rather than "until empty": at rates the platform
        # cannot keep up with, draining everything is a measurement of the
        # bank simulator's sleep rather than of the platform.
        for _ in range(20):
            platform.settle()
        reconciliation = reconcile(platform)

        row = {
            "offered_rps": rate,
            **result.as_dict(),
            "outbox_backlog_at_end": backlog,
            "awaiting_payout_at_end": awaiting_payout,
            "breaks": len(reconciliation.breaks),
        }
        # Two objectives, and they break at different rates, which is the point
        # of measuring both: the API stays inside its latency objective long
        # after the payout path has stopped keeping up.
        row["latency_objective_met"] = row["p99_ms"] <= OBJECTIVE_MS
        row["payouts_keeping_up"] = awaiting_payout < rate      # under a second of work
        rows.append(row)
    return rows


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--minutes", type=float, default=1.0)
    parser.add_argument("--rps", type=float, default=200.0)
    parser.add_argument("--sweep", action="store_true", help="find the breaking point")
    parser.add_argument("--out", default="bench/report.json")
    arguments = parser.parse_args()

    platform = Platform()
    seconds = arguments.minutes * 60

    print(f"offering {arguments.rps:.0f} payments a second for {arguments.minutes:g} "
          f"minute(s), after a {WARMUP_SECONDS:.0f} second warm up\n")

    result = run(platform, rps=arguments.rps, seconds=seconds)
    reconciliation = reconcile(platform)
    report = {
        "sustained": {"offered_rps": arguments.rps, **result.as_dict()},
        "reconciliation": {
            "breaks": [str(b) for b in reconciliation.breaks],
            "checks": reconciliation.checks,
            "totals": reconciliation.totals,
        },
        "objective_ms": OBJECTIVE_MS,
    }

    for name, value in report["sustained"].items():
        print(f"   {name:24} {value:>12,}" if isinstance(value, int)
              else f"   {name:24} {value:>12}")

    print(f"\n   reconciliation: {reconciliation.summary()}")

    if arguments.sweep:
        print("\nfinding the rate at which the objective breaks\n")
        rows = sweep((500, 1_000, 2_000, 4_000, 8_000), seconds_each=8)
        report["sweep"] = rows
        print(f"   {'offered':>9}  {'p50':>8}  {'p99':>9}  {'goodput':>9}  "
              f"{'latency':>8}  {'awaiting payout':>16}")
        for row in rows:
            print(f"   {row['offered_rps']:>9,.0f}  {row['p50_ms']:>6.2f}ms  "
                  f"{row['p99_ms']:>7.2f}ms  {row['goodput_per_second']:>9,.0f}  "
                  f"{'met' if row['latency_objective_met'] else 'BROKEN':>8}  "
                  f"{row['awaiting_payout_at_end']:>16,}")

    out = Path(arguments.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"\nwritten to {out}")


if __name__ == "__main__":
    main()
