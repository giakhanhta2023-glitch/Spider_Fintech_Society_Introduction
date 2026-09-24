"""The twelve tests the level asks for."""

from __future__ import annotations

import random
from datetime import timedelta

import pytest

from saga.bank import Bank, BankRejected, BankTimeout
from saga.chaos import run as chaos_run
from saga.orchestrator import naive, saga
from saga.store import Store
from saga.stuck import STUCK_AFTER_SECONDS, alert_text, stuck
from saga.sweeper import sweep
from saga.__main__ import one_mode


def always(reject: float = 0.0, timeout: float = 0.0, seed: int = 1) -> Bank:
    rng = random.Random(seed)
    return Bank(rng, reject_rate=reject, timeout_rate=timeout)


# --------------------------------------------------------------- the problem
def test_the_naive_orchestrator_leaves_payouts_debited_and_unpaid() -> None:
    result = one_mode("naive")
    assert result["inconsistent_before"] == 26
    assert result["inconsistent_before"] / 200 == pytest.approx(0.13)


def test_the_saga_more_than_halves_it_but_does_not_fix_it() -> None:
    result = one_mode("saga")
    assert result["inconsistent_before"] == 17
    assert result["inconsistent_before"] < 26


def test_the_sweeper_takes_the_saga_to_zero_and_the_naive_one_to_nine() -> None:
    """The comparison that is the whole level. Neither mechanism is enough on
    its own, and the nine is the proof."""
    assert one_mode("saga")["inconsistent_after"] == 0
    assert one_mode("naive")["inconsistent_after"] == 9


# --------------------------------------------------------- compensation
def test_a_rejected_payout_returns_the_money_exactly_once() -> None:
    store = Store()
    bank = always(reject=1.0)
    orchestrator = saga(store, bank, random.Random(1), crash_after_submit=0.0)

    payout = orchestrator.run("M1", 10_000, "r-1")

    assert payout.state == "compensated"
    assert payout.debited is False
    assert store.balance("M1") == 0

    # Three more times. The unique key means nothing happens.
    for _ in range(3):
        assert store.compensate(payout) is False
    assert store.balance("M1") == 0


def test_a_timeout_lands_in_unknown_with_nothing_attempted() -> None:
    store = Store()
    bank = always(timeout=1.0)
    orchestrator = saga(store, bank, random.Random(1), crash_after_submit=0.0)

    payout = orchestrator.run("M1", 10_000, "t-1")

    assert payout.state == "unknown"
    assert payout.debited is True          # not compensated: it might have gone
    assert payout.attempts == 1            # not retried: it might pay twice
    assert store.balance("M1") == -10_000


# ---------------------------------------------------------------- sweeper
def test_the_sweeper_marks_as_paid_what_the_bank_actually_sent() -> None:
    store = Store()
    bank = always(timeout=1.0)   # times out, but records the payout first
    orchestrator = saga(store, bank, random.Random(1), crash_after_submit=0.0)
    payout = orchestrator.run("M1", 10_000, "t-1")
    assert payout.state == "unknown"

    result = sweep(store, bank)

    assert result.was_actually_paid == 1
    assert payout.state == "paid"
    assert payout.bank_ref is not None


def test_the_sweeper_compensates_what_the_bank_never_received() -> None:
    store = Store()
    bank = always(timeout=1.0)
    orchestrator = saga(store, bank, random.Random(1), crash_after_submit=0.0)
    payout = orchestrator.run("M1", 10_000, "t-1")

    bank.submitted.clear()   # the request never reached them

    result = sweep(store, bank)

    assert result.never_reached_the_bank == 1
    assert payout.state == "compensated"
    assert store.balance("M1") == 0


def test_two_sweepers_never_process_the_same_payout() -> None:
    store = Store()
    bank = always(timeout=1.0)
    orchestrator = saga(store, bank, random.Random(1), crash_after_submit=0.0)
    for i in range(10):
        orchestrator.run("M1", 1_000, f"t-{i}")

    first = store.claim("sweeper-1", limit=10)
    second = store.claim("sweeper-2", limit=10)

    assert len(first) == 10
    assert second == []
    assert {p.id for p in first} & {p.id for p in second} == set()


def test_the_sweeper_is_safe_to_run_repeatedly() -> None:
    store = Store()
    bank = always(timeout=1.0)
    orchestrator = saga(store, bank, random.Random(1), crash_after_submit=0.0)
    orchestrator.run("M1", 10_000, "t-1")

    first = sweep(store, bank)
    second = sweep(store, bank)

    assert first.was_actually_paid == 1
    assert second.examined == 0
    assert store.inconsistent() == []


# ------------------------------------------------------------------ crashes
def test_a_crash_after_submitting_leaves_a_state_the_sweeper_can_act_on() -> None:
    store = Store()
    bank = always()
    orchestrator = saga(store, bank, random.Random(1), crash_after_submit=1.0)

    payout = orchestrator.run("M1", 10_000, "c-1")

    assert payout.state == "debited"       # not final, so the sweeper sees it
    assert payout.is_final is False
    assert bank.lookup("c-1") is not None  # it really did go out

    sweep(store, bank)
    assert payout.state == "paid"


# --------------------------------------------------------------- stuck
def test_the_stuck_query_returns_nothing_while_the_sweeper_runs() -> None:
    store = Store()
    bank = always(timeout=1.0)
    orchestrator = saga(store, bank, random.Random(1), crash_after_submit=0.0)
    orchestrator.run("M1", 10_000, "t-1")

    sweep(store, bank)

    store.now = store.now + timedelta(seconds=STUCK_AFTER_SECONDS * 2)
    assert stuck(store) == []
    assert alert_text(stuck(store)) is None


def test_the_stuck_query_finds_payouts_when_the_sweeper_is_paused() -> None:
    store = Store()
    bank = always(timeout=1.0)
    orchestrator = saga(store, bank, random.Random(1), crash_after_submit=0.0)
    for i in range(3):
        orchestrator.run("M1", 1_000, f"t-{i}")

    # Nobody swept. Time passes.
    store.now = store.now + timedelta(seconds=STUCK_AFTER_SECONDS * 2)

    rows = stuck(store)
    assert len(rows) == 1
    assert rows[0].state == "unknown"
    assert rows[0].count == 3
    assert "unfinished for over 15 minutes" in (alert_text(rows) or "")


def test_nothing_is_stuck_before_the_threshold() -> None:
    store = Store()
    bank = always(timeout=1.0)
    orchestrator = saga(store, bank, random.Random(1), crash_after_submit=0.0)
    orchestrator.run("M1", 1_000, "t-1")

    store.now = store.now + timedelta(seconds=60)   # one minute
    assert stuck(store) == []


# ------------------------------------------------------------------ chaos
def test_a_thousand_payouts_with_crashes_end_final_and_balanced() -> None:
    result = chaos_run(runs=1_000)

    assert result.all_final
    assert result.balance_matches
    assert result.no_reference_paid_twice
    assert result.inconsistent == 0
    assert result.passed


def test_no_reference_is_ever_used_for_two_payouts() -> None:
    result = chaos_run(runs=1_000)
    # One reference per payout, and the bank recorded at most one payment per
    # reference, so no payout was paid twice however many times it was tried.
    assert result.distinct_references <= result.runs
    assert result.submissions >= result.distinct_references


def test_the_bank_is_idempotent_on_our_reference() -> None:
    bank = always()
    first = bank.submit("REF1", 5_000)
    second = bank.submit("REF1", 5_000)

    assert first == second
    assert bank.submissions == 2
    assert len(bank.submitted) == 1
