"""The thirteen tests the level asks for, and the illegal transitions.

All of this runs in memory, because all of it is about the state machine and
the money, not about the database. The card network is the simulator, which is
the only way to test a timeout on demand.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

from cards.analysis import summarise
from cards.declines import Kind, RetryPolicy, classify
from cards.ledger import Unbalanced
from cards.network import CardNetwork, NetworkTimeout
from cards.report import merchant_report
from cards.service import DISPUTE_FEE_MINOR, CardService
from cards.states import Event, IllegalTransition, State, next_state

DATA = Path(__file__).resolve().parents[3].parent / "data" / "level-09-card-events.csv"


def never_fails() -> CardNetwork:
    return CardNetwork(decline_rate=0.0, timeout_rate=0.0)


def always_times_out() -> CardNetwork:
    return CardNetwork(decline_rate=0.0, timeout_rate=1.0)


def always_declines(code_seed: int = 9) -> CardNetwork:
    return CardNetwork(decline_rate=1.0, timeout_rate=0.0, seed=code_seed)


def approved_payment(amount: int = 7140) -> tuple[CardService, str]:
    service = CardService(network=never_fails())
    service.authorize("P1", "M1", amount)
    return service, "P1"


# ------------------------------------------------------- the state machine
def test_capturing_an_expired_authorisation_raises() -> None:
    service, pid = approved_payment()
    service.payments[pid].authorized_at = datetime.now(UTC) - timedelta(days=8)
    service.expire_stale()
    assert service.payments[pid].state is State.EXPIRED
    with pytest.raises(IllegalTransition):
        service.capture(pid)


def test_capturing_twice_raises() -> None:
    service, pid = approved_payment()
    service.capture(pid)
    with pytest.raises(IllegalTransition):
        service.capture(pid)


def test_voiding_a_captured_payment_raises_and_cancel_refunds_instead() -> None:
    service, pid = approved_payment()
    service.capture(pid)
    with pytest.raises(IllegalTransition):
        service.void(pid)

    payment = service.cancel(pid)
    assert payment.state is State.REFUNDED
    assert payment.refunded_minor == 7140


def test_refunding_more_than_was_captured_raises() -> None:
    service, pid = approved_payment()
    service.capture(pid, 5000)
    with pytest.raises(ValueError):
        service.refund(pid, 6000)


def test_every_illegal_transition_in_the_table_is_refused() -> None:
    illegal = [
        (State.DECLINED, Event.CAPTURE),
        (State.VOIDED, Event.CAPTURE),
        (State.EXPIRED, Event.CAPTURE),
        (State.CAPTURED, Event.VOID),
        (State.CAPTURED, Event.AUTHORIZE),
        (State.REQUESTED, Event.CAPTURE),
        (State.UNKNOWN, Event.CAPTURE),
        (State.CHARGED_BACK, Event.REFUND),
    ]
    for state, event in illegal:
        with pytest.raises(IllegalTransition):
            next_state(state, event)


def test_a_refunded_payment_can_still_be_disputed() -> None:
    """It happens, so the table has to allow it."""
    assert next_state(State.REFUNDED, Event.CHARGEBACK) is State.CHARGED_BACK


# -------------------------------------------------------------- the money
def test_authorising_posts_no_ledger_entries() -> None:
    service, _ = approved_payment()
    assert service.ledger.entries == []


def test_capturing_posts_a_transaction_that_sums_to_zero() -> None:
    service, pid = approved_payment()
    service.capture(pid)
    assert service.ledger.transactions() == 1
    assert service.ledger.total() == 0


def test_a_partial_capture_reports_what_it_released() -> None:
    service, pid = approved_payment(7140)
    payment = service.capture(pid, 5000)
    assert payment.captured_minor == 5000
    assert payment.released_minor == 2140


def test_a_chargeback_reverses_the_money_and_charges_the_fee() -> None:
    service, pid = approved_payment(10_000)
    service.capture(pid)
    before = service.ledger.balance("dispute_expense")
    service.chargeback(pid)

    assert service.payments[pid].state is State.CHARGED_BACK
    assert service.ledger.balance("dispute_expense") == before + DISPUTE_FEE_MINOR
    assert service.ledger.total() == 0


def test_an_unbalanced_transaction_is_never_written() -> None:
    service, _ = approved_payment()
    with pytest.raises(Unbalanced):
        service.ledger.post("wrong", {"a": 100, "b": -90})
    assert service.ledger.entries == []


# ------------------------------------------------------------- the network
def test_the_network_returns_one_hold_for_two_calls_with_the_same_reference() -> None:
    """The property every real network has, and the reason the reference is
    generated once and stored before the first attempt."""
    network = never_fails()
    first = network.authorize("REF1", 5000)
    second = network.authorize("REF1", 5000)

    assert network.calls == 2          # we did ask twice
    assert len(network._seen) == 1     # and there is one hold
    assert first == second             # with the same answer both times


def test_retrying_a_settled_authorisation_does_not_reach_the_network() -> None:
    """Cheaper and safer than relying on the network to deduplicate: if we
    already know the answer, there is no reason to ask."""
    service = CardService(network=never_fails())
    service.authorize("P1", "M1", 5000)
    calls_after_first = service.network.calls
    reference = service.payments["P1"].reference

    again = service.authorize("P1", "M1", 5000)

    assert service.network.calls == calls_after_first
    assert again.state is State.AUTHORIZED
    assert again.reference == reference
    assert again.attempts == 1


def test_a_timeout_leaves_the_payment_unknown_with_the_reference_stored() -> None:
    service = CardService(network=always_times_out())
    payment = service.authorize("P1", "M1", 5000)
    assert payment.state is State.UNKNOWN
    assert payment.reference
    assert payment.authorized_minor == 0  # we do not assume it worked


def test_the_resolver_moves_every_unknown_to_a_final_state() -> None:
    service = CardService(network=always_times_out())
    for i in range(5):
        service.authorize(f"P{i}", "M1", 1000)
    assert all(p.state is State.UNKNOWN for p in service.payments.values())

    outcome = service.resolve_unknown()

    assert outcome["resolved"] == 5
    assert outcome["approved"] == 5  # the simulator recorded them before timing out
    assert not any(p.state is State.UNKNOWN for p in service.payments.values())


def test_the_resolver_declines_an_unknown_the_network_never_saw() -> None:
    service = CardService(network=always_times_out())
    service.authorize("P1", "M1", 1000)
    service.network._seen.clear()  # the request never reached them

    outcome = service.resolve_unknown()

    assert outcome["declined"] == 1
    assert service.payments["P1"].state is State.DECLINED
    assert service.payments["P1"].decline_code == "no_record_at_network"


# ------------------------------------------------------------- the declines
def test_a_hard_decline_is_never_retried() -> None:
    policy = RetryPolicy()
    assert classify("expired_card") is Kind.HARD
    assert policy.should_retry("expired_card", attempts_so_far=0) is False


def test_a_soft_decline_is_retried_at_most_the_configured_number_of_times() -> None:
    policy = RetryPolicy(max_attempts=3)
    assert classify("insufficient_funds") is Kind.SOFT
    assert policy.should_retry("insufficient_funds", 0) is True
    assert policy.should_retry("insufficient_funds", 2) is True
    assert policy.should_retry("insufficient_funds", 3) is False


def test_an_unrecognised_code_is_treated_as_hard() -> None:
    assert classify("something_new_from_the_network") is Kind.HARD


def test_the_delays_grow() -> None:
    policy = RetryPolicy()
    delays = [policy.delay_for(i) for i in range(3)]
    assert delays == sorted(delays)
    assert delays[-1] >= 24 * 60 * 60


# --------------------------------------------------------------- the expiry
def test_the_expiry_job_is_safe_to_run_twice() -> None:
    service, pid = approved_payment()
    service.payments[pid].authorized_at = datetime.now(UTC) - timedelta(days=8)

    first = service.expire_stale()
    second = service.expire_stale()

    assert first["expired"] == 1
    assert second["expired"] == 0


def test_expiry_leaves_fresh_authorisations_alone() -> None:
    service, pid = approved_payment()
    assert service.expire_stale()["expired"] == 0
    assert service.payments[pid].state is State.AUTHORIZED


# ---------------------------------------------------------- idempotency
def test_every_event_is_idempotent_not_only_authorisation() -> None:
    service, pid = approved_payment(10_000)

    service.capture(pid, 4000, event_key="cap-1")
    service.capture(pid, 4000, event_key="cap-1")   # the retry
    assert service.payments[pid].captured_minor == 4000
    assert service.ledger.transactions() == 1

    service.refund(pid, 1000, event_key="ref-1")
    service.refund(pid, 1000, event_key="ref-1")
    assert service.payments[pid].refunded_minor == 1000
    assert service.ledger.transactions() == 2


# ------------------------------------------------------------- the report
def test_the_money_report_adds_up() -> None:
    service = CardService(network=never_fails())
    for i in range(10):
        service.authorize(f"P{i}", "M1", 10_000)
        service.capture(f"P{i}")
    service.refund("P0", 2_000)
    service.chargeback("P1")

    report = merchant_report(service, "M1")

    assert report.adds_up()
    assert report.captured == 10
    assert report.charged_back == 1
    assert report.refunded == 1


def test_the_report_shows_authorised_but_never_captured() -> None:
    service = CardService(network=never_fails())
    service.authorize("P1", "M1", 5_000)
    service.void("P1")
    service.authorize("P2", "M1", 3_000)
    service.capture("P2")

    report = merchant_report(service, "M1")

    assert report.authorised_never_captured == 1
    assert report.authorised_never_captured_minor == 5_000


# ------------------------------------------------------------- the dataset
@pytest.mark.skipif(not DATA.exists(), reason=f"dataset not found at {DATA}")
def test_the_analysis_reproduces_the_shipped_week() -> None:
    s = summarise(DATA)
    assert s.authorisations == 20_000
    assert s.approved == 17_216
    assert s.captured == 15_842
    assert s.expired == 841
    assert s.charged_back == 79
    assert round(s.approval_rate * 100, 2) == 86.08
    assert round(s.capture_rate * 100, 2) == 92.02
    assert round(s.chargeback_rate * 100, 3) == 0.499
