# Service level objectives

Last reviewed 2026-09-24. Next review 2026-12-24, or after any incident that
spends more than a quarter of a budget.

Four journeys, because four is what this system has. An SLO per endpoint is a
spreadsheet nobody reads; an SLO per thing a customer is trying to do is a
decision rule.

Each one has an SLI written as a sentence precise enough to argue with, a
target, a window, the budget in minutes, and what happens when the budget runs
out. The last part is the only part that changes behaviour.

## 1. Taking a payment: availability

**SLI.** The proportion of `POST /payments` requests that return a 2xx or a 4xx,
measured at the edge load balancer, over all such requests.

**Target.** 99.9% over a rolling 30 days.

**Budget.** 43 minutes 12 seconds of total failure, or equivalently 0.1% of
requests. Computed in `slo/budget.py`, not by hand.

**Why 4xx counts as success.** A card declined by the issuer is a 402 and the
system worked perfectly. A malformed request is a 400 and the client's bug is
not our outage. Including them means the objective moves whenever a customer
ships a release, and the first time that happens somebody quietly widens the
target. What we do instead is alert separately on a 4xx rate that jumps, because
that is a real signal about somebody's integration, and it is a ticket rather
than a page.

**Why measured at the edge.** Measured inside the service, a request the service
never received is a request that never failed. The most complete outages are
invisible to the service's own metrics, and that is not a hypothetical: it is
what a full connection pool, a crashed process and a bad deploy all look like.

## 2. Taking a payment: latency

**SLI.** The proportion of `POST /payments` requests served in under 500 ms,
measured at the edge, over all such requests.

**Target.** 99% under 500 ms over a rolling 30 days.

**Budget.** 1% of requests. In a 30 day month at 200 requests a second that is
5.18 million slow requests, which sounds enormous and is worth stating, because
a latency budget in requests is much less frightening than one in minutes and
both are the same promise.

**Why a threshold and not a percentile.** "p99 under 500 ms" and "99% under
500 ms" are the same statement, and only the second one aggregates correctly
across instances and across time. Percentiles cannot be averaged: with ten
instances and one three times slower, the mean of the instance p99s read
361.6 ms while the true p99 was 393.4 ms and the sick instance was at 906.2 ms.
Counting requests over a threshold has none of that problem, which is why every
burn rate rule in `burn_rate.yml` is built on a count.

**500 ms is a decision, not a measurement.** From level 14: the service's own
p99 at 35% of capacity was 265.6 ms, dominated by one dependency's slow path.
500 ms leaves room for that plus a retry, and it is under the point where a
checkout page starts losing conversions.

## 3. Paying merchants out: freshness

**SLI.** The proportion of payouts that reach a final state within 15 minutes of
being requested.

**Target.** 99.5% over a rolling 30 days.

**Budget.** 0.5% of payouts. At the level 12 volume of 200 payouts a day that is
30 payouts a month, which is small enough to investigate individually, and that
is the point of choosing the number there.

**Why freshness rather than availability.** The payout API can be up and every
request can succeed while no money moves, because the work happens
asynchronously. An availability SLO on the endpoint measures the wrong half of
the system.

## 4. Paying merchants out: correctness

**SLI.** The number of payouts in a non final state with the merchant already
debited, sampled every minute.

**Target.** Zero, for longer than 15 minutes. This is the one objective with no
budget.

**Why no budget.** From level 12: a payout stuck between debited and paid is
money taken from a merchant with nothing to show for it, and it does not resolve
itself. An error budget says a certain amount of failure is acceptable because
it is temporary and invisible to most people. Neither is true here. A single
occurrence that persists is a page, at any hour, for any amount.

The corresponding alert is `PayoutsStuckInNonFinalState`, and the sweeper that
should prevent it ever firing is level 12's.

## The budget policy

This is the part that makes the document worth writing. Agreed in advance, it
settles the argument between shipping and stability without either side having
to win it in the moment.

| Budget remaining | What that means for the next two weeks |
|---|---|
| Above 50% | Ship. Take the risk, run the migration, do the experiment. Unused budget is a resource, not a trophy: an unspent budget at the end of every month means the target is too low to be informative. |
| 25% to 50% | Ship, with a rule: no schema migration and no dependency upgrade on a Friday, and every deploy behind a flag that can be turned off without a release. |
| Below 25% | Feature work pauses. The next sprint is reliability: the top three error sources by count, the slowest endpoint, and whatever the last postmortem left unowned. |
| Exhausted | Change freeze except for fixes that reduce the error rate, and a written plan before it lifts. The freeze is lifted by the service owner, not by the calendar. |

Budget is reviewed monthly whether or not anything paged, and the review opens
with the same question every time: what spent it.

That question is there because of a measured surprise. Over the replayed month
in `slo/replay.py`, the two real incidents accounted for 42% of all errors. The
other 58% came from a background rate of about 0.05% on days when nothing was
wrong, which never crossed any threshold and never woke anybody. It was
spending most of the budget, and nobody was assigned to it, because the alerting
was silent about it by design.

## What does not get an objective

An SLO is a promise to somebody outside the team. These are not:

- CPU, memory, disk, cache hit ratio, queue depth on its own, instance count.
  Dashboard panels and ticket thresholds. None of them means a customer is
  affected, and several of them are normal.
- Internal endpoints nobody waits on.
- Anything we cannot measure at the boundary the customer experiences.

Every alert in `burn_rate.yml` maps to one of the four objectives above or is a
ticket. An alert that maps to nothing is deleted, and that deletion is the
cheapest reliability work available.
