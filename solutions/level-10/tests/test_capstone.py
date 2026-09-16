"""
Capstone test suite: 38 tests across seven modules.

Priorities, in order: invariants (the ledger balances), refusals (bad input
raises and writes nothing), and known values (numbers verifiable by hand).

Run from the project root:  pytest -q
"""

import pandas as pd
import pytest

from neobank import analytics, fraud, fx, lending, loaders, reconcile, risk
from neobank.ledger import (DuplicateAccount, InsufficientFunds, InvalidAmount,
                            Ledger, LedgerError, UnknownAccount, money, to_cents)


# ===========================================================================
# ledger: the invariant, the refusals, the retry
# ===========================================================================
def make_ledger():
    led = Ledger()
    led.open_account("alice")
    led.open_account("bob")
    led.deposit("alice", 10_000)
    return led


def test_money_helpers_avoid_float_error():
    assert to_cents("19.99") == 1999
    assert to_cents("0.1") + to_cents("0.2") == to_cents("0.3")
    assert money(-2500) == "-$25.00"


def test_deposit_creates_a_balanced_pair():
    led = make_ledger()
    assert led.balance("alice") == 10_000
    assert led.balance("world") == -10_000
    assert led.check_invariant()


def test_transfer_with_fee_has_three_balanced_legs():
    led = make_ledger()
    led.transfer("alice", "bob", 2_500, fee=50)
    assert (led.balance("alice"), led.balance("bob"), led.balance("fee_income")) == (7_450, 2_500, 50)
    assert led.check_invariant()


def test_idempotent_retry_posts_once():
    led = make_ledger()
    first = led.transfer("alice", "bob", 100, key="abc")
    count = len(led.entries)
    second = led.transfer("alice", "bob", 100, key="abc")
    assert first == second
    assert len(led.entries) == count


def test_overdraft_is_refused_and_writes_nothing():
    led = make_ledger()
    before = len(led.entries)
    with pytest.raises(InsufficientFunds):
        led.transfer("alice", "bob", 999_999)
    assert len(led.entries) == before
    assert led.check_invariant()


def test_unknown_account_is_refused():
    led = make_ledger()
    with pytest.raises(UnknownAccount):
        led.transfer("alice", "nobody", 100)


@pytest.mark.parametrize("amount", [0, -1])
def test_non_positive_amounts_are_refused(amount):
    led = make_ledger()
    with pytest.raises(InvalidAmount):
        led.transfer("alice", "bob", amount)


def test_duplicate_account_is_refused():
    led = make_ledger()
    with pytest.raises(DuplicateAccount):
        led.open_account("alice")


def test_reversal_restores_balances_without_deleting_history():
    led = make_ledger()
    txn = led.transfer("alice", "bob", 2_500, fee=50)
    entries_before = len(led.entries)
    led.reverse(txn)
    assert led.balance("alice") == 10_000
    assert led.balance("bob") == 0
    assert len(led.entries) > entries_before
    assert any(e["txn_id"] == txn for e in led.entries)
    assert led.check_invariant()


def test_reversing_an_unknown_transaction_raises():
    with pytest.raises(LedgerError):
        make_ledger().reverse("TXN99999")


def test_penny_split_loses_nothing():
    led = make_ledger()
    for name in ("c1", "c2", "c3"):
        led.open_account(name)
    txn = led.split_payment("alice", ["c1", "c2", "c3"], 100)
    assert [led.balance("c1"), led.balance("c2"), led.balance("c3")] == [34, 33, 33]
    assert sum(e["amount"] for e in led.entries if e["txn_id"] == txn) == 0
    assert led.check_invariant()


def test_statement_running_balance_ends_at_the_balance():
    led = make_ledger()
    led.transfer("alice", "bob", 1_000)
    rows = led.statement("alice")
    assert rows[-1]["balance"] == led.balance("alice")


# ===========================================================================
# reconcile
# ===========================================================================
def test_reconciliation_is_clean_when_the_books_agree():
    led = make_ledger()
    rows = reconcile.reconcile(led, {"alice": 10_000, "bob": 0,
                                     "world": -10_000, "fee_income": 0})
    assert reconcile.is_clean(rows)


def test_reconciliation_reports_a_break():
    led = make_ledger()
    rows = reconcile.reconcile(led, {"alice": 9_950, "bob": 0,
                                     "world": -10_000, "fee_income": 0})
    found = reconcile.breaks(rows)
    assert len(found) == 1
    assert found[0]["account"] == "alice"
    assert found[0]["difference"] == 50


def test_reconciliation_flags_an_account_the_ledger_does_not_know():
    led = make_ledger()
    rows = reconcile.reconcile(led, {"alice": 10_000, "bob": 0, "world": -10_000,
                                     "fee_income": 0, "ghost": 5})
    assert any(r["account"] == "ghost" and r["status"] == "unknown to the ledger" for r in rows)


# ===========================================================================
# lending
# ===========================================================================
def test_known_mortgage_payment():
    assert round(lending.monthly_payment(250_000, 0.055, 30), 2) == 1419.47


def test_zero_rate_loan_splits_evenly():
    assert round(lending.monthly_payment(12_000, 0.0, 4), 2) == 250.00


