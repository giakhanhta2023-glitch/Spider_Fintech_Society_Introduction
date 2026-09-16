"""
FinQuest level 7: Portfolio risk dashboard  (reference solution)
=================================================================
Returns, volatility, Sharpe, drawdown, correlation, VaR and expected
shortfall over three years of daily prices for four fictional assets.

Run:  python risk_dashboard.py
"""

from pathlib import Path

import matplotlib
import numpy as np
import pandas as pd

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

URL = ("https://raw.githubusercontent.com/giakhanhta2023-glitch/"
       "Spider_Fintech_Society_Introduction/main/data/level-07-prices.csv")
LOCAL = Path(__file__).resolve().parents[2] / "data" / "level-07-prices.csv"

TRADING_DAYS = 252
RISK_FREE = 0.03          # stated, because a Sharpe ratio is meaningless without it

WEIGHTINGS = {
    "equal weight":    {"TECHX": 0.25, "BANKCO": 0.25, "GOLDF": 0.25, "CRYPTOZ": 0.25},
    "no crypto":       {"TECHX": 0.40, "BANKCO": 0.30, "GOLDF": 0.30, "CRYPTOZ": 0.00},
    "defensive tilt":  {"TECHX": 0.25, "BANKCO": 0.25, "GOLDF": 0.40, "CRYPTOZ": 0.10},
}


# ---------------------------------------------------------------------------
def load_prices(url=URL):
    try:
        prices = pd.read_csv(url, parse_dates=["date"])
    except Exception:
        print(f"(network unavailable: reading {LOCAL.name} from the repo)")
        prices = pd.read_csv(LOCAL, parse_dates=["date"])
    prices = prices.set_index("date").sort_index()
    if prices.isna().any().any():
        raise ValueError("price file contains gaps: fill or drop them before analysing")
    return prices


def compute_returns(prices):
    """Daily simple returns. The first row has no previous price, so it goes."""
    return prices.pct_change().dropna()


def annualize(returns, trading_days=TRADING_DAYS):
    """(annual mean return, annual volatility).

    Volatility scales with the square root of time: variance is what adds.
    """
    ann_return = (1 + returns.mean()) ** trading_days - 1
    ann_vol = returns.std() * np.sqrt(trading_days)
    return ann_return, ann_vol


def cagr(prices, trading_days=TRADING_DAYS):
    """What you actually earned, compounded. Always lower than the arithmetic
    mean when returns are volatile. That gap is volatility drag.
    """
    years = (len(prices) - 1) / trading_days
    total = prices.iloc[-1] / prices.iloc[0] - 1
    return (1 + total) ** (1 / years) - 1


def sharpe(ann_return, ann_vol, risk_free=RISK_FREE):
    return (ann_return - risk_free) / ann_vol


def drawdown_series(returns_series):
    """Fall from the running peak, as a negative fraction."""
    curve = (1 + returns_series).cumprod()
    peak = curve.cummax()
    return curve / peak - 1


def max_drawdown(returns_series):
    return drawdown_series(returns_series).min()


# ---------------------------------------------------------------------------
def asset_table(prices):
    returns = compute_returns(prices)
    ann_return, ann_vol = annualize(returns)
    table = pd.DataFrame({
        "total": prices.iloc[-1] / prices.iloc[0] - 1,
        "ann_mean": ann_return,
        "cagr": cagr(prices),
        "vol": ann_vol,
        "sharpe": sharpe(ann_return, ann_vol),
        "max_dd": returns.apply(max_drawdown),
    })
    table["drag"] = table["ann_mean"] - table["cagr"]
    return table.sort_values("sharpe", ascending=False)


def correlation_matrix(returns):
    return returns.corr().round(2)


def portfolio_returns(returns, weights):
    """Weighted daily returns. The assert is not decoration: weights summing to
    0.9 would silently scale every number in the report down by 10%.
    """
    series = pd.Series(weights, dtype=float).reindex(returns.columns).fillna(0.0)
    assert abs(series.sum() - 1) < 1e-9, f"weights must sum to 1.0, got {series.sum():.4f}"
    return returns.dot(series)


