# Level 17: The deploy you can undo

> **payments-platform: everything you built, deployable** · build project · difficulty 8/10

## Read this second

Attempt the build yourself first, then ask the FinQuest tutor for a hint, and only then open this folder.
Read the part you are stuck on, close the file, and retype the fix from memory. Copying the solution into
your own project skips the only step that actually teaches you anything.

## The brief

Take the payments API, the vault and the observability work, and make them one system somebody else could run. Containers that hold only what runs, a gate fast enough that nobody skips it, infrastructure in code, blue green with a rollback you have timed, flags with a kill switch, and a cost per payment you can defend.

**Scope:** Free tiers and local tools throughout. If you cannot run a cloud account, run the same shapes with Docker Compose and a local registry, and say so in the README. The reasoning is what is being assessed.

## Files here

| File | What it is |
|------|------------|
| `Dockerfile` | multi stage, non root, pinned base, real health check |
| `Dockerfile.naive` | kept, because the comparison is the lesson |
| `.github/workflows/gate.yml` | fast checks, one build, integration against that image |
| `app/config.py` | one validated object, and an error that never echoes a value |
| `app/health.py` | liveness and readiness, which are different questions |
| `app/flags.py` | read at request time, default off, kill switches, expiry dates |
| `deploy/bluegreen.py` | the readiness gate and both rollback paths, runnable |
| `deploy/rehearsal.py` | the measured deploy: broken version, two rollbacks, kill switch |
| `infra/` | terraform, remote state, a private database, and NOT_APPLIED.md |
| `k8s/` | one component, five objects, three probes, explained line by line |
| `migrations/` | six deploys, and the step where the rollback window closes |
| `ship/image.py` | what a single stage build would ship, measured |
| `ship/gate.py` | the gate, timed step by step |
| `ship/cost.py` | measured volumes, unverified prices, and the cost per payment |
| `COST.md` | the table, what to halve, and what would not be cut |
| `ARCHITECTURE.md` | every service, what it owns, and what happens when each dependency is gone |
| `quiz-key.md` | all 15 drill answers with explanations |

## Run it

```bash
pytest -q && python -m deploy.rehearsal && python -m ship.gate && python -m ship.cost
```

## Why the solution is shaped this way

- The image contains what runs and nothing else. Measured on the dependency tree, because the machine had no Docker: 60.7 MB and 3,424 files to run the service, 149.3 MB and 6,701 files once the test framework, type checker and linter are added. That is 88.6 MB shipped for no reason, and none of it executes in production.
- Layers are ordered by how often they change. Installing the runtime dependencies took 26.7 seconds, and a Dockerfile that copies source before installing pays that on every one line change rather than when the lockfile moves.
- Configuration is one validated object read at import, so a missing variable stops the service at start rather than on the first payment. The first version of that module interpolated the parse error, so a bad PORT printed the value: harmless there, and a password for DATABASE_URL. The test caught it, the parsers now carry an expectation string, and the value never reaches the message.
- The gate was timed step by step rather than guessed at. The syntax check over seventeen files took 6.71 s as seventeen processes and 1.13 s as one, six times faster with nothing removed and nothing relaxed. Startup, not work, which is what the largest number in a slow pipeline usually is.
- Blue green is chosen for the rollback column. Measured over five runs: a good deploy became ready in 57.6 ms, a rollback by switching reached its first healthy response in 6.8 ms, and the deliberately broken version served zero requests because readiness never passed.
- Writing the rehearsal found the hazard nobody mentions: with two sides, deploying onto the idle side overwrites the rollback target, so a failed deploy has already destroyed it. The rollback is then a deploy again, at 636.2 ms rather than 6.8, and both numbers are published rather than the flattering one.
- Migrations and the code that needs them never deploy together. The six deploy sequence was run against PostgreSQL 18.6 on 25,700 rows: at step 4 both code versions read all 25,500 rows with zero disagreements, which is the rollback proof, and at step 5 they disagree on 200 rows, which is the rollback window closing. That step is the one nobody writes down.
- The cost model separates what is measured from what is not. Volumes come from levels 15 and 16: 152 bytes a log line, six lines a payment, 151 metric series an instance, four spans a trace, one data key per hundred records. All nineteen unit prices are marked unverified, with the command that replaces them, and the total is $2,968 a month or $0.000023 a payment against a $2.56 card fee.
- Access is by role rather than by key. The task role is scoped to one secret, one key, one bucket prefix and two queues, the one unavoidable wildcard is narrowed by a condition and commented, and a test in the gate scans the repository and the environment for key shaped strings.
- Kubernetes is present at the depth the interview asks for: one component, five objects, and the three probes with the reason each exists. Liveness must not check a dependency and readiness must, and getting that backwards turns a thirty second database blip into every Pod restarting at once.
- What was not verified is listed rather than implied. Terraform has never been applied and infra/NOT_APPLIED.md says so line by line, the manifests were parsed and never scheduled, and the image checks are static plus a step in the gate.

