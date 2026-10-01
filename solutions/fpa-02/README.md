# Level 02: SQL for the month end close

> **The revenue query pack** · build project · difficulty 4/10

## Read this second

Attempt the build yourself first, then ask the FinQuest tutor for a hint, and only then open this folder.
Read the part you are stuck on, close the file, and retype the fix from memory. Copying the solution into
your own project skips the only step that actually teaches you anything.

## The brief

The head of finance wants the revenue story behind the September pack: who drove it, whether the growth is new merchants or old ones, and how much of it has actually been collected. She also wants to be able to ask for October without asking you again. Build a query pack she can run.

**Scope:** SQL against the four tables, in SQLite or PostgreSQL. Python only for loading the CSVs and running the queries. No pandas analysis: that is the next level.

## Files here

| File | What it is |
|------|------------|
| `query-pack/load.py` | six CSVs into one SQLite file, keys checked, amounts repaired at the boundary |
| `query-pack/queries.sql` | ten named queries, each with its question and the answer it gave |
| `query-pack/run_queries.py` | runs them all, and --verify checks eight recorded answers |
| `quiz-key.md` | all 15 drill answers with explanations |

## Run it

```bash
python load.py --check && python run_queries.py --verify
```

## Why the solution is shaped this way

- Every query carries the question it answers and the answer it gave at the September close, which turns the file into its own regression test. `--verify` checks eight of them mechanically and exits non zero if a closed month has moved, because a closed month moving is either a restatement nobody mentioned or a bug in the load.
- The verifier earned its place on the first run by failing twice. The tie out was 700,200 wrong in April, because one credit in the export is written in accounting brackets, SQLite stored it as text, and SUM treated it as zero with no error anywhere. The fix is in the loader rather than in the query, because a repair inside one query leaves the other nine wrong.
- The second failure was a rounding difference: four buckets each rounded to the dollar sum to a dollar more than the unrounded total. That one is a tolerance in the check with a comment saying so, and the tie out has no tolerance and never will, because a rounding allowance on a reconciliation is where the next real break hides.
- Keys are checked at load rather than assumed in ten queries. A duplicate in a lookup table multiplies revenue through every join with no error at all, so `load.py` refuses to finish if invoice_id or customer_id is not unique.
- Revenue is grouped on the revenue month rather than the invoice date. The company bills in arrears, so September usage is invoiced on 1 October, and grouping on issued_date returns 3,106,395 for September, which is August. Both queries are valid SQL and only one answers the question.
- The merchants with no invoice are found with a left join and kept, because five merchants signed in October and have not been billed yet. The difference between 235 merchants and 230 billed is the kind of number that ends up in a board pack, and an inner join would have hidden it.
- The database is SQLite because it needs nothing installed, which is what makes this runnable on the laptop a finance analyst already has. Every query is standard SQL apart from two date expressions, and the file carries the PostgreSQL form next to each.

## Where people get stuck

| Symptom | Cause |
|---------|-------|
| Revenue by month is a month behind the ledger | Grouped on the invoice date rather than the revenue month. Nothing raises, and the annual total is nearly right. |
| Revenue is exactly double | A join to a lookup table whose key is not unique. Count rows against count distinct before trusting any join. |
| A WHERE on the right hand table turns a left join into an inner one | The unmatched rows have NULL there and fail the comparison. Put the condition in the ON clause. |
| The average of the segment averages is 27% above the true mean | Averaging averages weights forty enterprise invoices the same as eighty seven small ones. |
| Unpaid invoices are missing from the result | WHERE paid_date != something drops NULLs. Only IS NULL tests them. |
| SUM returns a number that is far too low | A text value in a numeric column. SQLite treats it as zero rather than raising. |

## Self-checks the solution satisfies

- The loader runs twice in a row without error and leaves the same four tables
- Revenue by month for September returns 3,361,050 and agrees with the ledger
- The tie out query returns a non zero difference for exactly one month, 2025-06, of -4,820
- The segment query for September returns enterprise 1,565,293 across 40 invoices
- The ageing buckets sum to the total open balance of 6,329,912 across 415 invoices
- The top ten query returns Pennant Logistics first at 609,752 year to date
- The cohort query shows the 2023 cohort at 1,936,813 of September revenue
- Every query in the file has a question and a recorded answer above it
- Running the whole file end to end produces no errors on a fresh database

## How it is marked

| Points | Criterion | Meaning |
|--------|-----------|---------|
| 25 | Correct | The numbers match the ledger where they should and differ only where there is a real break, which is named. |
| 20 | Safe | Keys checked, join types chosen deliberately, nulls handled, the right date column used and said out loud. |
| 20 | Readable | Named queries, aliases that mean something, CTEs instead of nested subqueries, comments that say why rather than what. |
| 20 | Useful | The pack answers the questions a CFO actually asks, including the one about cash rather than revenue. |
| 15 | Repeatable | A parameter changes the month. Somebody else can run the file next month and get October. |

---

Part of [FinQuest](../../README.md) · Analyst track, Level 02 of 5
