# Level 4: Payments and the double-entry ledger

> **Mini ledger and payment engine** · build project · difficulty 4/10

## Read this second

Attempt the build yourself first, then ask the FinQuest tutor for a hint, and only then open this folder.
Read the part you are stuck on, close the file, and retype the fix from memory. Copying the solution into
your own project skips the only step that actually teaches you anything.

## The brief

The society is launching a little wallet for event tickets and merch, and you are writing the piece it all rests on. It needs a ledger that cannot lose money, cannot charge twice when the phone retries, and can explain every last cent to a treasurer.

**Scope:** Uses only this level: classes, dicts, lists, custom exceptions, integer arithmetic, f-strings. No pandas, no database, no external libraries beyond `datetime`. **This is the first build in the course that needs object oriented code**: you should be able to read a class, make an object from it, and say what `self` means. The knowledge section The Python this level needs covers exactly that much, and the tutorial builds the first class one line at a time.

## Files here

| File | What it is |
|------|------------|
| `ledger.py` | the ledger, the exceptions, eight test groups, and a worked demo |
| `replay.py` | a day of real traffic driven through it: 77 instructions, 4 of them refused |
| `quiz-key.md` | all 15 drill answers with explanations |

## Run it

```bash
python ledger.py && python replay.py
```

## Why the solution is shaped this way

- `_post` is the only method that appends, and it refuses anything that does not sum to zero. Every public method funnels through it, so the invariant cannot be bypassed by accident.
- Validation happens **before** any write. A refused transfer leaves `len(entries)` unchanged: the tests assert exactly that, because a half-written transaction is worse than a rejected one.
- The idempotency key is stored **after** a successful post. Storing it first would make a failed attempt permanently "already done".
- The level had no data to practise on, which was a gap: every other build level from 3 to 12 hands you a file and this one asked the reader to invent their own transactions. `data/level-04-instructions.csv` is a day at the society wallet, 77 instructions over 12 accounts, and `replay.py` drives it through the ledger one row at a time.
- Four of the seventy seven are there to be refused, one per failure the level teaches: an overdraft, an account nobody opened, an amount of zero, and a payment that arrives twice with the same key. The replay counts them by reason and carries on, because a batch that dies on the first bad row is a batch somebody has to babysit at six in the morning.
- The reversal instruction names the payment it cancels by its idempotency key rather than by a transaction id, because a file written the night before cannot know the id the ledger will hand out tomorrow. The replay keeps its own key to id map, which is the same map the idempotency check already needs.
- The expected answer is known before any code runs: the generator prints the closing balances it built, and the replay prints the ones the ledger arrived at, and they agree. 169 entries summing to zero, fee income of $8.75, and alice closing at $42.26.
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
- Replaying the day posts 9 deposits, 62 transfers, 1 split and 1 reversal
- The replay refuses exactly 3 instructions, one per reason, and ignores 1 repeated key
- After the replay the ledger holds 169 entries summing to zero, fee_income is $8.75 and alice closes at $42.26

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

Part of [FinQuest](../../README.md) · Level 4 of 20