## Where people get stuck

| Symptom | Cause |
|---------|-------|
| The image is enormous | The build toolchain is inside it. A later RUN that deletes files does not help: layers are forever. |
| Every code change rebuilds everything | Source copied before dependencies are installed. |
| It started fine and failed on the first payment | Configuration read lazily instead of validated at start. |
| A password appeared in a startup error | The parse exception was interpolated into the message. Say what was expected, never what arrived. |
| People bypass the pipeline | It is too slow. Time the steps; the answer is usually startup or a cold cache, not the tests. |
| Rollback took twenty minutes | Rolling deploys. Blue green makes it the switch going back. |
| The rollback button did nothing | A failed deploy had already overwritten the idle side, so there was no good version to switch to. |
| Rollback was impossible | A migration shipped with the code that needed it, or steps 4 and 5 of the sequence went out together. |
| A secret turned up in a bucket | It was in a terraform variable, so it is in the state file in plaintext. |
| The first cloud bill was a surprise | A NAT gateway and an idle database charge by the hour whether or not anything uses them. The billing alarm goes in before the first resource. |
| A wildcard policy shipped | "Action": "*" added at 6pm to make an error go away. Start from nothing and add the one action that failed. |
| A secret sat in a Kubernetes Secret | Base64 is not encryption. The object holds a reference; the value stays in the secret manager. |

## Self-checks the solution satisfies

- The final image contains no test framework, linter or compiler
- A one line source change rebuilds without reinstalling dependencies
- The container refuses to start when a required variable is missing, naming it
- The container does not run as root
- The readiness probe fails while the database is unreachable, and the instance leaves the load balancer
- The gate fails on a deliberately broken commit, and the deploy step cannot run without it
- The image that integration tests ran against is the image that deploys
- A terraform plan against an untouched environment shows no changes
- Staging can be destroyed and rebuilt from the repository alone
- No long lived cloud access key exists in the repository, the environment or the shell profile
- The database refuses a connection from outside its security group
- The Kubernetes readiness probe removes a pod from the Service while its dependency is unavailable
- A deliberately broken version deployed to the idle side receives no traffic
- A rollback completes within the time stated in your README
- Turning off the payout kill switch stops payouts without a deploy
- Rolling back to the middle of an expand and contract migration breaks nothing

## How it is marked

| Points | Criterion | Meaning |
|--------|-----------|---------|
| 20 | The artefact | Multi stage, ordered layers, non root, pinned, health checked, with sizes and build times reported. |
| 20 | The gate | Fast, deterministic, builds once, cannot be walked around, with step timings and one improvement. |
| 20 | Infrastructure | Terraform with remote state, a clean plan, staging rebuilt from the repository, roles rather than keys, and a private database. |
| 25 | Deploy and undo | Blue green, a timed rollback, flags with a kill switch, and a migration rollback proven mid flight. |
| 15 | Cost | A real cost model, a per payment number, and a defensible answer on what to cut and what not to. |

---

Part of [FinQuest](../../README.md) · Level 17 of 20
