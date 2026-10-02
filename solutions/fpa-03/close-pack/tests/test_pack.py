"""The tests. Each one is a mistake that would otherwise reach the meeting.

    pytest -q

Two of them are worth reading even if you never run them:
`test_the_check_catches_a_dropped_pack_line` proves the check cell actually
checks something, by breaking the pack on purpose and asserting that it
complains. A check that has never failed might be checking nothing.
And `test_a_duplicated_key_doubles_the_rows` is the pandas trap that costs
analysts the most money: a merge against a table whose key is not unique.
"""

from __future__ import annotations

import pandas as pd
import pytest

from closepack import checks, load, pack


# --------------------------------------------------------------- the loader
def test_accounting_brackets_are_a_minus_sign():
    assert load.to_number("(700,200.00)") == -700_200.0
    assert load.to_number("180,000.00") == 180_000.0
    assert load.to_number("  1234.5 ") == 1234.5
    assert load.to_number(42) == 42.0


def test_the_loader_reports_what_it_repaired():
    frame, report = load.load_actuals()
    assert report.duplicates_removed == 1, "the export contains one journal twice"
    assert report.text_amounts_repaired == 2, "one comma amount, one bracketed credit"
    assert report.labels_trimmed == 1, "one account name has a trailing space"
    assert frame["value"].notna().all()


def test_revenue_comes_out_positive():
    """The sign rule, applied once. Revenue is a credit in the file."""
    frame, _ = load.load_actuals()
    september = frame[frame["month"] == "2025-09"]
    assert september.loc[september["group"] == "revenue", "value"].sum() > 0
    assert september.loc[september["group"] == "cogs", "value"].sum() > 0


def test_the_trailing_space_is_gone_so_one_account_does_not_become_two():
    frame, _ = load.load_actuals()
    hosting = frame[frame["account_code"] == "5100"]
    assert hosting["account_name"].nunique() == 1


# ----------------------------------------------------------------- the pack
@pytest.fixture(scope="module")
def september() -> pack.Pack:
    return pack.build("2025-09")


def test_the_pack_matches_the_ledger(september):
    assert september.ties, f"pack against ledger: {september.tie_difference}"
    assert not checks.fatal(september.findings)


def test_the_headline_numbers(september):
    t = september.totals
    assert round(t["revenue_actual"]) == 3_361_050
    assert round(t["revenue_budget"]) == 3_220_357
    assert round(t["gross_actual"]) == 1_903_569
    assert round(t["ebitda_actual"]) == 265_989
    assert round(t["ebitda_budget"]) == 378_391


def test_revenue_above_plan_and_gross_profit_below_it(september):
    """The whole point of the level, asserted."""
    t = september.totals
    assert t["revenue_actual"] > t["revenue_budget"]
    assert t["gross_actual"] < t["gross_budget"]


def test_variance_is_signed_so_positive_is_favourable(september):
    marketing = september.lines.set_index("line").loc["Marketing programmes"]
    assert marketing["actual"] > marketing["budget"]
    assert marketing["variance"] < 0, "spending more than planned is unfavourable"

    fees = september.lines.set_index("line").loc["Transaction fees"]
    assert fees["actual"] > fees["budget"]
    assert fees["variance"] > 0, "earning more than planned is favourable"


def test_the_bridge_adds_back_to_the_variance_it_decomposes(september):
    bridge = september.bridge
    assert round(bridge["volume_effect"]) == 313_938
    assert round(bridge["rate_effect"]) == -161_944
    assert abs(bridge["rounding"]) < 1, "a dollar of rounding is fine, more is a bug"


def test_a_different_month_is_an_argument_rather_than_an_edit():
    august = pack.build("2025-08")
    assert august.ties
    assert round(august.totals["revenue_actual"]) != 3_361_050


# --------------------------------------------------------------- the gates
def test_the_check_catches_a_dropped_pack_line(monkeypatch):
    """Break the pack on purpose and prove the check notices.

    A pack line that exists in the mapping and not in PACK_ORDER is the
    realistic way a report starts drifting: somebody adds an account, nobody
    adds it to the layout, and the total quietly stops including it.
    """
    monkeypatch.setattr(load, "PACK_ORDER",
                        [line for line in load.PACK_ORDER if line != "FX markup"])
    monkeypatch.setattr(pack, "PACK_ORDER", load.PACK_ORDER)
    broken = pack.build("2025-09")
    assert not broken.ties
    assert round(broken.tie_difference) == -255_062, "the missing FX markup line"


def test_an_unmapped_account_stops_the_pack():
    frame, _ = load.load_actuals()
    budget = load.load_budget()
    frame = pd.concat([frame, frame.head(1).assign(account_code="4900")], ignore_index=True)
    findings = checks.run(frame, budget, "2025-09")
    assert any(f.check == "unmapped accounts" for f in checks.fatal(findings))


def test_a_month_that_is_not_in_the_plan_is_fatal():
    frame, _ = load.load_actuals()
    findings = checks.run(frame, load.load_budget(), "2024-05")
    assert any(f.check == "month missing" for f in checks.fatal(findings))


def test_the_budgeted_cost_centre_with_no_actuals_is_a_warning(september):
    warnings = [f for f in september.findings if f.level == "warning"]
    assert any("CC600" in f.detail for f in warnings)
    assert not any("CC600" in f.detail for f in checks.fatal(september.findings))


# ------------------------------------------------------- the pandas classic
def test_a_duplicated_key_doubles_the_rows():
    """The merge that silently doubles your revenue.

    Nothing raises, no warning appears, and the total is exactly twice what it
    should be. Checking that the key is unique before merging costs one line and
    is the single most valuable habit in pandas for anybody handling money.
    """
    invoices = pd.DataFrame({"customer_id": ["A", "B"], "amount": [100.0, 200.0]})
    customers = pd.DataFrame({"customer_id": ["A", "B"], "segment": ["mid", "mid"]})
    assert invoices.merge(customers, on="customer_id")["amount"].sum() == 300.0

    duplicated = pd.concat([customers, customers.head(1)], ignore_index=True)
    exploded = invoices.merge(duplicated, on="customer_id")
    assert len(exploded) == 3
    assert exploded["amount"].sum() == 400.0

    assert duplicated["customer_id"].is_unique is False   # the one line that catches it
