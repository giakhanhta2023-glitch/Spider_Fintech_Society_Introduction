# Level 10 — Compliance, Architecture & the Capstone Build

> **NeoBank Analytics — Capstone** · build project · difficulty 10/10

## Read this second

Attempt the build yourself first, then ask the FinQuest tutor for a hint, and only then open this folder.
Read the part you are stuck on, close the file, and retype the fix from memory. Copying the solution into
your own project skips the only step that actually teaches you anything.

## The brief

One repository. One deployed application. Everything you have learned, assembled into a product you would be happy for an interviewer to open in front of you.

**Scope:** Uses everything from Levels 2 through 9 and nothing new: your ledger, analytics, lending, risk, fraud and FX code, restructured into modules behind one Streamlit interface, with tests and documentation.

## Files here

| File | What it is |
|------|------------|
| `neobank/` | seven service modules, one per domain |
| `neobank/loaders.py` | the only module that touches a file |
| `app.py` | six-section Streamlit dashboard, no business logic |
| `tests/test_capstone.py` | 38 tests across seven modules |
| `data/generate.py` | regenerates every synthetic dataset |
| `quiz-key.md` | all 15 drill answers with explanations |

## Run it

```bash
pip install -r requirements.txt && python data/generate.py && pytest -q && streamlit run app.py
```

## Why the solution is shaped this way

- Dependencies run one way only: `app.py` calls services, services call `loaders`, and nothing calls upward. Two greppable rules enforce it — no `streamlit` anywhere in `neobank/`, and no `read_csv` outside `loaders.py`. Both are asserted.
- `ledger.statement()` returns rows instead of printing them. That single change is the layer boundary made concrete: the service produces data, the interface decides how it looks.
- `loaders.py` anchors paths to its own file location and validates the schema on load, so a malformed CSV fails immediately with a clear message rather than producing a wrong number ten functions later.
- Reconciliation compares the ledger against an external statement and reports breaks without auto-adjusting anything. A break is a bug, a timing difference, or fraud, and silently "fixing" it destroys the evidence.
- The test suite leads with invariants and refusals, because those are the properties that make a money system trustworthy.

## Where people get stuck

| Symptom | Cause |
|---------|-------|
| `ModuleNotFoundError: neobank` | Run from the project root, the folder containing `app.py`. |
| Data file not found | `python data/generate.py` first. |
| A service needs a DataFrame it cannot get | It is asking for data. Add a loader and pass the result in; do not read the file from the service. |

## Self-checks the solution satisfies

- A fresh clone plus `pip install -r requirements.txt` then `pytest -q` passes with 20 or more tests
- `streamlit run app.py` starts with no errors on a machine that has never run the project
- grep for "streamlit" inside neobank/ returns nothing
- grep for "read_csv" outside loaders.py returns nothing
- Ledger invariant holds after every operation exercised by the test suite
- A refused overdraft leaves the entry count unchanged
- A repeated idempotency key returns the same transaction id and adds no entries
- Deleting a data file produces a clear error message, not a traceback
- Every app section renders with the default dataset
- The reconciliation view reports zero breaks on clean data and lists the break when one is introduced
- The deployed URL loads on a phone and every section is usable

## How it is marked

| Points | Criterion | Meaning |
|--------|-----------|---------|
| 20 | It runs for a stranger | Clone, install, test, run — all from the README, with no undocumented steps. |
| 20 | Architecture | Clean layers, no logic in the interface, all data access in one module, imports one-directional. |
| 15 | Integration | All five domains genuinely present and working together, not five disconnected demos. |
| 15 | Tests | 20+ meaningful tests across modules, covering invariants and refusals, all passing. |
| 10 | Deployed | A public URL that works on a phone. |
| 10 | Documentation | README that sells it in thirty seconds, plus an architecture document. |
| 10 | Judgement | Honest limitations, a real ethics section, and a reconciliation view that shows you know what a ledger is for. |

---

Part of [FinQuest](../../README.md) · Level 10 of 10
