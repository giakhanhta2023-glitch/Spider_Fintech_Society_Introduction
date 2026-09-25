"""The four measurements the README publishes.

    python -m obs.experiments

1. what one more label costs, in series, memory and scrape time
2. why averaging percentiles across instances is wrong
3. how wrong a p99 read from the default histogram buckets is
4. what the logs cost per day and per year, before and after sampling

The alert replay is the fifth and lives in `slo/replay.py`, because it belongs
with the rules it judges.

Every number here is produced by this file. Seeds are fixed, so runs 2, 3 and 4
agree with each other exactly on everything except the timings, which are
whatever the machine was doing at the time.
"""

from __future__ import annotations

import gc
import io
import logging
import os
import statistics
import time

import numpy as np
import psutil
from prometheus_client import CollectorRegistry, Counter, Histogram

from .context import request_context
from .logging_ import JsonFormatter, SamplingPolicy, Volume, log
from .metrics import BUCKETS, scrape, series_count

PROCESS = psutil.Process(os.getpid())

# The Prometheus client library's defaults, kept here verbatim so experiment 3
# compares against the thing people actually have in production.
PROMETHEUS_DEFAULT = (
    0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1.0, 2.5, 5.0, 7.5, 10.0,
)

SCRAPE_INTERVAL_SECONDS = 15


def rss_mb() -> float:
    gc.collect()
    return PROCESS.memory_info().rss / 1024 / 1024


# ------------------------------------------------------------ 1. cardinality
def cardinality() -> list[dict]:
    """One counter, one more label each time. Series count is the product.

    The last row is the accident, and the pull request that causes it looks
    entirely reasonable: somebody wants to know which merchant is generating
    the errors, so they add `merchant_id`. With 500 merchants that multiplies
    every existing series by 500, and the number never comes back down, because
    Prometheus keeps a series for as long as its retention says to.
    """
    # The histogram case is second rather than last on purpose. Resident memory
    # is measured as a delta, and a delta taken just after two hundred megabytes
    # of registry was freed is noise: it came out negative when this case ran
    # last. Small cases go before large ones, and the ordering is part of the
    # measurement rather than a presentational choice.
    cases = [
        ("service, endpoint, status", ["service", "endpoint", "status"], [1, 20, 5], False),
        ("the same labels, as a histogram", ["service", "endpoint", "status"], [1, 20, 5], True),
        ("+ region", ["service", "endpoint", "status", "region"], [1, 20, 5, 4], False),
        ("+ merchant_id, 50 merchants",
         ["service", "endpoint", "status", "region", "merchant"], [1, 20, 5, 4, 50], False),
        ("+ merchant_id, 500 merchants",
         ["service", "endpoint", "status", "region", "merchant"], [1, 20, 5, 4, 500], False),
    ]

    results = []
    for name, labels, sizes, as_histogram in cases:
        registry = CollectorRegistry()
        if as_histogram:
            metric = Histogram(
                "http_request_duration_seconds", "duration", labels,
                buckets=BUCKETS, registry=registry,
            )
        else:
            metric = Counter("http_requests_total", "requests", labels, registry=registry)

        combinations = 1
        for size in sizes:
            combinations *= size

        before = rss_mb()
        index = [0] * len(sizes)
        for _ in range(combinations):
            values = [f"v{position}{index[position]}" for position in range(len(sizes))]
            if as_histogram:
                metric.labels(*values).observe(0.05)
            else:
                metric.labels(*values).inc()
            for position in range(len(sizes) - 1, -1, -1):
                index[position] += 1
                if index[position] < sizes[position]:
                    break
                index[position] = 0

        memory = rss_mb() - before
        started = time.perf_counter()
        body = scrape(registry)
        scrape_ms = (time.perf_counter() - started) * 1000

        results.append(
            {
                "labels": name,
                "label_sets": combinations,
                # Counted from the registry rather than multiplied out, so the
                # histogram row shows what 17 samples per label set really is.
                "series": series_count(registry),
                "rss_mb": memory,
                "scrape_kb": len(body) / 1024,
                "scrape_ms": scrape_ms,
                "share_of_interval": scrape_ms / 1000 / SCRAPE_INTERVAL_SECONDS,
            }
        )
        del registry, metric
    return results


