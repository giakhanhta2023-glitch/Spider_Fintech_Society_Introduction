# close-pack

The September pack from level 1, rebuilt from the raw files by one command, with
the checks that let it refuse to print.

```bash
python -m closepack.pack                  # the pack, and the check that it ties
python -m closepack.pack --month 2025-08  # any month, no edit
python -m closepack.report                # the waterfall chart and a draft memo
pytest -q                                 # 15 tests, about five seconds
```

## What it produces

```
Meridian Pay, management pack, 2025-09

   line                            actual        budget      variance
   Transaction fees             2,348,188     2,196,195      +151,993  +
   Subscription fees              757,800       801,000       -43,200  *
   FX markup                      255,062       223,162       +31,900  +
   Scheme and interchange       1,336,038     1,168,942      -167,096  *
   Cloud hosting                  121,444       121,444            +0
   Salaries                     1,090,700     1,214,700      +124,000  +
   Marketing programmes           390,000       180,000      -210,000  *
   Facilities and admin           156,880       156,880            +0

   Revenue                      3,361,050     3,220,357      +140,693
   Cost of sales                1,457,482     1,290,386      -167,096
   Gross profit                 1,903,569     1,929,971       -26,402
   Operating expenses           1,637,580     1,551,580       -86,000
   EBITDA                         265,989       378,391      -112,402
   Gross margin                    56.6%         59.9%

   transaction fees, split
      volume effect       +313,938   volume +14.3% against plan
      rate effect         -161,944   take rate 0.5800% against 0.6200%
      sum                 +151,994   reported       +151,993   (+0.46 rounding)

   check: pack against ledger           +0.00   ok

   worth saying in the commentary:
      CC600 is budgeted 96,000 and has no ledger rows
      1 removed before totalling

   built in 39 ms
```

Plus `out/waterfall-2025-09.png`, which is the same story as one picture, and
`out/memo-2025-09.md`, which is the memo with the numbers filled in and the
causes left as `TODO`.

## The five decisions in it

**The sign rule is applied once.** Revenue is a credit in the export, so
`load.py` flips it at the boundary and nothing downstream thinks about signs
again. The spreadsheet version had that rule in one column and the text-amount
repair in another, and that was already its most fragile part.

**Cleaning is reported, not silent.** The loader returns how many duplicate
journals it dropped, how many text amounts it repaired and how many labels it
trimmed, and the pack prints them. Quietly fixing an export is how a pack starts
disagreeing with the ledger nobody else is cleaning.

**The gates decide whether the pack prints at all.** An unmapped account code or
a month missing from the plan is fatal: the pack refuses and names the problem.
A cost centre budgeted with no actuals is a warning, because the numbers are
right and somebody still needs to know. A gate that cries wolf is switched off
within two months.

**The check cell survived automation.** `check: pack against ledger` compares the
pack, built from `PACK_ORDER`, against every row in the month that is not below
EBITDA, built from the raw ledger. It therefore catches the realistic failure:
an account gets added, nobody adds it to the layout, and the report quietly stops
including it. `test_the_check_catches_a_dropped_pack_line` removes a line on
purpose and asserts the check complains, because a check that has never failed is
decoration.

**The memo leaves the causes blank.** The script knows what moved and by how
much. It does not know why, and a tool that invents the reason is worse than no
tool at all in a finance team. It writes `TODO: why` and that part stays a
person's job.

## Measured

| | |
|---|---|
| Building the pack | **39 ms** (median of seven runs, after the first) |
| The whole command, including starting Python and importing pandas | **2.2 to 4.0 s** |
| Tests | **15**, about five seconds |
| Ledger rows in, after removing the duplicate | 317 of 318 |
| Repairs the loader reported | 1 duplicate journal, 2 text amounts, 1 trimmed label |

Two seconds of the command is importing pandas, and 39 ms is the work. That is
worth knowing before optimising anything: for a monthly pack, none of it matters,
and the reason to automate this was never speed. It was that the month is an
argument, the checks run every time, and nobody can paste a value over a formula.

## A bug the tests found

`test_the_loader_reports_what_it_repaired` failed the first time it ran, and the
report it was checking said **318 text amounts repaired** out of 318 rows.

The cause is a pandas behaviour worth knowing: one text value anywhere in a column
makes the whole column an `object`, so every value in it is a Python string,
including the 316 that are perfectly good numbers. The count was measuring the
column's dtype rather than the data. The fix measures what actually matters, which
is how many values a plain conversion would have thrown away:

```python
text_amounts = int(pd.to_numeric(frame["amount"], errors="coerce").isna().sum())
```

Two, which is the comma amount in March and the bracketed credit in April. The
useful part is not the fix, it is that a number in the output was wrong by a
factor of 159 and looked entirely plausible until something asserted what it
should be.

## What is not here

- **No Excel output.** The pack prints and writes CSV. Level 1 is where a
  workbook is the deliverable, and rebuilding one here would be a worse workbook
  than the one that was built by hand.
- **No database.** This reads the CSV files directly, as an analyst receiving an
  export does. Level 2 is where the same numbers come out of SQL, and level 5 is
  where the two are joined into one pipeline.

---

Part of [FinQuest](../../../README.md), analyst track, level 02.
