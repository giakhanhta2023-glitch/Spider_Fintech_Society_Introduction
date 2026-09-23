# Level 13: The table that outgrew the machine: quiz answer key

> 15 questions. Pass mark is 12/15 (80%).
> Generated from `content/levels/` by `tools/build_quiz_keys.js`: do not edit by hand.

| # | Answer |
|---|--------|
| 1 | **C** |
| 2 | **D** |
| 3 | **C** |
| 4 | **A** |
| 5 | **A** |
| 6 | **B** |
| 7 | **B** |
| 8 | **C** |
| 9 | **A** |
| 10 | **C** |
| 11 | **A** |
| 12 | **D** |
| 13 | **B** |
| 14 | **D** |
| 15 | **B** |

---

### 1. What is partition pruning?

- A. Deleting old partitions on a schedule
- B. Compressing partitions that are rarely read
- **C. The planner skipping partitions that cannot contain matching rows** ✅
- D. Rebalancing rows between partitions

**Why:** Measured here: 4,729 pages touched on the plain table against 396 on the partitioned one.

### 2. Removing one month of payments: DELETE took 47.2 ms and 2,947 kB of log, DROP partition took 0.9 ms and 5,400 bytes. What else differed?

- A. The delete returned the disk space, the drop did not
- B. Both returned the space
- C. Neither returned any space
- **D. The drop returned all the space immediately, the delete returned none** ✅

**Why:** A delete marks rows dead and leaves the table the same size. That is why delete-based retention bloats forever.

### 3. What does partitioning make worse?

- A. Insert throughput, severely
- B. Queries that filter on the partition key
- **C. Queries that do not mention the partition key, and planning time** ✅
- D. Retention and archiving

**Why:** Measured: one index scan became ten, and planning went from 0.188 ms to 0.898 ms, more than the execution time.

### 4. Why must the partition key appear in every unique index?

- **A. Because each partition has its own index, so uniqueness can only be enforced within a partition unless the key is included** ✅
- B. For performance
- C. Because Postgres requires primary keys to be composite
- D. It does not have to

**Why:** Which means a unique reference becomes unique on the pair, and level 9 idempotency needs rethinking.

### 5. Adding a column with `default 'standard'` took 0.6 ms. Adding one with `default gen_random_uuid()` took 1,526 ms and 70 MB of log. Why?

- **A. A constant default is stored once in the catalog, but a volatile default needs a different value per row, so the whole table is rewritten** ✅
- B. The uuid type is slower to write
- C. The second statement was not indexed
- D. gen_random_uuid() is a slow function

**Why:** One word in the migration, three orders of magnitude, and an ACCESS EXCLUSIVE lock for the whole rewrite.

### 6. A four minute reporting query is running. Your one second ALTER TABLE starts. What happens to ordinary queries on that table?

- A. They are routed to the replica
- **B. They queue behind the waiting ALTER, so the table is unusable for four minutes** ✅
- C. They run normally, because the ALTER is waiting
- D. They fail immediately

**Why:** Postgres lock queues are fair. The migration has not touched a row and the product is already down.

### 7. What does `set lock_timeout = '3s'` at the top of a migration do?

- A. Limits how long the migration itself may run
- **B. Makes the migration fail fast rather than waiting for a lock and building a queue behind it** ✅
- C. Forces the migration to use a weaker lock
- D. Retries the migration for three seconds

**Why:** Failing is fine. Queueing is not. Your deploy tool can retry a failure; it cannot undo an outage.

### 8. What decides whether data belongs in Postgres or in a wide column store such as DynamoDB?

- A. The write throughput required
- B. Whether the team knows SQL
- **C. The access pattern: constraints and unpredicted queries need relational, while one named access pattern at enormous scale with no cross row invariant does not** ✅
- D. The volume of data

**Why:** Pick the store from the query, not from the volume. A ledger is relational because the invariant must be enforced.

### 9. The one statement backfill took 5,622 ms; batches of 10,000 took 5,980 ms. Why prefer the slower one?

- **A. The longest lock held drops from 5,622 ms to 280 ms, and it can be paused or resumed** ✅
- B. It produces less write ahead log
- C. It avoids bloating the table
- D. It is more atomic

**Why:** Same log, same bloat, 6% slower. What changes is lock duration and blast radius.

### 10. Why walk the primary key instead of using `offset` in a backfill?

- A. offset is not supported in updates
- B. Because offset requires an index
- **C. Because offset makes the database count through and discard every skipped row, so each batch gets slower and the job degrades into quadratic time** ✅
- D. They are equivalent

**Why:** The same quadratic trap as the missing index in level 6, in a different disguise.

### 11. Why keep `and fee_minor is null` in the backfill predicate?

- **A. To make the job idempotent, so it can be restarted, rerun, or accidentally run twice** ✅
- B. To make the update faster
- C. To avoid locking rows
- D. Because the column is nullable

**Why:** Resumability is the property you traded whole-job atomicity for. The predicate is what delivers it.

### 12. Why `is distinct from` rather than `<>` in the verification query?

- A. It is faster
- B. Because the column is numeric
- C. They behave identically
- **D. Because `null <> anything` evaluates to null rather than true, so a plain comparison silently skips the rows the backfill missed** ✅

**Why:** And the rows it skips are exactly the ones you are looking for.

### 13. A merchant issues a refund, the page reloads, and the refund is missing. What happened?

- A. The cache was stale
- **B. The write went to the primary and the read went to a replica that had not caught up** ✅
- C. The transaction was rolled back
- D. The write failed silently

**Why:** Read your own writes goes to the primary. So does anything that decides money.

### 14. One backfill produced 180 MB of write ahead log. Why does that matter beyond disk?

- A. It slows down the backfill
- B. It increases the table size
- C. It blocks vacuum
- **D. Every byte ships to every replica and every change data capture consumer, so lag climbs while it replays** ✅

**Why:** Which is why the batched loop sleeps between batches: to produce log no faster than replicas can consume it.

### 15. When is change data capture the better choice over an outbox?

- A. When other services need to react to business events
- **B. When something needs a copy of your tables, such as a warehouse, a search index or an analytics store** ✅
- C. When you need exactly once delivery
- D. Always, because it needs no application code

**Why:** Outbox for things that react, change data capture for things that copy. The second couples consumers to your table layout.
