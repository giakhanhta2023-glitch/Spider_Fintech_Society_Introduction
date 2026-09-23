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
| `money/Money.java` | long minor units, exact, overflow throws |
| `card/AuthResult.java` | sealed, so an unhandled outcome is a compile error |
| `api/PaymentController.java` | the level 7 contract, unchanged |
| `api/ErrorAdvice.java` | one error shape for the whole service |
| `test/LostUpdateTest.java` | the level 8 race, against a real Postgres |
| `bench/` | both services, warmed up, on the same hardware |
| `quiz-key.md` | all 15 drill answers with explanations |

## Run it

```bash
mvn verify && java -jar target/payments.jar && python -m bench.compare
```

## Why the solution is shaped this way

- The port is of one service rather than of the whole course, because the second port teaches nothing the first did not. The payments API was chosen because it exercises HTTP, validation, idempotency, a database and tests at once.
- Money is long minor units, with BigDecimal where fractions of a cent are genuinely needed. Both classic traps are written as tests: BigDecimal from a double differs from BigDecimal from a string, and equals disagrees with compareTo about 1.0 and 1.00.
- The int limit is treated as a real constraint rather than trivia. 2,147,483,647 minor units is $21,474,836.47, and an int wraps to negative past it with no error, so every amount is a long including in the schema.
- The card lifecycle uses an enum and a sealed interface, and the repository deliberately demonstrates a compile failure when an outcome is added, because that refusal is the reason to be on the JVM at all.
- Spring is used the way a reviewer expects: constructor injection with final fields, one ControllerAdvice, open-in-view off, and a Hikari pool sized with the level 8 arithmetic written in a comment.
- Both @Transactional traps have failing tests before they have fixes: an internal call that bypasses the proxy, and a checked exception that commits under the default configuration.
- Testcontainers runs a real Postgres so the level 8 lost update can be reproduced in CI and fixed twice. An in memory database would have passed the test and shipped the bug.
- The benchmark states its conditions: warmed up, same hardware, same database, and the share of each request that is database time, so the comparison is about the runtime rather than about who wrote the faster query.

## Where people get stuck

| Symptom | Cause |
|---------|-------|
| Amounts went negative above twenty million dollars | int instead of long. It wraps silently, with no error. |
| Rounding disagreed with the Python service by a cent | A double somewhere upstream of the BigDecimal. |
| Two equal amounts compared unequal | equals compares scale. Use compareTo for money. |
| A transaction did not roll back | A checked exception, and no rollbackFor. Or an internal call bypassing the proxy. |
| The connection pool ran out under light load | open-in-view left on, holding a connection for the whole request. |
| The benchmark flattered Java | No warm up. The JVM compiles hot paths as it runs, so a short run measures the slow phase. |
| The container restarted with no log line | The heap was sized for the host rather than the container limit. |

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

## How it is marked

| Points | Criterion | Meaning |
|--------|-----------|---------|
| 20 | Money on the JVM | long minor units, BigDecimal used correctly, overflow handled, the two classic traps tested. |
| 20 | Types doing work | Records, enums and a sealed interface, with a compile failure demonstrated on purpose. |
| 20 | Spring used properly | Constructor injection, one error shape, transactions with both traps understood, pool sized with arithmetic. |
| 20 | Tested against reality | Testcontainers, the level 8 race reproduced and fixed twice, the level 7 suite passing unchanged. |
| 20 | Measured honestly | Warm up curve, virtual threads with conditions recorded, and a benchmark whose limitations you state. |

---

Part of [FinQuest](../../README.md) · Level 18 of 10
