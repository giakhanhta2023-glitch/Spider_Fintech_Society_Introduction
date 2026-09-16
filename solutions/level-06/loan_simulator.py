"""
FinQuest Level 6 — Loan Amortization & Early-Payoff Simulator  (reference solution)
===================================================================================
Uses only Levels 2, 3 and 6: the payment formula, a bounded while loop,
pandas DataFrames, matplotlib, bisection, and f-string formatting.

Run:  python loan_simulator.py
"""

from pathlib import Path

import matplotlib
import pandas as pd

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402


# ---------------------------------------------------------------------------
# Core
# ---------------------------------------------------------------------------
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
    """Totals plus the crossover — the month principal finally overtakes interest."""
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
    """Bands are conventions, not law — 36% and 43% are the common US thresholds."""
    ratio = dti(payment + other_debts, income)
    band = "comfortable" if ratio < 0.36 else "stretched" if ratio < 0.43 else "high risk"
    return {"dti": ratio, "band": band, "ltv": ltv(loan, value)}


# ---------------------------------------------------------------------------
# Comparisons
# ---------------------------------------------------------------------------
def compare_terms(principal, annual_rate, terms=(15, 25, 30)):
    print(f"{'term':<10}{'monthly':>14}{'total paid':>16}{'total interest':>18}")
    print("-" * 58)
    out = {}
    for years in terms:
        df = schedule(principal, annual_rate, years)
        s = summarise(df)
        out[years] = s
        print(f"{str(years) + ' yrs':<10}{df['payment'].iloc[0]:>14,.2f}"
              f"{s['total_paid']:>16,.2f}{s['total_interest']:>18,.2f}")
    return out


def compare_overpayment(principal, annual_rate, years, extra):
    base = schedule(principal, annual_rate, years)
    fast = schedule(principal, annual_rate, years, extra=extra)
    saved_interest = base["interest"].sum() - fast["interest"].sum()
    saved_months = len(base) - len(fast)

    print(f"{'':<24}{'standard':>16}{'+ ' + format(extra, ',.0f') + '/mo':>16}")
    print("-" * 56)
    print(f"{'monthly payment':<24}{base['payment'].iloc[0]:>16,.2f}{fast['payment'].iloc[0]:>16,.2f}")
    print(f"{'months to clear':<24}{len(base):>16}{len(fast):>16}")
    print(f"{'total interest':<24}{base['interest'].sum():>16,.2f}{fast['interest'].sum():>16,.2f}")
    print(f"{'interest saved':<24}{'':>16}{saved_interest:>16,.2f}")
    print(f"{'time saved':<24}{'':>16}{str(saved_months // 12) + 'y ' + str(saved_months % 12) + 'm':>16}")
    return {"saved_interest": saved_interest, "saved_months": saved_months,
            "base": base, "fast": fast}


def invest_instead(extra, invest_rate, years, loan_rate):
    """Overpaying earns a guaranteed return equal to the loan rate. Investing
    may earn more — with uncertainty and less access to the cash.
    """
    months = int(years * 12)
    i = invest_rate / 12
    future = extra * (((1 + i) ** months - 1) / i) if i else extra * months
    deposited = extra * months
    print(f"{'invested at ' + format(invest_rate, '.1%'):<30}{future:>18,.2f}")
    print(f"{'  of which deposits':<30}{deposited:>18,.2f}")
    print(f"{'  of which growth':<30}{future - deposited:>18,.2f}")
    verdict = ("investing wins on expected value" if invest_rate > loan_rate
               else "overpaying wins, and it is the certain option")
    print(f"\nLoan rate {loan_rate:.2%} vs assumed return {invest_rate:.2%} — {verdict}.")
    print("The honest caveat: the loan return is guaranteed and the market return is not,")
    print("and money inside a mortgage is much harder to reach in an emergency.")
    return future


# ---------------------------------------------------------------------------
# Charts
# ---------------------------------------------------------------------------
def plot_split(df, path=None):
    path = path or Path(__file__).with_name("payment-split.png")
    s = summarise(df)
    fig, ax = plt.subplots(figsize=(9, 4))
    ax.plot(df["month"], df["interest"], label="interest", color="#e5484d")
    ax.plot(df["month"], df["principal"], label="principal", color="#46a758")
    if s["crossover_month"]:
        ax.axvline(s["crossover_month"], linestyle="--", color="#8b7cff", linewidth=1)
        ax.annotate(f"crossover: month {s['crossover_month']}",
                    xy=(s["crossover_month"], df["payment"].iloc[0] * 0.55),
                    xytext=(8, 0), textcoords="offset points", color="#8b7cff", fontsize=9)
    ax.set_title("Where each payment goes")
    ax.set_xlabel("month")
    ax.set_ylabel("USD")
    ax.legend()
    plt.tight_layout()
    plt.savefig(path, dpi=150)
    plt.close()
    return path


