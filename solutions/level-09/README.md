# Level 9: The life of a card payment

> **card-lifecycle: the service that knows what state every payment is in** · build project · difficulty 8/10

## Read this second

Attempt the build yourself first, then ask the FinQuest tutor for a hint, and only then open this folder.
Read the part you are stuck on, close the file, and retype the fix from memory. Copying the solution into
your own project skips the only step that actually teaches you anything.

## The brief

Build the service a payments company runs: authorise through a network that sometimes lies to you, capture in full or in part, void, refund, take chargebacks, expire abandoned holds, and resolve the requests that timed out. Then produce the report that explains where a week of money went.

**Scope:** Uses levels 4 to 8: the ledger, the money library, the API and what you learned about retries. The card network is a simulator you write, because no real one will time out on demand.

## Files here

| File | What it is |
|------|------------|
| `cards/states.py` | the state machine as data, plus the one guard every change goes through |
| `cards/network.py` | the simulator: declines, latency, timeouts, and references it remembers |
| `cards/payments.py` | authorise, capture including partial, void, refund, chargeback |
| `cards/expiry.py` | the job that releases holds nobody captured |
| `cards/resolve.py` | settling every unknown against the network report |
| `cards/report.py` | where the week of money went |
| `quiz-key.md` | all 15 drill answers with explanations |

## Run it

```bash
python -m cards.analyse && pytest -q && python -m cards.report
```

## Why the solution is shaped this way

- Authorisation writes a hold and no ledger entries, because no money has moved. Capture writes the balanced transaction. That one rule is what keeps the ledger reconcilable, and it is the rule beginners break: 4.88% of approvals in the shipped week expired uncaptured, and posting entries at authorisation would have turned $74,230.57 of them into revenue that has to be unwound by hand.
- unknown is a state, not an error. A timed out request has not failed and has not succeeded, and a model that cannot say so will guess. In this week it would have guessed 159 times, with $11,477.03 at stake.
- Every message carries our own reference, so a retry after a timeout is recognisable to the network rather than a second hold on somebody card. The simulator remembers references on purpose, so the difference is visible in a test.
- Cancelling is one rule with two implementations: uncaptured is a void, captured is a refund. A system that refunds where it could have voided is costing its merchants the processing fee quietly, and nobody complains because nothing looks broken.
- Decline codes are stored on the payment and classified hard or soft. 74.2% of the declines in this week were soft, worth $167,410.94, and retrying the other 25.8% is how a merchant loses approval rate and collects fines.
- Partial capture is modelled with separate authorised and captured amounts, and the released remainder is reported back, because the customer sees that hold disappear and the merchant needs to know it is not coming.
- The report reconciles: authorised $1,387,793.78, captured $1,234,167.87, refunds $48,140.30, chargebacks $6,152.18, net $1,179,875.39, and the $153,625.91 gap explained entirely by expiries, voids and partial captures.

## Where people get stuck

| Symptom | Cause |
|---------|-------|
| Reconciliation never balances | Entries were posted at authorisation. Only capture moves money. |
| A timeout produced two holds | The retry generated a new reference. Send the same one, and a reversal before retrying. |
| Approval rate falls over weeks | Hard declines are being retried. Classify the codes and stop on the hard ones. |
| A capture succeeded after expiry | The state machine is not consulting the expiry, or the expiry job never ran. |
| Refund amounts drift above the capture | Refunds are being summed against the authorised amount instead of the captured one. |

## Self-checks the solution satisfies

- The analysis reproduces 17,216 approvals, 15,842 captures, 841 expiries and 79 chargebacks
- Capturing an expired authorisation raises IllegalTransition
- Capturing twice raises, and the second attempt returns 409 through the API
- Voiding a captured payment raises, and cancelling it refunds instead
- Refunding more than was captured raises
- Authorising posts no ledger entries, and capturing posts a transaction that sums to zero
- A partial capture of 5000 on a 7140 authorisation reports 2140 released
- A retry to the simulator with the same reference produces one hold, not two
- A timed out authorisation leaves the payment in unknown with the reference stored
- The resolver moves every unknown to a final state and reports how many were approved
- A hard decline is never retried, and a soft decline is retried at most the configured number of times
- The expiry job is safe to run twice and reports zero the second time
- The money report adds up: captured minus refunds minus chargebacks equals the net figure

## How it is marked

| Points | Criterion | Meaning |
|--------|-----------|---------|
| 25 | The lifecycle is real | Every state, every legal move, every illegal move refused with a test, and unknown modelled properly. |
| 20 | The ledger is right | Nothing at authorisation, balanced entries at capture, refunds as new transactions, partial captures handled. |
| 20 | Failure handled | A simulator that times out, references that make retries safe, and a resolver that settles the unknowns. |
| 20 | Declines understood | Codes stored, hard and soft separated, a retry policy with limits, and the recoverable value reported. |
| 15 | Explained to a merchant | The money report, the authorised-but-never-captured gap, and a README that reads like a product. |

---

Part of [FinQuest](../../README.md) · Level 9 of 20