def portfolio_stats(returns, weights, label="portfolio"):
    pr = portfolio_returns(returns, weights)
    ann_return, ann_vol = annualize(pr)
    var95 = pr.quantile(0.05)
    var99 = pr.quantile(0.01)
    return {
        "label": label,
        "ann_return": ann_return,
        "vol": ann_vol,
        "sharpe": sharpe(ann_return, ann_vol),
        "max_dd": max_drawdown(pr),
        "var95": var95,
        "var99": var99,
        "shortfall95": pr[pr <= var95].mean(),      # the tail VaR refuses to describe
        "best_day": pr.max(),
        "worst_day": pr.min(),
    }


def diversification_check(returns, weights):
    """Portfolio volatility against the weighted average of the parts."""
    series = pd.Series(weights, dtype=float).reindex(returns.columns).fillna(0.0)
    _, ann_vol = annualize(returns)
    weighted_avg = float((series * ann_vol).sum())
    actual = portfolio_stats(returns, weights)["vol"]
    return {"weighted_average_vol": weighted_avg, "portfolio_vol": actual,
            "benefit": weighted_avg - actual}


# ---------------------------------------------------------------------------
def plot_dashboard(returns, path=None):
    path = path or Path(__file__).with_name("risk-dashboard.png")
    curve = (1 + returns).cumprod()
    dd = returns.apply(drawdown_series)

    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(10, 7), sharex=True)
    curve.plot(ax=ax1)
    ax1.set_title("Growth of 1 unit, three years")
    ax1.set_ylabel("multiple of start")
    ax1.axhline(1, color="grey", linewidth=0.8)

    dd.plot(ax=ax2, legend=False)
    ax2.set_title("Drawdown from running peak")
    ax2.set_ylabel("drop")
    ax2.set_xlabel("date")
    ax2.axhline(0, color="grey", linewidth=0.8)

    plt.tight_layout()
    plt.savefig(path, dpi=150)
    plt.close()
    return path


def report():
    prices = load_prices()
    returns = compute_returns(prices)
    width = 92

    print("=" * width)
    print(f"{'Portfolio risk dashboard':^{width}}")
    print(f"{str(prices.index.min().date()) + '  to  ' + str(prices.index.max().date()) + f'   ({len(prices)} trading days)':^{width}}")
    print("=" * width)

    print("\nPer asset")
    table = asset_table(prices)
    print(f"{'asset':<10}{'total':>10}{'ann mean':>11}{'CAGR':>9}{'drag':>9}{'vol':>9}{'Sharpe':>9}{'max DD':>10}")
    print("-" * width)
    for name, r in table.iterrows():
        print(f"{name:<10}{r['total']:>10.1%}{r['ann_mean']:>11.1%}{r['cagr']:>9.1%}"
              f"{r['drag']:>9.1%}{r['vol']:>9.1%}{r['sharpe']:>9.2f}{r['max_dd']:>10.1%}")
    print(f"\nRisk-free rate assumed: {RISK_FREE:.1%}")

    worst = table["drag"].idxmax()
    print(f"Volatility drag is worst on {worst}: an annualized mean of {table.loc[worst, 'ann_mean']:.1%} "
          f"turns into {table.loc[worst, 'cagr']:.1%} actually compounded.")

    print("\n" + "-" * width)
    print("CORRELATION")
    print(correlation_matrix(returns).to_string())
    least = correlation_matrix(returns).apply(lambda c: c[c.index != c.name].abs().mean()).idxmin()
    print(f"\n{least} has the lowest average correlation. It is doing most of the diversifying.")

    print("\n" + "-" * width)
    print("Weightings compared")
    print(f"{'mix':<18}{'return':>10}{'vol':>10}{'Sharpe':>10}{'max DD':>10}{'VaR95':>10}{'ES95':>10}")
    print("-" * width)
    results = {}
    for label, weights in WEIGHTINGS.items():
        s = portfolio_stats(returns, weights, label)
        results[label] = s
        print(f"{label:<18}{s['ann_return']:>10.1%}{s['vol']:>10.1%}{s['sharpe']:>10.2f}"
              f"{s['max_dd']:>10.1%}{s['var95']:>10.2%}{s['shortfall95']:>10.2%}")

    print("\n" + "-" * width)
    print("Diversification (equal weight)")
    d = diversification_check(returns, WEIGHTINGS["equal weight"])
    print(f"{'average of the four vols':<34}{d['weighted_average_vol']:>12.1%}")
    print(f"{'actual portfolio volatility':<34}{d['portfolio_vol']:>12.1%}")
    print(f"{'risk removed by mixing them':<34}{d['benefit']:>12.1%}")

    print("\n" + "-" * width)
    print("Conclusion")
    best = max(results.values(), key=lambda s: s["sharpe"])
    print(f"On Sharpe alone the {best['label']} mix wins ({best['sharpe']:.2f}), but it also carries a "
          f"{best['max_dd']:.0%} maximum drawdown.")
    defensive = results["defensive tilt"]
    print(f"I would recommend the defensive tilt: Sharpe {defensive['sharpe']:.2f} for a "
          f"{defensive['max_dd']:.0%} drawdown instead: nearly the same efficiency with a fall a real")
    print("investor might actually sit through, which is the risk that decides whether a plan survives.")
    print("\nWhat this analysis cannot tell you: it is one three-year sample of synthetic data. Correlations")
    print("rise in a crisis, volatility is not risk of loss, and every statistic here assumes the future")
    print("resembles the past. None of it is a forecast, and none of it is advice.")
    print("=" * width)
    print(f"\nchart: {plot_dashboard(returns)}")


