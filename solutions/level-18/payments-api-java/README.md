# payments-api-java, and one component in Go

The level 7 service on the JVM, with the money type from level 5, the state machine
from level 9, the race from level 8, and the webhook sender in Go.

```bash
# Java 21, no Maven needed for the part that runs
javac -d target/classes $(find src/main/java -name "*.java")
java -jar junit-platform-console-standalone.jar execute \
    -cp "target/classes;target/test-classes" --scan-classpath   # 49 tests

java -cp target/classes finquest.bench.WarmUp          # the JIT curve
java -cp target/classes finquest.bench.VirtualThreads  # both executors, both shapes
python ../bench/python_baseline.py                        # the same operation in Python

cd ../webhook-sender && go vet ./... && go test ./... && go test -bench=. -benchmem
```

## What runs here, and what does not

The level asks for Spring Boot, Maven and Testcontainers. This machine has a JDK and
Go and nothing else: no Maven, so Spring's dependency tree cannot be resolved, and no
container runtime, so Testcontainers cannot start a database. Rather than ship code
nobody has compiled and imply otherwise, the split is explicit.

| Requirement | Status |
|---|---|
| `Money` over `long` minor units, level 5 tests ported, overflow throws | **Runs.** 10 tests |
| `new BigDecimal(0.1)` differs from `new BigDecimal("0.1")` | **Runs.** Its own test |
| `equals` and `compareTo` disagree about 1.0 and 1.00 | **Runs.** Its own test, with the HashSet consequence |
| Enum plus sealed interface, and a switch that stops compiling | **Runs**, and the compile failure is reproduced with real javac output in [docs/compile-failure.md](docs/compile-failure.md) |
| The level 7 HTTP contract: routes, codes, idempotency, paging, one error shape | **Runs.** 9 tests over real HTTP against the JDK's own server |
| Constructor injection with final fields, no field injection | **Runs**, in the plain JDK service. The Spring version is written and not built |
| One `@ControllerAdvice` error format | **Written, not built.** The running service produces the same one shape, asserted |
| `open-in-view` off, Hikari pool sized with arithmetic | **Written, not built.** The arithmetic is in `application.yml` |
| Both `@Transactional` traps demonstrated | **Runs.** 5 tests, with a real JDK dynamic proxy rather than Spring |
| Testcontainers Postgres, level 8 race reproduced and fixed twice | **Partly.** The race runs with real threads and both fixes; the SQL fixes are verified on PostgreSQL 18.6; the Testcontainers test is written and has never been run |
| Virtual threads measured on and off at several concurrencies | **Runs.** Two handler shapes, five concurrency levels |
| Multi stage Dockerfile, heap for the container, readiness tolerating start up | **Written, not built** |
| p99 against time from a cold start, with a canary window | **Runs.** Two phases, and the first attempt measured the wrong thing |
| Both services benchmarked on the same hardware, warmed up | **Runs**, as the same operation in both languages rather than as two HTTP servers |
| One component in Go: worker pool, timeouts, backoff, graceful shutdown | **Runs.** 8 tests, `go vet` clean, benchmarks |

Everything in the "not built" rows is in `spring/` and
`Dockerfile`, and
[spring/NOT_BUILT.md](spring/NOT_BUILT.md) says which running code
covers the same behaviour.

## 1. Money on the JVM

`long` minor units, `Math.addExact`, and a record. Three things the level asks to be
demonstrated rather than described:

```java
int wrapped = Integer.MAX_VALUE + 1;
assertTrue(wrapped < 0);          // silently negative, no error
// 2,147,483,647 minor units is $21,474,836.47, so an int is a ceiling on
// a merchant's lifetime volume that nobody documented
```

```java
new BigDecimal(0.1)      // 0.1000000000000000055511151231257827...
new BigDecimal("0.1")    // 0.1
// the double never held 0.1, so the BigDecimal cannot recover it
```

```java
new BigDecimal("1.0").equals(new BigDecimal("1.00"))     // false
new BigDecimal("1.0").compareTo(new BigDecimal("1.00"))  // 0
// and therefore a HashSet of the same amount has two entries, which is a
// money bug rather than a curiosity
```

Allocation distributes the remainder, and the test that caught my own mistake is
worth keeping: splitting 101 three ways is `[34, 34, 33]`, not `[35, 33, 33]`. The
code was right and my expectation was not.

## 2. The compile failure, which is the reason to be on the JVM

Adding a fourth outcome to the sealed `AuthResult` and running javac:

```
java\finquest\card\Outcomes.java:21: error: the switch expression does not cover all possible input values
        return switch (result) {
               ^
2 errors
```

Two errors, with file and line, before anything ran. The three details that make it
work, any one of which silently removes the check: `sealed ... permits`, a switch
*expression* rather than a statement, and **no `default` branch**. The full
demonstration, including what it does not catch, is in
[docs/compile-failure.md](docs/compile-failure.md).

