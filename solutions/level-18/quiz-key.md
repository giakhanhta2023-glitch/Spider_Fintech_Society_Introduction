# Level 18: Java, for somebody who already writes Python: quiz answer key

> 15 questions. Pass mark is 12/15 (80%).
> Generated from `content/levels/` by `tools/build_quiz_keys.js`: do not edit by hand.

| # | Answer |
|---|--------|
| 1 | **A** |
| 2 | **C** |
| 3 | **D** |
| 4 | **D** |
| 5 | **A** |
| 6 | **B** |
| 7 | **B** |
| 8 | **C** |
| 9 | **A** |
| 10 | **C** |
| 11 | **B** |
| 12 | **A** |
| 13 | **B** |
| 14 | **D** |
| 15 | **C** |

---

### 1. Why is `0.1 + 0.2` not `0.3` in Java?

- **A. Because it uses IEEE 754 binary64, exactly as Python does, and 0.1 is not representable in binary** ✅
- B. A Java specific rounding rule
- C. It is 0.3 in Java
- D. Because double has fewer bits than Python floats

**Why:** The nearest double to 0.1 is 0.10000000000000000555. Same hardware, same answer, same rule: never for money.

### 2. What is the largest amount an `int` can hold in minor units?

- A. $2,147,483.64
- B. There is no limit
- **C. $21,474,836.47** ✅
- D. $214,748,364.70

**Why:** And it wraps silently to negative after that. Use long, and Math.addExact when you want a throw instead.

### 3. Why must BigDecimal be constructed from a string?

- A. It is faster
- B. Because the constructor requires it
- C. To set the scale
- **D. Because `new BigDecimal(0.1)` is handed a double that is already wrong, so the exact type receives an inexact value** ✅

**Why:** Exactness has to start at the boundary. Once a double is involved, nothing downstream can recover it.

### 4. `new BigDecimal("1.0").equals(new BigDecimal("1.00"))` returns what, and why does it matter?

- A. It throws
- B. True, because the values are equal
- C. True, and it does not matter
- **D. False, because equals compares scale as well as value, so money comparisons must use compareTo** ✅

**Why:** This one costs everybody a day exactly once.

### 5. What does a sealed interface give you that a Python union type usually does not?

- **A. The compiler refuses to build when a switch does not handle every case, so adding an outcome finds every place that must change** ✅
- B. Faster dispatch
- C. Smaller memory use
- D. Runtime validation

**Why:** That is the property people mean when they say the type system pays for itself.

### 6. Which `@Transactional` behaviour catches everybody once?

- A. It cannot be used with JDBC
- **B. Calling an annotated method from inside the same class does nothing, because the proxy is bypassed** ✅
- C. It requires an explicit commit
- D. It only works on public methods of interfaces

**Why:** And by default it rolls back on unchecked exceptions only, so checked ones commit. Set rollbackFor for money.

### 7. Why turn off `open-in-view`?

- A. It breaks transactions
- **B. Because it holds a database connection for the whole request including response writing, which multiplies the pool you need** ✅
- C. It is deprecated
- D. It disables lazy loading

**Why:** The level 8 pool arithmetic applies unchanged, and this setting quietly invalidates it.

### 8. What is an N plus one query?

- A. A query run once per connection
- B. A query with too many joins
- **C. One query per row instead of one query for the set, from touching a relation inside a loop** ✅
- D. A failed retry

**Why:** Correct output, quadratic cost. The ORM version of the missing index from level 6.

### 9. Java threads run in parallel where Python threads do not. What follows for a payments service?

- **A. Shared mutable state is a genuine hazard, but the lost update from level 8 still lives in the database and still needs the same fixes** ✅
- B. The database no longer needs locking
- C. Concurrency bugs disappear
- D. You no longer need a connection pool

**Why:** Concurrency bugs in a payments service live in the database, not in the language.

### 10. What do virtual threads change?

- A. They make CPU work faster
- B. They replace the connection pool
- **C. A thread costs hundreds of bytes instead of a megabyte and parks when it blocks, so ordinary blocking code gets asynchronous concurrency** ✅
- D. They remove garbage collection pauses

**Why:** Which removes the reason most Java services reached for an asynchronous framework.

### 11. Why does a load test of a Java service need a warm up phase?

- A. To fill the caches
- **B. Because the JVM interprets bytecode first and compiles hot paths as it runs, so early requests measure the slow phase** ✅
- C. To let the garbage collector settle
- D. Because the connection pool starts empty

**Why:** And a canary that judges a new instance in its first thirty seconds will reject healthy releases.

### 12. A Java service in a container restarts with no log line and no stack trace. Most likely cause?

- **A. The JVM sized its heap for the host rather than the container limit, so the platform killed it for using too much memory** ✅
- B. A garbage collection pause
- C. A deadlock
- D. A failed health check

**Why:** Tell it what it may use. MaxRAMPercentage, and ExitOnOutOfMemoryError so it fails loudly.

### 13. What makes Testcontainers better than an in memory database for the level 8 race test?

- A. It is faster
- **B. It runs the real Postgres, which implements the locking the test exists to exercise** ✅
- C. It needs no configuration
- D. It works without Docker

**Why:** An in memory substitute would pass the test and ship the bug.

### 14. Your Java port benchmarks faster than the Python original. What should you check first?

- A. The hardware
- B. The garbage collector
- C. The JVM version
- **D. Whether both runs were warmed up, and what share of a request is database time in each** ✅

**Why:** If a payment is 5 ms of your code and 40 ms of database, the language was never the bottleneck.

### 15. Which is the honest reason to choose the JVM for a new payments service?

- A. It is faster than Python
- B. It has better libraries
- **C. Concurrency per instance and a compiler that checks your state machine, along with the hiring market you are targeting** ✅
- D. It uses less memory

**Why:** A latency claim that turns out to be mostly database time is a weak argument and an interviewer will test it.
