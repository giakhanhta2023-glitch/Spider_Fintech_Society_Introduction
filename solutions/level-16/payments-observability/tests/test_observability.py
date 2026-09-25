"""The eleven tests the level asks for, plus the guards that make them hold.

Nothing here needs Docker, Prometheus or a collector. Two of these assertions
are the kind that only fail in a pull request that would have caused an outage
(the series budget and the allowlist), and those are the two worth having.
"""

from __future__ import annotations

import io
import json
import logging
from pathlib import Path

import numpy as np
import pytest
import yaml
from prometheus_client import CollectorRegistry, Counter

from obs.context import Envelope, from_headers, new_request_id, request_context, request_id
from obs.experiments import histogram_error, percentile_averaging
from obs.logging_ import JsonFormatter, SamplingPolicy, UnregisteredEvent, log
from obs.metrics import (
    BUCKETS,
    LABEL_DOMAINS,
    MAX_SERIES,
    SPECS,
    Metrics,
    MetricSpec,
    SeriesBudgetExceeded,
    UnboundedLabel,
    assert_within_budget,
    normalise_endpoint,
    series_count,
    worst_case_series,
)
from obs.sampling import TailSampler, measure
from obs.tracing import Tracer, render, unbroken
from slo import replay as replay_module
from slo.budget import LADDER, burn_rate, human

HERE = Path(__file__).resolve().parent.parent


# --------------------------------------------------------------- capturing
class Captured:
    """A logger writing rendered JSON lines into a list."""

    def __init__(self) -> None:
        self.buffer = io.StringIO()
        handler = logging.StreamHandler(self.buffer)
        handler.setFormatter(JsonFormatter())
        self.logger = logging.getLogger(f"test-{id(self)}")
        self.logger.handlers = [handler]
        self.logger.setLevel(logging.INFO)
        self.logger.propagate = False

    @property
    def lines(self) -> list[dict]:
        return [json.loads(line) for line in self.buffer.getvalue().splitlines() if line]


@pytest.fixture
def captured() -> Captured:
    return Captured()


# ------------------------------------------------------------------- logs
def test_every_line_in_one_request_carries_the_same_request_id(captured) -> None:
    """Test 1. The one property that makes logs worth keeping."""
    with request_context() as rid:
        log(captured.logger, "request.started", endpoint="POST /payments")
        log(captured.logger, "payment.authorized", payment_id="pay_1")
        log(captured.logger, "queue.published", queue="payments.captured")
        log(captured.logger, "request.finished", status_class="2xx", duration_ms=61.4)

    ids = {line["request_id"] for line in captured.lines}
    assert ids == {rid}
    assert len(captured.lines) == 4


def test_two_requests_do_not_share_an_id(captured) -> None:
    with request_context():
        log(captured.logger, "request.started")
    with request_context():
        log(captured.logger, "request.started")

    first, second = captured.lines
    assert first["request_id"] != second["request_id"]


def test_no_field_outside_the_allowlist_reaches_a_line(captured) -> None:
    """Test 2. An allowlist, so the field added next Tuesday is dropped by
    default rather than published by default."""
    with request_context():
        log(
            captured.logger,
            "payment.captured",
            payment_id="pay_1",
            pan="4111111111111111",          # never, under any circumstances
            cvv="123",
            internal_note="whatever somebody was debugging",
        )

    line = captured.lines[0]
    rendered = json.dumps(line)
    assert "4111111111111111" not in rendered
    assert "pan" not in line
    assert "cvv" not in line
    assert line["dropped"] == ["cvv", "internal_note", "pan"]


def test_an_unregistered_event_name_is_refused_in_tests(captured) -> None:
    """Strict in the suite, tolerant in production: a logging call is not a
    place to fail a payment, and it is a fine place to fail a build."""
    with pytest.raises(UnregisteredEvent):
        log(captured.logger, "somebody.invented.this", strict=True)

    log(captured.logger, "payment captured in full", amount_minor=100)
    assert captured.lines[0]["event"] == "event.unregistered"


