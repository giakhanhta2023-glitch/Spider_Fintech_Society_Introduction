# Architecture

Six services, what each owns, and what happens when each dependency is gone. The
third column is the one worth having and the one most architecture documents do
not have.

## The shape

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

## Ownership

"Owns" means holds the authoritative copy and is the only service that writes it.
Everything else reads a copy or asks.

| Service | Owns | Depends on | From |
|---|---|---|---|
| gateway | Payments, their states, idempotency keys | vault, ledger, outbox | 7, 8, 9 |
| vault | Sealed card numbers, the token mapping | key service | 15 |
| ledger | Every movement of money, double entry | Postgres | 4, 6 |
| outbox and publisher | Events, exactly once written, at least once delivered | Postgres | 11 |
| payout worker | Payout state, compensations | consumer, bank, ledger | 12 |
| reconciliation | Breaks, with stable identities | ledger replica, settlement files | 10 |

## What happens when each dependency is gone

Measured in `chaos/scenarios.py` where the row says measured, and reasoned where
it says reasoned. The distinction is deliberate.

| Dependency | Effect | Behaviour | Evidence |
|---|---|---|---|
| Ledger primary | No payments can be taken | 503 immediately, nothing half written, alert in 27 ms | **Measured**: 200 of 200 refused, 0 recorded, 0 breaks after |
| Vault | No new cards | 503 with the dependency named, alert in 5 ms. Stored tokens still work | **Measured**: 60 of 60 refused, 0 breaks after |
| Publisher | Payments unaffected, events queue up | The backlog grows and alerts. Nothing is lost, because the event is written with the payment | **Measured**: 700 backlog, 0 events lost, caught up in 600 ms |
| Bank | Payouts cannot complete | Timeouts leave payouts `unknown`; the sweeper resolves every one by asking about a reference that predates the first attempt | **Measured**: every unknown resolved, 0 breaks |
| Key service | The vault cannot seal or open | Hard stop for the vault. Total outage, zero breach radius: the trade is deliberate | Reasoned |
| Ledger replica | Reporting and reconciliation stop | Payments unaffected. Reconciliation runs late rather than never | Reasoned |
| Redis | Rate limiting and caching stop | Degraded, not down. The limiter fails open and the database takes the read load | Reasoned, from level 14's cache measurements |
| Monitoring | Everything works and nobody can see it | The most dangerous row here. The alert for this lives at the monitoring provider rather than in it | Reasoned |

Failing open on the limiter deserves its second look. A limiter that fails closed
refuses every request when its store is unavailable, which converts a cache outage
into a full outage. Failing open means a window with no rate limiting, which is
survivable. Both are defensible for different systems; not choosing is not.

## The boundaries that matter

**A card number crosses one boundary.** From the edge into the gateway, and from
the gateway into the vault. Nothing else has ever seen one. That is the count
`decisions/0002-tokens-everywhere.md` argues about: one system storing, two
handling, and hosted fields would make it one and zero.

**The ledger has one writer.** Double entry is an invariant only if one place
enforces it. The day a second service writes to it is the day the trial balance
stops meaning anything.

**Money never moves before the record can be written.** The payout worker refuses
to call the bank when the ledger is unavailable. That rule came from the capstone
finding the opposite: the first version called the bank first and lost one payout
in four hundred during the database outage scenario, and the reconciliation found
it the next morning.

**Every retryable thing goes through a queue.** A slow bank must not make a fast
API slow, and a retry in the queue is safe because the outbox delivers at least
once and the compensations are idempotent by constraint.

## Where the capstone's platform differs from the deployed one

Stated here rather than implied, because the difference decides what the numbers
in the README prove.

| | The capstone | Deployed |
|---|---|---|
| Processes | One, with threads for the asynchronous half | Six, in containers |
| Transport | Function calls | HTTP and a queue |
| Ledger | A list with a lock | Postgres with constraints and a partition scheme |
| Vault | A dictionary and a reversible transform | AES-256-GCM envelope encryption over KMS |
| Failure injection | `ledger.stop()` | `docker compose stop`, `tc qdisc`, a revoked policy |

What carries across: the state machines, the ordering of writes against external
calls, the idempotency, and the reconciliation. What does not: anything about
serialisation, connection pools, partial socket failure, or the behaviour of an
orchestrator. `decisions/0001-one-process-for-the-capstone.md` has the full list
and the reason.
