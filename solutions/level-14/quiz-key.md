# Level 14: The scorecard a regulator can read: quiz answer key

> 15 questions. Pass mark is 12/15 (80%).
> Generated from `content/levels/` by `tools/build_quiz_keys.js`: do not edit by hand.

| # | Answer |
|---|--------|
| 1 | **B** |
| 2 | **C** |
| 3 | **B** |
| 4 | **D** |
| 5 | **A** |
| 6 | **C** |
| 7 | **D** |
| 8 | **A** |
| 9 | **B** |
| 10 | **B** |
| 11 | **C** |
| 12 | **B** |
| 13 | **D** |
| 14 | **B** |
| 15 | **A** |

---

### 1. Why do lenders still use a scorecard when a boosted tree scores better?

- A. Trees cannot handle missing values
- **B. Because a decline has to be explained, justified years later and validated before launch** ✅
- C. Because logistic regression is faster to train
- D. Because regulators ban machine learning

**Why:** The industry pattern is a scorecard for the decision and a stronger model where the explanation duty is lighter.

### 2. What does a weight of evidence of +1.10 for a bin mean?

- A. The bin contains 110% of the expected goods
- B. The bin is riskier than the book
- **C. The bin is safer than the book** ✅
- D. The variable is not useful

**Why:** WOE is ln(good share / bad share). Positive means the bin holds proportionally more goods than the book average.

### 3. A variable comes out with an information value of 0.9. What is the right response?

- A. Use it immediately, it is the best predictor you have
- **B. Check whether the value was knowable at the moment of the decision** ✅
- C. Drop it automatically
- D. Split it into more bins

**Why:** Above 0.5 is a prompt, not a verdict. Something like a count of collection calls scores enormously and is only high because the account was already going bad.

### 4. Why are bin edges learned on the training set and applied unchanged to the test set?

- A. To save computation
- B. Because pandas cannot recompute them
- C. Because the test set is smaller
- **D. Because refitting them on the test set leaks the answer into the validation** ✅

**Why:** Same rule as level 8. Anything learned from the test set makes the test result optimistic by an amount you cannot estimate.

### 5. A bin holds ninety applications out of eight thousand. What should you usually do?

- **A. Merge it with a neighbouring bin** ✅
- B. Keep it, because it has the strongest WOE
- C. Drop those applications
- D. Give it a WOE of zero

**Why:** A thin bin gives an unstable WOE that will swing at the next refit. Coarse classing trades separation for stability on purpose.

### 6. A twelve month performance window is shortened to six. What happens to the model?

- A. It becomes more accurate because the data is fresher
- B. Nothing, the ranking is unchanged
- **C. Borrowers who fail in months seven to twelve are labelled good, and the model learns to approve slow failures** ✅
- D. The bad rate rises

**Why:** The window should match the life of the product, not how quickly you would like to retrain.

### 7. What is the Gini coefficient of a model with AUC 0.771?

- A. 0.771
- B. 0.229
- C. 0.386
- **D. 0.542** ✅

**Why:** Gini is 2 x AUC - 1. The fifties are normal for an application scorecard; the nineties mean leakage until proven otherwise.

### 8. With PDO 20, what does twenty more points mean?

- **A. Half the odds of going bad** ✅
- B. Twice the probability of approval
- C. Twenty percent lower risk
- D. A one grade improvement

**Why:** Points to double the odds is the scale constant. It is what makes a score readable across an organisation without anybody quoting a log odds.

### 9. A coefficient comes out with the opposite sign to the one the WOE construction implies. What is it usually?

- A. Evidence of a genuine reversal in risk
- **B. Two correlated variables fighting** ✅
- C. A bug in scikit-learn
- D. Proof that the variable should be squared

**Why:** Credit teams will not ship a card that says more income raises your risk. Drop one of the pair rather than explaining it away.

### 10. What is a reason code?

- A. An internal error code for the underwriting system
- **B. The principal reasons for a decline, ranked by points lost** ✅
- C. The bin label with the strongest WOE
- D. A code identifying which model version scored the application

**Why:** With an additive card it is arithmetic: compare each variable against a reference and rank the gaps. Written in words the applicant can act on.

### 11. Removing age and postcode from the model means it cannot discriminate. True?

- A. True, the attributes are gone
- B. True, provided the data was anonymised
- **C. False: employer, school and shopping behaviour can reconstruct them, so the test is on outcomes** ✅
- D. False, but only for models with more than ten variables

**Why:** Compare approval rates and the bad rate among the approved, by group. A lower approval rate with a lower bad rate means that group is being held to a higher standard.

### 12. PSI on the score is 0.31 and the Gini is unchanged. What has happened?

- A. The model has stopped ranking risk
- **B. The population applying has shifted, so the policy built on the old distribution needs recalibrating** ✅
- C. The score has been miscalculated
- D. Nothing worth acting on

**Why:** A steady Gini says the ranking still works. The cut off was set to approve a share of a population that no longer exists.

### 13. Where should the cut off come from?

- A. The score that maximises accuracy
- B. The median score of the applicants
- C. Whatever the model author thinks is prudent
- **D. The value of an approved good account against the cost of an approved bad one** ✅

**Why:** With a ten percent bad rate, approving nobody is ninety percent accurate and earns nothing. Bring the band table and ask for the two figures.

### 14. Why is a missing value given its own bin rather than being filled with the mean?

- A. Because pandas cannot compute a mean with nulls
- **B. Because "we could not find out" is itself information about the applicant** ✅
- C. Because it keeps the bins equal in size
- D. Because regulators require it

**Why:** Missingness often carries as much signal as the value would have. Filling it with an average throws that away and quietly invents data.

### 15. What belongs in the model document that does not belong in the notebook?

- **A. The definitions, the card, the fairness numbers and the monitoring plan** ✅
- B. The training code
- C. The raw data
- D. The library versions

**Why:** A validator reads the document before the code, and it is what makes the model defensible in two years when you have left.
