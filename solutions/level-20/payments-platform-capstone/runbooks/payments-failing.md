# PaymentsFailing

**Reviewed** 2026-09-25 · **Owner** the author · **Objective** payments availability, 99.9% over 30 days

## What it means

Payments are failing at more than 14.4 times the rate the error budget allows.
Customers are being turned away at checkout.

Measured in the capstone: the alert fires **27 ms** after the ledger becomes
unavailable, with the two hundred payments offered during the outage all refused
and none half written.

## Check, in this order

1. **Is the ledger reachable?** The payment path refuses with 503 and the error
   names the dependency. `python -m recon.daily` afterwards is the proof that
   nothing was half written.
2. **Is the vault refusing?** A different alert fires for that, and both can be
   true at once. The error body names which.
3. **Deploys in the last hour.** If the rise starts within two minutes of one,
   roll back before reading further: level 17's rollback is 6.8 ms by switching
   and 636 ms if the idle side has to be redeployed.
4. **One instance or all of them?** The worst instance panel, not the aggregate.

## Do

Mitigate first. Roll back if a deploy is in the window, remove the bad instance if
it is one instance, and turn the feature flag off if the change is behind one.
Diagnose afterwards, with the incident still open and the customer no longer paying
for the investigation.

## Do not

Do not restart everything to see if it helps: it destroys the state that explains
the incident. Do not add retries to a failing path during the incident, which
multiplies load on the thing already failing.

## After

Run `python -m recon.daily`. The capstone's claim is that a database outage costs
zero breaks, and the way that claim stays true is by checking it every time rather
than trusting it.
