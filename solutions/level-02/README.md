# Level 2: The time value of money

## Read this second

Attempt the build yourself first, then ask the FinQuest tutor for a hint, and only then open this folder.
Read the part you are stuck on, close the file, and retype the fix from memory. Copying the solution into
your own project skips the only step that actually teaches you anything.

## The brief

The society is putting together a savings coach, and you are writing the engine behind it. Members tell it what they have, what they can add each month, and what they are saving for. Your job is to answer three questions for them: how much will I have, when do I reach my goal, and what is that really worth once inflation has had its share.

**Scope:** Everything you need is in this level: arithmetic with **, functions with defaults, for and while loops, if statements, f-string formatting. No libraries, no file reading, no classes.

## Files here

| File | What it is |
|------|------------|
| `compound_growth.py` | all eight functions, the report, and the self-checks |
| `quiz-key.md` | all 15 drill answers with explanations |

## Run it

```bash
python compound_growth.py
```

## Why the solution is shaped this way

- Every function is one formula. `plan_value` is the only one that composes others, which is what makes the rest trivially testable.
- `contributions_value` guards `i == 0` before dividing. That is not defensive padding: with no interest the answer genuinely is `payment × periods`, and the formula is undefined there.
- `years_to_target` is bounded by `max_years` and returns `None`. An unbounded search at a 0% rate never terminates, and returning `None` lets the caller say "not reachable" instead of crashing.
- Nothing rounds until an f-string. Rounding inside the loop compounds the error along with the interest.

## Where people get stuck

| Symptom | Cause |
|---------|-------|
| Compound result far too small | You used `^` instead of `**`. With a float rate that raises a `TypeError`; with whole numbers it silently computes XOR. |
| `ZeroDivisionError` | The annuity formula divides by `i`. Handle the zero-rate case before you divide. |
| Percentages 100× too big | `.2%` already multiplies by 100. Do not also multiply by hand. |

## Self-checks the solution satisfies

- future_value(1000, 0.08, 10, 1) is 2158.92 (to 2dp)
- future_value(1000, 0.08, 10, 12) is 2219.64 (to 2dp)
- contributions_value(200, 0.0, 10, 12) is exactly 24000: no crash
- contributions_value(200, 0.07, 20, 12) is 104,185.33 (to 2dp)
- apy(0.24, 12) is 0.2682 (26.82%)
- years_to_target(2000, 200, 0.07, 50000) returns 13
- years_to_target(100, 0, 0.0, 1000000) returns None rather than looping forever
- real_value(1_000_000, 0.03, 40) is 306,556.84 (to 2dp)

## How it is marked

| Points | Criterion | Meaning |
|--------|-----------|---------|
| 30 | Correct math | All eight functions return the values in the test list, including the zero-rate and unreachable-goal edge cases. |
| 20 | Readable output | Aligned table columns, consistent money and percentage formatting, a report a non-programmer could read. |
| 20 | Structure | Small single-purpose functions with docstrings and sensible default arguments; no copy-pasted blocks. |
| 15 | Scenarios and explanation | Three scenarios run, plus your own written explanation of accelerating interest. |
| 15 | Shipped | Notebook committed to your GitHub portfolio repo with a clear filename. |

---

Part of [FinQuest](../../README.md) · Level 2 of 10
