# PaymentsErrorBudgetFastBurn

**Severity** page · **Objective** payments availability, 99.9% over 30 days
**Owner** payments team · **Last reviewed** 2026-09-24

## What this means

Payment requests are returning 5xx at more than 14.4 times the rate the error
budget allows, for at least an hour, and the five minute window confirms it is
still happening right now rather than having happened earlier in the hour.

At this rate a 30 day budget is gone in about two days. Customers are being
turned away at checkout.

## What to check first, in this order

1. **The worst instance panel**, not the aggregate. If one instance out of ten
   is producing everything, the fix is to remove that instance and diagnose it
   afterwards. The aggregate hides this: with one instance three times slower,
   the average of the instance p99s read 361.6 ms while that instance was at
   906.2 ms.
2. **Deploys in the last hour.** `payments:errors:ratio5m` beside the deploy
   annotations. If the rise starts within two minutes of a deploy, roll back
   before reading any further.
3. **The error codes, grouped.** One code at 95% is a specific bug. A spread
   across codes is usually a dependency, a connection pool or saturation.
4. **The dependencies**, in the order the level 14 breaker sees them: the card
   network, the vault, the database. A breaker that has opened is stated in its
   own metric, and an open breaker is the system protecting itself rather than
   the cause.
5. **A trace of one failed request.** Tail sampling keeps every failure, so there
   is one to look at. This answers "where" in seconds and is faster than reading
   logs.

## What to do

**Mitigate before diagnosing.** In order of preference:

- Roll back, if a deploy is in the window. This is one command and it is
  reversible.
- Remove the bad instance from the load balancer, if it is one instance.
- Turn off the feature flag, if the change is behind one.
- Shed load deliberately, using the level 14 queue depth limit, if the service
  is saturated. A fast 503 with `Retry-After` beats a 30 second timeout for
  everybody, including the caller.

Then find out why, with the incident still open but the customer no longer
paying for the investigation.

## What not to do

- Do not restart everything to see if it helps. It destroys the state that
  explains the incident and often works just long enough to hide the cause.
- Do not add retries to the failing path during the incident. Retries multiply
  load on the thing that is already failing, which is level 14's retry storm.
- Do not silence the alert. If it is firing wrongly, that is a postmortem
  action, not a three in the morning decision.

## Escalation

Fifteen minutes with no mitigation, or any suspicion that money has moved twice:
page the service owner and start an incident with named roles. Level 16's four
roles, and the commander does not debug.

If the card network is the cause, their status page and support line are in the
vendor contact document. Their incident is still our outage as far as the
customer is concerned, and the status page update does not wait for their reply.

## After

The budget spend for this incident goes in the monthly review. If it took more
than a quarter of the budget, the policy in `slo/OBJECTIVES.md` applies and
feature work pauses.
