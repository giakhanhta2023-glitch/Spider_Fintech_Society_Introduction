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
| `infra/` | terraform, remote state, one variable set per environment |
| `deploy/bluegreen.sh` | the switch, and the rollback that was timed |
| `flags/` | read at request time, default off, kill switches listed |
| `COST.md` | the table, the cost per payment, and what would be cut first |
| `ARCHITECTURE.md` | every service, what it owns, what it depends on |
| `quiz-key.md` | all 15 drill answers with explanations |

## Run it

```bash
docker build -t pay:slim . && ./deploy/bluegreen.sh staging && ./deploy/rollback.sh --time
```

## Why the solution is shaped this way

- The image contains what runs and nothing else. Measured on the dependency tree: 60.8 MB and 3,424 files to run the service, 154.7 MB and 6,873 files once the test framework, type checker, linter, formatter and coverage tool are added. That is 94.0 MB shipped for no reason, and none of it executes in production.
- Layers are ordered by how often they change. Installing the runtime dependencies took 29.7 seconds, and a Dockerfile that copies source before installing pays that on every one line change rather than when the lockfile moves.
- Configuration is one validated object read at import, so a missing variable stops the service at start rather than on the first payment. Secrets never enter the image, which is level 15 unchanged.
- The gate was timed step by step rather than guessed at. The syntax check over twenty files took 9.63 s as twenty processes and 0.61 s as one, taking the whole gate from 15.97 s to 6.95 s with nothing removed and nothing relaxed. Startup, not work.
- Blue green is chosen for the rollback column rather than the deploy column: both versions run, so getting back is the load balancer switching, and the README states the measured seconds from decision to first healthy response.
- Migrations and the code that needs them never deploy together. The expand and contract sequence from level 13 is what makes a rollback in the middle safe, and the repository proves it by rolling back mid migration on purpose.
- The cost model turns the architecture into a number per payment, using real list prices and the log and metric volumes measured in level 16, next to a 2.9% plus 30 cent processing fee.
- Each local component is mapped to the managed service that would run it: RDS or Aurora for the ledger, Fargate for the API, ElastiCache for the limiter, S3 for settlement files, KMS for the level 15 master key, and EventBridge for the level 12 sweeper. KMS is the one to read twice, because envelope encryption is literally its interface.
- Access is by role rather than by key. The task role carries the narrowest policy that works, scoped to one bucket prefix and one key rather than to a wildcard, and no long lived access key exists anywhere. The database has no public address and accepts connections only from the service security group.
- Kubernetes is present at the depth the interview asks for and no deeper: one component deployed to a local cluster with a manifest written by hand, and the object model named, Pod through Deployment, Service and Ingress. The README says plainly why the platform itself does not need it.

## Where people get stuck

| Symptom | Cause |
|---------|-------|
| The image is enormous | The build toolchain is inside it. A later RUN that deletes files does not help: layers are forever. |
| Every code change rebuilds everything | Source copied before dependencies are installed. |
| It started fine and failed on the first payment | Configuration read lazily instead of validated at start. |
| People bypass the pipeline | It is too slow. Time the steps; the answer is usually startup or a cold cache, not the tests. |
| Rollback took twenty minutes | Rolling deploys. Blue green makes it the switch going back. |
| Rollback was impossible | A migration shipped with the code that needed it. |
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

Part of [FinQuest](../../README.md) · Level 17 of 10
