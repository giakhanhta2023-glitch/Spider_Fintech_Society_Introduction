# Level 13: The table that outgrew the machine

> **payments-at-scale: partition it, migrate it, and let nobody notice** · build project · difficulty 9/10

## Read this second

Attempt the build yourself first, then ask the FinQuest tutor for a hint, and only then open this folder.
Read the part you are stuck on, close the file, and retype the fix from memory. Copying the solution into
your own project skips the only step that actually teaches you anything.

## The brief

You have five million payments in one table and a column that has to change. Partition the table, run a full expand and contract migration with a batched backfill, and do all of it with a load generator hammering the database, proving zero failed requests from start to finish.

**Scope:** Postgres only. No new services. The deliverable is the measurements and the migration scripts, and the acceptance test is the load generator: if it records a single failure, the migration is wrong.

## Files here

| File | What it is |
|------|------------|
| `bench/baseline.sql` | the plain table, measured before anything changed |
| `partition/create.sql` | monthly partitions, and the job that makes next month |
| `partition/compare.md` | pruning and the cost of pruning, with both plans |
| `migrate/001_expand.sql` | the nullable column, instant at any size |
| `migrate/backfill.py` | batched, key walking, resumable, with a sleep |
| `migrate/verify.sql` | the disagreement count that has to be zero |
| `load/generator.py` | the writer and reader that run through the whole migration |
| `quiz-key.md` | all 15 drill answers with explanations |

## Run it

```bash
psql -f bench/baseline.sql && python -m load.generator & python -m migrate.backfill
```

## Why the solution is shaped this way

- Partitioning is presented with both halves. The monthly aggregate went from 4,729 pages touched to 396 and from 19.7 ms to 13.7 ms, because a month is physically one table rather than rows scattered across the heap.
- And the cost, measured on the same data: a lookup by merchant went from one index scan to ten, and planning time from 0.188 ms to 0.898 ms, which is more than the query takes to execute. The README says which queries got worse and why the trade still pays.
- Retention is the real argument. Deleting one month took 47.2 ms, produced 2,947 kB of write ahead log and returned no disk. Dropping the partition took 0.9 ms, produced 5,400 bytes and returned all 5,336 kB immediately.
- The five migrations are measured with the lock each one takes. Adding a column with a constant default took 0.6 ms; the same line with gen_random_uuid() took 1,526 ms and 70 MB of log, because a volatile default rewrites the table under ACCESS EXCLUSIVE.
- Every migration file starts with lock_timeout and statement_timeout. The repository reproduces the lock queue on purpose: a long reader, a blocked migration, and a third session that cannot run a plain select.
- The backfill compares one statement against batches of 10,000. Same log, same bloat, 6% slower, and the longest lock held drops from 5,622 ms to 280 ms. The predicate keeps `fee_minor is null` so the job is idempotent and survives being killed.
- Verification uses `is distinct from` rather than `<>`, because null comparisons are null, so a plain comparison skips exactly the rows the backfill missed.
- The store for each workload is chosen from its access pattern rather than its volume, and written down: the ledger relational because the balancing invariant must be enforced by the database, counters and limits in Redis because they are hot and losable, files in object storage, analytics in a column store fed by change data capture, and the token lookup as the one genuinely key value workload in the platform.
- The acceptance test is the load generator: the full migration runs under continuous traffic and the report states failures and p99 latency, before and during.

## Where people get stuck

| Symptom | Cause |
|---------|-------|
| The endpoint got slower after partitioning | It does not filter on the partition key, so it scans every partition and pays the planning cost too. |
| Inserts failed at midnight on the first | Nobody created next month partition. Automate it and alert when fewer than two future months exist. |
| A one second migration took the site down for four minutes | It queued behind a long reader, and everything else queued behind it. lock_timeout prevents this. |
| The backfill died at hour five and undid everything | One transaction instead of batches. Atomicity across the whole job is not the property you need. |
| Each backfill batch was slower than the last | offset, which counts through every skipped row. Walk the primary key instead. |
| A refund vanished after the page reloaded | The read went to a replica that had not caught up. Read your own writes goes to the primary. |
| "We would put the ledger in DynamoDB for scale" | Nothing enforces that every transaction balances, and at a few terabytes a year the write throughput was never the constraint. |

## Self-checks the solution satisfies

- The partitioned table returns identical results to the plain one for every baseline query
- A monthly aggregate touches one partition, and the plan proves it
- Dropping a month returns the disk immediately, and deleting a month does not
- Inserting a payment dated next month succeeds, because the partition already exists
- The future partition check fails when fewer than two future months exist
- A migration blocked on a lock gives up within lock_timeout instead of queueing
- The backfill can be killed at any point and restarted with no duplicated work
- Running the backfill twice changes nothing the second time
- The verification query returns zero after the backfill and after new writes
- A load generator running through the entire migration records zero failed requests
- The p99 latency during the migration is reported honestly, whatever it is

## How it is marked

| Points | Criterion | Meaning |
|--------|-----------|---------|
| 25 | Partitioning, both sides | Pruning proved and the cost measured, including planning time, with a written trade-off. |
| 20 | Retention | Drop against delete measured, future partitions automated, and the alert that catches the gap. |
| 20 | Migrations understood | The five costs measured, the lock queue reproduced, and timeouts in every migration. |
| 20 | The backfill | Batched, key walking, idempotent, resumable after a kill, verified with a query that returns zero. |
| 15 | Nobody noticed | Load generator through the whole migration with zero failures and an honest latency report. |

---

Part of [FinQuest](../../README.md) · Level 13 of 20