## 3. The two `@Transactional` traps

Demonstrated with a real JDK dynamic proxy rather than with Spring, because both
traps come from the proxy and not from Spring:

```
an internal call bypasses the proxy       journal: []            no transaction opened
the same call through the proxy           journal: [begin, commit]
a checked exception                       journal: [begin, commit despite AccountClosed]
the same with rollbackFor                 journal: [begin, rollback: AccountClosed]
```

The third line is the one that costs money. The caller sees a failure, the database
kept the write, and the default `rollbackFor` is empty in every version of Spring
that has ever shipped.

## 4. The lost update

Sixteen threads, two hundred deposits each, all released at once:

```
lost update: 283 of 3200 deposits survived (91.2% lost)
optimistic: 13446 retries for 3200 deposits
```

**Two thousand nine hundred and seventeen deposits vanished and nothing errored.**
Three fixes, all correct, with the retry count as the price of the optimistic one.
The SQL versions are verified against PostgreSQL 18.6: a stale version updates **0
rows**, and `set balance = balance + 1` needs no read at all.

Getting the reproduction reliable took two attempts, and that is written up in
[docs/lost-update.md](docs/lost-update.md): `Thread.onSpinWait()`
is a hint the JIT may compile away, so the race showed up about two runs in three.
A flaky test proving a real bug is worse than no test.

## 5. Virtual threads, measured rather than assumed

JVM 21.0.12.1, Windows 11, 12 processors. Same service, same handler, executor either
a fixed pool of 200 platform threads (the Spring Boot default shape) or one virtual
thread per request.

**Phase 1: a CPU bound handler.** Nothing blocks.

| Concurrency | Executor | p50 ms | p99 ms | req/s | failed |
|---|---|---|---|---|---|
| 8 | platform 200 | 2.34 | 19.60 | **2,197** | 0% |
| 8 | virtual | 2.63 | 22.92 | 1,767 | 0% |
| 64 | platform 200 | 15.66 | 51.26 | **3,116** | 0% |
| 64 | virtual | 20.91 | 55.48 | 2,694 | 0% |
| 256 | platform 200 | **34.16** | 600.23 | **2,362** | 0.1% |
| 256 | virtual | 90.72 | **389.87** | 1,797 | 0.4% |
| 1,000 | platform 200 | 1,141.28 | 6,336.82 | 468 | 0.5% |
| 1,000 | virtual | **509.14** | **2,322.76** | **953** | 0.1% |

**Phase 2: the same handler waiting 20 ms on a simulated database.**

| Concurrency | Executor | p50 ms | p99 ms | req/s | failed |
|---|---|---|---|---|---|
| 8 | platform 200 | 32.11 | 44.58 | 249 | 0% |
| 8 | virtual | 31.43 | 42.76 | 255 | 0% |
| 256 | platform 200 | 50.97 | 120.91 | 1,501 | 0% |
| 256 | virtual | **48.26** | **80.86** | **2,141** | 0% |
| 1,000 | platform 200 | 133.92 | 675.58 | 1,143 | **4.9%** |
| 1,000 | virtual | **61.67** | **333.83** | **1,233** | **0.0%** |

Read phase 1 before phase 2, because it is the honest disappointment: **for a handler
that does not block, virtual threads are not a performance feature.** Below the pool
size the two are the same thing, and between 8 and 256 concurrent requests the fixed
pool is measurably faster, because scheduling a continuation costs something and
there is nothing to win.

Phase 2 is what they are for. At a thousand concurrent requests each waiting on a
dependency: p50 **61.67 ms against 133.92**, p99 **333.83 against 675.58**, and
**zero failures against 4.9%**. A pool of 200 threads is a hard ceiling; a virtual
thread per request is not.

Two findings from running it rather than reading about it. The first version of this
benchmark recorded a failed request as a 10,000 ms latency, so the p99 read exactly
`10000.00` and looked like a measurement; failures are now counted and named
separately. And those failures were `ConnectException`, which turned out to be the
accept backlog rather than the executor: `HttpServer.create(addr, 0)` takes the
operating system default, and a thousand concurrent connections exceed it on Windows.
A benchmark comparing two executors while the socket is the constraint compares
nothing.

## 6. The warm up curve, measured twice

The first version measured over loopback HTTP and concluded nothing: a p50 of 5 ms, a
p99 pinned near 39 ms, and no downward trend. Those numbers were the socket. A p99 at
39 ms next to 40 is the signature of delayed acknowledgement meeting Nagle, and the
JIT effect was two orders of magnitude smaller than the noise hiding it.

Measuring the handler in process instead, 20,000 calls per bucket:

