# Level 11: The event you thought you published

> **outbox: events that cannot be lost, consumers that cannot double count** · build project · difficulty 8/10

## Read this second

Attempt the build yourself first, then ask the FinQuest tutor for a hint, and only then open this folder.
Read the part you are stuck on, close the file, and retype the fix from memory. Copying the solution into
your own project skips the only step that actually teaches you anything.

## The brief

Take the level 9 payment service and make it publish events properly. Measure what the naive version loses, fix it with an outbox, deal with the duplicates that appear, choose a partition key and prove it matters, then rebuild a projection from the log.

**Scope:** Uses levels 6, 7 and 9. Kafka or Redpanda in Docker if you can run it; a Postgres table as the log if you cannot, since every pattern here is yours to implement rather than the broker's.

## Files here

| File | What it is |
|------|------------|
| `events/outbox.py` | the event written inside the business transaction |
| `events/publisher.py` | batched, skip locked, safe to run twice over |
| `events/consumer.py` | idempotent handling with a processed_event table |
| `events/partition.py` | the one line that decides what stays in order |
| `events/dlq.py` | retries, then a dead letter with the error and the offset |
| `bench/dual_write.py` | the experiment that justifies the whole pattern |
| `quiz-key.md` | all 15 drill answers with explanations |

## Run it

```bash
python -m bench.dual_write && python -m events.publisher && python -m events.consumer --replay
```

## Why the solution is shaped this way

- The dual write experiment stays in the repository, because the pattern is only convincing next to the thing it replaces. Measured: 400 payments, 380 events published, 20 lost forever at a 5% crash rate, with no error anywhere.
- The outbox row is written in the same transaction as the payment, so the two cannot disagree. The same experiment then loses nothing and delivers 3.50% of events twice, which is the trade the pattern is making on purpose.
- The publisher uses for update skip locked and a partial index on unpublished rows. The index matters the way the level 6 foreign key index mattered: without it every poll scans a table that only grows.
- Batch size is the performance story. 400 events took 30,473 ms one row at a time and 116 ms in batches of 500, a factor of 265 with no change to the query or the network. Round trips, not work.
- Consumers are idempotent two ways, deliberately: a processed_event table for work with side effects, and an upsert keyed by payment id where the projection can simply be written again. The README says which to use where.
- The partition key is chosen and then proved. Over the level 9 stream in 4 partitions: keyed by payment id, zero events out of order; keyed at random, 4,577 out of order affecting 4,534 of 17,216 multi event payments, which is 26.3%.
- Replay is the acceptance test. The projection is truncated, the offset reset, the stream replayed, and the result compared row for row against what was there before.

## Where people get stuck

| Symptom | Cause |
|---------|-------|
| Events are missing downstream | Dual write. The publish is outside the transaction that wrote the business data. |
| Totals are double counted after a redeploy | A consumer that increments rather than sets, with no processed_event marker. |
| A capture arrives before its authorisation | Partitioned by something other than the payment. Ordering only holds within a partition. |
| The publisher slows down as the table grows | No partial index on unpublished rows, so every poll scans everything. |
| Replaying sent four months of emails again | Side effects and projections in the same consumer. Separate them before resetting any offset. |

## Self-checks the solution satisfies

- The dual write experiment loses events at approximately the injected crash rate
- A rolled back business transaction leaves no row in the outbox
- The publisher sends every unpublished row and marks it, leaving none behind
- Two publishers running at once never publish the same row
- A crash between sending and marking produces duplicates and no losses
- The idempotent consumer applied to the same event twice changes the projection once
- Replaying the entire stream twice leaves the projection byte for byte identical
- Partitioning by payment id gives zero out of order events across the level 9 stream
- Partitioning at random gives thousands, affecting roughly a quarter of multi event payments
- An order dependent consumer fails under the random key and passes under the payment key
- A poison event reaches the dead letter table after the configured attempts and does not block the partition
- Replaying a dead letter after the fix produces correct totals with no double counting
- A full rebuild from offset zero reproduces the projection exactly

## How it is marked

| Points | Criterion | Meaning |
|--------|-----------|---------|
| 25 | The problem measured | Dual write losses and outbox duplicates, both measured with your own numbers and both in the README. |
| 25 | Delivery handled honestly | Outbox in one transaction, skip locked publisher, idempotent consumers, and an explanation of at least once. |
| 20 | Ordering understood | The partitioning experiment, a consumer that shows the difference, and a stated key with its trade-off. |
| 15 | Failure handled | Retries with backoff, a dead letter table with the error, and a replay that does not double count. |
| 15 | Replayable | A projection rebuilt from zero, and a written answer on which consumers are dangerous to replay. |

---

Part of [FinQuest](../../README.md) · Level 11 of 10
