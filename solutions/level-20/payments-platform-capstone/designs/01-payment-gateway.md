# 1. A payment gateway

## Requirements

**Functional.** Take a card payment. Return a decision within a second. Never
charge a customer twice for one intent. Support capture, void, refund and the
dispute flow. Expose the state of any payment.

**Non functional.** 99.9% availability over 30 days, which is 43 minutes 12
seconds of budget. 99% of requests under 500 ms. No card number stored outside one
service. Every state change auditable.

**Explicitly out of scope.** Fraud scoring, which is its own system with its own
latency budget, and settlement, which is a file based batch process rather than an
API.

## Estimation

| Input | Value | Where it comes from |
|---|---|---|
| Peak | 200 payments a second | The capstone's load |
| Average | 50 a second | A fifth of peak, which is the usual shape |
| Payments a month | 131 million | 50 x 86,400 x 30.4 |
| Per instance capacity | 114 a second | Level 14: 8 workers over a 70 ms service time |
| Instances | 2 to serve peak, 6 paid for | 200 / 114 rounded up is 2, and 3 is the first number that still serves peak with one instance down. The cost model pays for 6 because compute is 14.6% of the bill and that margin is the cheapest reliability on the list |
| Storage per payment | about 1 KB | Row plus events plus index |
| Storage a month | 131 GB | And 1.6 TB a year, which decides the partitioning |
| Fee per payment | $2.56 | 2.9% plus 30c on the $77.90 mean capture, level 9 |

The last row is the one that ends arguments: infrastructure at $2,968 a month
against 131 million payments is **1 part in 113,000 of the card fee**. Optimising
it is rarely where the money is.

## Data model

```
payments        id, merchant_id, amount_minor, currency, state, token,
                idempotency_key UNIQUE, created_at, updated_at
payment_events  id, payment_id, kind, at, payload      -- append only
outbox          id, aggregate_id, kind, payload, published_at NULL
```

Money is integer minor units everywhere. The state machine lives in code with an
explicit transition table, and illegal transitions raise rather than being
ignored: level 9 has the eight states and the table.

`idempotency_key` is unique per merchant and is the whole of the "never twice"
requirement. Partition by `created_at` monthly once the table passes about a
hundred million rows: level 13 measured a partitioned query at 4.4 ms against
81.3 ms unpartitioned, and the dropping of a month at 8 ms rather than a delete
that runs for hours.

## Diagram

```
  client -> [ edge ] -> [ gateway ] -> [ vault ]        tokenise
                            |
                            +-------> [ ledger ]        the money, balanced
                            +-------> [ outbox ] -> [ consumer ] -> downstream
                            +-------> [ card network ]  authorise, capture
```

## Failure modes

| What fails | What the customer sees | What the system does |
|---|---|---|
| Card network slow | Slower payments | The breaker opens after a failure rate threshold, and failures become fast rather than timeouts holding workers |
| Card network timeout | A payment in an unknown state | The reference was generated before the first attempt, so the state is resolvable; the resolver settles it |
| Ledger unavailable | 503 | Nothing is half written. Measured: 200 of 200 refused, 0 recorded |
| Vault unavailable | 503 on new cards | Payments on stored tokens continue |
| Duplicate request | The original result | The idempotency key returns the first response rather than a second payment |
| A retry storm | Slower recovery | Backoff with full jitter and a retry budget, or the storm is the outage |

## What to monitor

Four alerts, each mapped to an objective and a runbook. Payment success rate as a
burn rate against the budget, because a threshold pages for blips: level 16
measured a threshold at four pages a month with two false against a multiwindow
burn rate at two pages with none. p99 latency, aggregated by summing histogram
buckets rather than averaging quantiles. The count of payments in a non final
state for longer than fifteen minutes, which has no budget at all. The dependency
breakers, as a dashboard rather than a page.
