# Level 13: The log is the truth, the balance is an opinion: quiz answer key

> 15 questions. Pass mark is 12/15 (80%).
> Generated from `content/levels/` by `tools/build_quiz_keys.js`: do not edit by hand.

| # | Answer |
|---|--------|
| 1 | **C** |
| 2 | **D** |
| 3 | **A** |
| 4 | **B** |
| 5 | **C** |
| 6 | **B** |
| 7 | **C** |
| 8 | **B** |
| 9 | **B** |
| 10 | **C** |
| 11 | **D** |
| 12 | **A** |
| 13 | **B** |
| 14 | **C** |
| 15 | **C** |

---

### 1. Which of these is an event rather than a command?

- A. TransferMoney
- B. FreezeAccount
- **C. MoneyDeposited** ✅
- D. SetBalance

**Why:** Events are facts in the past tense. The other three are instructions, and an instruction can be refused, which means it is a command.

### 2. What makes the (stream, seq) unique constraint the whole concurrency story?

- A. It sorts the events for reading
- B. It compresses the stream
- C. It lets two writers append at once
- **D. Two writers who read the same version cannot both append the next one** ✅

**Why:** One insert wins and the other gets a unique violation, which is the signal to read again and redo the decision against the new state.

### 3. An append fails with ConcurrencyError. What must the caller do?

- **A. Re-read the stream, redo the decision, and append after the new last sequence** ✅
- B. Retry the same append immediately
- C. Increment the sequence and retry
- D. Fall back to a lock

**Why:** Retrying the same append writes a decision made against a state that no longer exists. That is the lost update in a new costume.

### 4. What is a projection?

- A. A forecast of future balances
- **B. State computed by folding events in order** ✅
- C. A copy of the event table
- D. A database view over the snapshots

**Why:** Same events, same order, same result. That purity is what makes rebuilding it from zero a meaningful test.

### 5. The replay test fails: the rebuilt balances differ from the live table. Which one do you trust?

- A. The live table, because it has been serving traffic
- B. Whichever is larger
- **C. The log, and you rebuild the projection** ✅
- D. Neither, until an auditor decides

**Why:** The events are the record of what happened. A projection is a summary of them, and a summary that disagrees with its source is simply wrong.

### 6. How do you answer "what was this balance on 31 March"?

- A. Keep a monthly balance table
- **B. Fold the events up to that date** ✅
- C. Subtract this year's transactions from today's balance
- D. Restore a database backup

**Why:** Time travel is the same fold with a filter, which is the single most useful thing an event log gives you.

### 7. You add a fee field to an event type. What keeps the events already in the log working?

- A. A migration that rewrites the old events
- B. Deleting events older than the change
- **C. An upcast on read that fills the new field with a default** ✅
- D. A second events table

**Why:** Upcast on read, never in storage. Rewriting stored events means you can no longer prove what the system was told at the time.

### 8. What is a snapshot allowed to be?

- A. The source of truth for old periods
- **B. A cache that the system must work correctly without** ✅
- C. A replacement for the events before it
- D. A backup of the read model

**Why:** Delete every snapshot and every answer must still be correct, only slower. A snapshot that is load bearing is a stored state that can drift.

### 9. A colleague proposes deleting events older than the latest snapshot to save space. What have they proposed?

- A. A reasonable retention policy
- **B. A balance column with extra steps** ✅
- C. Standard practice in event sourcing
- D. A faster replay

**Why:** You lose replay, rebuilds after a bug, questions about that period, and any proof for an auditor. Space is solved by compression and cheaper storage, not by deletion.

### 10. Why does personal data not belong inside events?

- A. It makes the table large
- B. JSONB cannot hold unicode names
- **C. Because the log is append only, and erasure requests require deletion** ✅
- D. Because events must be under 1KB

**Why:** Reference the person by an opaque id and keep them in a normal table you can delete from. Decide it before the first event, because afterwards it is a rewrite.

### 11. What does CQRS name?

- A. A consistency level for distributed databases
- B. A message queue protocol
- C. A snapshotting strategy
- **D. Separating the write path from the read path** ✅

**Why:** Commands append events, queries read projections. The name is in the job description; the idea is a handful of lines.

### 12. Which of these is the strongest reason to choose event sourcing?

- **A. The history is the product, and corrections have to stay visible** ✅
- B. It is faster than a normalised schema
- C. It removes the need for a database
- D. It avoids writing tests

**Why:** Ledgers, orders and trades are histories. A settings page is not, and paying this complexity for one is a bad trade.

### 13. Why should append not decide whether a transfer is allowed?

- A. Because appends must be async
- **B. Because the decision belongs to the command handler, and mixing them makes the log untrustworthy** ✅
- C. Because the database cannot express the rule
- D. Because validation is slow

**Why:** Events are facts. Validation lives in the handler that turns a command into an event, and keeping them apart is what lets a reader trust the log.

### 14. What is eventual consistency in this design?

- A. Events can arrive out of order
- B. Snapshots may be stale
- **C. A read model can be a moment behind the log** ✅
- D. Two projections may disagree forever

**Why:** Fine for a report, not for a balance check inside a command. A command reads its own stream, which is always current.

### 15. Level 11 took a row lock, this level uses a version number. What is the trade?

- A. Locks are always slower
- B. Version numbers require a single writer
- **C. Locks make the loser wait, optimistic concurrency makes the loser retry** ✅
- D. Locks work only in Postgres

**Why:** Pick the lock when the conflict is the normal case, and the version when it is rare, because a retry costs nothing if it almost never happens.