def plot_balances(principal, annual_rate, years, extra, path=None):
    path = path or Path(__file__).with_name("balances.png")
    base = schedule(principal, annual_rate, years)
    fast = schedule(principal, annual_rate, years, extra=extra)
    fig, ax = plt.subplots(figsize=(9, 4))
    ax.plot(base["month"], base["balance"], label="standard", color="#0090ff")
    ax.plot(fast["month"], fast["balance"], label=f"+{extra:,.0f}/month", color="#46a758")
    ax.set_title("Outstanding balance")
    ax.set_xlabel("month")
    ax.set_ylabel("USD")
    ax.legend()
    plt.tight_layout()
    plt.savefig(path, dpi=150)
    plt.close()
    return path


# ---------------------------------------------------------------------------
def report(principal=250_000, annual_rate=0.055, years=30, extra=200, fees=400,
           income=6000, other_debts=250, value=312_500):
    df = schedule(principal, annual_rate, years)
    s = summarise(df)
    payment = df["payment"].iloc[0]

    print("=" * 58)
    print(f"{'LOAN ADVISOR':^58}")
    print("=" * 58)
    print(f"{'Amount borrowed':<28}{principal:>30,.2f}")
    print(f"{'Interest rate':<28}{annual_rate:>30.2%}")
    print(f"{'Term':<28}{str(years) + ' years':>30}")
    print("-" * 58)
    print(f"{'Monthly payment':<28}{payment:>30,.2f}")
    print(f"{'Total repaid':<28}{s['total_paid']:>30,.2f}")
    print(f"{'Total interest':<28}{s['total_interest']:>30,.2f}")
    print(f"{'Interest as % of repayments':<28}{s['interest_share']:>30.1%}")
    print(f"{'Month 1 goes to debt':<28}{s['first_principal_share']:>30.1%}")
    print(f"{'Principal overtakes interest':<28}{'month ' + str(s['crossover_month']):>30}")
    print(f"{'Final balance':<28}{s['final_balance']:>30,.2f}")

    print("\n" + "-" * 58)
    print("TERM COMPARISON")
    compare_terms(principal, annual_rate)

    print("\n" + "-" * 58)
    print("OVERPAYMENT")
    over = compare_overpayment(principal, annual_rate, years, extra)

    print("\n" + "-" * 58)
    print("OVERPAY OR INVEST?")
    invest_instead(extra, 0.07, years, annual_rate)

    print("\n" + "-" * 58)
    print("COST OF FEES")
    apr = true_apr(20_000, fees, 0.07, 5)
    print(f"A $20,000 loan at 7.00% with a ${fees:,.0f} fee has a true APR of {apr:.2%}")

    print("\n" + "-" * 58)
    print("AFFORDABILITY")
    a = assess(payment, other_debts, income, principal, value)
    print(f"{'DTI':<28}{a['dti']:>24.1%}  {a['band']}")
    print(f"{'LTV':<28}{a['ltv']:>24.1%}")
    print("=" * 58)

    print(f"\ncharts: {plot_split(df)}, {plot_balances(principal, annual_rate, years, extra)}")


# ---------------------------------------------------------------------------
def tests():
    assert round(monthly_payment(20_000, 0.07, 5), 2) == 396.02
    assert round(monthly_payment(250_000, 0.055, 30), 2) == 1419.47
    assert round(monthly_payment(12_000, 0.0, 4), 2) == 250.00

    car = schedule(20_000, 0.07, 5)
    assert len(car) == 60
    assert car["balance"].iloc[-1] == 0.0

    home = schedule(250_000, 0.055, 30)
    assert len(home) == 360
    assert home["balance"].iloc[-1] == 0.0
    assert abs(home["interest"].sum() - 261_010) < 5
    assert home["interest"].iloc[0] == 1145.83
    assert home["principal"].iloc[0] == 273.64
    assert summarise(home)["crossover_month"] == 210

    fast = schedule(250_000, 0.055, 30, extra=200)
    assert len(fast) == 269
    assert abs(fast["interest"].sum() - 185_394) < 5
    assert len(home) - len(fast) == 91

    assert round(true_apr(20_000, 400, 0.07, 5), 4) == 0.0785
    assert dti(1250, 4000) == 0.3125
    assert ltv(200_000, 250_000) == 0.80

    for bad in [lambda: monthly_payment(-1000, 0.05, 10),
                lambda: monthly_payment(1000, 0.05, 0),
                lambda: monthly_payment(1000, -0.01, 10),
                lambda: schedule(1000, 0.05, 10, extra=-50),
                lambda: dti(100, 0),
                lambda: ltv(100, 0)]:
        try:
            bad()
        except ValueError:
            pass
        else:
            raise AssertionError("expected a ValueError")

    print("all self-checks passed\n")


if __name__ == "__main__":
    tests()
    report()
