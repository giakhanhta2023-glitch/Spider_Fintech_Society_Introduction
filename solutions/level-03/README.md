# Level 3: Reading the money

## Read this second

Attempt the build yourself first, then ask the FinQuest tutor for a hint, and only then open this folder.
Read the part you are stuck on, close the file, and retype the fix from memory. Copying the solution into
your own project skips the only step that actually teaches you anything.

## The brief

A member drops six months of their bank export on your desk with one question: "where is my money actually going?" Build the analyzer that answers it, and see if you can find them at least one thing worth cancelling.

**Scope:** Uses only this level plus Level 2: pandas (read_csv, masks, groupby, sort_values, value_counts, .dt, .abs), matplotlib bar charts, f-string formatting, and functions. No machine learning, no APIs, no classes.

## Files here

| File | What it is |
|------|------------|
| `spending_analyzer.py` | load, aggregate, detect recurring charges, report, chart |
| `quiz-key.md` | all 15 drill answers with explanations |

## Run it

```bash
python spending_analyzer.py
```

## Why the solution is shaped this way

- Income is selected by **category**, never by sign. The dataset contains refunds (positive amounts that are not income) and filtering on `amount > 0` overstates income by exactly those.
- Savings transfers are excluded from spending. Moving money to your own account changes its location, not your net worth; counting it as an expense is a real bug in shipped budgeting apps.
- `find_recurring` groups by merchant **and** amount, then splits the result into cancellable subscriptions and fixed commitments. Rent is perfectly recurring too, and a report that tells you to cancel it is useless.
- The chart drops savings transfers and sorts before plotting, because an unsorted bar chart with a misleading biggest bar is worse than no chart.

## Where people get stuck

| Symptom | Cause |
|---------|-------|
| `SettingWithCopyWarning` | Take `.copy()` when you filter: `spend = df[df["amount"] < 0].copy()`. |
| Income looks too high | Refunds again. Filter `category == "income"`. |
| Savings rate above 100% or negative | You counted the savings transfer as spending, or double-counted it. |

## Self-checks the solution satisfies

- The DataFrame has 233 rows and 6 original columns
- Total income (category == "income") is exactly $20,100.00
- Total spend excluding savings transfers is $13,358.30
- Net cash flow (sum of every amount) is $5,072.74
- Savings rate is 33.5% (to one decimal)
- Housing is the top category at $6,900.00; subscriptions total $461.76 over six months
- find_recurring finds 8 recurring charges at min_times=3, of which 5 are cancellable subscriptions
- CLOUDSTREAM TV appears at $15.99 x 6. An annual cost of $191.88
- Monthly subscription cost is $76.96

## How it is marked

| Points | Criterion | Meaning |
|--------|-----------|---------|
| 25 | Correct aggregation | Headline numbers match the expected values, including the income-vs-refund and savings-transfer distinctions. |
| 20 | Recurring detection | Finds all repeated identical charges and separates cancellable from fixed. |
| 20 | Clean pandas | Masks and groupby instead of loops, .copy() when filtering, no SettingWithCopyWarning, no hardcoded totals. |
| 20 | Communication | Readable text report, one honest labelled chart, three findings each backed by a number and a recommendation. |
| 15 | Shipped | Notebook in your GitHub portfolio repo, runs top to bottom without errors after Restart and Run All. |

---

Part of [FinQuest](../../README.md) · Level 3 of 10
