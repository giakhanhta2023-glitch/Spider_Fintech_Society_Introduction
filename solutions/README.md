# Solution keys

Every level's complete, commented, **verified** solution lives here — one folder per level.

## How to use these honestly

Reading a solution feels like learning and mostly is not. The order that works:

1. Attempt the requirement yourself for at least 15 minutes.
2. Ask the FinQuest tutor for a **hint** — it is built to nudge rather than to hand over answers.
3. Open the key, read **only** the part you are stuck on, and close it.
4. Retype the fix from memory. Never paste a solution into your own project.

The self-check values in each brief exist so you can tell whether your own code is right without
reading anyone else's. Use those first.

## What is in each folder

| Folder | Solution | Runs with |
|--------|----------|-----------|
| [level-01](level-01/) | `check_setup.py` — one-cell lab verification | Colab, no install |
| [level-02](level-02/) | `compound_growth.py` — TVM engine + self-checks | `python compound_growth.py` |
| [level-03](level-03/) | `spending_analyzer.py` — pandas analytics + chart | `python spending_analyzer.py` |
| [level-04](level-04/) | `ledger.py` — double-entry ledger + 8 test groups | `python ledger.py` |
| [level-05](level-05/) | `fx_portfolio.py` — resilient API client + valuation | `python fx_portfolio.py` |
| [level-06](level-06/) | `loan_simulator.py` — amortization, APR, charts | `python loan_simulator.py` |
| [level-07](level-07/) | `risk_dashboard.py` — volatility, Sharpe, drawdown, VaR | `python risk_dashboard.py` |
| [level-08](level-08/) | `fraud_engine.py` — rules, cost curve, model, queue | `python fraud_engine.py` |
| [level-09](level-09/) | `finance.py` + `app.py` + 22 tests | `pytest -q`, `streamlit run app.py` |
| [level-10](level-10/) | `neobank/` package + dashboard + 38 tests | `pytest -q`, `streamlit run app.py` |

Every folder also contains `quiz-key.md`: all 15 drill questions with the correct answer and the
reasoning behind it.

## These are verified, not aspirational

Each solution was executed against the datasets in [`../data/`](../data/) and produces exactly the
numbers quoted in its level brief. Levels 9 and 10 pass their test suites:

```bash
cd solutions/level-09 && pytest -q     # 22 passed
cd solutions/level-10 && pytest -q     # 38 passed
```

If a solution ever disagrees with a brief, the brief is wrong — please open an issue.

## Regenerating the generated files

Quiz keys and level READMEs are produced from the curriculum so they cannot drift out of sync:

```bash
node tools/build_quiz_keys.js
node tools/build_solution_readmes.js
```

Edit the level content in `content/levels/`, not the generated Markdown.
