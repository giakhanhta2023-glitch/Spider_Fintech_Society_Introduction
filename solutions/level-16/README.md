# Level 16: The backtest that does not lie to you

> **The backtest engine** · build project · difficulty 9/10

## Read this second

Attempt the build yourself first, then ask the FinQuest tutor for a hint, and only then open this folder.
Read the part you are stuck on, close the file, and retype the fix from memory. Copying the solution into
your own project skips the only step that actually teaches you anything.

## The brief

The society's investment group keeps sharing screenshots of rising equity curves. Build the engine that settles it: one interface every strategy plugs into, costs, walk forward, and a report that says how many variations were tried and what cost would kill the result.

**Scope:** Uses this level plus level 7 (returns, Sharpe, drawdown, correlation) and level 3 (pandas). pandas and numpy only. No backtesting library: the whole point is that you can see every line that touches a return.

## Files here

| File | What it is |
|------|------------|
| `engine/core.py` | run, metrics and break_even_cost |
| `engine/strategies.py` | buy and hold, crossover, momentum, all behind one interface |
| `engine/search.py` | the parameter grid and walk_forward |
| `engine/report.py` | the same nine lines for every result |
| `tests/test_lookahead.py` | the shifted and unshifted comparison, asserted |
| `quiz-key.md` | all 15 drill answers with explanations |

## Run it

```bash
pip install -r requirements.txt && pytest -q && python -m engine.report
```

## Why the solution is shaped this way

- The shift lives in `run` rather than in each strategy, so no strategy can forget it. The test that proves it asserts that a signal of 1 on day t produces a position of 1 on day t+1 and nothing on day t.
- Costs are applied to turnover rather than to returns, which is what makes the fast and slow strategies react so differently to the same rate: 248 turns a year against 5.5.
- `break_even_cost` is reported instead of defending an assumed cost. One number a reader can compare with reality beats a paragraph of justification.
- The grid search reports the out of sample result and the correlation across the grid, not the winner. On this data the correlation is negative, which is the whole lesson in one figure.
- Walk forward returns the joined test windows and the parameters chosen per fold. Unstable choices between folds are reported as a finding rather than smoothed over.

## Where people get stuck

| Symptom | Cause |
|---------|-------|
| Sharpe above 3 | Look for the future: a rolling window including the current bar, a backward fill, or a merge that aligned the wrong rows. |
| Costs barely matter | Check the turnover calculation. A position that never changes pays nothing, and a diff on a constant series is zero everywhere. |
| Walk forward beats the single split | Suspect leakage between folds: the fit window and the test window must not overlap, including any rolling feature that spans the boundary. |

## Self-checks the solution satisfies

- run() shifts the signal: a signal that is 1 on day t produces a position of 1 on day t+1
- A strategy that is always in matches buy and hold exactly at zero cost
- Turnover is 2.0 for a position that goes 0 to 1 to 0 over three days
- The unshifted version of the sign rule returns over one million percent and the shifted version loses money
- metrics() on the 20/50 crossover at 10 bps gives total near 31.02%, Sharpe near 0.49 and drawdown near -28%
- break_even_cost on the daily flipper is under 10 basis points
- The grid search over 79 combinations reproduces the best in sample Sharpe near 2.18 and its out of sample Sharpe near -1.95
- The correlation between in sample and out of sample Sharpe across the grid is negative
- walk_forward returns a series covering only the test windows, and one parameter pair per fold
- Every strategy report includes turnover, time in market and the count of variations tried

## How it is marked

| Points | Criterion | Meaning |
|--------|-----------|---------|
| 25 | Honest mechanics | The shift is correct and tested, turnover is right, and costs are applied to turnover rather than to returns. |
| 20 | Bias demonstrated | The lookahead comparison is in the repository with both numbers, and the sample limitations are written down. |
| 20 | Overfitting measured | The grid search reports out of sample results and the correlation, rather than the best number. |
| 20 | Walk forward | Implemented, reported on test periods only, with the chosen parameters per fold shown. |
| 15 | Reported like research | One report shape, a benchmark on every result, the break even cost, and a paragraph on what would falsify it. |

---

Part of [FinQuest](../../README.md) · Level 16 of 10
