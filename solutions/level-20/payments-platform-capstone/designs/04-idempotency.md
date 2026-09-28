# 4. An idempotency layer

## Requirements

**Functional.** A client may retry any write safely. The same key returns the same
response, including the same status code and body. Different requests under the
same key are an error rather than a silent overwrite.

**Non functional.** Adds under 5 ms to a request. Keys expire after 24 hours.
Works across instances, because the retry lands on a different one.

## Estimation

| Input | Value | Where it comes from |
|---|---|---|
| Writes a second | 200 at peak | The capstone's load |
| Keys stored | 17 million | 200 x 86,400, one day of retention |
| Bytes per key | about 2 KB | Key, fingerprint, status, body |
| Storage | about 35 GB | Which is why it expires rather than accumulating |
| Retry rate | 1% to 5% | Mostly mobile clients on bad connections |

## Data model

```
idempotency  key PRIMARY KEY, merchant_id, request_fingerprint,
             state ('in_progress' | 'complete'), status_code, response_body,
             created_at, expires_at
             INDEX (expires_at)              -- the expiry job
```

Two columns carry the design. **`request_fingerprint`** is a hash of the request
body, so the same key with a different body is a 422 rather than a silently
returned wrong answer: that is a client bug and hiding it makes it permanent.
**`state`** distinguishes "we are working on it" from "here is the answer", which
is what makes two concurrent retries behave: the second gets 409 rather than
starting a second payment.

Postgres rather than Redis, deliberately. The key has to be written in the same
transaction as the payment, or there is a window where the payment exists and the
key does not, which is exactly the window a retry lands in.

## Diagram

```
  request + Idempotency-Key
        |
   [ begin transaction ]
        |
   insert key as in_progress  --conflict--> return stored response, or 409
        |
   do the work, write the payment
        |
   update key to complete with the response
        |
   [ commit ]      both, or neither
```

## Failure modes

| What fails | Consequence | Design response |
|---|---|---|
| Crash between work and response | The key is `in_progress` forever | A timeout: in progress keys older than 60 seconds are reclaimed |
| Two concurrent retries | Two payments | The unique insert is the lock. The loser gets 409 and retries |
| Client reuses a key for a different request | The wrong response returned | The fingerprint check turns it into a 422 |
| Key store unavailable | Unsafe retries | Refuse the write. An unsafe write is worse than a refused one |
| Keys never expire | Unbounded growth | A partitioned table and a daily drop, which is level 13's expiry in 8 ms |

## What to monitor

Hit rate, which tells you how much retrying clients do and is usually higher than
anybody expects. The count of keys stuck in progress, which is the failure mode
nobody instruments. The 422 rate, because a spike is one client with a bug worth a
phone call. And the expiry job's lag, because a stuck expiry job is a table that
grows until the disk does not.
