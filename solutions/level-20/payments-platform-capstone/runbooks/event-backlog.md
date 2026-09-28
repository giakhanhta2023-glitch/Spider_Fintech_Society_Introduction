# EventBacklogGrowing

**Reviewed** 2026-09-25 · **Owner** the author · **Objective** payout freshness, 99.5% final within 15 minutes

## What it means

More than five hundred events are waiting in the outbox. Payments are still
succeeding, because the publisher is not on the payment path: this is **lag rather
than loss**, and the distinction is the entire reason the outbox exists.

Measured: the alert fires **112 ms** after the publisher stops, a backlog of 700
events built up over seven hundred payments, **zero were lost**, and the consumer
caught up in 600 ms once the publisher returned.

## Check

1. **Is the publisher running at all?** A dead publisher with a growing queue is
   the most common cause by a distance.
2. **Is one message poisoning the batch?** A message that fails, is redelivered and
   fails again blocks everything behind it. The fix is the dead letter queue.
3. **Is the consumer slower than the producer?** Compare the publish rate with the
   delivery rate. If the consumer is 10% slower the backlog grows forever, however
   small it is now.
4. **Is a downstream call timing out?** A consumer waiting on a bank with a 30
   second timeout processes two messages a minute.

## Do

Restart the publisher, move a poison message to the dead letter queue rather than
deleting it, or add consumers if the partitioning allows it. Nothing here is
urgent for the payment path and all of it is urgent for the freshness objective.

## Do not

Do not purge the queue. Those are payouts, and the reconciliation will find them
missing tomorrow in a way nobody can undo.
