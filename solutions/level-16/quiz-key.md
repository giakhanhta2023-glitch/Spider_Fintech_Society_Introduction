# Level 16: The pager, and what it is allowed to wake you for: quiz answer key

> 15 questions. Pass mark is 12/15 (80%).
> Generated from `content/levels/` by `tools/build_quiz_keys.js`: do not edit by hand.

| # | Answer |
|---|--------|
| 1 | **B** |
| 2 | **C** |
| 3 | **A** |
| 4 | **D** |
| 5 | **D** |
| 6 | **B** |
| 7 | **C** |
| 8 | **C** |
| 9 | **A** |
| 10 | **B** |
| 11 | **C** |
| 12 | **D** |
| 13 | **A** |
| 14 | **A** |
| 15 | **B** |

---

### 1. Which signal answers "how many payments failed in the last hour"?

- A. A profile
- **B. A metric** ✅
- C. A trace
- D. A log

**Why:** Metrics tell you something is wrong, traces tell you where, logs tell you why.

### 2. Adding merchant_id with 500 values took a counter from 400 series to 200,000. What broke first?

- A. Disk on the metrics server
- B. The dashboard
- **C. The scrape, which went from 13.1 ms to 8,025.9 ms while Prometheus polls every 15 seconds** ✅
- D. Memory, at 243.6 MB

**Why:** Eight seconds of your own CPU, in your own process, every fifteen seconds. Monitoring became the outage.

### 3. Which of these must never be a metric label?

- **A. payment_id** ✅
- B. Endpoint
- C. HTTP status
- D. Region

**Why:** An unbounded value creates a series per value, forever, and the series outlive the traffic.

### 4. Ten instances, one unhealthy. True p99 393.4 ms, average of instance p99s 361.6 ms, max 906.2 ms. What is wrong with the average?

- A. It is too high
- B. It should be a median instead
- C. Nothing, it is a reasonable approximation
- **D. It is not a percentile of anything, and it hides the sick instance that is serving one customer in ten at 906 ms** ✅

**Why:** Aggregate the histogram buckets first, and also graph the maximum across instances.

### 5. How do you compute a correct p99 across instances in Prometheus?

- A. avg of each instance's p99
- B. max of each instance's p99
- C. The p99 of the p99s
- **D. histogram_quantile over the summed bucket rates** ✅

**Why:** Sum the buckets across instances, then take the quantile of the sum. That produced the true 393.4 ms.

### 6. With default buckets the dashboard reported a p99 of 450.1 ms when the real value was 301.5 ms. Why?

- A. The metric was scraped too rarely
- **B. The 99th percentile fell in a bucket spanning 250 ms to 500 ms, so the interpolation across that gap was a guess** ✅
- C. The histogram lost data
- D. The clock was wrong

**Why:** A 49.3% error, entirely from the bucket edges. Tuned buckets brought it to 1.6%.

### 7. What is the most common failure when adding tracing to an existing system?

- A. Clock skew
- B. Sampling too little
- **C. Missed context propagation on one hop, usually a queue, which breaks the trace in half** ✅
- D. Too many spans

**Why:** Across a queue, the context has to travel in the message rather than in a header.

### 8. Why is head sampling a poor choice for a payments service?

- A. It is more expensive
- B. It breaks context propagation
- **C. It decides before the request runs, so at 1% sampling you keep 1% of your incidents** ✅
- D. It requires more infrastructure

**Why:** Tail sampling keeps everything slow or failed and one in a hundred of the rest.

### 9. A 99.9% objective over thirty days is how much failure?

- **A. 43 minutes 12 seconds** ✅
- B. 21 minutes 36 seconds
- C. 4 minutes 19 seconds
- D. 7 hours 12 minutes

**Why:** And 99.99% is 4 minutes 19 seconds, which is shorter than one bad deploy.

### 10. What is an error budget actually for?

- A. Calculating SLA refunds
- **B. A rule agreed in advance: budget remaining means ship, budget exhausted means stop feature work and fix stability** ✅
- C. Reporting to management
- D. Deciding when to page

**Why:** It ends the argument between shipping and stability, because both sides already agreed the number.

### 11. Over a simulated month, the threshold alert paged 4 times and the burn rate alert paged twice. What was the real difference?

- A. The burn rate alert was slower on everything
- B. The burn rate alert missed an incident
- **C. Both caught both incidents, but two of the threshold pages were harmless blips and the burn rate alert had none** ✅
- D. The threshold alert used less CPU

**Why:** A pager that is wrong half the time is a pager people learn to ignore.

### 12. The burn rate alert detected the 35% incident in 2 minutes and the 8% one in 10. Why is that useful?

- A. Because it uses a shorter window
- B. It is a coincidence of the simulation
- C. Because 35% is above the threshold
- **D. Because severity scaling comes free: the worse the incident, the faster the budget burns, so the alert arrives sooner with no extra configuration** ✅

**Why:** One rule, and it behaves like two severities you never had to write.

### 13. Why does a burn rate alert need a short confirming window as well as a long one?

- **A. So the alert stops firing when the incident ends, rather than an hour later** ✅
- B. To detect faster
- C. To smooth the data
- D. To reduce false positives at the start

**Why:** Otherwise somebody turns it off during the next incident, having learned it lies.

### 14. Which of these should page somebody at three in the morning?

- **A. Payment success rate below the objective** ✅
- B. CPU above 80%
- C. An instance restarting
- D. Disk at 85%

**Why:** Page for symptoms the customer feels. Causes become dashboard panels and tickets.

### 15. What makes a postmortem blameless in a technical sense?

- A. Only writing about the system
- **B. Assuming everyone acted reasonably given what they knew, and asking what made the wrong action look right** ✅
- C. Having a manager approve it
- D. Not naming anybody

**Why:** "Ran the wrong migration" is not a finding. "The tool defaults to production" is, and it has a fix.
