# Level 8: Fraud detection and decision thresholds

## Read this second

Attempt the build yourself first, then ask the FinQuest tutor for a hint, and only then open this folder.
Read the part you are stuck on, close the file, and retype the fix from memory. Copying the solution into
your own project skips the only step that actually teaches you anything.

## The brief

A partner fintech is losing money to card fraud, and blocking far too many real customers while trying to stop it. Build the scoring engine, show what each setting actually costs, and recommend a threshold you would be happy to defend in a meeting.

**Scope:** Uses this level plus Level 3 (pandas) and Level 7 (evaluation thinking): feature engineering, a rule engine, sklearn LogisticRegression, train_test_split, StandardScaler, and the metrics shown in the tutorial.

## Files here

| File | What it is |
|------|------------|
| `fraud_engine.py` | features, rule engine, cost curve, model, queue, fairness check |
| `quiz-key.md` | all 15 drill answers with explanations |

## Run it

```bash
python fraud_engine.py
```

## Why the solution is shaped this way

- The do-nothing baseline (98.20% accuracy, zero fraud caught) prints **before** any model. Every later number is judged against it.
- Rules are a list of `(name, test, points)`. Adding one is a single line and the whole rulebook prints for an auditor.
- `score_row` returns the score **and** the reasons. A flag nobody can explain is a flag nobody can defend to a declined customer.
- The cost curve is the part that decides what ships. F1 picks threshold 7; at a $4 review cost the cheapest is 4, and at $20 it moves again. The cost assumptions *are* the model, which is why they are printed.
- The split is stratified and the scaler is fitted on training data only. Tuning a threshold on data the model trained on reports fiction.
- The fairness check is run, not mentioned. The foreign flag rate is far above the home rate, and the write-up says what would have to happen before that went near production.

## Where people get stuck

| Symptom | Cause |
|---------|-------|
| "My model is 98% accurate" | So is flagging nothing. Report precision and recall. |
| Precision and recall look swapped | `confusion_matrix(...).ravel()` returns `tn, fp, fn, tp`: in that order. |
| `amount` coefficient is ~0 | Unscaled features. Standardise before comparing coefficient magnitudes. |

## Self-checks the solution satisfies

- The dataset has 6,000 rows with 108 frauds: a base rate of 1.80%
- Do-nothing accuracy is 98.20% and appears in your output before any model
- Mean amount is about $31.85 for legitimate rows and $167.25 for fraud
- card_present is 61.1% of legitimate rows and 3.7% of fraud
- With the tutorial rule weights, threshold 6 gives 88 TP, 72 FP, precision 55.0%, recall 81.5%
- Threshold 7 gives 77 TP, 14 FP, precision 84.6%, recall 71.3%
- Threshold 9 gives precision 100% and recall 28.7%
- The cost curve at $4 review cost is cheapest at threshold 4 (about $2,068), with threshold 6 close at about $2,086
- Raising the review cost to $20 moves the cheapest threshold: report where it lands
- Test AUC is above 0.98 and your report notes why that is unrealistically high
- Every flagged row in the review queue carries a non-empty reasons string

## How it is marked

| Points | Criterion | Meaning |
|--------|-----------|---------|
| 20 | Honest evaluation | Baseline stated first, confusion matrix correct, precision and recall never confused. |
| 20 | Threshold economics | Cost model with stated assumptions, a full sweep, and a sensitivity run that changes the answer. |
| 15 | Feature work | All five engineered features present and justified by the comparison table. |
| 15 | Model discipline | Stratified split, scaler fitted on train only, class weighting, no leakage anywhere. |
| 15 | Explainability | Reasons on every flag, coefficients translated into English, a usable ranked queue. |
| 10 | Ethics | Fairness check performed and its implications discussed rather than waved away. |
| 5 | Shipped | Runs top to bottom and is committed to your portfolio repo. |

---

Part of [FinQuest](../../README.md) · Level 8 of 10
