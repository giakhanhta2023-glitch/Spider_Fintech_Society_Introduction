# Level 7: Risk and return

## Read this second

Attempt the build yourself first, then ask the FinQuest tutor for a hint, and only then open this folder.
Read the part you are stuck on, close the file, and retype the fix from memory. Copying the solution into
your own project skips the only step that actually teaches you anything.

## The brief

The investment club holds four assets and argues about them every month with no data to hand. Build the risk report that settles it: what each one returned, what it cost in risk along the way, and whether the mix beats its parts.

**Scope:** Uses this level plus level 3 (pandas) and level 2 (formatting): pct_change, cumprod, cummax, std, corr, dot, quantile, and matplotlib. Numpy is used only for sqrt and arrays.

## Files here

| File | What it is |
|------|------------|
| `risk_dashboard.py` | returns, volatility, Sharpe, drawdown, correlation, VaR, charts |
| `quiz-key.md` | all 15 drill answers with explanations |

## Run it

```bash
python risk_dashboard.py
```

## Why the solution is shaped this way

- Volatility is annualized with `sqrt(252)`, not 252. Variance adds over time; standard deviation is its square root. Using 252 overstates risk roughly sixteenfold.
- The table reports the arithmetic mean **and** the CAGR side by side, with the gap in its own column. On `CRYPTOZ` that gap is 32 points: the clearest possible demonstration of volatility drag.
- `portfolio_returns` asserts the weights sum to 1. Weights summing to 0.9 produce no error and scale every number in the report down by 10%.
- VaR is always reported next to expected shortfall. VaR gives the threshold and is silent about how bad the tail gets; reporting it alone is how institutions got surprised in 2008.
- The conclusion recommends the mix with the tolerable drawdown rather than the best Sharpe, and says what the analysis cannot tell you. That paragraph is the point of the level.

## Where people get stuck

| Symptom | Cause |
|---------|-------|
| Volatility enormous | Multiplied by 252 instead of `sqrt(252)`. |
| Everything is `NaN` | You skipped `.dropna()` after `pct_change()`. |
| Portfolio numbers ~10% off | Weights do not sum to 1. |

## Self-checks the solution satisfies

- prices.shape is (782, 4); returns.shape is (781, 4)
- Total returns: TECHX +19.3%, BANKCO +1.2%, GOLDF +4.7%, CRYPTOZ +21.3% (to 0.1%)
- Annualized volatility: TECHX 31.4%, BANKCO 19.6%, GOLDF 14.1%, CRYPTOZ 73.4%
- CRYPTOZ annualized mean is about 39.1% while its CAGR is about 6.4% (using years = rows / 252), the drag must be visible in your table
- Sharpe at 3% risk-free: TECHX 0.26, BANKCO -0.04, GOLDF -0.03, CRYPTOZ 0.49
- Max drawdowns: TECHX -60.2%, BANKCO -33.5%, GOLDF -33.8%, CRYPTOZ -88.6%
- GOLDF correlates below 0.2 with every other asset
- Equal-weight portfolio: about 12.9% annualized return, 27.1% volatility, Sharpe 0.36, max drawdown -56.9%
- Average individual volatility is 34.6%, so the diversification benefit is roughly 7.5 percentage points
- Equal-weight VaR95 is about -2.63% daily, VaR99 about -3.79%, and expected shortfall beyond VaR95 about -3.35%
- portfolio_returns raises AssertionError when given weights that sum to 0.9

## How it is marked

| Points | Criterion | Meaning |
|--------|-----------|---------|
| 25 | Correct statistics | Every number in the test list reproduced, with sqrt(252) scaling applied properly. |
| 20 | Risk beyond return | Drawdown, VaR and expected shortfall all present and correctly interpreted in words. |
| 20 | Diversification argument | Correlation matrix plus a quantified comparison of portfolio vol against the average of the parts. |
| 15 | Charts | Stacked equity and drawdown panels, shared axis, labelled, readable. |
| 10 | Honest conclusion | A recommendation with numbers, and an explicit statement of the analysis's limits. |
| 10 | Shipped | Runs top to bottom in a fresh session and is committed to your portfolio repo. |

---

Part of [FinQuest](../../README.md) · Level 7 of 10
