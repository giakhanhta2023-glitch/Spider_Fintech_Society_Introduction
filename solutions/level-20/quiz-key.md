# Level 20: The whiteboard, and the thing you hand over: quiz answer key

> 15 questions. Pass mark is 12/15 (80%).
> Generated from `content/levels/` by `tools/build_quiz_keys.js`: do not edit by hand.

| # | Answer |
|---|--------|
| 1 | **A** |
| 2 | **C** |
| 3 | **B** |
| 4 | **C** |
| 5 | **B** |
| 6 | **C** |
| 7 | **B** |
| 8 | **D** |
| 9 | **D** |
| 10 | **A** |
| 11 | **D** |
| 12 | **A** |
| 13 | **B** |
| 14 | **A** |
| 15 | **C** |

---

### 1. What is the most common way to lose a system design round in the first five minutes?

- **A. Drawing boxes immediately instead of asking what the system must do and must never do** ✅
- B. Choosing the wrong database
- C. Getting the arithmetic wrong
- D. Talking too much about failure

**Why:** The prompt is vague on purpose. The first thing being assessed is whether you ask.

### 2. 50 payments a second on average. How many a month, roughly?

- A. 4.3 million
- B. 1.3 billion
- **C. 130 million** ✅
- D. 13 million

**Why:** 50 x 86,400 = 4.32 million a day, times 30. Round numbers said aloud beat a calculator.

### 3. 130 million payments a month at about 1.5 kB each. What does that tell you?

- A. That storage will dominate the cost
- **B. About 195 GB a month and 2.3 TB a year, which fits on one Postgres, so this is not a sharding problem** ✅
- C. That you need a NoSQL store
- D. That you need to shard immediately

**Why:** Doing the arithmetic stops you solving a problem the question does not have.

### 4. Reads outnumber writes about ten to one in a payments system. What follows?

- A. You should denormalise everything
- B. Write throughput is the constraint
- **C. Replicas and caching matter more than write scaling, with the level 13 rule about which reads may go to a replica** ✅
- D. The database should be NoSQL

**Why:** And anything deciding money still reads from the primary.

### 5. Why put the data model on the board before the boxes?

- A. To avoid discussing services
- **B. Because it forces uniqueness, immutability, states and query patterns into the open, and almost no candidate does it** ✅
- C. It is faster to draw
- D. Because interviewers ask for it

**Why:** The unique constraint is your idempotency answer and the append only table is your audit answer, before anybody asks.

### 6. What is the trap when designing a ledger?

- A. Partitioning by time
- B. Using double entry
- **C. A mutable balance column, which loses the history and races under concurrency** ✅
- D. Storing amounts in minor units

**Why:** Balances are a projection of entries, which is levels 4 and 8 in one sentence.

### 7. What is the trap when designing card authorisation?

- A. Using a state machine
- **B. A synchronous fraud check with no timeout, which turns a slow model into declined payments** ✅
- C. Failing closed
- D. Caching the limits

**Why:** Every outbound call gets a timeout shorter than your caller's, and failing open or closed is a business decision.

### 8. Where do velocity counters belong, and why?

- A. In Postgres, for durability
- B. In the application's memory
- C. In the event log
- **D. In Redis with sliding windows, because a counter in Postgres becomes your hottest row** ✅

**Why:** And the rules live in configuration, run in shadow mode first, and only then enforce.

### 9. The interviewer asks what happens if the bank never answers. Your answer comes from which level?

- A. Level 7: idempotency keys
- B. Level 16: alerting
- C. Level 13: partitioning
- **D. Level 12: an explicit unknown state, a sweeper, and never retrying or compensating blindly** ✅

**Why:** Retrying pays twice and compensating cancels a real payment. Uncertainty needs its own mechanism.

### 10. What improves nearly any trade-off answer?

- **A. Saying "it depends on..." and naming the specific thing it depends on** ✅
- B. Listing both options neutrally
- C. Saying "it depends"
- D. Choosing the more scalable option

**Why:** "It depends on whether the payer is waiting" is an answer. "It depends" is not.

### 11. Should a ledger go in a relational database?

- A. Only for small volumes
- B. It makes no difference
- C. No, because it will not scale
- **D. Yes, because the invariant that debits equal credits is a constraint you want enforced, and the storage arithmetic says one machine is enough** ✅

**Why:** Giving up constraints to gain write throughput you do not need is the wrong trade, and saying so plainly is a better answer than listing both.

### 12. What single result is the strongest evidence that a multi service platform is correct?

- **A. A daily reconciliation across every service that comes out at zero, including after injected failures** ✅
- B. A clean architecture diagram
- C. All tests passing
- D. A load test meeting its objective

**Why:** It is the one check that requires every piece to agree with every other piece.

### 13. What should the first three lines of your capstone README contain?

- A. The technology list
- **B. The architecture diagram, one sentence on what it does, and five measured results** ✅
- C. Installation instructions
- D. Your motivation for building it

**Why:** A hiring manager gives it about ninety seconds. Build for that honestly.

### 14. Which CV line is stronger?

- **A. "Reduced inconsistent payouts from 13.0% to 0% with a saga and a recovery sweeper"** ✅
- B. "Built a payments API with FastAPI and Postgres"
- C. "Experienced with Docker, Kubernetes and CI/CD"
- D. "Familiar with distributed systems and event driven architecture"

**Why:** Lead with what you measured, not what you used. The others are sentences about tools.

### 15. What is the rule about numbers in your package?

- A. Cite the tool that produced them
- B. Round them for readability
- **C. Every one must be reproducible on the spot, because a single number you cannot defend undoes all the others** ✅
- D. Include only the impressive ones

**Why:** If you cannot rerun it in front of them, take it out.
