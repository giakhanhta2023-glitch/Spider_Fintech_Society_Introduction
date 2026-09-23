# Level 12: The payout that half happened: quiz answer key

> 15 questions. Pass mark is 12/15 (80%).
> Generated from `content/levels/` by `tools/build_quiz_keys.js`: do not edit by hand.

| # | Answer |
|---|--------|
| 1 | **B** |
| 2 | **C** |
| 3 | **A** |
| 4 | **B** |
| 5 | **A** |
| 6 | **D** |
| 7 | **C** |
| 8 | **D** |
| 9 | **B** |
| 10 | **A** |
| 11 | **D** |
| 12 | **C** |
| 13 | **B** |
| 14 | **C** |
| 15 | **A** |

---

### 1. Why can a payout not be wrapped in one transaction?

- A. Because the bank is slower than the database
- **B. One step happens in a system you do not own, and no transaction spans both** ✅
- C. The ledger uses a different isolation level
- D. Transactions cannot contain network calls

**Why:** Two-phase commit exists in theory and is essentially never offered across company boundaries.

### 2. In the measured naive run, 13.0% of payouts ended with money debited and nobody paid. The three causes were:

- A. Duplicate references
- B. Network errors only
- **C. Rejections, timeouts, and the process dying after submitting** ✅
- D. Database deadlocks

**Why:** And only the first of the three is a failure you know about. The other two are uncertainty.

### 3. What is a compensating action?

- **A. An operation that undoes a completed step by doing the opposite, leaving both in the history** ✅
- B. A retry with backoff
- C. A refund to the customer
- D. A database rollback

**Why:** You cannot roll back across systems, so you roll forward by doing the inverse. Accountants call it a semantic rollback.

### 4. Adding compensation took the inconsistent payouts from 26 to 17. Why did it not fix the rest?

- A. Because the bank rejected the compensations
- **B. Because the remaining 17 are cases where nobody knows whether the payout went out, and compensating might cancel a real payment** ✅
- C. The compensations failed
- D. Because 17 had already been paid

**Why:** Compensation handles known failure. Uncertainty needs a mechanism that can establish the truth.

### 5. What does the sweeper do?

- **A. Finds everything left mid flight, asks the other side what really happened, and finishes it** ✅
- B. Reconciles the bank statement
- C. Deletes stuck records
- D. Retries failed payouts on a schedule

**Why:** In the measurement it resolved all 17 uncertain payouts, 17 of which turned out to have been paid.

### 6. With the sweeper but no compensation, nine payouts remained broken. Why?

- A. The sweeper ran too rarely
- B. The bank lost them
- C. They were duplicates
- **D. Because a sweeper that only asks "did it go out" finds that the rejected ones did not, and has nothing to do about it** ✅

**Why:** Compensation and sweeping cover different failures. With both, zero were left.

### 7. Why did looking up 17 timed out payouts not cause double payments?

- A. Because timeouts always mean failure
- B. Because the amounts were small
- **C. Because the bank recognises the reference we generated and returns the original result instead of paying again** ✅
- D. Because the sweeper waited long enough

**Why:** The sender names the operation. That is what makes both retry and recovery safe.

### 8. When should the reference be generated?

- A. At the end, when recording the result
- B. By the bank, in its response
- C. On each attempt, so retries are distinguishable
- **D. Once, when the payout is created, and stored before the first attempt** ✅

**Why:** A reference generated per attempt turns one payout into several and makes recovery impossible.

### 9. Compensating actions must be idempotent because:

- A. They run inside a transaction
- **B. They run when things are already failing, so they will be retried, interrupted and run again** ✅
- C. They are slower than normal operations
- D. The database requires it

**Why:** And a compensation that credits twice is the same bug as a payout that pays twice.

### 10. What is special about a compensation that fails permanently?

- **A. There is nobody further back to unwind to, so the money is simply missing: it is a page, not a log line** ✅
- B. It is retried by the database
- C. It rolls back the whole saga
- D. It can be ignored

**Why:** Which is why compensations touch only systems you control and are kept as simple as possible.

### 11. Orchestration is usually preferred over choreography for money because:

- A. It uses fewer services
- B. It is faster
- C. Choreography cannot be made idempotent
- **D. When a payout is stuck, one service can answer "what state is it in" instead of an investigation across four** ✅

**Why:** That question gets asked at the exact moment somebody is waiting for their money.

### 12. Why write the state before calling the bank rather than after?

- A. To reduce lock contention
- B. It is faster
- **C. Because a crash after the call leaves no record that you tried, which is exactly the case you needed to recover** ✅
- D. Because the database requires ordering

**Why:** Mark it submitting and commit, then call. The state tells the sweeper where to look.

### 13. Why does every state change carry a timestamp?

- A. To sort the queue
- **B. Because a payout submitting for 30 seconds is normal and one submitting for an hour is stuck, and only the time tells them apart** ✅
- C. Because the sweeper sorts by id
- D. For the audit log only

**Why:** Stuck detection is the safety net that catches the failures nobody predicted.

### 14. In a payout system, which is worse?

- A. They are equally bad
- B. It depends on the amount
- **C. Paying twice** ✅
- D. Paying late

**Why:** Late is a support ticket. Twice is money gone, often to somebody with no reason to return it.

### 15. Should the ledger debit happen before or after submitting to the bank?

- **A. Before, so a crash leaves the balance temporarily low and the sweeper restores it** ✅
- B. It makes no difference
- C. Simultaneously, in one transaction
- D. After, so nothing is debited unless the payment succeeds

**Why:** Debiting afterwards means a crash leaves a payment sent with nothing deducted, which is money leaving twice.
