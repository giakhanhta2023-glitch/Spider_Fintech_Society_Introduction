# Level 19: Ninety eight percent of your alerts are wrong: quiz answer key

> 15 questions. Pass mark is 12/15 (80%).
> Generated from `content/levels/` by `tools/build_quiz_keys.js`: do not edit by hand.

| # | Answer |
|---|--------|
| 1 | **A** |
| 2 | **A** |
| 3 | **D** |
| 4 | **C** |
| 5 | **B** |
| 6 | **C** |
| 7 | **D** |
| 8 | **B** |
| 9 | **C** |
| 10 | **C** |
| 11 | **B** |
| 12 | **D** |
| 13 | **B** |
| 14 | **A** |
| 15 | **A** |

---

### 1. What is the standard for sanctions screening, as opposed to transaction monitoring?

- **A. Prohibition: there is no acceptable threshold for a miss** ✅
- B. Suspicion, documented
- C. Materiality above a monetary limit
- D. Best effort within the alert budget

**Why:** A payment to a designated party is a breach regardless of size or intent, which is why recall dominates the threshold choice.

### 2. Normalising names before matching recovers which of the level's seven planted hits?

- **A. Five of the seven** ✅
- B. Two of the seven
- C. None: normalisation only affects speed
- D. All seven

**Why:** Case, titles and word order are all fixed by normalisation. The transliteration and the dropped letter need a similarity measure.

### 3. Exact matching on this data produces 5 alerts, all correct. Why is that not good enough?

- A. Exact matching is too slow at scale
- B. The queue is too small to justify the system
- C. Precision of 100% is statistically implausible
- **D. Two designated parties were paid** ✅

**Why:** Perfect precision and 71.4% recall is a failure on a prohibition. The two it missed are the two that matter.

### 4. Moving the fuzzy threshold from 0.95 down to 0.85 on this data:

- A. Halves the false positive rate
- B. Finds two more real hits
- **C. Finds no more real hits and raises the queue from 182 to 7,081** ✅
- D. Has no effect because the scores cluster near 1.0

**Why:** Thirty nine times the work for nothing. The useful band is narrow, and the sweep is what shows you where it is.

### 5. Raising the threshold from 0.95 to 0.97 on this data:

- A. Keeps all seven hits and cuts the queue
- **B. Loses the transliteration, which scored 0.9689** ✅
- C. Loses the dropped letter, which scored 0.9867
- D. Makes no difference to recall

**Why:** One of the seven sits just below 0.97. That single number is the argument against picking a threshold by instinct.

### 6. Your compliance lead wants high recall and high precision from name matching alone. The honest answer is:

- A. Train a model on past dispositions
- B. Lower the threshold and add a second pass
- **C. On name similarity alone that point does not exist: you need secondary identifiers** ✅
- D. Use a better algorithm

**Why:** Innocent names genuinely resemble listed names. More information moves both numbers; a threshold only trades one for the other.

### 7. A match scores 0.96 and the date of birth is missing on the watchlist. What should the system do?

- A. Block the payment automatically
- B. Discount it, since the identifier cannot be confirmed
- C. Lower the score by a fixed penalty
- **D. Alert, because absence of an identifier is not evidence of innocence** ✅

**Why:** Auto discount on disagreement, never on absence. The entities hardest to identify are the ones with the least data.

### 8. Why score distinct counterparty names rather than every payment?

- A. To avoid double counting alerts
- **B. 887 distinct names against 12,067 payments is a 93% saving, and the scores are identical** ✅
- C. Because payments can be duplicated
- D. Because pandas cannot join on strings

**Why:** Score once, join back. It also makes the threshold sweep fast enough to live in a test.

### 9. What is blocking, in the screening sense?

- A. Preventing an analyst from reopening a closed alert
- B. Refusing a payment
- **C. Comparing only names that share a key, so screening scales past a full cross product** ✅
- D. Freezing a customer account

**Why:** A shared first letter, phonetic key or token. The word is unfortunate, and it means something different from blocking a payment.

### 10. The structuring rule at two deposits gives 16 alerts and 4 real ones. At three deposits it gives 4 and 4. What should you record?

- A. Nothing: tuning is an operational detail
- B. The alert count, since precision is implied
- **C. Both settings, the date, the reason, who approved it, and a below the line sample of what three no longer catches** ✅
- D. Only the chosen setting, to keep the documentation short

**Why:** The alerts you stopped generating are invisible by construction, so a tuning change without a sample is indistinguishable from a bug.

### 11. The corridor rule alerts on 514 payments and finds nothing real. What does that tell you?

- A. The data is missing real cases
- **B. Geography alone is a poor rule, and it is the one most likely to be written first** ✅
- C. The jurisdiction list needs expanding
- D. The rule should run on a shorter window

**Why:** It costs an analyst a year of confirming that people send money to places. Geography belongs as a risk factor, not as a standalone rule.

### 12. Why does an alert need to store the rule version that produced it?

- A. Because rule versions are personal data
- B. To allow replaying the rule
- C. For database partitioning
- **D. So an alert from March can still be explained after April's tuning change** ✅

**Why:** Explaining old alerts under the thresholds in force at the time is most of what an examination consists of.

### 13. How should closing an alert be recorded?

- A. Move it to an archive table
- **B. Append an event with the actor, the action and the reason, leaving the history intact** ✅
- C. Update the alert row with the new status
- D. Delete the alert once it is dispositioned

**Why:** Level 13's rule, here as a legal requirement. Reopening has to be possible, and nothing is ever overwritten.

### 14. What is tipping off?

- **A. Telling a customer they are under suspicion or have been reported, which is an offence in many jurisdictions** ✅
- B. Filing a report without evidence
- C. Sharing a watchlist with another firm
- D. Escalating an alert to a senior analyst

**Why:** What a customer is told about a held payment is a legal question with a jurisdiction specific answer, not a template decision.

### 15. Which number belongs on the dashboard beside the alert count?

- **A. How long customers wait while their payments are held** ✅
- B. The size of the watchlist
- C. The number of rules in production
- D. The average similarity score

**Why:** A false positive is somebody's rent held for three days. If nobody measures the wait, nobody optimises it.
