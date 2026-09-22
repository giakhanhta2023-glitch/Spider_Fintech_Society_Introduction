# The backend track, levels 5 to 20

Levels 1 to 4 teach money and Python: what a transaction is, what compounding is,
how to read a file of payments, and how a double-entry ledger works. They stay as
they are.

From level 5 the course changes target. Everything after this point exists to make
one person employable as a **backend engineer at a payments company**: Stripe,
Adyen, Capital One, Plaid, Block, Wise, Checkout.com, Marqeta, or the payments team
inside a bank. Nothing is included because it is interesting. Every level is here
because it appears in those job descriptions, in those interview loops, or in the
work of the first year on the job.

## What those employers actually ask for

Read twenty backend job descriptions from these companies and the same list comes
back, with different words on top:

| They write | It means |
|---|---|
| "Design and build resilient distributed systems" | Retries, idempotency, timeouts, and what happens when half a request succeeds |
| "Experience with relational databases" | Schema design, indexes, transactions, isolation levels, and reading a query plan |
| "Event-driven architectures, Kafka" | Producers, consumers, partitions, ordering, at-least-once delivery, the outbox pattern |
| "Java, Python, Go, or Scala" | Python is enough to get interviews; Java gets you Capital One and Adyen |
| "High-volume, low-latency services" | p99 latency, caching, connection pools, load shedding, and measuring before claiming |
| "Ownership, on-call" | Logs, metrics, traces, SLOs, alerts that mean something, and a runbook |
| "Payments domain knowledge a plus" | Authorisation, capture, settlement, chargebacks, reconciliation, ledgers |
| "Strong CS fundamentals" | The coding screen: complexity, hash maps, heaps, graphs, done under time pressure |
| "Cloud (AWS/GCP), Docker, CI/CD" | A container, a pipeline, infrastructure written as code, a deploy you can roll back |

The track below covers every row, in an order where each level needs only the ones
before it.

## The four phases

### Phase 1: software that handles money (levels 5 to 8)

| Level | Build | What it proves |
|---|---|---|
| 5 | **A money library**: a Money type, exact arithmetic, allocation without losing a cent, rounding rules, property-based tests, CI, packaging | That you write code other people can depend on, and that you test like somebody whose bug costs money |
| 6 | **The ledger schema in Postgres**: constraints, indexes, query plans, migrations, a million rows | The database half of every backend interview, and the half most candidates fake |
| 7 | **The payments API**: FastAPI, a versioned contract, validation, auth, idempotency keys, pagination, generated docs, integration tests | The job itself: most fintech backend work is an HTTP interface over a ledger |
| 8 | **Break it with concurrency**: races, row locks, optimistic control, timeouts, connection pools, a load test that reproduces a lost update and then proves it fixed | The question every payments interviewer asks, answered with your own reproduction |

### Phase 2: move money like a payments company (levels 9 to 13)

| Level | Build | What it proves |
|---|---|---|
| 9 | **The card lifecycle service**: authorise, capture, partial capture, void, refund, chargeback, expiry, with a simulator that behaves like a real network | The domain knowledge that separates a generic backend candidate from a payments one |
| 10 | **Reconciliation at scale**: processor settlement files, fees, FX, T+1 timing, break detection, an exception queue | The thing every payments company runs daily and few candidates have ever seen |
| 11 | **Events with Kafka**: the outbox pattern, partitions and ordering, consumer groups, idempotent consumers, replay, a dead letter queue | "Event-driven architecture" on your CV with a repository behind it |
| 12 | **The payout orchestrator**: sagas, compensating transactions, scheduled work, retry policy, failure injection | Distributed transactions: the senior-level system design answer, built small |
| 13 | **Scale and change**: partitioning, read replicas, change data capture, an online schema migration and a 50 million row backfill with no downtime | That you can change a running system without stopping it, which is most of the job |

### Phase 3: run it like production (levels 14 to 17)

| Level | Build | What it proves |
|---|---|---|
| 14 | **Latency work**: Redis, a token bucket rate limiter, cache invalidation, connection pooling, load shedding, a p99 budget you hit | "High volume, low latency" with numbers you measured |
| 15 | **Security engineering**: OAuth2, JWTs, mutual TLS, envelope encryption with a key service, a card vault with tokenisation, PCI scope, a threat model | The part of fintech that gets people fired, understood before you are hired |
| 16 | **Observability and on-call**: structured logs, metrics, traces, SLOs and error budgets, alerts that page for symptoms, a game day and a postmortem | Ownership, the word every job description uses and few candidates can evidence |
| 17 | **Ship it**: Docker, Terraform, AWS, a pipeline that gates a merge, blue-green deploys, feature flags, a cost model | That your work can leave your laptop |

### Phase 4: get hired (levels 18 to 20)

| Level | Build | What it proves |
|---|---|---|
| 18 | **Java and Spring Boot for a Python engineer**: types, the JVM, Spring Boot, JDBC, threads and virtual threads, JUnit, Testcontainers, and the same payments API ported and benchmarked | Capital One and Adyen are Java shops. This level is the difference between applying and being considered |
| 19 | **The interview gauntlet**: complexity, the data structures that come up, forty money-flavoured problems, and Stripe-style practical exercises: integrate, debug, migrate, under time | The screen that filters out most candidates before anybody reads their repositories |
| 20 | **System design and the capstone**: capacity arithmetic, six canonical payment designs written up properly, then the full platform assembled, load tested, and the hire-me package around it | The final round, and the portfolio that gets you into it |

## The rules this track keeps

- **Taught from nothing.** Every term is defined in a sentence before it is used. The
  reader knows levels 1 to 4 and nothing else.
- **Every level is a repository**, with a README, tests, and a reason for each
  decision. Twenty small repositories are worth less than sixteen serious ones.
- **Every number is measured**, not asserted. If a level claims a latency, a cost, or
  a throughput, the code that produced it ships with it.
- **Every dataset is synthetic**, generated by a script in `data/`.
- **Difficulty rises and does not apologise.** Later levels take days, not hours, and
  several are deliberately built to fail first, so the fix is something you did.
- **Interview framing stated out loud.** Each level names the questions it answers,
  because the point is a job.

## What this track does not cover

Frontend, mobile, data science beyond what a backend engineer meets, and quantitative
finance. A fintech backend engineer touches none of them in their first two years.
