"""
neobank.analytics: spending analysis (from level 3).

Every function takes a DataFrame and returns data. No file reading (that is
loaders.py), no printing (that is the interface).
"""

NON_SPEND_CATEGORIES = {"savings"}          # moving money to yourself is not spending
FIXED_CATEGORIES = {"housing", "utilities", "savings"}


def outgoing(df):
    return df[df["amount"] < 0].copy()


def headline_numbers(df):
    """Income is a category, not a sign: refunds are positive and are not income."""
    spend = outgoing(df)
    income = df[df["category"] == "income"]["amount"].sum()
    spending = spend[~spend["category"].isin(NON_SPEND_CATEGORIES)]["abs_amount"].sum()
    saved = income - spending
    return {
        "income": float(income),
        "spend": float(spending),
        "net_cash_flow": float(df["amount"].sum()),
        "saved": float(saved),
        "savings_rate": float(saved / income) if income else 0.0,
        "transferred_to_savings": float(
            spend[spend["category"] == "savings"]["abs_amount"].sum()),
    }


def savings_rate(df):
    return headline_numbers(df)["savings_rate"]


def by_category(df, exclude_savings=False):
    spend = outgoing(df)
    if exclude_savings:
        spend = spend[~spend["category"].isin(NON_SPEND_CATEGORIES)]
    return spend.groupby("category")["abs_amount"].sum().sort_values(ascending=False)


def by_month(df):
    spend = outgoing(df)
    spend = spend[~spend["category"].isin(NON_SPEND_CATEGORIES)]
    import pandas as pd
    out = pd.DataFrame({
        "spend": spend.groupby("month")["abs_amount"].sum(),
        "income": df[df["category"] == "income"].groupby("month")["amount"].sum(),
    }).fillna(0)
    out["net"] = out["income"] - out["spend"]
    return out.round(2)


def top_merchants(df, n=10):
    return (outgoing(df).groupby("description")["abs_amount"].sum()
            .sort_values(ascending=False).head(n))


def find_recurring(df, min_times=3):
    """Same merchant, same amount, repeatedly: split into cancellable and fixed."""
    spend = outgoing(df)
    counts = (spend.groupby(["description", "abs_amount"]).size()
              .reset_index(name="times"))
    recurring = counts[counts["times"] >= min_times].copy()
    category = spend.drop_duplicates("description").set_index("description")["category"]
    recurring["category"] = recurring["description"].map(category)
    recurring["cancellable"] = ~recurring["category"].isin(FIXED_CATEGORIES)
    recurring["yearly_cost"] = (recurring["abs_amount"] * 12).round(2)
    return recurring.sort_values("abs_amount", ascending=False).reset_index(drop=True)


def weekday_pattern(df):
    order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    spend = outgoing(df)
    spend = spend[~spend["category"].isin(NON_SPEND_CATEGORIES)]
    return spend.groupby("weekday")["abs_amount"].sum().reindex(order).fillna(0)
