"""
neobank.lending: loan pricing and amortization (from levels 2 and 6).

Pure functions: they validate, compute, and return. Charts and tables are the
interface's job.
"""

import pandas as pd


def monthly_payment(principal, annual_rate, years, payments_per_year=12):
    """Equal payment that amortizes the loan to zero.

    payment = P * i / (1 - (1 + i)^-n), with every term per period.
    """
    if principal <= 0:
        raise ValueError("principal must be positive")
    if annual_rate < 0:
        raise ValueError("rate cannot be negative")
    if years <= 0:
        raise ValueError("term must be at least one period")

    i = annual_rate / payments_per_year
    n = int(years * payments_per_year)
    if i == 0:
        return principal / n                       # interest-free: just split it
    return principal * i / (1 - (1 + i) ** -n)


def schedule(principal, annual_rate, years, extra=0.0, payments_per_year=12, max_periods=1200):
    """month | payment | interest | principal | balance, as a DataFrame.

    Three details that separate a working schedule from a broken one:
      * interest is charged on the CURRENT balance, never the original amount
      * the final payment is capped at whatever is left, so it ends at 0.00
      * the loop is bounded, so a payment too small to cover interest cannot hang
    """
    if extra < 0:
        raise ValueError("extra payment cannot be negative")

    payment = monthly_payment(principal, annual_rate, years, payments_per_year)
    i = annual_rate / payments_per_year
    balance = principal
    rows = []
    month = 0

    while balance > 0.005 and month < max_periods:
        month += 1
        interest = balance * i
        principal_part = payment + extra - interest
        if principal_part <= 0:
            raise ValueError(
                f"a payment of {payment + extra:,.2f} cannot cover the {interest:,.2f} of monthly interest")
        if principal_part > balance:
            principal_part = balance               # the last payment is smaller
        balance -= principal_part
        rows.append({
            "month": month,
            "payment": round(interest + principal_part, 2),
            "interest": round(interest, 2),
            "principal": round(principal_part, 2),
            "balance": round(max(balance, 0.0), 2),
        })

    return pd.DataFrame(rows)


def summarise(df):
    """Totals plus the crossover: the month principal finally overtakes interest."""
    crossing = df[df["principal"] > df["interest"]]
    return {
        "months": len(df),
        "total_paid": round(df["payment"].sum(), 2),
        "total_interest": round(df["interest"].sum(), 2),
        "interest_share": df["interest"].sum() / df["payment"].sum(),
        "crossover_month": int(crossing.iloc[0]["month"]) if len(crossing) else None,
        "first_principal_share": df.iloc[0]["principal"] / df.iloc[0]["payment"],
        "final_balance": df.iloc[-1]["balance"],
    }


def present_value(payment, annual_rate, years, payments_per_year=12):
    i = annual_rate / payments_per_year
    n = int(years * payments_per_year)
    if i == 0:
        return payment * n
    return payment * (1 - (1 + i) ** -n) / i


def true_apr(principal, fees, annual_rate, years, iterations=80):
    """The APR once fees are deducted from the advance. Found by bisection:
    there is no closed-form solution for the rate.
    """
    payment = monthly_payment(principal, annual_rate, years)
    received = principal - fees
    if received <= 0:
        raise ValueError("fees cannot exceed the principal")

    low, high = 0.0, 1.0
    for _ in range(iterations):
        mid = (low + high) / 2
        if present_value(payment, mid, years) > received:
            low = mid                              # rate too low: payments look too valuable
        else:
            high = mid
    return low


# ---------------------------------------------------------------------------
# Affordability
# ---------------------------------------------------------------------------
def dti(monthly_debt_payments, gross_monthly_income):
    if gross_monthly_income <= 0:
        raise ValueError("income must be positive")
    return monthly_debt_payments / gross_monthly_income


def ltv(loan_amount, asset_value):
    if asset_value <= 0:
        raise ValueError("asset value must be positive")
    return loan_amount / asset_value


def assess(payment, other_debts, income, loan, value):
    """Bands are conventions, not law: 36% and 43% are the common US thresholds."""
    ratio = dti(payment + other_debts, income)
    band = "comfortable" if ratio < 0.36 else "stretched" if ratio < 0.43 else "high risk"
    return {"dti": ratio, "band": band, "ltv": ltv(loan, value)}

def compare_terms(principal, annual_rate, terms=(15, 25, 30)):
    """One row per term. Returns a DataFrame; the caller decides how to show it."""
    rows = []
    for years in terms:
        df = schedule(principal, annual_rate, years)
        s = summarise(df)
        rows.append({"years": years,
                     "payment": round(df["payment"].iloc[0], 2),
                     "total_paid": s["total_paid"],
                     "total_interest": s["total_interest"]})
    return pd.DataFrame(rows)


def overpayment_saving(principal, annual_rate, years, extra):
    """What an extra monthly amount removes, in interest and in months."""
    base = summarise(schedule(principal, annual_rate, years))
    fast = summarise(schedule(principal, annual_rate, years, extra=extra))
    return {"interest_saved": round(base["total_interest"] - fast["total_interest"], 2),
            "months_saved": base["months"] - fast["months"],
            "base": base, "fast": fast}
