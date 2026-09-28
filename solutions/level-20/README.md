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
| `platform_/` | six services in one process: ledger, vault, queue, bank, gateway, alerts |
| `seed.py` | one payment end to end, as the smoke test |
| `bench/load.py` | the hour, open loop, goodput, and the sweep that finds where each objective breaks |
| `bench/budget.py` | the share of the monthly error budget the hour spent |
| `chaos/scenarios.py` | four failures under load, with detection and recovery |
| `migrate/under_load.py` | the six deploys from level 17, with traffic on them |
| `recon/daily.py` | seven checks across every service that must return zero |
| `recon/measure.py` | the reconciliation timed against the quadratic version it replaced |
| `ARCHITECTURE.md` | ownership, dependencies, and what happens when each one is gone |
| `decisions/`, `designs/`, `runbooks/` | three records, six designs, one runbook per alert |
| `CV.md`, `video/SCRIPT.md` | the lines with numbers in them, and the shot list for the video |
| `quiz-key.md` | all 15 drill answers with explanations |

## Run it

```bash
python seed.py && python -m bench.load --minutes 60 && python -m bench.budget && python -m chaos.scenarios && python -m migrate.under_load && python -m recon.daily
```

## Why the solution is shaped this way

- The capstone is assembly and evidence rather than new features, and the one thing it changes about every earlier level is honesty about how it is run: six services in one process, because there is no container runtime on this machine. What carries across is the logic, the ordering and the reconciliation. What does not is serialisation, connection pools and an orchestrator killing a process mid lock, and the decision record lists all of it rather than leaving a reader to find out.
- Capacity was estimated before anything was measured, so the measurements had something to disagree with: 50 payments a second is 130 million a month and about 2.3 TB a year, which fits on one Postgres, so nothing here is sharded and the architecture document says why.
- The hour is the headline and the budget arithmetic is what makes it mean anything: 180,001 payments offered at 50 a second, all accepted, a p99 of 6.4 ms against a 500 ms objective and not one request outside it, so the run spent 0.0000% of a monthly error budget it had every right to spend 0.139% of. The reconciliation afterwards checked 1,261,757 facts and returned zero breaks.
- The budget arithmetic is its own module over the report file rather than part of the bench, so the share of the monthly budget can be recomputed against a report that already exists instead of by spending another hour. The targets it divides by are the level 16 objectives, written before any of this ran, which is the order that makes the answer mean anything.
- The sweep is the result worth arguing with, because the objective that breaks is not the one a capacity plan usually quotes. From 500 to 8,000 payments a second offered, the p99 stayed inside the 500 ms objective at every rate, and the payout backlog grew from the very first one: 2,734 payouts still waiting at 500 a second, 69,865 at 8,000. A payments platform has two capacities and only one of them belongs to the API, which is why freshness is its own objective.
- That finding comes with an artefact worth separating out: the payout worker is a thread in the same process as the load generator, so it competes for one interpreter lock and its ceiling here is a few hundred payouts a second rather than a real worker thousands. The shape is right and the number is not transferable, and it is stated next to the number rather than in a footnote.
- The load test measures from the moment each request was due rather than from when it started, which is the fix for coordinated omission: timing from the start hides exactly the requests a struggling system has not reached yet, and the first version of this bench reported a healthy p99 during an overload for that reason. It also sets the Windows timer to 1 ms, because a default 15.6 ms sleep granularity means an open loop generator asking for 500 arrivals a second gets about 64 and measures its own clock.
- The chaos runner found a money bug in the capstone own payout worker, which is the argument for running the thing rather than reading it: the bank was called before the ledger entry could be written, so during the database outage one payout in four hundred was paid with nothing recorded and nothing that would ever resolve it. The rule now is to refuse to call the bank when the record cannot be written, and to mark the payout unknown rather than pending if the record fails after the money has moved, because unknown is the state the sweeper resolves.
- Each of the four failures records what fired, the time to detection and the time to recovery, and the assertion under each one is about the money rather than about the alert: 200 of 200 payments refused with zero recorded during the database loss, every timed out payout resolved by asking the bank about a reference that predates the first attempt, 700 events queued and none lost, 60 of 60 refused with the dependency named. Reconciliation returns zero after every one.
- The migration is the six deploys from level 17 with traffic on them, which that level could not do: 1,170 requests across the sequence, zero failed, and at step 4 both code versions read 500 sampled rows with zero disagreements, which is the evidence that a rollback there is a plain revert rather than a data recovery.
- The reconciliation was quadratic and the capstone own load test is what found it, by getting slower at every rate. One pass to index the ledger by reference replaced a scan per payment: 24,061.8 ms against 26.1 ms at 8,000 payments. The 923 times is not the interesting number, the ratio growing from 201 times at 2,000 payments is, because that is what quadratic looks like from outside. `recon/measure.py` re-runs the comparison at several sizes and asserts that both versions count the same transactions, so the ratio is reproducible rather than remembered.
- What could not be done is listed rather than implied: the compose file is written and has never been run, the video is a script rather than a recording, and this lives as a solution folder rather than as its own public repository. Each of those is one line in the README, in the place where somebody would otherwise assume the opposite.

## Where people get stuck

| Symptom | Cause |
|---------|-------|
| Services would not run together | Hard coded ports, database names and paths. That is the exercise rather than an obstacle. |
| The load test looked fine and production would not | Closed loop generation, or no warm up. Both measure something other than overload. |
| The load test measured its own sleep | A 15.6 ms timer granularity against a 2 ms interval. Set the timer, then spin the last stretch. |
| A healthy p99 during an obvious overload | Latency timed from when the request started rather than from when it was due. |
| One payout in four hundred paid with no record of it | The bank was called before the ledger write, and the write failed. Refuse the call instead, and use unknown rather than pending when the money has already moved. |
| The chaos report said zero unknown payouts | The peak was read after everything had settled. Sample it inside the loop. |
| The worker reported a thousand attempts on one payment | A payout put back on the queue and popped again in the same pass. Break out when the ledger is unavailable. |
| The reconciliation got slower at every rate | A ledger scan per payment. Index once, then look up. |
| 20,902 facts checked on four payments | A count summed with an amount in minor units. Keep counts and money in separate dictionaries. |
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

Part of [FinQuest](../../README.md) · Level 20 of 20
