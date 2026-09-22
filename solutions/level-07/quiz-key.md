# Level 7: The payments API other systems depend on: quiz answer key

> 15 questions. Pass mark is 12/15 (80%).
> Generated from `content/levels/` by `tools/build_quiz_keys.js`: do not edit by hand.

| # | Answer |
|---|--------|
| 1 | **A** |
| 2 | **C** |
| 3 | **A** |
| 4 | **C** |
| 5 | **B** |
| 6 | **A** |
| 7 | **B** |
| 8 | **A** |
| 9 | **C** |
| 10 | **D** |
| 11 | **B** |
| 12 | **C** |
| 13 | **D** |
| 14 | **B** |
| 15 | **D** |

---

### 1. Where does an idempotency key belong in an HTTP request?

- **A. In a header, because it describes the request rather than being data** ✅
- B. In the URL path
- C. In the JSON body, next to the amount
- D. In a cookie

**Why:** Data goes in the body, everything about the request goes in a header. The same rule puts the API key in a header.

### 2. A retry arrives with the same idempotency key and the same body. Your API should return:

- A. 201 and a second transfer
- B. 500, so the caller stops
- **C. 200 and the saved response from the first attempt** ✅
- D. 409, because the key was used

**Why:** Same key, same body is a retry. Return exactly what you returned the first time, down to the id and timestamp.

### 3. The same idempotency key arrives with a different body. That means:

- **A. The caller has a bug, and 409 tells them early** ✅
- B. The key expired
- C. The first request must be replaced
- D. Both should be processed

**Why:** Silently returning the old response hides their bug until the end of the month, when the records do not match.

### 4. Why store a fingerprint of the request body next to the key?

- A. To detect tampering in transit
- B. To allow the response to be regenerated
- **C. Because it is the only way to tell a retry from a different request sent under the same key** ✅
- D. To save space

**Why:** The key alone cannot distinguish the second case from the third.

### 5. An account has $5.00 and a transfer of $10,000 arrives. The right status is:

- A. 400, because the request was wrong
- **B. 422, with a stable code such as insufficient_funds** ✅
- C. 404, because the money is not there
- D. 500, because the transfer failed

**Why:** The request was well formed; the state refuses it. 500 would make well behaved callers retry forever.

### 6. Why does an error need a `code` field as well as a `message`?

- **A. Because a program can branch on a code and cannot branch on a sentence that may be reworded** ✅
- B. Because HTTP requires it
- C. For translation into other languages
- D. To keep responses small

**Why:** Codes are part of your contract. Messages are for the human reading the logs afterwards.

### 7. Your handwritten errors use `{"error": {...}}` and the framework's use `{"detail": ...}`. Why does that matter?

- A. The framework shape is faster to parse
- **B. Callers have to handle two shapes from one API and will get it wrong, so exception handlers should rewrite the framework errors into your shape** ✅
- C. It does not: both are JSON
- D. It only affects the generated docs

**Why:** One API, one error shape. This is exactly the kind of thing found by running your own service rather than reading about it.

### 8. Validation with pydantic happens:

- **A. Before your endpoint code runs, returning 422 with the field, the rule and the value sent** ✅
- B. Only when you call a validate() function
- C. In the database
- D. After your endpoint code runs

**Why:** Bad input never reaches your logic, and the caller gets every problem at once rather than one per round trip.

### 9. Why cap an amount field with a maximum as well as a minimum?

- A. Databases cannot store large integers
- B. To make the OpenAPI document smaller
- **C. Because a test script with one extra zero should be refused rather than executed** ✅
- D. Because HTTP limits number size

**Why:** Every amount field in a payments API has an upper bound that somebody chose deliberately.

### 10. Why store `sha256(api_key)` rather than the key?

- A. To support key rotation
- B. Hashes are faster to compare
- C. Because keys are too long to store
- **D. So a stolen copy of your key table contains no working keys, while you can still check every request** ✅

**Why:** You hash what arrives and compare hashes. The original is never needed again.

### 11. Measured on 400,000 rows, `offset 300000 limit 20` read 300,020 rows in 63 ms and a cursor read 20 rows in 1.4 ms. The structural problem with offset is:

- A. It cannot be used with an index
- **B. Cost grows with the page number, and inserts shift every later page** ✅
- C. It always returns rows in the wrong order
- D. It cannot express a page size

**Why:** A cursor costs the same on page 1 and page 10,000, and is anchored to a real row so it cannot drift.

### 12. How do you know whether there is another page, without a second count query?

- A. Run count(*) with the same filter
- B. Compare the page size to the table size
- **C. Ask for one more row than the page size, and drop it before answering** ✅
- D. Return has_more: true always

**Why:** One extra row answers the question exactly, at no meaningful cost.

### 13. What is the point of returning a request id on every response?

- A. It identifies the customer
- B. It is required by the HTTP specification
- C. It makes responses cacheable
- **D. A partner can quote it and you find the exact request in one search instead of an afternoon** ✅

**Why:** Log it on every line about that request, and accept an inbound one so an id survives across services.

### 14. Validation fails in 4.3 ms and anything touching the database takes 200 ms or more, while the SQL itself runs in under a millisecond. The time is going into:

- A. The web framework
- **B. Opening a new database connection per request: measured 202.7 ms median against 62.3 ms on a connection already open** ✅
- C. JSON parsing
- D. Writing the response

**Why:** A connection pool removes the handshake from every request. Optimising the query would have gained nothing.

### 15. What does FastAPI's TestClient give you?

- A. Automatic test generation from OpenAPI
- B. A mock database
- C. A load testing tool
- **D. It calls your application in the same process, so the whole suite runs in seconds with no server** ✅

**Why:** No ports, no startup, no flakiness. Every status code your API can return becomes a fast test.
