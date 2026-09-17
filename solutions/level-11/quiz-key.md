# Level 11: The ledger that survives two writers: quiz answer key

> 15 questions. Pass mark is 12/15 (80%).
> Generated from `content/levels/` by `tools/build_quiz_keys.js`: do not edit by hand.

| # | Answer |
|---|--------|
| 1 | **A** |
| 2 | **B** |
| 3 | **C** |
| 4 | **B** |
| 5 | **B** |
| 6 | **A** |
| 7 | **D** |
| 8 | **B** |
| 9 | **B** |
| 10 | **C** |
| 11 | **B** |
| 12 | **C** |
| 13 | **B** |
| 14 | **C** |
| 15 | **A** |

---

### 1. What does atomicity guarantee for a two leg transfer?

- **A. Both entries are written or neither is** ✅
- B. The transfer completes within one millisecond
- C. No other transaction can read the account
- D. The entries are written in the order you sent them

**Why:** Atomicity is all or nothing. It says nothing about speed, visibility to others, or ordering, which are the other three letters and the isolation level.

### 2. Why can a CHECK constraint not enforce that the entries of a transaction sum to zero?

- A. Because CHECK cannot use arithmetic
- **B. Because CHECK sees one row at a time and this is a rule about a group of rows** ✅
- C. Because CHECK only runs on update
- D. Because the sum is not known until the transaction commits

**Why:** A CHECK is evaluated per row against that row. The balancing rule is about every entry sharing a transaction id, which needs a trigger that can run at commit.

### 3. What does `deferrable initially deferred` change about a constraint trigger?

- A. It makes the trigger optional
- B. It runs the trigger before the insert instead of after
- **C. It runs the trigger once at commit rather than after each row** ✅
- D. It disables the trigger inside transactions

**Why:** Without it the trigger fires after the first leg, when the transaction is deliberately unbalanced, and every transfer fails.

### 4. Two sessions read a balance of $100 and each spends $80 under read committed. What happens?

- A. The second session blocks until the first commits
- **B. Both succeed and the account ends at minus $60** ✅
- C. Postgres aborts the second with a serialization failure
- D. The second session reads $20 because the first is in progress

**Why:** Read committed gives each statement a consistent view and says nothing about a decision made between two statements. This is the lost update, and it is the default behaviour.

### 5. What does `select ... for update` do?

- A. Marks rows as needing an update later
- **B. Takes an exclusive lock on the rows read until the transaction ends** ✅
- C. Upgrades the transaction to serializable
- D. Caches the rows for faster reads

**Why:** The lock makes a second writer wait rather than act on a balance that is about to change. It serialises spending per account, which is the cost.

### 6. What must a caller be able to do before you choose serializable isolation over a row lock?

- **A. Retry the transaction when it aborts** ✅
- B. Run inside a single process
- C. Disable all triggers
- D. Hold the connection open for longer

**Why:** Serializable detects the conflict and aborts one side. Without a retry, one of your users just got an error instead of a payment, and a retry that is not idempotent double charges.

### 7. Why is a unique index the right way to make a write idempotent?

- A. It is faster than a dictionary lookup
- B. It compresses the key column
- C. It gives a better error message
- **D. The check and the write are one operation, so two racing requests cannot both pass** ✅

**Why:** Select then insert leaves a gap between the two statements wide enough for exactly the retry you are protecting against.

### 8. A transfer inserts the transaction row, then the process is killed before the commit. What is in the database?

- A. The transaction row, with no entries
- **B. Nothing from that transfer** ✅
- C. Whatever was flushed to disk at the time
- D. A locked row that must be cleaned up by hand

**Why:** Uncommitted work is rolled back when the connection dies. The visible difference between a crash before and after the commit is the caller's problem, not the database's.

### 9. Why store money as `bigint` in minor units rather than `numeric` or `float`?

- A. Because bigint is the only type Postgres indexes
- **B. Because floats cannot represent most decimals exactly, and integers of cents cannot drift** ✅
- C. Because numeric cannot be summed
- D. Because bigint uses less storage than any alternative

**Why:** numeric is exact too and is a defensible choice; float is not. Integer minor units keep the arithmetic exact and match what the payment rails send.

### 10. Why does this schema have no `balance` column at the start?

- A. Because Postgres cannot sum a column quickly
- B. Because balances change too often to store
- **C. Because a stored balance is a second answer to a question the entries already answer** ✅
- D. Because the balance belongs in the application cache

**Why:** Two sources of truth eventually disagree. You add the column when the sum is too slow, and you accept a reconciliation job on the same day.

### 11. What should the reconciliation query return on a healthy ledger?

- A. One row per account
- **B. Nothing** ✅
- C. The total balance
- D. Every transaction from the last day

**Why:** It selects accounts whose cached balance disagrees with their entries. A row means drift, and the job exists so that you find it rather than a customer.

### 12. Why run the application as a role with no UPDATE or DELETE on the entries table?

- A. It makes inserts faster
- B. It reduces the size of the write ahead log
- **C. Because append only is then a property of the system rather than a promise in a comment** ✅
- D. Because Postgres requires separate roles for triggers

**Why:** If the connection that posts entries can also rewrite them, the audit trail depends on everyone remembering not to. Permissions survive new colleagues.

### 13. Two transfers lock the same two accounts in opposite orders. What happens?

- A. Both wait forever
- **B. The database detects a deadlock and aborts one of them** ✅
- C. The locks merge into one
- D. Postgres escalates to a table lock

**Why:** Deadlock detection resolves it by killing a victim. Taking locks in a consistent order, usually by account id, means it does not happen.

### 14. What does `%s` do in a psycopg query?

- A. Formats the value into the SQL string before sending it
- B. Escapes quotes in the value
- **C. Sends the value to the server separately from the statement** ✅
- D. Marks the column as a string type

**Why:** The statement and the values travel separately, so a value can never become SQL. That is the whole of injection defence, and f-strings undo it.

### 15. Your ledger is correct but a balance query on a hot account has become slow. What is the first thing to check?

- **A. Whether there is an index on entries(account_id)** ✅
- B. Whether the disk is full
- C. Whether to switch to serializable
- D. Whether to shard the table

**Why:** Summing one account means finding its rows. Without the index that is a scan of every entry ever written, and the fix is one line before any of the interesting answers.
