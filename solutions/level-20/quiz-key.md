# Level 20: The mean was 45 milliseconds and the service was down: quiz answer key

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

### 1. Why does a production image use a second build stage?

- **A. So compilers, headers and test dependencies never ship to production** ✅
- B. Because Docker requires it for health checks
- C. To make the build faster
- D. To allow multiple architectures

**Why:** Smaller image, smaller attack surface, fewer findings in a scan, and a faster pull when you need to roll back.

### 2. Pinning a base image by digest rather than by tag means:

- A. The image downloads faster
- B. The image works on any architecture
- **C. Today's build is tomorrow's build, because a digest cannot move** ✅
- D. Security patches apply automatically

**Why:** Tags get republished. A digest is the content, so reproducing a build a month later gives the same bytes.

### 3. What belongs in a CI pipeline that most repositories leave out?

- A. Building the image
- **B. Applying the migration and then rolling it back** ✅
- C. Unit tests
- D. A linter

**Why:** You find out whether a migration can be reversed at the moment you least want to be finding out.

### 4. A test fails one run in twenty. Why is that worse than a test that always fails?

- A. It cannot be reproduced locally
- B. It uses more CI minutes
- **C. It teaches everybody to re-run rather than to look, so the real failure gets through** ✅
- D. It inflates the coverage number

**Why:** A red build has to mean something is broken, or the signal is gone.

### 5. During a rolling deploy, what is true about the code running against your database?

- A. Neither, because traffic is drained first
- **B. Both versions at once, for a few minutes** ✅
- C. Only the new version, after a brief pause
- D. Only the old version, until the deploy completes

**Why:** That is why schema changes expand and contract, and why the old code against the new schema deserves a test.

### 6. What does setting lock_timeout on a migration achieve?

- A. It prevents the migration from being rolled back
- B. It makes the migration run faster
- **C. A blocked migration fails in seconds instead of queueing every query behind it** ✅
- D. It blocks other queries for a fixed period

**Why:** The outage is rarely the migration itself, it is the thousand queries waiting behind the lock it took.

### 7. Which signal answers "what happened to this one request"?

- A. Traces
- **B. Logs** ✅
- C. Alerts
- D. Metrics

**Why:** Metrics tell you how the system is doing, traces where the time went, logs what happened to a specific request.

### 8. Why must a customer id never be a metric label?

- A. It is personal data under GDPR
- B. Labels must be numeric
- C. Prometheus rejects string labels
- **D. Metrics are stored per unique label combination, so cardinality explodes and so does the bill** ✅

**Why:** One high cardinality label turns a thousand series into ten million. The customer id belongs in the log line.

### 9. The load test has a mean of 44.7 ms over the whole run. What does that number describe?

- A. Typical performance under load
- B. The performance a customer experiences
- C. The p50, closely enough
- **D. No actual minute of the run: steady state was 31.2 ms and the bad minute was 152.7 ms** ✅

**Why:** Averages are pulled towards the common case, and the common case stayed fast while a minute of requests failed.

### 10. In the shipped run, what share of requests in the bad minute exceeded 300 ms?

- **A. 11.38%** ✅
- B. 0.00%
- C. 1.27%
- D. 9.82%

**Why:** Against 0.00% in steady state and 1.27% across the whole run. The window you pick decides the story you tell.

### 11. Can you average the p99 of each minute to get the p99 of the hour?

- A. Yes, that is what a histogram does
- B. Only for latencies under a second
- C. Yes, if the minutes have equal traffic
- **D. No: percentiles do not average, which is why histograms store buckets** ✅

**Why:** Buckets can be summed and the percentile recomputed. Percentile values cannot be combined arithmetically.

### 12. At 100 requests a second, how many failures does a 99.9% availability objective allow over 30 days?

- **A. 259,200** ✅
- B. 25,920
- C. 43,200
- D. 2,592,000

**Why:** 259,200,000 requests in the window, one thousandth of them. The same objective is 43.2 minutes as a time budget.

### 13. The bad minute produced 589 failures. What share of the monthly error budget is that?

- A. 9.82%
- **B. 0.23%** ✅
- C. 2.3%
- D. 23%

**Why:** Small, and the point of computing it: it stops both the panic and the shrug. Twice a day and the budget is gone.

### 14. Your service has used none of its error budget in four months. The healthy response is:

- **A. Raise the objective, or spend the budget deliberately on shipping faster and running drills** ✅
- B. Publish it as a reliability achievement
- C. Nothing: an unused budget is the goal
- D. Lower the objective to leave more room

**Why:** An untouched budget means the objective is below what the system delivers, and the margin was paid for somewhere.

### 15. At 100 rps with one 400 byte log line per request, roughly how much log volume does a month produce?

- A. About 1 TB
- B. About 1 GB
- **C. About 104 GB** ✅
- D. About 10 GB

**Why:** 259,200,000 x 400 bytes. At common ingest prices that costs more than the servers, which is why sampling exists.
