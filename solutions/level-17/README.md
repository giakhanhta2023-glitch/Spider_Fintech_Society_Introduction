# Level 17: Weights, and the risk they actually carry

> **The portfolio and risk engine** · build project · difficulty 9/10

## Read this second

Attempt the build yourself first, then ask the FinQuest tutor for a hint, and only then open this folder.
Read the part you are stuck on, close the file, and retype the fix from memory. Copying the solution into
your own project skips the only step that actually teaches you anything.

## The brief

The society's investment group has four assets, strong opinions and no process. Build the engine that produces the weights, shows where the risk actually sits, reports the loss numbers three ways, and proves the risk model has been checked rather than believed.

**Scope:** Uses this level plus level 7 (returns, volatility, correlation, drawdown) and level 16 (costs and turnover). numpy, pandas, scipy and scikit-learn for shrinkage only.

## Files here

| File | What it is |
|------|------------|
| `engine/optimise.py` | max_sharpe, min_variance and risk_parity, all with bounds |
| `engine/decompose.py` | marginal and total risk contributions |
| `engine/var.py` | historical, parametric, monte carlo and expected shortfall |
| `engine/backtest.py` | exception counting, with the dates so clustering shows |
| `engine/rebalance.py` | the no trade band and the turnover it produces |
| `quiz-key.md` | all 15 drill answers with explanations |

## Run it

```bash
pip install -r requirements.txt && pytest -q && python -m engine.report
```

## Why the solution is shaped this way

- The unconstrained solution is printed rather than hidden. A weight of -92.5% for five hundredths of Sharpe is the most persuasive argument for constraints anybody will ever see, and it disappears if only the summary statistics are shown.
- Risk contributions are reported next to the weights in the same table. Equal money giving one asset 62.7% of the risk is a fact a committee can act on, and it is invisible in a weights column.
- Three VaR methods rather than one, with the excess kurtosis printed beside them. On this synthetic data the three agree because the returns are nearly normal, and saying so is the honest version of a result that would not hold on real returns.
- The exception backtest lists the dates of the breaches. The count says whether the model is wrong; the pattern says whether it is the distribution or the volatility estimate.
- Rebalancing uses a no trade band and reports turnover, so the allocation is costed through the level 16 engine rather than assumed to be free.

## Where people get stuck

| Symptom | Cause |
|---------|-------|
| Weights do not sum to one | The equality constraint is missing or the solver failed. Check the status, and assert the sum in a test. |
| Risk parity will not converge | Bound the weights away from zero. A contribution divided by a weight of zero is undefined and the optimiser wanders. |
| VaR looks too good | Check the sign convention and the tail. A 95% VaR is a loss, so it should be negative, and it should be breached about once a fortnight. |

## Self-checks the solution satisfies

- portfolio([0.25]*4) gives about 12.10% return, 27.10% volatility and Sharpe 0.45
- The unconstrained maximum Sharpe solution shorts BANKCO at about -92.5% and reaches Sharpe about 0.50
- The long only solution holds nothing negative and reaches Sharpe about 0.48
- Minimum variance long only gives volatility about 12.20% and holds mostly GOLDF and BANKCO
- Risk contributions of the equal weight portfolio sum to 1.0 and give CRYPTOZ about 62.7%
- Risk parity contributions are equal to within 1e-6, and it holds less CRYPTOZ than equal weight
- Historical VaR95 is about -2.63% and expected shortfall about -3.35%
- Parametric and Monte Carlo VaR99 agree to within 0.05 percentage points on this data
- The exception count at 99% is 5 against an expectation of 8 over 781 days
- Rebalancing with a no trade band produces lower turnover than a monthly calendar on the same data

## How it is marked

| Points | Criterion | Meaning |
|--------|-----------|---------|
| 25 | Weights you can defend | The unconstrained result is shown and explained rather than hidden, and constraints are justified by what they cost. |
| 20 | Risk located | Contributions computed correctly, compared against the weights, and risk parity implemented and tested. |
| 20 | Loss numbers done properly | Three VaR methods, expected shortfall, and the kurtosis check that says whether the normal assumption was fair. |
| 20 | The model is checked | Exception counts at both levels against expectation, with dates so clustering is visible, and a conclusion drawn. |
| 15 | Usable | One comparison table a committee could read, a rebalancing policy with turnover and costs, and a README that leads with the decision. |

---

Part of [FinQuest](../../README.md) · Level 17 of 10
