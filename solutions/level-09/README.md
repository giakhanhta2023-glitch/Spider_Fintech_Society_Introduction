# Level 9: Shipping a fintech service

## Read this second

Attempt the build yourself first, then ask the FinQuest tutor for a hint, and only then open this folder.
Read the part you are stuck on, close the file, and retype the fix from memory. Copying the solution into
your own project skips the only step that actually teaches you anything.

## The brief

Everything you built in levels 2 and 6 is sitting in notebooks nobody else can run. Time to ship it: a loan advisor a member can open on their phone, with your name on it.

**Scope:** Uses this level plus levels 2, 6, and 3: the amortization engine you already wrote, pandas for tables, Streamlit for the interface, pytest for the tests. Nothing beyond that is required.

## Files here

| File | What it is |
|------|------------|
| `finance.py` | pure loan maths: imports no UI, prints nothing |
| `app.py` | the Streamlit interface: contains no formulas |
| `test_finance.py` | 22 tests, no browser required |
| `requirements.txt` | pinned dependencies for deployment |
| `quiz-key.md` | all 15 drill answers with explanations |

## Run it

```bash
pip install -r requirements.txt && pytest -q && streamlit run app.py
```

## Why the solution is shaped this way

- The separation is the lesson. `finance.py` imports no UI library, so it can be tested in milliseconds, reused behind an API, and read by someone who has never seen Streamlit.
- Every public function raises `ValueError` with a sentence a user could read. `app.py` catches those and turns them into `st.error(...)` followed by `st.stop()`: no traceback ever reaches the page.
- Validation lives in the functions, not only in the widget limits. `min_value` is a property of one interface; the engine has to defend itself wherever it is called from.
- `@st.cache_data` wraps the schedule builder because Streamlit re-runs the entire script on every slider move, and a 40-year schedule is 480 rows each time.
- Nine of the 22 tests assert refusals. Testing that validation fires matters as much as testing the happy path.

## Where people get stuck

| Symptom | Cause |
|---------|-------|
| `streamlit: command not found` | The virtual environment is not active. The prompt should show `(.venv)`. |
| Works locally, fails when deployed | Almost always `requirements.txt`. Read the build log: it names the package. |
| The app is slow | Uncached work re-running on every interaction. |

## Self-checks the solution satisfies

- monthly_payment(250000, 0.055, 30) == 1419.47 to 2dp
- monthly_payment(12000, 0.0, 4) == 250.00 exactly
- monthly_payment(-1000, 0.05, 10) raises ValueError
- monthly_payment(1000, 0.05, 0) raises ValueError
- schedule(20000, 0.07, 5) has 60 rows and a final balance of 0.0
- schedule(20000, 0.07, 5, extra=100) has fewer than 60 rows
- schedule(..., extra=-50) raises ValueError
- grep finance.py for "streamlit" returns nothing
- pytest -q passes with at least 8 tests
- The deployed URL loads and responds to slider changes
- Entering a zero loan amount shows a friendly error, not a traceback

## How it is marked

| Points | Criterion | Meaning |
|--------|-----------|---------|
| 25 | It is live | A public URL a stranger can open and use on a phone. |
| 20 | Separation | finance.py is pure and importable with no UI dependency; app.py holds no maths. |
| 20 | Tests | At least 8 meaningful tests including refusals; all passing. |
| 15 | Robustness | No input combination produces a traceback; every error is a sentence. |
| 10 | Usefulness | Metrics, chart, schedule, download and affordability all present and clear. |
| 10 | README | Live URL, screenshot, local run instructions, and honest next steps. |

---

Part of [FinQuest](../../README.md) · Level 9 of 10
