# monthly-close

The whole close, end to end. Raw files in, a pack somebody can read out, and a
non zero exit code if any of it is wrong.

```bash
python -m close.run                  # September 2025, six stages
python -m close.run --month 2025-08  # any closed month
python -m close.run --quiet          # the verdict and the timings only
pytest -q                            # 9 tests, about four seconds
```

## What one run looks like

```
Meridian Pay, close for 2025-09

   [ok  ] load the data                          180 ms
   [ok  ] check the data                          17 ms
           317 ledger rows, 1 duplicate journal removed, 2 text amounts
           repaired, 1 label trimmed
           [warning] CC600 is budgeted 96,000 and has no ledger rows
   [ok  ] build the pack                          27 ms
           revenue       3,361,050 against 3,220,357
           EBITDA          265,989 against   378,391
           tie to the ledger +0.00
   [ok  ] query the detail                        13 ms
           enterprise 40 invoices 1,565,293
           receivables 6,329,912 across 415 open invoices
   [note] reconcile billing to the ledger         17 ms
           2025-06: billing 3,012,917.75 against ledger 3,017,737.75,
           difference -4,820.00
   [ok  ] reforecast                               3 ms
           stress  FY2026 revenue 36.6m, EBITDA 0.4m, revolver 2026-09
           every scenario balances in every month

   6 stages, 258 ms
   written: close-2025-09.md and waterfall-2025-09.png
   1 stage(s) need a sentence in the commentary before this goes out
```

The six stages take **258 ms**. The whole command takes **about 4.4 seconds**,
almost all of which is starting Python and importing pandas and matplotlib.

## The three states a stage can be in

This is the design of the whole thing, and it is a judgement about money rather
than about data.

| | Means | What happens | Example here |
|---|---|---|---|
| `ok` | Nothing to say | Continue | The pack ties |
| `note` | Right, and somebody needs to know | Continue, and the run says so at the end | Billing and the ledger disagree by 4,820 in June |
| `STOP` | The output would be wrong | **Nothing after it runs, and nothing is written** | An unmapped account, a month the plan does not cover |

The reconciliation break is the interesting case. One month of billing detail
disagrees with the ledger by exactly one credit note, and that is **not** a
reason to refuse to close: it is a reason to name the row, put it in the
commentary, and send it to whoever posts the correction. A pipeline that treats
every difference as fatal never finishes a close; one that treats none of them as
fatal ships a wrong pack. `test_the_reconciliation_finds_the_credit_note_and_does_not_stop_the_close`
asserts exactly that distinction.

## Assembly, which is the actual exercise

Three earlier levels become one command:

| Stage | Where it came from |
|---|---|
| load the data | Level 1: every file into one SQLite database |
| check the data | Level 2: the loader's repairs and the fatal gates |
| build the pack | Level 2's implementation |
| query the detail | Level 1: segments, top merchants, receivables ageing |
| reconcile | New here, because it needs two systems that only now exist together |
| reforecast | Level 3, run from the month that just closed |

The earlier levels are **imported, not copied**. `close/_earlier.py` puts the two
sibling solution folders on the path and says in its docstring why that is a
compromise: in a real repository these would be one package or two installed
dependencies. Copying the pack code into this folder would have meant two
versions drifting apart from the first bug fix onwards, which is the exact
failure the whole track is about.

That import is itself tested. `test_the_earlier_levels_are_imported_rather_than_copied`
asserts the loaded modules actually live in `fpa-02` and `fpa-03`.

## What it writes

**`out/close-2025-09.md`**, in the order somebody reads rather than the order the
pipeline computed: five numbers, what moved, the revenue detail, what has not been
collected, whether billing agrees with the ledger, and what it means for next
year. Every cause is left as `TODO`, and the footer says which command produced
the file and that the pack ties to the ledger.

**`out/waterfall-2025-09.png`**, level 3's chart, from this run's pack.

## What is not here

- **No scheduler.** The close runs when somebody types the command. Wiring it to a
  cron job is a deployment decision, and the exit code is the part that makes it
  possible.
- **No email.** The document is a file. Sending it is a step that should have a
  person in it, at least until the TODOs are filled in.
- **No database server.** SQLite, because the whole point is that a finance
  analyst can run this on their own laptop with nothing installed. Every query in
  it is standard SQL apart from one date function, which level 2 names.
- **No Excel.** The pack prints and writes markdown. Level 1 is where a workbook
  is the deliverable.

---

Part of [FinQuest](../../../README.md), analyst track, level 04.
