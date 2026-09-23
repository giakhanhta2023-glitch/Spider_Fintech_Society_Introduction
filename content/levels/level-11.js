/* =========================================================================
   LEVEL 11: events, the outbox, and the order things arrive in
   ========================================================================= */
FQ.registerLevel({
  id: 11,
  codename: 'outbox',
  title: 'The event you thought you published',
  tagline: 'Commit to the database, then publish an event. One line of code between them, and 5% of your events never happen. This level measures that, fixes it with the outbox pattern, and then deals with the duplicates the fix creates.',
  difficulty: 8,
  minutes: 420,
  tags: ['Kafka', 'outbox', 'idempotent consumers', 'ordering'],
  summary: 'Every job description says "event-driven architecture" and almost every candidate means "we called a queue". ' +
           'This level is the real thing: why a database write and a publish cannot both succeed, the outbox pattern that ' +
           'fixes it, the duplicates that arrive afterwards, and what partitioning by the wrong key does to the order of ' +
           'your payments. Measured on a real database and the level 9 event stream.',

  objectives: [
    'Say what a log is and how it differs from a queue',
    'Use the words correctly: topic, partition, offset, consumer group, lag',
    'Reproduce the dual write problem and measure what it loses',
    'Implement the outbox pattern and show nothing is lost',
    'Make a consumer idempotent, because delivery is at least once',
    'Choose a partition key, and measure what the wrong one does to ordering',
    'Handle a message that will never succeed, without blocking everything behind it',
    'Rebuild state by replaying the log'
  ],

  knowledge: [
    { h: 'Why not just call the other service?' },
    { p: 'Your payments service captures a payment. Five other things need to know: the ledger, the merchant\'s webhook, ' +
         'the fraud system, the analytics pipeline, and the emails. The obvious approach is to call them:' },
    { code: 'def capture(payment):\n    post_ledger_entries(payment)\n    notify_merchant(payment)        # their server is slow today\n    update_fraud_model(payment)     # this one is being deployed\n    send_receipt_email(payment)     # the email provider is down\n    record_analytics(payment)', lang: 'python' },
    { p: 'Now your capture is as slow as the slowest of them and as reliable as the least reliable. Worse, when the email ' +
         'provider fails, what should happen? The payment already went through. Rolling back is not possible and giving the ' +
         'merchant an error is a lie.' },
    { p: 'The alternative is to write down that it happened and let everybody else read it at their own pace:' },
    { code: 'def capture(payment):\n    post_ledger_entries(payment)\n    publish("payment.captured", payment)     # and that is all', lang: 'python' },
    { p: 'Five consumers read that event and do their own work. If the email service is down for an hour, it catches up ' +
         'afterwards, and nothing else notices. That is what "event-driven" means, and everything below is the detail that ' +
         'makes it work.' },

    { h: 'A log, not a queue' },
    { p: 'Two different things get called "a queue", and the difference matters:' },
    { table: {
      head: ['', 'A queue', 'A log, such as Kafka'],
      rows: [
        ['When a consumer reads a message', 'It is removed', 'It stays. The consumer just moves its own position forward'],
        ['Several consumers', 'They share the work: each message goes to one', 'Each group reads everything, independently'],
        ['Reading yesterday again', 'Impossible: it is gone', 'Move your position back and read it again'],
        ['Good for', 'Work to be done once: send this email', 'Facts that happened: this payment was captured']
      ]
    }},
    { p: 'Payments want a log. The fact that a payment was captured is something that is true rather than a task, and five ' +
         'different systems need it for five different reasons. Here is the vocabulary, all of it:' },
    { table: {
      head: ['Word', 'What it means'],
      rows: [
        ['**Topic**', 'A named stream of related events, such as `payments`'],
        ['**Partition**', 'A topic is split into parts so it can scale. Order is guaranteed **within** a partition only'],
        ['**Offset**', 'The position of an event in its partition: a number that only goes up'],
        ['**Producer**', 'Something that writes events'],
        ['**Consumer**', 'Something that reads them, remembering its own offset'],
        ['**Consumer group**', 'A set of consumers sharing the partitions of a topic between them'],
        ['**Lag**', 'How far behind a consumer is: the newest offset minus its own'],
        ['**Retention**', 'How long events are kept before being deleted. Often days, sometimes forever']
      ]
    }},

    { h: 'The bug in the two line version' },
    { p: 'Look again at the fixed version, because it contains a real bug:' },
    { code: 'post_ledger_entries(payment)     # writes to the database, commits\npublish("payment.captured", ...)  # sends to Kafka', lang: 'python' },
    { p: 'Two systems, two separate writes, no shared transaction. This is the **dual write problem**, and it has two ' +
         'failure modes. Crash after the commit and before the publish: the payment exists and nobody is told. Publish ' +
         'first and crash before the commit: everybody is told about a payment that does not exist.' },
    { p: 'How often does that actually matter? Measured, on a real database, 400 payments with a 5% chance of the process ' +
         'dying between the two lines:' },
    { code: '--- dual write: commit, then publish ---\n  payments written to the database : 400\n  events actually published        : 380\n  events lost forever              : 20  (5.00%)', lang: 'text', label: 'measured' },
    { p: 'Twenty payments that happened and that nothing downstream will ever hear about. No error, no alert, no way to ' +
         'find them later except by comparing the two systems, which is level 10\'s job and should not be how you discover ' +
         'this.' },
    { warn: 'Swapping the order does not fix it. Publishing first means the analytics, the fraud system and the merchant ' +
            'all learn about a payment your database never recorded, which is worse: you cannot unsend an event.' },

    { h: 'The outbox pattern' },
    { p: 'The fix is to stop writing to two systems. Write the event into **the same database, in the same transaction** as ' +
         'the payment, into a table called the outbox. Then a separate publisher reads that table and sends the events on:' },
    { code: 'begin;\n  insert into entries ...                                   -- the payment\n  insert into outbox (topic, key, payload) values (...);   -- the event\ncommit;                                                     -- both, or neither', lang: 'sql' },
    { code: 'create table outbox (\n  id           bigserial primary key,\n  topic        text        not null,\n  partition_key text       not null,        -- decides ordering, see below\n  payload      jsonb       not null,\n  created_at   timestamptz not null default now(),\n  published_at timestamptz                  -- null until it has been sent\n);\ncreate index outbox_unpublished on outbox (id) where published_at is null;', lang: 'sql' },
    { p: 'The publisher is a small loop: read rows where `published_at is null`, send them, mark them sent. Same experiment ' +
         'as before, same 5% crash rate, now with the outbox:' },
    { code: '--- outbox: one transaction, then a publisher ---\n  payments written                 : 400\n  publish calls made               : 414\n  distinct events delivered        : 400\n  events lost forever              : 0\n  duplicate deliveries             : 14  (3.50%)\n  still unpublished at the end     : 0', lang: 'text', label: 'measured' },
    { p: 'Nothing lost. But look at the fourth line: **14 events were delivered twice**. The publisher crashed after sending ' +
         'and before marking them sent, so the next pass sent them again. You have traded a problem you cannot detect for ' +
         'one you can.' },
    { check: {
      q: 'Why can the publisher not mark the row as sent first, and then publish it? That would remove the duplicates.',
      a: 'It would also bring back the lost events, in the same shape as the dual write. Marking first and crashing before ' +
         'the send loses the event permanently, and nothing downstream will ever know it existed. Between losing events and ' +
         'delivering some of them twice, delivering twice is the one you can defend, because the fix lives in one place you ' +
         'control: the consumer ignores an event id it has already handled. That choice, made deliberately, is what "at ' +
         'least once delivery" means, and it is what essentially every message system offers.'
    }},

    { h: 'At least once means your consumer must be idempotent' },
    { p: 'Given that duplicates will arrive, every consumer needs to be safe to run twice on the same event. The standard ' +
         'way is a table of what has been processed, written in the same transaction as the work:' },
    { code: 'create table processed_event (\n  consumer   text not null,\n  event_id   uuid not null,\n  handled_at timestamptz not null default now(),\n  primary key (consumer, event_id)\n);', lang: 'sql' },
    { code: 'def handle(event):\n    with db.transaction():\n        try:\n            db.execute("insert into processed_event (consumer, event_id) values (%s, %s)",\n                       ("emailer", event.id))\n        except UniqueViolation:\n            return                      # already done: do nothing, acknowledge\n        do_the_actual_work(event)       # inside the same transaction', lang: 'python' },
    { p: 'The insert and the work commit together, so either both happened or neither did. This gives you an **effect** that ' +
         'happens exactly once, out of a delivery that happens at least once, which is the only version of "exactly once" ' +
         'that exists in practice.' },
    { p: 'Some work is naturally idempotent and needs no table: setting a status to `captured`, or an upsert that writes a ' +
         'row keyed by payment id. Prefer those where you can. Sending an email is not one of them.' },

    { h: 'Partitions, and the order things arrive in' },
    { p: 'A topic is split into partitions so several consumers can work at once. The promise is narrow and exact: **events ' +
         'within one partition are delivered in order. Across partitions, there is no promise at all.**' },
    { p: 'Which means the partition key is a real design decision. Take the level 9 event stream, 37,987 events across ' +
         '20,000 payments, spread over 4 partitions, with each partition consumed at its own speed:' },
    { table: {
      head: ['Partition key', 'Events arriving out of order', 'Payments affected'],
      rows: [
        ['**The payment id**', '**0**', '**0 of 17,216**'],
        ['Anything else, such as round robin', '4,577', '4,534 of 17,216, or **26.3%**']
      ]
    }},
    { p: 'With the wrong key, a quarter of all payments had their events arrive in the wrong order: a capture before its ' +
         'authorisation, a refund before the capture it refunds. A consumer that trusts the order will build nonsense, and ' +
         'the bug appears only under load, only sometimes, and never on a developer machine with one consumer.' },
    { p: 'The rule: **partition by the thing whose order matters**. For payments that is the payment id, or sometimes the ' +
         'account id if you need ordering across a whole account.' },
    { warn: 'Choosing a key is a trade. Everything with the same key lands on one partition, so a single very busy account ' +
            'creates a hot partition that one consumer must handle alone. That is the price of ordering, and it is why you ' +
            'pick the narrowest key that still gives the order you actually need.' },
    { check: {
      q: 'Your consumer receives `payment.captured` for a payment it has never seen authorised, so it crashes. A colleague ' +
         'suggests retrying the event until the authorisation arrives. What is wrong with that, and what are the two real ' +
         'fixes?',
      a: 'Retrying blocks the partition. That consumer now cannot process anything behind that event, so one out of order ' +
         'message stops every other payment on the same partition, and if the authorisation went to a different partition ' +
         'it may never arrive in time at all. The first fix is the cause: partition by payment id, so the authorisation and ' +
         'the capture are on the same partition and cannot overtake each other, which measured at 0 violations against ' +
         '26.3% of payments affected. The second is defensive: write consumers that tolerate events arriving out of order ' +
         'where possible, by keying on the payment and treating the state as a set of facts rather than a sequence of ' +
         'instructions.'
    }},

    { h: 'Consumers, groups, and how far behind you are' },
    { p: 'A **consumer group** is how work gets shared: each partition of a topic is assigned to exactly one consumer in the ' +
         'group. That gives two facts worth knowing before an interview:' },
    { ul: [
      '**More consumers than partitions does nothing.** Six consumers on four partitions means two sit idle. If you want ' +
      'more parallelism, you need more partitions, and the number of partitions is chosen up front and awkward to change.',
      '**Different groups are independent.** The emailer and the analytics pipeline each read everything, each with their ' +
      'own position, so a slow emailer does not hold analytics back.'
    ]},
    { p: '**Lag** is the number that tells you whether any of this is working: how many events a consumer has not read yet. ' +
         'Measure it two ways, because they answer different questions. Lag in **events** tells you how much work is ' +
         'waiting. Lag in **seconds**, the age of the oldest unread event, tells you how out of date the world is, and it is ' +
         'the one to put an alert on: "the fraud consumer is nine minutes behind" is a sentence somebody can act on.' },

    { h: 'Batching is most of the performance' },
    { p: 'The publisher loop looks trivial, and how you write it changes the throughput by two orders of magnitude. Same ' +
         '400 events, same database, only the batch size differs:' },
    { table: {
      head: ['Rows read and marked per round trip', 'Time for 400 events', 'Throughput'],
      rows: [
        ['1', '30,473 ms', '13 events/s'],
        ['10', '3,083 ms', '130 events/s'],
        ['100', '343 ms', '1,165 events/s'],
        ['500', '116 ms', '**3,439 events/s**']
      ]
    }},
    { p: '**265 times faster** from batching alone, with no change to the database, the query or the network. The work per ' +
         'event never changed: what changed is the number of round trips, and a round trip to a database in another region ' +
         'costs about 60 ms whatever it carries, as level 7 measured.' },
    { p: 'This is the single most reliable performance lesson in backend work: when something is slow and the per item work ' +
         'is tiny, count the round trips before you optimise anything else.' },

    { h: 'The message that will never work' },
    { p: 'Eventually a consumer meets an event it cannot process: a field it does not understand, a payment that was ' +
         'deleted, a bug of your own. Retrying forever blocks the partition. Skipping silently loses data. The answer is a ' +
         '**dead letter queue**: after a small number of attempts, move the event somewhere else with the error attached, ' +
         'and carry on.' },
    { code: 'attempts: 1 -> retry in 1s\n           2 -> retry in 2s\n           3 -> retry in 4s\n           4 -> give up: write to payments.dead with the error and the offset,\n                acknowledge the original, and move on', lang: 'text' },
    { p: 'Then two rules make it useful rather than a bin. Somebody looks at it, on a schedule, because a dead letter queue ' +
         'nobody reads is data loss with extra steps. And it must be **replayable**: once the bug is fixed, you feed those ' +
         'events back through the consumer, which works precisely because the consumer is idempotent.' },

    { h: 'Replay, and why the log is worth keeping' },
    { p: 'Because a log keeps events rather than consuming them, a new consumer can start at the beginning and build its own ' +
         'view of the world. That is the property that makes event systems genuinely powerful:' },
    { ul: [
      '**A new feature** can be built against six months of history rather than starting empty.',
      '**A bug in a consumer** is fixed by correcting the code, resetting its position, and reprocessing. No migration, no ' +
      'backfill script.',
      '**A projection**, such as a merchant dashboard, can be rebuilt from scratch at any time, which means it is never the ' +
      'thing you are afraid to touch.'
    ]},
    { p: 'Two conditions make replay safe, and both are things you have already built. Consumers must be idempotent, so ' +
         'reprocessing does not double count. And retention must be long enough to contain what you might want to replay: ' +
         'a seven day retention means a bug found on the eighth day is unfixable this way.' },
    { check: {
      q: 'You fix a bug in the consumer that builds the merchant dashboard, reset its offset to the beginning, and replay ' +
         'four months of events. What has to be true for the dashboard to come out correct, and what will go wrong if the ' +
         'consumer also sends emails?',
      a: 'The dashboard has to be rebuilt from the events rather than adjusted by them: a projection that sets a value, or ' +
         'upserts a row keyed by payment id, replays cleanly, while one that increments a counter will count everything ' +
         'twice. And the emails are the classic disaster: replaying four months of events through a consumer that sends ' +
         'email sends four months of email again, in minutes, to real customers. That is why side effects that reach the ' +
         'outside world belong in their own consumer with their own group, kept separate from the ones that only build ' +
         'internal state, and why every replay starts with asking what this consumer does besides writing to a table.'
    }},

    { h: 'The event itself is a contract' },
    { p: 'Once another team consumes your event, its shape is a promise, exactly as an API response was in level 7. The same ' +
         'rules apply, with one addition:' },
    { code: '{\n  "event_id": "018f3a...",          <- unique, and stable across retries\n  "type": "payment.captured",\n  "version": 1,\n  "occurred_at": "2026-05-06T19:04:12Z",\n  "payment_id": "P010423",\n  "amount_minor": 7140,\n  "currency": "USD"\n}', lang: 'json' },
    { ul: [
      '**`event_id`** is what makes idempotent consumers possible. Generate it when the event is created, not when it is published, so a retry carries the same one.',
      '**`occurred_at`** is when the thing happened, which is not when the event was published or consumed. Consumers that care about time need the first, and only the producer knows it.',
      '**`version`** lets you change the shape later without breaking anybody, by publishing both versions for a while.',
      '**Adding a field is safe. Removing or renaming one is not.** Consumers you have never met are reading this.'
    ]},
    { money: 'This is the level that makes "event-driven architecture" on a CV survive questioning. The interview follow up ' +
             'is almost always one of three things: how do you avoid losing events between the database and the broker, ' +
             'what do you do about duplicates, and how do you keep ordering. You now have a measured answer to all three.' }
  ],

  tutorial: {
    intro: 'Two ways to run this. If Docker works for you, run Redpanda or Kafka locally and use the real thing. If it does ' +
           'not, the same patterns work with a table as the log, and every idea transfers: the outbox, idempotent ' +
           'consumers, partition keys and replay are all yours to write rather than the broker\'s. Build on the level 6 ' +
           'database and the level 9 events.',
    steps: [
      {
        t: 'Reproduce the loss',
        blocks: [
          { p: 'Before the fix, measure the problem. Write the naive version, inject a crash between the commit and the ' +
               'publish, and count what never got published.' },
          { code: 'for i in range(400):\n    with conn.cursor() as cur:\n        cur.execute("insert into demo_payments ...")\n    conn.commit()                      # the database has it\n    if rng.random() < 0.05:\n        continue                       # the process "dies" here\n    broker.publish(...)', lang: 'python' },
          { code: 'payments written to the database : 400\nevents actually published        : 380\nevents lost forever              : 20  (5.00%)', lang: 'text' },
          { p: 'Then try the other order, publishing before committing, and convince yourself it is worse.' }
        ],
        check: 'You can state exactly how many events your naive version loses, and why swapping the order is not a fix.'
      },
      {
        t: 'Add the outbox',
        blocks: [
          { p: 'One table, one index, and the event written inside the same transaction as the payment. The partial index on ' +
               'unpublished rows is what keeps the publisher fast when the table has millions of rows in it.' },
          { code: 'create index outbox_unpublished on outbox (id) where published_at is null;', lang: 'sql' },
          { warn: 'Without that partial index the publisher scans the whole outbox every few seconds looking for the few ' +
                  'unpublished rows, which is level 6\'s unindexed foreign key all over again: fine at a thousand rows, ' +
                  'fatal at ten million.' }
        ],
        check: 'A payment and its event are written in one transaction, and rolling back loses both.'
      },
      {
        t: 'Write the publisher, and measure the batch size',
        blocks: [
          { code: 'select id, topic, partition_key, payload\n  from outbox\n where published_at is null\n order by id\n limit %s\n   for update skip locked;        -- so two publishers never send the same row', lang: 'sql' },
          { p: '`for update skip locked` is the line that lets you run two publishers safely: each takes rows the other has ' +
               'not locked, so they share the work without coordination.' },
          { code: 'batch    1:  30473 ms for 400 events       13 events/s\nbatch   10:   3083 ms                     130 events/s\nbatch  100:    343 ms                   1,165 events/s\nbatch  500:    116 ms                   3,439 events/s', lang: 'text' },
          { p: 'Reproduce that table with your own numbers. It is the most transferable thing in this level.' }
        ],
        check: 'Two publishers running at once never publish the same row, and your batch table shows the same shape.'
      },
      {
        t: 'Prove the duplicates',
        blocks: [
          { p: 'Inject a crash between sending and marking, run the publisher to completion, and count. You should lose ' +
               'nothing and deliver some events twice.' },
          { code: 'payments written                 : 400\ndistinct events delivered        : 400\nevents lost forever              : 0\nduplicate deliveries             : 14  (3.50%)', lang: 'text' },
          { p: 'Write that pair of numbers in your README next to the dual write pair. Those four numbers are the argument ' +
               'for the whole pattern.' }
        ],
        check: 'Zero lost, some duplicates, and nothing left unpublished when the publisher stops.'
      },
      {
        t: 'Make the consumer idempotent',
        blocks: [
          { p: 'Build a consumer that maintains a projection: a table of payments by merchant with totals. Then make it safe ' +
               'to run twice, and prove it by feeding it the same events again.' },
          { code: 'with db.transaction():\n    try:\n        db.execute("insert into processed_event (consumer, event_id) values (%s, %s)",\n                   ("merchant_totals", event["event_id"]))\n    except UniqueViolation:\n        return                       # seen it: acknowledge and stop\n    apply(event)                     # same transaction as the marker', lang: 'python' },
          { tip: 'Then try the other approach for comparison: make the projection an upsert keyed by payment id, so it is ' +
                 'naturally idempotent and needs no marker table. Note in your README which one you would use where.' }
        ],
        check: 'Replaying the entire stream twice leaves the projection identical to replaying it once.'
      },
      {
        t: 'Partition, and break the order on purpose',
        blocks: [
          { p: 'Spread the level 9 events over four partitions, consume each at a different speed, and count how often an ' +
               'event for a payment arrives before an earlier one. Do it twice: keyed by payment id, and keyed at random.' },
          { code: 'partition by payment id : 0 out of order,    0 of 17,216 payments affected\npartition at random     : 4,577 out of order, 4,534 payments affected (26.3%)', lang: 'text' },
          { p: 'Then write the consumer that would break: one that refuses a capture for a payment it has not seen ' +
               'authorised, and watch it fail only in the second configuration.' }
        ],
        check: 'Your two runs show zero violations with the right key and thousands with the wrong one.'
      },
      {
        t: 'Dead letter and replay',
        blocks: [
          { p: 'Add an event your consumer cannot handle. Give it three attempts with growing delays, then move it to a dead ' +
               'letter table with the error, the offset and the payload, and carry on.' },
          { code: 'create table dead_letter (\n  id          bigserial primary key,\n  consumer    text        not null,\n  event_id    uuid        not null,\n  payload     jsonb       not null,\n  error       text        not null,\n  failed_at   timestamptz not null default now(),\n  replayed_at timestamptz\n);', lang: 'sql' },
          { p: 'Then fix the bug, replay the dead letters through the same consumer, and confirm the projection is correct ' +
               'and nothing was double counted.' }
        ],
        check: 'A poison event does not block the partition, and replaying it after the fix produces the right totals.'
      },
      {
        t: 'Rebuild everything from the log',
        blocks: [
          { p: 'The final exercise, and the one that shows the point. Delete the projection table entirely, reset the ' +
               'consumer position to zero, and rebuild it from the events. Compare the result against what it was before.' },
          { code: 'truncate merchant_totals;\nupdate consumer_offset set position = 0 where consumer = \'merchant_totals\';\n-- then run the consumer to the end', lang: 'sql' },
          { p: 'Then answer the question in your README: which of your consumers would be dangerous to replay, and what you ' +
               'would do about it before ever resetting an offset in production.' }
        ],
        check: 'The rebuilt projection matches the original exactly, row for row.'
      }
    ]
  },

  glossary: [
    { t: 'Event', d: 'A record that something happened, published for anybody who cares to read.' },
    { t: 'Log', d: 'An append-only ordered list of events, kept after reading, with each consumer tracking its own position.' },
    { t: 'Topic', d: 'A named stream of related events.' },
    { t: 'Partition', d: 'One part of a topic. Order is guaranteed within a partition and nowhere else.' },
    { t: 'Partition key', d: 'The value that decides which partition an event goes to, and therefore what stays in order.' },
    { t: 'Offset', d: 'An event\'s position within its partition.' },
    { t: 'Consumer group', d: 'Consumers sharing the partitions of a topic. Each partition goes to exactly one of them.' },
    { t: 'Lag', d: 'How far behind a consumer is, in events and in seconds. Alert on the seconds.' },
    { t: 'Retention', d: 'How long the log keeps events before deleting them, which sets how far back you can replay.' },
    { t: 'Dual write', d: 'Writing to two systems with no shared transaction. The bug this level measures.' },
    { t: 'Outbox pattern', d: 'Writing the event into the same database transaction, and publishing it from there.' },
    { t: 'At least once', d: 'The delivery guarantee you actually get: nothing is lost, some things arrive twice.' },
    { t: 'Idempotent consumer', d: 'One that can process the same event twice with no extra effect.' },
    { t: 'Exactly once effect', d: 'What idempotent consumers give you, and the only honest version of exactly once.' },
    { t: 'Projection', d: 'A table built by consuming events, which can be rebuilt by replaying them.' },
    { t: 'Replay', d: 'Reprocessing events from an earlier position, to rebuild state or fix a consumer bug.' },
    { t: 'Dead letter queue', d: 'Where an event goes after repeated failures, so it stops blocking the partition.' },
    { t: 'Poison message', d: 'An event that will never process successfully, whatever you do.' },
    { t: 'skip locked', d: 'A Postgres clause letting several workers take different rows from the same table safely.' }
  ],

  quiz: [
    { q: "What is the main difference between a log and a queue?",
      options: [
        "A log can only have one consumer",
        "In a log the event stays after being read, and each consumer tracks its own position",
        "A queue guarantees ordering and a log does not",
        "A log is faster"
      ],
      answer: 1,
      why: "Which is what makes replay and independent consumers possible. A queue is for work; a log is for facts." },

    { q: "Your code commits a payment and then publishes an event, with a 5% chance of dying in between. Measured over 400 payments, what happened?",
      options: [
        "20 events were lost forever, with no error anywhere",
        "Nothing: the database rolls back",
        "20 events were delivered twice",
        "The broker retried them"
      ],
      answer: 0,
      why: "No alert, no way to find them except by reconciling two systems, which should not be how you learn about it." },

    { q: "Publishing before committing instead is:",
      options: [
        "Worse: you announce payments that may never exist, and you cannot unsend an event",
        "The correct fix",
        "Equivalent",
        "Only safe with a queue"
      ],
      answer: 0,
      why: "Fraud, analytics and the merchant all act on something your database never recorded." },

    { q: "The outbox pattern works because:",
      options: [
        "It deduplicates events",
        "The broker becomes transactional",
        "The event is written to the same database in the same transaction as the business change, so both happen or neither does",
        "It retries the publish until it works"
      ],
      answer: 2,
      why: "One system, one transaction. A separate publisher then moves the events out of the table." },

    { q: "With the outbox, the measured result was zero lost and 3.50% delivered twice. Why not mark rows as sent before publishing?",
      options: [
        "Because crashing between the mark and the send loses the event permanently, which is the problem you just fixed",
        "Because the index would not be used",
        "It would break ordering",
        "It would be slower"
      ],
      answer: 0,
      why: "Duplicates are defensible because the fix lives in one place you control: the consumer." },

    { q: "What makes a consumer idempotent?",
      options: [
        "Acknowledging quickly",
        "Recording the event id and doing the work in one transaction, so a repeat does nothing",
        "Using a dead letter queue",
        "Processing events in order"
      ],
      answer: 1,
      why: "That is how an at-least-once delivery becomes an exactly-once effect, which is the only version that exists." },

    { q: "A log guarantees ordering:",
      options: [
        "Across the whole topic",
        "Only if you enable it",
        "Within a partition only",
        "Only for a single consumer"
      ],
      answer: 2,
      why: "Which is what makes the partition key a design decision rather than a detail." },

    { q: "Measured over 37,987 real events in 4 partitions, partitioning at random instead of by payment id caused:",
      options: [
        "No difference",
        "Events out of order for 26.3% of multi event payments",
        "Slower consumers",
        "Duplicate delivery"
      ],
      answer: 1,
      why: "Captures before authorisations, refunds before captures. Invisible on one consumer and constant under load." },

    { q: "The cost of partitioning by a narrow key such as account id is:",
      options: [
        "Consumers cannot be idempotent",
        "A very busy account creates a hot partition that one consumer must handle alone",
        "Ordering is no longer guaranteed",
        "Events can be lost"
      ],
      answer: 1,
      why: "Pick the narrowest key that still gives the order you actually need." },

    { q: "You run six consumers in one group on a topic with four partitions. What happens?",
      options: [
        "The group rebalances into six partitions",
        "Throughput rises by 50%",
        "Each consumer gets two thirds of a partition",
        "Two consumers sit idle, because a partition goes to exactly one consumer in the group"
      ],
      answer: 3,
      why: "More parallelism needs more partitions, and the partition count is chosen up front and awkward to change." },

    { q: "Which lag measurement should you alert on?",
      options: [
        "Lag in seconds, because it says how out of date the world is",
        "Neither: alert on consumer restarts",
        "Lag in events, because it counts work",
        "Both, with the same threshold"
      ],
      answer: 0,
      why: "\"The fraud consumer is nine minutes behind\" is actionable. \"The fraud consumer is 40,000 events behind\" depends on the rate." },

    { q: "Publishing 400 events took 30,473 ms one row at a time and 116 ms in batches of 500. What does that teach?",
      options: [
        "The database was warming up",
        "Batches use less memory",
        "The index was missing",
        "When per item work is tiny, count the round trips before optimising anything else"
      ],
      answer: 3,
      why: "265 times faster with no change to the query, the database or the network." },

    { q: "An event fails every time it is processed. The right handling is:",
      options: [
        "Skip it and log a warning",
        "Retry forever, so nothing is lost",
        "A few retries with growing delays, then move it to a dead letter table with the error, and carry on",
        "Restart the consumer"
      ],
      answer: 2,
      why: "Retrying forever blocks the partition and everything behind it. Skipping silently is data loss." },

    { q: "Before replaying four months of events through a consumer, the thing to check is:",
      options: [
        "The partition count",
        "The broker version",
        "Whether the consumer does anything besides write to a table, such as sending email",
        "The retention setting"
      ],
      answer: 2,
      why: "Replaying four months of emails to real customers in ten minutes is the classic replay disaster." },

    { q: "Why does every event carry an `event_id` generated when it is created rather than when it is published?",
      options: [
        "To sort events",
        "To support partitioning",
        "Because the broker requires it",
        "So a republished event keeps the same id, which is what lets consumers recognise a duplicate"
      ],
      answer: 3,
      why: "An id generated at publish time changes on every retry, which defeats the whole idempotency scheme." }
  ],

  project: {
    title: 'outbox: events that cannot be lost, consumers that cannot double count',
    story: 'Take the level 9 payment service and make it publish events properly. Measure what the naive version loses, fix ' +
           'it with an outbox, deal with the duplicates that appear, choose a partition key and prove it matters, then ' +
           'rebuild a projection from the log.',
    scope: 'Uses levels 6, 7 and 9. Kafka or Redpanda in Docker if you can run it; a Postgres table as the log if you ' +
           'cannot, since every pattern here is yours to implement rather than the broker\'s.',
    dataset: '{{RAW}}/data/level-09-card-events.csv',
    requirements: [
      'A measured dual write experiment: N payments, an injected crash rate, and a count of events lost forever',
      'An outbox table written in the same transaction as the business change, with a partial index on unpublished rows',
      'A publisher using `for update skip locked` so two publishers can run at once without sending the same row twice',
      'A measured comparison of batch sizes, reporting time and throughput for at least four sizes',
      'A crash injected between sending and marking, with the duplicate rate measured and reported',
      'An idempotent consumer using a processed event table, and a second consumer made naturally idempotent with an upsert',
      'A projection of merchant totals built entirely by consuming events',
      'Proof that replaying the whole stream twice leaves the projection identical',
      'A partitioning experiment over the level 9 events, keyed by payment id and keyed at random, reporting out of order events and payments affected',
      'A consumer that depends on order, shown failing under the wrong partition key and passing under the right one',
      'Retries with growing delays and a dead letter table holding the payload, the error and the offset',
      'A replay of the dead letters after fixing the bug, with no double counting',
      'A full rebuild: truncate the projection, reset the offset, replay, and compare row for row',
      'A README with the four headline numbers (lost, duplicated, out of order, throughput) and a paragraph on which of your consumers would be dangerous to replay',
      'The repository public on GitHub as `outbox`'
    ],
    starter: {
      lang: 'python',
      code: '"""FinQuest level 11: events, the outbox, and ordering.\n\nLayout:\n  events/outbox.py     write the event in the business transaction\n  events/publisher.py  read unpublished rows, send, mark sent\n  events/consumer.py   idempotent handling, with a processed_event table\n  events/partition.py  choose a partition, and measure what that choice costs\n  events/dlq.py        retries, then a dead letter with the error attached\n  bench/dual_write.py  the experiment that shows why any of this is needed\n"""\n\nimport json\nimport uuid\n\n\ndef emit(cur, topic: str, partition_key: str, payload: dict) -> str:\n    """Write an event into the outbox. MUST be called inside the caller\'s transaction."""\n    event_id = str(uuid.uuid4())\n    # TODO: insert into outbox, returning event_id\n    raise NotImplementedError\n\n\ndef publish_batch(conn, broker, batch: int = 500) -> int:\n    """Take up to `batch` unpublished rows with skip locked, send them, mark them sent."""\n    # TODO\n    raise NotImplementedError\n\n\ndef handle(conn, consumer: str, event: dict) -> None:\n    """Idempotent: record the event id and do the work in one transaction."""\n    # TODO\n    raise NotImplementedError\n\n\ndef partition_for(key: str, partitions: int) -> int:\n    """Which partition an event goes to. This one line decides what stays in order."""\n    # TODO\n    raise NotImplementedError\n'
    },
    tests: [
      'The dual write experiment loses events at approximately the injected crash rate',
      'A rolled back business transaction leaves no row in the outbox',
      'The publisher sends every unpublished row and marks it, leaving none behind',
      'Two publishers running at once never publish the same row',
      'A crash between sending and marking produces duplicates and no losses',
      'The idempotent consumer applied to the same event twice changes the projection once',
      'Replaying the entire stream twice leaves the projection byte for byte identical',
      'Partitioning by payment id gives zero out of order events across the level 9 stream',
      'Partitioning at random gives thousands, affecting roughly a quarter of multi event payments',
      'An order dependent consumer fails under the random key and passes under the payment key',
      'A poison event reaches the dead letter table after the configured attempts and does not block the partition',
      'Replaying a dead letter after the fix produces correct totals with no double counting',
      'A full rebuild from offset zero reproduces the projection exactly'
    ],
    rubric: [
      { pts: 25, t: 'The problem measured', d: 'Dual write losses and outbox duplicates, both measured with your own numbers and both in the README.' },
      { pts: 25, t: 'Delivery handled honestly', d: 'Outbox in one transaction, skip locked publisher, idempotent consumers, and an explanation of at least once.' },
      { pts: 20, t: 'Ordering understood', d: 'The partitioning experiment, a consumer that shows the difference, and a stated key with its trade-off.' },
      { pts: 15, t: 'Failure handled', d: 'Retries with backoff, a dead letter table with the error, and a replay that does not double count.' },
      { pts: 15, t: 'Replayable', d: 'A projection rebuilt from zero, and a written answer on which consumers are dangerous to replay.' }
    ],
    stretch: [
      'Run real Kafka or Redpanda in Docker and move your publisher onto it, keeping the same consumer code',
      'Add change data capture with Debezium and compare it with the polling publisher: what each costs and what each guarantees',
      'Measure consumer lag in both events and seconds, and build the alert you would actually page on',
      'Add a schema registry, publish version 2 of an event alongside version 1, and migrate a consumer with neither side stopping',
      'Add exactly once semantics with Kafka transactions, then write down honestly what it does and does not guarantee end to end'
    ],
    solutionPath: 'solutions/level-11'
  },

  faq: [
    { q: 'Do I need Kafka to do this level?',
      a: 'No. Every pattern here, the outbox, idempotent consumers, partition keys, dead letters and replay, is yours to implement. Kafka gives you durability and scale; a table gives you the same lessons on a laptop. If Docker works for you, use Redpanda, which is Kafka compatible and starts in one container.' },
    { q: 'Is the outbox not just a queue in my database?',
      a: 'Yes, and that is the point: it is a queue in the database that already holds your business data, which is why it can share a transaction with the write. It is a handover mechanism, not a replacement for the broker.' },
    { q: 'What about change data capture instead?',
      a: 'Reading the database\'s own replication log, with something like Debezium, is the other standard answer and avoids the polling. It gives you every change rather than the events you chose to publish, which is a different trade. Knowing both and being able to say which you would pick is a strong interview answer.' },
    { q: 'How long should I keep events?',
      a: 'Long enough to replay whatever you might need to rebuild, which for a payments company usually means months rather than days. Then ask the harder question: if your events contain personal data, retention interacts with the deletion rules from level 10.' },
    { q: 'My publisher is slow',
      a: 'Check the batch size first: 400 events took 30 seconds one at a time and 116 ms in batches of 500. Then check that the partial index on unpublished rows exists, because without it every poll scans the whole table.' },
    { q: 'Two consumers keep processing the same event',
      a: 'Either they are in different consumer groups, which is correct behaviour and probably what you want, or your publisher is not using `for update skip locked` and two publishers are sending the same row.' },
    { q: 'What do I say about this project in an interview?',
      a: 'Lead with the four numbers: 5% of events lost by the naive version, zero lost with the outbox, 3.5% delivered twice as a result, and 26.3% of payments out of order under the wrong partition key. Then say what each number made you build. That is a systems answer with evidence, which is rare.' }
  ]
});
