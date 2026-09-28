# 5. A reconciliation pipeline

## Requirements

**Functional.** Every day, compare our record of money against the processor's
settlement file and the bank statement. Report every difference with enough
context to investigate it. Resolve differences automatically when they stop
appearing.

**Non functional.** Complete within the overnight window. Deterministic: the same
inputs produce the same breaks. Breaks persist across runs with stable identities,
so "still open after three days" is answerable.

## Estimation

| Input | Value | Where it comes from |
|---|---|---|
| Transactions a day | 4.3 million | 131 million a month |
| Settlement file | about 500 MB | 4.3 million rows at roughly 120 bytes |
| Matching | one pass, indexed | Level 19: a dictionary against nested loops is 911x at 8,000 rows and grows |
| Expected breaks | about 190 a day | Level 10's day: 193 amount mismatches, 163 of them currency rounding and 30 worth $14.19 that somebody has to look at |
| Window | a few minutes | The naive version is about 19 hours at a million rows: level 19 measured 4,300.6 ms at 8,000, and quadratic means times 15,625 for 125 times the rows |

That last row is the arithmetic worth carrying into the interview, and the reason
to carry the derivation with it rather than the answer: 4,300.6 ms at 8,000 rows
is fine, the same code at a million rows does not finish inside a business day,
and the fix is one pass to build a dictionary. A candidate who can go from a
measured millisecond figure to the hours on the board is doing the thing the
round is actually testing.

## Data model

```
settlement_rows  file_id, reference, amount_minor, fee_minor, settled_at
breaks           break_id PRIMARY KEY,     -- sha256(type|key|kind)[:16]
                 type, key, ours_minor, theirs_minor, difference_minor,
                 first_seen, last_seen, resolved_at NULL, reason NULL
```

The break id is derived from what the break *is* rather than from when it was
found, so running the job twice changes nothing and a break that persists keeps
its identity. A break that stops appearing is resolved automatically with a
reason, which is the difference between a list somebody triages and a list
somebody ignores.

## Diagram

```
  [ processor file ] --\
  [ bank statement ] ----> [ normalise ] -> [ match by reference ] -> [ breaks ]
  [ our ledger ]  ------/         |                  |
                            sign convention     explain: fees,
                            fixed here          rounding, timing
```

## Failure modes

| What fails | Consequence | Design response |
|---|---|---|
| Signs differ between sources | Every refund becomes a break | Normalise both sides at the boundary. Level 10's file writes a refund as negative gross and its ledger writes the same refund as a positive refund event, and one convention chosen at the edge removes the whole class |
| File arrives late or twice | A day missed or double counted | Files are idempotent by `file_id`, and a missing file is an alert rather than a zero |
| Timing across the day boundary | A break that resolves itself tomorrow | Its own break type, with a tolerance in days rather than a widened amount tolerance |
| A new fee type appears | A wave of amount mismatches | Add an explanation type rather than widening a tolerance, which would hide the next real break inside it |
| The job is slow | It runs into the business day | Index the match. The measured ratio grows with the data |

## What to monitor

The count of unexplained breaks, against a baseline rather than against zero: 193
was a normal day, so the alert is at 250. The composition of breaks by type, which
is the actual diagnosis. The age of the oldest open break. Whether the job ran at
all, which is the failure everybody forgets to alert on. And any duplicate
settlement, which is money moving twice and escalates immediately.
