# Level 7: The payments API other systems depend on

> **payments-api: the interface other companies call** · build project · difficulty 7/10

## Read this second

Attempt the build yourself first, then ask the FinQuest tutor for a hint, and only then open this folder.
Read the part you are stuck on, close the file, and retype the fix from memory. Copying the solution into
your own project skips the only step that actually teaches you anything.

## The brief

Put an HTTP API in front of the level 6 ledger, good enough that another team could integrate against it without asking you a question. Three status codes are easy. The work is in the retries, the error shape, the pagination, and the README that makes it usable.

**Scope:** Uses levels 4, 5 and 6. FastAPI, psycopg, pytest. The moneykit library from level 5 handles amounts. No message queue and no cache yet: those are levels 11 and 14.

## Files here

| File | What it is |
|------|------------|
| `app/main.py` | the routes, the middleware, and the app |
| `app/models.py` | pydantic models: every numeric field bounded at both ends |
| `app/errors.py` | problem() and the handlers that rewrite framework errors into it |
| `app/auth.py` | bearer keys, stored as sha256 hashes, checked before any database work |
| `app/transfers.py` | the write path: lookup, checks, both entries in one transaction, saved response |
| `tests/` | TestClient tests, one per status code, plus the three idempotency cases |
| `quiz-key.md` | all 15 drill answers with explanations |

## Run it

```bash
export DATABASE_URL=... && fastapi dev app/main.py   then   pytest -q
```

## Why the solution is shaped this way

- Three idempotency cases, not one. A new key does the work and returns 201. The same key with the same body replays the saved response with 200 and an Idempotent-Replay header. The same key with a different body returns 409, because that is a bug in the caller and telling them on the second request is kinder than telling them at month end.
- The response is saved, not rebuilt. A replay returns the original id and the original timestamp, because a retry that returns a slightly different answer is worse than one that fails.
- One error shape across the whole API. The framework produces its own errors in a different shape, so exception handlers rewrite them, and every error carries a stable code a program can branch on plus a request id a human can search for.
- Authentication runs before anything touches the database. Measured on the reference service, an unauthenticated request costs 6.1 ms while anything reaching the database costs 200 ms or more, so an unauthenticated flood is cheap to refuse.
- Pagination is keyset, with a capped limit and one extra row fetched to answer has_more without a count query. Measured on 400,000 rows: offset 300000 read 300,020 rows in 63.259 ms, the cursor read 20 rows in 1.365 ms.
- Every field has a maximum as well as a minimum. A cap on the amount is what refuses a test script with one extra zero.
- The latency measurement is in the README because it is the honest finding of the level: a new connection per request cost 202.7 ms median against 62.3 ms on a connection already open, with the SQL itself under a millisecond. The query was never the problem.

## Where people get stuck

| Symptom | Cause |
|---------|-------|
| A retry creates a second transfer | The key is being stored after the write instead of checked before it, or the lookup and the insert are not in one transaction. |
| The replay returns a different timestamp | The response is being rebuilt rather than returned from what was saved. |
| Validation errors look different from your other errors | The framework handled them. Add exception handlers for RequestValidationError and HTTPException. |
| A deep page is slow | Offset pagination. Switch to a cursor and prove it with two EXPLAIN plans. |
| Everything is slow and the SQL is fast | A connection is being opened per request. Add a pool, and measure again before and after. |

## Self-checks the solution satisfies

- POST with a new key returns 201 and a transfer with an id
- The identical request with the same key returns 200, the same id, and an Idempotent-Replay header
- The same key with a different amount returns 409 and code idempotency_key_reused
- A write with no Idempotency-Key returns 400 and code idempotency_key_required
- No Authorization header returns 401 without touching the database
- A negative amount returns 422 naming the field, in your error shape rather than the framework default
- An unknown account returns 404 and code account_not_found
- A transfer larger than the balance returns 422 and code insufficient_funds, and writes nothing
- Every response carries X-Request-Id, and a supplied X-Request-Id is echoed back
- Two pages walked with next_cursor return no row twice, and the last page reports has_more false
- A limit of 10,000 is capped rather than obeyed
- After a failed write, the balance is unchanged and no entries were created

## How it is marked

| Points | Criterion | Meaning |
|--------|-----------|---------|
| 25 | Idempotency done properly | All three cases, the saved response replayed exactly, and the key required rather than optional. |
| 20 | One contract, one error shape | Versioned paths, stable error codes, framework errors rewritten, every code documented. |
| 20 | Validation and auth at the edge | Bounds on every field, hashed keys, authentication before any database work. |
| 20 | Pagination that scales | Cursor paging with a capped limit, the two plans measured and explained. |
| 15 | Usable by a stranger | Tests for every status code, a curl session in the README, and the latency measurement with your own numbers. |

---

Part of [FinQuest](../../README.md) · Level 7 of 10
