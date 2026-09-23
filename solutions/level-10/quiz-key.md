# Level 10: The processor says one thing, your ledger says another: quiz answer key

> 15 questions. Pass mark is 12/15 (80%).
> Generated from `content/levels/` by `tools/build_quiz_keys.js`: do not edit by hand.

| # | Answer |
|---|--------|
| 1 | **A** |
| 2 | **D** |
| 3 | **C** |
| 4 | **A** |
| 5 | **C** |
| 6 | **A** |
| 7 | **D** |
| 8 | **B** |
| 9 | **B** |
| 10 | **A** |
| 11 | **B** |
| 12 | **B** |
| 13 | **C** |
| 14 | **C** |
| 15 | **D** |

---

### 1. What is the goal of a reconciliation run?

- **A. To explain every difference between them** ✅
- B. To correct the processor's file
- C. To make the two sets of numbers agree
- D. To calculate the fees

**Why:** Adjusting until things agree destroys the evidence. Explaining is the job; agreement is the consequence.

### 2. A settlement line shows gross 7140, fee 237, net 6903. What reaches the merchant's bank?

- A. 7140
- B. 7377
- C. 237
- **D. 6903** ✅

**Why:** Net is what arrives. Reporting gross as revenue and comparing it to the bank is the most common merchant complaint there is.

### 3. The processor charges 2.9% plus 30 cents. Across the file the effective rate is 3.2851%. Why is it higher?

- A. Hidden fees
- B. Chargeback fees
- **C. The fixed 30 cents is a large share of a small payment: under $10 the effective rate is 7.03%** ✅
- D. Currency conversion

**Why:** Which is why small payments are batched, and why the sentence "2.9% plus 30 cents" is more interesting than it looks.

### 4. A chargeback on an $88.00 sale costs the merchant:

- **A. $88.00 plus a $15.00 dispute fee, whether they win or lose** ✅
- B. The fee only
- C. Nothing if they win
- D. $88.00

**Why:** In this file disputes cost $1,185.00 in fees on top of the money returned.

### 5. 46 of the 59 payout days in the file are negative. What does a negative payout mean?

- A. The fees exceeded the rate card
- B. The payout was cancelled
- **C. The merchant owes money, so the processor debits their bank account instead of paying them** ✅
- D. The processor made an error

**Why:** And if that debit fails, the processor is exposed, which is why onboarding and reserves exist.

### 6. The reconciliation finds 37 payments in the file that your ledger has never seen. In this data, what are they?

- **A. Payments whose authorisation timed out in level 9, which the issuer actually approved** ✅
- B. Duplicate lines
- C. Test transactions
- D. Chargebacks

**Why:** Worth $3,116.61. Without this job they are money in a merchant account with nothing to explain it.

### 7. The right response to those 37 is:

- A. Tolerate them, since the value is small
- B. Insert them into the ledger so the report balances
- C. Ask the processor to remove them
- **D. Resolve the underlying unknown payments, let the normal flow post the entries, and rerun** ✅

**Why:** You never write an entry to make a reconciliation balance. You write it because something happened.

### 8. 12 captures are in your ledger and not in the file, worth $1,690.07. Why does this break type matter most?

- A. It affects the fee calculation
- **B. It is money you captured that the processor has not paid you** ✅
- C. It is the largest by value
- D. It is always a parsing error

**Why:** Sometimes timing, sometimes a capture that never arrived, sometimes money simply owed. This break type pays for the job.

### 9. A capture from this afternoon is not in today's file. What is it?

- A. A failed capture
- **B. A timing difference, pending until the settlement window has passed** ✅
- C. A break to investigate
- D. A duplicate

**Why:** Treating timing as breaks fills the queue with noise, and a queue full of noise is a queue nobody reads.

### 10. Your matching rules ignore differences under five cents. What must still be true?

- **A. The tolerance is written down and approved, every tolerated difference is still recorded and totalled, and somebody watches the total** ✅
- B. Nothing: that is what a tolerance means
- C. The tolerance must be under one cent
- D. It must apply only to foreign currency

**Why:** A tolerance may stop you investigating a difference. It must never stop you seeing it.

### 11. What is a plug?

- A. A rule that matches two records
- **B. An adjusting entry posted only to make two numbers agree** ✅
- C. A tolerance threshold
- D. A processor fee

**Why:** It removes the evidence that something is wrong, which is why fraud investigators look for them first.

### 12. A break has been open eleven days with no explanation. The correct state is:

- A. Written off
- **B. Open, aged, owned by a named person, with what has been checked recorded** ✅
- C. Closed, since nobody could explain it
- D. Reclassified as a timing difference

**Why:** Unexplained is a legitimate state. Unowned and unaged is not.

### 13. An automatic match rate of 98.6% suggests:

- A. The engine is broken
- B. The tolerance is too wide
- **C. A reasonable result, with the remaining items genuinely needing a person or better rules** ✅
- D. The processor is unreliable

**Why:** Below about 99% the answer is usually better matching rules rather than more people.

### 14. Why must every break carry an id derived from what it is about?

- A. To sort the queue
- B. To link it to the payout
- **C. So that rerunning the job updates the same break rather than creating a duplicate** ✅
- D. Because the database requires it

**Why:** A reconciliation that cannot be run twice safely will be run once, badly, by somebody in a hurry.

### 15. What does comparing the settlement file to the bank statement catch that comparing it to your ledger cannot?

- A. Fee errors
- B. Chargebacks
- C. Duplicate payments
- **D. A payout that was reported but never actually sent, or money that went to the wrong account** ✅

**Why:** Agreeing with the processor does not prove either of you is right about what arrived.
