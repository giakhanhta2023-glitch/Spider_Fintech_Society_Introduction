# payments-platform-capstone

```
                         client
                           |
                    [ edge / router ]
                           |
                      [ gateway ]  ---------> [ vault ] ---> [ key service ]
                       levels 7, 8                level 15
                           |
              +------------+------------+
              |                         |
        [ ledger ]                 [ outbox ]
        levels 4, 6                 level 11
              |                         |
      [ read replica ]           [ publisher ] --> [ consumer ]
              |                                         |
     [ reconciliation ]                        [ payout worker ]
        level 10                                  level 12
              |                                         |
       [ settlement files ]                      [ bank API ]
```

**Six services that take 50 payments a second for an hour inside a 500 ms
objective, survive four injected failures without losing or duplicating a cent,
and migrate a schema under load without dropping a request, with the
reconciliation at zero after every one of those.**

| # | Result | Measured by |
|---|---|---|
| 1 | **180,001 payments in an hour**, p99 **6.4 ms** against a 500 ms objective, **zero** requests outside it, and **zero** of the monthly error budget spent | `python -m bench.load --minutes 60` then `python -m bench.budget` |
| 2 | **Four failures, zero money lost or duplicated**, detected in 5 to 112 ms, reconciliation clean after each | `python -m chaos.scenarios` |
| 3 | **1,170 requests through six deploys, zero failed**, and zero disagreements between the two code versions at the switchover | `python -m migrate.under_load` |
| 4 | **The payout path, not the API, is the capacity limit**: the p99 stays inside the objective at 8,000 payments a second while payouts fall behind from 500 | `python -m bench.load --sweep` |
| 5 | **A money bug found in my own code** by the chaos runner: the bank was called before the ledger entry could be written | `tests/test_capstone.py::test_the_payout_worker_will_not_call_the_bank_it_cannot_record` |

```bash
python seed.py                      # one payment, end to end
python -m bench.load --minutes 60   # the hour
python -m bench.budget              # what the hour cost against the objectives
python -m chaos.scenarios           # four failures, with detection and recovery
python -m migrate.under_load        # six deploys with traffic on them
python -m recon.daily               # the check that must return zero
pytest -q                           # 17 tests, about twenty seconds
```

## The claim, and its boundary

**Every number here comes from the platform in `platform_/`, which runs six
services in one process.** There is no container runtime on the machine this was
written on, so `docker/compose.yml` is written and has never been run, and
[decisions/0001-one-process-for-the-capstone.md](decisions/0001-one-process-for-the-capstone.md)
is the decision record with the full list of what that does and does not prove.

The short version: what carries across is the **logic**. The state machines, the
order of writes against external calls, the idempotency, the reconciliation. What
does not carry across is anything about serialisation, connection pools, partial
socket failure, or an orchestrator killing a process while it holds a lock. "Zero
breaks after four failures" is a claim about the money, not about a deployment.

## 1. It runs

```
$ python seed.py

1. taking one payment

   payment      pay_00000001
   amount       2500 minor units
   fee          73 minor units
   token        tok_bcnqiDyUi9dMvZ_Wb0GRPmr3
   card number  never stored outside the vault

2. letting the asynchronous half run

   payout state paid
   bank ref     bank_00000001
   events       1 delivered

3. checking the money

   ledger transactions  2
   ledger total         0   (zero, always)
   settlement_receivable      2500
   merchant_payable              0
   fee_income                  -73
   bank_clearing             -2427

4. reconciling

   7 facts checked, 0 breaks

5. the smoke test

   pass  the payment was accepted
   pass  the card number is not in the response
   pass  the payout reached a final state
   pass  the ledger balances
   pass  the reconciliation is clean
```

Two ledger transactions for one payment, because the capture and the payout happen
at different times and can fail separately. That separation is what lets the
reconciliation compare the ledger against the bank rather than against itself.

## 2. It holds

An hour at 50 payments a second, offered on a fixed schedule by an open loop
generator, warm up discarded, latency measured from the moment each request was
**due** rather than from when it started:

| | |
|---|---|
| Offered, accepted, refused | 180,001 / 180,001 / **0** |
| p50 / p95 / p99 | 0.171 ms / 1.504 ms / **6.358 ms** |
| Slowest single request | 410.288 ms, still inside the objective |
| Requests slower than the 500 ms objective | **0 of 180,001** |
| Goodput | **50.0 a second**, equal to throughput |
| Reconciliation afterwards | 1,261,757 facts checked, **0 breaks** |

The service time under that load was a p50 of 0.161 ms and a p99 of 1.225 ms, so
almost all of even the 6.4 ms p99 is scheduling rather than work.

**What the hour cost against the objectives**, using level 16's targets, which were
written before any of this ran:

