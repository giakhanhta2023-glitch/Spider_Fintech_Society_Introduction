"""The thirteen tests the level asks for, against the shipped files.

The shipped data has breaks planted in it, so these tests are not "does the
code run": they are "does it find exactly what was planted, and nothing else".
A reconciliation that finds extra breaks is as broken as one that misses them,
because every false break costs somebody an hour.
"""

from __future__ import annotations

from datetime import date, timedelta
from pathlib import Path

import pytest

from recon.checks import check_fees, check_payouts, effective_rates
from recon.classify import Break, classify
from recon.config import DEFAULT, Config
from recon.load import Movement, load_ledger, load_settlement
from recon.match import reconcile
from recon.queue import ExceptionQueue

DATA = Path(__file__).resolve().parents[3].parent / "data"
LEDGER = DATA / "level-09-card-events.csv"
SETTLEMENT = DATA / "level-10-settlement.csv"
PAYOUTS = DATA / "level-10-payouts.csv"

pytestmark = pytest.mark.skipif(
    not SETTLEMENT.exists(), reason=f"shipped data not found at {DATA}"
)


@pytest.fixture(scope="module")
def sides() -> tuple[list[Movement], list[Movement]]:
    return load_ledger(LEDGER), load_settlement(SETTLEMENT)


@pytest.fixture(scope="module")
def outcome(sides):
    ledger, settlement = sides
    as_of = max(m.when for m in settlement)
    result = reconcile(ledger, settlement)
    return result, classify(result, as_of, DEFAULT), as_of


def of_type(breaks: list[Break], name: str) -> list[Break]:
    return [b for b in breaks if b.type == name]


def value(breaks: list[Break]) -> int:
    return sum(abs(b.value_minor) for b in breaks)


# ------------------------------------------------------------------ loading
def test_refunds_are_negative_on_both_sides(sides) -> None:
    ledger, settlement = sides
    assert all(m.amount_minor < 0 for m in ledger if m.kind == "refund")
    assert all(m.amount_minor < 0 for m in settlement if m.kind == "refund")
    assert all(m.amount_minor < 0 for m in ledger if m.kind == "chargeback")
    assert all(m.amount_minor < 0 for m in settlement if m.kind == "chargeback")


def test_authorisations_are_not_loaded(sides) -> None:
    """A hold settles nothing. Including them would report thousands of
    missing settlements that were never coming."""
    ledger, _ = sides
    assert {m.kind for m in ledger} == {"capture", "refund", "chargeback"}


# ----------------------------------------------------------- the five results
def test_exactly_16408_match(outcome) -> None:
    result, _, _ = outcome
    assert result.by_pass()["exact"] == 16_408


def test_193_amount_mismatches_worth_1180_96_with_currency_separated(outcome) -> None:
    _, breaks, _ = outcome
    plain = of_type(breaks, "amount_mismatch")
    currency = of_type(breaks, "currency_rounding")

    assert len(plain) + len(currency) == 193
    assert value(plain) + value(currency) == 118_096       # $1,180.96

    # The separation is the point: 30 differences worth $14.19 that somebody
    # should look at, and 163 worth $1,166.77 that are conversion rounding.
    assert len(plain) == 30
    assert value(plain) == 1_419
    assert len(currency) == 163
    assert value(currency) == 116_677


def test_exactly_one_duplicated_settlement_line(outcome) -> None:
    _, breaks, _ = outcome
    duplicates = of_type(breaks, "duplicate_settlement")
    assert len(duplicates) == 1
    assert duplicates[0].key == "P008131"


def test_37_movements_with_no_ledger_record_worth_3116_61(outcome) -> None:
    _, breaks, _ = outcome
    missing = of_type(breaks, "missing_in_ledger")
    assert len(missing) == 37
    assert value(missing) == 311_661


def test_12_captures_that_never_settled_worth_1690_07(outcome) -> None:
    _, breaks, _ = outcome
    unsettled = of_type(breaks, "unsettled_capture")
    assert len(unsettled) == 12
    assert value(unsettled) == 169_007


# ------------------------------------------------------- pending is not a break
def test_a_capture_two_days_old_is_pending_not_a_break() -> None:
    as_of = date(2026, 7, 10)
    ledger = [Movement("P1", "capture", 5_000, as_of - timedelta(days=2), "ledger")]
    result = reconcile(ledger, [])
    breaks = classify(result, as_of, DEFAULT)

    assert len(breaks) == 1
    assert breaks[0].type == "pending_settlement"
    assert breaks[0].is_break is False


def test_the_same_capture_five_days_old_is_a_break() -> None:
    as_of = date(2026, 7, 10)
    ledger = [Movement("P1", "capture", 5_000, as_of - timedelta(days=5), "ledger")]
    breaks = classify(reconcile(ledger, []), as_of, DEFAULT)

    assert breaks[0].type == "unsettled_capture"
    assert breaks[0].is_break is True


