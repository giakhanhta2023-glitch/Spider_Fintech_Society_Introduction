# Six designs, one page each

The same six sections every time, in the same order, because the order is the
interview: requirements, estimation, data model, diagram, failure modes, what to
monitor. Forty five minutes each on a whiteboard, and the estimation section is
the one that separates a design from a drawing.

Every number in these comes from a measurement in this course rather than from an
instinct, and each one says where it came from. "Around a thousand a second"
invites a follow up question that goes badly; "114 a second, from eight workers
over a 70 millisecond service time, measured in level 14" does not.

| Design | The question it answers |
|---|---|
| [1. A payment gateway](01-payment-gateway.md) | Take a card payment, once, and never twice |
| [2. A ledger service](02-ledger.md) | Record money so the total is checkable forever |
| [3. A payout scheduler](03-payout-scheduler.md) | Pay merchants on time without paying twice |
| [4. An idempotency layer](04-idempotency.md) | Make retries safe for every endpoint at once |
| [5. A reconciliation pipeline](05-reconciliation.md) | Prove the money matches somebody else's records |
| [6. A rate limiter](06-rate-limiter.md) | Refuse fairly, in microseconds, across a fleet |
