"""The assumptions, each one with the evidence it came from.

A forecast is a set of assumptions with arithmetic wrapped around it. The
arithmetic is the easy half. This file is the hard half, and every field carries
a `source` saying where the number came from, because the first question in any
model review is "where did 0.58% come from" and "it looked about right" is not
an answer that survives it.

Three of these are judgements rather than measurements, and they are marked. A
model that cannot tell you which of its inputs are facts and which are opinions
is a model that will be believed too much.
"""

from __future__ import annotations

from dataclasses import dataclass, field, replace
from pathlib import Path

import csv

DATA = Path(__file__).resolve().parents[4] / "data"


@dataclass(frozen=True, slots=True)
class Driver:
    value: float
    source: str
    judgement: bool = False       # measured from history, or decided by a person

    def __str__(self) -> str:
        mark = "judgement" if self.judgement else "measured"
        return f"{self.value:<14,.6g} {mark:<10} {self.source}"


@dataclass(frozen=True, slots=True)
class Assumptions:
    """One scenario's worth of opinion about the future."""
    name: str

    volume_growth: Driver = Driver(
        0.0215, "median month on month volume growth over the last six months of history")
    take_rate: Driver = Driver(
        0.0058, "the last twelve months of actual transaction fees over actual volume. "
                "The plan assumed 0.62% and the business has not run at that since January",
        judgement=True)
    scheme_cost_rate: Driver = Driver(
        0.0033, "scheme and interchange cost over volume, stable in every month of history")
    merchant_growth: Driver = Driver(
        0.017, "net merchant additions over the last twelve months, after churn")
    platform_fee: Driver = Driver(
        3_420.0, "average platform fee across the roster at the last close")
    fx_share: Driver = Driver(
        0.18 * 0.0035, "FX revenue over volume, from the history")
    hosting_growth: Driver = Driver(
        0.018, "month on month growth in the cloud hosting line")
    payroll_growth: Driver = Driver(
        0.008, "the approved hiring plan, converted to a monthly cost increase",
        judgement=True)
    marketing_monthly: Driver = Driver(
        180_000.0, "the run rate outside campaign months")
    other_opex_monthly: Driver = Driver(
        156_880.0, "facilities and administration, flat in the last six months")
    capex_monthly: Driver = Driver(
        120_000.0, "the average of the last twelve months")
    depreciation_rate: Driver = Driver(
        0.0233, "depreciation over opening net book value, every month of history")
    dso_days: Driver = Driver(
        38.0, "receivables over revenue, times days, unchanged across the history")
    dpo_days: Driver = Driver(
        32.0, "payables over costs, times days, unchanged across the history")
    tax_rate: Driver = Driver(0.21, "the rate applied in every month of history")
    term_loan_rate: Driver = Driver(0.095, "the loan agreement")
    term_loan_repayment: Driver = Driver(125_000.0, "the amortisation schedule")
    revolver_rate: Driver = Driver(
        0.115, "the facility's headline rate, 200 basis points over the term loan",
        judgement=True)
    minimum_cash: Driver = Driver(
        5_000_000.0, "the board's stated floor, which is what makes the revolver draw",
        judgement=True)

    def scaled(self, name: str, **factors: float) -> "Assumptions":
        """A scenario, expressed as multiples of the base case.

        Scenarios are built by scaling the base rather than by retyping every
        number, so that a change to a measured driver flows into all three and
        the only difference between scenarios stays the thing being varied.
        """
        changes = {}
        for field_name, factor in factors.items():
            current: Driver = getattr(self, field_name)
            changes[field_name] = Driver(current.value * factor,
                                         f"{current.source}, scaled {factor:g}x for the "
                                         f"{name} case", judgement=True)
        return replace(self, name=name, **changes)


@dataclass(frozen=True, slots=True)
class Opening:
    """The closing balance sheet the forecast starts from."""
    month: str
    cash: float
    receivables: float
    ppe: float
    payables: float
    debt: float
    paid_in: float
    retained: float
    revenue: float
    volume: float
    merchants: float
    hosting: float
    payroll: float

    @property
    def balances(self) -> bool:
        return abs((self.cash + self.receivables + self.ppe)
                   - (self.payables + self.debt + self.paid_in + self.retained)) < 0.005


def opening_from_history(path: Path | None = None) -> Opening:
    """Read the last closed month, and refuse to start from a sheet that does not balance."""
    with (path or DATA / "fpa-history.csv").open(encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))
    last = rows[-1]
    number = lambda key: float(last[key])

    opening = Opening(
        month=last["month"],
        cash=number("cash"), receivables=number("accounts_receivable"),
        ppe=number("ppe_net"), payables=number("accounts_payable"),
        debt=number("debt"), paid_in=number("paid_in_capital"),
        retained=number("retained_earnings"), revenue=number("revenue_total"),
        volume=number("payment_volume"),
        merchants=number("revenue_subscription") / 3_420.0,
        hosting=number("cogs_hosting"), payroll=number("payroll"),
    )
    if not opening.balances:
        raise ValueError(f"the opening balance sheet at {opening.month} does not balance")
    return opening


def base() -> Assumptions:
    return Assumptions(name="base")


def scenarios() -> list[Assumptions]:
    """Three cases, differing only in the drivers a person would argue about."""
    b = base()
    return [
        b,
        b.scaled("upside", volume_growth=1.35, take_rate=1.02),
        b.scaled("downside", volume_growth=0.35, take_rate=0.95, payroll_growth=1.4),
        # The case the model exists for. A large merchant leaves, pricing is
        # conceded to keep the next one, the merchants that remain pay later,
        # and hiring carries on because it was approved last year. Nothing in it
        # is dramatic on its own and together they draw on the facility, which
        # is the only scenario here that exercises the circular reference.
        b.scaled("stress", volume_growth=-0.2, take_rate=0.85,
                 dso_days=1.55, payroll_growth=1.8),
    ]
