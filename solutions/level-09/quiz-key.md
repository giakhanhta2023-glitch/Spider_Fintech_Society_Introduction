# Level 9: The life of a card payment: quiz answer key

> 15 questions. Pass mark is 12/15 (80%).
> Generated from `content/levels/` by `tools/build_quiz_keys.js`: do not edit by hand.

| # | Answer |
|---|--------|
| 1 | **C** |
| 2 | **B** |
| 3 | **D** |
| 4 | **D** |
| 5 | **A** |
| 6 | **B** |
| 7 | **C** |
| 8 | **A** |
| 9 | **C** |
| 10 | **C** |
| 11 | **A** |
| 12 | **B** |
| 13 | **D** |
| 14 | **A** |
| 15 | **B** |

---

### 1. At the moment an authorisation is approved, how much money has moved?

- A. The full amount, from the customer to the merchant
- B. Half, with the rest at settlement
- **C. None. The issuer has set it aside and promised it is there** ✅
- D. The amount minus fees

**Why:** Which is exactly why your ledger writes no entries at authorisation. It writes them at capture.

### 2. In the shipped week, 841 approved authorisations worth $74,230.57 ended in `expired`. What does that mean happened?

- A. The issuer reversed them
- **B. The merchant never captured them, so the holds fell off after seven days** ✅
- C. They were charged back
- D. The customers cancelled

**Why:** The customer saw money held for a week for a sale that never completed. A rising expiry count means a broken checkout.

### 3. Your ledger writes entries at authorisation instead of capture. What breaks?

- A. Only the customer's statement
- B. Nothing, as long as you reverse them later
- C. Authorisations start being declined
- **D. The ledger claims money the merchant may never receive, so reconciliation never matches and expired holds become fake revenue** ✅

**Why:** 4.88% of approvals in this week expired. That would be fake revenue somebody has to unwind by hand.

### 4. A capture for less than the authorised amount happens because:

- A. The issuer reduced the approval
- B. It is always an error
- C. The customer paid partly in cash
- **D. The order shipped in parts, an item was out of stock, or the authorisation included room for a tip** ✅

**Why:** 8.04% of captures here were partial, leaving $38,580.89 authorised and never taken.

### 5. A customer cancels an order that has been authorised but not captured. You should:

- **A. Void it** ✅
- B. Let the hold expire
- C. Capture then refund
- D. Refund it

**Why:** Faster for the customer and cheaper for the merchant, since refunds usually do not return the processing fee.

### 6. Which decline code must never be retried?

- A. do_not_honor
- **B. lost_or_stolen** ✅
- C. insufficient_funds
- D. velocity_exceeded

**Why:** It is a hard decline. Retrying it wastes money, annoys the customer and counts against you with the networks.

### 7. In this week, 74.2% of declines were soft, worth $167,410.94. What does that number justify building?

- A. A manual review queue for declines
- B. A nightly retry of every failed payment
- **C. A retry policy limited to soft declines, with a capped attempt count and growing delays** ✅
- D. Nothing: declined is declined

**Why:** Recovering soft declines is a product every payments company sells. Retrying hard declines is how you get fined.

### 8. An authorisation request times out after 30 seconds. What is the correct state?

- **A. unknown, until something tells you which it was** ✅
- B. authorized, optimistically
- C. failed
- D. declined

**Why:** If your model cannot hold "we do not know", your code will guess, and it guessed wrong 159 times in this week alone.

### 9. What makes a retry after a timeout safe?

- A. Waiting at least 60 seconds
- B. Using a different card
- **C. Sending your own reference with the original request, so the network can recognise the retry, plus a reversal before retrying** ✅
- D. Checking the customer's balance first

**Why:** Level 4's idempotency key, extended past your own database to the party you are calling.

### 10. The difference between a refund and a chargeback is:

- A. The speed
- B. Refunds are for cards, chargebacks for bank transfers
- **C. A refund is the merchant agreeing; a chargeback is the cardholder's bank taking the money back whether the merchant agrees or not** ✅
- D. The amount

**Why:** And the merchant pays a dispute fee either way, win or lose.

### 11. This merchant's chargeback rate was 0.499% of captured payments. Why is the rate watched more closely than the amount?

- **A. Because card networks run monitoring programmes, with fines and eventual loss of card acceptance above roughly 1%** ✅
- B. Because the amount is always small
- C. Because issuers set prices from it
- D. Because rates are easier to compute

**Why:** $6,152.18 is survivable. Losing the ability to accept cards is not.

### 12. What does engineering owe the dispute process?

- A. A support phone number
- **B. Evidence gathered at the time and retrievable months later: authorisation response, delivery, device, terms accepted, timestamps** ✅
- C. A lower decline rate
- D. Faster refunds

**Why:** None of it can be collected after the dispute arrives, which is what makes it an engineering problem.

### 13. Which transition must the state machine refuse?

- A. authorizing to declined
- B. captured to refunded
- C. authorized to voided
- **D. captured to voided** ✅

**Why:** The money has already moved. What the caller wants is a refund, and letting a void through would lie to the ledger.

### 14. Why does every lifecycle event need its own idempotency key?

- **A. Because each one is a network call that can time out and be retried, and a capture that runs twice charges the customer twice** ✅
- B. Because the network rejects requests without one
- C. Because the database requires unique keys
- D. To make the events sortable

**Why:** Same bug as level 4, with a slower feedback loop and a customer in the middle.

### 15. Why does your service store a token rather than the card number?

- A. To support multiple currencies
- **B. Because the full number drags the whole system under PCI DSS, with the audits and breach exposure that follow** ✅
- C. Tokens are shorter
- D. Because the network rejects card numbers

**Why:** Keep a token, the last four digits and the expiry for display. Level 15 builds the vault that issues the token.
