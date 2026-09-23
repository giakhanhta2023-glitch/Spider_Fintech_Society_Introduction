# Level 20: The whiteboard, and the thing you hand over

> **payments-platform-capstone: all of it, running, measured, and packaged** · build project · difficulty 10/10

## Read this second

Attempt the build yourself first, then ask the FinQuest tutor for a hint, and only then open this folder.
Read the part you are stuck on, close the file, and retype the fix from memory. Copying the solution into
your own project skips the only step that actually teaches you anything.

## The brief

One repository that starts the whole platform with a single command, takes an hour of real load, survives four injected failures with the reconciliation still at zero, performs a schema migration without dropping a request, and hands a stranger enough to decide to interview you in ninety seconds.

**Scope:** Assembly and evidence rather than new features. Anything that has to change to make the services run together is part of the exercise, and the documents count as much as the code.

## Files here

| File | What it is |
|------|------------|
| `docker-compose.yml` | every service, one command, a fresh clone |
| `bench/` | the hour long run and the report it writes |
| `chaos/` | four failures, injected under load, with timings |
| `recon/daily.py` | the check across every service that must return zero |
| `ARCHITECTURE.md` | diagram, ownership, dependencies, failure behaviour |
| `decisions/` | context, options, decision, consequences |
| `designs/` | six one page system designs |
| `README.md` | diagram, one sentence, five measured results |
| `quiz-key.md` | all 15 drill answers with explanations |

## Run it

```bash
docker compose up -d && python seed.py && python -m bench.run --minutes 60 && python -m chaos.all
```

## Why the solution is shaped this way

- The capstone is assembly and evidence rather than new features. Anything that has to change to make the services run together was part of the exercise, and those changes are listed in the README because they are the honest output of level 17.
- Capacity was estimated before anything was measured, so the measurements had something to disagree with: 50 payments a second averages 130 million a month and about 2.3 TB a year, which fits on one Postgres, so nothing here is sharded and the README says why.
- The load test is an hour, warmed up, with p50, p99 and goodput, and it reports the utilisation at which the objective stops being met rather than the theoretical capacity.
- The share of the monthly error budget spent during that hour is reported. An hour of load testing that spends a third of the budget means the objective is wrong or the system is.
- Four failures are injected under load: the ledger database, a slow then failing bank, a stopped publisher, a revoked credential. Each one records what fired, time to detection, time to recovery, and whether money moved twice.
- The single result the whole capstone turns on is the daily reconciliation returning zero after every one of those scenarios. It is the only check that requires every service to agree with every other service.
- The package is built for ninety seconds of attention: the diagram, one sentence, five measured results, and a two minute video with no slides. Every number in it is reproducible by a command in the repository, and anything that is not was deleted.

## Where people get stuck

| Symptom | Cause |
|---------|-------|
| Services would not run together | Hard coded ports, database names and paths. That is the exercise rather than an obstacle. |
| The load test looked fine and production would not | Closed loop generation, or no warm up. Both measure something other than overload. |
| Chaos passed but reconciliation did not | The right outcome to find in a rehearsal. Money moving twice shows up here and nowhere else. |
| The README opened with installation instructions | Ninety seconds. Diagram, sentence, five results. |
| A number could not be reproduced when asked | One undefendable number undoes all the others. Delete it or make it runnable. |

## Self-checks the solution satisfies

- A fresh clone starts the platform with one command and passes the smoke test
- A payment flows from the API through the ledger, the events and the payout without manual intervention
- The hour long load test completes and writes a report with percentiles and goodput
- Killing the ledger database under load loses no money, and the reconciliation still returns zero afterwards
- A bank that times out leaves payouts in an explicit unknown state, and the sweeper resolves all of them
- Stopping the publisher for ten minutes loses no events, and the consumer catches up
- A revoked vault credential produces a clear failure and a firing alert rather than silent errors
- A schema migration under load completes with zero failed requests
- The daily reconciliation returns zero breaks after every chaos scenario
- Every number in the landing README can be reproduced by a command in the repository

## How it is marked

| Points | Criterion | Meaning |
|--------|-----------|---------|
| 20 | It runs | One command, a fresh clone, a payment end to end through every service. |
| 25 | It holds | An hour under load with percentiles and goodput, and the utilisation where the objective breaks. |
| 25 | It survives | Four injected failures with detection and recovery times, and reconciliation at zero after each. |
| 15 | It is legible | Architecture document, three decision records, and six one page designs. |
| 15 | It is hireable | A two minute video, a README leading with five measured results, and a CV where every line has a number. |

---

Part of [FinQuest](../../README.md) · Level 20 of 10
