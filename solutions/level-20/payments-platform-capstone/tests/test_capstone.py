"""The level's ten tests, run against the platform.

Eight of them run here in seconds. The two that cannot are named with what stands
in for them:

    the hour long load test      `python -m bench.load --minutes 60`, run once and
                                 reported in the README. The test below runs the
                                 same code for two seconds
    one command on a fresh clone `python seed.py` is that command, and the test
                                 calls exactly what it calls. What is untested is
                                 the container build, and docker/compose.yml says
                                 it has never been run

Nothing here needs a service, a container or a network, which is the whole reason
the capstone is assembled the way it is.
"""

from __future__ import annotations

import time

import pytest

from bench.load import OBJECTIVE_MS, run
from chaos.scenarios import (
    database_loss,
    revoked_credential,
    slow_then_failing_bank,
    stopped_publisher,
)
from migrate.under_load import migrate
from platform_.ledger import Unbalanced
from platform_.platform import TEST_PAN, Platform
from recon.daily import reconcile


@pytest.fixture
def platform() -> Platform:
    made = Platform()
    made.bank.latency_seconds = 0.0
    return made


# ------------------------------------------------------------ 1. it runs
def test_the_smoke_test_passes(platform: Platform) -> None:
    """Test 1 and test 2: one command, and a payment through every service."""
    outcome = platform.smoke_test()

    assert outcome["payout_state"] == "paid"
    assert outcome["ledger_total"] == 0
    assert outcome["ledger_transactions"] == 2        # the capture and the payout
    assert outcome["events_delivered"] == 1
    assert outcome["bank_payments"] == 1
    assert outcome["token"].startswith("tok_")


def test_the_card_number_never_leaves_the_vault(platform: Platform) -> None:
    response = platform.payment(1999)
    payment = platform.api.payments[response["id"]]

    assert TEST_PAN not in str(response)
    assert TEST_PAN not in str(payment)
    # And the one function that can produce it needs the scope.
    from platform_.vault import NotAuthorised

    with pytest.raises(NotAuthorised):
        platform.vault.detokenise(payment.token, platform.api.credential, set())
    assert platform.vault.detokenise(
        payment.token, platform.api.credential, {"vault:read_pan"}
    ) == TEST_PAN


def test_the_ledger_refuses_an_unbalanced_transaction(platform: Platform) -> None:
    """The invariant every other number depends on."""
    with pytest.raises(Unbalanced):
        platform.ledger.post("wrong", {"a": 100, "b": -90})
    assert platform.ledger.entries == []       # and nothing was written


# --------------------------------------------------------- 3. it holds
def test_the_load_test_produces_percentiles_and_goodput(platform: Platform) -> None:
    """Test 3, at two seconds rather than an hour. The hour is in the README."""
    result = run(platform, rps=200, seconds=2.0, warmup=0.5)
    report = result.as_dict()

    assert report["offered"] > 300
    assert report["accepted"] == report["offered"]
    assert report["p50_ms"] <= report["p99_ms"] <= report["max_ms"]
    assert report["goodput_per_second"] > 0
    assert report["p99_ms"] < OBJECTIVE_MS
    assert reconcile(platform).clean


def test_goodput_counts_only_responses_inside_the_objective() -> None:
    """The definition, asserted, because a benchmark that reports throughput as
    goodput is the most common way one flatters itself."""
    from bench.load import Result

    result = Result(accepted=100, slower_than_objective=40, seconds=1.0)
    assert result.throughput_per_second == 100
    assert result.goodput_per_second == 60


# ------------------------------------------------------- 4. it survives
@pytest.mark.parametrize(
    "scenario",
    [database_loss, slow_then_failing_bank, stopped_publisher, revoked_credential],
)
def test_every_chaos_scenario_ends_with_a_clean_reconciliation(scenario) -> None:
    """Tests 4 to 7 and 9: four failures, and zero breaks after each."""
    outcome = scenario()

    assert outcome.breaks == [], f"{outcome.name}: {outcome.breaks}"
    assert outcome.money_lost is False
    assert outcome.money_duplicated is False
    assert outcome.detected_after is not None, f"{outcome.name} was never detected"
    assert outcome.detected_after < 5.0
    assert outcome.after["ledger_total_minor"] == 0


