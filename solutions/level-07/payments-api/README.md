# payments-api

Transfers over the level 6 ledger. Every write is idempotent, every error has
the same shape, and the pagination does not get slower as the table grows.

```bash
pip install -r requirements.txt
pytest                                    # 25 tests, no database needed
DATABASE_URL=... uvicorn app.asgi:app      # against the real ledger
```

## Endpoints

| Method | Path | Does | Needs |
|---|---|---|---|
| `POST` | `/v1/transfers` | Create a balanced transfer | `Idempotency-Key`, scope `transfers:write` |
| `GET` | `/v1/transfers/{id}` | One transfer | scope `transfers:read` |
| `GET` | `/v1/accounts/{id}/balance` | Current balance | scope `accounts:read` |
| `GET` | `/v1/accounts/{id}/entries` | Cursor paginated entries | scope `accounts:read` |
| `GET` | `/v1/healthz` | Liveness | nothing |
| `GET` | `/v1/errors` | The list below, served from the code | nothing |

## Error codes

Every failure returns this and nothing else:

```json
{"error": {"code": "insufficient_funds",
           "message": "account 1 holds 100000 and needs 999900",
           "request_id": "0d8f...",
           "details": []}}
```

| Code | Status | When |
|---|---|---|
| `unauthorized` | 401 | Missing or unknown bearer key |
| `forbidden` | 403 | Valid key, wrong scope |
| `not_found` | 404 | No such resource |
| `account_not_found` | 404 | A leg names an account that does not exist |
| `transfer_not_found` | 404 | No such transfer |
| `idempotency_key_required` | 400 | A write with no `Idempotency-Key` |
| `idempotency_key_reused` | 409 | Same key, different body |
| `invalid_request` | 422 | Body failed validation, `details` names the fields |
| `insufficient_funds` | 422 | The source account does not hold that much |
| `unbalanced_transfer` | 422 | The legs do not sum to zero |
| `currency_mismatch` | 422 | Legs in more than one currency |
| `invalid_cursor` | 400 | A cursor this API did not issue |
| `rate_limited` | 429 | Reserved for level 14 |
| `internal_error` | 500 | Anything unexpected, logged with the request id |

`/v1/errors` serves this list from the same dictionary the code raises from, so
the documentation cannot drift away from the behaviour.

## A session, including the retry

```bash
KEY=sk_test_...
# 1. create
curl -s -X POST localhost:8000/v1/transfers \
  -H "Authorization: Bearer $KEY" \
  -H "Idempotency-Key: 7f1c9e2a" \
  -H "Content-Type: application/json" \
  -d '{"currency":"USD","description":"invoice 91",
       "legs":[{"account_id":1,"amount_minor":-2500},
               {"account_id":2,"amount_minor":2500}]}' -i | head -1
# HTTP/1.1 201 Created

# 2. the same request again, because the caller timed out and retried
curl -s -X POST localhost:8000/v1/transfers \
  -H "Authorization: Bearer $KEY" -H "Idempotency-Key: 7f1c9e2a" \
  -H "Content-Type: application/json" -d '{ ...the same body... }' -i | head -3
# HTTP/1.1 200 OK
# idempotent-replay: true
#   ... byte for byte the response the first attempt returned

# 3. the same key, a different amount. This is a bug in the caller, and
#    saying so is more useful than quietly doing one of the two things.
curl ... -H "Idempotency-Key: 7f1c9e2a" -d '{"...amount_minor": -9900 ...}'
# HTTP/1.1 409 Conflict   {"error":{"code":"idempotency_key_reused",...}}

# 4. walk the entries
curl -s "localhost:8000/v1/accounts/2/entries?limit=50" -H "Authorization: Bearer $KEY"
# {"data":[...], "has_more": true, "next_cursor": "MjAyNS0wNy0wM1QwMDowMDowMCswMDowMHwxODUyMzQ"}
curl -s "localhost:8000/v1/accounts/2/entries?limit=50&cursor=MjAyNS0..." -H "Authorization: Bearer $KEY"
```

## The measurements

### Pagination: OFFSET against keyset

Level 6's ledger, 398,003 entries, asking for the rows on page 4,001 with a
page size of 50. `EXPLAIN (ANALYZE, BUFFERS)`:

| | Rows read | Buffers | Time |
|---|---|---|---|
| `offset 200000 limit 50` | **200,050** | 102,460 | **113.684 ms** |
| `where (created_at, id) > (...)` | **50** | 30 | **0.101 ms** |

A thousand times slower, and the reason is in the rows column: `OFFSET` does
not skip. It reads all 200,050 rows and throws 200,000 of them away. Page 1
is fast, page 4,001 is not, and the same query keeps getting slower as the
table grows even though the page size never changes.

The keyset version asks the index for the place it left off, so every page
costs the same as the first one. It also cannot skip or repeat a row when
something is inserted mid-walk, which `OFFSET` can.

The cost is that you cannot jump to page 400, which is the honest trade. Almost
nobody does, and for an API with machine callers, nobody does.

### Connecting, against reusing a connection

The same trivial query, against a hosted Postgres over the network:

| | Median |
|---|---|
| A new connection each time | **63.259 ms** |
| One connection, reused | **1.365 ms** |

Forty six times the cost of the query, before any of your code runs, on every
request. `bench/connect.py` reproduces it against whatever you deploy to; on a
socket to a local Postgres the gap is much smaller and still real. This is the
entire argument for the connection pool, which is level 8.

## Design decisions

**Authentication happens before any database work**, so an unauthenticated
flood costs one sha256 rather than a connection. Keys are stored as sha256
hashes only, compared with `hmac.compare_digest`.

**A valid key is not an authorised one.** Every endpoint checks a scope, and
there is a test for a read-only key being refused a write with 403.

**The three idempotency cases** are 201 for a new key, 200 with the saved
response and an `Idempotent-Replay` header for an identical retry, and 409 for
the same key with a different body. The fingerprint is a sha256 of the body
with sorted keys, so a client that serialises its JSON in a different order is
not treated as making a different request.

**The saved response is returned byte for byte**, rather than recomputed. A
retry that recomputes can return something different from the first attempt,
which defeats the point of the key.

**One error shape everywhere**, including for the framework's own validation
errors, which are rewritten by an exception handler. Without that, one endpoint
returns `{"detail": [...]}` and the rest return `{"error": {...}}`, and every
caller writes two parsers.

**A request id on every response**, taken from the caller's `X-Request-Id` when
supplied so one identifier spans their logs and ours, and generated when not.
It appears in the error body as well as the header, so a customer can quote the
number on their screen and it can be found in the logs.

## Testing

25 tests, in process, no database. Everything asserted is about the HTTP
contract: status codes, all three idempotency cases, authentication,
authorisation, validation in our error shape, the request id, a three page
cursor walk with no row appearing twice, and a capped limit.

The ledger sits behind a protocol with two implementations, so these tests run
against an in-memory one. That is deliberate rather than a shortcut: the rules
that are genuinely about the database (a transaction balancing, a race between
two writers) are level 6 and level 8, and they are tested there against a real
Postgres, where an in-memory substitute would pass and ship the bug.

```
25 passed in 4.61s
```

## Limitations

- One currency per transfer, and `currency_mismatch` is defined but not yet
  enforced against the accounts' own currencies.
- The Postgres idempotency store opens a connection per call, because this
  level does not have a pool yet. Level 8 fixes it.
- No rate limiting. The code exists in the error list and the implementation is
  level 14.
- Webhooks are not here. They arrive with signing in level 15.
