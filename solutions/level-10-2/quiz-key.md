# Level 10.2: Scala, and the job that runs at four in the morning: quiz answer key

> 15 questions. Pass mark is 12/15 (80%).
> Generated from `content/levels/` by `tools/build_quiz_keys.js`: do not edit by hand.

| # | Answer |
|---|--------|
| 1 | **C** |
| 2 | **A** |
| 3 | **D** |
| 4 | **B** |
| 5 | **A** |
| 6 | **C** |
| 7 | **B** |
| 8 | **D** |
| 9 | **A** |
| 10 | **C** |
| 11 | **B** |
| 12 | **D** |
| 13 | **A** |
| 14 | **C** |
| 15 | **B** |

---

### 1. Which part of a payments company most often writes Scala?

- A. The customer facing API
- B. The browser checkout
- **C. The large nightly and streaming data work, where Spark lives** ✅
- D. The deployment pipeline

**Why:** Not the API, which is the Ruby of level 20.1, and not the hot service, which is the Java and Go of level 18.

### 2. What is the difference between `val` and `var`?

- **A. `val` cannot be reassigned; `var` can** ✅
- B. `val` is a compile time constant; `var` is run time
- C. `val` is immutable all the way down; `var` is shallow
- D. `val` is lazy; `var` is eager

**Why:** Note what it is not: a `val` holding a mutable collection is still a reference you cannot rebind to a collection that can change.

### 3. You add a seventh case to the `Break` enum. What happens?

- A. Nothing until a test fails
- B. A warning at run time
- C. The new case is ignored by existing matches
- **D. Every exhaustive match over Break fails to compile, naming the case you did not handle** ✅

**Why:** Which is why `owner`, `value` and `label` are three separate matches: three reminders rather than one.

### 4. What does `opaque type Cents = Long` cost at run time?

- A. One object allocation per amount
- **B. Nothing. It is a `Long` in the bytecode** ✅
- C. A boxing conversion on every comparison
- D. A small table lookup

**Why:** Compile time safety with no run time object, which matters when you are holding sixteen thousand of them.

### 5. Why does the loader return `(Vector[Movement], Vector[BadRow])` instead of throwing on a bad row?

- **A. So a batch job reads every row and reports every complaint at once, instead of being fixed one night at a time** ✅
- B. Because exceptions are slow in Scala
- C. Because Vector cannot hold exceptions
- D. To avoid a stack trace in the log

**Why:** Forty bad rows discovered one per run is forty nights.

### 6. A column is missing from the header. Bad row or exception?

- A. Bad row: collect it and carry on
- B. Bad row, with a warning logged
- **C. Exception. A file whose columns moved is a different file, and reading the wrong column silently is worse than stopping** ✅
- D. Depends on which column

**Why:** Expected failure is a value, unexpected failure is an exception, and the test is whether the caller has anything sensible to do about it.

### 7. Why does the duplicate pass keep the first line and flag the rest?

- A. The first is always the cheapest
- **B. They sent it twice and we did it once, so one is real and the rest are the problem** ✅
- C. The later lines are more likely to be corrupt
- D. It matches what the payout file does

**Why:** Sorting by line id first is what makes the choice deterministic, so two runs never blame different lines.

### 8. A settlement line arrives in EUR and the amount differs from the ledger. How is it treated?

- A. Unmatched, because the currencies differ
- B. Matched, and the difference absorbed into a tolerance
- C. A duplicate
- **D. Matched, with the difference classified as currency rounding rather than tolerated** ✅

**Why:** It is the same movement. Widening a tolerance until a disagreement disappears is how a reconciliation stops finding anything.

### 9. The window is three days and the test is `when.isAfter(cutoff)`. A capture exactly three days old is:

- **A. Already a break** ✅
- B. Still pending
- C. Pending until the end of that day
- D. Excluded from the report

**Why:** Worth pinning with a test. Off by one here raises a break a day early on every unsettled capture, every morning.

### 10. Two amount mismatches, one +$5.09 and one -$9.10. What should the report total?

- A. -$4.01, the net
- B. $0.00, since they offset
- **C. $14.19, the sum of magnitudes** ✅
- D. $9.10, the larger

**Why:** The question is how much is in dispute. Netting lets two errors that happen to cancel look like one small one.

### 11. Why is `PendingSettlement` a separate case rather than just a break?

- A. To make the enum exhaustive
- **B. Because a capture that has not settled yet is not a problem, and counting it as one trains people to ignore the report** ✅
- C. Because it has different fields
- D. To let it be retried automatically

**Why:** A report that cries wolf is a report nobody opens, which is worse than no report.

### 12. What makes the reconciliation trivially parallel?

- A. It uses parallel collections
- B. It runs on the JVM
- C. The data is sorted first
- **D. Nothing is mutated, so nothing is shared and nothing can race** ✅

**Why:** And it is the same reason the shape survives being spread across a cluster by Spark.

### 13. Your 16,639 line job takes four minutes. Should it move to Spark?

- **A. Almost certainly not yet, and the code barely changes when it should** ✅
- B. Yes, Spark is always faster
- C. Yes, to get the monitoring UI
- D. Only if written in Scala 2

**Why:** Spark charges you a scheduler, a shuffle and serialisation. Below the size where one machine struggles, it is often slower.

### 14. What is the strongest evidence that this rewrite is correct?

- A. Its own test suite passes
- B. The types are exhaustive
- **C. It agrees with the Python engine, count and total, on the real 16,639 line file** ✅
- D. It is faster than the original

**Why:** Tests written by the same mind that wrote the bug agree with the bug. Two independent implementations do not.

### 15. The two engines disagree on one total. What is the first thing to do?

- A. Trust the older one and move on
- **B. Find out which behaviour you actually want, because neither is obviously wrong** ✅
- C. Average them
- D. Widen a tolerance until they agree

**Why:** That question is the whole value of the dual run: with one implementation it would never have been asked.
