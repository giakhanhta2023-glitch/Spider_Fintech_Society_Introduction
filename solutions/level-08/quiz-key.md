# Level 8: Eight requests, one balance, minus $540: quiz answer key

> 15 questions. Pass mark is 12/15 (80%).
> Generated from `content/levels/` by `tools/build_quiz_keys.js`: do not edit by hand.

| # | Answer |
|---|--------|
| 1 | **C** |
| 2 | **D** |
| 3 | **A** |
| 4 | **C** |
| 5 | **C** |
| 6 | **B** |
| 7 | **B** |
| 8 | **A** |
| 9 | **D** |
| 10 | **A** |
| 11 | **D** |
| 12 | **B** |
| 13 | **B** |
| 14 | **A** |
| 15 | **C** |

---

### 1. Eight workers each read a balance of $100.00 and each spend $80.00. The account ends at minus $540.00. What is the name for this?

- A. A dirty read
- B. A deadlock
- **C. A lost update caused by a race between the read and the write** ✅
- D. A rollback failure

**Why:** Every worker was right when it looked. Nothing forced any of them to notice the world changing in between.

### 2. Wrapping the read and the write in one transaction does not fix it because:

- A. The entries table has no primary key
- B. Postgres ignores transactions under load
- C. The transaction was too short
- **D. Transactions are only about atomicity and visibility, not exclusivity** ✅

**Why:** It guarantees both entries land together. It does not stop seven other transactions reading the same balance.

### 3. Under `read committed`, what exactly is guaranteed?

- **A. Each statement sees a consistent snapshot of committed data** ✅
- B. No other transaction can write while yours is open
- C. Your transaction sees one snapshot for its whole life
- D. Transactions behave as if run one at a time

**Why:** Per statement, not per transaction, which is exactly the gap a read-then-write decision falls into.

### 4. `select ... for update` fixes the race by:

- A. Copying the row into a temporary table
- B. Detecting the conflict at commit and aborting one transaction
- **C. Locking the rows so other transactions wait until you commit** ✅
- D. Making the query faster

**Why:** Pessimistic: assume a conflict and prevent it. Measured, it took the run from 367 ms to 691 ms and from wrong to right.

### 5. The measured cost of the row lock in this level was:

- A. A negative balance on one account
- B. A retry for every caller
- **C. Spending from that account became serialised: 691 ms against 367 ms** ✅
- D. A deadlock in one run of eight

**Why:** Correctness had a price, and knowing the price is the part an interviewer is listening for.

### 6. Serializable isolation requires what from every caller?

- A. A second connection
- **B. A retry loop, because a conflicting transaction is aborted rather than delayed** ✅
- C. A longer timeout
- D. A row lock as well

**Why:** And a retry is only safe if the operation is idempotent, which is why level 7 required an idempotency key.

### 7. When is a row lock the better choice than serializable?

- A. When you cannot change the schema
- **B. When conflicts are common, such as a hot account, and you do not want callers to see retries** ✅
- C. When the table has no index
- D. When conflicts are rare

**Why:** Serializable is cheaper when clashes are rare and turns into retry storms when they are not.

### 8. A check constraint such as `balance_minor >= 0` is stronger than an application check because:

- **A. It is enforced for every writer, including code that forgets to check, and two transactions cannot update one row at once** ✅
- B. It runs faster
- C. It removes the need for transactions
- D. It prevents deadlocks

**Why:** The trade is that you now maintain a balance column, so the reconciliation job stops being optional.

### 9. You set the isolation level on the session and `show transaction_isolation` reports `read committed` anyway. Why?

- A. The setting takes effect only after a reconnect
- B. Postgres ignores that setting
- C. The isolation level can only be set by a superuser
- **D. A transaction mode connection pooler discarded your session setting** ✅

**Why:** Set it per transaction instead. Nothing raises an error, which is why this one reaches production.

### 10. Which of these also stops working quietly behind a transaction mode pooler?

- **A. Session advisory locks, LISTEN and NOTIFY, temporary tables and session SET** ✅
- B. Write ahead logging
- C. Primary key indexes
- D. Foreign key constraints

**Why:** Anything that assumes you keep the same real connection between transactions.

### 11. Measured: no pool 31.4 req/s, a pool of 8 with 8 workers 127.1 req/s, a pool of 2 with 8 workers 30.8 req/s. What does the third number teach?

- A. Pools only help with more than 8 workers
- B. Pools should always be as large as possible
- C. The database was overloaded
- **D. A pool that is too small is as slow as no pool, and the waiting never appears in your query timings** ✅

**Why:** The pool is a queue. Requests wait for a connection while the database reports that every query it ran was fast.

### 12. How should you size a connection pool?

- A. As large as the database will allow
- **B. From measured hold time and required throughput, with headroom, capped well below the database total across all instances** ✅
- C. One connection per expected user
- D. Twice the number of CPU cores, always

**Why:** Every instance has its own pool and they all add up. Past a point, more connections make the database slower.

### 13. Why put a timeout on acquiring a connection from the pool?

- A. To force connections to be recycled
- **B. Because otherwise an exhausted pool becomes an unbounded queue and the service stops answering anybody** ✅
- C. Because the database requires it
- D. To detect network failures

**Why:** Fail fast with 503 for the requests you cannot serve, rather than slowly for everybody.

### 14. Which of these should never be retried?

- **A. A 422 insufficient funds** ✅
- B. A 503
- C. A serialization failure
- D. A deadlock

**Why:** Retry only what can succeed next time, and only what is safe to repeat, which means an idempotency key.

### 15. Why does the test rig open every connection before the barrier?

- A. To share one connection between threads
- B. Because psycopg requires it
- **C. Because otherwise the workers are staggered by their handshakes and the first commits before the last connects** ✅
- D. To reduce database load

**Why:** It is the difference between a test that fails every time and one that fails occasionally, which is no test at all.
