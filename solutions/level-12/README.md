# Level 12: The payout that half happened

> **payout-saga: the orchestrator that finishes what it started** · build project · difficulty 9/10

## Read this second

Attempt the build yourself first, then ask the FinQuest tutor for a hint, and only then open this folder.
Read the part you are stuck on, close the file, and retype the fix from memory. Copying the solution into
your own project skips the only step that actually teaches you anything.

## The brief

Build the service that pays merchants. It touches your ledger and a bank that rejects, times out and loses answers, and your own process dies in the middle. Measure how bad the naive version is, then add compensation, an unknown state and a sweeper, and prove that nothing is left broken.

**Scope:** Uses levels 4, 6, 8, 9 and 11. The bank is a simulator you write. The orchestrator can be a plain Python process with a scheduler: no workflow framework, because the point is understanding what one does for you.

## Files here

| File | What it is |
|------|------------|
| `saga/bank.py` | the other side: rejects, times out, remembers references |
| `saga/orchestrator.py` | the steps, with state committed before each external call |
| `saga/compensate.py` | the undo for each step, idempotent by constraint |
| `saga/sweeper.py` | the job that resolves everything left mid flight |
| `saga/stuck.py` | the query that should always return nothing |
| `bench/naive.py` | the version without any of this, for the numbers |
| `quiz-key.md` | all 15 drill answers with explanations |

## Run it

```bash
python -m bench.naive && python -m saga.orchestrator --runs 200 && python -m saga.sweeper
```

## Why the solution is shaped this way

- The naive orchestrator stays in the repository, because the fix only means something next to the failure. Measured over 200 payouts: 26 ended with money debited and nobody paid, which is 13.0%.
- Three causes, two categories. Nine rejections are failure, where the outcome is known. Seven timeouts and ten crashes after submitting are uncertainty, where it is not, and the two need different mechanisms.
- Compensation covers the known case. A rejected payout credits the merchant back as a new balanced transaction, which takes the inconsistent count from 26 to 17. The debit and its reversal both stay in the ledger: a semantic rollback, not a database one.
- A timeout writes the state `unknown` and stops. No retry, because that risks paying twice; no compensation, because that risks cancelling a real payment. Recording that we do not know is the only correct action available.
- The sweeper covers the unknown case. It asks the bank about every unfinished payout and finishes it: 17 turned out to have been paid, and the inconsistent count went to zero. With the sweeper but no compensation, nine are still broken, which is the argument for having both.
- The bank is idempotent on the reference we generate, which is why the lookup works and why no payout was sent twice. The reference is created once, at creation, and stored before the first attempt.
- Stuck detection is the last net: anything in a non final state for more than fifteen minutes is alerted on, because it catches the failures neither mechanism predicted.

## Where people get stuck

| Symptom | Cause |
|---------|-------|
| A payout went out twice | The reference was generated per attempt rather than once at creation, so the bank saw two different payouts. |
| A real payment was cancelled | Compensating on timeout. A timeout is uncertainty, not failure, and only the sweeper can resolve it. |
| After a crash, nobody knows what happened | State written after the external call instead of before it. Mark it submitting and commit, then call. |
| Money missing with no alert | A compensation that failed and was logged. There is nothing further back to unwind to, so it is a page. |
| Two sweepers processed the same payout | No for update skip locked on the query that picks up unfinished work. |

## Self-checks the solution satisfies

- The naive orchestrator leaves a measurable percentage of payouts debited and unpaid
- A rejected payout returns the money exactly once, even when the compensation runs three times
- A timed out payout lands in unknown, with no retry and no compensation attempted
- The sweeper marks as paid every payout the bank actually sent
- The sweeper compensates every payout the bank never received
- After compensation plus sweeping, no payout is left debited and unpaid
- With the sweeper but no compensation, the rejected payouts remain broken
- Two sweepers running at once never process the same payout
- Killing the process between any two steps leaves a state the sweeper can act on
- The stuck query returns rows when the sweeper is paused and none when it runs
- A thousand payouts with injected crashes end with every payout in a final state
- No bank reference is ever used for two payouts, and no payout is paid twice

## How it is marked

| Points | Criterion | Meaning |
|--------|-----------|---------|
| 25 | The problem measured | A naive version kept in the repository with its inconsistency rate, and the three causes named. |
| 25 | Saga done properly | Compensation per step, idempotent by constraint, run in reverse, with the measured improvement. |
| 20 | Uncertainty handled | An explicit unknown state, no guessing, and a sweeper that resolves every one of them. |
| 15 | Operable | State committed before each call, stuck detection with a threshold and a reason, skip locked sweepers. |
| 15 | Proven | The chaos test with its three assertions, and the before and after table in the README. |

---

Part of [FinQuest](../../README.md) · Level 12 of 20
