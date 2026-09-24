# Scope: who can see a card number

This is the document the auditor reads, the document the security review starts
from, and the one an interviewer will ask about if you mention tokenisation. It
is also the argument for the whole level, which is why it is two pages of
tables rather than a paragraph of intent.

Every system that can see a card number has to be access controlled, hardened,
patched, logged, penetration tested and evidenced. Every year. Forever. The
number of such systems is therefore the number that decides what the work
costs, and tokenisation is how that number goes down.

## Before: seven places a card number lives

The FinQuest system as of level 14, with no vault.

| # | Component | Built in | What it holds |
|---|---|---|---|
| 1 | `payments-api` | Level 7 | The card number on the payment request, stored on the payment row |
| 2 | `ledger-db` | Level 6 | The card number copied into the transaction description, because somebody needed it in a report once |
| 3 | `card-lifecycle` | Level 9 | The card number beside every authorisation, capture, refund and chargeback |
| 4 | `reconcile` | Level 10 | Settlement files from the processor, which contain full card numbers, kept for the dispute window |
| 5 | Reporting replica | Level 13 | Everything above, replicated, queried by more people than can be listed |
| 6 | Backups and write ahead log archives | Levels 6, 13 | All of it again, for the retention period, in a different system with different access rules |
| 7 | Logs and traces | Levels 14, 16 | Card numbers in request bodies, in error messages, in one debug line added during an incident and never removed |

Seven. Note what numbers 5, 6 and 7 have in common: nobody decided to put card
numbers there. Replication, backups and logging are how data arrives in systems
nobody meant to include, and they are the three that get discovered late.

## After: one place, and one that passes it along

| # | Component | What it holds now | In PCI scope |
|---|---|---|---|
| 1 | **`card-vault`** | Sealed card numbers, wrapped data keys, the token mapping | **Yes.** Its entire purpose is to be the audited system |
| 2 | `payments-api` | A token, a BIN, a last four. Handles a card number in memory for one request, stores none | Yes for handling, no for storage. See the next section |
| 3 | `ledger-db` | `tok_...`, and `last4` where the description used to hold the number | No |
| 4 | `card-lifecycle` | `tok_...` | No |
| 5 | `reconcile` | `tok_...`. Settlement files are tokenised on arrival, in the vault, before anything else reads them | No |
| 6 | Reporting replica | `tok_...` | No |
| 7 | Backups and archives | Tokens. A stolen backup is a list of meaningless strings | No |
| 8 | Logs and traces | `bin`, `last4`, `token`. Enforced by an allowlist and a test | No |

**Seven systems storing card numbers became one.** Six audits stopped being
necessary, six sets of access reviews, six penetration test scopes, six
retention arguments with the legal team.

## The honest part

The count above says "seven to one", and the level says the same thing, because
that is the count of systems that **store** a card number. The API still
**handles** one: the number arrives in a request body and lives in that process
for a few milliseconds before the vault hands back a token. A few milliseconds
in memory is still in scope, and an auditor will say so.

So the precise version is:

| Measure | Before | After |
|---|---|---|
| Systems storing card numbers | 7 | 1 |
| Systems handling card numbers | 7 | 2 |
| Systems whose backups contain card numbers | all of them | 1 |

The next step, and the reason every payment processor sells it, is **hosted
fields**: the card form posts directly to the processor from the browser, the
processor returns a token, and the card number never touches your API at all.
Stripe Elements, Adyen Components and Checkout.com Frames are all the same idea.
Then the count is one, exactly, and that one is somebody else's.

This solution deliberately does not use hosted fields, because building the
vault teaches the mechanism and integrating hosted fields teaches an SDK. In
production, use the SDK: the argument for owning a vault is legacy data,
multiple processors, or a regulator asking, and not much else.

## What the conversion cost

The scope table is the win. It is fair to write down the price of it.

| Change | Where | Work |
|---|---|---|
| Add `token`, `bin`, `last4`. Stop writing `pan` | Four services, one schema each | Level 13's expand and contract, done four times |
| Backfill existing rows through the vault | 415,554 payment rows | Batched, resumable, 10,000 at a time. The lock duration is the number that matters, not the total |
| Rewrite the queries that parsed the card number | Reporting and the support tool | `right(pan, 4)` became `last4`, which is faster as well as safer |
| Replace one screen in the support tool | Support | The agent sees `411111 ****** 1111` and a token. Card reads now need a reason and appear in the audit log |
| Tokenise settlement files on arrival | `reconcile` | One extra step in the pipeline, before anything else reads the file |
| Accept a new failure mode | Everywhere | If the vault is down, no card can be charged. See the availability entry in [THREAT_MODEL.md](THREAT_MODEL.md) |

## What got easier, beyond the audit

- **Log retention stopped being a legal question.** Logs holding tokens can be
  kept as long as they are useful.
- **Backups stopped being a liability.** A dump on a laptop is no longer an
  incident.
- **The analytics request became a yes.** "How many customers use the same card
  across merchants" is answered with a stable token, in the warehouse, with no
  card number anywhere near it. That is the exchange worth remembering: the
  request was for an identifier, and nobody ever needed the card number.
- **Incidents got shorter.** "Which systems were affected" has a written answer
  instead of a two day investigation.

## How to prove it, rather than claim it

Claims in this document are checkable, and a claim nobody can check is a claim
that quietly stops being true.

- A test asserting no table outside the vault has a column named `pan`,
  `card_number`, `cc`, or anything matching the same pattern.
- The allowlist test in the vault's suite, which fails the build if a card
  number can reach a log line.
- A grep in continuous integration for card shaped literals in source and in
  fixtures, with the published test numbers as the only exceptions.
- The audit log, which answers "who read a card number last month" as a query
  rather than as an investigation.

---

Part of [FinQuest](../../../README.md) level 15. Every card number in this
repository is a published test number.