# ---------------------------------------------------------------------------
def tests():
    prices = load_prices()
    returns = compute_returns(prices)

    assert prices.shape == (782, 4)
    assert returns.shape == (781, 4)

    table = asset_table(prices)
    expect = {                       # total, vol, sharpe, max_dd
        "TECHX":   (0.193, 0.314, 0.26, -0.602),
        "BANKCO":  (0.012, 0.196, -0.04, -0.335),
        "GOLDF":   (0.047, 0.141, -0.03, -0.338),
        "CRYPTOZ": (0.213, 0.734, 0.49, -0.886),
    }
    for asset, (total, vol, shp, dd) in expect.items():
        row = table.loc[asset]
        assert abs(row["total"] - total) < 0.002, asset
        assert abs(row["vol"] - vol) < 0.002, asset
        assert abs(row["sharpe"] - shp) < 0.01, asset
        assert abs(row["max_dd"] - dd) < 0.002, asset

    # volatility drag is visible on the most volatile asset
    assert abs(table.loc["CRYPTOZ", "ann_mean"] - 0.391) < 0.002
    assert abs(table.loc["CRYPTOZ", "cagr"] - 0.064) < 0.002
    assert table.loc["CRYPTOZ", "drag"] > 0.3

    corr = correlation_matrix(returns)
    assert (corr.loc["GOLDF"].drop("GOLDF") < 0.2).all(), "GOLDF should be the diversifier"

    s = portfolio_stats(returns, WEIGHTINGS["equal weight"])
    assert abs(s["ann_return"] - 0.129) < 0.002
    assert abs(s["vol"] - 0.271) < 0.002
    assert abs(s["sharpe"] - 0.36) < 0.01
    assert abs(s["max_dd"] - (-0.569)) < 0.002
    assert abs(s["var95"] - (-0.0263)) < 0.0005
    assert abs(s["var99"] - (-0.0379)) < 0.0005
    assert s["shortfall95"] < s["var95"], "expected shortfall must be worse than VaR"

    d = diversification_check(returns, WEIGHTINGS["equal weight"])
    assert abs(d["weighted_average_vol"] - 0.346) < 0.002
    assert d["benefit"] > 0.07

    try:
        portfolio_returns(returns, {"TECHX": 0.4, "BANKCO": 0.3, "GOLDF": 0.2, "CRYPTOZ": 0.0})
    except AssertionError:
        pass                                        # weights summing to 0.9 must be refused
    else:
        raise AssertionError("weights that do not sum to 1 should raise")

    print("all self-checks passed\n")


if __name__ == "__main__":
    tests()
    report()
