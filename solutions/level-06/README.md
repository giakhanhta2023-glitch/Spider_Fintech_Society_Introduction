# Level 6: The ledger in Postgres, and the query plan that proves it

> **ledger-db: the ledger, in a database that refuses bad money** · build project · difficulty 6/10

## Read this second

Attempt the build yourself first, then ask the FinQuest tutor for a hint, and only then open this folder.
Read the part you are stuck on, close the file, and retype the fix from memory. Copying the solution into
your own project skips the only step that actually teaches you anything.

## The brief

Take the level 4 ledger into Postgres properly: migrations, constraints, a deferred balance check, 400,000 rows of realistic data, measured query plans, and a reconciliation job. The README is half the work, because the numbers you measured are the part an interviewer will ask about.

**Scope:** Uses levels 4 and 5 plus this level. Postgres 16 or newer, in Docker or on a free hosted branch. Python with psycopg for the runner and the benchmark. No web framework yet: that is level 7.

## Files here

| File | What it is |
|------|------------|
| `migrations/` | numbered, forward-only SQL: schema, trigger, indexes, cached balance |
| `ledgerdb/migrate.py` | applies any file not already recorded in schema_migrations |
| `ledgerdb/seed.py` | 2,000 accounts and 400,000 balanced entries, generated inside SQL |
| `ledgerdb/transfer.py` | one transfer, one database transaction, idempotent by unique index |
| `ledgerdb/bench.py` | EXPLAIN ANALYZE for the balance query, three ways |
| `scripts/reconcile.sql` | cached balance against the entries: should return no rows |
| `quiz-key.md` | all 15 drill answers with explanations |

## Run it

```bash
export DATABASE_URL=... && python -m ledgerdb.migrate && python -m ledgerdb.seed && python -m ledgerdb.bench && pytest -q
```

## Why the solution is shaped this way

- Constraints carry the rules that must never be broken: the amount check, both foreign keys, and the unique idempotency key. They hold for every writer, including the ones that skip the application entirely, which is the whole reason to duplicate a check the API already does.
- The balance rule is a deferred constraint trigger. Checked per row it would fail every transfer, because after the first entry the transaction is unbalanced on purpose. Checked at commit it refuses exactly the transactions that are wrong, and leaves nothing behind when it fires.
- There is no balance column until the last migration, and when it arrives it comes with the query that checks it. Two numbers for one fact is a decision, not an accident, and the reconciliation job is the price of making it.
- The benchmark prints plans rather than opinions. On the reference database the balance query ran at 30.917 ms with 3,334 buffers on a sequential scan, 0.375 ms with 206 buffers on a plain index, and 0.106 ms with 6 buffers on a covering index with Heap Fetches: 0.
- Index sizes are reported next to the timings, because the cost side is half the answer: 26 MB of table, 2,872 kB for the account index, 13 MB for the covering one.
- entries.transaction_id is indexed. Postgres indexes the primary key side of a foreign key and not the referencing side, and the balance trigger queries by transaction_id once per row: 41.697 ms without the index, 0.112 ms with it.
- Migrations are numbered, forward-only and safe to run twice. The runner records what it applied, so a retried deploy is a no-op rather than an error.

## Where people get stuck

| Symptom | Cause |
|---------|-------|
| Every transfer fails the balance check | The trigger is not deferred. After the first entry the transaction is unbalanced on purpose. |
| Inserts get slower as the table grows | Something runs per row against an unindexed column. Index the referencing side of the foreign key. |
| EXPLAIN still says Seq Scan | Run analyze after creating the index, or the table is small enough that scanning really is cheaper. |
| The second migration run fails | The runner is applying files it already applied. Record them, and use if not exists. |
| Balances disagree with the entries | Something wrote an entry outside the trigger path, or a backfill ran while writes continued. The reconciliation query tells you which account and by how much. |

## Self-checks the solution satisfies

- Running the migration runner twice applies every file once and reports the second run as a no-op
- Inserting an entry with amount 0 raises a check constraint error
- Inserting an entry for an account id that does not exist raises a foreign key error
- Reusing an idempotency key raises a unique violation, and transfer() returns the original transaction id
- A transfer whose entries do not sum to zero is refused, and afterwards its transaction row does not exist
- After seeding, the sum of every entry in the ledger is exactly 0
- The balance query plan contains "Seq Scan" before the index and "Index Scan" or "Index Only Scan" after it
- The benchmark reports fewer buffers with the covering index than with the plain index
- A statement for one account ends at the same number the balance query returns
- The reconciliation script exits 0 normally and non-zero after you change a cached balance by hand
- A transfer that raises halfway through leaves no transaction row and no entries

## How it is marked

| Points | Criterion | Meaning |
|--------|-----------|---------|
| 25 | A schema that refuses bad data | Constraints, foreign keys, the deferred balance trigger, and a test proving each one fires. |
| 25 | Measured, not assumed | Three plans with your own times and buffer counts, index sizes reported, and the reasoning written down. |
| 20 | Correct writes | One transfer is one database transaction, idempotency enforced by a unique index, rollback proven by a test. |
| 15 | Operable | Numbered migrations, a runner safe to run twice, a reconciliation job with an exit code. |
| 15 | Explained | A README a reviewer can read in five minutes, ending with what you would change at a hundred million rows. |

---

Part of [FinQuest](../../README.md) · Level 6 of 10
