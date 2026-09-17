# Level 14: The scorecard a regulator can read

> **The application scorecard** · build project · difficulty 9/10

## Read this second

Attempt the build yourself first, then ask the FinQuest tutor for a hint, and only then open this folder.
Read the part you are stuck on, close the file, and retype the fix from memory. Copying the solution into
your own project skips the only step that actually teaches you anything.

## The brief

A credit union will lend to members and wants a scorecard they can put in front of their regulator. They need the card, the numbers behind it, the reasons an applicant is told when they are declined, and the plan for noticing when it stops working.

**Scope:** Uses this level plus level 6 (credit ratios and the five Cs), level 8 (splitting, thresholds, precision and recall) and level 3 (pandas). pandas, numpy and scikit-learn only: no boosting library, because the deliverable is a card rather than a score.

## Files here

| File | What it is |
|------|------------|
| `scorecard/binning.py` | woe_table, fit_binning, transform, and the unseen value counter |
| `scorecard/model.py` | fit, evaluate, scale_to_points, build_card |
| `scorecard/reasons.py` | reason codes in words, ranked by points lost |
| `scorecard/fairness.py` | approval rate and bad rate of the approved, by group |
| `MODEL.md` | the document a validator reads before the code |
| `quiz-key.md` | all 15 drill answers with explanations |

## Run it

```bash
pip install -r requirements.txt && python -m scorecard.build && pytest -q
```

## Why the solution is shaped this way

- Everything is learned on the training half: the bin edges, the WOE maps, the coefficients and the cut off. The test half is read once, at the end, which is the only way the reported Gini means anything.
- Thin bins are merged before fitting. A bin holding ninety of eight thousand applications gives a WOE that will swing at the next refit, and coarse classing exists to trade separation for stability.
- Age and region are dropped whatever their information value. One is protected in most jurisdictions and the other reconstructs it, and the fairness test is on outcomes rather than on which columns were fed in.
- The card is additive by construction, so a reason code is arithmetic: compare each variable against the best achievable bin and rank the gaps. That is what makes an adverse action notice possible at all.
- MODEL.md is a deliverable, not documentation of a deliverable. Definitions, the card, both Ginis, the fairness numbers and the PSI thresholds, because the model has to be defensible when its author has left.

## Where people get stuck

| Symptom | Cause |
|---------|-------|
| Gini above 0.9 on an application model | Something in the features was not knowable at decision time. Look for a variable that only exists because the account already went bad. |
| A coefficient with the wrong sign | Two correlated variables fighting. Drop one rather than shipping a card that says more income raises risk. |
| Infinite WOE | A bin with no bads or no goods. Merge it with a neighbour rather than adding a constant to hide it. |

## Self-checks the solution satisfies

- The book is 8,000 applications with a 9.99% bad rate
- The DTI table has five bins with bad rates rising from about 3.6% to about 24.5%, and IV near 0.609
- Prior defaults has IV near 0.340 and income near 0.304
- Age and region both come out under 0.01 and are excluded from the model
- Test AUC is about 0.77 and Gini about 0.54, with a train to test gap under 0.03
- Every coefficient in the final model has the sign the WOE construction implies
- factor is 28.854 and offset is 487.1 for PDO 20 at 600 points and 50 to 1 odds
- Summing the card points for any applicant reproduces the score from the model within a point
- The band table shows bad rates falling as the score rises, with no reversals
- reason_codes returns at most four reasons, all with a positive points gap, ordered largest first
- psi() returns near zero when a distribution is compared with itself

## How it is marked

| Points | Criterion | Meaning |
|--------|-----------|---------|
| 25 | Correct technique | WOE and IV computed right, bins fitted on train only, monotonic where it matters, thin bins merged. |
| 20 | An honest result | Both halves reported, the gap small, the Gini plausible, and the leakage question asked of the strongest variable. |
| 20 | A usable card | Points scaled with stated constants, printed per bin, and reproducing the model score when summed. |
| 20 | Decisions somebody can defend | Reason codes in words, a fairness comparison with numbers, and a cut off framed as a business decision rather than an accuracy maximum. |
| 15 | Documented | MODEL.md covers definitions, the card, performance, fairness and monitoring. A validator could read it without you. |

---

Part of [FinQuest](../../README.md) · Level 14 of 10
