# Architecture

Every service, what it owns, and what it depends on. One page, because the
purpose of this document is to be read during an incident by somebody who did not
build the system.

## The shape

```
                      internet
                          |
                   [ load balancer ]  TLS terminates here, and the SLI is
                          |          measured here rather than in the service
                 +--------+--------+
                 |                 |
          [ payments-api ]   [ payments-api ]      blue and green
           level 7 + 14            (idle)         one receives traffic
                 |
     +-----------+-----------+-------------------+------------------+
     |           |           |                   |                  |
[ card-vault ] [ ledger ]  [ cache ]        [ payout queue ]  [ card network ]
  level 15     level 6     level 14           level 11          simulator
     |           |           |                   |
  [ KMS ]    [ Postgres ]  [ Redis ]      [ payout-worker ]
                  |                          level 12 saga
           [ read replica ]                      |
                  |                        [ bank API ]
          [ reporting, level 13 ]
                  |
        [ reconciliation, level 10 ]
                  |
          [ settlement files, S3 ]
```

## Who owns what

"Owns" means: holds the authoritative copy, and is the only service that writes
it. Everything else reads a copy or asks.

| Service | Owns | Depends on | Built in |
|---|---|---|---|
| `payments-api` | Payment requests, idempotency keys, the state machine | card-vault, ledger, cache, card network | 7, 8, 9 |
| `card-vault` | Sealed card numbers, the token mapping, the audit log | KMS, its own Postgres schema | 15 |
| `ledger` | Every money movement, double entry, balanced | Postgres | 4, 6 |
| `payout-worker` | Payout state, compensations | payout queue, ledger, bank API | 11, 12 |
| `reconciliation` | Breaks, with stable identities | settlement files, ledger read replica | 10 |
| `reporting` | Nothing. Reads only | read replica | 13 |
| Prometheus and the collector | Metrics and traces | scraping everything | 16 |

## What depends on what, and what happens when it is gone

The second column is the one worth writing down, and most architecture documents
do not have it.

| Dependency | If it is unavailable | Degradation |
|---|---|---|
| Postgres primary | No payments can be taken | **Hard stop.** Readiness fails, the instances leave the load balancer, callers get 503 rather than timeouts |
| Postgres replica | Reporting stops | Payments unaffected. Nothing pages |
| card-vault | No new card can be stored | **Hard stop for new cards.** Payments on stored tokens continue, which is the reason tokens exist |
| KMS | The vault cannot seal or open | Hard stop for the vault, and nothing can decrypt. The blast radius of an outage is total and the blast radius of a breach is zero, which is the trade |
| Redis | Rate limiting and caching stop | **Degraded, not down.** The limiter fails open on a cache miss and the database takes the full read load. Level 14 measured that at 121.4 ms p50 against 15.7 ms with an 80% hit ratio |
| Payout queue | Payouts stop being requested | Freshness objective at risk after 15 minutes. Payments unaffected |
| Bank API | Payouts cannot complete | The level 12 saga leaves them in a non final state and the sweeper resolves them. `PayoutsStuckInNonFinalState` pages after 15 minutes |
| Card network | No authorisations | **Hard stop**, and not our outage. Level 14's breaker opens so the failure is fast rather than a timeout per request |
| Prometheus | No metrics, no alerts | **The most dangerous entry here.** The system is fine and nobody can see it. The alert for this is at the monitoring provider, not in it |

Redis failing open deserves the second look. A rate limiter that fails closed
refuses every request when the cache is down, which converts a cache outage into a
full outage. Failing open means a brief window with no rate limiting, which is
survivable. Both choices are defensible for different systems and the wrong thing
is to not have chosen.

## The boundaries that matter

**A card number crosses exactly one boundary.** From the edge into
`payments-api`, and from there into `card-vault`. Nothing else in the diagram has
ever seen one, which is what `SCOPE.md` in level 15 counts: seven systems that
stored card numbers became one.

**The ledger is written by one service.** Every other service asks. This is not
tidiness: double entry is only an invariant if one place enforces it, and the day
two services write to it is the day the trial balance stops meaning anything.

**Every cross service call has a timeout shorter than its caller's.** The chain is
edge 10 s, api 8 s, vault 2 s, KMS 1 s. Level 14's finding as a rule: work done
for a caller who has already given up is capacity spent on nobody.

**Queues are the boundary for anything that can be retried.** Payouts go through a
queue because a bank API that is slow must not make a payments API slow, and
because a retry there is safe by construction: level 11's outbox gives at least
once delivery and level 12's compensations are idempotent by constraint.

## What is deliberately not here

- **No service mesh.** Six services, one language, one cluster. The problems a
  mesh solves are problems this system does not have yet, and the operational
  cost of one is immediate.
- **No Kubernetes for the platform.** One component runs on a local cluster in
  `k8s/` so the object model is understood, and the platform runs on Fargate. The
  reason is in the README: Kubernetes earns its complexity at a scale and a team
  size this does not have.
- **No event sourcing for the ledger.** Level 4's append only double entry is
  already the useful part of it, and the rest is a rebuild strategy for a problem
  nobody has raised.
- **No second region.** The recovery objective is hours rather than minutes, a
  single region with multi availability zone Postgres meets it, and the doubling
  of the bill and of every deploy is not justified by anybody's requirement yet.
  This is the entry most likely to change, and the trigger for changing it is a
  regulator asking rather than an engineer wanting to.
