# 3. A payout scheduler

## Requirements

**Functional.** Pay each merchant what they are owed, on their schedule. Never pay
twice. Never leave a merchant debited with no payment. Handle bank rejections and
retries.

**Non functional.** 99.5% of payouts reach a final state within 15 minutes.
Correctness has no budget: zero payouts may sit in a non final state with the
merchant debited.

## Estimation

| Input | Value | Where it comes from |
|---|---|---|
| Merchants | 500 | Level 16's cardinality work |
| Payouts a day | 500 to 5,000 | Daily for most, hourly for the largest |
| Bank call | 200 ms to 2 s | The slow dependency, and the reason for the queue |
| Throughput needed | about 1 a second | 5,000 a day, peaked into a few hours |
| Amount per payout | thousands of dollars | Which is why the correctness objective has no budget |

One payout a second is nothing, and that is the point: the hard part here is
correctness under failure rather than throughput. A design that leads with
sharding has misread the problem.

## Data model

```
payouts     id, merchant_id, amount_minor, state, our_reference UNIQUE,
            bank_reference, debited BOOLEAN, attempts, updated_at
            INDEX (state, updated_at)        -- the sweeper's query
compensations  payout_id, kind, at           -- UNIQUE (payout_id, kind)
```

`our_reference` is generated once, at creation, before any attempt. That single
decision is what makes a timeout recoverable: the bank can be asked about a
reference that already existed.

The unique key on compensations is what makes a compensation idempotent by
constraint rather than by care. Running it three times credits the merchant once,
and the database enforces that rather than the caller remembering.

## Diagram

```
  [ capture events ] -> [ scheduler ] -> [ bank API ]
                             |               |
                        [ payouts ]    timeout -> unknown
                             |
                        [ sweeper ] -> asks the bank -> paid | compensated
```

## Failure modes

| What fails | Consequence | Design response |
|---|---|---|
| Bank times out | The payout may or may not have happened | State is `unknown`, never `failed`. The sweeper asks about `our_reference` |
| Bank rejects | The merchant was debited | Compensate, idempotently, and end at `compensated` |
| Scheduler dies mid payout | A payout in a non final state | Every state change is committed before the next step starts, so a new process picks it up |
| Ledger unavailable at payout time | Money could move unrecorded | Refuse to call the bank at all. Measured in the capstone: the first version called the bank first and lost one payout in four hundred |
| Two schedulers running | Two payments | `for update skip locked` on the claim query, so a claimed payout is skipped rather than duplicated |

## What to monitor

The count of payouts in a non final state older than fifteen minutes, which pages
with no budget. The age of the oldest pending payout. The sweeper's own heartbeat,
because a dead sweeper is invisible in every other metric. Bank call latency and
error rate, separated, because slow and failing need different responses. And the
one that finds the worst case: payouts where `debited` is true and the state is
not `paid`.
