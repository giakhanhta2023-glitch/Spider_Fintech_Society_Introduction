# PayoutsUnknown

**Reviewed** 2026-09-25 · **Owner** the author · **Objective** payouts correctness, and this one has no error budget

## What it means

At least one payout is in an unknown state: the bank was called and did not answer,
so the money may or may not have moved. This pages at any hour for any amount,
because nothing about it resolves itself and no other metric shows it.

Measured: the alert fires **87 ms** after the bank starts timing out, and every
unknown payout was resolved by the sweeper with zero reconciliation breaks.

## Check

1. **Is the sweeper running?** It resolves these automatically by asking the bank
   about `our_reference`, which was generated before the first attempt. A dead
   sweeper is the most likely cause of the alert persisting.
2. **How many, and are they growing?** One is a stuck record. Forty is an incident
   with a shared cause, usually the bank.
3. **What does the bank say?** `bank.status(our_reference)` is the question that
   ends the case. They have it or they do not.

## Do

There are exactly three outcomes and guessing between them is what this design
exists to prevent:

- **The bank has it and it succeeded.** Mark the payout paid and post the ledger
  entry. The sweeper does this automatically.
- **The bank has it and it failed.** Compensate. The compensation is idempotent by
  constraint, so running it twice credits the merchant once.
- **The bank never saw it.** Compensate, then retry with **the same reference**. A
  new reference is how one payout goes out twice.

## Do not

Never mark a payout final without knowing which of the three it is. Never run a
manual credit alongside a compensation: two corrections for one problem is a
reconciliation break tomorrow.

## After

The postmortem question is **"why did the sweeper not resolve it"** rather than why
it got stuck, because the sweeper is the control and this alert firing for more than
a few minutes is the control having failed.