def test_the_database_outage_refuses_everything_and_writes_nothing() -> None:
    """Test 4 in detail: the failure has to be clean, not survivable."""
    outcome = database_loss()

    during = outcome.during_failure
    assert during["accepted"] == 0
    assert during["refused"] == during["offered"]
    assert during["payments_recorded_during_outage"] == 0


def test_a_timing_out_bank_leaves_payouts_unknown_and_the_sweeper_resolves_them() -> None:
    """Test 5. Unknown is a state; the sweeper is what makes it final."""
    outcome = slow_then_failing_bank()

    assert outcome.during_failure["payouts_unknown_at_worst"] > 0
    assert outcome.during_failure["still_unknown"] == 0
    assert outcome.after["payouts_unknown"] == 0


def test_a_stopped_publisher_loses_nothing_and_catches_up() -> None:
    """Test 6. Lag rather than loss, which is the whole point of the outbox."""
    outcome = stopped_publisher()

    assert outcome.during_failure["backlog_at_worst"] > 100
    assert outcome.during_failure["events_lost"] == 0
    assert outcome.after["outbox_backlog"] == 0


def test_a_revoked_credential_fails_clearly_rather_than_silently() -> None:
    """Test 7. A named error and a firing alert, not a stream of 500s."""
    outcome = revoked_credential()

    assert outcome.during_failure["status_returned"] == 503
    assert "credential" in outcome.during_failure["error"]
    assert outcome.detected_by == "VaultRefusingCredential"


def test_the_payout_worker_will_not_call_the_bank_it_cannot_record(
    platform: Platform,
) -> None:
    """The money bug the chaos runner found, as its own test.

    The first version called the bank and then posted to the ledger, so a database
    outage at the wrong moment paid a merchant with no record of it. One payout in
    four hundred, and the reconciliation found it the next morning.
    """
    platform.payment(1999)
    platform.publisher.drain_fully()
    platform._enqueue_new_payouts()

    platform.ledger.stop()
    handled = platform.worker.run_once()
    assert handled == 0
    assert platform.bank.calls == 0, "the bank was called with the ledger down"

    platform.ledger.start()
    platform.worker.run_once()
    assert platform.bank.calls == 1
    assert reconcile(platform).clean


# --------------------------------------------------------- 8. it migrates
def test_a_migration_under_load_fails_no_requests() -> None:
    """Test 8, and the rollback proof at step 4."""
    outcome = migrate(seconds_per_step=0.3)

    assert outcome["failed"] == 0, outcome["failures"]
    assert outcome["requests"] > 100
    assert outcome["disagreements_at_step_4"] == 0
    assert outcome["reconciliation_breaks"] == []


# ------------------------------------------------- 10. the numbers are real
def test_the_reconciliation_finds_a_break_when_there_is_one(platform: Platform) -> None:
    """A reconciliation that cannot fail is not a reconciliation.

    The capstone's headline claim is "zero breaks", so the check that the checker
    works is the one that makes the claim mean anything.
    """
    platform.payment(1999)
    platform.settle()
    assert reconcile(platform).clean

    # Money at the bank that the platform has no record of, which is the break
    # that costs the most to explain.
    platform.bank.paid["po_pay_99999999"] = 5_000
    result = reconcile(platform)

    assert not result.clean
    assert any("paid_at_bank_not_here" in str(b) for b in result.breaks)


def test_the_reconciliation_is_linear_rather_than_quadratic() -> None:
    """The bug the capstone's own load test found.

    `ledger.by_reference()` per payment is a scan per payment: 1,304.8 ms at
    2,000 payments, 5,148.8 ms at 4,000 and 24,061.8 ms at 8,000. Indexed once it
    is 6.5, 12.1 and 26.1 ms, measured by `python -m recon.measure`. This test
    asserts the shape rather than the milliseconds, because a wall clock
    assertion on a shared machine is a flaky test.
    """
    timings = []
    for count in (500, 1_000, 2_000):
        platform = Platform()
        platform.bank.latency_seconds = 0.0
        for _ in range(count):
            platform.payment(1999)
        platform.settle()
        platform.settle()

        started = time.perf_counter()
        assert reconcile(platform).clean
        timings.append((count, time.perf_counter() - started))

    # Four times the payments should be under eight times the work. Quadratic
    # would be sixteen, and the pre fix version measured a ratio of 32.
    ratio = timings[-1][1] / timings[0][1]
    assert ratio < 8, f"reconciliation scaled by {ratio:.1f}x for 4x the payments"
