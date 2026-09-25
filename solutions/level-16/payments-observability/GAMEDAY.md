# Game day: 2026-09-24

Two hours, one participant, nine faults injected on purpose.

Be clear about what this was. A game day against a running system means killing a
pod, blackholing a database and watching real people find out. This one was
against **the guardrails**: each fault is the change a developer would plausibly
make, applied to a throwaway copy of the repository, followed by the full test
suite. It asks one question: does anything notice. That is the only part of an
observability setup that can be verified without production traffic, and it is
the part that decides whether the rest of it is real.

Reproduce it with:

```bash
python -m gameday.drills
```

## What was broken, and what noticed

Baseline: 29 tests, green, 1.1 seconds.

| Fault injected | Caught | Time | By |
|---|---|---|---|
| Add `merchant_id` to the RED counter, in all three places | yes | 3.0 s | the series budget, twice |
| Ship the Prometheus default histogram buckets | yes | 2.9 s | the p99 accuracy test |
| Add `pan` to the log allowlist | yes | 2.6 s | the allowlist test |
| Log a free text sentence instead of an event name | yes | 2.6 s | the event registry test |
| Stop carrying the trace context into the queue message | yes | 2.5 s | the unbroken trace test |
| Sample traces at the head instead of the tail | yes | 2.8 s | the retention test |
| Drop the short confirming windows from the burn rate rules | yes | 2.6 s | the stops firing test |
| Add an alert with no runbook | yes | 2.6 s | the runbook test, and the dashboard link test |
| Truncate the error budget instead of rounding it | yes | 2.7 s | the published minutes test, and the rounding test |

Nine of nine, each named by exactly the test you would want to see fail. The
times are wall clock including interpreter startup; the suite itself runs in
about a second, so every one of these fails in a pull request rather than in an
incident.

Two drills were caught by two tests each, which is worth noticing rather than
celebrating: an alert with no runbook also breaks the dashboard link test, and a
truncated budget breaks both the published minutes and the rounding test. Overlap
like that is cheap and it means a single deletion cannot quietly remove the
guardrail.

## Two things it found that were wrong beforehand

This is the part of a game day that justifies the two hours, and both findings
were mistakes in work that had already been written and looked finished.

### 1. The series budget test was measuring itself

The first version of `test_the_registry_stays_under_the_series_budget` created a
registry, recorded three endpoints against five status codes, and asserted that
the result was under 5,000 series. It passed. It would have kept passing with
`merchant_id` added, because the test only ever created one merchant: fifteen
label combinations, nowhere near any budget, while production would have had five
hundred merchants and 200,000 series.

A budget test that asserts on traffic the test generated is a test of the test.

The fix is `worst_case_series()`, which computes the ceiling from the
**declaration**: every label must have an enumerable set of values in
`LABEL_DOMAINS`, and the series count is the product of those sets times the
samples per series. `merchant_id` has no enumerable set, so it raises
`UnboundedLabel` and the design is refused before anybody measures anything. The
declared ceiling of this service is 151 series against a budget of 5,000, which
is also a useful thing to know: there is room for thirty times more metrics
before the budget is the constraint.

The drill that found this originally failed with `ValueError: Incorrect label
names`, because a single line edit made the metric and its call site disagree.
That crash looked like a pass at first glance, which is its own small lesson:
read why a drill was caught, not just whether it was.

### 2. A published claim was understated by a factor of five

The alerting section said that without a short confirming window, a one hour
burn rate window "keeps the alert firing for an hour after the incident is over".
Measuring it gave 335 and 355 minutes for the two incidents, not 60. The six hour
window is what keeps it hot, and nearly six hours of a firing alert after the
incident has ended is a much stronger argument for the short windows than the one
originally written.

The measurement is now in `slo/replay.py` as its own rule variant, and it is
asserted: with the short windows the alert goes quiet in 28 and 30 minutes, with
the fast rule alone in 4 and 5, and without them in over 300.

## What the drills do not cover

Honest list, because this is where the next game day starts. Each of these needs
the compose stack, and none of them is proven by anything in this repository:

| Drill | What it should prove |
|---|---|
| Kill one of ten instances mid traffic | The worst instance panel notices, the aggregate barely moves, and the load balancer removes it |
| Blackhole the database for 60 seconds | The breaker opens, the error budget alert fires, and the request id in the logs still joins to the trace |
| Pause the card network simulator | Failures are attributed to the dependency rather than to us, and no retry storm forms |
| Fill the payout queue faster than it drains | `PayoutQueueNotDraining` fires on the slope rather than on the depth, and not before |
| Leave a payout debited and unpaid | `PayoutsStuckInNonFinalState` pages within twenty minutes, from level 12's own sweeper metric |
| Restart Prometheus during an incident | The alert re-fires rather than staying silent because its series reset |
| Run the game day with somebody who did not build it | How long the runbooks take a stranger, which is the only honest measure of a runbook |

The last one is the most valuable and the one most often skipped. A runbook is
written by the person who least needs it.

## Timings worth recording

| Step | Minutes |
|---|---|
| Writing the drill runner | 35 |
| Running all nine drills, including reverts | 1 |
| Investigating the two findings | 40 |
| Fixing the budget test properly and re-running | 25 |
| Writing this document | 20 |

The one minute row is the point. Once the runner exists, a game day against the
guardrails is cheap enough to run on every change to the observability code, and
`python -m gameday.drills` is in the same category as a test suite: not a ritual,
a check.
