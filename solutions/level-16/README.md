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
| `obs/logging.py` | JSON events, stable names, a request id from context |
| `obs/metrics.py` | RED metrics, and the test that enforces the series budget |
| `obs/tracing.py` | propagation across services and across the queue |
| `slo/OBJECTIVES.md` | SLI, target, window, budget in minutes, and the policy |
| `slo/burn_rate.yml` | the multiwindow rules |
| `slo/replay.py` | a month of traffic, and the pages each rule would have produced |
| `runbooks/` | one per alert, dated, and checked by a test |
| `POSTMORTEM.md` | written after the game day, with owned actions |
| `quiz-key.md` | all 15 drill answers with explanations |

## Run it

```bash
docker compose up -d && python -m slo.replay && pytest -q tests/test_cardinality.py
```

## Why the solution is shaped this way

- The three signals are used for what each is good at: metrics say something is wrong, traces say where, logs say why. The request id is generated at the edge and reaches every log line and every span, because reconstructing one request is the only thing logs do better than anything else.
- Cardinality is budgeted rather than hoped for. Measured on one counter: 100 series cost 0.2 MB and a 3.1 ms scrape; adding merchant_id with 500 values took it to 200,000 series, 243.6 MB and an 8,025.9 ms scrape, against a 15 second scrape interval. Monitoring becomes the outage, and the pull request that does it looks reasonable.
- Percentiles are aggregated by summing histogram buckets, never by averaging quantiles. With ten instances and one of them three times slower, the true p99 was 393.4 ms, the average of the instance p99s was 361.6 ms, and the maximum across instances was 906.2 ms. The average hid exactly the thing the dashboard exists to show.
- Buckets come from the measured distribution. Prometheus defaults reported a p99 of 450.1 ms when the exact value was 301.5 ms, a 49.3% error produced entirely by the gap between the 250 ms and 500 ms edges. Tuned buckets brought it to 1.6%.
- The SLO document is a page and the budget is a decision rule: 99.9% over 30 days is 43 minutes 12 seconds, and below a quarter of it remaining, feature work pauses. 4xx responses are excluded from the SLI on purpose, and the sentence saying why is in the document.
- Alerting is replayed rather than argued about. Over a simulated month with two incidents and two harmless blips: a threshold on error rate paged 4 times with 2 false pages; multiwindow burn rate paged twice with none, and detected the 35% incident in 2 minutes and the 8% one in 10, which is severity scaling nobody had to configure.
- The uncomfortable number from the same month: the two incidents were only 42% of all errors. The other 58% came from a quiet 0.05% background rate that never crossed a threshold and never woke anybody, and it was spending most of the budget.

## Where people get stuck

| Symptom | Cause |
|---------|-------|
| A scrape started timing out | A high cardinality label. Series count is the product across labels, and it never comes back down. |
| The latency dashboard was wrong by half | Default histogram buckets. The p99 landed in a bucket 250 ms wide and the interpolation was a guess. |
| One broken instance was invisible | Instance p99s were averaged. Sum the buckets, and also graph the maximum. |
| The trace stopped at the queue | Context has to travel inside the message, not in a header. |
| Sampling threw away the incident | Head sampling keeps 1% of errors at 1%. Tail sampling keeps all of them. |
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
