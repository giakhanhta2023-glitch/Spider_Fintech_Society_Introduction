# Level 4: Payments and the double-entry ledger: quiz answer key

> 15 questions. Pass mark is 12/15 (80%).
> Generated from `content/levels/` by `tools/build_quiz_keys.js`: do not edit by hand.

| # | Answer |
|---|--------|
| 1 | **B** |
| 2 | **A** |
| 3 | **A** |
| 4 | **D** |
| 5 | **B** |
| 6 | **B** |
| 7 | **C** |
| 8 | **C** |
| 9 | **A** |
| 10 | **B** |
| 11 | **D** |
| 12 | **C** |
| 13 | **D** |
| 14 | **C** |
| 15 | **A** |

---

### 1. What makes a transaction valid in a double-entry ledger?

- A. It has exactly two entries
- **B. Its entries sum to zero** ✅
- C. It was approved by an administrator
- D. Both accounts have positive balances

**Why:** Balance is the rule, not the entry count. A payment with a fee has three legs and is perfectly valid because they still sum to zero.

### 2. How should an account balance be obtained?

- **A. Computed as the sum of that account's entries** ✅
- B. Read from a balance column that each transfer updates
- C. Requested from the payment network
- D. Stored in a separate cache that is never rebuilt

**Why:** Entries are the source of truth. A stored balance can drift out of agreement with them, and then nobody knows which is right. Caches are allowed only if rebuildable.

### 3. A payment of $25.00 carries a $0.50 platform fee. Which set of legs is correct?

- **A. customer -2500, merchant +2450, fee_income +50** ✅
- B. customer -2500, merchant +2500
- C. customer -2550, merchant +2500, fee_income +50
- D. customer -2500, merchant +2450

**Why:** The customer paid $25.00, the merchant nets $24.50, and the platform keeps $0.50: three legs summing to zero. The two-leg version that credits the merchant $24.50 loses 50 cents and would be rejected as unbalanced.

### 4. A payment request arrives with an idempotency key the server has already seen. What should happen?

- A. Post it and immediately reverse it
- B. Post the transaction again for safety
- C. Reject the request with an error
- **D. Return the original transaction without posting anything new** ✅

**Why:** That is the entire point of the key: a retried request returns the original result so a lost response cannot become a double charge.

### 5. A posted payment was wrong. What is the correct fix?

- A. Edit the amount on the original entries
- **B. Post a reversing transaction with opposite signs** ✅
- C. Adjust the stored balance directly
- D. Delete the entries

**Why:** Ledgers are append-only. A reversal nets the effect to zero while leaving both the error and the correction visible for audit.

### 6. Why is `int(round(float(text) * 100))` used to parse money rather than `int(float(text) * 100)`?

- A. float cannot multiply by 100
- **B. int truncates, so 19.99 * 100 = 1998.9999... would become 1998** ✅
- C. round converts the string to a number
- D. round is faster

**Why:** int() chops the fractional part. Binary floating point often lands a hair below the intended value, so truncation loses a cent on roughly half of all inputs.

### 7. What is the "penny-splitting problem"?

- A. Fees smaller than one cent
- B. Storing amounts smaller than the minor unit
- **C. Deciding who gets the leftover unit when an amount does not divide evenly** ✅
- D. Rounding errors when converting currencies

**Why:** Splitting 100 cents three ways gives 33, 33, 33 and one cent left over. The rule for allocating it must be deliberate and deterministic, or the transaction stops balancing.

### 8. What should a transfer do when the source account has insufficient funds?

- A. Write only the credit leg
- B. Return False so the caller can decide
- **C. Raise an exception and write nothing** ✅
- D. Write the entries and flag the account as overdrawn

**Why:** Validate fully, then write. Raising cannot be ignored by accident, and a partially written transaction would break the invariant immediately.

### 9. In a Python class, what is `self`?

- **A. The instance the method was called on** ✅
- B. A copy of the class definition
- C. A reserved keyword like def or return
- D. The parent class

**Why:** self is the instance, passed automatically as the first argument. It is a naming convention rather than a keyword, but never rename it.

### 10. Why does the tutorial ledger keep a "world" account that is allowed to go negative?

- A. To hold profits
- **B. To represent money entering from outside the system, so deposits still balance** ✅
- C. To store rounding errors
- D. Because banks require it by regulation

**Why:** A deposit must have two legs. The world (contra) account is the counterparty for money arriving from an external rail, and its negative balance mirrors the customer funds you hold.

### 11. Which payment state means funds are reserved but no money has moved?

- A. posted
- B. settled
- C. reversed
- **D. pending (authorized)** ✅

**Why:** Authorization reserves funds and lowers the available balance. Posting writes it to your ledger; settlement moves money between institutions days later.

### 12. What does `sum(e["amount"] for e in self.entries)` return on a healthy ledger?

- A. The number of entries
- B. The largest balance
- **C. Zero** ✅
- D. The total money held

**Why:** Every transaction balances, so the whole ledger sums to zero. A non-zero result means a bug wrote an unbalanced transaction: check it after every operation in tests.

### 13. Why is a custom exception class better than returning False on failure?

- A. It automatically logs the error
- B. It prevents the function from being called again
- C. It runs faster
- **D. It cannot be silently ignored, and callers can handle each failure type precisely** ✅

**Why:** An ignored False leaves the caller believing the payment succeeded. An exception propagates until something handles it, and a class hierarchy lets callers catch broadly or narrowly.

### 14. Why do payment APIs like Stripe require an idempotency key on write requests?

- A. To authenticate the caller
- B. To encrypt the payload
- **C. Because networks lose responses, and the client retry must not create a second charge** ✅
- D. To order transactions by time

**Why:** The request may have succeeded before the response was lost. The key lets the server recognise the retry as the same intent rather than a new payment.

### 15. What does the leading underscore in `_post` communicate?

- **A. The method is internal by convention. Validated public methods should be used instead** ✅
- B. The method is private and enforced by Python
- C. The method is deprecated
- D. The method returns nothing

**Why:** Python does not enforce privacy, but the underscore is a universally understood signal. _post skips validation, so callers use transfer() or deposit() instead.
