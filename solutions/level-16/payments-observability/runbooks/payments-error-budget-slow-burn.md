# PaymentsErrorBudgetSlowBurn

**Severity** page · **Objective** payments availability, 99.9% over 30 days
**Owner** payments team · **Last reviewed** 2026-09-24

## What this means

Payments have been failing at more than six times the budget rate for six hours.
Nothing is on fire. At this rate the 30 day budget runs out in five days, and
then there is no budget left for the outage that has not happened yet.

This is the alert that catches what a threshold never does: a small, constant
failure rate that is invisible on a graph and expensive on a monthly view. In
the replayed month, a background rate of 0.05% spent 58% of the budget and
paged nobody.

## Why this pages at all

It pages because it will not fix itself, and because a ticket filed at 2am on a
Tuesday is read on Thursday. It pages at a lower urgency than a fast burn, which
in practice means: acknowledge, look at it now, and it is reasonable to fix it in
the morning if the rate is stable.

## What to check first

1. **Group the errors by endpoint, status code and customer.** A slow burn is
   almost always a small number of causes, and often one:
   - one client sending malformed requests that surface as a 5xx rather than a
     400, which is our bug and their traffic
   - one timeout set too tight, failing a slow but healthy dependency
   - a retry path that fails the first attempt by design and is counted
   - one shard, one region or one instance that has been quietly bad for hours
2. **Compare with the same hours last week.** A daily pattern is a batch job. A
   step change is a deploy or a configuration change.
3. **Check whether the rate is rising.** Flat is a fix in the morning. Rising is
   a fast burn in a few hours, and it should be treated as one now.

## What to do

Find the largest single contributor and fix it, or turn it off. One cause is
usually most of the volume, so the question to ask is which single thing is
failing most. The answer is one group by away.

If the cause is a client's traffic, the fix is a correct status code and a
message they can act on, plus a note to whoever owns that relationship. Turning
a 5xx into the 400 it always was removes the error from the SLI honestly rather
than by moving the goalposts, because a malformed request was never our failure.

## What not to do

- Do not widen the objective. If 99.9% is not achievable, that is a decision for
  the review with the budget table in front of everybody, not an edit to a YAML
  file during a night shift.
- Do not exclude the endpoint from the SLI to make the alert stop. The alert is
  correct, which is the annoying part.

## Escalation

If the rate has been above the threshold for 24 hours and nobody has found the
cause, it becomes a named piece of work with an owner and a date, and the budget
policy in `slo/OBJECTIVES.md` starts applying.
