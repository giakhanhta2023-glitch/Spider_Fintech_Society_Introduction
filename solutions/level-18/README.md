# Level 18: Java, for somebody who already writes Python

> **payments-api-java: the same service, on the JVM** · build project · difficulty 8/10

## Read this second

Attempt the build yourself first, then ask the FinQuest tutor for a hint, and only then open this folder.
Read the part you are stuck on, close the file, and retype the fix from memory. Copying the solution into
your own project skips the only step that actually teaches you anything.

## The brief

Port the payments API from level 7 to Java and Spring Boot, with the money type from level 5, the state machine from level 9, the race from level 8 reproduced against a real Postgres in CI, and an honest benchmark against the Python original.

**Scope:** Java 21 or later, Maven, Spring Boot, Testcontainers. The contract does not change: the same tests that exercised the Python service must pass against this one with only the base URL changed.

## Files here

| File | What it is |
|------|------------|
| `payments-api-java/money/Money.java` | long minor units, exact, overflow throws |
| `payments-api-java/card/AuthResult.java` | sealed, so an unhandled outcome is a compile error |
| `payments-api-java/api/PaymentApi.java` | the level 7 contract, on the JDK own server, tested over HTTP |
| `payments-api-java/tx/` | both @Transactional traps, with a real dynamic proxy |
| `payments-api-java/race/LostUpdateTest.java` | the level 8 race with real threads, and three fixes |
| `payments-api-java/bench/VirtualThreads.java` | two executors, two handler shapes, five concurrencies |
| `payments-api-java/bench/WarmUp.java` | the JIT curve, measured twice because the first try measured the socket |
| `payments-api-java/docs/` | the compile failure and the lost update, with real output |
| `payments-api-java/spring/` | the Spring layer, written and never built, with NOT_BUILT.md saying so |
| `webhook-sender/` | the Go component: worker pool, timeouts, jitter, graceful shutdown |
| `bench/python_baseline.py` | the same operation in Python, for the comparison |
| `quiz-key.md` | all 15 drill answers with explanations |

## Run it

```bash
javac -d target/classes $(find src/main/java -name "*.java") && java -cp target/classes finquest.bench.WarmUp && cd ../webhook-sender && go test ./...
```

## Why the solution is shaped this way

- The port is of one service rather than of the whole course, because the second port teaches nothing the first did not. The payments API was chosen because it exercises HTTP, validation, idempotency, a state machine and tests at once.
- Money is long minor units with BigDecimal only where fractions of a cent are genuinely needed, and both classic traps are tests rather than warnings: BigDecimal from a double is 0.1000000000000000055511151231257827, and equals disagrees with compareTo about 1.0 and 1.00 so a HashSet holds one amount twice.
- The int limit is treated as a real constraint. 2,147,483,647 minor units is $21,474,836.47, an int wraps to negative past it with no error, and the test asserts the wrap so nobody has to take it on trust.
- The sealed interface is the reason to be on the JVM, and the repository proves it by breaking on purpose: adding a fourth outcome produces "the switch expression does not cover all possible input values" with two file and line references, and docs/compile-failure.md has the real javac output plus the three details that silently remove the check.
- Both @Transactional traps are demonstrated with a real JDK dynamic proxy rather than with Spring, because both come from the proxy: an internal call opens no transaction at all, and a checked exception commits under the default rollbackFor. The journal the test asserts on reads "begin, commit despite AccountClosed".
- The lost update reproduces with sixteen threads and loses 91% of deposits with no error anywhere, and the three fixes are measured side by side: optimistic locking needed 13,446 retries for 3,200 deposits, which is the price of being optimistic under contention. The SQL fixes are verified on PostgreSQL 18.6, where a stale version updates zero rows.
- Getting that reproduction reliable took two attempts. Thread.onSpinWait() is a hint the JIT may compile away, so the race failed to show up about one suite run in three, and a flaky test proving a real bug is worse than no test because it teaches people to re-run the suite.
- Virtual threads are measured rather than assumed, and the honest result is in two halves. For a CPU bound handler they are not a performance feature: a fixed pool of 200 was faster between 8 and 256 concurrent requests. With every request waiting 20 ms on a dependency and a thousand concurrent, they gave a p50 of 61.67 ms against 133.92 and zero failures against 4.9%.
- The warm up curve was measured twice because the first attempt measured the wrong thing: over loopback HTTP the p50 was 5 ms and the p99 sat near 39 ms with no trend, which is delayed acknowledgement meeting Nagle rather than the compiler. Measured in process, p50 improves 8.6 times and p99 34.6 times over a second and a half, and that is where a readiness delay and a canary window come from.
- The Java against Python comparison is the same operation in both rather than two HTTP servers, so it measures the runtimes. Warm, the JVM is 3.9 times faster at 0.80 us against 3.10 us; cold, its first bucket at 6.90 us is slower than Python steady state. And in a real service the database is 1 to 5 ms, so the runtime is under one percent of the request and the language is not why anything is slow.
- One component is written in Go rather than a second full port: the webhook sender, with a worker pool, a timeout on every call, retries with full jitter and a shutdown that releases what it has claimed. 222,226 deliveries a second at 256 workers against a null transport, and 9,707 concurrent deliveries in 15 MB of heap. The claim it supports is that an unfamiliar language can be picked up and shipped in, which is what a hiring manager probes.
- Writing the Go tests found two bugs in the Go code, which is the argument for the tests rather than the benchmarks: a batch of claimed events was dropped on shutdown, invisible because a claimed row is not a pending row, and the 5 ms claim ticker rather than the work was setting the throughput.
- What could not be built is listed rather than implied. There is no Maven here so Spring cannot be compiled, and no container runtime so Testcontainers cannot run; both are written, both say NOT_BUILT at the top, and the table in the README names the running code that covers the same behaviour.

