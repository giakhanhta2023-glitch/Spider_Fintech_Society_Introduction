# 2. Every service stores a token, and one stores card numbers

**Status** accepted · **Date** 2026-09-25 · **Deciders** the author

## Context

Six services touch a payment. Without a decision, each one stores whatever it
receives, and a card number ends up in the ledger, the reporting replica, the
warehouse, the backups and eventually a log line. Level 15 counted the cost: seven
systems in scope rather than one, and every one of them audited, hardened and
evidenced every year.

## Options

**A. Encrypt the card number in each service.** Every service holds a key, so
every service is in scope, and now there are six key rotations instead of one.

**B. One vault, tokens everywhere else.** The vault stores sealed card numbers and
issues meaningless tokens. One service can produce a card number.

**C. Never hold card numbers at all: hosted fields.** The processor's form posts
the card directly from the browser and returns a token, so the card never reaches
any service of ours.

## Decision

**B**, with **C** recorded as the next step rather than as a rejected option.

The capstone's API still handles a card number for the few milliseconds between
parsing the request and calling the vault, so the strictly accurate count is one
system storing and two handling. Hosted fields remove the second, and that is a
change to the checkout page rather than to this platform.

## Consequences

**The token is random.** Not an encrypted card number, not a hash: if a token
could be turned back into a card number by anybody holding a key, obtaining that
key would obtain every card, and the vault would have bought nothing.

**Tokens are stable.** The same card produces the same token, so the analytics
question "how many customers use one card across merchants" is answerable in the
warehouse with no card number anywhere near it. The index that makes that work is
keyed by an HMAC of the card number rather than by the card number.

**The vault is a hard dependency on the payment path.** When it refuses, no new
card can be taken. Chaos scenario four measures exactly that: every payment
returned 503 within five milliseconds of the credential being revoked, with the
dependency named in the error, and nothing was half written.

**Availability was traded for blast radius, deliberately.** One service that can
fail, against six that can leak. The reverse trade is available and is the wrong
one for card data.
