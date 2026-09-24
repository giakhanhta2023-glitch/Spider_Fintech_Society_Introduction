# payments-at-scale

Partition it, migrate it, and let nobody notice.

```bash
pip install -r requirements.txt
export DATABASE_URL=postgresql://localhost/payments
psql -f sql/01_baseline.sql        # measure before changing anything
psql -f sql/02_partition.sql       # both halves of what partitioning costs
psql -f sql/03_migrations.sql      # five migrations, three free, two outages
python -m scale.partitions --ensure
python -m scale.loadgen --seconds 300 &   # then run the migration
python -m scale.backfill --batch 10000
```

Every number below was measured on Postgres 18 with 500,000 payments. Small,
and the ratios are what carry over: they get worse as the table grows, never
better.

## Partitioning, both halves

**What it buys you**, on a monthly aggregate:

| Same query, same 42,920 rows | Plain table | Partitioned |
|---|---|---|
| Plan | Bitmap index scan on the whole table | Sequential scan of one partition |
| Pages touched | 4,729 | **396** |
| Execution time | 19.7 ms | **13.7 ms** |

The time is not the interesting column, the pages are. On the plain table July
is scattered across the whole heap, so 42,920 rows live in 4,609 separate
blocks. In the partitioned table July *is* a table, so the same answer costs a
twelfth of the reads, and the pruned scan stays the size of one month forever.

**What it costs**, on a query that does not mention the partition key:

| Find one merchant's payments (67 rows) | Plain table | Partitioned |
|---|---|---|
| Index scans | 1 | 10, one per partition |
| **Planning time** | **0.188 ms** | **0.898 ms** |
| Execution time | 0.222 ms | 0.342 ms |

Read the planning row. The planner opens ten partitions and ten indexes to plan
a query that executes in a third of a millisecond, so **planning now costs more
than the work**. With a hundred partitions it is worse.

### Which of my queries got worse, and why the trade is worth it

Worse: every lookup by merchant, by reference, or by id alone. They went from
one index scan to ten, and their planning time quadrupled past their execution
time. For an endpoint doing thousands of these a second, that is real.

Better: every report, every statement, every export, and above all retention.

The trade is worth it here because **retention is the problem partitioning is
actually solving**, and the numbers are not close:

| Removing one month (about 42,000 payments) | DELETE | DROP the partition |
|---|---|---|
| Time | 47.2 ms | **0.9 ms** |
| Write ahead log | 2,947 kB | **5,400 bytes** |
| Disk returned | **none**: the table stayed 57 MB | all 5,336 kB, immediately |
| Left behind | dead rows for vacuum | nothing |

Fifty times faster, five hundred times less log, and the space comes back.
A `DELETE` does not shrink a table: it marks rows dead and the space is reused
for future rows, so a table you delete from nightly stays permanently large
even though the row count is flat.

The mitigation for the cost side is that the lookups which got worse are the
ones most easily fixed another way: they are served from the level 14 cache,
and the ones that are not can carry the partition key. A lookup by payment id
that also knows the payment's month prunes to one partition and is back to one
index scan.

## Five migrations, three free and two outages

| Migration | Time | Log | What it locks |
|---|---|---|---|
| `add column region text` | 0.7 ms | 504 bytes | Brief exclusive, catalog only |
| `add column tier text not null default 'standard'` | 0.6 ms | 2,208 bytes | Same: the default is stored, not written |
| `add column token uuid not null default gen_random_uuid()` | **1,526 ms** | **70 MB** | Everything, for the whole rewrite |
| `alter column amount_minor type numeric` | **837 ms** | **67 MB** | Everything, plus every index rebuilt |
| `create index on payments (merchant_id)` | 254 ms | 2,590 kB | Writes blocked, reads fine |

Rows two and three differ by one word. A constant default is recorded once in
the catalog and applied as rows are read, so it is instant at any table size.
A **volatile** default such as `gen_random_uuid()` has to produce a different
value per row, so Postgres rewrites the entire table under `ACCESS EXCLUSIVE`.

