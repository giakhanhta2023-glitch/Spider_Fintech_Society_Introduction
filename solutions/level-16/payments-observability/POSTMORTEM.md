# Postmortem: payment failures on day 19 of the replayed month

**Status** final · **Written** 2026-09-24 · **Blameless**

**What this is.** A postmortem written against the incident in `slo/replay.py`,
which is a simulated month rather than a production outage. Every count, ratio
and detection time below comes out of that simulation and can be reproduced with
`python -m slo.replay`. The causes are a plausible reconstruction: the simulation
produces an error rate, not a reason. Everything that is reconstruction rather
than measurement is marked, because a postmortem that blurs the two teaches
people to trust the wrong sentences.

Times are relative to the start of the incident. The simulation places incidents
on day boundaries, so an absolute clock would imply precision it does not have.

## Summary

For 25 minutes, 35% of payment requests failed with 5xx. 105,002 payment attempts
were turned away, worth $8,179,656 in attempted volume at the mean capture value
of $77.90 from the level 9 dataset.

The burn rate alert paged at T+2. Recovery followed a rollback. The error budget
for the 30 day window went from 67% spent to 87% spent, which left 13% of a
43 minute budget for the remaining eleven days.

## Impact, measured

| | |
|---|---|
| Duration above the objective | 25 minutes |
| Payment attempts in the window | 300,000 |
| Failed attempts | 105,002 (35.00%) |
| Attempted volume turned away | $8,179,656 at $77.90 mean per capture |
| Share of the month's total errors | 23% |
| Error budget consumed by this incident | 20% of the 30 day budget |
| Time to detect | 2 minutes (burn rate), 0 minutes (a 1% threshold would have been immediate) |

**What we cannot say** is how much revenue was lost, as opposed to delayed. Some
of those 105,002 customers retried and succeeded; some went to a competitor; some
never came back. We do not measure the recovery rate, so the honest range is
between almost nothing and the full $8.2 million, which is a uselessly wide
answer and is the reason action 4 exists.

For comparison, the other incident in the same month was gentler and longer:
90 minutes at 8%, which failed 86,176 attempts worth $6,713,110. It cost nearly as
much as this one and felt like a quarter of the event, and nobody would have
remembered it by the review.

## Timeline

| Time | What happened |
|---|---|
| T-11 min | A deploy goes out. It is the only change in the window. *(reconstruction)* |
| T+0 | The 5xx rate steps from the 0.05% background to 35%. The five minute window crosses the fast burn threshold almost immediately. |
| T+2 | `PaymentsErrorBudgetFastBurn` pages. Both its windows agree: the hour window is above 1.44% and the five minute window confirms it is still happening. **Measured.** |
| T+4 | On call acknowledges, opens the RED dashboard, sees the failures spread across every endpoint rather than one, and every instance rather than one. |
| T+7 | A trace of one failed request shows the failure at the database call, not at the card network. Tail sampling kept every failure, so there was one to open. *(reconstruction)* |
| T+9 | Decision to roll back rather than diagnose. The deploy is eleven minutes old and rollback is one command. |
| T+14 | Rollback complete. The five minute error ratio starts falling. |
| T+25 | Error ratio back to background. |
| T+53 | The alert stops firing, 28 minutes after the incident ended, which is the slow rule's confirming window doing its job rather than a bug. **Measured.** |

## Causes, in layers

There is no root cause. There is a chain, and every link is a place the chain
could have been broken. *(The specific causes below are the reconstruction; the
error rate and timings are from the simulation.)*

1. **The deploy halved the connection pool.** A configuration change intended for
   a different service reduced the pool from 20 to 10 connections per instance.
2. **Ten connections is under the concurrency the service runs at.** From level
   14: 8 worker slots per instance over a 70 ms mean service time. A pool of 10
   with a 5 second acquisition timeout means requests waiting for a connection,
   then failing.
3. **The acquisition timeout was longer than the caller's timeout.** Requests were
   still queued for a connection when the caller had already given up, so the
   work was done for nobody. Level 14's goodput lesson, in production.
4. **The circuit breaker never opened.** Its threshold was a 50% failure rate and
   the failure rate was 35%, so the breaker sat closed and watched. A breaker
   tuned above the failure rate that actually hurts you is decoration.
5. **Nothing compared the pool size to the worker count.** The two numbers have to
   be read together and lived in different files owned by different people.

## What made it worse

- **The dashboard's latency panel looked fine**, because failing fast is fast.
  Errors were the signal and latency was the distraction, and the first four
  minutes went on latency.
- **The deploy was not annotated on the graphs.** Correlating it took two minutes
  of asking in a channel, and it was the first thing anybody should have seen.
- **The runbook said "check the dependencies"** without saying in what order.
  That is now a numbered list in
  [runbooks/payments-error-budget-fast-burn.md](runbooks/payments-error-budget-fast-burn.md).

## What went right

Worth writing down, because a postmortem that only lists failures teaches people
to hide them.

- **Detection was 2 minutes** and it came from an alert tied to an objective
  rather than from a customer.
- **Mitigation before diagnosis.** The rollback happened at T+9 with the cause
  still unknown. The cause was found afterwards, on nobody's money.
- **Every failed request had a trace**, because sampling is tail based. Head
  sampling at 1% would have kept about a thousand of the 105,002 failures, and
  the one anybody opened would have been a survivor rather than a representative.
- **One request id joined the logs, the trace and the metric labels**, so
  "show me everything about this one failure" was a single query.

## Actions

| # | Action | Owner | Due | Why it is here |
|---|---|---|---|---|
| 1 | Assert in the service's startup checks that the connection pool is at least twice the worker count, and refuse to start otherwise | payments team | 2026-10-01 | Cause 2 and cause 5. A configuration that cannot be wrong beats a configuration that is reviewed |
| 2 | Set every downstream acquisition and call timeout below the caller's timeout, and add a test that reads them from config and compares | payments team | 2026-10-08 | Cause 3. Work done for a caller who has left is the definition of wasted capacity |
| 3 | Re-tune the circuit breaker to open at 20% over a 10 second window, and prove it with the level 14 breaker experiment | payments team | 2026-10-08 | Cause 4. A breaker that only opens at 50% never opens during the incidents that matter |
| 4 | Measure the retry recovery rate: what share of customers whose payment fails succeed within an hour | payments team, with data | 2026-10-15 | The impact section above has a $8.2 million range in it because nobody knows this number |
| 5 | Annotate deploys on every dashboard in the payments folder | payments team | 2026-10-01 | Two minutes of an incident spent asking whether there had been a deploy |
| 6 | Investigate the 0.05% background error rate, which spent 58% of the month's budget while paging nobody | payments team | 2026-10-31 | It is larger than both incidents combined and nobody is assigned to it |

Action 6 is the one that will be dropped if nobody defends it, and it is the
largest single item on the list. The two incidents in the replayed month accounted
for 42% of all errors; the quiet background rate accounted for the other 58%, on
days when nothing was wrong and no threshold was crossed.

## The counterfactual nobody likes

A threshold alert at 1% for five minutes would have paged at T+0 rather than T+2,
and two minutes of a 35% failure rate is roughly 8,400 failed payments worth
about $654,000 in attempted volume. That is what the burn rate rule cost on this
occasion.

Over the same month, the same threshold alert also produced two false pages for
blips that had recovered before anybody could open a laptop, and the burn rate
rule produced none. The trade is two minutes of detection on a severe incident
against a pager people still answer at 4am, and it is a trade rather than a free
win. It is written here so that the next person to propose the threshold has the
numbers instead of an argument.
