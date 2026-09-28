# The CV, where every line has a number

**This is a template with worked examples, not a CV to submit.** Every number in
it comes from a measurement in this course, and every one is a number you can
reproduce and be questioned about, which is the property that matters. Replace the
examples with yours; keep the shape.

The rule: **if a line has no number in it, it is an opinion.** "Experienced with
distributed systems" tells a reader nothing. "Reduced reconciliation from 24.1
seconds to 26 milliseconds at 8,000 payments by indexing the match" tells them
what you can do, and it invites exactly the follow up question you want.

---

## Projects

**payments-platform-capstone** · Python, Postgres, Redis, Prometheus
Six service payment platform: gateway, vault, ledger, event stream, payout worker,
reconciliation.

- Sustained an hour of load at 50 payments a second, 180,001 payments, with a
  p99 of 6.4 ms against a 500 ms objective, zero requests outside it, and zero
  reconciliation breaks across 1,261,757 checked facts
- Survived four injected failures with no money lost or duplicated: database loss
  detected in 27 ms, a revoked credential in 5 ms, a stopped publisher in 112 ms
  with 700 events queued and none lost
- Found and fixed a money bug in my own payout worker: it called the bank before
  writing the ledger entry, so one payout in four hundred left the building with no
  record during a database outage
- Made the reconciliation 923 times faster at 8,000 payments, from 24,061 ms to
  26 ms, by indexing the match instead of scanning per payment, with the ratio
  growing from 201x at 2,000 payments because the old version was quadratic
- Performed an expand and contract schema migration under load: six deploys, 1,170
  requests, zero failed

**card-vault** · Python, AES-256-GCM, mutual TLS
One service that can see a card number.

- Took seven systems that stored card numbers down to one
- Envelope encryption cut key service calls for 20,000 records from 20,000 to 200,
  and 172 seconds to 2.0
- Master key rotation rewrites zero card rows, measured: 3 ms to rewrap 200 data
  keys against 373 ms of cryptography plus 20,000 row rewrites
- Proved mutual TLS refuses a certificateless client at the handshake with three
  real handshakes, after the first version of the test flaked one run in three

**payments-observability** · Prometheus, OpenTelemetry
Made a payments service operable.

- Replayed a month of traffic against two alerting strategies: a threshold paged
  four times with two false pages, a multiwindow burn rate paged twice with none
- Found that the two incidents were 42% of the month's errors and a quiet 0.05%
  background rate was the other 58%, spending most of the budget while paging
  nobody
- Measured the cardinality accident: one label took 100 series to 200,000, memory
  from 0.1 MB to 203.8 MB and the scrape from 3.0 ms to 15.7 seconds against a 15
  second interval

**payments-at-scale** · Postgres
Partitioning, migrations and backfills on 415,554 rows.

- Partitioned query at 4.4 ms against 81.3 ms, and dropping a month in 8 ms rather
  than a delete that runs for hours
- Batched backfill: total time 6% worse, longest lock held down from 5,622 ms to
  280 ms

---

## What makes these lines work

**A number and a mechanism.** "923 times faster" is a boast; "923 times faster by
indexing the match instead of scanning per payment, and 201 times at a quarter of
the size, because the old one was quadratic" is a claim somebody can interrogate,
and the interrogation goes well because you did the work.

**At least one line about something that went wrong.** The payout bug line is the
most valuable one on this page. It says: I test my own work adversarially, I found
a money bug before production did, and I can talk about it without defending
myself.

**No adjectives.** The numbers carry it, and an adjective next to a number weakens
the number: "handled 222,226 deliveries a second" needs no word in front of it.

**Reproducible.** Every figure above is printed by a command in one of these
repositories. An interviewer who asks "how do you know" gets a command rather than
a story.

## Skills lists

The section to be careful with. "Python, SQL, Docker, Kubernetes, AWS, Terraform, Kafka, Redis" is a
keyword field for a filter, and a reader learns nothing from it. If it has to be
there, keep it to one line and never list something you would not want to be asked
about for twenty minutes.
