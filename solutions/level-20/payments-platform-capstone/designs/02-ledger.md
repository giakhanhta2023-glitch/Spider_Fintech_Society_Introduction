# 2. A ledger service

## Requirements

**Functional.** Record every movement of money as a balanced double entry
transaction. Answer the balance of any account as of any instant. Never lose or
alter a record. Support reversal without deletion.

**Non functional.** Writes durable before acknowledgement. Reads of a current
balance under 50 ms. Retention measured in years, because the regulator's question
is about three years ago.

**The invariant.** Every transaction sums to zero, and nothing may bypass the
check. If that can be violated, every other number in the company is an opinion.

## Estimation

| Input | Value | Where it comes from |
|---|---|---|
| Entries per payment | 5 | Capture (3) plus payout (2), measured in the capstone |
| Entries a month | 657 million | 131 million payments x 5 |
| Row size | about 120 bytes | Level 6's schema |
| Storage a year | about 950 GB | Before indexes, which roughly double it |
| Balance query | 4.4 ms partitioned | Level 13, against 81.3 ms unpartitioned |

Nine hundred and fifty gigabytes a year is the number that decides the design: it
is comfortably one Postgres instance for several years, and it is not something to
put in a document store because a document store has no way to enforce the
invariant.

## Data model

```
transactions  id, reference UNIQUE, at, posted_by
entries       id, transaction_id, account, amount_minor, at
              INDEX (account, at)          -- balances
              INDEX (transaction_id)        -- the invariant check
balances      account, as_of_date, closing_minor    -- a rollup, rebuildable
```

Entries are append only, enforced by the grant: the application role holds insert
and select and nothing else. Level 15 measured the two layers: 42501 from the
grant, 23001 from a statement level trigger that refuses update, delete and
truncate even for the table's owner.

The `balances` rollup exists because summing three years of entries per query is
the naive answer. It is derived, so it can be dropped and rebuilt, and a nightly
job asserts it matches the sum of entries. A rollup nothing checks is a rollup
that drifts.

## Diagram

```
  services -> [ ledger API ] -> [ postgres primary ]
                                      |
                              [ read replica ] -> reporting, reconciliation
                                      |
                              [ nightly rollup ] -> balances
```

## Failure modes

| What fails | Consequence | Design response |
|---|---|---|
| Unbalanced transaction attempted | None, it is refused | The check runs before any write, so nothing is half written |
| Primary lost | No writes, and reads continue on the replica | Callers get 503 and retry; nothing is queued locally, because a local queue is a second ledger |
| Replica lag | Reporting is behind | Acceptable and bounded. Balances for decisions read the primary |
| Duplicate posting | Double counted money | `reference` is unique, so the second attempt is rejected by the database rather than by the caller remembering |
| Rollup drift | Wrong balances, silently | The nightly check compares the rollup to the entries and alerts on any difference |

## What to monitor

The invariant, continuously: the sum of every entry, which must be zero, checked
on a schedule and alerted on at any non zero value. Write latency p99. Replica
lag in seconds and in bytes. The rollup check. And the one that catches the worst
class of bug: the count of transactions with exactly one entry, which should be
impossible and is what a half written transaction looks like.
