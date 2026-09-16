"""
FinQuest level 2: Compound growth engine  (reference solution)
===============================================================
Everything here uses only level 2 material: arithmetic with **, functions with
default arguments, for/while loops, if statements, and f-string formatting.
No libraries, no file access, no classes.

Run:  python compound_growth.py
"""


# ---------------------------------------------------------------------------
# Core formulas
# ---------------------------------------------------------------------------
def future_value(principal, annual_rate, years, compounds_per_year=12):
    """Future value of a lump sum:  FV = P(1 + r/n)^(nt)

    >>> round(future_value(1000, 0.08, 10, 1), 2)
    2158.92
    """
    i = annual_rate / compounds_per_year        # rate per period
    n = compounds_per_year * years              # number of periods
    return principal * (1 + i) ** n


def contributions_value(payment, annual_rate, years, compounds_per_year=12):
    """Future value of equal end-of-period payments (an annuity).

    The zero-rate case is not just an edge case to avoid a crash: with no
    interest the answer really is "the deposits you made".
    """
    i = annual_rate / compounds_per_year
    n = compounds_per_year * years
    if i == 0:
        return payment * n
    return payment * (((1 + i) ** n - 1) / i)


def plan_value(principal, payment, annual_rate, years, compounds_per_year=12):
    """A starting balance plus regular contributions."""
    return (future_value(principal, annual_rate, years, compounds_per_year)
            + contributions_value(payment, annual_rate, years, compounds_per_year))


def apy(apr, compounds_per_year):
    """Effective annual yield from a nominal APR: (1 + APR/n)^n - 1"""
    return (1 + apr / compounds_per_year) ** compounds_per_year - 1


def real_value(amount, inflation, years):
    """What a future amount buys in today's money."""
    return amount / (1 + inflation) ** years


# ---------------------------------------------------------------------------
# Reports
# ---------------------------------------------------------------------------
def growth_table(principal, payment, annual_rate, years):
    """Year-by-year balance, deposits, and the interest doing the work."""
    print(f"{'Year':<6}{'Balance':>15}{'Deposited':>15}{'Interest':>15}")
    print("-" * 51)
    for year in range(1, years + 1):
        balance = plan_value(principal, payment, annual_rate, year)
        deposited = principal + payment * 12 * year
        interest = balance - deposited
        print(f"{year:<6}{balance:>15,.2f}{deposited:>15,.2f}{interest:>15,.2f}")


def years_to_target(principal, payment, annual_rate, target, max_years=100):
    """First whole year the balance reaches target, or None if unreachable.

    The bound matters: at a 0% rate with no contributions the target is never
    reached, and an unbounded loop would hang the caller forever.
    """
    for year in range(1, max_years + 1):
        if plan_value(principal, payment, annual_rate, year) >= target:
            return year
    return None


def summary(principal, payment, annual_rate, years, target, inflation=0.03):
    """The whole report, for one scenario."""
    final = plan_value(principal, payment, annual_rate, years)
    deposited = principal + payment * 12 * years
    interest = final - deposited
    hit = years_to_target(principal, payment, annual_rate, target)

    print("=" * 51)
    print(f"{'Savings plan':^51}")
    print("=" * 51)
    print(f"{'Starting balance':<28}{principal:>23,.2f}")
    print(f"{'Monthly contribution':<28}{payment:>23,.2f}")
    print(f"{'Annual rate':<28}{annual_rate:>23.2%}")
    print(f"{'Horizon':<28}{str(years) + ' years':>23}")
    print("-" * 51)
    print(f"{'Final balance':<28}{final:>23,.2f}")
    print(f"{'  of which deposited':<28}{deposited:>23,.2f}")
    print(f"{'  of which interest':<28}{interest:>23,.2f}")
    print(f"{'Interest share':<28}{interest / final:>23.1%}")
    print("-" * 51)
    if hit is None:
        print(f"{'Goal ' + f'{target:,.0f}':<28}{'not reachable in 100 years':>23}")
    else:
        print(f"{'Goal ' + f'{target:,.0f}':<28}{'reached in year ' + str(hit):>23}")
    print(f"{'Final value in today money':<28}{real_value(final, inflation, years):>23,.2f}")
    print(f"{'(inflation assumed)':<28}{inflation:>23.2%}")
    print()
    growth_table(principal, payment, annual_rate, years)
    print()


# ---------------------------------------------------------------------------
# Self-checks: the numbers from the project brief
# ---------------------------------------------------------------------------
def self_test():
    assert round(future_value(1000, 0.08, 10, 1), 2) == 2158.92
    assert round(future_value(1000, 0.08, 10, 12), 2) == 2219.64
    assert contributions_value(200, 0.0, 10, 12) == 24000          # no crash, exact
    assert round(contributions_value(200, 0.07, 20, 12), 2) == 104185.33
    assert round(apy(0.24, 12), 4) == 0.2682
    assert years_to_target(2000, 200, 0.07, 50000) == 13
    assert years_to_target(100, 0, 0.0, 1_000_000) is None          # bounded, not hung
    assert round(real_value(1_000_000, 0.03, 40), 2) == 306556.84
    print("all self-checks passed\n")


if __name__ == "__main__":
    self_test()

    print(f"Credit card: 24.00% APR compounding monthly is really "
          f"{apy(0.24, 12):.2%} APY: {apy(0.24, 12) - 0.24:.2%} more than the headline.\n")

    # Three scenarios, same saver, different risk appetite.
    for label, rate in [("conservative", 0.04), ("balanced", 0.07), ("aggressive", 0.10)]:
        print(f"### {label.upper()}: {rate:.0%}")
        summary(principal=2000, payment=200, annual_rate=rate, years=20, target=50000)
