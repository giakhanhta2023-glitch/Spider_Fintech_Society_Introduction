# reconcile

The job that runs before anybody arrives, and the reason somebody arrives.

```bash
pip install -r requirements.txt
python -m recon --ledger data/level-09-card-events.csv \
                --settlement data/level-10-settlement.csv \
                --payouts data/level-10-payouts.csv
pytest                      # 19 tests against the shipped files
```

Exits non-zero when there is unexplained value, so a schedule notices.

## What it finds in the shipped week

```
ledger movements        16,613
settlement lines        16,639

matched exactly         16,408
matched, converted         163
matched, amount off         30
match rate              99.93%

breaks by type
        amount_mismatch            30          $14.19  payments engineering
        currency_rounding         163       $1,166.77  payments engineering
        duplicate_settlement        1         $104.12  processor operations
        missing_in_ledger          37       $3,116.61  payments engineering
        unsettled_capture          12       $1,690.07  processor operations

unexplained value                        $4,924.99
```

## The finding

**The duplicated settlement line was paid out.**

Line `S016638` repeats `S000926`: the same capture of `P008131`, $104.12 gross,
$100.80 net, both dated 2026-05-05.

The payout check passes. Every one of the 59 payouts equals the sum of the
lines that settled that day, including this one. That is exactly the problem:

```
payout PO-2026-05-05 states           $51,709.53  over 662 lines
sum of that day's lines               $51,709.53
sum excluding the duplicate           $51,608.73
```

The payout is correct against a file that is wrong, and $100.80 left twice.

Neither check catches it alone. The payout check says the payout matches the
file; the duplicate check says the file has a line in it twice. Only together
do they say the merchant was paid twice, and that is the argument for having
both rather than the one that looks more thorough.

## The 193, and why they are two different things

The level counts 193 amount mismatches worth $1,180.96. Reporting that as one
number would be a mistake, because it is two unrelated findings:

| | Count | Value | What it is |
|---|---|---|---|
| `currency_rounding` | 163 | $1,166.77 | Settled in EUR, converted at 1.0961. Arithmetic, not error |
| `amount_mismatch` | 30 | **$14.19** | Same payment, same kind, different amount in USD |

The 163 are 99% of the value and 0% of the problem. The 30 are $14.19 and
somebody should look at them. A report that adds them together hides the second
inside the first, which is the commonest way a reconciliation becomes
decorative.

## The tolerance, and what I do with tolerated differences

**Amounts: zero tolerance.** A payments reconciliation with an amount tolerance
is one that will eventually hide a real problem inside it, and "a cent here and
there" is how people describe a bug before they understand it. Currency
rounding is handled by giving it its own break type, not by widening a
threshold until it disappears.

**Fees: one cent.** The processor rounds a converted amount and we cannot
reproduce their intermediate value exactly, so a one cent difference is
provable rounding. Two is a different fee schedule and somebody should look.
That single cent takes the fee findings from 218 lines to 51.

Tolerated differences are **recorded, not discarded**. They appear in the
report with their own type and their own total, they accumulate in the
exception queue, and if the currency_rounding total ever starts growing, that
is a signal rather than a silence.

## The effective fee rate

```
under $10         568 captures       $4,122.57  fee     $289.83    7.03%
$10 to $50      7,021 captures     $205,204.76  fee   $8,059.48    3.93%
$50 to $200     7,221 captures     $688,114.54  fee  $22,122.63    3.21%
over $200       1,058 captures     $339,419.42  fee  $10,160.36    2.99%
```

The headline rate is "2.9% plus 30 cents". The 30 cents is the whole story: on
a $5 coffee it is six percent on its own, and a merchant selling small items
pays **more than twice** the rate they were quoted. This table is the one
finance actually asks for, and almost nobody builds it.

## The 37, and the change that stops them

37 settlement lines name movements we have no record of, worth $3,116.61.

They are all captures, and all of them have a payment id our ledger knows about
at authorisation but not at capture. The pattern is the level 9 `unknown`
state: the capture request timed out, our side recorded nothing, and the
processor captured anyway. Our ledger is missing an event that genuinely
happened.

The fix is not in this job. It is the level 9 resolver, applied to captures as
well as authorisations: a capture that times out goes to `unknown` with its
reference stored, and a sweeper settles it against the processor rather than
leaving our ledger short. This reconciliation would then find nothing, which is
the correct outcome for a reconciliation.

Until that ships, these 37 are corrected by inserting the missing capture
events from the settlement file, with a note saying where they came from, and
that correction is itself a reconciliation break worth counting.

## The exception queue

Breaks persist between runs with a stable id derived from what the break *is*,
not when it was found:

```python
break_id = sha256(f"{type}|{key}|{kind}").hexdigest()[:16]
```

An id that changed between runs would produce a new ticket every night for the
same problem, and the aging report would be meaningless.

Running the job twice changes nothing: same breaks, no duplicates, nothing
reopened. There is a test asserting it, because a reconciliation somebody has
to remember to run is one that stops happening in December.

A break that stops appearing is **resolved automatically** with a reason
rather than left open forever. The third case is the one people forget.

## Tests

```
19 passed in 1.79s
```

Every headline figure is asserted against the shipped files, including the
split of the 193. Plus: pending is not a break at two days and is at five, the
window is configuration, every payout reconciles, the duplicate was paid, the
fee recomputation, the rate table, idempotency across runs, stable ids, and a
test that nothing is silently dropped, which is the one that catches a
classifier quietly ignoring a case.

## Limitations

- Matching is on `(payment_id, kind)`. A processor that does not return our
  payment id needs a fuzzy pass on amount and date, which is a different and
  much harder problem.
- One duplicate is detected per key. Three copies of the same line would report
  two duplicates, which is right, but the message says "repeats a movement"
  rather than naming which one.
- The exception queue is a JSON file. It is the right size for this and the
  wrong size for a team: level 6's database is where it belongs.
- No representment. A chargeback that is later won reverses again, and that
  event is not modelled here.
