# Level 15: The keys to the money: quiz answer key

> 15 questions. Pass mark is 12/15 (80%).
> Generated from `content/levels/` by `tools/build_quiz_keys.js`: do not edit by hand.

| # | Answer |
|---|--------|
| 1 | **C** |
| 2 | **C** |
| 3 | **B** |
| 4 | **A** |
| 5 | **A** |
| 6 | **C** |
| 7 | **D** |
| 8 | **B** |
| 9 | **A** |
| 10 | **C** |
| 11 | **B** |
| 12 | **B** |
| 13 | **D** |
| 14 | **D** |
| 15 | **A** |

---

### 1. What belongs in a threat model that most people leave out?

- A. The compliance framework
- B. A list of technologies used
- **C. What you are deliberately choosing not to defend against** ✅
- D. The incident response phone tree

**Why:** It tells a reader where the gaps are on purpose, which is more useful than a claim of being secure.

### 2. A secret was committed and then deleted in a later commit. What is its status?

- A. Safe, because it is no longer in the current code
- B. Safe once the branch is deleted
- **C. Still leaked, because the history contains it, so it must be rotated** ✅
- D. Safe if the repository is private

**Why:** Revoke first, investigate second. Every minute spent assessing is a minute the key still works.

### 3. Which mechanism lets the network itself prove which service is calling?

- A. A JWT
- **B. Mutual TLS** ✅
- C. IP allowlisting
- D. An API key in a header

**Why:** Both sides present certificates during the handshake, so a caller without one never reaches your code.

### 4. Why must you pin the algorithm when verifying a JWT?

- **A. Because otherwise an attacker chooses it, setting it to none or signing an HS256 token with your public key** ✅
- B. To support key rotation
- C. Because libraries require it
- D. For performance

**Why:** Algorithm confusion. Never read the algorithm from the token you are trying to verify.

### 5. A token is valid, correctly signed, unexpired, and issued by you. Is the request authorised?

- **A. No: a signature proves who, never what they may do. The scope for the specific action still has to be checked** ✅
- B. Only if it has an audience claim
- C. Only if it is RS256
- D. Yes, that is what verification means

**Why:** Authentication and authorisation are separate questions, and conflating them is a common breach.

### 6. Verification cost measured: HS256 79.9 us, RS256 141.5 us, ES256 239.7 us. What is surprising?

- A. That elliptic curve is the cheapest
- B. That all three are the same
- **C. That verifying an RSA signature is cheaper than verifying an elliptic curve one** ✅
- D. That HMAC is the slowest

**Why:** RSA verification uses a tiny public exponent. RSA signing is the expensive direction, not verifying.

### 7. Why does envelope encryption exist?

- A. Because AES is slow
- B. Because it is required by PCI
- C. To support multiple algorithms
- **D. Because a call to the key service costs milliseconds while local encryption costs microseconds, so you do far fewer calls, and rotation then touches only the wrapped keys** ✅

**Why:** Measured: 20,000 calls and 160 s, against 200 calls and 1.7 s. Rotation went from 127 ms plus a full rewrite to 1 ms.

### 8. Local AES-256-GCM encrypted a card number in 2.8 microseconds. What does that tell you?

- A. That the measurement is wrong
- **B. That the cost is in the key service round trip, not the cryptography, so the design question is how few calls you can make** ✅
- C. That encryption is the bottleneck
- D. That you should use a weaker cipher

**Why:** 358,539 records per second on one core. The 8 ms network call is a thousand times more expensive.

### 9. Which may never be stored after authorisation, in any form?

- **A. The CVV** ✅
- B. The expiry date
- C. The last four digits
- D. The BIN

**Why:** Not encrypted, not hashed, not "temporarily". Not at all.

### 10. What does tokenisation actually buy you?

- A. Encryption of the card number
- B. Compliance with GDPR
- **C. That only one system holds card numbers, so the number of systems in PCI scope collapses** ✅
- D. Faster lookups

**Why:** Seven systems in scope becoming one is the difference between an audit of a week and one of a quarter.

### 11. Why must a token carry no information about the PAN?

- A. To keep it short
- **B. Because a token that is derived from the PAN turns one key compromise into every card** ✅
- C. For database indexing
- D. Because the standard says so

**Why:** Random identifier, mapping in the vault, meaningless anywhere else.

### 12. What must be inside the signed string of a webhook signature?

- A. The parsed JSON
- **B. The timestamp and the raw body bytes** ✅
- C. The receiver identifier
- D. The URL

**Why:** Raw bytes, because re-serialising changes them; the timestamp, because without it a captured request replays forever.

### 13. The timing leak in `==` could not be reproduced: 112.7 ns differing at the first byte against 98.5 ns at the last. What is the right conclusion?

- A. The measurement was wrong and should be discarded
- B. Use a slower comparison to mask the timing
- C. Timing attacks are a myth, so use ==
- **D. No leak was visible at this length in this interpreter, and compare_digest costs only 60 ns more, so use it because it is free rather than because you have seen the attack** ✅

**Why:** And reporting the failed reproduction honestly is a stronger interview answer than repeating the advice.

### 14. What is the right way to keep card numbers out of logs?

- A. A denylist of fields to redact
- B. Reviewing log lines in code review
- C. Turning off logging on payment endpoints
- **D. An allowlist of what may be logged, plus a test that asserts the PAN never appears** ✅

**Why:** A denylist only removes the fields somebody thought of. The test fails in the pull request that would leak.

### 15. What makes an audit log trustworthy against an insider?

- **A. The application not having permission to update or delete from it** ✅
- B. Encrypting it
- C. Writing it asynchronously
- D. Storing it in a separate table

**Why:** If a service can edit its own audit trail, it does not have one. A separate role with insert and select is ten minutes of work.
