# card-lifecycle

The service that knows what state every payment is in, including the ones the
network never answered about.

```bash
pip install -r requirements.txt
python -m cards.analysis data/level-09-card-events.csv
pytest                      # 26 tests, no database, no network
```

## The week it reproduces

Run against the shipped 37,987 events, this prints:

```
authorisations              20,000
approved                    17,216    86.08%
declined                     2,625
timed out                      159
captured                    15,842    92.02% of approvals
voided                         533
expired                        841
refunded                       692
charged back                    79    0.499% of captured

authorised                   $1,387,793.78
captured                     $1,234,167.87
refunded                        $48,140.30
charged back                     $6,152.18
net                          $1,179,875.39
authorised, never taken        $153,625.91
```

Two of those lines are worth stopping on.

**159 authorisations timed out.** Not approved, not declined: no answer. In
this codebase they land in `unknown`, which is a state rather than an error,
and the resolver settles them against the network later. Treating them as
failures is how a cardholder gets charged twice, once by the request that timed
out and once by the retry.

**$153,625.91 was authorised and never taken.** That is 11% of everything
authorised, held against real people's cards and then released. It appears in
no revenue report, and it is the reason for the "why is there a pending charge
for something I did not buy" support ticket.

## The state machine

Written as a table rather than as conditionals, so the whole thing can be
printed, tested cell by cell, and seen at once:

```
requested ─auth──▶ authorized ─capture─▶ captured ─refund──────▶ refunded
    │                  │                    │
    │                  ├─void──▶ voided     └─chargeback─▶ charged_back
    │                  └─expire▶ expired
    ├─decline─▶ declined
    └─timeout─▶ unknown ──▶ resolver ──▶ authorized or declined
```

Everything not in the table is illegal, which is the useful direction: a
transition nobody wrote down cannot happen by accident. There is a test that
walks eight illegal ones and asserts each raises.

One transition surprises people and is deliberate: **refunded → charged_back**.
A cardholder can dispute a payment that has already been refunded. It happens,
so the table allows it.

The amount rules live in a separate `Guard` rather than in the table. The table
answers "is this event allowed from this state" and the guard answers "is this
particular amount allowed". Merging them produces a table with conditions in
it, which stops being readable at about the fourth rule.

## Four decisions worth defending

**Authorising posts no ledger entries.** A hold is a promise by the issuer, not
a movement of money. Posting entries at authorisation is the most common way a
card ledger ends up disagreeing with the processor, because 11% of holds in the
week above were never captured. Money moves at capture, and there is a test
asserting the ledger is empty after an authorisation.

**The reference is generated once, at creation, and stored before the first
attempt.** Everything else depends on it: the network deduplicates on it, and
the resolver has nothing to ask about without it. A reference generated per
attempt turns one payment into several.

**Every event is idempotent, not only authorisation.** A capture retried
because a response was lost must not capture twice, and the same is true of
refunds and chargebacks. Each takes an optional `event_key` and returns the
original outcome on a repeat.

**One `cancel` rule for callers.** Uncaptured is a void, captured is a refund.
Making the caller choose is how a void gets attempted on a captured payment at
the exact moment somebody is trying to give money back.

## Hard declines and soft ones

| | Examples | Retry? |
|---|---|---|
| **Hard** | `expired_card`, `invalid_account`, `suspected_fraud` | Never. It cannot succeed |
| **Soft** | `insufficient_funds`, `do_not_honour`, `issuer_unavailable` | Yes, with growing delays |

An unrecognised code is treated as **hard**, deliberately. Treating it as soft
means retrying something the issuer may consider abusive; treating it as hard
costs one recoverable payment and produces a line in the report saying a code
needs classifying.

The delays grow to a day, because "insufficient funds" on a Tuesday morning is
a different answer from the same code on Friday afternoon after payday.

## The bug this design is built to prevent

The simulator records a timed out authorisation **before** raising:

```python
if roll < self.timeout_rate:
    self._seen[reference] = held      # it happened
    raise NetworkTimeout(reference)   # you just do not know it
```

That is what a real timeout is: the far side may well have done the work and
the answer was lost coming back. A simulator that only times out on requests it
did not process is a kinder world than the real one, and testing against it
proves nothing.

So a timeout goes to `unknown` with the reference stored and no assumption
either way, and `resolve_unknown()` asks the network what really happened. In
the test with five timed out payments, all five turn out to have been approved.

## Tests

```
26 passed in 2.42s
```

Covering every test the level asks for: the analysis reproducing the shipped
week to the digit, capture after expiry, double capture, void on a captured
payment, over-refund, the ledger balancing, a partial capture of 5,000 on a
7,140 authorisation releasing 2,140, network idempotency, the unknown state,
the resolver, hard against soft declines, the expiry job being safe to run
twice, event-level idempotency, and a merchant report that adds up.

One test failure was worth keeping. The first version conflated two properties
in one test: that the *network* deduplicates on a reference, and that the
*service* does not re-ask when it already knows. It failed with
`cannot authorize a payment that is authorized`, which was the code correctly
refusing an illegal transition and the test asking for the wrong thing. The fix
was in both places: `authorize()` now returns the settled payment without
touching the network, and the test became two tests.

## Limitations

- In memory. The state machine and the money rules are the subject here; the
  storage is level 6 and the API is level 7.
- One currency, and no FX on refunds. A refund of a foreign currency payment at
  a different rate is a real and separate problem.
- The fee model is a flat 2.90% plus 30 cents. Real interchange depends on card
  type, region and merchant category, which is level 10's settlement file.
- Chargeback representment, the process of contesting a dispute, is not
  modelled. The money moves and the fee is charged, and that is where it stops.
