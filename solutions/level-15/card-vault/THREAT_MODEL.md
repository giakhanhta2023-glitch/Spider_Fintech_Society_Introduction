# Threat model: card-vault

Written before the code. That order is the only thing that makes a threat model
worth reading: written afterwards, it describes whatever you happened to build
and calls the result a design.

One sentence sets up everything below.

> A card number may exist in two processes, for the length of one request each,
> and nowhere else at all.

Reviewers: read [what we do not defend against](#what-we-do-not-defend-against)
first. It is the shortest way to find out whether this design is wrong for your
situation, and it is the section a threat model is usually missing.

## What is worth stealing

| Asset | Where it lives | Worth to an attacker | If it leaks |
|---|---|---|---|
| Card number (PAN) | Sealed rows in the vault. In memory in the API and the vault, for one request | Direct fraud, and a resale price per card | Every card reissued by its bank, a reportable incident, and the end of the company's card processing |
| CVV | Nowhere. Refused at the boundary by `NEVER_STORED` in `vault/tokens.py` | With a PAN, card not present fraud | Cannot leak from here, because it is never here |
| Data keys | Wrapped, in the same row as the ciphertext they opened | One batch of at most 100 records, and only with the master key as well | That batch, and only if the key service fell too |
| Master key | Inside the key service. Never in this process, and no method returns it | Every record ever written | Total. Envelope encryption has nothing left to offer past this point |
| Client certificate and OAuth client secret | The payments service's deployment secrets | It becomes the payments service | Card numbers at the vault's rate limit, every read recorded |
| Webhook signing secret | Our sender, and each receiver | Forged events: captures that never happened, refunds that were never issued | Downstream systems act on payments that do not exist |
| Tokens | Everywhere. The ledger, the warehouse, the logs, the backups | Nothing outside the vault. That is the entire design | A list of meaningless strings |
| Audit log | Postgres, append only, owned by a role the application is not | It is the record of who read what | You lose the ability to say what an attacker took |

## Who we are defending against

Ordered by how likely each one is, which is not the order they are usually
written in.

| Attacker | What we assume they have | What they get |
|---|---|---|
| A future engineer adding a field to a log line | A pull request, and good intentions | Nothing, and the build fails. The likeliest event in this table is an accident, not an attack (test 15) |
| A stolen backup, or a database dump in an open bucket | Every byte of storage | Ciphertext and wrapped data keys. No card numbers: the master key was never in the dump |
| SQL injection in a service that holds tokens | Read of whatever that service can read | Tokens, BINs, last fours. No route to a card number, because the token is not the ciphertext and there is no key involved |
| Read access to the vault's own database | The sealed rows | The same as the backup. Useless without the key service |
| A caller holding a valid token for a different service | A signed, in date JWT with the wrong audience | Nothing. Audience, issuer, expiry and algorithm are all checked, and the algorithm is pinned in code (tests 8, 9, 10) |
| Somebody on the network between payments and the vault | The ability to open a connection | Nothing. Refused during the TLS handshake, before there is a request to authorise (test 11) |
| A forged or replayed webhook | Our public endpoint, and a captured request | Nothing. The timestamp is inside the signed string and the window is five minutes (tests 12, 13, 14) |
| Somebody covering their tracks | The application's database role | Nothing. Update, delete and truncate are all 42501 (test 16) |
| The payments service itself, compromised | A valid client certificate and a token carrying `vault:read_pan` | **Card numbers**, at the rate the vault allows, with every read in the audit log. See the residual risk section: this one is detection, not prevention |

## Controls, and the proof of each

| Control | Mechanism | Proof |
|---|---|---|
| The master key never leaves the key service | `vault/keys.py` exposes wrap, unwrap, rotate, rewrap and retire. Nothing returns a master key | `test_the_master_key_cannot_be_obtained` |
| A ciphertext is useless in another row | The record id is bound in as additional authenticated data | `test_a_ciphertext_moved_to_another_record_fails_to_decrypt` |
| Key service calls are affordable | One data key per 100 records, not one per record | `test_envelope_makes_two_orders_of_magnitude_fewer_calls` |
| A rotation is survivable | Rewrap the data keys, two master versions readable at once, retire only what nothing references | Three tests, including `test_a_rotation_rewrites_no_card_row` |
| A token carries no information | 32 random bytes. The PAN index is keyed by HMAC, so the lookup table is not itself a list of card numbers | `test_the_same_card_produces_the_same_token_and_reveals_nothing` |
| One function in the company returns a card number | `Vault.detokenise`, scope checked before anything is decrypted | `test_detokenising_without_the_scope_raises` |
| A CVV cannot be stored | `NEVER_STORED` refuses the field at the boundary, in any casing | `test_a_cvv_can_never_be_stored` |
| Callers are authenticated twice | Mutual TLS at the connection, a scoped short lived token in the request | `tests/integration/test_mtls.py`, and the four JWT tests |
| Webhooks cannot be forged or replayed | HMAC over timestamp and raw body, versioned header, two secrets accepted during a rotation, `compare_digest` | Six webhook tests |
| A card number cannot reach a log | An allowlist of fields, plus a redactor for free text that keeps the BIN and last four | `test_no_pan_reaches_the_logs_but_the_bin_and_last_four_do` |
| The record of card reads cannot be edited | The application role holds select and insert only. A statement level trigger refuses update, delete and truncate even for the table's owner | `tests/integration/test_audit_role.py`, and `sql/001_audit_log.sql` |

## What we do not defend against

Named, because a control that is missing on purpose and a control that is
missing by accident look identical from outside.

1. **A compromised vault process.** Code running inside the vault, with its key
   service credentials, can decrypt anything the vault can decrypt. Envelope
   encryption does not help here and was never meant to: it limits what a
   *stolen database* is worth, not what a *stolen process* is worth. What is
   left is the audit log, the rate limit and how fast anybody notices.
2. **A compromised key service, or the cloud account holding it.** Whoever
   holds the master key holds every record. This is the reason the real thing is
   a hardware backed service with its own audit trail and its own access policy,
   and the reason nobody should be able to grant themselves that policy alone.
3. **Somebody holding the client certificate and the client secret at once.**
   They are the payments service as far as the vault can tell, and no check in
   this code can distinguish them from it. Certificates are per environment and
   per service, so the blast radius is one service in one environment.
4. **An insider who can both deploy code and approve their own change.** That is
   a process control, and no amount of code substitutes for it. Two reviewers on
   anything touching `vault/`, and the review requirement enforced by the
   repository rather than by agreement.
5. **Memory.** While the vault holds a plaintext PAN and a plaintext data key,
   anything that can read the process memory can read both: a core dump, a
   debugger, a crash reporter that helpfully attaches heap state. Python cannot
   zero a `bytes` object, so this is accepted rather than mitigated.
6. **Availability.** The vault is a single point of failure by design. When it
   is down, no card can be charged. That is level 14's problem and level 17's
   problem, and the tradeoff is taken deliberately: one system that can fail is
   better than seven that can leak.
7. **Traffic analysis.** Request volume and timing leak how many cards are being
   read and roughly when. The audit log leaks the same thing to anyone who can
   read it, which is why it is not readable by the application.
8. **Side channels below the library.** We rely on the `cryptography` package
   for constant time AES-GCM and HMAC. A cache timing attack on the primitive
   itself is out of scope, and if that assumption breaks it breaks for most of
   the industry at once.
9. **Everything before the card number reaches us.** The cardholder's device,
   phishing, a compromised checkout page, a merchant employee with a phone
   camera. Hosted fields move this boundary further away, which is the next step
   after this design and is discussed in [SCOPE.md](SCOPE.md).
10. **The audit table's own owner dropping the trigger.** The trigger stops a
    careless migration, not a determined owner. What contains the owner is that
    the application never connects as one.
11. **A future with cheap quantum computers.** AES-256 is not the worry; the RSA
    in the TLS and token paths would be. Nothing here is designed for that day,
    and pretending otherwise would be the only dishonest line in this file.

## Where a card number is allowed to exist

**Allowed, and only these:**

- In the API process, from the moment the request body is parsed until the
  vault returns a token. One request, one lifetime.
- In the vault process, during `seal` and during `open_`.

**Never, under any circumstance, in any form:**

a log line, a metric label, a trace attribute, an exception message, a stack
trace, a queue message, a webhook body, a support tool, a spreadsheet, an
email, a chat message, a bug report, a test fixture that is not a published
test number, a comment, a commit message, or a cache.

Two of those are enforced by code in this repository (`vault/logging_.py` for
logs, `NEVER_STORED` for CVVs). The rest are enforced by review, which is a
weaker mechanism, which is why the list is written down where a reviewer will
find it.

## The residual risk we accept, and what we do about it

The honest gap is number 1 in the list above, and its cheaper cousin: an
attacker with the payments service's credentials. Prevention is not available,
so the budget goes on making it small, slow and loud.

- **Small.** One data key per 100 records, so an exposed data key is 100 cards
  rather than all of them. Tokens are what everything else stores, so there is
  nothing to steal from six of the seven systems.
- **Slow.** The vault rate limits per client, using the level 14 token bucket.
  Reading a million cards through a per client limit takes long enough to be
  noticed, and the limit is set from the real access pattern: almost nothing
  ever needs `vault:read_pan`, so almost nothing holds it.
- **Loud.** Every detokenisation is one row in an append only audit log, and the
  alert is on the rate rather than on the event. A support agent reading one
  card is normal. Four hundred in a minute is not, and nothing in the product
  needs to.

Tokens are short lived (five minutes) and scoped, so a captured token is worth
five minutes of exactly one permission. That is the difference between an
incident and a breach.

---

Part of [FinQuest](../../../README.md) level 15. Every card number in this
repository is a published test number.