def test_an_upstream_request_id_is_checked_before_it_is_trusted() -> None:
    """A caller controls this value, and it ends up in the log aggregator."""
    assert from_headers({"x-request-id": "req_abc123"}) == "req_abc123"
    for hostile in ('req_"; drop table', "req_" + "a" * 60, "not-ours", ""):
        assert from_headers({"x-request-id": hostile}).startswith("req_")
        assert from_headers({"x-request-id": hostile}) != hostile


def test_the_sampling_policy_keeps_every_error_and_every_slow_request() -> None:
    policy = SamplingPolicy(keep_one_in=20, slow_ms=250.0)
    ids = [new_request_id() for _ in range(2_000)]

    assert all(policy.keep(r, failed=True, duration_ms=10) for r in ids)
    assert all(policy.keep(r, failed=False, duration_ms=251) for r in ids)

    kept = sum(policy.keep(r, failed=False, duration_ms=50) for r in ids)
    assert 0.02 < kept / len(ids) < 0.09      # about one in twenty, by hash

    # Every line of one request is kept or dropped together, never split.
    one = ids[0]
    assert len({policy.keep(one, failed=False, duration_ms=50) for _ in range(10)}) == 1


# ---------------------------------------------------------------- metrics
def test_the_registry_stays_under_the_series_budget() -> None:
    """Test 3, the passing half."""
    metrics = Metrics()
    for endpoint in ("POST /payments", "GET /payments/{id}", "POST /webhooks/processor"):
        method, path = endpoint.split(" ", 1)
        for status in (200, 201, 400, 402, 500):
            metrics.observe(method, path, status, 0.061)

    count = assert_within_budget(metrics.registry)
    assert count < MAX_SERIES


def test_the_budget_fails_when_somebody_adds_a_high_cardinality_label() -> None:
    """Test 3, the half that has to fail. This is the test that catches the
    reasonable looking pull request."""
    registry = CollectorRegistry()
    counter = Counter(
        "http_requests_total", "requests",
        ["endpoint", "status_class", "merchant_id"], registry=registry,
    )
    for merchant in range(500):
        for status in ("2xx", "5xx"):
            counter.labels("POST /payments", status, f"mer_{merchant}").inc()

    assert series_count(registry) == 1_000
    with pytest.raises(SeriesBudgetExceeded) as raised:
        assert_within_budget(registry, limit=500)
    assert "unbounded" in str(raised.value)


def test_the_declared_ceiling_is_under_the_budget_with_room_to_spare() -> None:
    """The check that would have caught the accident, which the first version of
    this test did not: it asserted the budget against fifteen label combinations
    the test had created itself.
    """
    ceiling = worst_case_series()
    assert ceiling < MAX_SERIES
    assert ceiling == len(LABEL_DOMAINS["endpoint"]) * len(LABEL_DOMAINS["status_class"]) + (
        len(LABEL_DOMAINS["endpoint"]) * (len(BUCKETS) + 3)
    ) + 1 + len(LABEL_DOMAINS["queue"])


def test_a_label_with_no_declared_values_cannot_be_used_at_all() -> None:
    """Test 3, the half that has to fail, done at the design rather than at the
    volume. `merchant_id` has no enumerable set of values, so it is refused
    before anybody measures anything."""
    with_merchant = SPECS + (
        MetricSpec("payments_total", "counter", ("endpoint", "merchant_id")),
    )
    with pytest.raises(UnboundedLabel) as raised:
        worst_case_series(with_merchant)
    assert "merchant_id" in str(raised.value)
    assert "log field or a span attribute" in str(raised.value)


def test_the_declaration_matches_the_metrics_actually_registered() -> None:
    """Drift guard. A declaration nothing checks is a comment."""
    metrics = Metrics()
    metrics.observe("POST", "/payments", 200, 0.061)
    metrics.queue_depth.labels(queue="payouts").set(3)

    registered: dict[str, set[str]] = {}
    for family in metrics.registry.collect():
        for sample in family.samples:
            labels = {k for k in sample.labels if k != "le"}
            registered.setdefault(family.name, set()).update(labels)

    for spec in SPECS:
        name = spec.name.removesuffix("_total")
        assert name in registered, f"{spec.name} is declared and not registered"
        assert registered[name] == set(spec.labels)


