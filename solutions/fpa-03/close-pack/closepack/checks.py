"""The gates. A pack that cannot prove itself does not print.

Every check here answers one question: **is there any reason to believe this
month's numbers are wrong?** They run before the pack is built, they return
findings rather than raising, and `pack.py` refuses to write an output file if
any of them is fatal.

The distinction between a fatal check and a warning is the interesting part, and
it is a judgement about money rather than about data:

* **Fatal.** The pack would be wrong: an account code with no mapping, a month
  that does not exist in one of the two files, a pack total that does not agree
  with the ledger.
* **Warning.** The pack is right and something upstream needs attention: a cost
  centre with a budget and no actuals, a duplicate journal that was removed, an
  invoice credited in the billing system and never posted.

A gate that cries wolf gets switched off within two months, which is why the
warnings are separated rather than promoted.
"""

from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

from .load import MAPPING


@dataclass(frozen=True, slots=True)
class Finding:
    level: str          # "fatal" or "warning"
    check: str
    detail: str

    def __str__(self) -> str:
        return f"[{self.level}] {self.check}: {self.detail}"


def run(actuals: pd.DataFrame, budget: pd.DataFrame, month: str,
        duplicates_removed: int = 0) -> list[Finding]:
    findings: list[Finding] = []

    # 1. Every account code has a home in the pack. An unmapped code is money
    #    that exists in the ledger and appears nowhere in the report.
    unmapped = sorted(set(actuals["account_code"]) - set(MAPPING))
    if unmapped:
        findings.append(Finding("fatal", "unmapped accounts",
                                f"{', '.join(unmapped)} appear in the ledger and not in the mapping"))
    unmapped_budget = sorted(set(budget["account_code"]) - set(MAPPING))
    if unmapped_budget:
        findings.append(Finding("fatal", "unmapped budget accounts",
                                f"{', '.join(unmapped_budget)} are budgeted and not mapped"))

    # 2. The month exists on both sides. Asking for a month the plan does not
    #    cover produces a pack where every line is 100% favourable.
    if month not in set(actuals["month"]):
        findings.append(Finding("fatal", "month missing", f"no ledger rows for {month}"))
    if month not in set(budget["month"]):
        findings.append(Finding("fatal", "month missing", f"no budget rows for {month}"))

    # 3. Amounts are numbers. After load.py this should be impossible, which is
    #    exactly why it is checked: the gate outlives the assumption.
    if actuals["value"].isna().any():
        findings.append(Finding("fatal", "unreadable amounts",
                                f"{int(actuals['value'].isna().sum())} rows have no numeric amount"))

    # 4. Cost centres that are budgeted and never used. Not an error, and not
    #    nothing: it is a favourable variance every month for a team that does
    #    not exist.
    ghost = (set(budget.loc[budget["month"] == month, "cost_centre"])
             - set(actuals.loc[actuals["month"] == month, "cost_centre"]))
    for centre in sorted(ghost):
        amount = budget.loc[(budget["month"] == month)
                            & (budget["cost_centre"] == centre), "budget_amount"].sum()
        findings.append(Finding("warning", "budget with no actuals",
                                f"{centre} is budgeted {amount:,.0f} and has no ledger rows"))

    # 5. Whatever the loader had to repair, said out loud.
    if duplicates_removed:
        findings.append(Finding("warning", "duplicate journals",
                                f"{duplicates_removed} removed before totalling"))

    return findings


def fatal(findings: list[Finding]) -> list[Finding]:
    return [f for f in findings if f.level == "fatal"]
