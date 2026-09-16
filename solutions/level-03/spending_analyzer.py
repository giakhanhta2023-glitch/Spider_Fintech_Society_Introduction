"""
FinQuest Level 3 — Personal Spending Analyzer  (reference solution)
===================================================================
Uses only Level 3 material: pandas read_csv, boolean masks, groupby,
sort_values, value_counts, the .dt accessor, matplotlib bar charts, and
f-string formatting.

Run:  python spending_analyzer.py
"""

from pathlib import Path

import pandas as pd
import matplotlib

matplotlib.use("Agg")           # save charts to file instead of opening a window
import matplotlib.pyplot as plt  # noqa: E402

URL = ("https://raw.githubusercontent.com/giakhanhta2023-glitch/"
       "Spider_Fintech_Society_Introduction/main/data/level-03-transactions.csv")

# Transfers to your own savings are not spending — the money is still yours.
NON_SPEND_CATEGORIES = {"savings"}
# Recurring charges you cannot simply cancel this month.
FIXED_CATEGORIES = {"housing", "utilities", "savings"}


# ---------------------------------------------------------------------------
# Load
# ---------------------------------------------------------------------------
def load_data(url=URL):
    """Read the CSV and add the helper columns the rest of the file needs.

    Falls back to the copy in this repository so the solution also runs with
    no network — the same three-layer thinking Level 5 formalises.
    """
    try:
        df = pd.read_csv(url, parse_dates=["date"])
    except Exception:
        local = Path(__file__).resolve().parents[2] / "data" / "level-03-transactions.csv"
        print(f"(network unavailable — reading {local.name} from the repo)")
        df = pd.read_csv(local, parse_dates=["date"])
    df["abs_amount"] = df["amount"].abs()
    df["month"] = df["date"].dt.to_period("M")
    df["weekday"] = df["date"].dt.day_name()
    return df


def outgoing(df):
    """Money-out rows only. .copy() so later columns do not warn."""
    return df[df["amount"] < 0].copy()


# ---------------------------------------------------------------------------
# Headline numbers
# ---------------------------------------------------------------------------
def headline_numbers(df):
    """Income is a CATEGORY, not a sign — refunds are positive but not income."""
    spend = outgoing(df)
    income = df[df["category"] == "income"]["amount"].sum()
    spending = spend[~spend["category"].isin(NON_SPEND_CATEGORIES)]["abs_amount"].sum()
    saved = income - spending
    return {
        "income": income,
        "spend": spending,
        "net_cash_flow": df["amount"].sum(),
        "saved": saved,
        "savings_rate": saved / income if income else 0.0,
        "transferred_to_savings": spend[spend["category"] == "savings"]["abs_amount"].sum(),
    }


def by_category(df, exclude_savings=False):
    spend = outgoing(df)
    if exclude_savings:
        spend = spend[~spend["category"].isin(NON_SPEND_CATEGORIES)]
    return spend.groupby("category")["abs_amount"].sum().sort_values(ascending=False)


def by_month(df):
    """Spend and income side by side, per month."""
    spend = outgoing(df)
    spend = spend[~spend["category"].isin(NON_SPEND_CATEGORIES)]
    out = pd.DataFrame({
        "spend": spend.groupby("month")["abs_amount"].sum(),
        "income": df[df["category"] == "income"].groupby("month")["amount"].sum(),
    }).fillna(0)
    out["net"] = out["income"] - out["spend"]
    return out.round(2)


def top_merchants(df, n=10):
    spend = outgoing(df)
    return spend.groupby("description")["abs_amount"].sum().sort_values(ascending=False).head(n)


def weekday_pattern(df):
    order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    spend = outgoing(df)
    spend = spend[~spend["category"].isin(NON_SPEND_CATEGORIES)]
    return spend.groupby("weekday")["abs_amount"].sum().reindex(order).fillna(0)


# ---------------------------------------------------------------------------
# Recurring charges
# ---------------------------------------------------------------------------
def find_recurring(df, min_times=3):
    """Same merchant, same amount, at least min_times — with a cancellable flag.

    Rent and the savings transfer are perfectly recurring too, so the report
    has to separate "you could cancel this" from "you are committed to this".
    """
    spend = outgoing(df)
    counts = (spend.groupby(["description", "abs_amount"])
                   .size()
                   .reset_index(name="times"))
    recurring = counts[counts["times"] >= min_times].copy()

    category = spend.drop_duplicates("description").set_index("description")["category"]
    recurring["category"] = recurring["description"].map(category)
    recurring["cancellable"] = ~recurring["category"].isin(FIXED_CATEGORIES)
    recurring["yearly_cost"] = (recurring["abs_amount"] * 12).round(2)
    return recurring.sort_values("abs_amount", ascending=False).reset_index(drop=True)


# ---------------------------------------------------------------------------
# Chart
# ---------------------------------------------------------------------------
def plot_categories(df, path=None):
    path = path or Path(__file__).with_name("spending-by-category.png")
    """Sorted horizontal bars. Savings transfers excluded on purpose."""
    chart = by_category(df, exclude_savings=True).sort_values()
    ax = chart.plot(kind="barh", figsize=(8, 4.5), color="#2ee6a8")
    ax.set_title("Spending by category — Mar to Aug 2025 (savings transfers excluded)")
    ax.set_xlabel("USD")
    ax.set_ylabel("")
    plt.tight_layout()
    plt.savefig(path, dpi=150)
    plt.close()
    return path


# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------
def report(df):
    n = headline_numbers(df)
    width = 58

    print("=" * width)
    print(f"{'SIX-MONTH MONEY REPORT':^{width}}")
    print(f"{str(df['date'].min().date()) + '  to  ' + str(df['date'].max().date()):^{width}}")
    print("=" * width)
    print(f"{'Income':<30}{n['income']:>28,.2f}")
    print(f"{'Spending (excl. savings)':<30}{n['spend']:>28,.2f}")
    print(f"{'Moved to savings':<30}{n['transferred_to_savings']:>28,.2f}")
    print(f"{'Net cash flow':<30}{n['net_cash_flow']:>28,.2f}")
    print(f"{'Savings rate':<30}{n['savings_rate']:>28.1%}")

    print("\n" + "-" * width)
    print("SPENDING BY CATEGORY")
    for name, value in by_category(df).items():
        share = value / by_category(df).sum()
        print(f"  {name:<26}{value:>14,.2f}{share:>12.1%}")

    print("\n" + "-" * width)
    print("MONTH BY MONTH")
    monthly = by_month(df)
    print(f"  {'month':<10}{'income':>14}{'spend':>14}{'net':>14}")
    for month, row in monthly.iterrows():
        flag = "  <-- overspent" if row["net"] < 0 else ""
        print(f"  {str(month):<10}{row['income']:>14,.2f}{row['spend']:>14,.2f}{row['net']:>14,.2f}{flag}")

    print("\n" + "-" * width)
    print("TOP MERCHANTS")
    for name, value in top_merchants(df, 8).items():
        print(f"  {name:<30}{value:>14,.2f}")

    print("\n" + "-" * width)
    print("RECURRING CHARGES")
    rec = find_recurring(df)
    subs = rec[rec["cancellable"]]
    fixed = rec[~rec["cancellable"]]
    print("  Cancellable subscriptions")
    for _, r in subs.iterrows():
        print(f"    {r['description']:<24}{r['abs_amount']:>9,.2f} x{int(r['times'])}"
              f"{r['yearly_cost']:>12,.2f}/yr")
    print(f"    {'TOTAL':<24}{subs['abs_amount'].sum():>9,.2f}/mo"
          f"{subs['yearly_cost'].sum():>15,.2f}/yr")
    print("  Fixed commitments")
    for _, r in fixed.iterrows():
        print(f"    {r['description']:<24}{r['abs_amount']:>9,.2f} x{int(r['times'])}")

    print("\n" + "-" * width)
    print("SPEND BY DAY OF WEEK")
    week = weekday_pattern(df)
    for day, value in week.items():
        bar = "#" * int(value / 60)
        print(f"  {day:<11}{value:>10,.2f}  {bar}")
    print(f"\n  Heaviest day: {week.idxmax()} ({week.max():,.2f})")
    print("=" * width)


def findings(df):
    """Three findings, each with the number behind it and something to do."""
    n = headline_numbers(df)
    rec = find_recurring(df)
    subs = rec[rec["cancellable"]]
    cats = by_category(df, exclude_savings=True)

    print("\nFINDINGS")
    print(f"1. The savings rate is {n['savings_rate']:.1%} — healthy, but only "
          f"${n['transferred_to_savings']:,.0f} of the ${n['saved']:,.0f} kept back actually reached the "
          f"savings account. Automate a transfer for the rest so it is not spent by accident.")
    print(f"2. Subscriptions run ${subs['abs_amount'].sum():,.2f} a month "
          f"(${subs['yearly_cost'].sum():,.2f} a year) across {len(subs)} services. CLOUDSTREAM TV alone is "
          f"$191.88 a year — cancel it if nobody can say what was last watched on it.")
    print(f"3. {cats.index[0].title()} is the largest controllable category at ${cats.iloc[0]:,.2f} "
          f"({cats.iloc[0] / cats.sum():.1%} of spending). A 20% trim there is worth more than cancelling "
          f"every subscription combined.")


# ---------------------------------------------------------------------------
# Self-checks — the numbers from the project brief
# ---------------------------------------------------------------------------
def tests(df):
    assert df.shape[0] == 233

    n = headline_numbers(df)
    assert round(n["income"], 2) == 20100.00            # refunds excluded
    assert round(n["spend"], 2) == 13358.30             # savings transfers excluded
    assert round(n["net_cash_flow"], 2) == 5072.74
    assert round(n["savings_rate"] * 100, 1) == 33.5

    cats = by_category(df)
    assert cats.index[0] == "housing" and round(cats.iloc[0], 2) == 6900.00
    assert round(cats["subscriptions"], 2) == 461.76

    rec = find_recurring(df)
    assert len(rec) == 8
    subs = rec[rec["cancellable"]]
    assert len(subs) == 5
    assert round(subs["abs_amount"].sum(), 2) == 76.96
    cloud = rec[rec["description"] == "CLOUDSTREAM TV"].iloc[0]
    assert round(cloud["yearly_cost"], 2) == 191.88

    assert len(by_month(df)) == 6
    assert round(weekday_pattern(df).sum(), 2) == round(n["spend"], 2)

    print("all self-checks passed")
    print()


if __name__ == "__main__":
    data = load_data()
    tests(data)
    print(f"loaded {data.shape[0]} rows x {data.shape[1] - 3} original columns\n")
    report(data)
    findings(data)
    print(f"\nchart written to {plot_categories(data)}")
