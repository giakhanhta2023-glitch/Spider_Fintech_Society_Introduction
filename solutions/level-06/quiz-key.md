# Level 6: The ledger in Postgres, and the query plan that proves it: quiz answer key

> 15 questions. Pass mark is 12/15 (80%).
> Generated from `content/levels/` by `tools/build_quiz_keys.js`: do not edit by hand.

| # | Answer |
|---|--------|
| 1 | **D** |
| 2 | **C** |
| 3 | **D** |
| 4 | **C** |
| 5 | **B** |
| 6 | **B** |
| 7 | **C** |
| 8 | **C** |
| 9 | **B** |
| 10 | **A** |
| 11 | **A** |
| 12 | **D** |
| 13 | **A** |
| 14 | **B** |
| 15 | **A** |

---

### 1. Why does the schema have no `balance` column on `accounts` at first?

- A. Balances change too often to store
- B. It would break the foreign key
- C. Postgres cannot store a running total
- **D. A balance is the sum of the entries, and a second copy is a second answer that can disagree** ✅

**Why:** You add the copy later, deliberately, together with the job that checks it still matches the entries.

### 2. What does `check (amount_minor <> 0)` buy you that validation in your API does not?

- A. Better error messages for users
- B. Faster inserts
- **C. It holds for every writer, including scripts and services that never touch your API** ✅
- D. It prevents duplicate entries

**Why:** Checks in code catch mistakes early; checks in the database are the ones that are actually guarantees.

### 3. Why must the balance trigger be `deferrable initially deferred`?

- A. Because triggers cannot read other rows
- B. To avoid locking the accounts table
- C. Deferred triggers run faster
- **D. Because after the first entry the transaction is deliberately unbalanced, so an immediate check would fail every transfer** ✅

**Why:** Deferred means the check happens at commit, when every entry of the transaction is present.

### 4. In a plan, "Rows Removed by Filter: 133267" tells you:

- A. The query returned 133,267 rows
- B. 133,267 rows were deleted
- **C. The query read 133,267 rows it did not want, which usually means a missing index** ✅
- D. The filter ran after sorting

**Why:** It is the clearest single sign of wasted work in an EXPLAIN plan.

### 5. Buffers are a better measure of query cost than time because:

- A. They are measured in milliseconds
- **B. They count pages of data touched, which does not change with how busy the machine is** ✅
- C. They ignore indexes
- D. They include planning time

**Why:** Time varies with load and caching. Buffers are the work the query actually did.

### 6. The balance query went from 30.917 ms to 0.375 ms after one index. What changed in the plan?

- A. It started using parallel workers
- **B. A Seq Scan became a Bitmap Index Scan, and the filtered-out rows disappeared** ✅
- C. Postgres rewrote the SQL
- D. The table moved into memory

**Why:** It stopped reading rows it did not want: 3,334 buffers became 206 for the same answer.

### 7. What does `Heap Fetches: 0` on an Index Only Scan mean?

- A. The table has no primary key
- B. The index is empty
- **C. The query was answered entirely from the index, without touching the table** ✅
- D. No rows matched

**Why:** That is what an INCLUDE column buys: 6 buffers instead of 206 for the same sum.

### 8. Which is a real cost of adding an index?

- A. Foreign keys stop being enforced
- B. Reads of other columns get slower
- **C. Every insert must update it, and it takes disk and memory: the covering index here was 13 MB on a 26 MB table** ✅
- D. The table can no longer be altered

**Why:** In a payments system the write path is the one that matters, so unused indexes are a real tax.

### 9. Postgres automatically creates an index for:

- A. Nothing at all
- **B. Primary keys and unique constraints only** ✅
- C. Every column used in a WHERE clause
- D. Every foreign key column

**Why:** The referencing side of a foreign key is left to you, which is where the fourteen minute insert came from.

### 10. A trigger runs an unindexed query costing 41.697 ms once per inserted row. Inserting 20,000 rows means:

- **A. About 14 minutes of trigger work** ✅
- B. The same as without the trigger
- C. About 42 milliseconds in total
- D. A cost that depends only on disk speed

**Why:** Per-row work multiplies by the number of rows. This is how a system gets slower as it fills, with no error anywhere.

### 11. Your write path is fine at 5,000 rows and unusable at 5 million, with no code change. Look first at:

- **A. Anything that runs per row: a trigger, a foreign key check, or a lookup inside a loop** ✅
- B. Network latency
- C. The connection pool size
- D. The Postgres version

**Why:** Work proportional to table size is invisible in a test fixture and fatal in production.

### 12. Why is a migration never edited once it has been applied?

- A. The file becomes read-only
- B. Editing breaks a checksum Postgres stores
- C. Migrations are compiled
- **D. Other databases already applied the old version and will never see your edit** ✅

**Why:** Forward-only, numbered files. If something is wrong, the fix is another migration.

### 13. `create index concurrently` exists because:

- **A. The plain form locks out writers, which on a payments table stops every payment while it runs** ✅
- B. It builds the index faster
- C. It builds several indexes at once
- D. It is required for unique indexes

**Why:** It takes longer and lets traffic continue, which is the trade you want on a live system.

### 14. Setting `lock_timeout` on a migration means:

- A. The migration runs faster
- **B. A blocked migration fails in seconds instead of queueing the whole system behind it** ✅
- C. The migration cannot be rolled back
- D. Other queries wait longer

**Why:** The outage is rarely the migration itself. It is everything else waiting on the lock it took.

### 15. After adding a cached `balance_minor` column, what keeps it honest?

- **A. A daily query comparing it against the sum of entries, which should return no rows** ✅
- B. The primary key index
- C. The foreign key
- D. Nothing: the trigger makes drift impossible

**Why:** The trigger removes most ways to drift, not all. A check nobody looks at is not a check.