| Objective | Bad | Of | Burn rate | Budget spent |
|---|---|---|---|---|
| Availability, 99.9% over 30 days | 0 | 180,001 | 0.00x | **0.0000%** |
| Latency, 99% inside 500 ms over 30 days | 0 | 180,001 | 0.00x | **0.0000%** |

An hour is 0.139% of a 30 day window, so a burn rate of 1.00x would have spent
0.139% of the budget. This hour spent none of it. The third objective, payout
freshness, is **not** computed from this run, because the run records no per payout
age: `bench/budget.py` says so where the number would otherwise go, and the sweep
below is where the payout path's limit actually shows up.

Coordinated omission is the reason for the sentence about when a request was due.
Timing from when a request starts hides exactly the requests a struggling system
has not got to yet, and a load test that does it reports a healthy p99 during an
overload. The first version of this bench did, and the fix is four lines.

### Where each objective breaks

The same test at five rates, each on a fresh platform:

| Offered | p50 | p99 | Goodput | Latency objective | Payouts awaiting at the end |
|---|---|---|---|---|---|
| 500 rps | 0.06 ms | 0.76 ms | 500/s | met | 2,734 |
| 1,000 rps | 0.06 ms | 0.98 ms | 1,000/s | met | 6,649 |
| 2,000 rps | 0.05 ms | 1.21 ms | 2,000/s | met | 16,074 |
| 4,000 rps | 0.05 ms | 30.53 ms | 4,000/s | met | 33,948 |
| 8,000 rps | 0.04 ms | 75.06 ms | 8,000/s | met | **69,865** |

**The latency objective never breaks and the freshness objective breaks
immediately.** The API accepts eight thousand payments a second inside a 500 ms
p99, and the payout path falls behind from the very first rate: at 500 offered
payments a second, 2,734 payouts were still waiting when the load stopped.

That is one real lesson and one artefact of the way this is measured, and they are
worth separating.

**The lesson**, which holds anywhere: a payments platform has two capacities and
only one of them is the API's. The synchronous path is fast because it writes a
row; the asynchronous path calls a bank. A capacity plan quoting only requests a
second is describing the half that was never the constraint. Level 16's SLO
document has freshness as its own objective for exactly this reason.

**The artefact**: here the payout worker is a thread in the same process as the
load generator, so it competes for one interpreter lock, and its ceiling is a few
hundred payouts a second rather than a real worker's thousands. The shape is right
and the number is not transferable, which is why `ARCHITECTURE.md` states the
deployment difference in a table rather than in a footnote.

## 3. It survives

Four failures, injected under load. Detection is measured from the injection to the
alert firing, using the rules in `platform_/alerts.py`. Recovery is measured from
removing the fault to the system being correct again, which means something
different per scenario: a payment succeeding for the database and the credential,
every unknown payout resolved for the bank, and the backlog back to zero for the
publisher.

| Scenario | What fired | Detected | Recovered | Money lost | Breaks after |
|---|---|---|---|---|---|
| The ledger database goes away | `PaymentsFailing` | **27 ms** | < 1 ms | no | **0** |
| The bank slows, then times out on every call | `PayoutsUnknown` | **87 ms** | < 1 ms | no | **0** |
| The publisher stops for 700 payments | `EventBacklogGrowing` | **112 ms** | 600 ms | no | **0** |
| A vault credential is revoked | `VaultRefusingCredential` | **5 ms** | < 1 ms | no | **0** |

The detail under each headline is where the design either holds or does not:

**Database loss.** 200 payments offered, **200 refused, zero recorded**. Not one
half written row, which is the property the reconciliation afterwards depends on. A
503 before anything is written is a good failure; a 500 after the ledger write and
before the event write is the one that takes a week to untangle.

**A bank that stops answering.** Every timed out payout went to **unknown** rather
than failed, and the sweeper resolved every one by asking the bank about a
reference generated before the first attempt. Zero still unknown at the end.
Guessing in either direction is a double payment or a merchant who was never paid.

**A stopped publisher.** Payments kept succeeding throughout, because the publisher
is not on the payment path. The backlog grew to **700 events, none lost**, and the
consumer caught up in 600 ms. The alert that fired was the backlog rule rather than
an error rate, because nothing was erroring: this is lag, and the outbox is what
makes it lag instead of loss.

**A revoked credential.** 60 payments offered, **60 refused with 503**, the
dependency named in the error, and nothing written: no ledger entry, no event, no
payout. The alert fires on the refusal counter rather than on the error rate, so it
says which dependency rather than that something is wrong.

## 4. It migrates under load

Six deploys, with 200 payments a second arriving throughout:

