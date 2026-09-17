# Level 12: The payment API other people depend on: quiz answer key

> 15 questions. Pass mark is 12/15 (80%).
> Generated from `content/levels/` by `tools/build_quiz_keys.js`: do not edit by hand.

| # | Answer |
|---|--------|
| 1 | **A** |
| 2 | **B** |
| 3 | **D** |
| 4 | **B** |
| 5 | **C** |
| 6 | **B** |
| 7 | **C** |
| 8 | **A** |
| 9 | **B** |
| 10 | **C** |
| 11 | **B** |
| 12 | **D** |
| 13 | **C** |
| 14 | **A** |
| 15 | **B** |

---

### 1. A client sends the same idempotency key with a different request body. What should the API return?

- **A. 409, because the key was used for a different request** ✅
- B. 200 with the original transfer
- C. 201 and a second transfer
- D. 500, because the state is ambiguous

**Why:** Replaying the original hides a client bug that is quietly losing payments. 409 tells them on the second request instead of at month end.

### 2. Why store a hash of the request body next to the idempotency key?

- A. To compress the stored response
- **B. To detect a key reused for a different request** ✅
- C. To verify the client signature
- D. To index the table

**Why:** Without the fingerprint you cannot tell a retry from a mistake, so both look like a repeat and one of them is a bug you never see.

### 3. A transfer has insufficient funds. Which status code?

- A. 500
- B. 400
- C. 403
- **D. 422** ✅

**Why:** The request was well formed and understood; the values are unacceptable. 500 tells a well behaved client to retry forever against an account that will never have the money.

### 4. Why is a second reverse of the same transfer a 409 rather than a 400?

- A. Because 409 is the code for money errors
- **B. Because the request is well formed and the current state refuses it** ✅
- C. Because the client forgot a header
- D. Because reversal is always asynchronous

**Why:** 400 means fix your request; nothing is wrong with theirs. 409 says read the state, which is the information they actually need.

### 5. Why is the timestamp included inside the signed payload of a webhook?

- A. So the receiver can sort events
- B. To let the sender measure latency
- **C. So a captured request cannot be replayed later** ✅
- D. Because HMAC requires a nonce

**Why:** Signing it means an attacker cannot change it, and the receiver refuses anything older than a few minutes. Without it a valid message stays valid forever.

### 6. Why must a webhook signature be verified against the raw body?

- A. Because parsing is slow
- **B. Because the sender signed their exact bytes, and re-serialising produces different ones** ✅
- C. Because JSON cannot be hashed
- D. Because the body may not be JSON

**Why:** Key order, spacing and escaping all change the bytes without changing the meaning, and HMAC has no opinion about meaning.

### 7. What is wrong with comparing signatures using ==?

- A. It is case sensitive
- B. It cannot compare bytes to strings
- **C. It returns early, so how long it takes leaks how much matched** ✅
- D. It allocates memory

**Why:** That is a timing attack, and hmac.compare_digest takes the same time whatever the input. One function call.

### 8. Your webhook receiver processes an event and its acknowledgement is lost. You retry. What makes that safe?

- **A. The receiver handling the event id idempotently** ✅
- B. The sender waiting longer
- C. A larger timeout
- D. Signing the retry with a new secret

**Why:** Delivery over a network is at least once. Every event carries a stable id so the receiver can recognise one it has already handled.

### 9. A partner returns 400 to your webhook. Should you retry?

- A. Yes, ten times with backoff
- **B. No: their endpoint rejects it, and sending it again changes nothing** ✅
- C. Yes, immediately
- D. Only if the body was larger than 1MB

**Why:** Same rule as level 5 from the other side: retry what can change on its own. 4xx cannot, except 429, and the event belongs in the dead letter list.

### 10. Why keep only a hash of an API key in the database?

- A. To save space
- B. To allow key rotation
- **C. So a copy of the table is not a copy of your customers' credentials** ✅
- D. Because keys are too long to index

**Why:** You show the key once and store sha256 of it. Authentication still works, because you hash what arrives and compare.

### 11. Adding a new optional field to a JSON response is:

- A. A breaking change requiring a new version
- **B. Safe for existing clients** ✅
- C. Only safe if all clients are internal
- D. Impossible without a migration

**Why:** Clients ignore fields they do not know. Removing, renaming or changing the meaning of a field is what breaks them.

### 12. What does the /v1 in the path buy you?

- A. Faster routing
- B. Automatic documentation
- C. Rate limiting per version
- **D. Room to ship a new shape beside the old one instead of breaking callers** ✅

**Why:** One path segment on day one, a migration project if you add it later. It is the cheapest promise in API design.

### 13. Why validate amount_cents at the API edge when the ledger already refuses a bad amount?

- A. Because the ledger check is unreliable
- B. To avoid a database round trip
- **C. So the client gets a clear 422 naming the field, while the database keeps the absolute guarantee** ✅
- D. Because pydantic replaces database constraints

**Why:** Two different jobs: a good error message early, and a guarantee that holds for every writer. Neither replaces the other.

### 14. What is a request id for?

- **A. Tracing one report back to one request across your logs** ✅
- B. Idempotency
- C. Authenticating the caller
- D. Ordering webhook deliveries

**Why:** Generated per request, logged with everything, returned in the response. A partner quotes it and you find the request in one search.

### 15. Why test with TestClient instead of starting the server?

- A. Because TestClient tests different code
- **B. Because it calls the app in process, with no port to clash and fast enough to run on every save** ✅
- C. Because FastAPI cannot be started in tests
- D. Because it skips validation

**Why:** It exercises the same application object, including validation and handlers. A suite that needs a running server is a suite people stop running.
