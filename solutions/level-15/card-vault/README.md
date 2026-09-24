# card-vault

One service that can see a card number. Six that used to, and now cannot.

```bash
pip install -r requirements.txt
pytest -q                          # 28 tests, about a second
python -m vault.bench              # every number below, about twenty seconds
```

Read [THREAT_MODEL.md](THREAT_MODEL.md) before the code and
[SCOPE.md](SCOPE.md) after it. Those two files are the deliverable that a
reviewer, an auditor or an interviewer actually reads. The code is what makes
them true.

Every card number in this repository is a published test number. There is no
real card data here and there never was.

## 1. What the cryptography costs, and what it does not

Twenty thousand card numbers, AES-256-GCM, no network involved:

| What is being timed | Per record | Per second |
|---|---|---|
| The primitive, with the cipher object reused | 2.1 us | 480,000 |
| A fresh cipher object per record | 5.0 us | 200,000 |
| `seal()`, which is what ships | 7.0 us | 142,000 |

Three lines, and the gap between the first and the last is the interesting
part. Most of `seal()` is not encryption: it is constructing an `AESGCM` object
and a `Sealed` dataclass, twenty thousand times. The alternative is caching the
cipher, which means holding plaintext key material in a structure that outlives
the call. Three microseconds is not worth that, and the reason is the next
table: the network call this design exists to avoid costs **eight thousand**
microseconds.

**Encryption is not the cost. It was never the cost.** Anybody who tells you
encryption is too slow for their hot path has not measured it, and the number to
measure instead is the key service round trip.

## 2. Envelope encryption, in calls rather than in adjectives

The same 20,000 records, two designs:

| Design | Key service calls | Time |
|---|---|---|
| One call per record | 20,000 | 172 s (extrapolated from a measured 8.6 ms call) |
| One data key per 100 records | 200 | 2.0 s (measured end to end) |

A hundred times fewer calls, and the second row was run in full rather than
argued about. That ratio is the whole of envelope encryption, and it is also
the shape of AWS KMS: `GenerateDataKey` hands you a plaintext key and a wrapped
copy, `Decrypt` unwraps it, and the master key never leaves. Having built the
simulator, the documentation reads as a price list.

The batch size is the dial. One data key per 100 records means an exposed data
key is 100 cards rather than 20,000, and it costs 200 calls instead of 2. Pick
the number from how much blast radius you can live with, not from a blog post.

## 3. Rotation, which is where the design earns its keep

Rotating the master key:

| Approach | Cryptography | Card rows rewritten |
|---|---|---|
| Rewrap the 200 data keys | 3 ms | **0** |
| Re-encrypt all 20,000 records | 373 ms | **20,000** |

Read the right hand column, not the left one. The cryptography is not the
problem in either case: 373 ms of AES is nothing. Rewriting twenty thousand
rows is the level 13 backfill, with its locks, its write ahead log volume, its
doubled table size and its two hour maintenance window. At twenty million rows
that is a project. At twenty million rows the rewrap is still about a second,
because the number of data keys grew with the batch count and not with the
records.

There is a test that asserts the zero, rather than a paragraph claiming it:

```python
before = {t: (vault._records[t].nonce, vault._records[t].ciphertext) for t in tokens}
outcome = vault.rotate_master_key()
after = {t: (vault._records[t].nonce, vault._records[t].ciphertext) for t in tokens}

assert before == after                     # not one byte of card data moved
assert outcome["card_rows_rewritten"] == 0
assert outcome["data_keys_rewrapped"] < len(tokens)
```

Two master key versions stay readable at once, so a rotation is not an
instantaneous event, and `retire_old_master_keys()` removes a version only once
nothing references it. Retiring one that something still uses makes those
records unreadable forever, so it is checked rather than assumed.

## 4. Tokens that mean nothing

The token is 32 random bytes with a `tok_` prefix. It is not the encrypted card
number, not a hash of it, and not derived from it at all. If a token could be
turned back into a card number by anybody holding a key, then stealing that key
steals every card and the vault has bought you nothing.

Tokens are stable, because the analytics question is real: the same card always
produces the same token, so "how many customers use one card across merchants"
is answerable in the warehouse with no card number anywhere near it. The index
that makes that work is keyed by an HMAC of the card number rather than by the
card number, so the lookup table is not itself a list of cards.

