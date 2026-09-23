# Level 15: The keys to the money

> **card-vault: one service that can see a card number** · build project · difficulty 9/10

## Read this second

Attempt the build yourself first, then ask the FinQuest tutor for a hint, and only then open this folder.
Read the part you are stuck on, close the file, and retype the fix from memory. Copying the solution into
your own project skips the only step that actually teaches you anything.

## The brief

Build the vault your payments system stores nothing sensitive without. Envelope encryption over a key service you cannot read the master key out of, tokens that mean nothing, a master key rotation that never touches a card row, authenticated callers, signed webhooks, and a scope document that shows how much of your system you just took out of PCI scope.

**Scope:** Uses the level 7 API and the level 6 database. All card numbers are published test numbers. The key service is a local simulator with a latency dial. The deliverable includes the threat model and the scope table, which are read more often than the code.

## Files here

| File | What it is |
|------|------------|
| `THREAT_MODEL.md` | assets, attackers, controls, and what is not defended |
| `SCOPE.md` | who can see a card number, before and after the vault |
| `vault/keys.py` | the key service simulator, 8 ms a call, master key unreachable |
| `vault/envelope.py` | data keys, wrapping, AES-GCM with the record id bound in |
| `vault/tokens.py` | random tokens, the mapping, BIN and last four as separate fields |
| `vault/rotate.py` | rewrap data keys, two versions live, retire the old one |
| `api/auth.py` | OAuth2 client credentials, and verification done fully |
| `api/webhooks.py` | sign, verify, rotate the secret, reject replays |
| `obs/logging.py` | an allowlist, plus the test that fails when a PAN leaks |
| `quiz-key.md` | all 15 drill answers with explanations |

## Run it

```bash
python -m vault.bench && pytest -q tests/test_no_pan_in_logs.py tests/test_forgery.py
```

## Why the solution is shaped this way

- The threat model is written first and everything else refers to it. The section that gets read is the one naming what is deliberately not defended, because it tells a reviewer where to look.
- Envelope encryption is justified with arithmetic rather than habit. Encrypting 20,000 card numbers with one key service call each is 20,000 calls and 160 seconds; with data keys it is 200 calls and 1.7 seconds.
- Local cryptography turns out not to be the cost at all: AES-256-GCM encrypted a card number in 2.8 microseconds, which is 358,539 a second on one core. The 8 ms network call is a thousand times more expensive, and the design exists to make fewer of them.
- Rotation is the part that separates reading about envelopes from having done it. Rewrapping 200 data keys took 1 ms. Re-encrypting 20,000 records took 127 ms of cryptography plus a rewrite of every row, which is the level 13 backfill with all of its locks and log volume.
- Tokens are random and mean nothing. The scope table is the deliverable: seven components that could see a card number became one, and every audit of the other six stops being necessary.
- Token verification is costed because it sits on the hot path: HS256 79.9 us, RS256 141.5 us, ES256 239.7 us per verification, which is 8%, 14% and 24% of a core at a thousand requests per second. Verifying RSA is cheaper than verifying an elliptic curve, which surprises most people.
- The timing attack on `==` could not be reproduced: 112.7 ns when the secret differed at the first byte against 98.5 ns at the last, with the sign the wrong way round. compare_digest costs 60 ns more and is used anyway, because it is free and it removes a dependency on an implementation detail. The failed reproduction is reported rather than hidden.

## Where people get stuck

| Symptom | Cause |
|---------|-------|
| A valid token let a caller do the wrong thing | Authentication checked, authorisation not. A signature proves who, never what they may do. |
| A token from another service was accepted | No audience check. Every token says what it is for. |
| An attacker signed their own token | The algorithm was read from the token. Pin it in the code, always. |
| Rotation meant rewriting every card row | Data keys not used, so the master key is encrypting records directly. |
| A ciphertext was moved between rows and still decrypted | No context bound into the additional authenticated data. |
| A card number appeared in the logs | A denylist of fields to redact. Allowlist what may be logged, and test it. |
| The audit log had a gap | The application role could delete from it, so it was never an audit log. |

## Self-checks the solution satisfies

- The master key cannot be obtained through any public function of the key service
- A ciphertext moved to a different record fails to decrypt
- Encrypting 20,000 records with envelopes makes two orders of magnitude fewer key service calls
- After a master key rotation, records written before it still decrypt
- A master key rotation updates no card row
- Two tokens for the same card are identical if stable tokens are chosen, and the token reveals nothing about the PAN
- Detokenisation without the required scope raises rather than returning a card number
- A token issued for another audience is rejected by the vault
- A JWT with the algorithm set to none is rejected
- An expired token is rejected even though the signature is valid
- A client with no certificate cannot complete the TLS handshake with the vault
- A webhook with an edited body fails verification
- A webhook replayed after the window fails verification
- A webhook signed with the previous secret succeeds during the rotation window and fails after it
- No test PAN appears anywhere in captured log output, while the BIN and last four do
- The application database role cannot delete from the audit table

## How it is marked

| Points | Criterion | Meaning |
|--------|-----------|---------|
| 20 | The thinking | A threat model with a real "not defending" section, and a scope table that shows the change. |
| 25 | Envelope encryption | Bound context, measured call counts, and a rotation that touches no card row. |
| 20 | The vault | Meaningless tokens, a single detokenisation path, scope enforced, the rest of the system converted. |
| 20 | Authentication | Full JWT verification, mutual TLS proven at the handshake, signed webhooks with forgery tests. |
| 15 | Containment | Allowlist logging with a failing-when-broken test, and an audit log the application cannot edit. |

---

Part of [FinQuest](../../README.md) · Level 15 of 10
