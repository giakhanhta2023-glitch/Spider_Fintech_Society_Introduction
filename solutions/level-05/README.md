# Level 5 — Market Data & APIs

> **Multi-Currency Portfolio Valuation Service** · build project · difficulty 5/10

## Read this second

Attempt the build yourself first, then ask the FinQuest tutor for a hint, and only then open this folder.
Read the part you are stuck on, close the file, and retype the fix from memory. Copying the solution into
your own project skips the only step that actually teaches you anything.

## The brief

Society members hold cash in four currencies and a little crypto, and nobody can say what the treasury is worth. Build the valuation service — and make it keep working on the conference wifi that blocks half the internet.

**Scope:** Uses this level plus Level 3 (pandas) and Level 2 (formatting): requests with timeout, retries, JSON, file caching, try/except, and a DataFrame for the output. No API key is required anywhere.

## Files here

| File | What it is |
|------|------------|
| `fx_portfolio.py` | retrying client, disk cache, snapshot fallback, valuation report |
| `quiz-key.md` | all 15 drill answers with explanations |

## Run it

```bash
python fx_portfolio.py    (add --offline to force the snapshot path)
```

## Why the solution is shaped this way

- Three layers, tried in order: fresh cache, live call with backoff, bundled snapshot. The function never raises — there is always an answer, and it always says where the answer came from.
- Every `requests.get` passes `timeout=`. Without one, a server that accepts a connection and never replies blocks forever.
- `convert` adds `table[base] = 1.0` before looking anything up, so one code path handles base→x, x→base, x→y and x→x.
- The live ECB feed quotes 29 currencies and **VND is not one of them**. Rather than dropping that holding, the solution falls back to the snapshot for that single currency and labels the row. Mixed provenance, stated openly, is how real treasury reports work.
- Weights are stored at full precision and rounded only for display — rounding each one first makes the column sum to 1.000001.

## Where people get stuck

| Symptom | Cause |
|---------|-------|
| The script hangs | A missing `timeout=`. |
| `KeyError: "USD"` | The API omits the base currency from its rates map. Add it as 1.0. |
| Converted amounts wildly wrong | Multiplied where you should divide. Sanity-check against a pair you know. |

## Self-checks the solution satisfies

- fetch_json against a 404 URL raises RuntimeError after its retries rather than hanging
- Every requests.get call in your file passes a timeout — grep your own code to confirm
- get_rates returns source "live" first, then "cache" on an immediate second call
- With the live URL broken, get_rates returns the snapshot and source says STALE
- convert(100, "USD", "USD", rates) == 100 exactly
- convert(250, "EUR", "USD", rates) is about 274 with snapshot rates (250 / 0.9123)
- convert(250, "EUR", "GBP", rates) is about 210.6 with snapshot rates
- convert(10, "USD", "VND", rates) is about 254,800 with snapshot rates
- convert(5, "USD", "XXX", rates) raises a handled error with a readable message
- With live rates (which omit VND) the VND holding is still valued, its row says source = snapshot, and the total does not silently lose it
- Portfolio weights sum to 1.0 to six decimal places
- Killing your network mid-run still produces a full report, labelled stale

## How it is marked

| Points | Criterion | Meaning |
|--------|-----------|---------|
| 25 | Resilience | Cache, retry, and snapshot all demonstrably work; no path can hang or crash the report. |
| 20 | Correct conversion | All four conversion directions right, including cross rates and the base-currency case. |
| 20 | Honest presentation | Source and as-of date always shown, per row where sources differ; stale data is labelled as stale. |
| 15 | Error handling | Unknown currencies, dead endpoints, and crypto failures produce clear messages, not tracebacks. |
| 10 | Secret hygiene | No keys anywhere; if you add a keyed API, it reads from the environment. |
| 10 | Shipped | Runs top to bottom in a fresh session and is committed to your portfolio repo. |

---

Part of [FinQuest](../../README.md) · Level 5 of 10
