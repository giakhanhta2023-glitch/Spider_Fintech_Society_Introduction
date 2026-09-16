# Level 4: Payments and the double-entry ledger

## Read this second

Attempt the build yourself first, then ask the FinQuest tutor for a hint, and only then open this folder.
Read the part you are stuck on, close the file, and retype the fix from memory. Copying the solution into
your own project skips the only step that actually teaches you anything.

## The brief

The society is launching a little wallet for event tickets and merch, and you are writing the piece it all rests on. It needs a ledger that cannot lose money, cannot charge twice when the phone retries, and can explain every last cent to a treasurer.

**Scope:** Uses only this level: classes, dicts, lists, custom exceptions, integer arithmetic, f-strings. No pandas, no database, no external libraries beyond `datetime`.

## Files here

| File | What it is |
|------|------------|
| `ledger.py` | the ledger, the exceptions, eight test groups, and a worked demo |
| `quiz-key.md` | all 15 drill answers with explanations |

## Run it

```bash
python ledger.py
```

## Why the solution is shaped this way

- `_post` is the only method that appends, and it refuses anything that does not sum to zero. Every public method funnels through it, so the invariant cannot be bypassed by accident.
- Validation happens **before** any write. A refused transfer leaves `len(entries)` unchanged: the tests assert exactly that, because a half-written transaction is worse than a rejected one.
- The idempotency key is stored **after** a successful post. Storing it first would make a failed attempt permanently "already done".
- `reverse` writes the mirror image rather than deleting. The error and the correction both stay visible, which is what an audit needs.
- `split_payment` uses `divmod` and hands the leftover cents to the first recipients in order. Dropping the remainder would silently break the invariant.

## Where people get stuck

| Symptom | Cause |
|---------|-------|
| Ledger does not sum to zero | Something wrote one leg without its partner, or wrote before validating. |
| Retry creates a second transaction | Check the key at the very top of `transfer`, before any other work. |
| Cents lost on a split | `int()` truncates. Use `divmod` and allocate the remainder deterministically. |

## Self-checks the solution satisfies

- to_cents("19.99") == 1999 and to_cents("0.1") + to_cents("0.2") == to_cents("0.3")
- money(-2500) == "-$25.00"
- After deposit("alice", 10000), balance("alice") == 10000 and balance("world") == -10000
- transfer("alice", "bob", 2500, fee=50) leaves alice 7450, bob 2500, fee_income 50
- Calling that transfer twice with key="abc" posts once: len(ledger.entries) is unchanged and the same txn id comes back
- transfer("alice", "bob", 999999) raises InsufficientFunds and adds zero entries
- transfer("alice", "nobody", 100) raises UnknownAccount and adds zero entries
- transfer("alice", "bob", 0) raises InvalidAmount
- reverse(txn) restores both balances exactly and leaves the original entries in place
- split_payment("alice", ["b", "c", "d"], 100) posts 34 + 33 + 33 and check_invariant() passes
- check_invariant() returns True after every single operation above

## How it is marked

| Points | Criterion | Meaning |
|--------|-----------|---------|
| 25 | Invariant holds | Every path leaves the ledger summing to zero; check_invariant is asserted throughout the demo. |
| 20 | Validation and errors | All four error types raised in the right situations, always with zero entries written. |
| 20 | Idempotency and reversal | Duplicate keys post once and return the original id; reversals cancel without deleting. |
| 15 | Money discipline | Integers everywhere internally, formatting only at the edges, penny split allocated deterministically. |
| 10 | Tests | At least eight asserts covering happy path and every failure mode. |
| 10 | Readable output | Statement with a running balance; demo that tells a story a treasurer could follow. |

---

Part of [FinQuest](../../README.md) · Level 4 of 10
