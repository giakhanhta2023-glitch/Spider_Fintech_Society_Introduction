# 3. An outbox and a saga, not a distributed transaction

**Status** accepted · **Date** 2026-09-25 · **Deciders** the author

## Context

A payment touches the ledger, the event stream and, later, a bank. Those are three
systems with three failure modes, and something has to hold them together. The
capstone asserts that no money is lost or duplicated across four injected
failures, so this decision is the one that assertion rests on.

## Options

**A. Two phase commit across the database and the message broker.** Correct on
paper. It requires every participant to support it, it holds locks across a
network round trip, and a coordinator failure leaves participants blocked holding
those locks. It is also unavailable: the bank is an HTTP API with no notion of a
prepare phase.

**B. Write the event after committing the payment.** One line, and it loses
events. The window between the commit and the publish is short and not empty, and
a crash inside it loses the event permanently with no error anywhere. Level 11
measured it: 5% of events at a 5% crash rate, silently.

**C. An outbox for the event, and a saga with compensations for the payout.** The
event is written in the same transaction as the payment, so it cannot be lost. The
publisher may deliver it twice, so the consumer deduplicates on the event id. The
payout is a sequence of steps with compensations rather than a transaction.

## Decision

**C.** The outbox for events, the saga for payouts, and idempotency at every
boundary.

## Consequences

**Duplicates replace losses**, and that is the trade rather than a side effect.
Level 11 measured the same run both ways: the dual write lost 5% of events, and
the outbox lost none and duplicated 7.50%. A duplicate that a consumer refuses is
a non event; a lost payment event is a payout that never happens and nobody knows
about.

**Every consumer must be idempotent**, which is a rule rather than a hope. The
consumer here deduplicates on the event id, and chaos scenario three stopped the
publisher for seven hundred payments and then restarted it: zero events lost, zero
double counted.

**Unknown is a state.** A bank call that times out leaves the payout unknown
rather than failed, and a sweeper resolves it by asking the bank about a reference
generated before the first attempt. Chaos scenario two forced every call to time
out and every unknown was resolved.

**The order of operations is load bearing, and the capstone found out the hard
way.** The first version of the payout worker called the bank and then posted to
the ledger. With the ledger unavailable the post raised, the exception escaped,
and the payout stayed `pending` while the bank had already paid: one payout in
four hundred, money out of the building with no record. The reconciliation found
it, which is the good outcome of a bad design, and the code now refuses to call
the bank when the record cannot be written and marks the payout unknown if the
record fails after the money moved.

**Eventual consistency is visible to the business.** A merchant's payout is not
instant, and the freshness objective is fifteen minutes rather than zero. That is
a product decision written into `ARCHITECTURE.md` rather than an accident of the
implementation.
