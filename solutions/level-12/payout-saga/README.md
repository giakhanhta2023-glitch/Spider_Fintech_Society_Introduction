# payout-saga

Debit the ledger, then tell the bank. There is no transaction that covers both.

```bash
pip install -r requirements.txt
python -m saga          # the comparison below
python -m saga.chaos    # a thousand payouts with crashes injected
pytest                  # 16 tests
```

## The table that is the argument

200 payouts, a bank that rejects 6% and times out 5%, and our own process
dying after submitting 4% of the time. Same seed for both, so the only
difference is the orchestrator.

| | Naive | Saga |
|---|---|---|
| Inconsistent before the sweeper | **26 (13.0%)** | **17 (8.5%)** |
| Found to have actually been paid | 17 | 17 |
| **Still inconsistent afterwards** | **9** | **0** |

Read the bottom row, because it is the reason to build both mechanisms.

**The sweeper alone is not enough.** In the naive column it resolved all 17
uncertain payouts and nine were still broken, because a sweeper that asks "did
it go out" finds that the rejected ones did not, and has nothing to do about
it.

**Compensation alone is not enough.** It took 26 down to 17 and stopped,
because it cannot touch a payout whose outcome nobody knows: compensating one
that actually went out would send the money twice.

Together they leave nothing.

## The three causes, which are not the same problem

```
--- naive ---
   paid                                  174
   rejected, money still debited           9
   timeout, state unknown                  7
   crashed after submitting               10
   money debited with no payout           26   (13.0% of 200)
```

| Cause | Count | What you know |
|---|---|---|
| The bank rejected it | 9 | Exactly what happened. Nothing was sent |
| The bank never answered | 7 | **Nothing.** It may or may not have gone |
| We died after submitting | 10 | **Nothing**, and we have no record of trying |

The first is a **failure**: you know the outcome and can act on it, which is
what compensation is for. The other two are **uncertainty**, which is a
different thing and needs a mechanism that can establish the truth. Most
systems get the first right and never notice the second exists.

## Why the naive version stays broken

The naive orchestrator submits, gets a rejection, writes `failed`, and walks
away with the merchant still debited. `failed` is a **final** state, so nothing
ever revisits that payout: not the sweeper, not a retry, not a person. The
money is gone and no query in the system will ever say so.

That is the bug in one sentence, and it is in `store.py` as a comment on the
`FINAL` set, because it is the kind of thing that looks like a naming decision
and is actually the whole defect.

The saga never reaches `failed`. It compensates and ends at `compensated`,
which is final *and* has the money back.

## Why the sweeper found 17 that had already been paid

Because of one line in the bank simulator, and the same line is in every real
bank API:

```python
if our_ref in self.submitted:
    return self.submitted[our_ref]    # same answer, no second payout
```

The reference we generate, sent with every attempt, is what makes a retry safe
and a lookup possible. It is level 7's idempotency key, level 9's network
reference and this level's recovery mechanism: the same idea three times, which
is that **the sender names the operation so both sides can talk about it
afterwards**.

Generate it once, at creation, and store it before the first attempt. A
reference generated per attempt turns one payout into several and makes
recovery impossible. That is the single most common way payout systems pay
twice.

## The simulator tells the truth about timeouts

```python
if roll < self.timeout_rate:
    self.submitted[our_ref] = self._new_ref()   # it DID land
    raise BankTimeout("no answer")              # you just do not know
```

A timeout sometimes means "it worked and you did not hear". A simulator that
only times out on requests it did not process is a kinder world than the real
one, and code tested against it will pay somebody twice.

## Unknown is a state, not an error

On a timeout the orchestrator writes `unknown` and stops. No retry, no
compensation, four lines of code:

```python
except BankTimeout:
    self.store.set_state(payout, "unknown")
    return payout
```

Every instinct says to be helpful here. Retrying looks right and risks paying
twice. Compensating looks safe and risks cancelling a real payment. Recording
the truth, which is that we do not know, is the only correct action available,
and the sweeper is what turns it back into an answer.

## Stuck detection

The sweeper handles the known unknowns. The stuck query catches the category
nobody planned for: a payout in a perfectly normal state for far too long,
because a queue stopped or a bug never advances one kind of payout.

**Fifteen minutes**, and the reason is arithmetic rather than taste: the
sweeper runs every two minutes, so anything still unfinished after fifteen has
been past it seven times and is not going to resolve itself. Any row alerts,
and the oldest age goes on a dashboard.

## The chaos test

```
1,000 payouts, 8% rejected, 7% timing out, 6% crashing after submit

   compensated         84
   paid               916

   bank submissions          1,000
   distinct references         916

   every payout final        True
   balances match            True  (-5,035,296 against -5,035,296)
   no reference paid twice   True
   inconsistent payouts      0

   PASSED
```

Three assertions, and the third is the one that matters. Late is a support
ticket. Twice is money gone, usually to somebody with no reason to return it,
and it is the failure that ends careers in payments.

Every decision in this repository leans the same way:

| When you are unsure | Do this | Not this |
|---|---|---|
| The bank timed out | Record unknown, ask later | Retry blindly |
| A retry might duplicate | Send the same reference | Generate a new one |
| A compensation might have run | Make it idempotent, run it again | Guess that it did |
| A payout is stuck | Alert a human | Time it out and retry |

And the same logic decides the order of the first two steps: the debit happens
**before** the submission. A crash then leaves the merchant temporarily short
and the sweeper puts it back. The other way round leaves a payment sent with
nothing deducted, which is the same money leaving twice.

## Compensations are idempotent by constraint, not by care

```sql
insert into compensations (payout_id, kind) values ($1, 'refund_debit')
on conflict (payout_id, kind) do nothing
returning id;
-- ledger entries are posted only when a row came back
```

A compensation runs when things are already going wrong, which is exactly when
it will be retried, interrupted and run again. The unique key is the mechanism;
the caller remembering is not one. There is a test that runs a compensation
four times and asserts the merchant is credited once.

And a harder rule: **a compensation is not allowed to fail permanently.** If
crediting the merchant back is impossible, the money is simply missing and
there is nobody further back to unwind to. That is a page, not a log line.

## Tests

```
16 passed in 1.03s
```

Including all twelve the level asks for: the naive rate, compensation running
four times and crediting once, a timeout attempting nothing, the sweeper
finishing in both directions, two sweepers never claiming the same payout, a
crash leaving a state the sweeper can act on, the stuck query silent while the
sweeper runs and loud when it is paused, and the thousand payout chaos run.

## Limitations

- In memory, with the real schema in `postgres.sql`. The patterns are the
  subject; level 6 is where the storage lives.
- One compensating step, because the saga has one reversible step. A second
  step that can fail (a fraud check, a limit check) is the stretch goal, and
  the compensation logic grows faster than the step count does.
- The sweeper asks the bank directly. A bank with no lookup endpoint means the
  daily settlement file is the lookup and the sweeper becomes level 10's
  reconciliation: slower, same idea.
- No manual review queue. A payout the sweeper cannot resolve after N attempts
  should end up in front of a person, and here it would simply keep being
  swept.
