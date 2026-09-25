# payments-platform

Everything from levels 6 to 16, deployable, with the deploy and the undo both
timed.

```bash
pip install -r requirements-dev.txt
pytest -q                      # 27 tests, 8 more with a service running
python -m deploy.rehearsal     # blue green, a broken deploy, two rollbacks
python -m ship.gate            # the merge gate, timed step by step
python -m ship.image           # what a single stage build would ship
python -m ship.cost            # the cost per payment
```

Nothing above needs Docker, a cluster or a cloud account, because this machine had
none of the three. What that does and does not allow is the first section, because
a deployment solution that quietly implies it was deployed is worth nothing.

## What was run, and what was only written

| Claim | How it stands |
|---|---|
| Blue green refuses to switch to a version that never becomes ready | **Run.** Five times. The broken version served 0 requests |
| A rollback completes in the time stated | **Run.** 6.8 ms by switching, 636.2 ms by redeploying, medians of five |
| The payout kill switch stops payouts without a deploy | **Run.** 201 becomes 503, same process, no restart |
| An expand and contract migration is safe to roll back mid flight | **Run**, on PostgreSQL 18.6, 25,700 rows. See `migrations/README.md` |
| The service refuses to start on a missing or invalid variable | **Run.** And it does not echo the value, which took a fix |
| Readiness fails while a dependency is down and liveness does not | **Run** |
| A single stage build ships 88.6 MB of tooling that never executes | **Measured**, on the dependency tree, since there is no Docker |
| The gate is faster with one process than with twenty | **Measured.** 6.71 s against 1.13 s |
| No long lived cloud key exists in the repository or the environment | **Run**, as a test, in the gate |
| Terraform is valid, plans cleanly, and rebuilds staging | **Not verified.** `infra/NOT_APPLIED.md` says exactly what that means |
| The Kubernetes manifests behave as described | **Not applied.** Parsed and asserted against, never scheduled |
| The image contains no test tooling, and does not run as root | **Static.** The requirements split, the stage boundary and the `USER` line are asserted; the gate checks the built image |

## 1. The artefact

Measured on the dependency tree, which is what Docker would be copying:

| | Size | Files | Install |
|---|---|---|---|
| An empty virtual environment | 22.3 MB | 1,497 | |
| Plus the runtime dependencies | 60.7 MB | 3,424 | 26.7 s |
| Plus the development tooling | 149.3 MB | 6,701 | 42.3 s more |
| **Shipped for no reason** | **88.6 MB** | **3,277** | |

146% more than the runtime needs, and none of it executes in production: pytest,
hypothesis, mypy and ruff, sitting in an image that serves payments. A later
`RUN rm -rf` does not help, because layers are additive and forever.

`Dockerfile.naive` is kept for the comparison and is not a straw man. It is what a
first Dockerfile looks like, and each of its four problems is a reasonable thing
to have written.

Layer ordering is the other half. The requirements file is copied and installed
before the source, so a one line code change reuses the layer and only a lockfile
change pays the 26.7 seconds. Copy the source first and every commit reinstalls
everything, for every developer, in every pipeline run.

## 2. The gate

Timed with `python -m ship.gate`:

| Step | Seconds | Note |
|---|---|---|
| syntax check, one process per file | 6.71 | 17 interpreters started |
| **syntax check, one process** | **1.13** | identical checks, identical result |
| imports resolve | 2.72 | catches a circular import, which no linter does |
| lint | 3.52 | ruff, clean |
| type check | 1.33 | mypy, clean |
| unit tests | 12.76 | 27 tests, including the deploy rehearsal |

**Six times faster on that step, and nothing was removed or relaxed.** The work
was identical; the 5.58 seconds were interpreter startup, 17 times over. That is
the shape of most slow pipelines: the largest number is almost never the tests,
and the only way to know is to time each step rather than to have an opinion about
it.

The steps are ordered by how fast they fail. A gate that takes four minutes to
report a missing comma is a gate people work around, and a gate people work around
is worse than no gate, because everybody believes in it.

Two properties of `gate.yml` are structural rather than aspirational: the image is
built once and referred to everywhere by digest, and `deploy` needs `check`,
`build` and `integration`. The deploy cannot run without the gate because of the
dependency graph, not because of a policy.

## 3. The deploy, and the undo

```
python -m deploy.rehearsal
```

Five acts, five runs, medians:

| | Measured |
|---|---|
| A good deploy becoming ready on the idle side | 57.6 ms |
| **Rollback by switching**, to the first healthy response | **6.8 ms** (5.4 to 11.6) |
| Requests served by the broken version | **0** |
| Rollback while the idle side holds a broken version | refused, correctly |
| **Rollback by redeploying** the last known good version | **636.2 ms** (583.6 to 762.4) |
| Payout with the kill switch on, then off | 201, then 503 |

Add the load balancer's own health check interval to the first two against real
infrastructure: two consecutive successes at a five second interval is ten seconds
before a target group routes to a new version, which dominates everything above.

**The hazard writing this turned up.** With two sides, deploying onto the idle
side overwrites whatever was there, so **a failed deploy has already destroyed the
rollback target**. After `blue=v1, green=v2 active`, a broken v3 deploy replaces
v1 on blue. The fast rollback is then gone, and the honest number is the slow one:
636.2 ms instead of 6.8, a factor of 93, because the rollback became a deploy
again.

