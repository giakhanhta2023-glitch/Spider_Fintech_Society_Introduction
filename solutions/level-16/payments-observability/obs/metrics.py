"""RED metrics, a series budget the build enforces, and tuned buckets.

Rate, errors, duration. Three numbers per endpoint answer "is it working" for
almost any request driven service, and the reason to write them down as a set is
that a dashboard assembled from whatever seemed interesting answers nothing.

Two controls on cardinality, because they fail differently.

**A guard at the call site.** Label values come from a fixed set, and anything
else becomes `other`. This is what stops the accident: the pull request that
adds `merchant_id` cannot, because `merchant_id` is not an allowed label and the
endpoint label only accepts route templates.

**A budget checked by a test.** `assert_within_budget` fails the build when the
series count crosses the number written down. The guard prevents the obvious
mistake; the test catches the creative one.

The measured cost of getting this wrong is in `obs/experiments.py`, and it is
not subtle: 100 series scraped in a few milliseconds, 200,000 series in eight to
eighteen seconds against a 15 second scrape interval. Monitoring becomes the
outage.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from prometheus_client import CollectorRegistry, Counter, Gauge, Histogram, generate_latest

# Written down, in the repository, where a reviewer can see it change.
MAX_SERIES = 5_000

# Buckets in seconds. These are not defaults: they come from the measured
# latency distribution of the level 14 service, which is bimodal at roughly
# 50 ms and 250 ms. The default Prometheus buckets have a 250 ms gap between
# 0.25 and 0.5, which is exactly where this service's p99 lives, and reading a
# p99 out of that gap was wrong by 49%. See experiment 3.
BUCKETS = (0.02, 0.03, 0.04, 0.05, 0.06, 0.08, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.6, 1.0)

# Route templates, not paths. `/payments/pay_01H9Z` is an unbounded label value
# and one busy afternoon is a million series.
ENDPOINTS = frozenset(
    {
        "POST /payments",
        "GET /payments/{id}",
        "POST /payments/{id}/capture",
        "POST /payments/{id}/refund",
        "POST /webhooks/processor",
        "GET /healthz",
        "other",
    }
)

_ID_LIKE = re.compile(r"(?:pay|tok|mer|req)_[A-Za-z0-9]+|\b\d{3,}\b|[0-9a-f]{8,}")

# Every label, and the complete set of values it may take. A label missing from
# here cannot be used, which is the difference between a budget that is checked
# and a budget that is hoped for.
STATUS_CLASSES = frozenset({"2xx", "3xx", "4xx", "5xx"})
QUEUES = frozenset({"payouts", "payments.captured", "webhooks.outbound"})

LABEL_DOMAINS: dict[str, frozenset[str]] = {
    "endpoint": ENDPOINTS,
    "status_class": STATUS_CLASSES,
    "queue": QUEUES,
}


class SeriesBudgetExceeded(Exception):
    """The registry grew past the number this repository agreed to."""


class UnboundedLabel(Exception):
    """A label whose set of values nobody can write down.

    `merchant_id` is the canonical example, and `customer_id`, `payment_id`,
    `user_agent`, `url` and `error_message` are the same mistake wearing
    different hats. If the set cannot be enumerated in this file, the value
    belongs in a log line or a trace attribute, where one more distinct value
    costs one row rather than one permanent time series.
    """


@dataclass(frozen=True, slots=True)
class MetricSpec:
    """What a metric is allowed to be, declared where a reviewer reads it."""

    name: str
    kind: str                      # counter, gauge or histogram
    labels: tuple[str, ...]

    @property
    def samples_per_series(self) -> int:
        """Why histograms are the expensive ones.

        A counter is one sample per label set. A histogram is one per bucket,
        plus the infinite bucket, plus the sum and the count: with fourteen
        declared buckets that is seventeen. Measured, not assumed: 100 label
        sets produced 1,700 series in experiment 1.
        """
        if self.kind == "histogram":
            return len(BUCKETS) + 3
        return 1


SPECS = (
    MetricSpec("http_requests_total", "counter", ("endpoint", "status_class")),
    MetricSpec("http_request_duration_seconds", "histogram", ("endpoint",)),
    MetricSpec("http_requests_in_flight", "gauge", ()),
    MetricSpec("queue_depth", "gauge", ("queue",)),
)


def worst_case_series(specs: tuple[MetricSpec, ...] = SPECS) -> int:
    """The ceiling this design can ever reach, from the declaration alone.

    This is the number the budget should be checked against, and the reason is a
    game day finding rather than a design instinct. The original test asserted
    the budget against a registry the test itself had populated, which contained
    fifteen label combinations: it would have passed with `merchant_id` added and
    five hundred merchants in production. A budget test that only sees test
    traffic measures the test.
    """
    total = 0
    for spec in specs:
        combinations = 1
        for label in spec.labels:
            domain = LABEL_DOMAINS.get(label)
            if domain is None:
                raise UnboundedLabel(
                    f"{label!r} on {spec.name} has no declared set of values. "
                    "Either enumerate them in LABEL_DOMAINS, or put the value in "
                    "a log field or a span attribute instead of a label."
                )
            combinations *= len(domain)
        total += combinations * spec.samples_per_series
    return total


def normalise_endpoint(method: str, path: str) -> str:
    """Turn a request path into one of a fixed set of labels.

    Anything unrecognised becomes `other` rather than itself. A metric label is
    not a place to discover what URLs exist: that is what logs are for, and
    they are not indexed by series.
    """
    template = _ID_LIKE.sub("{id}", path.rstrip("/") or "/")
    candidate = f"{method.upper()} {template}"
    return candidate if candidate in ENDPOINTS else "other"


@dataclass
class Metrics:
    """One registry, four metrics, and every label value bounded.

    `status_class` rather than `status`: 5xx and 4xx are the question anybody
    asks, and the exact code is in the log line for the one time it matters.
    That single choice is the difference between 5 values and 60.
    """

    registry: CollectorRegistry = None  # type: ignore[assignment]

    def __post_init__(self) -> None:
        self.registry = self.registry or CollectorRegistry()
        self.requests = Counter(
            "http_requests_total",
            "Requests, by endpoint and status class",
            ["endpoint", "status_class"],
            registry=self.registry,
        )
        self.duration = Histogram(
            "http_request_duration_seconds",
            "Request duration, buckets tuned to this service",
            ["endpoint"],
            buckets=BUCKETS,
            registry=self.registry,
        )
        # Saturation, which is not part of RED and is the first thing anybody
        # asks for during an incident: how close to the wall are we.
        self.in_flight = Gauge(
            "http_requests_in_flight",
            "Requests currently being served",
            registry=self.registry,
        )
        self.queue_depth = Gauge(
            "queue_depth",
            "Messages waiting, by queue",
            ["queue"],
            registry=self.registry,
        )

    def observe(self, method: str, path: str, status: int, seconds: float) -> str:
        endpoint = normalise_endpoint(method, path)
        self.requests.labels(endpoint=endpoint, status_class=f"{status // 100}xx").inc()
        self.duration.labels(endpoint=endpoint).observe(seconds)
        return endpoint


def series_count(registry: CollectorRegistry) -> int:
    """Time series in a registry, counted the way Prometheus would.

    Every sample is a series, so a histogram with 14 buckets is 17 of them per
    label combination: 15 buckets including the infinite one, plus the sum and
    the count. People are surprised by that, and it is why a histogram on a
    high cardinality label is the most expensive mistake in this file.
    """
    total = 0
    for family in registry.collect():
        for sample in family.samples:
            if sample.name.endswith("_created"):
                continue                      # bookkeeping, not a series
            total += 1
    return total


def assert_within_budget(registry: CollectorRegistry, limit: int = MAX_SERIES) -> int:
    """Two checks, and the second one is the one that works.

    The live count catches a registry that has already grown. The worst case
    from the declaration catches the design that is going to grow, which is the
    only version of this that fails in the pull request rather than in
    production.
    """
    ceiling = worst_case_series()
    if ceiling > limit:
        raise SeriesBudgetExceeded(
            f"the declared metrics can produce {ceiling:,} series against a "
            f"budget of {limit:,}. Reduce the label domains or raise the budget "
            "on purpose, in this file, where somebody will read it."
        )

    count = series_count(registry)
    if count > limit:
        raise SeriesBudgetExceeded(
            f"{count:,} series against a budget of {limit:,}. "
            "Find the label with unbounded values before this reaches production: "
            "the scrape slows down first and the server runs out of memory second."
        )
    return count


def scrape(registry: CollectorRegistry) -> bytes:
    """What Prometheus pulls. Used by the experiment to time a real scrape."""
    return generate_latest(registry)
