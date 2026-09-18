# Level 15: Fraud detection with a stopwatch running: quiz answer key

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

### 1. Why is p99 latency the number that matters rather than the average?

- A. Because p99 is always lower than the mean
- B. Because averages are hard to compute in production
- **C. Because the one customer in a hundred waiting two seconds is standing at a till** ✅
- D. Because regulators require percentile reporting

**Why:** An average hides the tail, and the tail is the experience people complain about and abandon carts over.

### 2. Scoring a logistic regression at serving time is best done by:

- A. Calling predict_proba on a one row data frame
- B. Querying a model server over HTTP
- **C. A dot product and a sigmoid over a plain vector** ✅
- D. Re-fitting on recent data per request

**Why:** Measured on this course's model: about 0.10 ms through scikit-learn against about 0.003 ms as arithmetic. The overhead is data frame shaped and does not belong in a request path.

### 3. How is a one hour transaction count computed at decision time?

- A. A full table scan with an index hint
- **B. From counters kept in expiring buckets as transactions arrive** ✅
- C. By re-reading the training data
- D. A query over the transaction table filtered by customer

**Why:** Small writes on the way in beat a large read on the way out, and bucket expiry means no cleanup job.

### 4. What is training and serving skew?

- **A. A feature meaning something different in training than it does in production** ✅
- B. Latency differences between environments
- C. The gap between train and test accuracy
- D. The model drifting as the population changes

**Why:** The model is fine and every prediction is subtly wrong. One implementation of each feature, called by both paths, is the structural fix.

### 5. Why must a velocity feature exclude the transaction being scored?

- **A. Because including it uses information from the moment being predicted and inflates the training signal** ✅
- B. Because Redis cannot increment and read atomically
- C. Because the counter has not been written yet
- D. To save a millisecond

**Why:** Point in time correctness. The signal looks strong offline and vanishes live, which is the same trap as level 8 leakage.

### 6. Offline AUC is 0.97 and the live model catches almost nothing. What do you check first?

- A. Whether the database is slow
- B. Whether the threshold is too high
- **C. Whether the features computed live match the features computed in training** ✅
- D. Whether to add more trees

**Why:** Recompute the features offline for transactions already decided live and compare field by field. A difference names itself.

### 7. What does shadow mode tell you that an offline test cannot?

- A. The true fraud rate
- B. Whether the candidate would have caught fraud you approved
- C. The optimal threshold
- **D. How the candidate behaves on live traffic, including its latency and how much review volume it would create** ✅

**Why:** What it cannot tell you is the second option, because you approved those transactions and may never learn they were bad.

### 8. A review threshold sends 1.2% of traffic to a queue, and volume doubles. Which response is the one that happens by accident?

- A. Pausing the campaign
- **B. The backlog being auto approved because nobody decided** ✅
- C. Raising the threshold deliberately
- D. Hiring more reviewers

**Why:** And it is the worst, because the cases auto approved are the ones the model was least sure about. Raising the threshold on purpose, with the expected loss written down, is the honest move.

### 9. Why do rules sit on top of the model rather than being replaced by it?

- **A. Because some decisions are not statistical: a stolen card is declined whatever the score says** ✅
- B. Because regulators ban model only decisions
- C. Because models cannot read card status
- D. Because rules are more accurate

**Why:** The model orders the uncertain middle. Rules handle the certain ends, and the split is what makes both explainable.

### 10. Which monitoring signal is available immediately after a decision?

- A. Confirmed fraud losses
- B. Recall
- **C. Input drift on each feature** ✅
- D. Chargebacks

**Why:** The real label arrives weeks later through disputes, which is exactly why input and prediction drift are watched from the first minute.

### 11. Card present drops from 61% to 4% at 09:12 and holds. The first move is:

- A. Retrain on the new distribution
- **B. Treat it as a data incident and page the owner of that feed** ✅
- C. Lower the decline threshold
- D. Ignore it until chargebacks confirm harm

**Why:** A step change at a precise minute is upstream, not behavioural. Meanwhile the model is scoring nearly everything as card not present, and approvals are about to collapse.

### 12. What does a PSI of 0.31 on a feature mean?

- A. The feature has become more predictive
- **B. The distribution has moved far enough that the model was built on different traffic** ✅
- C. Thirty one percent of values are missing
- D. The model has a bug

**Why:** Under 0.10 stable, 0.10 to 0.25 watch, above 0.25 act. Same statistic as the scorecard monitoring in level 14.

### 13. Why ship a model as JSON coefficients rather than a pickled object?

- A. Because scikit-learn cannot be installed in production
- B. Because pickles cannot hold floats
- C. JSON is faster to parse
- **D. Because it is auditable, diffable, version stamped and cannot execute code** ✅

**Why:** Unpickling a file runs whatever is inside it, and a coefficient you cannot read in a diff is a coefficient nobody reviews.

### 14. What has to be defined before a kill switch is real?

- A. The name of the configuration key
- B. Who is allowed to flip it
- C. How fast it propagates
- **D. What the system does when the model is off** ✅

**Why:** Approving everything is a fraud decision and declining everything is a business decision. Decide in advance, write it in the runbook, and drill it.

### 15. Why log the feature vector, the score and the model version with every decision?

- **A. So a decision from three weeks ago can be reconstructed and explained** ✅
- B. To retrain on it later
- C. Because the regulator requires all logs to be kept
- D. For the metrics dashboard

**Why:** Somebody will ask why a transaction was declined. Without the inputs and the version, the honest answer is that you do not know.
