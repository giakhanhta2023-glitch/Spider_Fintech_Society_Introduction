"""
Tests for finance.py. They import no UI and need no browser, which is the whole
reason the maths lives in its own module.

Run:  pytest -q
"""

import pytest

from finance import (affordability, compare_terms, invest_instead,
                     monthly_payment, overpayment_saving, schedule, summarise)


# --- known values ----------------------------------------------------------
def test_known_mortgage_payment():
    assert round(monthly_payment(250_000, 0.055, 30), 2) == 1419.47


def test_known_car_payment():
    assert round(monthly_payment(20_000, 0.07, 5), 2) == 396.02


def test_zero_rate_splits_evenly():
    assert round(monthly_payment(12_000, 0.0, 4), 2) == 250.00


# --- schedule behaviour ----------------------------------------------------
def test_schedule_length_and_final_balance():
    rows = schedule(20_000, 0.07, 5)
    assert len(rows) == 60
    assert rows[-1]["balance"] == 0.0


def test_interest_is_charged_on_the_current_balance():
    rows = schedule(250_000, 0.055, 30)
    assert rows[0]["interest"] == 1145.83
    assert rows[0]["principal"] == 273.64
    assert rows[1]["interest"] < rows[0]["interest"]      # balance fell, so interest falls


def test_total_interest_matches_published_figure():
    rows = schedule(250_000, 0.055, 30)
    assert abs(summarise(rows)["total_interest"] - 261_010) < 5


def test_extra_payment_shortens_the_term():
    assert len(schedule(20_000, 0.07, 5, extra=100)) < 60


def test_overpayment_saving_on_the_published_example():
    result = overpayment_saving(250_000, 0.055, 30, 200)
    assert result["months_saved"] == 91
    assert abs(result["interest_saved"] - 75_616) < 5


def test_crossover_month():
    assert summarise(schedule(250_000, 0.055, 30))["crossover_month"] == 210


def test_compare_terms_shorter_is_dearer_monthly_cheaper_overall():
    rows = compare_terms(250_000, 0.055, (15, 30))
    short, long = rows[0], rows[1]
    assert short["payment"] > long["payment"]
    assert short["total_interest"] < long["total_interest"]


# --- refusals: the validation has to actually fire -------------------------
@pytest.mark.parametrize("bad_principal", [0, -1, -250_000])
def test_rejects_non_positive_principal(bad_principal):
    with pytest.raises(ValueError):
        monthly_payment(bad_principal, 0.05, 10)


@pytest.mark.parametrize("bad_years", [0, -5])
def test_rejects_non_positive_term(bad_years):
    with pytest.raises(ValueError):
        monthly_payment(1000, 0.05, bad_years)


def test_rejects_negative_rate():
    with pytest.raises(ValueError):
        monthly_payment(1000, -0.01, 10)


def test_rejects_negative_extra_payment():
    with pytest.raises(ValueError):
        schedule(1000, 0.05, 10, extra=-50)


def test_rejects_zero_income():
    with pytest.raises(ValueError):
        affordability(1000, 0, 0)


# --- affordability ---------------------------------------------------------
def test_dti_bands():
    assert affordability(1000, 250, 6000)["band"] == "comfortable"
    assert affordability(2200, 250, 6000)["band"] == "stretched"
    assert affordability(2400, 500, 6000)["band"] == "high risk"


def test_ltv_is_optional():
    assert affordability(1419.47, 250, 6000)["ltv"] is None
    assert affordability(1419.47, 250, 6000, loan=200_000, asset_value=250_000)["ltv"] == 0.8


# --- investing comparison --------------------------------------------------
def test_invest_instead_zero_rate_is_just_the_deposits():
    assert invest_instead(200, 0.0, 10) == 200 * 120


def test_invest_instead_grows():
    assert invest_instead(200, 0.07, 30) > 200 * 360
