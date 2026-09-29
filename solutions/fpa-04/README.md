# Level 04: A model that ties

> **three-statement: the model, with its own tests** · build project · difficulty 6/10

## Read this second

Attempt the build yourself first, then ask the FinQuest tutor for a hint, and only then open this folder.
Read the part you are stuck on, close the file, and retype the fix from memory. Copying the solution into
your own project skips the only step that actually teaches you anything.

## The brief

The board wants a fifteen month forecast from the September close, with an upside, a downside, and the case that puts the company on its facility. They want to know which driver matters most, and when the money runs short in the bad case. Build it so that somebody can check it.

**Scope:** Python, from the closing balance sheet in fpa-history.csv. Revenue from drivers, costs by behaviour, working capital in days, a debt schedule, a revolver, and tests for the identities.

## Files here

| File | What it is |
|------|------------|
| `three-statement/model/drivers.py` | every assumption with its source, and the judgements marked |
| `three-statement/model/forecast.py` | fifteen months, three statements, the revolver and its circular reference |
| `three-statement/model/sensitivity.py` | twenty models as one table, and when each case draws on the facility |
| `three-statement/tests/test_model.py` | 14 tests, mostly identities rather than values |
| `quiz-key.md` | all 15 drill answers with explanations |

## Run it

```bash
python -m model.forecast && python -m model.forecast --scenario stress && python -m model.sensitivity && pytest -q
```

## Why the solution is shaped this way

- Cash is an output. It is the closing line of the cash flow statement, and a test asserts that in every month of every scenario, which is the difference between a model and a spreadsheet of hopes. Sixty forecast months balance to the cent with no plug anywhere.
- Revenue is driven from volume, take rate, merchants and platform fee rather than grown as a percentage of a total. That decomposes, so a miss can be attributed to volume or to price, and it is arguable: a sales director can disagree with 2.15% monthly volume growth, which is a useful conversation, where disagreeing with "revenue grows 26% a year" is not.
- Costs are modelled by behaviour rather than as percentages of revenue: scheme fees vary with volume, hosting follows its own trend, payroll steps with hiring, marketing is a decision. That is what lets the base case show EBITDA margin rising from 7.9% to 19.3%, which a percentage of revenue model cannot produce, and what lets the stress case take it to 1.2% without a single dramatic event.
- Every driver carries the evidence it came from and three of them are marked as judgements rather than measurements. A test fails if any driver has a blank source. A model that cannot separate its facts from its opinions gets believed more than it deserves, and the first question in any review is where a number came from.
- Scenarios are multiples of one base case rather than four saved copies. Correct a measured driver and all four move together, and the only difference between them stays the thing being varied. Four files drift apart in the second month and then nobody can say whether a difference is the assumption or the drift.
- The revolver creates the circular reference every real model has: a draw costs interest, interest costs cash, less cash means a bigger draw. It is resolved by iteration with the pass count reported, five in the stress case, and two tests: that it converges rather than hitting the cap, and that it iterates at all, because a scenario that never draws proves nothing about the mechanism.
- The sensitivity table exists to settle an argument rather than to widen a range. Sixteen basis points of take rate moves FY2026 EBITDA more than three and a half points of monthly volume growth, and the company argues about volume in every sales meeting and about pricing almost never.

## Where people get stuck

| Symptom | Cause |
|---------|-------|
| The balance sheet is out by a small amount | In order: a cash flow line missing from the balance sheet, depreciation on the closing balance, a working capital movement using the balance rather than the change, net income not reaching retained earnings. |
| Cash was forecast directly | Then the balance sheet only balances by plug. Cash is the closing line of the cash flow. |
| Depreciation is 2% out every month | It was calculated on the closing fixed assets, which depend on depreciation. Use the opening balance. |
| A profitable forecast runs out of cash | Growth consumes working capital. Receivables grow with revenue, and the faster you grow the more you lend your customers. |
| The model hit its iteration cap | The circular calculation did not converge, and any number it shows is meaningless. Excel shows a stale one instead. |
| Every scenario looks the same | They were built by copying the file. Build them as multiples of one base so a corrected driver moves all of them. |

## Self-checks the solution satisfies

- Every month of every scenario balances to within half a cent, with no plug
- The opening balance sheet is read from the data and refuses to start if it does not balance
- Retained earnings move by exactly net income each month
- Fixed assets move by exactly capex less depreciation each month
- Cash equals opening cash plus operations less capex plus financing, every month
- The base, upside and downside cases never draw on the revolver, and the stress case does
- The stress case takes more than one pass and fewer than the cap to resolve the circularity
- Increasing DSO reduces closing cash
- Every driver has a non empty source, and the judgement calls are marked
- The sensitivity table runs twenty models and all of them balance

## How it is marked

| Points | Criterion | Meaning |
|--------|-----------|---------|
| 25 | It ties | Sixty forecast months balancing to the cent, cash derived, no plug anywhere. |
| 20 | It is driven | Revenue from volume and rate, costs by behaviour, working capital in days. |
| 20 | It is honest | Every driver has a source and the judgements are marked. A reviewer can tell facts from opinions. |
| 20 | It handles the circle | The revolver works, the iteration converges, the pass count is reported, and a case exists that exercises it. |
| 15 | It decides something | A sensitivity table with a sentence saying which argument it settles. |

---

Part of [FinQuest](../../README.md) · Analyst track, Level 04 of 5
