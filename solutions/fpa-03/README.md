# Level 03: The part you used to do by hand

> **close-pack: the pack, rebuilt as a program** · build project · difficulty 5/10

## Read this second

Attempt the build yourself first, then ask the FinQuest tutor for a hint, and only then open this folder.
Read the part you are stuck on, close the file, and retype the fix from memory. Copying the solution into
your own project skips the only step that actually teaches you anything.

## The brief

It is the third working day again. Produce the same pack you built by hand in level 1, from the same two files, with one command. It has to refuse to print when something is wrong, say what it repaired, and leave the commentary to you.

**Scope:** Python and pandas, as a small package with tests. No notebook, no Excel output, no database: the files are the input and the terminal is the output.

## Files here

| File | What it is |
|------|------------|
| `close-pack/closepack/load.py` | the three repairs, reported rather than silent, and the sign rule once |
| `close-pack/closepack/checks.py` | the gates, split into fatal and worth saying |
| `close-pack/closepack/pack.py` | the pack, the tie check, and the exit code |
| `close-pack/closepack/bridge.py` | price and volume, with the rounding difference returned rather than hidden |
| `close-pack/closepack/report.py` | the waterfall chart and the draft memo with its TODOs |
| `close-pack/tests/test_pack.py` | 15 tests, including one that breaks the pack to prove the check works |
| `quiz-key.md` | all 15 drill answers with explanations |

## Run it

```bash
python -m closepack.pack && python -m closepack.report && pytest -q
```

## Why the solution is shaped this way

- The argument for the script is not speed. The pack takes 39 ms here and about two seconds of the command is importing pandas, and once a month neither number matters. What matters is that the month is an argument, the checks run every time, and the thing can refuse: a spreadsheet cannot decline to show you a number.
- Everything ugly about the export is dealt with in the loader and reported: 317 rows after removing one duplicate journal, two text amounts repaired, one label trimmed. Silently cleaning an export means your pack disagrees with the file the accountant is looking at and neither of you knows why.
- The gates split into fatal and warning, and the split is a judgement about money. An unmapped account code means money in the ledger that appears nowhere in the pack, so the run stops. A cost centre budgeted with no actuals leaves the pack correct and needs a sentence. A gate that cries wolf is switched off within two months, and then the real one is off too.
- The check cell became an exit code, which is the part a spreadsheet cannot do. A scheduler or a colleague can act on a non zero exit without reading the output, and `test_the_check_catches_a_dropped_pack_line` removes a line from the layout on purpose and asserts the check complains.
- The generated memo leaves every cause as the word TODO. The script knows marketing is 210,000 over and cannot know that the campaign moved, and a tool that invents the reason is worse than no tool. What it does guarantee is that no material variance is ever missing from the list, which is what a person writing at 7pm gets wrong.
- A test caught a number in the output that was wrong by a factor of 159: the loader reported 318 text amounts repaired out of 318 rows, because one text value makes the whole pandas column an object and the count was measuring the dtype rather than the data. The fix measures what a plain conversion would have thrown away, which is two.
- The merge trap has its own test. A lookup table that gains one duplicate row raises revenue by a third with no error and no warning, and the habit that prevents it is one assertion or `validate="many_to_one"` on every merge against a lookup.

## Where people get stuck

| Symptom | Cause |
|---------|-------|
| A sum silently skips rows | One text value makes the whole column an object dtype. Convert at the boundary and count what needed converting. |
| Revenue is a third higher after a merge | A one to many join you thought was one to one. Use validate="many_to_one" and it raises instead. |
| The pack is missing a line and still ties | The check compared the pack to itself. Build the two sides by different routes. |
| The warnings scroll past unread | Too many things marked fatal, or too few. Decide the split on whether the pack would be wrong. |
| An account code with a leading zero stops matching | pandas read it as an integer. Pass dtype={"account_code": str}. |
| The generated memo says something untrue | A script that writes causes is guessing. Leave TODO and let the person fill it in. |

## Self-checks the solution satisfies

- python -m closepack.pack prints the pack and exits 0
- The loader reports 1 duplicate removed, 2 text amounts repaired and 1 label trimmed
- September revenue is 3,361,050 and EBITDA is 265,989, matching the pack you built by hand
- Running with --month 2025-08 produces August with no other edit
- Removing a line from the layout makes the check cell non zero and the command exit 1
- An unmapped account code stops the run and names the code
- The CC600 warning appears and does not stop the run
- The bridge sums to the transaction fee variance, with any rounding difference under a dollar and shown
- The tests pass from a clean checkout with no manual setup

## How it is marked

| Points | Criterion | Meaning |
|--------|-----------|---------|
| 25 | It ties | The pack agrees with the ledger, the check is printed every run and is the exit code. |
| 20 | It refuses | Fatal checks stop the run and name the problem; warnings do not. The split is defensible. |
| 20 | It is clean once | Repairs happen in the loader and are reported. Nothing downstream re-cleans anything. |
| 20 | It is tested | Tests cover the loader, the totals, the merge trap, and a check that is proven to fail when it should. |
| 15 | It is handed over | A README with the command, the numbers, and what the script deliberately does not do. |

---

Part of [FinQuest](../../README.md) · Analyst track, Level 03 of 5