| Bucket | p50 µs | p99 µs |
|---|---|---|
| 1 | 6.90 | 76.20 |
| 4 | 4.80 | 16.70 |
| 8 | 1.50 | 21.50 |
| 12 | **0.80** | **2.20** |

**p50 improves 8.6 times and p99 34.6 times over about a second and a half of
work.** That is the number a readiness delay and a canary window come from: both have
to be longer than the flattening, or a new instance takes full traffic at its slowest
and the canary compares a warm old version with a cold new one.

## 7. Java against Python, on the same machine

The same operation in both: integer fee arithmetic, one state transition, one
idempotency insert. No HTTP, no database, no framework.

| | Cold, first bucket | Warm, steady state |
|---|---|---|
| Java 21 | 6.90 µs | **0.80 µs** |
| Python 3.11.9 | 3.30 µs | 3.10 µs |

Two things fall out of four numbers, and the second is the one worth carrying into an
interview.

**Warm, the JVM is about 3.9 times faster** for this operation. **Cold, it is slower
than Python** and stays slower for the first few thousand calls, which is exactly the
window a deploy sends traffic into.

And then the sentence that matters more than either: in a real payment service the
database round trip is 1 to 5 ms and this function is under 4 µs in both languages, so
**the runtime is under one percent of the request** and the language is not why
anything is slow. The reason to measure it is to be able to say that with a number
behind it.

What would I choose for a new service? Python for the first version, unless the team
already writes Java. The decision is made by the team's existing skill, the libraries
the domain needs and the hiring pool, and the runtime difference is the smallest of
the four. Where I would choose the JVM without hesitating is the sealed interface in
section 2: a compiler that refuses to build an unhandled payment outcome is worth more
than four microseconds.

## 8. One component in Go: the webhook sender

Not a second port. One component, which is what the level asks for and what a hiring
manager is actually probing: can this person pick up an unfamiliar language and ship
something correct in it.

Four properties, each with a test:

```
TestEveryEventIsDeliveredExactlyOnce            50 events, 50 webhooks, one each
TestRetriesUntilTheReceiverRecovers             2 retries, and the webhook arrives once
TestAPermanentFailureIsNotRetried               a 400 is attempted once
TestATimeoutIsRetriedAndThenAbandonedWithinTheBudget   3 attempts, then abandoned
TestTheWorkerPoolIsRespected                    never more than 4 concurrent deliveries
TestShutdownLosesNothing                        cancelled mid flight, nothing lost or stuck
TestBackoffIsJitteredAndBounded                 0 to a doubling ceiling, capped
TestShutdownDuringABackoffReleasesTheEvent      released rather than dropped
```

`go vet` is clean. The race detector is **not** available here: `-race requires cgo`
and there is no C compiler on this machine, which is a real gap and is why the
concurrency assertions are about observable outcomes rather than about the absence of
races.

Throughput with a null transport, so the number is the sender rather than a receiver:

| Workers | Deliveries/s | ns/op | Allocations |
|---|---|---|---|
| 1 | 5,057 | 197,763 | 5 per delivery, 415 B |
| 8 | 41,302 | 24,212 | 5 |
| 64 | 157,455 | 6,351 | 5 |
| 256 | **222,226** | 4,500 | 5 |

Memory at concurrency: **9,707 concurrent deliveries in 15.0 MB of heap, 1.6 kB
each**, with 10,003 goroutines live.

Two bugs in my own code came out of writing those tests, and they are the reason the
tests are the deliverable rather than the sender:

**A batch of claimed events was dropped on shutdown.** `Run` claimed a batch, and when
the context was cancelled mid batch it released the event it was holding and
forgot the rest: claimed, never sent, and invisible, because a claimed row is not a
pending row. `TestShutdownLosesNothing` found six stuck out of five hundred, which is
why that test asserts on the claim count and not only on the delivery count.

**The claim ticker was the throughput.** The first benchmark reported 200 deliveries a
second with one worker and 11,424 with sixty four, and both numbers were a 5 ms poll
interval rather than the work. A poll interval is for an empty queue, not a full one.

## 9. What a CV line may claim from this

> Wrote the webhook sender in Go: a worker pool with a timeout on every call, retries
> with full jitter and a graceful shutdown, sustaining 222,226 deliveries a second
> against a null transport at 256 workers, and holding 9,707 concurrent deliveries in
> 15 MB of heap.

That claims a throughput against a stated transport and a memory figure at a stated
concurrency. What it does not claim is that Go is faster than anything: there is no
network in that number, and with a real HTTP receiver the bound is the receiver.

---

Part of [FinQuest](../../../README.md) level 18. Compiled with Temurin 21.0.12.1 and Go
1.27.1, both downloaded as archives into a temporary directory rather than installed,
with their checksums verified against the publishers' own.
