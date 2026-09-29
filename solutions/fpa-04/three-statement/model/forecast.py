"""The engine: fifteen months, three statements, and a balance sheet that ties.

    python -m model.forecast                # the base case
    python -m model.forecast --scenario downside

The order inside the month loop is the whole model, and it is the order anybody
builds one in:

    1. revenue, from drivers rather than from a growth rate on a total
    2. costs, the ones that scale with volume and the ones that do not
    3. the profit and loss down to net income
    4. the working capital the profit and loss implies
    5. the cash flow that moves between the two
    6. the balance sheet, where cash is what the cash flow said and nothing else

**Cash is an output.** The single most common error in a first model is to
forecast cash directly and then wonder why the balance sheet does not balance.
Cash is the closing line of the cash flow statement, and the balance sheet is
then an identity rather than a hope: every month here is asserted to the cent.

The revolver is where the circular reference lives. A draw costs interest,
interest reduces cash, less cash means a larger draw. Spreadsheets solve this
with iterative calculation and a checkbox most people never find; here it is a
loop that runs until the answer stops moving, and it reports how many passes it
took.
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass, field

from .drivers import Assumptions, Opening, base, opening_from_history, scenarios

HORIZON = 15                      # October 2025 to December 2026
MAX_PASSES = 50
TOLERANCE = 0.005                 # half a cent


def month_after(month: str) -> str:
    year, number = int(month[:4]), int(month[5:])
    return f"{year + (number == 12)}-{(number % 12) + 1:02d}"


@dataclass
class Month:
    month: str
    revenue: float = 0.0
    revenue_transaction: float = 0.0
    revenue_subscription: float = 0.0
    revenue_fx: float = 0.0
    cogs: float = 0.0
    gross_profit: float = 0.0
    opex: float = 0.0
    ebitda: float = 0.0
    depreciation: float = 0.0
    ebit: float = 0.0
    interest: float = 0.0
    tax: float = 0.0
    net_income: float = 0.0

    cash_from_operations: float = 0.0
    capex: float = 0.0
    financing: float = 0.0

    cash: float = 0.0
    receivables: float = 0.0
    ppe: float = 0.0
    payables: float = 0.0
    debt: float = 0.0
    revolver: float = 0.0
    paid_in: float = 0.0
    retained: float = 0.0

    volume: float = 0.0
    merchants: float = 0.0
    passes: int = 1

    @property
    def assets(self) -> float:
        return self.cash + self.receivables + self.ppe

    @property
    def liabilities_and_equity(self) -> float:
        return self.payables + self.debt + self.revolver + self.paid_in + self.retained

    @property
    def out_by(self) -> float:
        return round(self.assets - self.liabilities_and_equity, 2)

    @property
    def balances(self) -> bool:
        return abs(self.out_by) < TOLERANCE


@dataclass
class Forecast:
    assumptions: Assumptions
    opening: Opening
    months: list[Month] = field(default_factory=list)

    @property
    def balances(self) -> bool:
        return all(m.balances for m in self.months)

    @property
    def worst_pass_count(self) -> int:
        return max((m.passes for m in self.months), default=0)

    @property
    def peak_revolver(self) -> float:
        return max((m.revolver for m in self.months), default=0.0)

    def line(self, name: str) -> list[float]:
        return [getattr(m, name) for m in self.months]


def run(assumptions: Assumptions | None = None, opening: Opening | None = None,
        horizon: int = HORIZON) -> Forecast:
    a = assumptions or base()
    o = opening or opening_from_history()
    forecast = Forecast(a, o)

    volume = o.volume
    merchants = o.merchants
    hosting = o.hosting
    payroll = o.payroll
    cash, receivables, ppe = o.cash, o.receivables, o.ppe
    payables, debt, retained = o.payables, o.debt, o.retained
    revolver = 0.0
    month_name = o.month

    for _ in range(horizon):
        month_name = month_after(month_name)
        volume *= 1 + a.volume_growth.value
        merchants *= 1 + a.merchant_growth.value
        hosting *= 1 + a.hosting_growth.value
        payroll *= 1 + a.payroll_growth.value

        row = Month(month=month_name, volume=volume, merchants=merchants)
        row.revenue_transaction = volume * a.take_rate.value
        row.revenue_subscription = merchants * a.platform_fee.value
        row.revenue_fx = volume * a.fx_share.value
        row.revenue = row.revenue_transaction + row.revenue_subscription + row.revenue_fx

        row.cogs = volume * a.scheme_cost_rate.value + hosting
        row.gross_profit = row.revenue - row.cogs
        row.opex = payroll + a.marketing_monthly.value + a.other_opex_monthly.value
        row.ebitda = row.gross_profit - row.opex
        row.depreciation = ppe * a.depreciation_rate.value
        row.ebit = row.ebitda - row.depreciation
        row.capex = a.capex_monthly.value

        opening_receivables, opening_payables = receivables, payables
        row.receivables = row.revenue * a.dso_days.value / 30.4
        row.payables = (row.cogs + row.opex) * a.dpo_days.value / 30.4

        repayment = min(a.term_loan_repayment.value, debt)
        closing_debt = debt - repayment

        # ------------------------------------------------------ the circle
        # Interest depends on the revolver, the revolver depends on cash, and
        # cash depends on interest. Iterate until the draw stops moving.
        draw = 0.0
        for attempt in range(1, MAX_PASSES + 1):
            interest = (debt * a.term_loan_rate.value / 12
                        + (revolver + draw / 2) * a.revolver_rate.value / 12)
            pretax = row.ebit - interest
            tax = max(0.0, pretax) * a.tax_rate.value
            net_income = pretax - tax

            operations = (net_income + row.depreciation
                          - (row.receivables - opening_receivables)
                          + (row.payables - opening_payables))
            before_financing = cash + operations - row.capex - repayment
            needed = max(0.0, a.minimum_cash.value - (before_financing + revolver * 0))
            # Repay the revolver when there is spare cash above the floor.
            if needed == 0 and revolver > 0:
                spare = before_financing - a.minimum_cash.value
                new_draw = -min(revolver, max(0.0, spare))
            else:
                new_draw = needed

            row.passes = attempt
            if abs(new_draw - draw) < TOLERANCE:
                draw = new_draw
                break
            draw = new_draw

        row.interest = interest
        row.tax = tax
        row.net_income = net_income
        row.cash_from_operations = operations
        row.financing = -repayment + draw
        row.revolver = revolver + draw
        row.debt = closing_debt
        row.cash = before_financing + draw
        row.ppe = ppe + row.capex - row.depreciation
        row.retained = retained + net_income
        row.paid_in = o.paid_in

        # Roll forward.
        cash, receivables, payables = row.cash, row.receivables, row.payables
        ppe, debt, revolver, retained = row.ppe, row.debt, row.revolver, row.retained
        forecast.months.append(row)

    return forecast


def render(forecast: Forecast) -> str:
    out = [f"Meridian Pay, forecast, {forecast.assumptions.name} case, "
           f"from {forecast.opening.month}", ""]
    out.append(f"   {'month':<9}{'revenue':>12}{'ebitda':>11}{'net income':>12}"
               f"{'cash':>13}{'revolver':>11}{'out by':>9}")
    for m in forecast.months:
        out.append(f"   {m.month:<9}{m.revenue:>12,.0f}{m.ebitda:>11,.0f}"
                   f"{m.net_income:>12,.0f}{m.cash:>13,.0f}{m.revolver:>11,.0f}"
                   f"{m.out_by:>9.2f}")

    year = [m for m in forecast.months if m.month.startswith("2026")]
    out.append("")
    out.append(f"   FY2026 revenue      {sum(m.revenue for m in year):>14,.0f}")
    out.append(f"   FY2026 EBITDA       {sum(m.ebitda for m in year):>14,.0f}"
               f"   {sum(m.ebitda for m in year) / sum(m.revenue for m in year):>7.1%} margin")
    out.append(f"   closing cash        {forecast.months[-1].cash:>14,.0f}")
    out.append(f"   peak revolver       {forecast.peak_revolver:>14,.0f}")
    out.append(f"   balance sheet       {'ties in every month' if forecast.balances else 'DOES NOT TIE'}"
               f", worst case {forecast.worst_pass_count} passes to resolve the circularity")
    return "\n".join(out)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--scenario", default="base", choices=["base", "upside", "downside", "stress"])
    args = parser.parse_args()

    chosen = next(s for s in scenarios() if s.name == args.scenario)
    forecast = run(chosen)
    print(render(forecast))
    return 0 if forecast.balances else 1


if __name__ == "__main__":
    raise SystemExit(main())
