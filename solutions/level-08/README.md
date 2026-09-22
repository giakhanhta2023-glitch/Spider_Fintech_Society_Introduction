# Level 8: Eight requests, one balance, minus $540

> **race-lab: break it, fix it three ways, measure all three** · build project · difficulty 8/10

## Read this second

Attempt the build yourself first, then ask the FinQuest tutor for a hint, and only then open this folder.
Read the part you are stuck on, close the file, and retype the fix from memory. Copying the solution into
your own project skips the only step that actually teaches you anything.

## The brief

Write the test rig that overdraws an account on purpose, then fix it with a lock, with serializable isolation, and with a constraint. Measure each. Put a connection pool behind your level 7 API and show what it did. The deliverable is the evidence, more than the fix.

**Scope:** Uses levels 6 and 7. Postgres, psycopg, psycopg_pool, threads. No new frameworks.

## Files here

| File | What it is |
|------|------------|
| `bench/race.py` | the workers, the barrier, and the three modes |
| `bench/pool.py` | the same workload with no pool, a right sized pool and a small one |
| `migrations/0005_balance_constraint.sql` | the check that makes an overdraft impossible |
| `tests/test_concurrency.py` | the reproduction, as a test that fails without the fix |
| `quiz-key.md` | all 15 drill answers with explanations |

## Run it

```bash
python -m bench.race naive && python -m bench.race for_update && python -m bench.race serializable && python -m bench.pool
```

## Why the solution is shaped this way

- Connections are opened before the barrier. Staggered handshakes are the reason a race test passes by accident, and this one has to fail every time or it proves nothing.
- The naive mode is kept in the repository on purpose. A fix nobody has seen fail is a claim, and the point of this project is evidence.
- Three fixes, three different costs. The row lock is correct with no retries and makes spending from one account single file: measured at 691 ms against 367 ms for the broken version. Serializable is faster here at 368 ms and moves the cost to every caller, who must retry, which is only safe because level 7 made writes idempotent.
- The constraint is the one that survives a new code path. A lock protects the code that takes it; a check on the balance column protects the account from code that has not been written yet.
- The isolation level is set per transaction, never as a session SET. Behind a transaction mode pooler a session setting is silently discarded, which was measured while writing this level: show transaction_isolation reported read committed immediately after setting serializable.
- The pool table is the argument for measuring rather than assuming: 31.4 requests a second with no pool, 127.1 with a pool of 8, and 30.8 with a pool of 2. A pool that is too small is a queue, and the wait does not appear in any query timing.
- Waiting for a connection is recorded as its own metric, separately from query time. That single number is how you tell a slow database from a starved pool.

## Where people get stuck

| Symptom | Cause |
|---------|-------|
| The naive run does not overdraw | The workers are not concurrent. Open every connection before the barrier and check the barrier count matches the worker count. |
| Serializable makes no difference | A pooler discarded the session setting. Set the isolation level per transaction and print show transaction_isolation to prove it applied. |
| Everything deadlocks once two accounts are locked | Lock ids in a consistent order, lowest first, so a cycle cannot form. |
| Throughput does not improve with a pool | The pool is smaller than the concurrency, so requests queue for a connection instead of using the database. |
| The service hangs under load instead of failing | No acquire timeout on the pool. An exhausted pool should return 503 with Retry-After, not an unbounded queue. |

## Self-checks the solution satisfies

- The naive mode ends with a negative balance on ten runs out of ten
- The row lock mode ends with a balance of exactly 2000 and one successful spend
- The serializable mode ends with a balance of exactly 2000, and any retries are counted and reported
- Eight workers spending 1000 each from 10000 all succeed under the row lock, ending at 2000
- `show transaction_isolation` inside a transaction prints serializable in that mode
- With the check constraint in place, the naive worker still cannot produce a negative balance
- The pool benchmark reports higher throughput for a right sized pool than for no pool
- The pool benchmark shows a too small pool performing no better than no pool
- Removing the fix from the API makes the concurrency test fail
- An exhausted pool returns 503 with a Retry-After header rather than hanging

## How it is marked

| Points | Criterion | Meaning |
|--------|-----------|---------|
| 25 | A reproduction that always fails | Connections opened before a barrier, the overdraft on every run, and the test rig in CI. |
| 25 | Three fixes, understood | Lock, serializable with retries, and a constraint, each working, each with its cost stated. |
| 20 | Measured | Timings for each fix, the pool table with p50, p95 and throughput, and connection wait recorded separately. |
| 15 | Carried into the service | The API cannot overdraw under concurrent calls, and fails fast when the pool is exhausted. |
| 15 | Defended | A README paragraph choosing one approach for this system and saying what it costs. |

---

Part of [FinQuest](../../README.md) · Level 8 of 10
