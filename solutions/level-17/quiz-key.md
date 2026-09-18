# Level 17: Weights, and the risk they actually carry: quiz answer key

> 15 questions. Pass mark is 12/15 (80%).
> Generated from `content/levels/` by `tools/build_quiz_keys.js`: do not edit by hand.

| # | Answer |
|---|--------|
| 1 | **B** |
| 2 | **B** |
| 3 | **C** |
| 4 | **A** |
| 5 | **C** |
| 6 | **A** |
| 7 | **D** |
| 8 | **B** |
| 9 | **A** |
| 10 | **B** |
| 11 | **C** |
| 12 | **A** |
| 13 | **C** |
| 14 | **B** |
| 15 | **C** |

---

### 1. Why does an unconstrained mean variance optimiser produce extreme weights?

- A. The solver has not converged
- **B. It treats noisy estimates as certain, so it pushes hardest where the noise pointed** ✅
- C. The covariance matrix is singular
- D. Because returns are not normal

**Why:** Error maximisation. The fix is constraints, shrinkage, or a method that does not need the means, not a better solver.

### 2. On this data, unconstrained optimisation gains 0.05 of Sharpe over equal weight. What does it require?

- A. Daily rebalancing
- **B. A 92% short position, with the margin and borrow that implies** ✅
- C. A longer sample
- D. A risk free asset

**Why:** 0.50 against 0.45. Five hundredths of Sharpe for a position most investors cannot hold and none should want.

### 3. What does a long only constraint actually express?

- A. A regulatory requirement
- B. A preference for simplicity
- **C. That you do not believe your own estimates enough to bet against anything** ✅
- D. That short selling is expensive

**Why:** Constraints are a crude prior. Practitioners reached for them first and the theory eventually agreed.

### 4. Minimum variance needs which inputs?

- **A. The covariance matrix only** ✅
- B. Expected returns only
- C. Both, plus a risk free rate
- D. Neither, only prices

**Why:** That is its attraction: the means are the least reliable estimate you have, and this method does not ask for them.

### 5. Equal weight gives every asset 25% of the money. On this data CRYPTOZ carries what share of the risk?

- A. 25%
- B. 38%
- **C. 62.7%** ✅
- D. 11.7%

**Why:** Equal money is not equal risk when volatilities differ by a factor of five. Nobody chose that concentration; it fell out of the weights.

### 6. Risk parity chooses weights so that:

- **A. Every asset contributes the same risk** ✅
- B. Every asset has the same weight
- C. Volatility is minimised
- D. The Sharpe ratio is maximised

**Why:** It needs no return estimates, holds more of the calm assets, and is a serious alternative rather than a curiosity.

### 7. Historical, parametric and Monte Carlo VaR agree closely on this dataset. Why?

- A. Because the sample is large
- B. Because the portfolio is equal weight
- C. Because all three use the same quantile function
- **D. Because these returns are nearly normal, with excess kurtosis of 0.15** ✅

**Why:** Real markets run between three and ten, and there the parametric number is the optimistic one and the gap is the warning.

### 8. Expected shortfall at 95% on this portfolio is -3.35% against a VaR of -2.63%. What does that mean?

- A. The VaR was computed wrongly
- **B. On the days that breach the VaR, the average loss is 3.35%** ✅
- C. The portfolio loses 3.35% on 5% of days
- D. The worst possible day is -3.35%

**Why:** VaR gives the threshold, ES gives the average beyond it, and the worst single day here was -5.00%. Report all three.

### 9. A 99% VaR is breached 22 times in 781 days. The most likely explanations are:

- **A. Fat tails or volatility clustering** ✅
- B. A bug in the quantile function
- C. Too few assets
- D. The sample is too short to say

**Why:** Eight were expected. Scattered breaches point at the distribution; bunched ones point at a volatility estimate that does not react.

### 10. Far fewer exceptions than expected means:

- A. The model is working well
- **B. The model overstates risk, which costs capital and opportunity** ✅
- C. Nothing worth reporting
- D. The confidence level was set too low

**Why:** Being wrong in the safe direction is still being wrong, and it is a real finding rather than a comfortable one.

### 11. What does shrinkage do to a covariance matrix?

- A. Reduces its dimensions
- B. Removes the correlations
- **C. Pulls the noisy sample estimate towards a simple stable target** ✅
- D. Scales it to annual units

**Why:** It earns its place as the number of assets approaches the number of observations. On four assets and 781 days it does almost nothing.

### 12. Risk contribution is computed as:

- **A. Weight times marginal contribution to risk** ✅
- B. Weight times volatility
- C. Weight squared times variance
- D. The correlation with the portfolio

**Why:** And the contributions sum to the portfolio volatility, which is what makes the percentages meaningful.

### 13. Why does a rebalancing policy need a threshold rather than only a calendar?

- A. Because calendars vary by country
- B. Because monthly is too frequent for any portfolio
- **C. Because a calendar rebalances when nothing has moved, and every trade pays the costs from level 16** ✅
- D. Because thresholds are easier to implement

**Why:** A no trade band is the honest version: nothing happens until a weight has drifted far enough to be worth the cost.

### 14. Which is the best summary of what constraints cost on this data?

- A. Nothing at all
- **B. About 0.02 of Sharpe, in exchange for removing the borrowing, the short and the margin call** ✅
- C. About half the return
- D. They always improve the result

**Why:** 0.50 unconstrained against 0.48 long only. Cheap insurance against estimates you know are noisy.

### 15. Ten numbers describe the covariance of four assets. How many for a hundred?

- A. 400
- B. 1,000
- **C. 5,050** ✅
- D. 10,000

**Why:** n(n+1)/2, all estimated from the same limited history. That growth is why portfolio theory starts to hurt at scale.