And remember the scale: that 1,526 ms is on 415,554 rows. At two hundred
million it is closer to twelve minutes, and twelve minutes of `ACCESS
EXCLUSIVE` on the payments table is a full outage.

## lock_timeout, and the queue it prevents

```sql
set lock_timeout = '3s';
set statement_timeout = '30s';
```

Postgres lock queues are **fair**, and that is the trap. A migration waiting
for `ACCESS EXCLUSIVE` makes every query arriving after it wait too, including
ones that conflict with nothing. A one second migration stuck behind a four
minute reporting query takes the table down for four minutes while executing
nothing at all.

Three seconds: long enough to acquire a lock on a healthy system, short enough
that failing costs nothing because the deploy tool retries. **Failing is fine.
Queueing is not.**

`sql/03_migrations.sql` has the three-session reproduction. It is worth doing
once with your own hands, because reading about it does not produce the same
alarm as watching a plain `select` hang behind a migration that has not started.

## The backfill

| | One `update` | Batches of 10,000 |
|---|---|---|
| Total time | 5,622 ms | 5,980 ms (6% slower) |
| Write ahead log | 180 MB | 180 MB |
| Table grew | 61 MB to 125 MB | 64 MB to 128 MB |
| **Longest lock held** | **5,622 ms** | **280 ms** |
| If it dies halfway | all of it rolls back | 49 batches are done |
| Can you pause it | no | yes, between any two |

The middle rows are the surprise: batching saves no time, no log and no space.
Every row is rewritten either way, which is why the table doubled in both
cases. What changes is the **lock duration and the blast radius**.

Three details that matter more than they look:

**Walk the primary key, never `offset`.** `offset 900000` makes the database
count through 900,000 rows to skip them, so each batch is slower than the last
and the job degrades into quadratic time.

**Keep `and fee_minor is null` in the predicate.** It makes the job idempotent.
Verified: a first pass updated 4,182 rows and an identical second pass updated
**0**, with the verification query returning zero disagreements.

**Sleep between batches.** A backfill with no pause produces log faster than
replicas can replay it, and you find out by watching the lag climb.

## The verification query

```sql
select count(*) as disagreements
  from payments
 where fee_minor is distinct from round(amount_minor * 0.029 + 30, 2);
```

`is distinct from` rather than `<>`, because `null <> anything` is null rather
than true, so a plain comparison silently skips exactly the rows the backfill
missed. Those are the only rows you are looking for.

## Future partitions

A partitioned table with no partition covering tomorrow fails every insert at
midnight on the first. It is the most predictable outage in this level and it
still happens, because the job runs monthly and nothing watches the job.

`scale/partitions.py` creates three months ahead and alerts when fewer than
**two** future months exist. Two rather than one, because one month of warning
means the alert and the failure can land in the same week, and this should be a
ticket rather than a page.

## Store choice

`STORES.md` answers requirement 15: the ledger, the rate limiter, the token
lookup and the analytics copy, with the reason for each. The short version is
that the ledger is relational because its invariant must be enforced, the rate
limiter is Redis because its data is losable, and **the token lookup genuinely
belongs in a wide column store**, which is the one most people get wrong in the
other direction.

## What was verified where

**Re-verified against Postgres 18 while writing this repository:** the backfill
predicate's idempotency (4,182 rows then 0) and the verification query
returning zero.

**Measured earlier in the same database:** every table above. The pruning
plans, the retention comparison, the five migration costs, and the backfill
timings.

**Yours to produce:** the lock queue reproduction and the load generator run,
because both need several concurrent sessions against a database you control.
The scripts are here and the expected shapes are documented.

## Limitations

- Partitioning is done by building a new table and copying. Converting an
  existing table online with `attach partition` and a shadow copy is the
  harder version and the stretch goal.
- The load generator reports latency honestly but does not separate queue time
  from service time, which level 14 does and which would be better here too.
- No read replicas. The routing rules are in the level and the measurement is
  not, because a second Postgres is more infrastructure than this repository
  assumes.