def test_the_window_is_configuration_not_a_constant() -> None:
    as_of = date(2026, 7, 10)
    ledger = [Movement("P1", "capture", 5_000, as_of - timedelta(days=5), "ledger")]
    patient = Config(settlement_window_days=10)

    assert classify(reconcile(ledger, []), as_of, patient)[0].type == "pending_settlement"


# ---------------------------------------------------------------- the money
def test_every_payout_equals_the_lines_that_settled_that_day(sides) -> None:
    _, settlement = sides
    checks = check_payouts(PAYOUTS, settlement)
    assert len(checks) == 59
    assert all(c.agrees for c in checks)


def test_the_duplicate_was_included_in_the_payout(sides) -> None:
    """The finding this level is really about.

    Both checks pass on their own. Every payout equals the sum of its day's
    lines, and that is exactly the problem: the duplicated line is one of them,
    so the payout is correct against a file that is wrong, and $100.80 went out
    twice. Only the two checks together say so.
    """
    _, settlement = sides
    day = date(2026, 5, 5)
    lines = [m for m in settlement if m.when == day]
    duplicate = [m for m in lines if m.line_id == "S016638"]
    assert duplicate, "the planted duplicate is not where it was"

    with_duplicate = sum(m.amount_minor - m.fee_minor for m in lines)
    without = with_duplicate - (duplicate[0].amount_minor - duplicate[0].fee_minor)

    stated = next(c for c in check_payouts(PAYOUTS, settlement) if c.paid_at == day)
    assert stated.stated_net_minor == with_duplicate
    assert stated.stated_net_minor != without


def test_the_fee_check_recomputes_and_finds_the_lines_that_differ(sides) -> None:
    _, settlement = sides
    differences = check_fees(settlement, DEFAULT)
    assert differences
    for d in differences:
        assert d.charged_minor != d.expected_minor
        assert d.expected_minor == DEFAULT.fees.expected(d.gross_minor)


def test_the_effective_rate_table_reproduces_the_headline_rates(sides) -> None:
    _, settlement = sides
    bands = {b.label: b for b in effective_rates(settlement)}

    assert round(bands["under $10"].effective_rate * 100, 2) == 7.03
    assert round(bands["over $200"].effective_rate * 100, 2) == 2.99


# ------------------------------------------------------------- the queue
def test_running_the_job_twice_changes_nothing(outcome, tmp_path) -> None:
    _, breaks, as_of = outcome
    path = tmp_path / "exceptions.json"

    first = ExceptionQueue(path).load()
    counts_one = first.apply(breaks, as_of)
    first.save()

    second = ExceptionQueue(path).load()
    counts_two = second.apply(breaks, as_of)
    second.save()

    assert counts_one["new"] > 0
    assert counts_two["new"] == 0
    assert counts_two["reopened"] == 0
    assert counts_two["auto_resolved"] == 0
    assert {i.break_id for i in first.open_items()} == {
        i.break_id for i in second.open_items()
    }


def test_a_break_that_goes_away_is_resolved_rather_than_left_open(tmp_path) -> None:
    as_of = date(2026, 7, 10)
    ledger = [Movement("P1", "capture", 5_000, as_of - timedelta(days=9), "ledger")]
    breaks = classify(reconcile(ledger, []), as_of, DEFAULT)

    queue = ExceptionQueue(tmp_path / "q.json")
    queue.apply(breaks, as_of)
    assert len(queue.open_items()) == 1

    counts = queue.apply([], as_of + timedelta(days=1))
    assert counts["auto_resolved"] == 1
    assert queue.open_items() == []


def test_break_ids_are_stable_across_runs(outcome) -> None:
    result, breaks, as_of = outcome
    again = classify(result, as_of, DEFAULT)
    assert [b.break_id for b in breaks] == [b.break_id for b in again]


def test_every_break_has_a_type_a_value_and_an_owner(outcome) -> None:
    _, breaks, _ = outcome
    for b in breaks:
        assert b.type
        assert b.owner
        assert b.break_id
        if b.is_break:
            assert b.value_minor != 0, f"{b.type} {b.key} has no value attached"


def test_nothing_is_silently_dropped(outcome, sides) -> None:
    """Every settlement line and every ledger movement is either matched or
    accounted for by a break. This is the test that catches a classifier that
    quietly ignores a case."""
    result, breaks, _ = outcome
    ledger, settlement = sides

    accounted_settlement = (
        len(result.matches) + len(result.duplicates) + len(result.unmatched_settlement)
    )
    assert accounted_settlement == len(settlement)

    accounted_ledger = len(result.matches) + len(result.unmatched_ledger)
    assert accounted_ledger == len(ledger)
