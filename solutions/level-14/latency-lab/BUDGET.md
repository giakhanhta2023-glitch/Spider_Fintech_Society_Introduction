# Latency budget: `POST /v1/payments`

**At 200 requests per second, p99 must be under 250 ms.**

A budget is the artefact that turns "the API feels slow" into a number that
either is or is not being met. It does three things at once: it says which
dependency to argue with, it sets every timeout, and it makes the disagreement
about performance an engineering question rather than an opinion.

| Step | Budget | Measured p99 | Notes |
|---|---|---|---|
| Authentication | 5 ms | 4.1 ms | sha256 and a scope check, no I/O. Level 7 |
| Validation | 2 ms | 1.4 ms | pydantic |
| Idempotency lookup | 10 ms | 8.7 ms | One indexed read. Never cached: see below |
| Fraud check | **120 ms** | 118 ms | Their p99. Our timeout is 150 ms |
| Ledger write | 40 ms | 37 ms | One transaction, row locked. Level 8 |
| Event write | 8 ms | 6.2 ms | The outbox row, same transaction. Level 11 |
| Everything else | 20 ms | 14 ms | Serialisation, logging, the framework |
| **Budgeted** | **205 ms** | **189 ms** | 45 ms of headroom |

## What the budget decides

**Which dependency to argue with.** The fraud check is 120 ms of a 205 ms
budget: 59% of the request, for one call. Everything else added together is
85 ms. If this endpoint needs to get faster, that is the only line worth
looking at, and no amount of optimising the ledger write will matter.

**Every timeout.** A dependency allowed 120 ms gets a 150 ms timeout, not two
seconds. The hierarchy has to hold:

```
the caller allows us          1,000 ms
  we allow the fraud check      150 ms
  we allow the ledger            300 ms
  we allow Redis                  50 ms
```

A dependency timeout longer than the caller's deadline is the specific bug that
turns a slow dependency into a full outage: our callers give up at one second
while our worker sits waiting for a fraud check it will never use, so we lose
the worker slot *and* the request.

**What is not in here.** The idempotency lookup is 10 ms and is never cached,
because a stale miss creates a second payment for the same request. That is
10 ms we pay deliberately, every time, and writing it in the budget is how the
decision survives the next person who notices it and tries to speed it up.

## Where the headroom goes

45 ms, and it is not spare capacity. It absorbs:

- **Garbage collection and scheduling jitter**, which land in p99 by definition.
- **The retry budget.** A small share of requests do a second fraud call.
- **The cache miss path.** At an 80% hit ratio, one request in five pays full
  price, and p99 is a measure of the unlucky ones.

If the headroom is gone, the endpoint has no margin for a bad afternoon, and
the measurements in the README show what happens next: latency is flat and then
it is a wall.

## When the budget is blown

In order, and the order matters because the first three are free and the last
one is expensive:

1. **Measure where it actually went.** Queue time and service time separately,
   because a request that queued 400 ms and ran 50 ms does not appear in any
   profile of the code.
2. **Remove work.** The fastest call is the one not made.
3. **Cache it**, if and only if it is on the cacheable list.
4. **Parallelise the independent parts.** The fraud check and the idempotency
   lookup do not depend on each other.
5. **Add capacity.** Last, because it is the expensive answer and it hides the
   real one.