def test_an_id_in_a_path_never_becomes_a_label_value() -> None:
    """The guard that stops the accident at the call site rather than detecting
    it afterwards."""
    assert normalise_endpoint("GET", "/payments/pay_01H9ZQ") == "GET /payments/{id}"
    assert normalise_endpoint("POST", "/payments/pay_01H9ZQ/capture") == (
        "POST /payments/{id}/capture"
    )
    assert normalise_endpoint("GET", "/merchants/mer_44/settings") == "other"


# ------------------------------------------------------------ percentiles
def test_the_histogram_p99_matches_the_exact_p99_within_a_few_percent() -> None:
    """Test 4. And the default buckets do not, which is the point."""
    defaults, tuned = histogram_error()

    assert abs(tuned["error_pct"]) < 5
    assert abs(defaults["error_pct"]) > 40
    assert tuned["exact_ms"] == defaults["exact_ms"]     # same data, same truth


def test_averaging_instance_percentiles_hides_a_broken_instance() -> None:
    """Test 5. Ten instances, one three times slower."""
    p = percentile_averaging()

    assert p["mean_of_p99s"] < p["true_p99"]             # the average understates it
    assert p["max_of_p99s"] > p["true_p99"] * 2          # the max panel does not
    assert p["max_of_p99s"] == pytest.approx(p["sick_p99"])

    # And the shape of the mistake: the average sits close to a healthy
    # instance, so the dashboard looks normal while one instance in ten is
    # three times slower than the rest.
    assert abs(p["mean_of_p99s"] - p["healthy_p99"]) < p["sick_p99"] - p["true_p99"]


def test_summing_buckets_across_instances_is_the_same_as_pooling_the_requests() -> None:
    """Why the recording rule sums buckets: it is arithmetically the pooled
    distribution, not an approximation of it."""
    rng = np.random.default_rng(7)
    instances = [rng.normal(60, 10, 20_000) for _ in range(5)]
    edges = list(np.arange(10, 200, 5))

    summed = [sum(int((x <= edge).sum()) for x in instances) for edge in edges]
    pooled = np.concatenate(instances)
    direct = [int((pooled <= edge).sum()) for edge in edges]

    assert summed == direct


# --------------------------------------------------------------- tracing
def payment_trace() -> tuple[list, str]:
    """One payment across three services and a queue, as it really happens.

    The queue is the interesting part: the consumer runs later, in another
    process, with no headers left to read.
    """
    api = Tracer("payments-api")
    vault = Tracer("card-vault")
    worker = Tracer("capture-worker")

    with request_context() as rid:
        with api.span("POST /payments", endpoint="POST /payments") as root:
            headers: dict[str, str] = {}
            api.inject(headers)
            with vault.span("tokenise", parent=Tracer.extract(headers)):
                pass

            with api.span("authorize", attempt=1):
                pass

            message = api.carry_into_message({"payment_id": "pay_1"})
            envelope = Envelope.wrap(message, traceparent=message["traceparent"])
            root.attributes["queue"] = "payments.captured"

    # Minutes later, in another process.
    with worker.span("capture", parent=Tracer.continue_from_message(envelope.payload)):
        pass

    return api.collected + vault.collected + worker.collected, rid


def test_one_trace_covers_the_payment_including_after_the_queue() -> None:
    """Test 6. Four spans, three services, one trace id, no breaks."""
    spans, _ = payment_trace()

    assert len(spans) == 4
    assert unbroken(spans)
    assert {s.service for s in spans} == {"payments-api", "card-vault", "capture-worker"}

    worker = next(s for s in spans if s.service == "capture-worker")
    root = next(s for s in spans if s.parent_id is None)
    assert worker.trace_id == root.trace_id
    assert "payments-api" in render(spans)


