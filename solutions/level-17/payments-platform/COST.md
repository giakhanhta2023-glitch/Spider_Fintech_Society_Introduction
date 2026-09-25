# What this costs per payment

```bash
python -m ship.cost
```

131,414,400 payments a month, at 50 a second average and 200 at peak. Volumes
measured in earlier levels, prices taken from a file that says plainly they are
not verified.

| Line | Monthly | Share | Where the number comes from |
|---|---|---|---|
| database | $1,459 | 49.2% | 2 instances x 730 h + 500 GB |
| compute | $432 | 14.6% | 6 tasks x (2 vCPU + 4 GB) x 730 h |
| metrics | $272 | 9.2% | 906 series, 151 per instance x 6 |
| egress | $180 | 6.1% | 2,000 GB out. Ingress is free, which is the trap |
| load balancer | $162 | 5.5% | 1 x 730 h + 25 capacity units |
| queue | $158 | 5.3% | 394 M requests, three per payment |
| nat gateways | $156 | 5.2% | 2 x 730 h + 2,000 GB processed |
| cache | $99 | 3.3% | 2 nodes x 730 h |
| traces | $26 | 0.9% | 5 M spans, 1% tail sampled |
| settlement files | $9 | 0.3% | 400 GB |
| key service | $7 | 0.2% | 2 keys + 1.58 M requests |
| logs | $4 | 0.1% | 8 GB ingested, 7% of 120 GB |
| secrets | $2 | 0.1% | 6 secrets |
| **total** | **$2,968** | | |

| | |
|---|---|
| Per payment | **$0.000023** |
| Processing fee on the $77.90 mean capture from level 9 | $2.5591 |
| Infrastructure as a share of the fee | 0.0009%, or one part in 113,327 |

Two numbers held at once is the point of the exercise. Infrastructure is not
where the money goes: **the card fee is a hundred thousand times larger than the
compute**, and an engineer who knows that is having a different conversation with
finance than one who does not. It is also why "move to a cheaper region to save
$300 a month" is rarely worth the risk of the move.

## Which half of this is trustworthy

**The volumes are measured.** Every one of them, in an earlier level, with the
command that produced it:

| Volume | Value | Measured in |
|---|---|---|
| Bytes per log line | 152 | Level 16, `obs.experiments` |
| Log lines per payment | 6 | Level 16 |
| Share of lines kept by the sampling policy | 7.0% | Level 16 |
| Metric series per instance | 151 | Level 16, the declared ceiling |
| Spans per payment trace | 4 | Level 16, the tracing test |
| Records per data key | 100 | Level 15, the envelope batch |
| Queue requests per payment | 3 | Publish, receive, delete |

**The prices are not.** All nineteen unit prices in `ship/prices.yml` are marked
`verified: false`, because this was written on a machine with no cloud account.
They are the right order of magnitude and they have not been read off an invoice.
The file carries the command that replaces them:

```bash
aws ce get-cost-and-usage --time-period Start=2026-08-01,End=2026-09-01 \
  --granularity MONTHLY --metrics UnblendedCost \
  --group-by Type=DIMENSION,Key=SERVICE
```

That command prices your account rather than the list, including the discounts
and the free tiers and the resource nobody remembers switching on. A model built
on list prices is a starting point; the bill is the measurement.

## Halving the two biggest lines

**The database, at $1,459 and half the bill.** Two instances of eight vCPUs each,
running at all times, sized by nobody in particular. Three things to try in order:

1. **Measure what it actually uses.** Level 14's capacity arithmetic applies here
   too: the service is 8 workers at a 70 ms mean service time, which is 114
   requests a second, and it averages 50. If the database is at 15% CPU, it is
   two sizes too big and the fix is a single parameter, taken during a
   maintenance window.
2. **Move the read replica's work to the cache.** The reporting queries that
   justify a replica are mostly repeat reads, and level 14's single flight cache
   already exists. A replica at $730 a month against a cache node at $50 is the
   comparison to make, and the answer depends on how stale the reports may be.
3. **Reserve or commit.** A one year commitment on a database that will certainly
   still exist is the least interesting and largest saving available, usually
   around 30%, and it costs a signature rather than an engineering week.

**Compute, at $432, of which three quarters is idle.** Sized for 200 payments a
second while averaging 50. Autoscaling on a metric that reflects real load
recovers most of that: scale on requests in flight or on queue depth, never on
CPU, because a service that spends its time waiting on a database has low CPU
while it is drowning. The floor stays at two tasks, because scaling from one is
scaling from an outage.

There is a cheaper answer that is worth naming and rejecting: run fewer, larger
tasks. It saves nothing, because the price is per vCPU hour either way, and it
makes the loss of one task a bigger event.

## What would not be cut

**The read replica's existence, if it is the failover target.** Cutting a standby
to save $730 a month is buying a discount with the recovery time objective, and
that is a decision for the person who owns the outage, not for the person who
owns the budget.

**Backups and their retention.** The cheapest line in the table to cut and the
only one whose absence is unrecoverable.

**Tail sampled traces, at $26.** They are what made the level 16 postmortem
possible: every failed request had a trace, so "where did it fail" took seven
minutes instead of an afternoon. Twenty six dollars.

**The audit log and the key service, at $7 combined.** Cutting either to save the
price of a coffee, in a system that stores card numbers, would be an interesting
sentence to read out in a compliance review.

**Log and metric volume below the level where an incident is diagnosable.** Level
16 already sampled logs to 7% of their volume, which is the honest saving; going
further means keeping fewer errors, and errors are the whole reason logs exist.
The line is $4 a month, so anybody proposing to cut it further has stopped
optimising cost and started optimising a graph.

## The line nobody notices

The NAT gateways, at $156, cost about $66 a month before a single byte moves and
then charge for every byte in both directions. Two of them exist so the loss of
one availability zone does not take the service with it, and in staging there is
one, which is `var.environment == "production" ? 2 : 1` in `infra/main.tf`.

That is the shape of most surprising cloud bills: not a mistake, but a resource
that charges by the hour for existing, multiplied by an environment count nobody
audited.
