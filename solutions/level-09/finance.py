"""
finance.py — pure loan maths for the Level 9 Loan Advisor.

The one rule that makes this file worth having: it imports no UI library and
prints nothing. Every function takes arguments and returns a value, so it can
be unit-tested in milliseconds, reused behind an API tomorrow, and read by an
auditor who has never heard of Streamlit.
"""


def monthly_payment(principal, annual_rate, years, periods_per_year=12):
    """Equal payment that amortizes a loan to zero.

    payment = P * i / (1 - (1 + i)^-n)
    """
    if principal <= 0:
        raise ValueError("Loan amount must be greater than zero.")
    if annual_rate < 0:
        raise ValueError("Interest rate cannot be negative.")
    if years <= 0:
        raise ValueError("Term must be at least one year.")

    i = annual_rate / periods_per_year
    n = int(round(years * periods_per_year))
    if i == 0:
        return principal / n
    return principal * i / (1 - (1 + i) ** -n)


def schedule(principal, annual_rate, years, extra=0.0, periods_per_year=12, max_periods=1200):
    """List of dicts: month, payment, interest, principal, balance.

    Interest is charged on the current balance; the final payment is capped at
    whatever is left; the loop is bounded so a payment that cannot cover the
    interest raises instead of spinning forever.
    """
    if extra < 0:
        raise ValueError("Extra payment cannot be negative.")

    payment = monthly_payment(principal, annual_rate, years, periods_per_year)
    i = annual_rate / periods_per_year
    balance = principal
    rows = []
    month = 0

    while balance > 0.005 and month < max_periods:
        month += 1
        interest = balance * i
        principal_part = payment + extra - interest
        if principal_part <= 0:
            raise ValueError(
                "The monthly payment does not cover the interest, so this loan would never be repaid.")
        if principal_part > balance:
            principal_part = balance
        balance -= principal_part
        rows.append({
            "month": month,
            "payment": round(interest + principal_part, 2),
            "interest": round(interest, 2),
            "principal": round(principal_part, 2),
            "balance": round(max(balance, 0.0), 2),
        })

    return rows


def summarise(rows):
    """Totals and the crossover month, from a schedule."""
    if not rows:
        raise ValueError("Empty schedule.")
    total_paid = sum(r["payment"] for r in rows)
    total_interest = sum(r["interest"] for r in rows)
    crossover = next((r["month"] for r in rows if r["principal"] > r["interest"]), None)
    return {
        "months": len(rows),
        "years": round(len(rows) / 12, 1),
        "total_paid": round(total_paid, 2),
        "total_interest": round(total_interest, 2),
        "interest_share": total_interest / total_paid if total_paid else 0.0,
        "crossover_month": crossover,
        "first_principal_share": rows[0]["principal"] / rows[0]["payment"],
        "final_balance": rows[-1]["balance"],
    }


def compare_terms(principal, annual_rate, terms=(15, 25, 30)):
    """One row per term: payment, total paid, total interest."""
    out = []
    for years in terms:
        rows = schedule(principal, annual_rate, years)
        s = summarise(rows)
        out.append({"years": years, "payment": round(rows[0]["payment"], 2),
                    "total_paid": s["total_paid"], "total_interest": s["total_interest"]})
    return out


def overpayment_saving(principal, annual_rate, years, extra):
    """What an extra monthly amount removes, in interest and in months."""
    base = summarise(schedule(principal, annual_rate, years))
    fast = summarise(schedule(principal, annual_rate, years, extra=extra))
    return {
        "interest_saved": round(base["total_interest"] - fast["total_interest"], 2),
        "months_saved": base["months"] - fast["months"],
        "base": base,
        "fast": fast,
    }


def affordability(payment, other_debts, gross_monthly_income, loan=None, asset_value=None):
    """Debt-to-income with a band, plus loan-to-value when an asset is given.

    The 36% / 43% thresholds are common conventions, not law — documented here
    so nobody has to guess where they came from.
    """
    if gross_monthly_income <= 0:
        raise ValueError("Monthly income must be greater than zero.")
    if other_debts < 0:
        raise ValueError("Other debt payments cannot be negative.")

    ratio = (payment + other_debts) / gross_monthly_income
    band = "comfortable" if ratio < 0.36 else "stretched" if ratio < 0.43 else "high risk"
    result = {"dti": ratio, "band": band, "ltv": None}

    if loan is not None and asset_value:
        if asset_value <= 0:
            raise ValueError("Asset value must be greater than zero.")
        result["ltv"] = loan / asset_value
    return result


def invest_instead(extra, annual_return, years, periods_per_year=12):
    """Future value of investing the overpayment instead (the Level 2 annuity)."""
    if extra < 0:
        raise ValueError("Extra payment cannot be negative.")
    i = annual_return / periods_per_year
    n = int(round(years * periods_per_year))
    if i == 0:
        return extra * n
    return extra * (((1 + i) ** n - 1) / i)