# ------------------------------------------------- 2. averaging percentiles
def _latencies(rng, n: int, unhealthy: bool = False) -> np.ndarray:
    """The level 14 shape: 90% fast, 10% on the slow path. Three times slower
    if the instance is unhealthy, which is what a bad node looks like."""
    slow = rng.random(n) < 0.10
    base = np.where(slow, rng.normal(250, 40, n), rng.normal(50, 8, n))
    return base * (3.0 if unhealthy else 1.0)


def percentile_averaging() -> dict:
    """Ten instances, one of them sick, and three ways to report the tail.

    The average of ten p99s is not the p99 of anything. It is not an
    approximation either: there is no weighting that makes it correct, because a
    percentile is not a mean and cannot be averaged.
    """
    rng = np.random.default_rng(16)
    healthy = [_latencies(rng, 100_000) for _ in range(9)]
    sick = _latencies(rng, 100_000, unhealthy=True)
    per_instance = [float(np.percentile(x, 99)) for x in healthy + [sick]]
    union = np.concatenate(healthy + [sick])

    return {
        "instances": 10,
        "true_p99": float(np.percentile(union, 99)),
        "mean_of_p99s": float(np.mean(per_instance)),
        "max_of_p99s": float(np.max(per_instance)),
        "sick_p99": float(np.percentile(sick, 99)),
        "healthy_p99": float(np.mean([np.percentile(x, 99) for x in healthy])),
        "all_healthy_true_p99": float(np.percentile(np.concatenate(healthy), 99)),
    }


# -------------------------------------------------- 3. histogram bucket error
def histogram_quantile(edges: list[float], cumulative: list[int], q: float) -> float:
    """Prometheus `histogram_quantile`, reimplemented in eight lines.

    Worth reading once, because it explains every wrong latency dashboard: the
    function knows how many observations fell in each bucket and nothing else,
    so it interpolates linearly between the edges. If the p99 lands in a bucket
    250 ms wide, the answer is a straight line drawn through a range where the
    real distribution is nothing like straight.
    """
    total = cumulative[-1]
    target = q * total
    for i, count in enumerate(cumulative):
        if count >= target:
            lower = 0.0 if i == 0 else edges[i - 1]
            upper = edges[i]
            below = 0 if i == 0 else cumulative[i - 1]
            if count == below:
                return upper
            return lower + (upper - lower) * (target - below) / (count - below)
    return edges[-1]


def histogram_error() -> list[dict]:
    """The same 500,000 requests, read through two sets of buckets."""
    rng = np.random.default_rng(161)
    seconds = _latencies(rng, 500_000) / 1000.0
    exact_ms = float(np.percentile(seconds, 99)) * 1000

    results = []
    for name, edges in (
        ("Prometheus defaults", list(PROMETHEUS_DEFAULT)),
        ("tuned to this service", list(BUCKETS)),
    ):
        cumulative = [int((seconds <= edge).sum()) for edge in edges]
        cumulative.append(len(seconds))
        estimate_ms = histogram_quantile(edges + [float("inf")], cumulative, 0.99) * 1000
        results.append(
            {
                "buckets": name,
                "estimate_ms": estimate_ms,
                "exact_ms": exact_ms,
                "error_pct": (estimate_ms - exact_ms) / exact_ms * 100,
                "series_per_label_set": len(edges) + 3,
            }
        )
    return results


# ------------------------------------------------------------ 4. log volume
LINES_PER_REQUEST = 6          # started, authorized, tokenised, published, captured, finished


