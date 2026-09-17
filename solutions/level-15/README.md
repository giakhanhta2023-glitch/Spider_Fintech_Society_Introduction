# Level 15: Fraud detection with a stopwatch running

> **The fraud decision service** · build project · difficulty 9/10

## Read this second

Attempt the build yourself first, then ask the FinQuest tutor for a hint, and only then open this folder.
Read the part you are stuck on, close the file, and retype the fix from memory. Copying the solution into
your own project skips the only step that actually teaches you anything.

## The brief

The payments service from level 12 is going live with real members, and it needs a fraud decision on every transfer in under a hundred milliseconds. Build the service: features from counters, a model shipped as data, a policy that knows what a review costs, and the monitoring that tells you when it has stopped working.

**Scope:** Uses this level plus level 8 (the model and the cost thinking), level 12 (FastAPI, errors, request ids) and level 14 (PSI). scikit-learn for training only: the request path must not import it.

## Files here

| File | What it is |
|------|------------|
| `fraud/features.py` | one definition per feature, called by training and by serving |
| `fraud/train.py` | the only file that imports sklearn; writes model.json |
| `fraud/score.py` | dot product and sigmoid, no dependencies |
| `fraud/policy.py` | the three bands, the hard rules, and the queue capacity rule |
| `bench.py` | p50, p95, p99 and max over two thousand decisions |
| `quiz-key.md` | all 15 drill answers with explanations |

## Run it

```bash
pip install -r requirements.txt && python -m fraud.train && pytest -q && python bench.py
```

## Why the solution is shaped this way

- Training and serving call the same feature function. The equality test between the two vectors is the most valuable test in the suite, because skew produces a model that is fine, data that is fine, and predictions that are quietly wrong.
- The model ships as JSON coefficients with a version. A pickle executes whatever is inside it, cannot be diffed in review, and drags scikit-learn into the request path for about thirty times the scoring cost.
- Velocity is an interface. Tests run over a dictionary with no container, production swaps in Redis with one constructor argument, and the service never knows which it has.
- The policy names review capacity out loud. A threshold that sends more cases to the queue than the team can clear is a threshold that auto approves the backlog, and that decision should be made by a person rather than by a Tuesday.
- Every decision logs the feature vector, the score and the model version, because the question three weeks later is why this transaction was declined, and the honest answer without those three is that nobody knows.

## Where people get stuck

| Symptom | Cause |
|---------|-------|
| p50 fast, p99 terrible | It is waiting, not computing. Look for a pool, a cache miss falling through to a full scan, or a call without a timeout. |
| Great offline, useless live | Recompute the features offline for transactions already decided live and compare field by field. Skew names itself. |
| Velocity counts the current transaction | The window must end strictly before the event being scored, or the signal inflates in training and vanishes in production. |

## Self-checks the solution satisfies

- features() gives identical vectors when called from the training replay and from the live path, on a sample of 1,000 transactions
- No feature changes if a transaction dated after the one being scored is added to the history
- model.json scores a row within 1e-9 of the fitted scikit-learn model
- The request path imports neither sklearn nor pandas, asserted by inspecting sys.modules after a decision
- last_hour() matches a brute force count over replayed history, and buckets older than the window are gone
- A hard rule declines regardless of a low score
- A review band score is approved instead when the queue is over capacity, and the reason says so
- p99 over 2,000 decisions is under the budget in the README
- Shadow mode logs both decisions and never lets the candidate change the response
- PSI is under 0.01 against the baseline itself and over 0.25 when a feature is shifted deliberately
- With MODEL_MODE off the service still returns a decision, from rules alone

## How it is marked

| Points | Criterion | Meaning |
|--------|-----------|---------|
| 25 | Fast enough, and proved | A stated budget, a benchmark, and a test that fails when p99 exceeds it. |
| 20 | No skew | One feature implementation, a point in time test, and an equality test between the training and serving vectors. |
| 20 | A policy, not a threshold | Three bands with costs behind them, rules above the model, and queue capacity handled explicitly. |
| 20 | Operable | Shadow mode, drift monitoring, a kill switch with a tested fallback, and a decision log that can reconstruct any decision. |
| 15 | Shipped | Runs from a clean clone, tests pass, README has the budget table and the runbook. |

---

Part of [FinQuest](../../README.md) · Level 15 of 10
