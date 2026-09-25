# PayoutsStuckInNonFinalState

**Severity** page · **Objective** payouts correctness, zero tolerated
**Owner** payments team · **Last reviewed** 2026-09-24

## What this means

At least one payout has been in a non final state for more than fifteen minutes
with the merchant already debited. Money has been taken and no payment exists to
show for it.

This is the only alert here with no error budget. One occurrence that persists
is a page at any hour, whatever the rate and whatever the percentage. The reason is
level 12: nothing about this resolves itself, nothing else in the system reports
it, and every minute it stays true is a merchant whose balance is wrong.

## Check first

1. **The sweeper.** It should have picked this up within its interval. Is it
   running, is it claiming rows, and is it erroring? The whole design assumes the
   sweeper exists, so a dead sweeper is the single most likely cause.
2. **The payout's state and its `our_ref`.** The reference was generated before
   the first attempt, which means the bank can be asked about it. That question
   is the one that resolves the case: they have it, or they do not.
3. **The number of affected payouts.** One is a stuck record. Forty is an
   incident with a shared cause, usually the bank API or a deploy.

## What to do

Resolve the state. There are exactly three outcomes, and guessing between them
is the thing this whole design exists to avoid:

- **The bank has it and it succeeded.** Move the payout to paid. The debit was
  correct and nothing else is needed.
- **The bank has it and it failed.** Compensate: the compensation is idempotent
  by constraint, so running it is safe even if somebody else already did. The
  merchant gets the money back and the payout ends at compensated.
- **The bank never saw it.** Compensate, then decide whether to retry with the
  same reference. Never retry with a new reference: that is how the same payout
  goes out twice.

Never mark a payout final without knowing which of the three it is. `failed` is
in the final state set precisely because the naive version of this service wrote
it and walked away, leaving the merchant debited and no query in the system able
to say so.

## What not to do

- Do not run a manual credit alongside a compensation. Two corrections for one
  problem is a reconciliation break tomorrow and a hard conversation next week.
- Do not clear the alert by editing the state. The alert is measuring the
  problem, not causing it.

## Escalation

More than five stuck payouts, or any payout older than an hour: page the service
owner and tell finance. They would rather hear it from an engineer than from the
merchant, and the amounts are usually large enough that somebody will ask.

## After

Every one of these has a cause worth writing down, and the postmortem question is
not "why did it get stuck" but "why did the sweeper not resolve it", because the
sweeper is the control and this alert is its failure being detected by something
else.
