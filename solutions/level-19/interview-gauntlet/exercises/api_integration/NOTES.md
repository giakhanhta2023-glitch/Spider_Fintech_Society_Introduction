# Submission note: the processor integration

Ninety minutes. What I did, what I skipped, and what I would do next, which is the
part that turns an unfinished exercise into a demonstration of judgement.

## What it does

`charge()` takes a payment against a processor, with:

- **a timeout on every call**, connect 2 s and read 10 s, both read from the
  documentation rather than chosen
- **an idempotency key as a parameter**, so a retry at any level reuses it
- **retries on 5xx, 429, 408 and a timeout**, and never on other 4xx
- **exponential backoff with full jitter**, capped at 8 seconds, and `Retry-After`
  obeyed when the server sends one
- **a budget of four attempts**, checked before sleeping rather than after

Eleven tests. The one that matters is
`test_a_retried_timeout_creates_one_charge`: the fake processor creates the charge
and then times out, and the assertion is that the processor ends up with **one**
charge. Asserting that the client retried would prove nothing about the money.

## What I skipped, and why

- **Webhook handling.** The processor confirms asynchronously and a real
  integration must accept that, verify its signature and be idempotent again. It
  is a second exercise rather than a corner of this one, and level 15 has the
  signature verification.
- **A circuit breaker.** Retries with a budget stop this client from making an
  outage worse. They do not stop a hundred instances from doing it collectively,
  which is what a breaker is for. Level 14 has one, and wiring it in here needs
  shared state rather than a per process counter.
- **Real HTTP.** The transport is a protocol with a fake behind it, so the tests
  need no network. In production this is `httpx.Client(timeout=Timeout(connect=2,
  read=10))` and nothing else changes.
- **Rate limit awareness before sending.** The client reacts to a 429 and does not
  avoid one. A token bucket on the client side, as in level 14, would.
- **Structured logging.** There are counters and no log lines. Level 16's request
  id would make a retry traceable across the two attempts.

## What I would do next, in order

1. The webhook receiver, because without it the charge status is a guess between
   the response and the next reconciliation.
2. A reconciliation query for `ProcessorUnavailable` cases. The client says the
   payment is **unknown** rather than failed, and something has to resolve those:
   level 9's unknown state and level 10's reconciliation, joined by the
   idempotency key.
3. The breaker, with the threshold set from measurement rather than from taste.

## The thing I would say out loud in the review

The dangerous line in this file is the retry after a timeout. It is only safe
because the idempotency key is generated once per payment, outside the retry loop.
Move that one line inside the loop and every timeout becomes a double charge, and
no test that only checks "did it retry" would notice.
