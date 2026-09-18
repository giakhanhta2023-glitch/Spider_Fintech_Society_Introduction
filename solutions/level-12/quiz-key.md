# Level 12: The payment API other people depend on: quiz answer key

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

### 1. A client sends the same idempotency key with a different request body. What should the API return?

- A. 500, because the state is ambiguous
- **B. 409, because the key was used for a different request** ✅
- C. 201 and a second transfer
- D. 200 with the original transfer

**Why:** Replaying the original hides a client bug that is quietly losing payments. 409 tells them on the second request instead of at month end.

### 2. Why store a hash of the request body next to the idempotency key?

- A. To index the table
- B. To compress the stored response
- **C. To detect a key reused for a different request** ✅
- D. To verify the client signature

**Why:** Without the fingerprint you cannot tell a retry from a mistake, so both look like a repeat and one of them is a bug you never see.

### 3. A transfer has insufficient funds. Which status code?

- **A. 422** ✅
- B. 400
- C. 403
- D. 500

**Why:** The request was well formed and understood; the values are unacceptable. 500 tells a well behaved client to retry forever against an account that will never have the money.

### 4. Why is a second reverse of the same transfer a 409 rather than a 400?

- A. Because the client forgot a header
- **B. Because the request is well formed and the current state refuses it** ✅
- C. Because 409 is the code for money errors
- D. Because reversal is always asynchronous

**Why:** 400 means fix your request; nothing is wrong with theirs. 409 says read the state, which is the information they actually need.

### 5. Why is the timestamp included inside the signed payload of a webhook?

- **A. So a captured request cannot be replayed later** ✅
- B. Because HMAC requires a nonce
- C. To let the sender measure latency
- D. So the receiver can sort events

**Why:** Signing it means an attacker cannot change it, and the receiver refuses anything older than a few minutes. Without it a valid message stays valid forever.

### 6. Why must a webhook signature be verified against the raw body?

- A. Because parsing is slow
- B. Because JSON cannot be hashed
- C. Because the body may not be JSON
- **D. Because the sender signed their exact bytes, and re-serialising produces different ones** ✅

**Why:** Key order, spacing and escaping all change the bytes without changing the meaning, and HMAC has no opinion about meaning.

### 7. What is wrong with comparing signatures using ==?

- A. It cannot compare bytes to strings
- B. It allocates memory
- **C. It returns early, so how long it takes leaks how much matched** ✅
- D. It is case sensitive

**Why:** That is a timing attack, and hmac.compare_digest takes the same time whatever the input. One function call.

### 8. Your webhook receiver processes an event and its acknowledgement is lost. You retry. What makes that safe?

- A. Signing the retry with a new secret
- B. A larger timeout
- C. The sender waiting longer
- **D. The receiver handling the event id idempotently** ✅

**Why:** Delivery over a network is at least once. Every event carries a stable id so the receiver can recognise one it has already handled.

### 9. A partner returns 400 to your webhook. Should you retry?

- A. Yes, ten times with backoff
- **B. No: their endpoint rejects it, and sending it again changes nothing** ✅
- C. Only if the body was larger than 1MB
- D. Yes, immediately

**Why:** Same rule as level 5 from the other side: retry what can change on its own. 4xx cannot, except 429, and the event belongs in the dead letter list.

### 10. Why keep only a hash of an API key in the database?

- **A. So a copy of the table is not a copy of your customers' credentials** ✅
- B. Because keys are too long to index
- C. To allow key rotation
- D. To save space

**Why:** You show the key once and store sha256 of it. Authentication still works, because you hash what arrives and compare.

### 11. Adding a new optional field to a JSON response is:

- A. Only safe if all clients are internal
- B. A breaking change requiring a new version
- C. Impossible without a migration
- **D. Safe for existing clients** ✅

**Why:** Clients ignore fields they do not know. Removing, renaming or changing the meaning of a field is what breaks them.

### 12. What does the /v1 in the path buy you?

- A. Rate limiting per version
- B. Faster routing
- **C. Room to ship a new shape beside the old one instead of breaking callers** ✅
- D. Automatic documentation

**Why:** One path segment on day one, a migration project if you add it later. It is the cheapest promise in API design.

### 13. Why validate amount_cents at the API edge when the ledger already refuses a bad amount?

- A. To avoid a database round trip
- **B. So the client gets a clear 422 naming the field, while the database keeps the absolute guarantee** ✅
- C. Because pydantic replaces database constraints
- D. Because the ledger check is unreliable

**Why:** Two different jobs: a good error message early, and a guarantee that holds for every writer. Neither replaces the other.

### 14. What is a request id for?

- A. Authenticating the caller
- B. Ordering webhook deliveries
- **C. Tracing one report back to one request across your logs** ✅
- D. Idempotency

**Why:** Generated per request, logged with everything, returned in the response. A partner quotes it and you find the request in one search.

### 15. Why test with TestClient instead of starting the server?

- **A. Because it calls the app in process, with no port to clash and fast enough to run on every save** ✅
- B. Because it skips validation
- C. Because FastAPI cannot be started in tests
- D. Because TestClient tests different code

**Why:** It exercises the same application object, including validation and handlers. A suite that needs a running server is a suite people stop running.
