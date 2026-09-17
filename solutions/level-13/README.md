# Level 13: The log is the truth, the balance is an opinion

> **The event sourced account service** · build project · difficulty 9/10

## Read this second

Attempt the build yourself first, then ask the FinQuest tutor for a hint, and only then open this folder.
Read the part you are stuck on, close the file, and retype the fix from memory. Copying the solution into
your own project skips the only step that actually teaches you anything.

## The brief

The society's treasurer asks a question the level 11 ledger cannot answer: what did every member owe at the end of last term. Rebuild the account service so that the log is the record, every balance is derived, and any question about any past moment is one fold away.

**Scope:** Uses this level plus level 11 (Postgres, transactions, unique constraints) and level 9 (tests, layout). No framework and no message broker: the point is that event sourcing is a table and a fold, and that you can see every part of it.

## Files here

| File | What it is |
|------|------------|
| `schema.sql` | events, snapshots, balances, and the revoked permissions |
| `es/log.py` | append with an expected sequence, read, ConcurrencyError |
| `es/projections.py` | apply and project, pure and testable without a database |
| `es/commands.py` | the handlers that validate, append, and re-decide on a collision |
| `tests/test_replay.py` | the rebuilt read model against the live one |
| `quiz-key.md` | all 15 drill answers with explanations |

## Run it

```bash
docker run --name fq-es -e POSTGRES_PASSWORD=es -e POSTGRES_DB=es -p 5432:5432 -d postgres:16 && pip install -r requirements.txt && pytest -q
```

## Why the solution is shaped this way

- `append` does not validate anything. Events are facts, so the only thing that can refuse them is the command handler that decides whether the fact should happen, and keeping the two apart is what lets a reader trust the log.
- Concurrency is the unique constraint on (stream, seq). A collision sends the handler back to the top to read and decide again, never straight back to the append, because the second version would be a decision made against a state that no longer exists.
- `apply` and `project` take plain dictionaries and return plain dictionaries. Most of the test suite needs no database at all, which is the practical benefit of a pure fold.
- Old event versions are upcast on read. Nothing rewrites a stored event, because the point of the log is being able to prove what the system was told at the time.
- The snapshot test deletes every snapshot and asserts no answer changed. A snapshot that is load bearing is a stored state that can drift, which is the thing this design exists to avoid.

## Where people get stuck

| Symptom | Cause |
|---------|-------|
| The retry loop double spends | It is retrying the append rather than the decision. Go back to reading the stream. |
| Replay does not match the live model | Trust the log and rebuild. Then find the write path that changed the projection without an event. |
| A version 1 event crashes the projection | The upcast is missing or runs after the apply. Upcast on read, before anything folds it. |

## Self-checks the solution satisfies

- Appending twice at the same expected_seq raises ConcurrencyError exactly once
- apply() and project() run on a plain list of dictionaries with no database
- A withdrawal larger than the balance raises before any event is appended
- balance_at returns the correct figure at three moments, including one before the account existed
- Rebuilding the balances table from the log reproduces it exactly
- A version 1 MoneyTransferred event projects the same balance after version 2 ships
- Deleting every snapshot changes no answer the service gives
- Two threads withdrawing 80 from 100 leave one success, one refusal, and no gap in the sequence numbers
- The application role cannot UPDATE or DELETE an event, proved by a test that expects the failure

## How it is marked

| Points | Criterion | Meaning |
|--------|-----------|---------|
| 25 | The log is the truth | Nothing updates or deletes an event, corrections are events, and the replay test passes. |
| 20 | Concurrency handled | Optimistic append, and handlers that re-read and re-decide rather than retrying blindly. |
| 20 | Projections are pure | apply and project touch nothing but their arguments, and are tested without a database. |
| 20 | Time and versions | balance_at works at arbitrary moments, old event versions still project, and snapshots are provably only a cache. |
| 15 | Shipped | Runs from a clean clone, tests pass, and the README says what the events hold and what they deliberately do not. |

---

Part of [FinQuest](../../README.md) · Level 13 of 10