BIN and last four live beside the token as their own fields. They are not
sensitive alone, everything needs them, and putting them inside the token would
make the token carry information.

`SCOPE.md` has the count: seven systems storing card numbers became one, and the
honest footnote about the API that still handles one in flight.

## 5. Authentication, twice, at two different layers

**Mutual TLS** at the connection. `tests/integration/test_mtls.py` builds a
certificate authority, issues a server certificate and two client certificates,
and performs three real handshakes against a real listener. No mocks: a mocked
handshake proves nothing about TLS.

| Client | Server says | Client sees |
|---|---|---|
| Certificate from our CA | admitted, `payments-service`, TLSv1.3 | the application's reply |
| No certificate | `PEER_DID_NOT_RETURN_A_CERTIFICATE` | `TLSV13_ALERT_CERTIFICATE_REQUIRED` |
| Certificate from another CA | `CERTIFICATE_VERIFY_FAILED, unable to get local issuer certificate` | `TLSV1_ALERT_UNKNOWN_CA` |

The refusal happens in the TLS stack, before there is a request to authorise.
There is no code path in the application to get it wrong in.

Writing that test taught something the level does not mention. Under TLS 1.3 the
client sends its certificate after the server's Finished, so `wrap_socket` can
return successfully to a client that is about to be rejected: the refusal then
arrives on the first read, as an alert, an empty read or a reset connection,
depending on timing. Asserting on the client's exception type made the test
flaky, once in three. The test now asserts what the server recorded and that no
application bytes came back, which is the property that actually matters, and it
has not flaked since.

**A short lived scoped token** in the request. Verification is five checks and
not one line:

```python
jwt.decode(
    raw,
    secret,
    algorithms=["HS256"],        # pinned. Never read from the token
    audience="vault",            # is this token for us?
    issuer="auth.internal",      # did we issue it?
    options={"require": ["exp", "aud", "iss"]},
)
```

What a verification costs, since it sits on every request:

| Algorithm | Per verification | One core at 1,000 requests a second |
|---|---|---|
| HS256 | 97.0 us | 10% |
| RS256 | 260.0 us | 26% |
| ES256 | 463.6 us | 46% |

Verifying RSA is cheaper than verifying an elliptic curve signature, which
surprises nearly everybody, including the person who wrote this. RSA
verification is one small exponentiation; ECDSA verification is two scalar
multiplications. Signing is the other way round, which is why ES256 is popular
with issuers and expensive for the services checking their work.

## 6. Webhooks, and the four ways a forgery gets in

```
signed    = f"{timestamp}.{raw_body}"
signature = hmac_sha256(secret, signed)
header    = X-Signature: t=1758585600,v1=9f86d081...
```

Every piece of that answers a specific attack. The **raw body**, because
re-serialising JSON changes bytes and breaks every signature in a way that takes
a day to find. The **timestamp inside the signed string**, because outside it an
attacker edits it freely, and inside it the replay window becomes enforceable.
A **version prefix**, so the algorithm can change without breaking every
integration on one day. **Two secrets accepted at once**, so a rotation is a
deploy rather than an outage: sign with the new one immediately, accept both
until every receiver has moved, then close the window.

Six tests: a good signature, an edited body, a replay after five minutes, a
missing header, the wrong secret, and the previous secret working during the
window and failing after it.

## 7. Logging, which is a data store nobody treats as one

An allowlist, not a denylist. A denylist removes the fields somebody thought of;
the endpoint added last Tuesday has a field nobody added to the list, and it is
already in the log aggregator, replicated and retained for a year.

A redactor sits behind the allowlist for free text, keeping the BIN and the last
four, because a fully redacted log line helps nobody and gets replaced by an
unredacted one within the month.

```python
redact("declined for 4111111111111111") == "declined for 411111******1111"
redact("4111 1111 1111 1111")           == "411111******1111"
redact("amount 1999")                   == "amount 1999"      # not card shaped
```

The test that matters is the one that fails in the pull request that would leak.

## 8. An audit log the application cannot edit

Two layers, two error codes, verified on PostgreSQL 18.6:

| Role | Statement | Result |
|---|---|---|
| `vault_app` | insert | allowed |
| `vault_app` | update | 42501, permission denied for table `audit_log` |
| `vault_app` | delete | 42501, permission denied for table `audit_log` |
| `vault_app` | truncate | 42501, permission denied for table `audit_log` |
| `vault_app` | drop | 42501, must be owner of table `audit_log` |
| `vault_auditor` (the owner) | delete | 23001, `audit_log is append only: DELETE refused` |
| `vault_auditor` (the owner) | truncate | 23001, `audit_log is append only: TRUNCATE refused` |