def test_dropping_the_context_from_the_message_breaks_the_trace() -> None:
    """The failure this design prevents, asserted rather than described.

    A broken trace still renders. The viewer shows two traces, both look
    plausible, and the half of the payment that happened after the queue is
    missing from the one anybody opens.
    """
    api = Tracer("payments-api")
    worker = Tracer("capture-worker")

    with api.span("POST /payments"):
        message = {"payment_id": "pay_1"}         # no traceparent carried
    with worker.span("capture", parent=Tracer.continue_from_message(message)):
        pass

    spans = api.collected + worker.collected
    assert not unbroken(spans)
    assert len({s.trace_id for s in spans}) == 2


def test_a_malformed_traceparent_starts_a_new_trace_rather_than_crashing() -> None:
    for bad in (None, "", "garbage", "00-" + "0" * 32 + "-" + "0" * 16 + "-01"):
        assert Tracer.extract({"traceparent": bad} if bad is not None else {}) is None


# -------------------------------------------------------------- sampling
def make_traces(count: int, failures: int, slow: int) -> list[list]:
    traces = []
    for i in range(count):
        tracer = Tracer("payments-api")
        with tracer.span("POST /payments") as span:
            span.started -= 0.400 if i < slow else 0.050       # force the duration
            if slow <= i < slow + failures:
                span.fail("upstream_timeout")
        traces.append(tracer.collected)
    return traces


def test_tail_sampling_keeps_everything_that_failed_or_was_slow() -> None:
    """Test 7. Head sampling at 1% keeps 1% of the failures, which is the same
    as not having traces during an incident."""
    sampler = TailSampler(slow_ms=250.0, keep_one_in=100)
    traces = make_traces(count=1_000, failures=20, slow=30)

    retention = measure(sampler, traces)

    assert retention.failed_total == 20
    assert retention.failed_kept == 20
    assert retention.slow_total == 30
    assert retention.slow_kept == 30
    assert retention.kept_share < 0.10          # and almost nothing else


def test_the_sampling_decision_is_the_same_on_every_instance() -> None:
    """Deterministic on the trace id, so two services cannot each keep their own
    half and deliver a trace with a hole in the middle."""
    sampler = TailSampler()
    trace = make_traces(count=1, failures=0, slow=0)[0]
    assert len({sampler.keep(trace)[0] for _ in range(20)}) == 1


# ------------------------------------------------------------- the alerts
@pytest.fixture(scope="module")
def rules() -> dict:
    return yaml.safe_load((HERE / "slo" / "burn_rate.yml").read_text(encoding="utf-8"))


def test_every_alert_has_a_runbook_that_exists(rules) -> None:
    """Test 8. An alert with no runbook is a question mark delivered at three in
    the morning."""
    alerts = [r for group in rules["groups"] for r in group["rules"] if "alert" in r]
    assert len(alerts) >= 5

    for alert in alerts:
        runbook = alert["annotations"].get("runbook")
        assert runbook, f"{alert['alert']} has no runbook"
        path = HERE / runbook
        assert path.exists(), f"{alert['alert']} points at {runbook}, which is missing"
        text = path.read_text(encoding="utf-8")
        assert alert["alert"] in text                   # the right runbook
        assert "Last reviewed" in text                  # and a date on it


def test_every_alert_names_the_objective_it_belongs_to(rules) -> None:
    """An alert that maps to no objective is deleted, and deleting it is the
    cheapest reliability work there is."""
    objectives = {
        "payments-availability", "payments-latency",
        "payouts-freshness", "payouts-correctness", "reconciliation",
    }
    for group in rules["groups"]:
        for rule in group["rules"]:
            if "alert" in rule:
                assert rule["labels"]["slo"] in objectives