## Where people get stuck

| Symptom | Cause |
|---------|-------|
| Amounts went negative above twenty million dollars | int instead of long. It wraps silently, with no error. |
| Rounding disagreed with the Python service by a cent | A double somewhere upstream of the BigDecimal. |
| Two equal amounts compared unequal | equals compares scale. Use compareTo for money, or a long. |
| A transaction did not roll back | A checked exception and no rollbackFor, or an internal call bypassing the proxy. |
| The connection pool ran out under light load | open-in-view left on, holding a connection for the whole request including the response write. |
| The benchmark flattered Java | No warm up. The JIT compiles as it runs, so a short run measures the interpreter. |
| The benchmark flattered the network | A loopback p99 near 40 ms is delayed acknowledgement, not your code. Measure the handler as well as the request. |
| Virtual threads made it slower | The handler does not block. They are for waiting, not for computing. |
| The load test reported a 10,000 ms p99 | Failures were recorded as a latency. Count them separately and name them. |
| The container restarted with no log line | The heap was sized for the host rather than the container limit. MaxRAMPercentage reads the limit. |
| Webhooks vanished on a deploy | Claimed work was not released on shutdown. A claimed row is not a pending row, so nothing ever retries it. |

## Self-checks the solution satisfies

- Allocating 100 minor units three ways loses nothing and the remainder is distributed deterministically
- Adding two amounts in different currencies throws
- An addition that would overflow throws rather than wrapping to a negative amount
- BigDecimal constructed from a double differs from the same literal constructed from a string
- Removing a case from an outcome switch fails compilation
- The level 7 integration suite passes against this service with only the base URL changed
- A repeated request with the same idempotency key returns the original response and creates no second payment
- A method annotated @Transactional and called from inside the same class does not open a transaction, and the test proves it
- A checked exception rolls back once rollbackFor is set, and commits without it
- The lost update reproduces against a real Postgres and is fixed by both pessimistic and optimistic locking
- The service refuses to start when a required configuration property is missing
- A cold start reaches its steady state p99 within the readiness window you configured
- Killing the Go worker under load loses no webhook and leaves no row marked published that was never sent

## How it is marked

| Points | Criterion | Meaning |
|--------|-----------|---------|
| 20 | Money on the JVM | long minor units, BigDecimal used correctly, overflow handled, the two classic traps tested. |
| 20 | Types doing work | Records, enums and a sealed interface, with a compile failure demonstrated on purpose. |
| 20 | Spring used properly | Constructor injection, one error shape, transactions with both traps understood, pool sized with arithmetic. |
| 20 | Tested against reality | Testcontainers, the level 8 race reproduced and fixed twice, the level 7 suite passing unchanged. |
| 20 | Measured honestly | Warm up curve, virtual threads with conditions recorded, a benchmark whose limitations you state, and a Go component whose CV line claims only what it shows. |

---

Part of [FinQuest](../../README.md) · Level 18 of 20
