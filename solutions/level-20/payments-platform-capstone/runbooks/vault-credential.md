# VaultRefusingCredential

**Reviewed** 2026-09-25 · **Owner** the author · **Objective** payments availability

## What it means

The vault is rejecting the gateway's credential. No new card can be tokenised, so
no new card can be charged. Payments on stored tokens continue, which is the
reason tokens exist.

Measured: the alert fires **5 ms** after the credential is revoked, every payment
during the revocation returned 503 with the dependency named, and nothing was
written: no ledger entry, no event, no payout.

## Check

1. **Was the credential rotated?** A rotation that deployed the new secret to the
   vault and not to the gateway looks exactly like this, and it is the cause most
   of the time.
2. **Was it revoked on purpose?** A security response to something else is a
   different conversation, and the answer changes what you do next.
3. **Is it expiry rather than revocation?** The error text distinguishes them.

## Do

- **Rotation gone wrong**: restore the previous credential, which the vault still
  accepts during the rotation window, then redo the rotation in the right order:
  the vault accepts both, the gateway moves, the old one is retired.
- **Deliberate revocation**: this is an availability incident with a security cause
  and the security decision comes first. Say so on the status page rather than
  quietly restoring the credential.

## Do not

Do not hard code a credential to get the platform back. It ends up in the image,
which is public to anybody who can pull it, and level 15 spends a level on why
that is worse than the outage.

## After

The interesting question is why a credential rotation could take payments down at
all. The answer is a rotation window: the vault should accept the old and the new
credential for long enough that the order of deploys does not matter, which is
exactly the webhook secret rotation from level 15 applied to a different secret.