The first version of the rehearsal crashed on exactly this, which is how it was
found. `Router.rollback()` now refuses to switch to a side that is not ready, and
`rollback_by_redeploy()` is the slow path with its own published number. A runbook
quoting only the fast one promises seven milliseconds and delivers a readiness
gate.

## 4. Configuration, and a leak in my own module

One validated object, read at import, every problem reported at once:

```
the service cannot start because its configuration is wrong:
  ENVIRONMENT is required and was not set
  DATABASE_URL is required and was not set
  PORT is invalid: must be a port between 1 and 65535
```

The first version interpolated the exception, so `PORT=eighty` produced `invalid
literal for int() with base 10: 'eighty'`. Harmless for a port. The same code path
handles `DATABASE_URL`, whose value contains a password, so that message shape
would have put a credential in a log line. The test
`test_an_invalid_value_is_refused_without_echoing_it` caught it, the parsers now
carry an expectation string, and the value never reaches the message.

That is the second bug this level's own tests found in code that looked finished,
and both were in error handling. Error paths are where the leaks are, because
nobody reads them in review and nobody sees them in a demo.

## 5. Migrations, and the window that closes

Six deploys to replace one column, run against PostgreSQL 18.6 on 25,000 rows:

| Step | Result |
|---|---|
| 1. add the column, nullable | 7.4 ms, metadata only, no rewrite |
| 3. backfill in batches of 10,000 | 124.5 ms total, longest single statement 49.4 ms |
| **4. code reads the new column** | both code versions correct on all 25,500 rows, **0 disagreements** |
| **5. code stops writing the old one** | **200 rows now disagree.** The rollback window has closed |
| 6. drop the old column | `set not null` 2.5 ms, `drop column` 3.8 ms |

Step 4 is the one the level asks to be proved, and it is proved by running both
versions of the read query against the same rows rather than by reasoning about
it. Step 5 is the one nobody writes down: from there a revert returns the wrong
fee silently, which no error rate will show and reconciliation will find next
week. `migrations/README.md` has the whole sequence and both rollback plans.

## 6. Infrastructure, honestly

`infra/` has never been applied. `infra/NOT_APPLIED.md` lists what that leaves
unverified and what to run before trusting it. Three lines are worth reading
anyway:

**The database's security group refers to the service's security group**, not to a
CIDR block. That is the one line behind "the database refuses a connection from
outside its security group", and a private range here would admit every instance
in the VPC including the one somebody started to debug something last year.

**The IAM policy is scoped to one secret, one key, one bucket prefix and two
queues.** There is exactly one wildcard resource, it is `cloudwatch:PutMetricData`
which has no resource ARN, and it is narrowed by a condition on the namespace with
the reason in a comment. A test asserts that count stays at one.

**The billing alarm is a dependency of the VPC.** Terraform cannot create a
billable resource in an account with no alarm. A NAT gateway costs about $66 a
month for two before they move a byte.

Access is by role throughout: the task role for the service, OIDC for the
pipeline. There is no long lived access key in the repository, the environment or
the workflow, and a test in the gate scans for key shaped strings to keep it that
way.

## 7. Kubernetes, at the depth the interview asks for

One component, a manifest written by hand, and the object model named:

```
Container -> Pod -> ReplicaSet -> Deployment -> Service -> Ingress
```

The three probes are the part worth knowing, and getting them the wrong way round
is a real outage: **liveness must not check a dependency**, because a thirty second
database blip then restarts every Pod at once with cold caches, while **readiness
must**, because an instance that cannot reach the database has nothing useful to do
with a request. The startup probe exists so a slow boot is not read as a crash.

Two resource decisions with reasons: the memory limit equals the request, because
exceeding a memory limit is an immediate kill with exit code 137 and no stack
trace; and there is no CPU limit at all, because a CPU limit throttles the process
even on an idle node and shows up as a p99 nobody can explain.

The platform itself runs on Fargate rather than Kubernetes, and `ARCHITECTURE.md`
says why: six services, one language, one team. Kubernetes earns its complexity at
a size this is not, and knowing where that line is matters more than knowing the
YAML.

## 8. Cost

$2,968 a month, **$0.000023 per payment**, against a card fee of $2.5591 on the
mean capture. Infrastructure is one part in 113,327 of the fee.

The volumes are measured in levels 15 and 16. The prices are not: all nineteen are
marked `verified: false` in `ship/prices.yml`, with the command that replaces
them. `COST.md` has the table, which two lines to halve and how, and the four
things that would not be cut at any price.

## Where the numbers came from

Every figure in this README is produced by a command in it, on one Windows laptop,
Python 3.11.9. The seeded ones are identical everywhere; the timings move with
whatever else the machine is doing, and the rehearsal reports every run rather
than only the median so the spread is visible.

The level itself publishes a few figures from the rig used while writing it. Two
differ here and both are explained: the tooling cost is 88.6 MB rather than 94.0
because this requirements file drops `black` in favour of `ruff format`, and the
gate's syntax step is 6.71 s against 1.13 s over 17 files rather than 9.63 s
against 0.61 s over 20, on a different afternoon. The ratio survives; the
absolute numbers are a laptop.

One number in the level was wrong and is now corrected there: the compute line of
the cost table read $3,504 for an arithmetic that gives $350.40. The total and the
per payment figure inherited it, and the paragraph after the table argued that
idle compute was most of the bill. With the arithmetic fixed the database is half
the bill and compute is 10%, which is both the truth and the more common shape.

---

Part of [FinQuest](../../../README.md) level 17.
