"""The pack itself: actual, budget, variance, and the check that it ties.

    python -m closepack.pack                 # September 2025
    python -m closepack.pack --month 2025-08
    python -m closepack.pack --csv out.csv   # also write the pack as a file

The output is the same table the spreadsheet in level 1 produces, from the same
two files, with three differences that matter: it takes under a second, it
refuses to print when a gate fails, and changing the month is an argument rather
than an edit.
"""

from __future__ import annotations

import argparse
import sys
import time
from dataclasses import dataclass

import pandas as pd

from .bridge import price_volume
from .checks import Finding, fatal, run as run_checks
from .load import PACK_ORDER, load_actuals, load_budget, load_history, load_plan_drivers

# Positive is favourable to profit. One rule, decided once, so that nobody
# reading the pack has to work out the sign for themselves.
FAVOURABLE_WHEN_HIGHER = {"revenue"}


@dataclass(frozen=True, slots=True)
class Pack:
    month: str
    lines: pd.DataFrame
    totals: pd.Series
    findings: list[Finding]
    bridge: dict
    tie_difference: float

    @property
    def ties(self) -> bool:
        return abs(self.tie_difference) < 0.005


def variance(actual: float, budget: float, group: str) -> float:
    """Signed so that a positive number is always better for profit."""
    return actual - budget if group in FAVOURABLE_WHEN_HIGHER else budget - actual


def build(month: str = "2025-09") -> Pack:
    actuals, report = load_actuals()
    budget = load_budget()
    findings = run_checks(actuals, budget, month, report.duplicates_removed)
    if fatal(findings):
        return Pack(month, pd.DataFrame(), pd.Series(dtype=float), findings, {}, float("nan"))

    this_month = actuals[actuals["month"] == month]
    this_plan = budget[budget["month"] == month]

    actual_by_line = this_month.groupby("pack_line")["value"].sum()
    budget_by_line = this_plan.groupby("pack_line")["budget_amount"].sum()
    group_of = dict(zip(this_month["pack_line"], this_month["group"]))
    group_of.update(dict(zip(this_plan["pack_line"], this_plan["group"])))

    rows = []
    for line in PACK_ORDER:
        a = float(actual_by_line.get(line, 0.0))
        b = float(budget_by_line.get(line, 0.0))
        group = group_of.get(line, "opex")
        rows.append({
            "line": line, "group": group, "actual": a, "budget": b,
            "variance": variance(a, b, group),
            "variance_pct": (a - b) / b if b else float("nan"),
        })
    lines = pd.DataFrame(rows)

    def total(group: str, column: str) -> float:
        return float(lines.loc[lines["group"] == group, column].sum())

    revenue_a, revenue_b = total("revenue", "actual"), total("revenue", "budget")
    cogs_a, cogs_b = total("cogs", "actual"), total("cogs", "budget")
    opex_a, opex_b = total("opex", "actual"), total("opex", "budget")
    totals = pd.Series({
        "revenue_actual": revenue_a, "revenue_budget": revenue_b,
        "cogs_actual": cogs_a, "cogs_budget": cogs_b,
        "gross_actual": revenue_a - cogs_a, "gross_budget": revenue_b - cogs_b,
        "gross_margin_actual": (revenue_a - cogs_a) / revenue_a if revenue_a else float("nan"),
        "gross_margin_budget": (revenue_b - cogs_b) / revenue_b if revenue_b else float("nan"),
        "opex_actual": opex_a, "opex_budget": opex_b,
        "ebitda_actual": revenue_a - cogs_a - opex_a,
        "ebitda_budget": revenue_b - cogs_b - opex_b,
    })

    # The check cell, in the only form that survives being automated. The pack
    # is built from PACK_ORDER; the ledger side is built from every row in the
    # month that is not below EBITDA, whatever it maps to. So an account that is
    # mapped but missing from PACK_ORDER, which is the realistic way a pack
    # starts drifting, shows up here as a non zero difference instead of as a
    # number quietly missing from a report nobody re-adds by hand.
    pack_total = (float(lines.loc[lines["group"] == "revenue", "actual"].sum())
                  - float(lines.loc[lines["group"] != "revenue", "actual"].sum()))
    ledger_total = (float(this_month.loc[this_month["group"] == "revenue", "value"].sum())
                    - float(this_month.loc[this_month["group"].isin(["cogs", "opex"]),
                                           "value"].sum()))
    tie_difference = round(pack_total - ledger_total, 2)

    return Pack(month, lines, totals, findings,
                price_volume(load_history(), load_plan_drivers(), month, actuals, budget),
                tie_difference)


