"""Why the revenue variance happened: how much was volume, how much was price.

One function, because the arithmetic is three lines and the care is in the
convention. The rule used here, and it has to be written down somewhere or it
will quietly change between months:

    volume effect = (actual volume - plan volume) x plan rate
    rate effect   = (actual rate   - plan rate)   x actual volume

The cross term, the part where the extra volume also came at the lower rate,
lands inside the rate effect because the rate difference is valued at actual
volume. Any consistent convention works. Two conventions in two months is how a
bridge stops meaning anything.

The two effects are also checked against the variance the ledger reports, and
the difference is returned rather than hidden: the ledger rounds each posting to
the cent and this multiplies two rounded rates, so a dollar of rounding is
normal and a thousand is a bug.
"""

from __future__ import annotations

import pandas as pd


def price_volume(history: pd.DataFrame, plan: pd.DataFrame, month: str,
                 actuals: pd.DataFrame, budget: pd.DataFrame) -> dict:
    row = history.loc[history["month"] == month]
    planned = plan.loc[plan["month"] == month]
    if row.empty or planned.empty:
        return {}

    volume_actual = float(row["payment_volume"].iloc[0])
    volume_plan = float(planned["payment_volume"].iloc[0])
    rate_actual = float(row["revenue_transaction"].iloc[0]) / volume_actual
    rate_plan = float(planned["take_rate"].iloc[0])

    volume_effect = (volume_actual - volume_plan) * rate_plan
    rate_effect = (rate_actual - rate_plan) * volume_actual

    reported = (float(actuals.loc[(actuals["month"] == month)
                                  & (actuals["account_code"] == "4000"), "value"].sum())
                - float(budget.loc[(budget["month"] == month)
                                   & (budget["account_code"] == "4000"), "budget_amount"].sum()))

    return {
        "volume_actual": volume_actual, "volume_plan": volume_plan,
        "rate_actual": rate_actual, "rate_plan": rate_plan,
        "volume_effect": volume_effect, "rate_effect": rate_effect,
        "sum": volume_effect + rate_effect,
        "reported": reported,
        "rounding": (volume_effect + rate_effect) - reported,
    }
