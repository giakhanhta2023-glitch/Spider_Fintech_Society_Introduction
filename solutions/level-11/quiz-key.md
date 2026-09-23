# Level 11: The event you thought you published: quiz answer key

> 15 questions. Pass mark is 12/15 (80%).
> Generated from `content/levels/` by `tools/build_quiz_keys.js`: do not edit by hand.

| # | Answer |
|---|--------|
| 1 | **B** |
| 2 | **A** |
| 3 | **A** |
| 4 | **C** |
| 5 | **A** |
| 6 | **B** |
| 7 | **C** |
| 8 | **B** |
| 9 | **B** |
| 10 | **D** |
| 11 | **A** |
| 12 | **D** |
| 13 | **C** |
| 14 | **C** |
| 15 | **D** |

---

### 1. What is the main difference between a log and a queue?

- A. A log can only have one consumer
- **B. In a log the event stays after being read, and each consumer tracks its own position** ✅
- C. A queue guarantees ordering and a log does not
- D. A log is faster

**Why:** Which is what makes replay and independent consumers possible. A queue is for work; a log is for facts.

### 2. Your code commits a payment and then publishes an event, with a 5% chance of dying in between. Measured over 400 payments, what happened?

- **A. 20 events were lost forever, with no error anywhere** ✅
- B. Nothing: the database rolls back
- C. 20 events were delivered twice
- D. The broker retried them

**Why:** No alert, no way to find them except by reconciling two systems, which should not be how you learn about it.

### 3. Publishing before committing instead is:

- **A. Worse: you announce payments that may never exist, and you cannot unsend an event** ✅
- B. The correct fix
- C. Equivalent
- D. Only safe with a queue

**Why:** Fraud, analytics and the merchant all act on something your database never recorded.

### 4. The outbox pattern works because:

- A. It deduplicates events
- B. The broker becomes transactional
- **C. The event is written to the same database in the same transaction as the business change, so both happen or neither does** ✅
- D. It retries the publish until it works

**Why:** One system, one transaction. A separate publisher then moves the events out of the table.

### 5. With the outbox, the measured result was zero lost and 3.50% delivered twice. Why not mark rows as sent before publishing?

- **A. Because crashing between the mark and the send loses the event permanently, which is the problem you just fixed** ✅
- B. Because the index would not be used
- C. It would break ordering
- D. It would be slower

**Why:** Duplicates are defensible because the fix lives in one place you control: the consumer.

### 6. What makes a consumer idempotent?

- A. Acknowledging quickly
- **B. Recording the event id and doing the work in one transaction, so a repeat does nothing** ✅
- C. Using a dead letter queue
- D. Processing events in order

**Why:** That is how an at-least-once delivery becomes an exactly-once effect, which is the only version that exists.

### 7. A log guarantees ordering:

- A. Across the whole topic
- B. Only if you enable it
- **C. Within a partition only** ✅
- D. Only for a single consumer

**Why:** Which is what makes the partition key a design decision rather than a detail.

### 8. Measured over 37,987 real events in 4 partitions, partitioning at random instead of by payment id caused:

- A. No difference
- **B. Events out of order for 26.3% of multi event payments** ✅
- C. Slower consumers
- D. Duplicate delivery

**Why:** Captures before authorisations, refunds before captures. Invisible on one consumer and constant under load.

### 9. The cost of partitioning by a narrow key such as account id is:

- A. Consumers cannot be idempotent
- **B. A very busy account creates a hot partition that one consumer must handle alone** ✅
- C. Ordering is no longer guaranteed
- D. Events can be lost

**Why:** Pick the narrowest key that still gives the order you actually need.

### 10. You run six consumers in one group on a topic with four partitions. What happens?

- A. The group rebalances into six partitions
- B. Throughput rises by 50%
- C. Each consumer gets two thirds of a partition
- **D. Two consumers sit idle, because a partition goes to exactly one consumer in the group** ✅

**Why:** More parallelism needs more partitions, and the partition count is chosen up front and awkward to change.

### 11. Which lag measurement should you alert on?

- **A. Lag in seconds, because it says how out of date the world is** ✅
- B. Neither: alert on consumer restarts
- C. Lag in events, because it counts work
- D. Both, with the same threshold

**Why:** "The fraud consumer is nine minutes behind" is actionable. "The fraud consumer is 40,000 events behind" depends on the rate.

### 12. Publishing 400 events took 30,473 ms one row at a time and 116 ms in batches of 500. What does that teach?

- A. The database was warming up
- B. Batches use less memory
- C. The index was missing
- **D. When per item work is tiny, count the round trips before optimising anything else** ✅

**Why:** 265 times faster with no change to the query, the database or the network.

### 13. An event fails every time it is processed. The right handling is:

- A. Skip it and log a warning
- B. Retry forever, so nothing is lost
- **C. A few retries with growing delays, then move it to a dead letter table with the error, and carry on** ✅
- D. Restart the consumer

**Why:** Retrying forever blocks the partition and everything behind it. Skipping silently is data loss.

### 14. Before replaying four months of events through a consumer, the thing to check is:

- A. The partition count
- B. The broker version
- **C. Whether the consumer does anything besides write to a table, such as sending email** ✅
- D. The retention setting

**Why:** Replaying four months of emails to real customers in ten minutes is the classic replay disaster.

### 15. Why does every event carry an `event_id` generated when it is created rather than when it is published?

- A. To sort events
- B. To support partitioning
- C. Because the broker requires it
- **D. So a republished event keeps the same id, which is what lets consumers recognise a duplicate** ✅

**Why:** An id generated at publish time changes on every retry, which defeats the whole idempotency scheme.
