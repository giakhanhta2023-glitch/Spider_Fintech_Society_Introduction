# Level 18: Three banks, three shapes, one account view

> **The account aggregator** · build project · difficulty 8/10

## Read this second

Attempt the build yourself first, then ask the FinQuest tutor for a hint, and only then open this folder.
Read the part you are stuck on, close the file, and retype the fix from memory. Copying the solution into
your own project skips the only step that actually teaches you anything.

## The brief

Members of the society bank in three different places and want one view of their month. Build the aggregator: the consent flow, the token handling, three normalisers, deduplication that survives a double sync, and a categoriser that learns when somebody corrects it.

**Scope:** Uses this level plus level 12 (FastAPI, errors, request ids), level 11 (Postgres, locks, unique constraints) and level 3 (pandas for the report). The three bank files ship with the level; the OAuth server is a small fake you write, so no real bank or vendor account is needed.

## Files here

| File | What it is |
|------|------------|
| `fakebank/` | a tiny authorization server plus a transactions endpoint, so the flow is real code |
| `aggregator/oauth.py` | pkce, state, the code exchange, and a refresh that takes a lock |
| `aggregator/normalise.py` | from_bank_a, from_bank_b, from_bank_c, and the one Txn type they all produce |
| `aggregator/ingest.py` | fingerprinting, the pending to booked collapse, and the sync cursor |
| `aggregator/categorise.py` | the cleaner, the rules table, and the correction chain |
| `quiz-key.md` | all 15 drill answers with explanations |

## Run it

```bash
pip install -r requirements.txt && pytest -q && uvicorn main:app --reload
```

## Why the solution is shaped this way

- The verifier and the pending state live server side, keyed by the state value, and the callback consumes them. A state that is unknown or already used is a fatal error rather than a warning, because both cases mean somebody sent the user a link you did not generate.
- The refresh path reads the connection twice: once outside the lock to skip the common case, once inside it because another worker may have already refreshed. A hundred workers cost one refresh.
- invalid_grant is handled as a product event. The connection is marked as needing consent, the sync stops, and the app shows which bank to reconnect. Nothing retries, because nothing can succeed.
- One normaliser per bank, and nothing outside those three functions sees a bank specific field. Each has a test holding a real row from the shipped file and the exact Txn it must become, so a format change fails in one place with a readable diff.
- The raw record is stored beside the normalised one. Every parse is a guess, and keeping the original is the difference between fixing a bug and asking every customer to reconnect.
- Fingerprints carry a counter within account, date, amount and description, so a re-sync deduplicates and two identical coffees on one day both survive. 157 raw rows become 140 transactions, and running it again still produces 140.
- The sync window overlaps by two days on purpose. Deduplication makes the overlap free, and without it a backdated transaction is never seen again.
- Categorisation cleans first, matches rules second, and only then reaches a model. The fallback chain ends in uncategorised, which is a better answer than a confident wrong one.

## Where people get stuck

| Symptom | Cause |
|---------|-------|
| Every sync inserts everything again | The fingerprint includes something that changes between exports, usually a row number or an ingestion timestamp. Hash only what the bank actually sends. |
| Real transactions disappear | The fingerprint has no counter, so two identical purchases on one day collapse into one. Number them in order of appearance. |
| Spending is positive for one bank | The sign convention differs per bank: a negative amount, an indicator field, and a column position. Normalise all three to negative for money out and test it. |
| A refresh token shows up in a log line | Something logged the whole connection row or the whole exception. Log the connection id, and add the test that captures log output during a full flow. |

## Self-checks the solution satisfies

- A callback with an unknown or reused state is refused
- The code exchange fails without the correct code verifier
- A full connect and sync writes no token to the logs, asserted by capturing log output
- Two concurrent refreshes result in exactly one call to the bank
- A refresh returning invalid_grant marks the connection as needing consent and does not retry
- Each bank normaliser turns a real shipped row into the exact expected Txn
- Spending is negative in every source, despite three different sign conventions
- Ingesting the three files produces 140 transactions, and ingesting them again still produces 140
- Two identical purchases on the same day both survive deduplication
- A pending row followed by its booked row leaves one transaction with status booked
- A second sync with a cursor fetches only the overlap window
- clean() turns POS APPLE.COM/BILL HANOI into APPLE.COM
- A user correction wins over the model on the next sync, and does not change another user

## How it is marked

| Points | Criterion | Meaning |
|--------|-----------|---------|
| 25 | Consent handled properly | PKCE, state, encrypted refresh tokens, a locked refresh, and invalid_grant treated as a product event rather than an error to retry. |
| 25 | Normalisation | One function per bank, one schema out, the raw record kept, and a test per bank pinned to a real row. |
| 20 | Deduplication | 157 raw rows become 140 transactions, twice, with identical purchases surviving and pending rows collapsing. |
| 15 | Categorisation that learns | Cleaning first, rules second, model third, and a correction that sticks for that user without rewriting the world. |
| 15 | Shipped | Runs from a clean clone against the fake bank, tests pass, README covers the consent lifecycle. |

---

Part of [FinQuest](../../README.md) · Level 18 of 10
