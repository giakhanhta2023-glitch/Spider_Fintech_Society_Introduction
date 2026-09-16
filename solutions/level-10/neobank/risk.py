"""
neobank.risk — portfolio risk statistics (from Level 7).

Volatility scales with sqrt(252); Sharpe always states its risk-free rate;
drawdown is measured from the running peak.
"""

import numpy as np
import pandas as pd

TRADING_DAYS = 252
RISK_FREE = 0.03


def compute_returns(prices):
    """Daily simple returns. The first row has no previous price, so it goes."""
    return prices.pct_change().dropna()


def annualize(returns, trading_days=TRADING_DAYS):
    """(annual mean return, annual volatility).

    Volatility scales with the SQUARE ROOT of time — variance is what adds.
    """
    ann_return = (1 + returns.mean()) ** trading_days - 1
    ann_vol = returns.std() * np.sqrt(trading_days)
    return ann_return, ann_vol


def cagr(prices, trading_days=TRADING_DAYS):
    """What you actually earned, compounded. Always lower than the arithmetic
    mean when returns are volatile — that gap is volatility drag.
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
