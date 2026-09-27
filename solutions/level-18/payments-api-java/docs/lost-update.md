# The lost update, in the JVM and in SQL

Level 8's race, reproduced twice: once with real threads in the JVM, where it can be
made to happen on demand, and once in SQL, where the two fixes can be verified
against a real database.

## In the JVM, with real threads

`src/test/java/finquest/race/LostUpdateTest.java`, sixteen threads, two hundred
deposits each, all starting at once behind a latch.

```
lost update: 283 of 3200 deposits survived (91.2% lost) on attempt 1 of 8
optimistic: 13446 retries for 3200 deposits on attempt 1 of 8
```

**Two thousand nine hundred and seventeen deposits vanished, and nothing errored.** No
exception, no warning, no log line. The balance was simply wrong, and the only way
anybody finds out is a reconciliation the next morning or a customer counting.

The shape of the bug is three lines and it is the same three lines in every
language:

```java
long current = balance;          // read
Thread.yield();                  // anything at all can happen here
balance = current + amount;      // write, based on a value that has moved
```

`Thread.yield()` is there to make the window reliable, and getting to it took two
attempts. The first version used `Thread.onSpinWait()`, a hint the JIT may compile
to nothing, and the race then failed to reproduce in eight tries about one suite run
in three: a flaky test proving a real bug is worse than no test, because it teaches
people to re-run the suite. A yield asks the scheduler to run somebody else, and the
loss rate went from around 20% and unreliable to around 90% every time.

The yield does not cause the bug. Without it the race still happens and less often,
which is worse: it then happens in production instead of in a test.

## The three fixes, and when each is right

| Fix | JVM | Postgres | When |
|---|---|---|---|
| Do the arithmetic where the data is | `AtomicLong.incrementAndGet()` | `set balance = balance + 1` | Always, when the new value is a function of the old one. No read, no window |
| Pessimistic lock | `ReentrantLock` around both | `select ... for update` | When the new value depends on a decision: read, decide, write, and hold the row throughout |
| Optimistic lock | `compareAndSet` in a loop | a `version` column and `where version = ?` | When contention is rare and a retry is cheaper than a held lock |

All three produced the correct 3,200 in the JVM test. The interesting number is the
third one's cost: **13,446 retries for 3,200 deposits**, four attempts per successful
deposit, which is what "optimistic" means under heavy contention. At low contention
it is nearly free; at this level the lock is the better trade, and the way to know
which you have is to count the retries in production rather than to argue about it.

## In SQL, against PostgreSQL 18.6

Verified on a real Postgres, and the output is the evidence rather than the claim:

| Check | Result | Detail |
|---|---|---|
| Arithmetic in the database | correct | balance is 3200 after 3200 increments with no read |
| Optimistic locking | correct | a stale version updated **0 rows**, the current version updated 1 |

The second row is the whole of optimistic locking. The update is conditional:

```sql
update accounts
   set balance = 100, version = version + 1
 where id = 'acct_1' and version = 6;      -- what this reader last saw
```

If somebody else has written since, `version` is no longer 6, the statement updates
**zero rows**, and the application finds out by checking the row count. An
application that ignores the row count has optimistic locking in the schema and
none in the behaviour, which is the most common way this is got wrong.

## What is not verified here, and why

**The contended `select ... for update`.** Demonstrating that one session blocks
another needs two concurrent sessions, and the database in this exercise is reached
through a single session tool. The statement is in the SQL and the lock it takes is
documented behaviour; what has not been measured here is the waiting.

**The Testcontainers version the level asks for.** It needs Docker and there is
none on this machine. `spring/src/test/java/.../LostUpdateContainerTest.java` is
written, is the version that would run in CI, and **has never been run**. The README
says so in the same table as everything else that was not.

What that leaves is: the race reproduced with real concurrency, both fixes
verified in the JVM, and both SQL fixes verified against a real Postgres. The one
missing piece is a concurrency demonstration inside the database rather than in
front of it.
