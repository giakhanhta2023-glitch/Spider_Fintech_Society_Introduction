# Level 11: The ledger that survives two writers

> **The ledger service** · build project · difficulty 8/10

## Read this second

Attempt the build yourself first, then ask the FinQuest tutor for a hint, and only then open this folder.
Read the part you are stuck on, close the file, and retype the fix from memory. Copying the solution into
your own project skips the only step that actually teaches you anything.

## The brief

The society is going to run a tab for its events: members top up, buy things, and get refunded, and nobody is going to accept "the spreadsheet says so". Build the ledger underneath it, in Postgres, so that two people spending at the same moment is a solved problem rather than a story.

**Scope:** Uses this level plus level 4 (double entry, minor units, reversal) and level 9 (a project layout, a virtual environment, tests). Postgres, psycopg, pytest. No ORM and no web framework: level 12 puts an API in front of this, and mixing the two is how people end up unable to say which layer broke.

## Files here

| File | What it is |
|------|------------|
| `schema.sql` | tables, constraints, the deferred balancing trigger, the balance trigger |
| `ledger/db.py` | connection and schema loading, nothing else |
| `ledger/core.py` | open_account, post, transfer, reverse, balance, statement |
| `ledger/audit.py` | reconcile, and the global sum that must be zero |
| `tests/test_concurrency.py` | two threads spending the same money, which fails without the lock |
| `quiz-key.md` | all 15 drill answers with explanations |

## Run it

```bash
docker run --name fq-ledger -e POSTGRES_PASSWORD=ledger -e POSTGRES_DB=ledger -p 5432:5432 -d postgres:16 && pip install -r requirements.txt && pytest -q
```

## Why the solution is shaped this way

- The balancing rule lives in a deferred constraint trigger rather than in `post`. Python still checks, for a better error, but the guarantee is the one that holds for psql, a migration and the second service somebody writes next year.
- Idempotency is a unique index and a caught `UniqueViolation`, not a select followed by an insert. The select version passes every test that runs one request at a time and double charges the first time two arrive together.
- `transfer` locks the accounts it touches in account id order before it reads a balance. Consistent ordering is what stops two transfers deadlocking on each other.
- Every public function takes a connection rather than making one, so the tests can run a whole scenario inside a transaction and roll it back, and so level 12 can hand it a pooled connection.
- Nothing updates or deletes an entry. A wrong transfer is reversed, and the grants in `schema.sql` make that a property of the role rather than a habit of the author.

## Where people get stuck

| Symptom | Cause |
|---------|-------|
| Every transfer fails with "does not balance" | The trigger is not deferred. It needs `deferrable initially deferred`, so it runs at commit rather than after the first leg. |
| The concurrency test passes without the lock | The threads are not overlapping. Sleep between reading the balance and writing, and give each thread its own connection. |
| `current transaction is aborted` | An earlier statement in the same transaction failed. Use `conn.transaction()` blocks so the rollback happens for you. |

## Self-checks the solution satisfies

- Applying the schema twice leaves the same tables and no error
- A transfer of 2,500 cents with a 50 cent fee writes three entries summing to zero
- An unbalanced insert is refused by the trigger at commit, and leaves no rows behind
- A transfer from an account with 1,000 cents for 2,000 cents raises before any row is written
- The same idempotency key twice returns one transaction id and leaves one set of entries
- Two threads each spending 40,000 cents from an account holding 50,000 end with exactly one success and one refusal
- Reversing a transfer returns both balances to their earlier values and leaves the original entries in place
- reconcile() is empty and the sum of every entry in the ledger is 0, after every test in the suite

## How it is marked

| Points | Criterion | Meaning |
|--------|-----------|---------|
| 25 | Correct under concurrency | The double spend test fails with the lock removed and passes with it. Locks are taken in a consistent order. |
| 20 | The database enforces the rules | Balancing, non zero amounts, account existence and idempotency are constraints, not if statements. |
| 20 | Atomic writes | Every write path is one transaction. A failure part way through leaves nothing behind, and there is a test that proves it. |
| 20 | Auditability | Append only, reversal rather than deletion, a working reconciliation, and a statement anybody could read. |
| 15 | Shipped | Runs from a clean clone with docker run and pytest. The README explains the schema and says what the service does not do. |

---

Part of [FinQuest](../../README.md) · Level 11 of 10