def log_volume(requests_per_second: float = 200.0) -> dict:
    """Measure the line, then do the arithmetic.

    People estimate log volume by feel and are wrong by an order of magnitude in
    both directions. It takes one measurement: render the lines this service
    actually emits, take the median size, multiply.
    """
    buffer = io.StringIO()
    handler = logging.StreamHandler(buffer)
    handler.setFormatter(JsonFormatter())
    logger = logging.getLogger("volume-measurement")
    logger.handlers = [handler]
    logger.setLevel(logging.INFO)
    logger.propagate = False

    sizes: list[int] = []
    for i in range(500):
        with request_context():
            for event, fields in (
                ("request.started", {"endpoint": "POST /payments", "method": "POST"}),
                ("payment.authorized", {"payment_id": f"pay_{i:06d}", "amount_minor": 1999 + i}),
                ("vault.tokenised", {"token": "tok_9Qb3xK", "bin": "411111", "last4": "1111"}),
                ("queue.published", {"queue": "payments.captured", "attempt": 1}),
                ("payment.captured", {"payment_id": f"pay_{i:06d}", "status": "captured"}),
                ("request.finished", {"status_class": "2xx", "duration_ms": 61.4}),
            ):
                before = buffer.tell()
                log(logger, event, **fields)
                sizes.append(buffer.tell() - before)

    logger.handlers = []
    bytes_per_line = statistics.median(sizes)

    full = Volume(
        bytes_per_line=bytes_per_line,
        lines_per_request=LINES_PER_REQUEST,
        requests_per_second=requests_per_second,
    )
    policy = SamplingPolicy(keep_one_in=20, slow_ms=250.0)
    sampled = full.sampled(policy, failure_rate=0.001, slow_rate=0.02)

    return {
        "bytes_per_line": bytes_per_line,
        "lines_measured": len(sizes),
        "requests_per_second": requests_per_second,
        "full_gb_per_day": full.gb_per_day,
        "full_dollars_per_year": full.dollars_per_year,
        "sampled_gb_per_day": sampled.gb_per_day,
        "sampled_dollars_per_year": sampled.dollars_per_year,
        "kept_share": sampled.lines_per_request / full.lines_per_request,
        "dollars_per_gb": full.dollars_per_gb,
    }


def main() -> None:
    print("1. What one more label costs")
    for row in cardinality():
        print(
            f"   {row['labels']:30s} {row['series']:>9,} series  "
            f"{row['rss_mb']:7.1f} MB  scrape {row['scrape_kb']:9,.0f} kB in "
            f"{row['scrape_ms']:9,.1f} ms  ({row['share_of_interval']:6.1%} of the interval)"
        )

    print("\n2. Ten instances, one of them three times slower")
    p = percentile_averaging()
    print(f"   true p99 over every request       {p['true_p99']:8.1f} ms")
    print(f"   mean of the ten instance p99s     {p['mean_of_p99s']:8.1f} ms")
    print(f"   max of the ten instance p99s      {p['max_of_p99s']:8.1f} ms")
    print(f"   the sick instance alone           {p['sick_p99']:8.1f} ms")
    print(f"   a healthy instance                {p['healthy_p99']:8.1f} ms")
    print(f"   true p99 with ten healthy         {p['all_healthy_true_p99']:8.1f} ms")

    print("\n3. A p99 read out of a histogram")
    for row in histogram_error():
        print(
            f"   {row['buckets']:24s} estimate {row['estimate_ms']:8.1f} ms  "
            f"exact {row['exact_ms']:7.1f} ms  error {row['error_pct']:+7.1f}%"
        )

    print("\n4. What the logs cost")
    v = log_volume()
    print(f"   median line {v['bytes_per_line']:.0f} bytes, {LINES_PER_REQUEST} lines a request, "
          f"{v['requests_per_second']:.0f} requests a second")
    print(f"   everything:      {v['full_gb_per_day']:8.1f} GB a day   "
          f"${v['full_dollars_per_year']:12,.0f} a year")
    print(f"   sampled policy:  {v['sampled_gb_per_day']:8.1f} GB a day   "
          f"${v['sampled_dollars_per_year']:12,.0f} a year   "
          f"({v['kept_share']:.1%} of lines kept)")
    print(f"   at ${v['dollars_per_gb']:.2f} a gigabyte, which is the number to replace "
          f"with your own")


if __name__ == "__main__":
    main()
