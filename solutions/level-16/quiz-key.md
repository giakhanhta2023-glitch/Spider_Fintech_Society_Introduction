# Level 16: The backtest that does not lie to you: quiz answer key

> 15 questions. Pass mark is 12/15 (80%).
> Generated from `content/levels/` by `tools/build_quiz_keys.js`: do not edit by hand.

| # | Answer |
|---|--------|
| 1 | **B** |
| 2 | **C** |
| 3 | **A** |
| 4 | **D** |
| 5 | **D** |
| 6 | **B** |
| 7 | **C** |
| 8 | **C** |
| 9 | **A** |
| 10 | **B** |
| 11 | **C** |
| 12 | **D** |
| 13 | **A** |
| 14 | **A** |
| 15 | **B** |

---

### 1. What does position = signal.shift(1) prevent?

- A. Division by zero in the returns
- **B. Acting on information you did not have yet** ✅
- C. Costs being double counted
- D. Trading on the last day of the sample

**Why:** Measured on this course's data: the same rule gives +21,745,676% unshifted and -26.05% shifted.

### 2. A backtest reports a Sharpe ratio of 21. What is the most likely explanation?

- A. Costs were set too low
- B. Too little data
- **C. Lookahead bias** ✅
- D. A very strong strategy

**Why:** Real equity strategies live between 0 and 2. Above about 3 is a bug until proven otherwise, and 21 is arithmetic telling you the model knew the answer.

### 3. Ten basis points of cost destroys one strategy and barely touches another. What decides which?

- **A. Turnover** ✅
- B. The Sharpe ratio
- C. The asset class
- D. The length of the sample

**Why:** 248 turns a year against 5.5. The cost rate is the same; how often you pay it is not.

### 4. Why report the break even cost rather than the cost you assumed?

- A. Because regulators require it
- B. Because it is always lower
- C. It is easier to compute
- **D. Because it is a single number a reader can judge against reality, instead of an assumption to argue about** ✅

**Why:** It turns a debate about assumptions into one figure. A strategy that breaks even at seven basis points is dead for most instruments, and everybody can see that at once.

### 5. What is survivorship bias?

- A. Keeping only the strategies that worked
- B. Overweighting recent data
- C. Ignoring dividends
- **D. Testing on names that lasted, because the failures were removed from the data** ✅

**Why:** It lives in the file rather than in your code, and no amount of careful programming removes it. You need a point in time universe.

### 6. Seventy nine parameter combinations are tested. The best in sample scores Sharpe 2.18 and -1.95 out of sample, and the correlation between the two is -0.57. What does that say?

- A. The out of sample period was unusual
- **B. The best in sample result was mostly luck, and searching harder makes that more certain** ✅
- C. The parameters need finer steps
- D. The cost assumption was wrong

**Why:** None of the top five in sample beat the median out of sample. Choosing the best fit to one history is choosing its accidents.

### 7. What are the first three questions to ask about a strategy with an in sample Sharpe of 2.4?

- A. Which library, which data vendor, and which language
- B. The maximum drawdown, the hit rate and the time in market
- **C. How many variations were tried, what happened on untouched data, and what the turnover and cost are** ✅
- D. What is the idea, who else uses it, and how much capital it takes

**Why:** None of the three is about the idea. The idea is the part that is easy to have.

### 8. In walk forward testing, which periods go in the reported result?

- A. All of it, fits and tests together
- B. The best fold
- **C. The test periods only, joined end to end** ✅
- D. The fits, because they use more data

**Why:** Every test period is genuinely out of sample, which is what makes the joined series worth reading.

### 9. The parameters chosen by walk forward jump from 5 and 20 to 35 and 90 and back between folds. What does that tell you?

- **A. There is probably nothing to choose, and the parameter is noise** ✅
- B. The optimiser has a bug
- C. The market is changing quickly
- D. The fit window is too long

**Why:** Stability across folds is evidence. Instability is the absence of it, and it is worth more in a report than the return.

### 10. A strategy is invested 12% of the time and reports a Sharpe higher than buy and hold. What must the report say?

- A. That it is riskier by definition
- **B. Its time in market, so the comparison is fair** ✅
- C. Nothing extra, Sharpe already accounts for it
- D. The number of trades only

**Why:** Sitting in cash is not skill. Without exposure alongside it, the comparison flatters the strategy.

### 11. Why is maximum drawdown reported next to the return?

- A. Because it determines the tax treatment
- B. Because regulators require it
- **C. Because it is what decides whether anybody could hold the strategy through** ✅
- D. Because it is the same as volatility

**Why:** Level 7 made the point in money: the crossover here draws down 28% against buy and hold's 60%, and that difference matters more than the extra return.

### 12. Monthly rebalancing using quarterly earnings dated to the quarter end is:

- A. Survivorship bias
- B. Fine, the date is in the past
- C. Only a problem for daily strategies
- **D. Lookahead, because earnings are published weeks after the quarter they describe** ✅

**Why:** The test is whether the value was published before you act, not whether its timestamp looks historical.

### 13. What belongs in the write up that almost nobody includes?

- **A. How many variations were tried in total, including abandoned ones** ✅
- B. The Sharpe ratio
- C. The list of libraries used
- D. The equity curve

**Why:** It gives the Sharpe ratio a denominator. Without it the number means one thing after two attempts and nothing after four hundred.

### 14. Anchored walk forward differs from rolling in that:

- **A. Anchored keeps the start fixed and lets the fit window grow** ✅
- B. Anchored tests on the fit period
- C. Rolling cannot be used with daily data
- D. Rolling uses all history every time

**Why:** Rolling drops the oldest data, which is the right choice when you believe the world changes rather than accumulates.

### 15. Your walk forward Sharpe is worse than your single split Sharpe. What goes in the report?

- A. The walk forward only
- **B. Both, with a sentence explaining why they differ** ✅
- C. Whichever is closer to the benchmark
- D. The single split, since it used more data for fitting

**Why:** A reader who later finds you ran both and reported the flattering one will not believe anything else in the document.
