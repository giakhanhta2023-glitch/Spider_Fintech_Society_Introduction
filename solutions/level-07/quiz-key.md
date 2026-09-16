# Level 7 — Risk & Return: quiz answer key

> 15 questions. Pass mark is 12/15 (80%).
> Generated from `content/levels/` by `tools/build_quiz_keys.js` — do not edit by hand.

| # | Answer |
|---|--------|
| 1 | **A** |
| 2 | **C** |
| 3 | **A** |
| 4 | **C** |
| 5 | **B** |
| 6 | **A** |
| 7 | **B** |
| 8 | **A** |
| 9 | **C** |
| 10 | **D** |
| 11 | **B** |
| 12 | **C** |
| 13 | **D** |
| 14 | **B** |
| 15 | **D** |

---

### 1. Why is `.dropna()` needed after `prices.pct_change()`?

- **A. The first row has no previous price, so it is NaN and would poison every later statistic** ✅
- B. To remove negative returns
- C. To remove weekends
- D. Because pandas requires it before groupby

**Why:** pct_change cannot compute a change for the first row. A single NaN propagates through mean, std, and every downstream number.

### 2. Three consecutive daily returns of +10%, -10%, +10% give a total of:

- A. +10%
- B. +33.1%
- **C. +8.9%** ✅
- D. +30%

**Why:** 1.1 x 0.9 x 1.1 = 1.089. Returns compound rather than add, which is why you use cumprod on (1 + r) instead of a sum.

### 3. How do you annualize daily volatility?

- **A. Multiply by sqrt(252)** ✅
- B. Divide by 252
- C. Multiply by 252
- D. Multiply by 365

**Why:** Variance scales with time, so standard deviation scales with its square root: about 15.87x. Using 252 overstates risk roughly sixteenfold.

### 4. CRYPTOZ has an annualized mean return of 39.1% but a CAGR of 6.4%. What explains the gap?

- A. Inflation
- B. Trading fees
- **C. Volatility drag — large swings make the compounded result fall short of the average** ✅
- D. A calculation error

**Why:** A 50% loss requires a 100% gain to recover. The bigger the swings, the further compounding lags the arithmetic mean — which is why CAGR is the honest headline.

### 5. What does the Sharpe ratio measure?

- A. The probability of a loss
- **B. Return above the risk-free rate per unit of volatility** ✅
- C. The worst drop from a peak
- D. Total return over the period

**Why:** It makes a calm 8% and a wild 20% comparable by dividing excess return by the volatility endured to earn it.

### 6. An asset has a Sharpe ratio of -0.04. What does that mean?

- **A. It returned less than the risk-free rate while still being volatile** ✅
- B. The calculation is invalid
- C. It lost money every day
- D. Its volatility was negative

**Why:** Negative Sharpe means cash would have beaten it. The holder took real risk — a 33% drawdown here — and was paid less than a government bill.

### 7. How is maximum drawdown calculated?

- A. The standard deviation of negative returns
- **B. The minimum of (equity curve / running peak - 1)** ✅
- C. The largest single-day loss
- D. The difference between the highest and lowest price

**Why:** Compare each point against the highest value seen so far (cummax) and take the worst result. It measures peak-to-trough pain, not one bad day.

### 8. Why is maximum drawdown often more useful than volatility when talking to an investor?

- **A. It describes the worst moment they would have lived through, which is what makes people sell** ✅
- B. It is required by regulators
- C. It is always smaller than volatility
- D. It is easier to compute

**Why:** Investors abandon strategies during drawdowns, not because of standard deviations. Drawdown is the most behaviourally honest single risk number.

### 9. CRYPTOZ has the highest Sharpe ratio and the worst drawdown (-88.6%). What does this show?

- A. The Sharpe calculation must be wrong
- B. Drawdown is irrelevant when Sharpe is high
- **C. No single ratio captures risk — Sharpe rewards average efficiency and says nothing about the worst path** ✅
- D. The asset is risk-free

**Why:** Sharpe uses the whole distribution symmetrically. An -88.6% fall would have removed most real investors from the strategy long before the recovery.

### 10. The four assets have an average individual volatility of 34.6%, and an equal-weight portfolio of them has 27.1%. Why?

- A. Because equal weighting always reduces returns
- B. A calculation error — the portfolio must equal the average
- C. Because the portfolio has fewer observations
- **D. Imperfect correlation: assets do not fall at the same moment, so the swings partly offset** ✅

**Why:** This is diversification, measured. Only perfectly correlated assets (+1) give a portfolio volatility equal to the weighted average.

### 11. Which asset contributes most to diversification in this dataset?

- A. TECHX, because it has the highest return
- **B. GOLDF, because its correlation with everything else is near zero** ✅
- C. CRYPTOZ, because it is the most volatile
- D. BANKCO, because it is a bank

**Why:** GOLDF correlates at 0.13-0.16 with the others, so it moves when they do not. Low correlation, not low volatility, is what diversifies.

### 12. What is the crucial caveat about historical correlations?

- A. They cannot be computed on daily data
- B. They are always negative
- **C. They tend to rise toward 1 in a crisis, exactly when diversification is needed** ✅
- D. They only apply to equities

**Why:** In a panic everything is sold at once. Portfolios built on calm-period correlations lose their protection on the day it matters most.

### 13. A daily VaR at 95% of -2.6% means:

- A. You will lose 2.6% every day
- B. The maximum possible loss is 2.6%
- C. You have a 2.6% chance of losing everything
- **D. On 95% of days the loss is smaller than 2.6%** ✅

**Why:** VaR is a threshold on the distribution, not a maximum and not a forecast. It is silent about how bad the other 5% of days get.

### 14. What does expected shortfall add to VaR?

- A. A confidence interval on the estimate
- **B. The average loss on the days that breach VaR — the size of the tail** ✅
- C. A longer time horizon
- D. An adjustment for inflation

**Why:** VaR gives the threshold; expected shortfall (CVaR) gives the average severity beyond it. Reporting only VaR hides the tail that actually causes failures.

### 15. Before computing a weighted portfolio return, what should you assert?

- A. That there are exactly 252 observations
- B. That the assets are uncorrelated
- C. That all returns are positive
- **D. That the weights sum to 1.0** ✅

**Why:** Weights summing to 0.9 silently scale every result down by 10% without any error being raised. A one-line assert catches it immediately.
