# PayoutQueueNotDraining

**Severity** page · **Objective** payouts freshness, 99.5% final within 15 minutes
**Owner** payments team · **Last reviewed** 2026-09-24

## What this means

The payout queue has more than 500 messages and the depth has been rising for
fifteen minutes. Merchants are not being paid, and the backlog is growing faster
than the workers are clearing it.

Depth alone is not in this alert on purpose. A spike drains; a spike is normal
after a batch. Depth plus a positive slope over fifteen minutes is a queue that
will not catch up on its own, and that distinction is the difference between an
alert people trust and one they mute.

## What to check first

1. **Are the consumers alive?** Consumer count and the age of the oldest
   unacknowledged message. Zero consumers with a growing queue is a deploy that
   did not come back, and it is the most common cause by a distance.
2. **Is one message poisoning the batch?** Level 11's retry counter. A message
   that fails, is redelivered, fails again and blocks the partition stops
   everything behind it. The fix is the dead letter queue, and the reason it
   exists is this alert.
3. **Is the consumer slower than the producer?** Compare the publish rate with
   the acknowledgement rate. If the consumer is 10% slower, the queue grows
   forever regardless of how many messages are in it now.
4. **Is a downstream call failing or timing out?** A consumer waiting on a bank
   API with a 30 second timeout processes two messages a minute. Its own latency
   panel says so immediately.

## What to do

- No consumers: redeploy the consumer. Check whether the deploy failed silently
  rather than assuming the platform will retry it.
- A poison message: move it to the dead letter queue and keep going. Do not
  delete it, because it is the evidence and probably a bug.
- Consumer slower than producer: add consumers if the work is partitioned in a
  way that allows it. From level 11, the partition key decides this: messages
  for one payment must stay in one partition, so adding consumers beyond the
  partition count does nothing.
- A slow downstream call: shorten the timeout. A consumer blocked for 30 seconds
  per message is a queue that never drains, and a fast failure with a retry later
  is strictly better for the backlog.

## What not to do

- Do not purge the queue. Those are payouts. Purging them loses money in a way
  that reconciliation will find and nobody will be able to undo.
- Do not raise the depth threshold to stop the alert firing. The threshold is not
  the problem.

## Escalation

An hour of growth, or any payout older than the 15 minute freshness objective by
more than an hour: page the service owner. Merchants notice late payouts within
about a day, and support hears about it before the dashboard does.
