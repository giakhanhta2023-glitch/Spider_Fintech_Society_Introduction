# ReconciliationBreaksAboveBaseline

**Severity** ticket, not a page · **Objective** reconciliation
**Owner** payments team, with finance · **Last reviewed** 2026-09-24

## What this means

Yesterday's reconciliation run produced more unexplained differences than a
normal day does. The service is healthy, every request succeeded, and the money
does not match.

This is a ticket rather than a page for one reason: the money is already wrong,
it went wrong hours ago, and five more minutes will not make it worse. Waking
somebody buys nothing. Ignoring it for a week costs a great deal.

## The baseline

Level 10's day produced 193 amount mismatches worth $1,180.96, all of them
explainable: fees not accounted for, rounding on multi currency settlements, and
timing across the day boundary. That is what a normal day looks like, and the
threshold sits above it because the alert is about a **change** rather than about
the existence of breaks.

An alert set at zero breaks would fire every single day and be muted within a
week. The count is not the interesting part; the composition is.

## Check first

1. **Group the breaks by type.** The types have different meanings and only one
   of them is an emergency:
   - **missing on our side**: the processor settled something we have no record
     of. Rare and serious.
   - **missing on their side**: we think we captured something they never
     settled. Usually timing, sometimes a real lost capture.
   - **amount mismatch**: fees, rounding, currency. Nearly always explainable and
     the bulk of the baseline.
   - **duplicate**: the same payment settled twice. Money moved twice, and this
     one escalates immediately.
2. **Compare the composition with last week**, not the count. Two hundred amount
   mismatches is Tuesday. Twenty missing on our side is a problem.
3. **Check what changed in the pipeline.** A new fee type, a processor file
   format change, a timezone change, or a deploy that touched the settlement
   import. The traffic did not change; something in the code or the file did.

## What to do

- Amount mismatches with a new pattern: add the explanation as its own break type
  rather than widening a tolerance. Level 10's rule, and the reason is that a
  widened tolerance hides the next real break inside it forever.
- Missing on our side: find the payment at the processor, then find out why our
  side has no record. This is the one that finds lost captures.
- Duplicates: stop, escalate, and check the idempotency key path. Money moving
  twice is an incident even though nothing paged.
- Anything genuinely unexplainable after an hour: write it down as unexplained
  with the amount, and take it to the monthly review. An unexplained break that
  gets quietly closed is the one that comes back as an audit finding.

## What not to do

- Do not resolve breaks by hand in the database. Breaks have stable ids derived
  from what they are, so a break that stops appearing is resolved automatically
  with a reason. Editing them by hand loses the history that makes the next run
  meaningful.
- Do not widen the threshold. If the baseline has genuinely moved, that is a
  sentence in the review with the composition table attached.

## Escalation

Any duplicate settlement, or more than five missing on our side: page the service
owner and tell finance the same day. Everything else waits for the review.
