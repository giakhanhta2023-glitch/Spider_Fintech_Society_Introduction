# Level 6: Credit, Loans & Amortization

> **Loan Amortization & Early-Payoff Simulator** · build project · difficulty 6/10

## Read this second

Attempt the build yourself first, then ask the FinQuest tutor for a hint, and only then open this folder.
Read the part you are stuck on, close the file, and retype the fix from memory. Copying the solution into
your own project skips the only step that actually teaches you anything.

## The brief

A member is choosing between a 25-year and a 30-year mortgage, and wants to know whether overpaying $200 a month beats investing it. Build the tool that answers both questions with numbers instead of opinions.

**Scope:** Uses this level plus Levels 2 and 3: the payment formula, a while loop, pandas DataFrames, matplotlib, bisection, and f-string formatting. No new libraries.

## Files here

| File | What it is |
|------|------------|
| `loan_simulator.py` | payment, schedule, APR by bisection, comparisons, two charts |
| `quiz-key.md` | all 15 drill answers with explanations |

## Run it

```bash
python loan_simulator.py
```

## Why the solution is shaped this way

- Interest is charged on the **current** balance every month. Using the original amount is the classic bug, and it shows up as a final balance that never reaches zero.
- The final payment is capped at the remaining balance, so the schedule ends at exactly `0.00` instead of a few stray cents.
- The loop is bounded and raises a readable error when the payment cannot cover the interest: otherwise the balance grows every month and the `while` never ends.
- `true_apr` uses bisection because the rate has no closed-form solution. Eighty iterations is far more precision than money needs and costs nothing.
- The invest-instead comparison deliberately refuses to give a one-word answer: overpaying returns a guaranteed rate, investing is uncertain and illiquid, and a tool that hides that is selling something.

## Where people get stuck

| Symptom | Cause |
|---------|-------|
| Balance never reaches zero | Interest computed on the original principal, or no cap on the final payment. |
| Payment about 12× too big | You passed the annual rate as `i`, or years as `n`. Both must be per period. |
| Crossover month looks wrong | It is the first month `principal > interest`, not the month the balance halves. |

## Self-checks the solution satisfies

- monthly_payment(20000, 0.07, 5) == 396.02 (to 2dp)
- monthly_payment(250000, 0.055, 30) == 1419.47 (to 2dp)
- monthly_payment(12000, 0.0, 4) == 250.00 exactly
- schedule(250000, 0.055, 30) has exactly 360 rows and a final balance of 0.00
- That schedule totals $261,010 of interest (a few cents either way, depending on where you round)
- Month 1 shows $1,145.83 interest and $273.64 principal
- schedule(..., extra=200) has 269 rows and about $185,394 of interest
- compare_overpayment reports about $75,616 saved and exactly 91 months cut
- true_apr(20000, 400, 0.07, 5) is 7.85% (to 2dp)
- dti(1250, 4000) == 0.3125 and ltv(200000, 250000) == 0.80
- A payment smaller than the monthly interest terminates via the loop bound instead of hanging

## How it is marked

| Points | Criterion | Meaning |
|--------|-----------|---------|
| 30 | Schedule correctness | Row counts, interest totals, month-1 split, and a final balance of exactly zero all match. |
| 20 | Scenario analysis | Term comparison, overpayment comparison, and the invest-instead question answered with numbers. |
| 15 | APR by bisection | Converges to 7.85% and is robust to different fee and term inputs. |
| 15 | Charts | Two labelled charts: the interest/principal split with crossover, and the two balance curves. |
| 10 | Risk ratios | DTI and LTV implemented with documented bands. |
| 10 | Shipped | Runs clean from top to bottom and is committed to your portfolio repo. |

---

Part of [FinQuest](../../README.md) · Level 6 of 10
