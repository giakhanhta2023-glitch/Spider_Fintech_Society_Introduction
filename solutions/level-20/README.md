# Level 20: The mean was 45 milliseconds and the service was down

> **Ship the payment service** · build project · difficulty 9/10

## Read this second

Attempt the build yourself first, then ask the FinQuest tutor for a hint, and only then open this folder.
Read the part you are stuck on, close the file, and retype the fix from memory. Copying the solution into
your own project skips the only step that actually teaches you anything.

## The brief

Take the service you built in level 12 and make it something a team could run. Container, pipeline, migrations, the three signals, a load test, an objective with the arithmetic done, a cost estimate and a runbook. This is the repository you point at in an interview.

**Scope:** Builds directly on level 12, with level 11 for the schema and level 13 for the audit trail. Everything runs locally: Docker, Postgres, Prometheus, an OpenTelemetry collector and k6. The shipped load test file lets you do the analysis even if your own run comes out differently.

## Files here

| File | What it is |
|------|------------|
| `Dockerfile` | two stages, pinned by digest, non root, with a health check |
| `.github/workflows/ci.yml` | lint, types, tests against real Postgres, migration up then down, build, scan |
| `migrations/` | the six step expand and contract, with lock_timeout set |
| `app/observability.py` | structlog, the RED metrics, and the OpenTelemetry spans |
| `analysis/loadtest.py` | percentiles by window and by endpoint, from the shipped run |
| `slo/` | the two objectives, the budget arithmetic and the multiwindow burn rate alerts |
| `docs/` | a runbook page per alert, the drill record, and the cost estimate |
| `quiz-key.md` | all 15 drill answers with explanations |

## Run it

```bash
docker compose up --build   then   pytest -q && python -m analysis.loadtest
```

## Why the solution is shaped this way

- The Dockerfile is two stages and pinned by digest, so the compiler and the test dependencies never reach production and a build from a month ago reproduces byte for byte. It runs as uid 10001, because a container escape as root is a different incident.
- The pipeline applies every migration and then rolls it back. That is the step most repositories skip, and it is the one that answers the question you will ask during an incident.
- The rename is six migrations and three deploys rather than one. There is a test that runs the old application code against the new schema, which is the state the service is actually in during every rolling deploy.
- One id joins the three signals. The request id from level 12 and the trace id sit on the same log line, so a metric leads to a log line and a log line leads to a trace.
- Metric labels are the route template, the method and the status class, and nothing else. A customer id in a label turns a thousand series into ten million, and the bill arrives before the outage does.
- The load test analysis splits by window before it reports anything. The whole run averages 44.7 ms and 1.06% errors; steady state is 31.2 ms and 0.08%, and one minute is 152.7 ms and 9.82%. The summary line describes no minute of the run.
- The error budget is computed rather than quoted: 259,200 failures allowed a month at 100 rps, of which the bad minute spent 589, which is 0.23%. That number ends two arguments at once.
- The cost estimate includes the logs. 259.2 million requests at 400 bytes each is 103.68 GB a month, which at ordinary ingest prices costs more than the compute it describes.

## Where people get stuck

| Symptom | Cause |
|---------|-------|
| The image is over a gigabyte | A single stage build, or no .dockerignore. Check docker history and look for the layer that carries the build tooling. |
| Compose works for you and nobody else | Something is still on your machine: a local database, a file outside the repository, or an environment variable set in your shell months ago. |
| The deploy broke for two minutes | A migration that assumed only one version of the code was running. Expand and contract, and test the old code against the new schema. |
| Prometheus fell over | A high cardinality label. Count the series after a thousand distinct requests and find the label that grew with them. |
| The percentiles do not reproduce | Check the window boundaries first, then whether the percentile is interpolated. A p99 over a different window is a different number, and that is the lesson rather than a bug. |

## Self-checks the solution satisfies

- The image runs as a non root user and contains no .env, .git or test dependency
- docker compose up serves a request from a clean clone with no manual steps
- CI fails when a test is broken, and fails when a migration cannot be rolled back
- The old application code passes its tests against the post migration schema
- Every log line carries a request id, a trace id and a route template
- No log line contains a token, a card number, an email address or a full name
- No metric label has unbounded cardinality, asserted by counting series after a thousand distinct requests
- The analysis reproduces p50 26.4 ms, p95 75.6 ms and p99 111.0 ms for the steady state window
- The analysis reproduces 9.82% errors and 11.38% over 300 ms for the bad minute
- The error budget calculation returns 259,200 failures for 99.9% at 100 rps over 30 days
- The burn rate alert fires when the shipped incident is replayed and stays quiet in steady state
- The cost estimate reproduces 103.68 GB of logs a month from its stated assumptions

## How it is marked

| Points | Criterion | Meaning |
|--------|-----------|---------|
| 20 | Runs anywhere | Clean clone to serving request in one command, image small, pinned and non root. |
| 20 | The pipeline earns its place | Every stage present, fast enough to wait for, and shown to block a bad merge. |
| 15 | Deployable schema changes | Expand and contract done properly, with the old code tested against the new schema. |
| 20 | Observable | Three signals, joined by one id, with cardinality under control and a trace that locates the slow span. |
| 15 | Measured, not asserted | The load test analysis by window and endpoint, the objectives, and the budget arithmetic. |
| 10 | Operable | A runbook per alert, a drill that was actually run, and a cost estimate with its assumptions named. |

---

Part of [FinQuest](../../README.md) · Level 20 of 10
