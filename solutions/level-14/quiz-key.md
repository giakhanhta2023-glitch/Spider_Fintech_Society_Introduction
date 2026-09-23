# Level 14: The p99 you promised: quiz answer key

> 15 questions. Pass mark is 12/15 (80%).
> Generated from `content/levels/` by `tools/build_quiz_keys.js`: do not edit by hand.

| # | Answer |
|---|--------|
| 1 | **D** |
| 2 | **B** |
| 3 | **C** |
| 4 | **D** |
| 5 | **A** |
| 6 | **B** |
| 7 | **C** |
| 8 | **B** |
| 9 | **B** |
| 10 | **C** |
| 11 | **C** |
| 12 | **A** |
| 13 | **D** |
| 14 | **A** |
| 15 | **A** |

---

### 1. A page makes twenty API calls. Roughly how often does it hit at least one p99 request?

- A. About 50% of the time
- B. About 5% of the time
- C. About 1% of the time
- **D. About 18% of the time** ✅

**Why:** 1 - 0.99^20 = 0.182. A one-in-a-hundred event becomes one page load in five.

### 2. Latency is made of two things. Which pair?

- A. Network time and database time
- **B. Service time and queueing time** ✅
- C. CPU time and input output time
- D. Client time and server time

**Why:** You profile the first and your tail is usually made of the second.

### 3. Eight worker slots, 70 ms mean service time. What is the capacity?

- A. 8 requests per second
- B. 560 requests per second
- **C. 114 requests per second** ✅
- D. 70 requests per second

**Why:** 8 / 0.070 = 114. Little's law, and it is arithmetic rather than opinion.

### 4. Why does p99 explode near 95% utilisation when the work per request has not changed?

- A. The garbage collector runs more often
- B. The network saturates
- C. The code gets slower under load
- **D. Because queueing time grows without bound as utilisation approaches one, so requests spend most of their life waiting** ✅

**Why:** Which is why capacity planning leaves headroom instead of chasing efficiency.

### 5. At 35% utilisation the p99 was roughly the handler's slow path. What does that tell you?

- **A. That at low load the tail is your dependency's tail, not queueing, so the fix is to make the slow path faster rather than add capacity** ✅
- B. That you need a bigger cache
- C. The measurement is wrong
- D. That the load generator is closed loop

**Why:** Two kinds of tail, two different fixes. Telling them apart saves a quarter of wasted work.

### 6. An 80% cache hit ratio collapsed the median but barely moved the p99. Why?

- A. Because the hit ratio was measured wrong
- **B. Because the one request in five that misses still pays the full price, including the slow path** ✅
- C. The cache was too small
- D. Because Redis was slow

**Why:** A cache is a median and throughput instrument. It helps the tail only by removing load from the workers.

### 7. Which of these must never be cached?

- A. Merchant fee schedules
- B. Currency reference data
- **C. An idempotency key lookup** ✅
- D. Card network routing tables

**Why:** A stale read that authorises something is a double spend. The same rule as reading from a replica.

### 8. What is a cache stampede, and what stops it?

- A. Too many keys, fixed by a bigger cache
- **B. A hot key expires and every waiting request does the same expensive work at once, fixed by single flight and jittered expiry** ✅
- C. A slow network, fixed by pipelining
- D. Eviction, fixed by removing the time to live

**Why:** One request takes a short lock and fills the cache. Everybody else waits for it rather than repeating it.

### 9. In a token bucket, what does the bucket size control?

- A. How long a request waits
- **B. The size of the burst you tolerate** ✅
- C. The number of customers
- D. The sustained rate

**Why:** The refill rate sets the sustained rate; the bucket size sets how much can arrive at once.

### 10. Why key a rate limiter per customer rather than globally?

- A. It is faster
- B. It uses less memory
- **C. Because a global limit lets one heavy or misbehaving customer consume everybody else's allowance** ✅
- D. Because the standard requires it

**Why:** One bad integration should degrade one customer, not the platform.

### 11. Retrying on timeout at a service that is already at its limit does what?

- A. Reduces the load
- B. Improves the success rate at no cost
- **C. Adds load to the thing that is failing, which is why retries need backoff, jitter and a budget** ✅
- D. Has no effect

**Why:** And a retry without an idempotency key can also pay twice, which is level 12 again.

### 12. Your caller allows you 1 second. What timeout should you give a dependency?

- **A. Comfortably less than 1 second, leaving room for your own work** ✅
- B. Longer than 1 second, so you do not give up too early
- C. Exactly 1 second
- D. No timeout, and rely on the caller's

**Why:** Otherwise you hold a worker for a result nobody is waiting for any more.

### 13. What does a circuit breaker do when it is open?

- A. Routes to a replica
- B. Queues requests until the dependency recovers
- C. Retries faster
- **D. Fails immediately without calling the dependency, then lets one request through after a while to test it** ✅

**Why:** It converts a slow failure into a fast one and gives the dependency room to recover.

### 14. What is goodput?

- **A. Successful responses per second that arrived before the caller gave up** ✅
- B. Requests per second
- C. The p50 of successful requests
- D. Bytes per second

**Why:** A service returning 240 responses that everybody has stopped waiting for has a goodput of zero.

### 15. At twice capacity, shedding on queue depth more than doubled the successes and cut p99 from 2,972 ms to 461 ms. Why did refusing work produce more of it?

- **A. Because without shedding the machine spends most of its capacity finishing requests whose callers have already given up, and refusing those early leaves the whole machine for requests somebody is still waiting for** ✅
- B. Because the cache warmed up
- C. The workers went faster
- D. Because fewer requests arrived

**Why:** Measured: 2,492 responses arrived after the caller had gone. That work was capacity spent on nobody.
