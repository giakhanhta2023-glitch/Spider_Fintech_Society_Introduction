# Level 16: The pager, and what it is allowed to wake you for

> **payments-observability: a pager you would trust** · build project · difficulty 9/10

## Read this second

Attempt the build yourself first, then ask the FinQuest tutor for a hint, and only then open this folder.
Read the part you are stuck on, close the file, and retype the fix from memory. Copying the solution into
your own project skips the only step that actually teaches you anything.

## The brief

Take the service you built in levels 7 and 14 and make it operable. Structured logs with a request id, RED metrics with a cardinality budget, correct percentiles, traces that survive the queue, an SLO document, burn rate alerts replayed against a month of traffic, a runbook per alert, and a game day with a real postmortem at the end.

**Scope:** Prometheus, Grafana and an OpenTelemetry collector in Docker Compose. The measurements and the documents are the deliverable. A dashboard nobody can interpret scores nothing.

## Files here

| File | What it is |
|------|------------|
| `obs/context.py` | the request id in a context variable, and the queue envelope |
| `obs/logging_.py` | JSON events, a name registry, an allowlist, a sampling policy |
| `obs/metrics.py` | RED metrics, declared label domains, and the series ceiling |
| `obs/tracing.py` | W3C traceparent, and the context that travels inside the message |
| `obs/sampling.py` | tail sampling, and what it actually retained |
| `obs/experiments.py` | cardinality, percentiles, buckets and log volume |
| `slo/OBJECTIVES.md` | four journeys, budgets in minutes, and the budget policy |
| `slo/burn_rate.yml` | the multiwindow rules, with runbook and dashboard links |
| `slo/replay.py` | a month of traffic, and the pages five rules would have produced |
| `runbooks/` | one per alert, dated, and checked by a test |
| `gameday/drills.py` | nine faults injected into a copy of the repository |
| `GAMEDAY.md` | what was broken, what noticed, and two things it found |
| `POSTMORTEM.md` | the day 19 incident, with the money and owned actions |
| `quiz-key.md` | all 15 drill answers with explanations |

## Run it

```bash
pytest -q && python -m obs.experiments && python -m slo.replay && python -m gameday.drills
```

## Why the solution is shaped this way

- The three signals are used for what each is good at: metrics say something is wrong, traces say where, logs say why. The request id is generated at the edge and lives in a context variable, so a function four calls deep cannot forget it and no signature has to carry it.
- Cardinality is budgeted rather than hoped for. Measured on one counter: 100 series cost 0.1 MB and a 3.0 ms scrape; adding merchant_id with 500 values took it to 200,000 series, 203.8 MB and a 15,734 ms scrape against a 15 second scrape interval. The scrape no longer fits inside its own interval, so the monitoring becomes the outage.
- The budget is checked against the declaration rather than against the test traffic, and that correction came from the game day. The first version of the test asserted a budget over fifteen label combinations the test itself had created, so it would have passed with merchant_id added and five hundred merchants in production. `worst_case_series()` now refuses any label whose values cannot be enumerated, and the declared ceiling of this service is 151 series against a budget of 5,000.
- Percentiles are aggregated by summing histogram buckets, never by averaging quantiles. With ten instances and one of them three times slower, the true p99 was 393.4 ms, the average of the instance p99s was 361.6 ms, and the maximum across instances was 906.2 ms. The average sat close to a healthy instance, so the dashboard looked normal.
- Buckets come from the measured distribution. Prometheus defaults reported a p99 of 450.1 ms when the exact value was 301.5 ms, a 49.3% error produced entirely by the gap between the 250 ms and 500 ms edges. Tuned buckets brought it to 1.6%.
- Log volume is measured rather than estimated: the median rendered line is 152 bytes, which is 15.8 GB a day at 200 requests a second, and 1.1 GB under a policy that keeps every error, every slow request and one in twenty of the rest. The sampling decision is taken on the request id so a request is kept or dropped whole.
- Alerting is replayed rather than argued about. Over a simulated month with two incidents and two harmless blips: a threshold on error rate paged 4 times with 2 false pages; multiwindow burn rate paged twice with none, and detected the 35% incident in 2 minutes and the 8% one in 10, which is severity scaling nobody had to configure.
- The short confirming windows are measured, not assumed. Without them the rule keeps firing for 335 and 355 minutes after the two incidents end, against 28 and 30 with them, because a six hour window keeps averaging in an outage that is over. That is how an alert gets silenced before the next one.
- The uncomfortable number from the same month: the two incidents were only 42% of all errors. The other 58% came from a quiet 0.05% background rate that never crossed a threshold and never woke anybody, and it was spending most of the budget.
- The game day is a fault injection runner rather than a story. Nine plausible mistakes applied to a throwaway copy, nine caught, each by exactly the test you would want to see fail, in under two seconds of test time.

## Where people get stuck

| Symptom | Cause |
|---------|-------|
| A scrape started timing out | A high cardinality label. Series count is the product across labels, and it never comes back down. |
| The series budget test passed and production still broke | The test asserted a budget over traffic the test created. Compute the ceiling from the declared label values instead. |
| The latency dashboard was wrong by half | Default histogram buckets. The p99 landed in a bucket 250 ms wide and the interpolation was a guess. |
| One broken instance was invisible | Instance p99s were averaged. Sum the buckets, and also graph the maximum. |
| The trace stopped at the queue | Context has to travel inside the message, not in a header. |
| Sampling threw away the incident | Head sampling keeps 1% of errors at 1%. Tail sampling keeps all of them. |
| The alert kept firing for hours after the incident | No short confirming window. The long window averages in an outage that is over. |
| Nobody reacts to the pager any more | It has been paging for causes and for blips. Page for symptoms tied to an objective, and delete the rest. |
| The postmortem blamed a person | Ask what made the wrong action look right. That question has a fix attached; blame does not. |

## Self-checks the solution satisfies

- Every log line emitted during one request carries the same request id
- No log line contains a value outside the allowlist
- The metrics registry stays under the series budget, and the test fails when a high cardinality label is added
- The p99 from aggregated histogram buckets matches an exact p99 from raw timings within a few percent
- Averaging instance p99s is demonstrably wrong when one instance is slow, and the max panel catches it
- A single trace covers the whole payment including the part after the queue
- Tail sampling retains 100% of failed requests and 100% of requests over the target
- Every alert rule has a runbook link
- Replaying the synthetic month produces zero false pages and catches both incidents
- The burn rate rule stops firing within minutes of an incident ending
- The error budget calculation matches the published minutes for 99%, 99.9%, 99.95% and 99.99%

## How it is marked

| Points | Criterion | Meaning |
|--------|-----------|---------|
| 20 | Signals used properly | Structured logs with a request id, RED metrics, traces that cross the queue, each answering what it is for. |
| 20 | Cardinality understood | A written budget, an enforcing test, and a reproduction of the accident with series, memory and scrape time. |
| 20 | Correct numbers | Cross instance percentiles aggregated properly, buckets tuned, and both compared against exact values. |
| 20 | SLOs and alerting | An SLO document with a budget policy, multiwindow burn rate rules, and the replay table against a naive threshold. |
| 20 | Operability | A runbook per alert enforced by a test, a game day with timings, and a postmortem with owned actions. |

---

Part of [FinQuest](../../README.md) · Level 16 of 20