def test_schedule_ends_at_exactly_zero():
    df = lending.schedule(20_000, 0.07, 5)
    assert len(df) == 60
    assert df["balance"].iloc[-1] == 0.0


def test_interest_is_charged_on_the_current_balance():
    df = lending.schedule(250_000, 0.055, 30)
    assert df["interest"].iloc[0] == 1145.83
    assert df["principal"].iloc[0] == 273.64
    assert lending.summarise(df)["crossover_month"] == 210


def test_overpayment_saving_matches_the_published_figure():
    result = lending.overpayment_saving(250_000, 0.055, 30, 200)
    assert result["months_saved"] == 91
    assert abs(result["interest_saved"] - 75_616) < 5


@pytest.mark.parametrize("bad", [
    lambda: lending.monthly_payment(-1, 0.05, 10),
    lambda: lending.monthly_payment(1000, 0.05, 0),
    lambda: lending.schedule(1000, 0.05, 10, extra=-50),
])
def test_lending_refuses_bad_input(bad):
    with pytest.raises(ValueError):
        bad()


# ===========================================================================
# analytics
# ===========================================================================
def test_income_excludes_refunds():
    df = loaders.load_transactions()
    assert round(analytics.headline_numbers(df)["income"], 2) == 20_100.00


def test_savings_transfers_are_not_spending():
    df = loaders.load_transactions()
    numbers = analytics.headline_numbers(df)
    assert round(numbers["spend"], 2) == 13_358.30
    assert round(numbers["savings_rate"], 3) == 0.335


def test_recurring_charges_split_into_cancellable_and_fixed():
    df = loaders.load_transactions()
    recurring = analytics.find_recurring(df)
    assert len(recurring) == 8
    assert int(recurring["cancellable"].sum()) == 5


# ===========================================================================
# risk
# ===========================================================================
def test_volatility_uses_sqrt_of_time():
    prices = loaders.load_prices()
    returns = risk.compute_returns(prices)
    _, vol = risk.annualize(returns)
    assert abs(vol["TECHX"] - 0.314) < 0.002


def test_volatility_drag_is_visible():
    prices = loaders.load_prices()
    table = risk.asset_table(prices)
    assert table.loc["CRYPTOZ", "ann_mean"] > table.loc["CRYPTOZ", "cagr"] + 0.30


def test_diversification_beats_the_average_of_the_parts():
    returns = risk.compute_returns(loaders.load_prices())
    check = risk.diversification_check(returns, {"TECHX":.25, "BANKCO":.25,
                                                 "GOLDF":.25, "CRYPTOZ":.25})
    assert check["portfolio_vol"] < check["weighted_average_vol"]
    assert check["benefit"] > 0.07


def test_weights_must_sum_to_one():
    returns = risk.compute_returns(loaders.load_prices())
    with pytest.raises(AssertionError):
        risk.portfolio_returns(returns, {"TECHX":.4, "BANKCO":.3, "GOLDF":.2, "CRYPTOZ": 0.0})


# ===========================================================================
# fraud
# ===========================================================================
def test_do_nothing_baseline_is_stated():
    df = loaders.load_card_transactions()
    base = fraud.baseline(df)
    assert base["fraud_cases"] == 108
    assert round(base["do_nothing_accuracy"], 4) == 0.982


def test_rule_engine_known_operating_points():
    df = fraud.apply_rules(fraud.engineer(loaders.load_card_transactions()))
    sweep = fraud.threshold_sweep(df).set_index("threshold")
    assert (sweep.loc[6, "tp"], sweep.loc[6, "fp"]) == (88, 72)
    assert (sweep.loc[7, "tp"], sweep.loc[7, "fp"]) == (77, 14)
    assert sweep.loc[9, "precision"] == 1.0


def test_cost_optimal_threshold_differs_from_f1_optimal():
    df = fraud.apply_rules(fraud.engineer(loaders.load_card_transactions()))
    sweep = fraud.threshold_sweep(df)
    f1_best = int(sweep.loc[sweep["f1"].idxmax(), "threshold"])
    _, cost_best, _ = fraud.cost_curve(df)
    assert f1_best == 7
    assert cost_best == 4
    assert f1_best != cost_best


def test_every_flag_carries_its_reasons():
    df = fraud.apply_rules(fraud.engineer(loaders.load_card_transactions()))
    flagged = df[df["score"] >= 6]
    assert (flagged["reasons"].str.len() > 0).all()


# ===========================================================================
# fx and loaders
# ===========================================================================
def test_cross_rate_round_trips():
    rates = loaders.load_fx_snapshot()["rates"]
    there = fx.convert(77, "GBP", "JPY", rates)
    assert round(fx.convert(there, "JPY", "GBP", rates), 6) == 77.0


def test_unquoted_currency_is_reported_not_dropped():
    rows = fx.value_holdings([{"asset": "mystery", "currency": "ZZZ", "units": 10}],
                             {"EUR": 0.9})
    assert rows[0]["note"]
    assert rows[0]["value"] == 0.0


def test_missing_data_file_raises_a_clear_error():
    with pytest.raises(loaders.DataError):
        loaders.load_transactions(path="definitely-not-here.csv")
