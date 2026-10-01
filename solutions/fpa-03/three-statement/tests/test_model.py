"""The tests a model reviewer would run before believing a single number.

    pytest -q

Most of these assert an identity rather than a value, which is the difference
between testing a model and testing a forecast. The forecast is an opinion and
it will change next month. The identities, that the balance sheet balances, that
retained earnings move by exactly net income, that cash is the closing line of
the cash flow, are true of every company that has ever existed, and if one of
them breaks then the model is wrong regardless of whose opinion went into it.
"""

from __future__ import annotations

import dataclasses

import pytest

from model.drivers import Driver, base, opening_from_history, scenarios
from model.forecast import MAX_PASSES, run


@pytest.fixture(scope="module")
def opening():
    return opening_from_history()


@pytest.fixture(scope="module")
def all_cases():
    return {s.name: run(s) for s in scenarios()}


# ------------------------------------------------------------- the identities
def test_the_opening_balance_sheet_balances(opening):
    assert opening.balances
    assert opening.month == "2025-09"


def test_every_month_of_every_scenario_balances(all_cases):
    for name, forecast in all_cases.items():
        worst = max(forecast.months, key=lambda m: abs(m.out_by))
        assert forecast.balances, f"{name} is out by {worst.out_by} in {worst.month}"


def test_retained_earnings_move_by_net_income_and_nothing_else(all_cases, opening):
    for forecast in all_cases.values():
        previous = opening.retained
        for month in forecast.months:
            assert month.retained == pytest.approx(previous + month.net_income, abs=0.005)
            previous = month.retained


def test_fixed_assets_move_by_capex_less_depreciation(all_cases, opening):
    for forecast in all_cases.values():
        previous = opening.ppe
        for month in forecast.months:
            assert month.ppe == pytest.approx(previous + month.capex - month.depreciation,
                                              abs=0.005)
            previous = month.ppe


def test_cash_is_the_closing_line_of_the_cash_flow(all_cases, opening):
    """Cash is an output. This is the test that proves it was not typed in."""
    for forecast in all_cases.values():
        previous = opening.cash
        for month in forecast.months:
            expected = (previous + month.cash_from_operations - month.capex + month.financing)
            assert month.cash == pytest.approx(expected, abs=0.005), month.month
            previous = month.cash


def test_the_debt_schedule_amortises_and_never_goes_negative(all_cases):
    for forecast in all_cases.values():
        balances = forecast.line("debt")
        assert all(b >= 0 for b in balances)
        assert balances == sorted(balances, reverse=True)


# --------------------------------------------------------------- the circle
def test_only_the_stress_case_needs_the_facility(all_cases):
    assert all_cases["base"].peak_revolver == 0
    assert all_cases["upside"].peak_revolver == 0
    assert all_cases["downside"].peak_revolver == 0
    assert all_cases["stress"].peak_revolver > 0


def test_the_circularity_converges_and_does_not_just_stop(all_cases):
    stress = all_cases["stress"]
    assert stress.worst_pass_count > 1, "a case that never iterates proves nothing"
    assert stress.worst_pass_count < MAX_PASSES, "this hit the iteration cap, which is a failure"


def test_the_revolver_only_draws_at_the_cash_floor(all_cases):
    floor = base().minimum_cash.value
    for month in all_cases["stress"].months:
        if month.revolver > 0:
            assert month.cash == pytest.approx(floor, abs=0.5)


def test_interest_rises_with_the_drawn_balance(all_cases):
    drawn = [m for m in all_cases["stress"].months if m.revolver > 0]
    assert [m.interest for m in drawn] == sorted(m.interest for m in drawn)


# ------------------------------------------------------- the drivers, as data
def test_every_driver_says_where_it_came_from():
    """A model whose inputs cannot be traced is a model nobody can review."""
    for field in dataclasses.fields(base()):
        value = getattr(base(), field.name)
        if isinstance(value, Driver):
            assert value.source.strip(), f"{field.name} has no source"


def test_the_judgement_calls_are_marked():
    marked = {f.name for f in dataclasses.fields(base())
              if isinstance(getattr(base(), f.name), Driver)
              and getattr(base(), f.name).judgement}
    assert {"take_rate", "minimum_cash", "revolver_rate"} <= marked


# ------------------------------------------------ the direction of the world
def test_slower_collection_costs_cash():
    """One driver moves, one direction, no surprises."""
    slower = base().scaled("slower", dso_days=1.5)
    assert run(slower).months[-1].cash < run(base()).months[-1].cash


def test_a_higher_take_rate_raises_ebitda_more_than_the_same_move_in_volume():
    """The finding the sensitivity table is built to show."""
    rate_up = base().scaled("rate", take_rate=1.10)
    volume_up = base().scaled("volume", volume_growth=1.10)
    year = lambda f: sum(m.ebitda for m in f.months if m.month.startswith("2026"))
    assert year(run(rate_up)) > year(run(volume_up))