def test_every_dashboard_link_resolves_and_uses_rules_that_exist(rules) -> None:
    """A dangling dashboard link is the same failure as a missing runbook, and it
    is discovered at the same unhelpful hour.

    The second half of this test is the one that earns its place: it fails when
    somebody renames a recording rule and leaves the panel querying a series that
    no longer exists. A Grafana panel with no data looks exactly like a system
    with no traffic.
    """
    recorded = {
        rule["record"]
        for group in rules["groups"]
        for rule in group["rules"]
        if "record" in rule
    }
    alerts = [r for group in rules["groups"] for r in group["rules"] if "alert" in r]

    for alert in alerts:
        link = alert["annotations"].get("dashboard")
        assert link, f"{alert['alert']} has no dashboard"
        path = HERE / link
        assert path.exists(), f"{alert['alert']} points at {link}, which is missing"

        dashboard = json.loads(path.read_text(encoding="utf-8"))
        assert dashboard["panels"], f"{link} has no panels"

        for panel in dashboard["panels"]:
            expression = panel["targets"][0]["expr"]
            assert expression
            # A panel querying a recording rule must query one that is recorded.
            for candidate in recorded:
                if candidate.split(":")[0] in expression and ":" in expression:
                    assert any(r in expression for r in recorded), (
                        f"{link} panel {panel['title']!r} queries a recording rule "
                        "that burn_rate.yml does not define"
                    )
                    break


@pytest.fixture(scope="module")
def replayed() -> dict:
    return replay_module.replay()


def test_the_replay_catches_both_incidents_with_no_false_pages(replayed) -> None:
    """Test 9. The same month, two rules, and a table instead of an argument."""
    burn = replayed["rules"]["multiwindow burn rate"]
    threshold = replayed["rules"]["threshold, 1% for 5 minutes"]

    assert burn["caught"] == 2
    assert burn["false_pages"] == 0
    assert burn["pages"] == 2

    assert threshold["caught"] == 2
    assert threshold["false_pages"] == 2          # the two blips, recovered already

    # Severity scaling nobody configured: the worse incident is found sooner.
    detection = burn["detection_minutes"]
    assert detection["day 19 at 35%"] == 2
    assert detection["day 5 at 8%"] == 10


def test_the_burn_rule_stops_firing_after_the_incident_ends(replayed) -> None:
    """Test 10, and the measurement that justifies the short windows.

    With them, the alert goes quiet within the slow rule's own 30 minute
    confirming window. Without them it keeps firing for over five hours, which
    is how an alert ends up silenced before the next incident.
    """
    with_windows = replayed["rules"]["multiwindow burn rate"]["stops_firing_after"]
    without = replayed["rules"]["multiwindow, no short window"]["stops_firing_after"]
    fast_only = replayed["rules"]["fast burn alone, 14.4x over 1h"]["stops_firing_after"]

    assert all(lag is not None and lag <= 30 for lag in with_windows.values())
    assert all(lag is not None and lag <= 5 for lag in fast_only.values())
    assert all(lag is not None and lag > 300 for lag in without.values())


def test_the_quiet_background_rate_spends_most_of_the_budget(replayed) -> None:
    """The uncomfortable number, asserted so it cannot quietly stop being true."""
    from_incidents = sum(replayed["incident_share"].values())
    assert 0.40 < from_incidents < 0.45
    assert replayed["budget_spent"] > 0.80      # and the month still met 99.9%
    assert replayed["availability"] > 0.999


# ------------------------------------------------------------- the budget
def test_the_error_budget_matches_the_published_minutes() -> None:
    """Test 11. Four numbers anybody can check, including the float trap in the
    third one."""
    published = {
        "99%": "7 hours 12 minutes",
        "99.9%": "43 minutes 12 seconds",
        "99.95%": "21 minutes 36 seconds",
        "99.99%": "4 minutes 19 seconds",
    }
    for objective in LADDER:
        assert objective.budget == published[objective.name]


def test_a_burn_rate_is_the_error_rate_over_the_allowed_rate() -> None:
    assert burn_rate(0.0144, 0.999) == pytest.approx(14.4)
    assert burn_rate(0.006, 0.999) == pytest.approx(6.0)
    assert burn_rate(0.001, 0.999) == pytest.approx(1.0)     # exactly on budget


def test_human_readable_durations_round_rather_than_truncate() -> None:
    assert human(2_592) == "43 minutes 12 seconds"
    assert human(1_295.9999) == "21 minutes 36 seconds"
    assert human(0) == "0 seconds"