def render(pack: Pack) -> str:
    out: list[str] = []
    out.append(f"Meridian Pay, management pack, {pack.month}")
    out.append("")
    if fatal(pack.findings):
        out.append("   the pack was not produced. Fix these first:")
        for finding in fatal(pack.findings):
            out.append(f"      {finding}")
        return "\n".join(out)

    head = f"   {'line':<24}{'actual':>14}{'budget':>14}{'variance':>14}{'':>3}"
    out.append(head)
    for _, row in pack.lines.iterrows():
        flag = "" if abs(row["variance"]) < 25_000 else ("  *" if row["variance"] < 0 else "  +")
        out.append(f"   {row['line']:<24}{row['actual']:>14,.0f}{row['budget']:>14,.0f}"
                   f"{row['variance']:>+14,.0f}{flag:>3}")

    t = pack.totals
    out.append("")
    for label, a, b in [("Revenue", t["revenue_actual"], t["revenue_budget"]),
                        ("Cost of sales", t["cogs_actual"], t["cogs_budget"]),
                        ("Gross profit", t["gross_actual"], t["gross_budget"]),
                        ("Operating expenses", t["opex_actual"], t["opex_budget"]),
                        ("EBITDA", t["ebitda_actual"], t["ebitda_budget"])]:
        group = "revenue" if label in ("Revenue", "Gross profit", "EBITDA") else "cogs"
        out.append(f"   {label:<24}{a:>14,.0f}{b:>14,.0f}{variance(a, b, group):>+14,.0f}")
    out.append(f"   {'Gross margin':<24}{t['gross_margin_actual']:>13.1%}"
               f"{t['gross_margin_budget']:>14.1%}")

    bridge = pack.bridge
    out.append("")
    out.append("   transaction fees, split")
    out.append(f"      volume effect {bridge['volume_effect']:>+14,.0f}   "
               f"volume {bridge['volume_actual'] / bridge['volume_plan'] - 1:+.1%} against plan")
    out.append(f"      rate effect   {bridge['rate_effect']:>+14,.0f}   "
               f"take rate {bridge['rate_actual'] * 100:.4f}% against {bridge['rate_plan'] * 100:.4f}%")
    out.append(f"      sum           {bridge['sum']:>+14,.0f}   reported {bridge['reported']:>+14,.0f}"
               f"   ({bridge['rounding']:+,.2f} rounding)")

    out.append("")
    out.append(f"   check: pack against ledger  {pack.tie_difference:>+14,.2f}"
               f"   {'ok' if pack.ties else 'DOES NOT TIE'}")
    warnings = [f for f in pack.findings if f.level == "warning"]
    if warnings:
        out.append("")
        out.append("   worth saying in the commentary:")
        for finding in warnings:
            out.append(f"      {finding.detail}")
    return "\n".join(out)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--month", default="2025-09")
    parser.add_argument("--csv", help="also write the pack lines to this file")
    args = parser.parse_args()

    started = time.perf_counter()
    pack = build(args.month)
    elapsed = (time.perf_counter() - started) * 1000

    print(render(pack))
    if fatal(pack.findings):
        return 1
    if args.csv:
        pack.lines.to_csv(args.csv, index=False)
        print(f"\n   written to {args.csv}")
    print(f"\n   built in {elapsed:,.0f} ms")
    return 0 if pack.ties else 1


if __name__ == "__main__":
    sys.exit(main())
