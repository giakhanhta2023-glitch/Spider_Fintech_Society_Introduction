# Level 8: Fraud Detection & Decision Thresholds: quiz answer key

> 15 questions. Pass mark is 12/15 (80%).
> Generated from `content/levels/` by `tools/build_quiz_keys.js`: do not edit by hand.

| # | Answer |
|---|--------|
| 1 | **C** |
| 2 | **D** |
| 3 | **A** |
| 4 | **C** |
| 5 | **C** |
| 6 | **B** |
| 7 | **B** |
| 8 | **A** |
| 9 | **D** |
| 10 | **A** |
| 11 | **D** |
| 12 | **B** |
| 13 | **B** |
| 14 | **A** |
| 15 | **C** |

---

### 1. Fraud is 1.8% of transactions. A model that flags nothing achieves what accuracy?

- A. 50%
- B. 1.8%
- **C. 98.2%** ✅
- D. It cannot be calculated

**Why:** It is right on every legitimate transaction. That is why accuracy is meaningless under imbalance: it measures the base rate, not the model.

### 2. What does precision measure?

- A. How consistent the model is between runs
- B. The overall proportion of correct predictions
- C. The share of fraud that was caught
- **D. How often a flagged transaction really is fraud** ✅

**Why:** Precision is TP / (TP + FP): the quality of your flags. Recall is the other question: what share of all fraud you caught.

### 3. At threshold 3 the rule engine catches 106 of 108 frauds but raises 1,454 false alarms. What is wrong with shipping it?

- **A. Precision is 6.8%: over 93% of flagged customers are innocent and would be blocked** ✅
- B. Recall is too low
- C. Nothing, catching fraud is the goal
- D. The model is overfitting

**Why:** A false decline is a real customer whose card fails in public. Issuers consistently find false declines cost more in lost business than the fraud they prevent.

### 4. Which pair of numbers describes the fundamental trade-off in a detector?

- A. Base rate and sample size
- B. Accuracy and AUC
- **C. Precision and recall** ✅
- D. Training time and model size

**Why:** Raising the threshold improves precision and lowers recall; lowering it does the reverse. No threshold is good at both, so the choice is a business decision.

### 5. The F1-optimal threshold here is 7, but the cheapest threshold is 4. Why do they disagree?

- A. The cost model ignores recall
- B. A bug in the cost calculation
- **C. F1 treats false positives and false negatives as equally costly, and this business does not** ✅
- D. F1 is only valid for balanced data

**Why:** F1 is symmetric by construction. Once a missed fraud costs the transaction amount and a review costs $4, the optimum moves. The cost assumptions are the real model.

### 6. Which feature is typically the strongest signal in card fraud?

- A. The card issuer
- **B. Transaction velocity: how many transactions occurred in the last hour** ✅
- C. The merchant name
- D. The day of the week

**Why:** Stolen cards get tested and drained quickly: a small probe, then rapid larger purchases. Velocity requires keeping state, which is why weaker implementations omit it.

### 7. What does `class_weight="balanced"` do in scikit-learn?

- A. Balances precision and recall automatically
- **B. Weights the rare class up so the model cannot minimise error by ignoring it** ✅
- C. Normalises the feature scales
- D. Splits the data evenly into train and test

**Why:** With a 1.8% positive rate, predicting "legit" always is nearly optimal for plain error. Class weighting removes that shortcut.

### 8. Why use `stratify=y` in train_test_split?

- **A. To keep the same fraud rate in both halves so the test set is meaningful** ✅
- B. To shuffle the rows
- C. To remove duplicates
- D. To sort by target

**Why:** Without stratification a random split can leave very few frauds in the test set, making every metric computed on it pure noise.

### 9. What is data leakage?

- A. Missing values in the training set
- B. Losing rows when merging tables
- C. A security breach of customer data
- **D. Letting test information influence training or tuning, producing performance that will not hold up** ✅

**Why:** Tuning a threshold on data the model trained on reports fiction. Fit scalers on train only, and keep the test set untouched until the end.

### 10. `confusion_matrix(y_true, y_pred).ravel()` returns four numbers. In what order?

- **A. tn, fp, fn, tp** ✅
- B. fp, fn, tp, tn
- C. tp, tn, fp, fn
- D. tp, fp, fn, tn

**Why:** tn, fp, fn, tp: reading across the rows of the matrix. Assuming the wrong order silently inverts precision and recall.

### 11. Why is logistic regression the default first model in regulated financial services?

- A. It is the most accurate model available
- B. It handles imbalance automatically
- C. It needs no training data
- **D. Its coefficients are explainable, which regulators and customers both require** ✅

**Why:** Explainability is a legal requirement in credit and a practical one in fraud. A model you cannot explain is one you cannot defend when a customer disputes a decline.

### 12. Why standardise features before reading logistic regression coefficients?

- A. To make training faster
- **B. Because unscaled features give coefficients on wildly different scales that cannot be compared** ✅
- C. Because sklearn requires it
- D. To remove outliers

**Why:** With amount in the hundreds and is_night as 0/1, the amount coefficient looks tiny regardless of its importance. Standardising makes the magnitudes comparable.

### 13. A fraud model declines a far higher share of transactions from one nationality. What is the correct response?

- A. Remove all country data and ship
- **B. Investigate and fix it: disparate outcomes are a legal and ethical problem, and the data explanation is not a defence** ✅
- C. Raise the threshold for everyone
- D. Ship it: the model learned it from the data

**Why:** Fair-lending and consumer-protection law looks at outcomes. Check flag rates across groups before shipping, keep a human review route, and document the decision.

### 14. What does an AUC of 0.999 on this dataset tell you?

- **A. The data is synthetic and unusually separable. Real fraud models sit far lower** ✅
- B. AUC is being computed incorrectly
- C. The model is production-ready
- D. The model has memorised the test set

**Why:** Real card fraud models run around 0.85-0.95 against adversaries who adapt. Treat the workflow as realistic and the score as flattering, and say so in your report.

### 15. What is the most useful output of a fraud system for an operations team?

- A. A binary label on every transaction
- B. The model coefficients
- **C. A ranked review queue with the amount at stake and the reasons for each flag** ✅
- D. A single overall accuracy figure

**Why:** Humans work queues, not labels. Rank by risk, show the money involved, and attach the reasons so the reviewer can act in seconds rather than investigate from scratch.
