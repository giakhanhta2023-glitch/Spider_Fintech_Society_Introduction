# september-pack

The close pack as a workbook, where every number is a formula and one cell proves
it ties to the ledger.

```bash
python build_workbook.py              # writes september-pack.xlsx
python check_workbook.py              # six checks on the workbook itself
python check_workbook.py --prove      # break it on purpose, prove the checks work
python expected.py                    # the same pack, computed a second way
```

## The pack

| Line | Actual | Budget | Variance |
|---|---|---|---|
| Transaction fees | 2,348,188 | 2,196,195 | +151,993 |
| Subscription fees | 757,800 | 801,000 | -43,200 |
| FX markup | 255,062 | 223,162 | +31,900 |
| Scheme and interchange | 1,336,038 | 1,168,942 | -167,096 |
| Cloud hosting | 121,444 | 121,444 | 0 |
| Salaries | 1,090,700 | 1,214,700 | +124,000 |
| Marketing programmes | 390,000 | 180,000 | -210,000 |
| Facilities and admin | 156,880 | 156,880 | 0 |
| **Revenue** | **3,361,050** | **3,220,357** | **+140,693** |
| **Gross profit** | **1,903,569** | **1,929,971** | **-26,402** |
| Gross margin | 56.6% | 59.9% | -3.3 points |
| **EBITDA** | **265,989** | **378,391** | **-112,402** |

Variances are signed so that **positive is always favourable to profit**, which is
one rule decided once rather than a sign a reader works out per line.

[MEMO.md](MEMO.md) is the other half of the deliverable, and the half that gets
read: five numbers, three variances with a cause and a consequence each, and three
decisions requested.

## The six tabs

| Tab | What it is | Rule |
|---|---|---|
| `pack` | The output. Month in `B2`, materiality in `B3` | Nothing else is typed |
| `actuals`, `budget` | The raw imports | Never edited, never sorted |
| `quality` | Four formulas: rows, distinct ids, non-numeric amounts, untrimmed labels | Run before any analysis |
| `map` | Account code to pack line to group | The only place the pack's shape is written down |
| `calc` | One row per ledger row: the amount as a number, the sign normalised, the line, whether the journal is a repeat | The boundary. Everything is cleaned here and nowhere else |

## What `check_workbook.py` proves

```
   ok  every number in the pack is a formula
   ok  every SUMIFS is driven by the month cell
   ok  the check cell is a formula, reaches the ledger, and is formatted red when not zero
   ok  every account code in both files is mapped
   ok  the calculations tab covers all 318 ledger rows
   ok  the quality formulas cover the whole range
```

And `--prove` pastes the **correct** value over one pack cell, exactly the way a
tired person does at 7pm, and asserts the checker notices:

```
pasted 2,348,188 over B6, which is the correct value
   ok    the checker caught it
```

That is the point of the negative test. The pasted number was right, this month,
and would have been silently wrong in October.

## The check cell

```
=ROUND((Revenue - Cost of sales - Operating expenses)
       - (SUMIFS(calc, group="revenue") - SUMIFS(calc, group="cogs")
          - SUMIFS(calc, group="opex")), 2)
```

The left side adds up the lines **in the layout**. The right side adds up every
ledger row for the month **by its group**, whatever the layout happens to
contain. So an account that gets mapped but never added to the pack, which is how
a report quietly starts under-reporting, turns the cell red. Conditional
formatting does the turning red; nobody has to remember to look.

## The three things wrong with the export

All three are in `fpa-actuals.csv`, all three are handled in `calc`, and all three
are named on the `quality` tab rather than quietly fixed:

| | Where | What the workbook does |
|---|---|---|
| Journal `JE000261` appears twice, 590,000 | June 2025 | A `first_time` column counts each journal id once. Nothing is deleted |
| `180,000.00` stored as text | March, marketing | `VALUE(SUBSTITUTE(...))` in the calc column |
| `(700,200.00)` stored as text, brackets meaning negative | April, subscription fees | The same formula, with `(` becoming `-` |
| `Cloud hosting ` with a trailing space | May | Grouping is on the account **code**, so the label never matters |

## One honest limitation

**No spreadsheet engine on this machine evaluates the formulas.** openpyxl writes
them and Excel or Sheets computes them when the file is opened. So this repository
proves two different things by two different means:

- **the shape**, by `check_workbook.py`, which opens the file and reads the
  formulas: every number is a formula, the ranges are complete, the check cell is
  wired to the ledger;
- **the values**, by `expected.py`, which computes the same pack from the same two
  files using nothing but the standard library, and prints the table at the top of
  this README.

What is *not* proved here is that the workbook, when opened, produces those
values. Opening it is one click and it is the first thing to do.

---

Part of [FinQuest](../../../README.md), analyst track, level 01.
