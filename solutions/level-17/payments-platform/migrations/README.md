# Expand and contract, with the rollback window measured

Six deploys to replace one column, and the reason it takes six is the one rule
worth memorising:

> A migration and the code that needs it never deploy together.

Run against PostgreSQL 18.6 on 25,000 existing payments, with new payments
arriving between the steps. Both versions of the application's read query were
executed against the same rows at every step, which is what turns "the rollback
is safe" from a claim into a measurement.

    v1 reads:  (amount_minor * fee_bps) / 10000
    v2 reads:  fee_minor

| Step | What happened | v1 correct | v2 correct |
|---|---|---|---|
| 1. expand | `add column fee_minor`, nullable, on 25,000 rows, **7.4 ms** | yes | not deployed |
| 2. code writes both | 500 new payments, both columns populated | yes | yes |
| 3. backfill | 25,000 rows in 3 batches, 124.5 ms total, **longest single statement 49.4 ms** | yes | yes |
| 4. code reads the new column | both versions read all 25,500 rows, **0 disagreements** | yes | yes |
| 5. stop writing the old column | 200 new payments, `fee_bps` unmaintained, **200 rows now disagree** | **no** | yes |
| 6. contract | `set not null` on 25,700 rows 2.5 ms, `drop column` 3.8 ms | no | yes |

## The two rows that matter

**Step 4 is the one the level asks to be proved.** Rolling back at step 4 is a
plain revert, and it is safe because step 2 is still writing both columns. Zero
disagreements across 25,500 rows, including rows written seconds earlier. The
pull request for step 4 says:

```
Rollback: revert this deploy. No migration in this change. fee_bps is still
being written, so the previous version is correct.
```

**Step 5 closes the rollback window, and nobody writes that down.** From the
moment the code stops writing `fee_bps`, a revert to code that reads it returns
the wrong fee for every recent payment. Two hundred rows in this run. It does not
error, it does not appear in an error rate, and the first sign of it is a
reconciliation break several days later. The pull request for step 5 has to say:

```
Rollback: revert this deploy, THEN backfill fee_bps for rows created after it.
NOT a plain revert.
```

The honest way to run step 5 is to leave days between 4 and 5, so that confidence
in the new column is evidence rather than optimism. Doing 4 and 5 in one deploy
is what turns a reversible sequence into a one way door, and it is usually done
to save a week.

## What the timings do and do not say

**7.4 ms to add the column** is metadata only. PostgreSQL 11 and later add a
nullable column, or one with a constant default, without rewriting the table, so
this number is the same at 25,000 rows and at 200 million. Adding `not null` in
the same statement is not: that requires every existing row to satisfy it.

**49.4 ms as the longest statement** is the number that matters in the backfill,
not the 124.5 ms total. Level 13 measured the same shape on 415,554 rows: one
statement took 5,622 ms and held its lock for all of it, batches of 10,000 took
5,980 ms and held the longest lock for 280 ms. Batching is slower and the blast
radius is twenty times smaller.

**2.5 ms for `set not null`** is small because this table is small. It still
scans every row under an `ACCESS EXCLUSIVE` lock, so on a large table it is
minutes during which nothing can read or write. The way around it is a `not
valid` check constraint, `validate constraint` (which takes a weaker lock), and
then the conversion. On 25,700 rows, take the lock.

**Dropping a column does not reclaim space.** It marks the column dropped and
leaves the bytes in the pages until the rows are rewritten. `vacuum full` or
pg_repack reclaims it, both with their own costs, and for most tables the right
answer is to let autovacuum get there and not care.

## Reproducing it

The six files in this directory are the sequence. The verification is the pair of
read queries run at each step, which is four lines of SQL:

```sql
-- the disagreement count, which should be zero between steps 2 and 4
select count(*) from payments
 where (amount_minor * fee_bps) / 10000 is distinct from fee_minor;
```

Put that query in the pipeline for the duration of the migration. It is the
cheapest possible proof that a rollback is still available, and the day it stops
returning zero is the day the rollback plan changes.
