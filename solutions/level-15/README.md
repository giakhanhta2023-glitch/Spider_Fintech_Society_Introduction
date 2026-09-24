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
| `vault/tokens.py` | random tokens, the stable index, rotation that rewrites no card row |
| `vault/webhooks.py` | sign, verify, the rotation window, constant time compare |
| `vault/logging_.py` | an allowlist, plus the redactor for free text |
| `vault/bench.py` | the five measurements the README publishes |
| `sql/001_audit_log.sql` | the append only audit log, two roles and two triggers |
| `tests/test_vault.py` | fourteen of the sixteen required tests, twenty five in total |
| `tests/integration/` | mutual TLS with real handshakes, and the database role |
| `quiz-key.md` | all 15 drill answers with explanations |

## Run it

```bash
pytest -q && python -m vault.bench
```

## Why the solution is shaped this way

- The threat model is written first and everything else refers to it. The section that gets read is the one naming what is deliberately not defended, because it tells a reviewer where to look.
- Envelope encryption is justified with arithmetic rather than habit. Encrypting 20,000 card numbers with one key service call each is 20,000 calls and 172 seconds; with data keys it is 200 calls and 2.0 seconds, measured end to end rather than estimated.
- Local cryptography turns out not to be the cost at all. The AES-256-GCM primitive sealed a card number in 2.1 microseconds, and the shipped `seal()` took 7.0, because most of that function is building a cipher object rather than encrypting. Caching the cipher would recover the difference and would keep plaintext key material alive past the call, which is not worth three microseconds when the network call it avoids costs eight thousand.
- Rotation is the part that separates reading about envelopes from having done it. Rewrapping 200 data keys took 3 ms and rewrote no card row. Re-encrypting 20,000 records took 373 ms of cryptography plus a rewrite of every row, which is the level 13 backfill with all of its locks and log volume.
- Tokens are random and mean nothing. The scope table is the deliverable: seven systems that stored a card number became one. The document also says plainly that the API still handles one in flight, so the precise count is seven to one for storage and seven to two for handling, and that hosted fields are what close the gap.
- Token verification is costed because it sits on the hot path: HS256 97.0 us, RS256 260.0 us, ES256 463.6 us per verification, which is 10%, 26% and 46% of a core at a thousand requests per second. Verifying RSA is cheaper than verifying an elliptic curve, which surprises most people.
- Mutual TLS is proven with three real handshakes against a real listener, and the first version of that test was flaky one run in three. Under TLS 1.3 the client sends its certificate late, so `wrap_socket` can return successfully to a client that is about to be rejected. The test now asserts what the server recorded and that no application bytes came back, which is the property that actually matters.
- The audit log has two layers and two error codes, both verified on PostgreSQL 18.6: 42501 from the grant, which contains an attacker holding the application credentials, and 23001 from a statement level trigger, which catches the migration that means well. Truncate is tested beside delete, because revoking delete does not stop it.
- The timing attack on `==` could not be reproduced: 212.1 ns when the wrong secret differs at the first byte against 224.7 ns at the last, six per cent apart, with the sign moving between instruments. compare_digest costs 24 ns more and is used anyway, because it is nearly free and it removes a dependency on an implementation detail. The failed reproduction is reported rather than hidden.

## Where people get stuck

| Symptom | Cause |
|---------|-------|
| A valid token let a caller do the wrong thing | Authentication checked, authorisation not. A signature proves who, never what they may do. |
| A token from another service was accepted | No audience check. Every token says what it is for. |
| An attacker signed their own token | The algorithm was read from the token. Pin it in the code, always. |
| Rotation meant rewriting every card row | Data keys not used, so the master key is encrypting records directly. |
| A ciphertext was moved between rows and still decrypted | No context bound into the additional authenticated data. |
| A card number appeared in the logs | A denylist of fields to redact. Allowlist what may be logged, and test it. |
| The mutual TLS test passes sometimes | TLS 1.3 sends the client certificate after the handshake looks finished. Assert on what the server recorded and on no application bytes arriving, not on which exception the client saw. |
| The audit log had a gap | The application role could delete from it, or truncate it, so it was never an audit log. |

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

Part of [FinQuest](../../README.md) · Level 15 of 20