One row before those five refusals, one row after.

42501 is `insufficient_privilege` and comes from the grant, which is the layer
that contains an attacker holding the application's credentials. 23001 is
`restrict_violation` and comes from a statement level trigger, which is the
layer that catches a migration with a careless `delete from audit_log` in it.
The owner could drop that trigger, and [THREAT_MODEL.md](THREAT_MODEL.md) says
so rather than implying otherwise.

Truncate is the one people miss. It is not a delete, so revoking delete does not
stop it, and it empties a table faster than anything else in the language.

The remaining way past the trigger is `set session_replication_role = replica`,
which needs a privilege that managed Postgres grants to nobody: attempting it as
the database owner returns `permission denied to set parameter
session_replication_role`.

## 9. The timing attack that did not reproduce

Comparing a 64 character hex digest with `==`, two hundred thousand times,
median of five runs:

| Where the wrong secret differs | Time per comparison |
|---|---|
| At the first byte | 212.1 ns |
| At the last byte | 224.7 ns |

The theory says the second row should be much slower, because `==` stops at the
first difference. Six per cent is noise, and the sign was the other way round on
the rig used to write the level. **The leak did not reproduce**, and the
experiment says so out loud rather than quietly reporting the expected result.

`hmac.compare_digest` measured 241.3 ns, about 24 ns more than `==`. It is used
anyway, in every comparison in this codebase, and the reason is worth being
precise about: not because the attack was observed, but because 24 nanoseconds
buys the removal of a dependency on an implementation detail that CPython is
free to change. That is a decision worth making once.

A failed reproduction is a result. Publishing only the measurements that agreed
with the plan is how a repository full of numbers ends up meaning nothing.

## The sixteen tests the level asks for

Fourteen run with no service of any kind, in `tests/test_vault.py`. Two need a
real one and live in `tests/integration/`:

| Test | Where |
|---|---|
| 1 to 10, 12 to 15 | `tests/test_vault.py`, 25 tests |
| 11, mutual TLS refused at the handshake | `tests/integration/test_mtls.py`, 3 tests, runs anywhere |
| 16, the database role that cannot delete | `tests/integration/test_audit_role.py`, needs `DATABASE_URL` |

```bash
pytest -q                                          # 28 tests, 1 skipped
psql "$DATABASE_URL" -f sql/001_audit_log.sql      # then the last one runs too
DATABASE_URL=... pytest tests/integration -v
```

## About these numbers

Every figure above came from `python -m vault.bench` on the laptop this was
written on: Python 3.11.9, OpenSSL 3.0.13, Windows, median of three runs. Run it
and you will get a fourth set. Absolute values move between machines; the
ratios do not, and the design rests on the ratios.

The level itself quotes a few figures from the rig used while writing it rather
than from the shipped code, and three of them differ from this README. The
reasons are known and each one is worth a sentence:

- **2.8 us against 2.1 us** for the primitive: the same measurement, different
  run. The shipped `seal()` is 7.0 us, and section 1 explains where the rest
  goes.
- **160 s against 172 s** for 20,000 key service calls: the level multiplied
  20,000 by the nominal 8 ms. This bench measured the call at 8.6 ms, because
  `time.sleep` overshoots on Windows, which is the same timer granularity
  problem level 14 ran into from the other direction.
- **79.9, 141.5 and 239.7 us against 97.0, 260.0 and 463.6 us** for token
  verification: the rig checked the audience only. The shipped path checks
  audience, issuer, expiry, the required claims and a pinned algorithm, and each
  check costs something. The ordering is the same in both, and the ordering is
  the point.

## What is not in this folder

- A running FastAPI service. The vault's interface is four functions, and
  wrapping them in HTTP is level 7 unchanged. The dependency injection and the
  authentication middleware are there.
- Hosted fields, which is what a real company uses to stop the card number
  reaching its own API at all. `SCOPE.md` says why that is the next step and why
  building the vault first teaches more.
- A real key service. `vault/keys.py` is a simulator with a latency dial, and
  the stretch goal is to point it at KMS and compare the measured call cost.

---

Part of [FinQuest](../../../README.md) level 15.
