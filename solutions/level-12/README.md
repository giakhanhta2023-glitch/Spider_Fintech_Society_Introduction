# Level 12: The payment API other people depend on

> **The payments service** · build project · difficulty 8/10

## Read this second

Attempt the build yourself first, then ask the FinQuest tutor for a hint, and only then open this folder.
Read the part you are stuck on, close the file, and retype the fix from memory. Copying the solution into
your own project skips the only step that actually teaches you anything.

## The brief

Another society is building an app that will move money through your level 11 ledger. They need an HTTP API they can integrate against in an afternoon, and they will retry on every network wobble, so it has to be impossible for them to charge somebody twice by accident.

**Scope:** Uses this level plus level 11 (the ledger) and level 9 (tests, project layout). FastAPI, pydantic, psycopg, httpx, pytest. No frontend, no ORM, no queue: the retry loop is yours to write, which is how you learn what a queue does for you later.

## Files here

| File | What it is |
|------|------------|
| `main.py` | the app, the routes and the request id middleware |
| `api/idempotency.py` | the key store, the body fingerprint, and the three cases |
| `api/state.py` | the transition table and the one function that moves a transfer |
| `api/webhooks.py` | sign, deliver with backoff, dead letter, verify |
| `tests/` | every status code, a tampered webhook and a replayed one |
| `quiz-key.md` | all 15 drill answers with explanations |

## Run it

```bash
pip install -r requirements.txt && pytest -q && fastapi dev main.py
```

## Why the solution is shaped this way

- The idempotency store keeps the key, a sha256 of the request body and the response that was sent. Without the fingerprint a key reused by mistake looks exactly like a retry, and the client believes forty payments went through when one did.
- Legal transitions live in one dictionary and one function. Every write path goes through it, so an illegal transition is a 409 rather than a second refund that still balances.
- Errors are a code, a message and a request id. The code is what a client branches on, the message is for a person, and the id is what a partner quotes when they report something.
- Webhook signatures cover a timestamp and the raw bytes. Verification reads the body before anything parses it, refuses a timestamp older than five minutes, and compares with `hmac.compare_digest`.
- Delivery is at least once by design: retry with backoff, dead letter after the last attempt, and document that the receiver must be idempotent on the event id.

## Where people get stuck

| Symptom | Cause |
|---------|-------|
| The signature verifies in tests and fails in production | You are verifying re-serialised JSON. Read the raw body once, verify those bytes, parse afterwards. |
| Insufficient funds returns 500 | It is 422 with a code. 500 tells a well behaved client to retry forever against an account that will never have the money. |
| The second identical request creates a second transfer | The key is being read after the write, or not at all. Look it up before touching the ledger. |

## Self-checks the solution satisfies

- POST /v1/transfers with a new key returns 201 and a transfer id
- The same key and body again returns 200 with an identical body, and the ledger holds one transfer
- The same key with a different body returns 409 with code idempotency_key_reused
- amount_cents of 0 returns 422 naming the field, and no ledger row is written
- A transfer from an account without the money returns 422 with code insufficient_funds
- Reversing twice returns 201 then 409 with code illegal_transition
- A request without a bearer token returns 401, and the token never appears in the logs
- A webhook is delivered with a valid FQ-Signature that the test receiver verifies
- A receiver returning 500 is retried with backoff and the event lands in the dead letter list
- An incoming webhook with a tampered body returns 401, and one with a timestamp ten minutes old returns 401
- The same incoming event id twice is processed once and acknowledged twice

## How it is marked

| Points | Criterion | Meaning |
|--------|-----------|---------|
| 25 | Cannot charge twice | All three idempotency cases are implemented and tested, including the reuse with a different body. |
| 20 | Errors a client can use | Correct status codes, a stable machine readable code, and a request id in every response. |
| 20 | Webhooks both ways | Signed with a timestamp, retried with backoff, dead lettered. Verified against raw bytes with compare_digest and replay protection. |
| 20 | State handled | Transitions in one table, illegal ones refused with 409, and no path that mutates state without going through it. |
| 15 | Shipped | Runs from a clean clone, tests pass with no server, README documents every endpoint and says what is missing. |

---

Part of [FinQuest](../../README.md) · Level 12 of 10