| Step | Requests during | Failed |
|---|---|---|
| 1. expand: add `fee_minor`, nullable | 181 | 0 |
| 2. code writes both columns | 180 | 0 |
| 3. backfill in batches of 200 | 165 | 0 |
| 4. code reads `fee_minor` | 170 | 0 |
| 5. code stops writing `fee_bps` | 151 | 0 |
| 6. contract: drop `fee_bps` | 141 | 0 |

**1,170 requests, zero failed**, and at step 4 both code versions read 500 sampled
rows with **zero disagreements**, which is the proof that a rollback there is a
plain revert. The reconciliation after the whole sequence is clean.

Level 17 ran the same six deploys against PostgreSQL 18.6 with the locks and the
timings; this one runs them with traffic on top, which that one could not.

## 5. Three bugs the capstone found in its own code

Assembly is where you find out which services only ever worked on your laptop.
These three came out of running the thing rather than reading it, and each one is a
class of bug rather than a typo.

**The payout worker called the bank before it could record the payment.** The chaos
runner found it: during the database outage scenario, one payout in four hundred was
paid at the bank and left `pending` in our system, because the ledger write after
the bank call raised and the exception escaped. Money out of the building with no
record of it, and nothing that would ever resolve it. The reconciliation caught it
the next morning, which is the good outcome of a bad design.

The fix is an ordering rule: **refuse to call the bank when the record cannot be
written**, and if the record fails after the money has moved, the payout is
`unknown` rather than `pending`, because `unknown` is the state the sweeper
resolves. That rule is now a test of its own.

**The reconciliation was quadratic.** It called `ledger.by_reference(payment.id)`
per payment, and that scans every entry. `python -m recon.measure` re-runs the
comparison, asserting that both versions count the same transactions:

| Payments | The first version | Indexed once | Ratio |
|---|---|---|---|
| 2,000 | 1,304.8 ms | 6.5 ms | 201x |
| 4,000 | 5,148.8 ms | 12.1 ms | 427x |
| 8,000 | **24,061.8 ms** | **26.1 ms** | **923x** |

The 923 is not the number that matters. The **ratio growing from 201 to 923 while
the data grew four times** is: that is what quadratic looks like from the outside,
and it is why the answer at a million payments is "it never finishes" rather than
"about a minute". The whole seven check reconciliation, indexed, takes 45.1 ms at
8,000 payments. What found it was the capstone's own load test getting slower at
every rate, not a profiler.

**The payout worker spun.** `run_once` popped a payout, discovered the ledger was
unavailable, put it back, and popped it again a thousand times in one pass,
reporting a thousand attempts. The test that caught it asserted the attempt count
rather than the end state, which is the only version of that test that would have
noticed.

And one reporting bug, smaller and more embarrassing: the reconciliation summary
summed an amount in minor units into its "facts checked" total and announced
**20,902 facts checked on four payments**. Counts and money are separate
dictionaries now. A number that mixes units is a number nobody can sanity check.

## 6. It is legible

| Document | What it is for |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Every service, what it owns, and **what happens when each dependency is gone**, with the measured rows marked |
| [decisions/](decisions/) | Three records: one process for the capstone, tokens everywhere, and an outbox instead of a distributed transaction |
| [designs/](designs/) | Six one page designs: gateway, ledger, payout scheduler, idempotency, reconciliation, rate limiter |
| [runbooks/](runbooks/) | One per alert, written after the scenario that fires it, with that scenario's detection time in it |
| [COST.md](../../level-17/payments-platform/COST.md) | Level 17's cost model: $0.000023 a payment against a $2.56 card fee |

The third column of the architecture table is the one most architecture documents
do not have, and the one an interviewer will ask about: not what the system is, but
what it does when each piece of it is missing.

## 7. It is hireable

[CV.md](CV.md) is a template with worked examples, where every line has a number
that can be reproduced by a command in one of these repositories.
[video/SCRIPT.md](video/SCRIPT.md) is the shot list for the two minute video, which
is **not recorded**: a video cannot be written into a repository, and the plan is
most of the work.

## What is not here

- **A recorded video.** The script is, and the reason is in it.
- **Containers.** `docker/compose.yml` is written and has never been run. Every
  number above comes from the in process platform.
- **A cloud deployment.** No account. Level 17's `infra/` has the Terraform and its
  own `NOT_APPLIED.md`.
- **Its own public repository.** This lives as a solution folder inside the course.
  The level asks for `payments-platform-capstone` as a repository of its own, which
  is a copy and a `git init` away, and is the one requirement here that a reader
  should do rather than read.
- **A game day with another person.** Level 16 has the fault injection runner and
  says the same thing: the most valuable version of that exercise needs somebody
  who did not build the system.

---

Part of [FinQuest](../../../README.md) level 20.
