# outbox

Events that cannot be lost, consumers that cannot double count, and a partition
key that decides whether a capture can arrive before its own authorisation.

```bash
pip install -r requirements.txt
python -m outbox.experiments data/level-09-card-events.csv
pytest                      # 16 tests, no broker, no database
```

## The four headline numbers

```
1. dual write, 400 payments, 5% crash rate
   published 380, LOST 20 (5.00%)

2. outbox, same payments, same crash rate
   lost 0, duplicated 30 (7.50%), unpublished 0

3. batch size, 4,000 events
      1 per batch  4,000 rounds  1,950.9 ms   2,050 events/s
     10 per batch    400 rounds    387.6 ms  10,319 events/s
    100 per batch     40 rounds    273.0 ms  14,651 events/s
    500 per batch      8 rounds    294.7 ms  13,571 events/s

4. partitioning over 37,987 real card events, 4 partitions
   keyed by payment_id      0 out of order
   keyed at random      4,577 out of order, 4,534 of 17,216
                        multi event payments (26.3%)
```

## What each one means

**The dual write lost 5% of events, silently.** The business transaction
commits, then the publish fails, and the payment exists while no downstream
system ever hears about it. There is no error, no retry and nothing to find
afterwards: the ledger and the event stream simply disagree, and you discover
it weeks later when a report is wrong.

**The outbox lost nothing and duplicated 7.50% instead.** That is the trade,
made on purpose. The event is written in the same transaction as the payment,
so it is durable for exactly the reasons the payment is. The publisher then
sends, and a crash before it marks the row means the row is still unsent and
goes again.

Losing a message and delivering it twice are not equally bad. A duplicate is
something the consumer can absorb with ten lines of code. A loss is
unrecoverable, and you cannot write code to handle a message you never got.

**Batch size is round trips, not work.** The in-memory store has no network, so
1,950.9 ms against 273.0 ms is the loop overhead alone. Against a real database
the effect is far larger, because each batch is one round trip instead of one
per row: the level measured 30,473 ms one row at a time against 116 ms in
batches of 500, a factor of 265 with no change to the query.

Notice that 500 is no faster than 100 here. Batching has a knee, and past it
you are holding more rows in memory and more locks for longer in exchange for
nothing.

**Partitioning is the only decision that matters for ordering.** A partitioned
log promises order *within* a partition and makes no promise across them. Keyed
by payment id, every event for one payment lands in one partition and the
ordering is free. Keyed at random, a capture arrives before its own
authorisation for **4,534 payments out of 17,216**, which is a quarter of every
payment with more than one event.

Nothing is lost in that second case, and nothing errors. The events arrive in
an order that does not make sense, and a consumer that assumes order produces
wrong answers quietly.

## The Postgres side

`outbox/postgres.sql` has the real SQL with its measurements. The one worth
repeating here is the index:

| Index | Plan | Buffers | Size |
|---|---|---|---|
| `(id) where published_at is null` | Index Scan, no sort | **2** | 128 kB |
| `(published_at, id)` | Index Scan + quicksort | 4 | 328 kB |

Both work and the planner will use either. The partial one is smaller, needs no
sort, and **its size depends on the size of the backlog rather than the size of
the table**. The outbox grows without bound; the index does not.

And `for update skip locked` is what lets two publishers run at all: a row
another worker holds is skipped rather than waited for, so they share the
backlog instead of colliding on it or queueing behind each other. Verified
against Postgres 18: `Limit -> LockRows -> Index Scan using outbox_unpublished`.

## Send, then mark. In that order.

```
claim -> send -> mark
```

Sending before marking means a crash in between produces a duplicate. Marking
before sending means the same crash produces a loss. The order is the design
decision, and it is the one that makes everything downstream at-least-once.

## Which of my consumers would be dangerous to replay

Two consumers, and only one of them is safe to run over the whole stream twice.

**`UpsertConsumer` is safe, trivially.** It sets rather than increments, so
applying an event fifty times gives the same answer as once. There is no
processed-event table, no state to keep and nothing to get wrong. Where the
work can be written this way, it is strictly better.

**`IdempotentConsumer` is safe, but only because of the processed-event table.**
It increments a merchant total, and an increment applied twice is wrong. The
deduplication is load bearing, and the test that matters is not "does it work"
but "does replaying the entire stream twice leave the projection identical",
which is asserted.

**The one that would be dangerous does not exist in this repository, and that
is deliberate.** Any consumer with an external side effect (sending an email,
calling a bank, issuing a refund) cannot be made safe by a projection test,
because the side effect has already left the building. If this codebase had
one, the rule would be: side effects and projections never share a consumer.
Put the projection in one consumer that is safe to replay, and the side effects
in another with its own processed-event table, its own offset, and a loud
warning on the replay command. Resetting an offset and sending four months of
emails again is a well-known way to have a bad week.

## Dead letters

A poison event is retried three times with growing delays, then moved aside
with **the payload, the error and the offset**. The payload so it can be
replayed, the error so somebody knows what broke, the offset because when the
cause turns out to be the message *before* this one, the offset is how you find
it.

The offset then advances past it. That is the decision: the alternative is
stopping, and stopping means every message behind it stops too, which in a
partitioned log is a quarter of your traffic halted by one row.

After the fix, `replay_dead_letters()` runs them through the same handler. The
test asserts the totals come out right and that replaying again changes
nothing, which is only true because the consumer underneath is idempotent.

## Tests

```
16 passed in 3.78s
```

Including: a rolled back transaction leaving no outbox row (the property the
whole pattern rests on), two publishers never claiming the same row, a crash
between sending and marking producing duplicates and no losses, replay leaving
the projection identical, zero out-of-order events under the right partition
key and thousands under the wrong one, an order-dependent consumer failing on
the wrong key and passing on the right one, and a dead letter replayed after a
fix without double counting.

One test earns its place by having caught something. The outbox experiment
first ran with a batch of 50, which over 400 payments is 8 rounds, and a 5%
crash rate fired zero times. It reported a beautiful `0 duplicated` and had
measured nothing at all. The test now asserts `duplicated > 0` with the message
"the injected crash never fired: the experiment measured nothing", and the
batch size is 10 with a comment saying why.

## Limitations

- In memory, by the level's own allowance. Every pattern here is implemented
  rather than delegated to a broker, which is the point; `postgres.sql` is what
  the same thing looks like against a database.
- The log models partitions and offsets but not consumer groups, rebalancing or
  retention. Those are broker operations rather than patterns you implement.
- Delays are recorded rather than slept, so the tests are fast and the schedule
  is still assertable.
- No schema registry. A consumer meeting a payload shape it does not expect
  dead letters, which is correct but less helpful than refusing to publish the
  event in the first place.
