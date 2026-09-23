/* =========================================================================
   LEVEL 13: the table that outgrew the machine
   ========================================================================= */
FQ.registerLevel({
  id: 13,
  codename: 'migrate',
  title: 'The table that outgrew the machine',
  tagline: 'Two hundred million payments in one table, a column that has to change type, and a product that cannot go down while you fix either. Partitioning, replicas, and a migration nobody notices.',
  difficulty: 9,
  minutes: 480,
  tags: ['partitioning', 'migrations', 'backfills', 'read replicas', 'change data capture'],
  summary: 'The last level of the payments core. Your schema was right at a million rows and is wrong at two hundred ' +
           'million: deletes take minutes, one ALTER TABLE locks the whole product, and the read load has outgrown the ' +
           'primary. This level teaches partitioning, replicas, expand and contract migrations and batched backfills, ' +
           'with every claim measured on a real Postgres.',

  objectives: [
    'Partition a table by time, and say what it costs as well as what it buys',
    'Choose a partition key from the queries rather than from the data',
    'Read the lock level of a migration before running it',
    'Run an expand and contract migration with no downtime and no lost writes',
    'Backfill hundreds of millions of rows without holding a lock or a transaction open',
    'Route reads to a replica without showing anyone stale data they just wrote',
    'Explain change data capture, and when it beats the outbox'
  ],

  knowledge: [
    { h: 'The two problems, and why they arrive together' },
    { p: 'A payments table that works fine for a year stops working for two reasons at once, and they are different ' +
         'problems with different answers:' },
    { ul: [
      '**It got big.** Queries that touched a thousand pages now touch a million. Deleting old data takes minutes and returns no disk. The indexes no longer fit in memory.',
      '**It has to change.** A column needs a new type, a new column needs filling in for every existing row, and the product cannot stop while you do it.'
    ]},
    { p: 'The first half of this level is partitioning and replicas. The second half is changing a live schema. Every ' +
         'number below was measured on Postgres 18 with 500,000 payments, which is small: it is the *ratios* that ' +
         'carry over, and they get worse as the table grows, never better.' },

    { h: 'Partitioning: one table, many tables' },
    { p: 'A **partitioned table** is one logical table made of many physical ones. You declare a **partition key**, and ' +
         'every row lands in the partition that covers its value. For payments the key is almost always time:' },
    { code: 'create table payments (\n  id           bigserial,\n  merchant_id  int not null,\n  amount_minor bigint not null,\n  created_at   timestamptz not null,\n  primary key (id, created_at)        -- the key must be in every unique index\n) partition by range (created_at);\n\ncreate table payments_2025_07 partition of payments\n  for values from (\'2025-07-01\') to (\'2025-08-01\');', lang: 'sql' },
    { p: 'Your application keeps inserting into `payments` and keeps querying `payments`. Postgres decides which physical ' +
         'table each row belongs to, and, when the query mentions the key, which ones it can skip. That skipping is called ' +
         '**partition pruning**, and here it is on a monthly aggregate:' },
    { table: {
      head: ['Same query, same 42,920 rows', 'One plain table', 'Partitioned by month'],
      rows: [
        ['Plan', 'Bitmap index scan on the whole table', 'Sequential scan of one partition'],
        ['Pages touched', '4,729', '**396**'],
        ['Execution time', '19.7 ms', '**13.7 ms**']
      ]
    }},
    { p: 'The time is not the interesting column. The pages are. On the plain table July is scattered across the whole ' +
         'heap, so reading 42,920 rows means visiting 4,609 separate blocks. In the partitioned table July *is* a table, ' +
         'so those rows are physically next to each other and the same answer costs a twelfth of the reads. That ratio ' +
         'grows with the table: the pruned scan stays the size of one month forever.' },

    { h: 'The real reason to partition: getting rid of data' },
    { p: 'Pruning is a nice-to-have. Retention is the reason people actually partition. Compare deleting one month of ' +
         'payments the ordinary way with dropping the month as a partition:' },
    { table: {
      head: ['Removing one month (about 42,000 payments)', 'DELETE', 'DROP the partition'],
      rows: [
        ['Time', '47.2 ms', '**0.9 ms**'],
        ['Write ahead log produced', '2,947 kB', '**5,400 bytes**'],
        ['Disk returned', '**none**: the table stayed 57 MB', 'all 5,336 kB, immediately'],
        ['Work left behind', 'dead rows for vacuum to clean up', 'none']
      ]
    }},
    { p: 'Fifty times faster, five hundred times less log, and the space actually comes back. Scale those ratios to a ' +
         'real table and the difference is a delete job that runs for hours every night and bloats the table, against a ' +
         'single statement that finishes before you let go of the return key.' },
    { warn: 'A DELETE does not shrink a table. It marks rows dead and the space is reused for future rows, which means a ' +
            'table you delete from constantly stays permanently large. Getting the disk back needs `VACUUM FULL`, which ' +
            'takes an exclusive lock and a full copy: exactly the outage you were trying to avoid.' },
    { check: {
      q: 'Your table has two years of payments and you keep eighteen months. Why is partitioning by month better than a ' +
         'nightly job that deletes the oldest day, even if that job currently finishes in ten minutes?',
      a: 'Three reasons, and only the first is speed. The delete rewrites every row it touches into the write ahead log, ' +
         'so it ships to every replica and every consumer downstream, every night, forever. The space never comes back, ' +
         'so the table and its indexes keep growing even though the row count is flat, which slowly degrades every other ' +
         'query. And the job gets slower as the table grows, so the ten minutes becomes twenty and then an hour, and it ' +
         'starts overlapping the day it was supposed to finish before. Dropping a partition has none of those properties: ' +
         'the cost is the same whether the table holds a million rows or a billion.'
    }},

    { h: 'What partitioning costs' },
    { p: 'This is the part the tutorials leave out, and the part interviewers ask about. Every query that does *not* ' +
         'mention the partition key has to visit every partition. The same lookup by merchant, on the same data:' },
    { table: {
      head: ['Find one merchant\'s payments (67 rows)', 'One plain table', 'Partitioned by month'],
      rows: [
        ['Index scans', '1', '10, one per partition'],
        ['Planning time', '0.188 ms', '**0.898 ms**'],
        ['Execution time', '0.222 ms', '0.342 ms']
      ]
    }},
    { p: 'Look at what happened to planning. The planner now opens ten partitions and ten indexes to plan a query that ' +
         'executes in a third of a millisecond, so **planning costs more than the work**. With a hundred partitions it is ' +
         'worse, and this is the moment somebody discovers that their busiest endpoint got slower after the migration ' +
         'that was supposed to speed everything up.' },
    { p: 'The other costs, in order of how often they bite:' },
    { ul: [
      '**Unique constraints must include the partition key.** You cannot have a unique index on `reference` alone: it becomes unique on `(reference, created_at)`, which is not the same promise. Level 9\'s idempotency key needs rethinking.',
      '**Foreign keys pointing at a partitioned table** are supported but restricted, and were not at all before Postgres 12. Check before assuming.',
      '**Somebody has to create next month\'s partition.** If nobody does, inserts fail at midnight on the first. Automate it, and alert if the next two months do not exist.',
      '**A query with no time filter reads everything,** which is the cost above multiplied by however many partitions you have.'
    ]},
    { money: 'That is the shape of the answer when an interviewer asks whether you would partition: not "yes, it is ' +
             'faster", but "it makes time-ranged reads and retention much cheaper, it makes key-less lookups and planning ' +
             'more expensive, and here is which of those my traffic does more of". Then the measured ratios.' },

    { h: 'Choosing the key: look at the queries, not the rows' },
    { p: 'The key is decided by what your queries filter on and what you delete, not by what looks evenly distributed:' },
    { table: {
      head: ['Key', 'Good when', 'Bad because'],
      rows: [
        ['`created_at`, monthly', 'Reports by period, retention by age, most payments work', 'Lookups by merchant or reference hit every partition'],
        ['`merchant_id`, hashed', 'Almost everything filters by merchant, per-merchant isolation', 'You can never drop old data cheaply, and one huge merchant unbalances it'],
        ['Status or type', 'Almost never', 'Rows move between partitions when the status changes, which is an expensive delete plus insert']
      ]
    }},
    { p: 'For a payments core, time wins, because retention is the problem partitioning is actually solving and every ' +
         'report is a date range. For a merchant dashboard read from a separate service, hashing by merchant can be right. ' +
         'Notice this is the same decision as level 11\'s partition key for the event log, asked again about storage: ' +
         '**what do you want to be cheap, and what are you willing to make expensive.**' },

    { h: 'Read replicas, and the trap in them' },
    { p: 'A **read replica** is a second Postgres that replays the primary\'s write ahead log and serves read-only ' +
         'queries. It is how you survive read load that the primary cannot take: reports, dashboards, exports, anything ' +
         'analytical. A replica is also not a backup, because it faithfully replays the delete you regret, and promoting ' +
         'one after a failure is a separate procedure you have to have written down in advance.' },
    { p: 'The trap is **replication lag**. The replica is always a little behind, usually milliseconds, sometimes much ' +
         'more, and this is where the measurement from the backfill section matters. That single backfill produced ' +
         '180 MB of log. A replica shipping 10 MB a second needs 18 seconds to replay it (that is arithmetic, not a ' +
         'measurement), and for those 18 seconds everything reading from the replica is showing data from before you ' +
         'started.' },
    { p: 'Which produces the bug that support cannot reproduce: a merchant issues a refund, the write goes to the ' +
         'primary, the page reloads, the read goes to the replica, and the refund is not there. They issue it again.' },
    { ul: [
      '**Read your own writes goes to the primary.** After a user writes, their next read of that object is not a replica read. Pin it for a few seconds, or route by "has this session written recently".',
      '**Anything that decides money goes to the primary.** Balance checks, limit checks, idempotency lookups. A stale read here is a double spend.',
      '**Reports, exports and dashboards go to the replica.** They are the reason you have one, and nobody minds if they are two seconds old.',
      '**Alert on the lag,** in seconds and in bytes, and have the router fall back to the primary when the lag crosses your threshold.'
    ]},
    { check: {
      q: 'A colleague proposes sending all `GET` requests to the replica and all `POST` requests to the primary, because ' +
         'it is a simple rule that needs no per-query thought. What breaks?',
      a: 'Read your own writes breaks immediately: the `POST` that creates a payment goes to the primary, the `GET` that ' +
         'the browser fires straight afterwards goes to the replica, and the payment does not exist yet, so the client ' +
         'shows an error or retries and creates a second one. The rule also sends the dangerous reads to the wrong place, ' +
         'because a balance check, a limit check and an idempotency lookup are all `GET` shaped reads whose staleness ' +
         'costs real money, while it keeps cheap reads on the primary whenever they happen to sit inside a write ' +
         'endpoint. The routing decision is about what the read is *for*, which the HTTP verb does not tell you.'
    }},

    { h: 'Postgres, Redis, or something else entirely' },
    { p: 'Every level so far has put data in Postgres, which was the right answer every time and will not always be. ' +
         'Job descriptions ask for "relational and NoSQL databases", and the interview question behind that phrase is ' +
         'never which one is better. It is **which access pattern you have**, because that is what decides.' },
    { table: {
      head: ['Store', 'Right when', 'What you give up'],
      rows: [
        ['**Relational**, Postgres', 'Invariants across rows, transactions, constraints, and queries nobody predicted', 'One machine\'s worth of writes, which is far more than most companies ever need'],
        ['**Key value**, Redis', 'Counters, caches, rate limits, short lived shared state, at very high rates', 'Durability. Everything in it must be losable, as level 14 said'],
        ['**Wide column**, DynamoDB or Cassandra', 'One or two access patterns you can name in advance, enormous scale, no cross row invariants', 'Ad hoc queries, joins, and constraints the database enforces for you'],
        ['**Document**, MongoDB', 'Objects whose shape varies and that are read whole', 'The same, plus schema discipline you now have to impose yourself'],
        ['**Object storage**, S3', 'Files: settlement files, exports, backups, anything large and whole', 'Any query at all. It is a filesystem with a bill'],
        ['**Column store**, Redshift or ClickHouse', 'Analytics over hundreds of millions of rows, a few columns at a time', 'Single row writes and updates, which it is bad at on purpose']
      ]
    }},
    { p: 'For a payments company the split settles quickly, and being able to say it in one breath is the point of this ' +
         'section. **The ledger is relational, always**, because the invariant that debits equal credits is a constraint ' +
         'you want the database to enforce rather than one you hope your code maintains. **Counters and caches are ' +
         'Redis**, because they are hot, small and losable. **Files go to object storage.** **Analytics goes to a column ' +
         'store**, fed by the change data capture from the previous section.' },
    { p: 'The honest case for a wide column store in a payments system does exist, and naming it is what separates a ' +
         'real answer from a memorised one. A **token vault lookup** from level 15 is one key to one value, billions of ' +
         'times, with no cross row invariant. So is an **idempotency key store**, a **session store**, and a **device ' +
         'fingerprint history**. Those are DynamoDB shaped problems, and putting them in your main Postgres because that ' +
         'is where everything else lives is its own mistake.' },
    { warn: 'The answer that loses the interview is "we would use DynamoDB for the ledger, for scale". It has ' +
            'transactions across a limited number of items and conditional writes, so it can do a good deal. What it has ' +
            'is no foreign keys, nothing that can enforce "every transaction balances", and no way to answer a question you ' +
            'did not design a key for without a scan. You would be reimplementing constraints in application code, and ' +
            'the storage arithmetic says you did not need the write throughput anyway: at 130 million payments a month ' +
            'you are looking at a few terabytes a year.' },
    { p: 'And the rule that covers the whole table: **pick the store from the query, not from the volume.** Volume is ' +
         'the reason people think they need something else; the access pattern is the reason they actually might.' },

    { h: 'The migration that takes the site down' },
    { p: 'Now the second half. Five migrations, all one line, all on the same table. Three are free and two are outages, ' +
         'and the diff does not tell you which is which:' },
    { table: {
      head: ['Migration', 'Time', 'Log produced', 'What it locks'],
      rows: [
        ['`add column region text`', '0.7 ms', '504 bytes', 'Brief exclusive lock, catalog only'],
        ['`add column tier text not null default \'standard\'`', '0.6 ms', '2,208 bytes', 'Same: the default is stored, not written'],
        ['`add column token uuid not null default gen_random_uuid()`', '**1,526 ms**', '**70 MB**', 'Everything, for the whole rewrite'],
        ['`alter column amount_minor type numeric`', '**837 ms**', '**67 MB**', 'Everything, plus every index rebuilt'],
        ['`create index on payments (merchant_id)`', '254 ms', '2,590 kB', 'Writes blocked, reads fine']
      ]
    }},
    { p: 'Rows two and three differ by one word. A constant default is recorded once in the catalog and applied as rows ' +
         'are read, so it is instant at any table size. A **volatile** default such as `gen_random_uuid()` has to produce ' +
         'a different value per row, so Postgres rewrites the entire table while holding `ACCESS EXCLUSIVE`, which blocks ' +
         'every reader and every writer.' },
    { p: 'And remember the scale. This is 415,554 rows. At two hundred million, that 1.5 seconds is closer to twelve ' +
         'minutes, and twelve minutes of `ACCESS EXCLUSIVE` on the payments table is a full outage of the product.' },

    { h: 'The lock queue, and the one setting that saves you' },
    { p: 'There is a failure worse than a slow migration, and it catches people who tested on an idle database. Postgres ' +
         'locks are queued and fair, so this happens:' },
    { code: '1. A reporting query has been running for 4 minutes. It holds a light lock.\n2. Your ALTER TABLE asks for ACCESS EXCLUSIVE. It cannot start, so it waits.\n3. Every new query on that table now queues BEHIND your ALTER.\n4. The product is down, and the migration has not executed a single row.', lang: 'text' },
    { p: 'A migration that would have taken one second takes the site down for four minutes, because of a query it has ' +
         'nothing to do with. The fix is two lines at the top of every migration:' },
    { code: 'set lock_timeout = \'3s\';        -- give up rather than build a queue\nset statement_timeout = \'30s\';  -- and never run long while holding one', lang: 'sql' },
    { p: 'Now the migration fails fast and harmlessly instead of blocking the product, and your deploy tool retries it. ' +
         '**Failing is fine. Queueing is not.**' },
    { tip: 'Build indexes with `create index concurrently`. It does more work, in two passes, and cannot run inside a ' +
           'transaction, and in exchange it never blocks writes. If it fails it leaves an invalid index behind, which you ' +
           'drop and retry, so check `pg_index.indisvalid` afterwards rather than assuming.' },

    { h: 'Expand and contract' },
    { p: 'The pattern that makes any schema change safe. Instead of one migration that changes the shape and the code at ' +
         'the same moment, you do six deploys where old and new coexist:' },
    { code: '1. EXPAND    add the new column or table. Nothing reads it. Instant, nullable, no default.\n2. DUAL WRITE  the application writes both old and new. Still reads old.\n3. BACKFILL   fill the new column for existing rows, in batches, over hours or days.\n4. VERIFY     prove old and new agree for every row. Not a sample. Every row.\n5. SWITCH     the application reads new. Still writes both, so rollback is one deploy.\n6. CONTRACT   stop writing old, then drop it, days later, once you are sure.', lang: 'text' },
    { p: 'Every step is reversible on its own, which is the whole point. The dangerous version of this migration is a ' +
         'single deploy where the column changes type and the code changes at the same instant, and rolling back means ' +
         'another rewrite of a table that is now taking writes in the new format.' },
    { warn: 'Step 6 is the one people skip, and then the old column sits there for two years, written by code nobody ' +
            'understands, until somebody deletes the write and a report silently starts reading a column that stopped ' +
            'updating in 2024. Put the contract step in the ticket with a date on it.' },

    { h: 'The backfill: same work, different lock' },
    { p: 'Step 3 is where the outage usually happens. Here is the obvious way and the correct way, measured on the same ' +
         '415,554 rows:' },
    { table: {
      head: ['', 'One `update` statement', 'Batches of 10,000'],
      rows: [
        ['Total time', '5,622 ms', '5,980 ms (6% slower)'],
        ['Log produced', '180 MB', '180 MB'],
        ['Table grew', '61 MB to 125 MB', '64 MB to 128 MB'],
        ['**Longest lock held**', '**5,622 ms**', '**280 ms**'],
        ['If it dies halfway', 'all of it rolls back', '49 batches are committed and done'],
        ['Can you pause it', 'no', 'yes, between any two batches']
      ]
    }},
    { p: 'Read the middle rows first, because they are the surprise: batching does not save time, does not save log, and ' +
         'does not save space. Every row still gets rewritten, which is why the table doubled in both cases. What ' +
         'batching changes is the **duration of the lock and the size of the blast radius**, and at two hundred million ' +
         'rows that is the difference between a backfill nobody notices and a transaction that runs for six hours, holds ' +
         'locks the entire time, blocks vacuum from cleaning anything, and then rolls back at hour five.' },
    { code: 'last_id = 0\nwhile True:\n    rows = execute("""\n        update payments set fee_minor = round(amount_minor * 0.029 + 30, 2)\n         where id > %s and id <= %s and fee_minor is null\n    """, (last_id, last_id + 10_000))\n    commit()                      # each batch is its own transaction\n    if last_id >= max_id: break\n    last_id += 10_000\n    sleep(0.05)                   # let replicas catch up', lang: 'python' },
    { p: 'Three details that matter more than they look:' },
    { ul: [
      '**Walk the primary key, do not use `offset`.** `offset 900000` makes the database count through 900,000 rows to skip them, so each batch is slower than the last and the job degrades into quadratic time, exactly like the missing index in level 6.',
      '**Keep `and fee_minor is null` in the predicate.** It makes the job idempotent: rerun it, restart it, run two copies by accident, and already-filled rows are skipped.',
      '**Sleep between batches.** A backfill with no pause produces log faster than replicas can replay it, and you find out by watching the lag climb while the dashboards go stale.'
    ]},
    { check: {
      q: 'Your backfill has to run for six hours. A colleague suggests wrapping the whole thing in one transaction so ' +
         'that "either it all works or nothing changes", which sounds like exactly the guarantee you want. Why is it the ' +
         'wrong call?',
      a: 'Because that guarantee costs six hours of held locks and one moment of total failure. The transaction pins the ' +
         'oldest snapshot for its entire life, so vacuum cannot clean up dead rows anywhere in the database and the table ' +
         'bloats far beyond the doubling the backfill already causes. Every row it has touched stays locked, so any ' +
         'application write to those rows waits. If anything kills it at hour five, an hour of rollback begins and you ' +
         'are back to nothing. And you cannot pause it when traffic spikes, because pausing means aborting. The batched ' +
         'version gives up atomicity across the whole job and replaces it with resumability, which is the property you ' +
         'actually need. The invariant here is "every row eventually gets its value", ' +
         'and the `is null` predicate is what enforces that.'
    }},

    { h: 'Verify like an accountant' },
    { p: 'Step 4 is where the backfill earns trust, and a sample will not do it. After the backfill, the rows where old and new ' +
         'disagree must be zero, and you should be able to run that query at any time:' },
    { code: 'select count(*) as disagreements\n  from payments\n where fee_minor is distinct from round(amount_minor * 0.029 + 30, 2);', lang: 'sql' },
    { p: '`is distinct from` rather than `<>`, because `null <> anything` is null, not true, so a plain comparison quietly ' +
         'skips exactly the rows the backfill missed. That is the same query shape as the level 10 break report and the ' +
         'level 12 stuck check: **a number that should be zero, that you can look at whenever you want.**' },

    { h: 'Change data capture' },
    { p: 'Level 11 published events with an outbox: your code decides what an event is and writes it deliberately. ' +
         '**Change data capture** is the other approach. A connector reads the database\'s own write ahead log and turns ' +
         'every insert, update and delete into a message, with no application code at all.' },
    { table: {
      head: ['', 'Outbox (level 11)', 'Change data capture'],
      rows: [
        ['What downstream sees', 'Business events you designed', 'Row changes, in your table\'s shape'],
        ['Application work', 'Write the event', 'None'],
        ['Catches writes from a manual `update`', 'No', 'Yes'],
        ['Coupling', 'Consumers depend on your event contract', 'Consumers depend on your table layout'],
        ['A schema change', 'Contained, if the event shape holds', 'Can break every consumer'],
        ['Best for', 'Other services reacting to your domain', 'Warehouses, search indexes, analytics, caches']
      ]
    }},
    { p: 'The rule of thumb: **outbox for things that react, change data capture for things that copy.** A ledger service ' +
         'that needs to know a payment was captured wants your event. A data warehouse that needs a current copy of the ' +
         'payments table wants the log.' },
    { p: 'Two properties of change data capture that catch people out. First, it starts with a **snapshot** of the whole ' +
         'table and then follows the stream, and on a large table that snapshot is a long read you have to plan for. ' +
         'Second, the log retention is not infinite: if a connector stops consuming, the database holds the log for it, ' +
         'and an abandoned replication slot will fill the disk of a perfectly healthy primary. **Monitor slot lag the way ' +
         'you monitor replica lag,** and delete the slot when you decommission the connector.' },

    { h: 'What the whole phase was for' },
    { p: 'Nine levels ago you had a money type. Now you have the parts of a payments core: a ledger that balances, an API ' +
         'that is idempotent, concurrency that holds under load, a card lifecycle, a reconciliation that finds real ' +
         'breaks, an event log that does not lose events, an orchestrator that survives a bank that will not answer, and ' +
         'a schema that can change while people are using it.' },
    { p: 'That is the system. What is left is making it fast, keeping it secure, knowing when it is broken, and shipping ' +
         'it, which is the next phase.' }
  ],

  tutorial: {
    intro: 'Do this on a table you generate yourself, big enough that the timings are real: five million payments is ' +
           'plenty on a laptop. Work in a repository called `payments-at-scale`. Write down every measurement as you go, ' +
           'because the README is half the value of this project.',
    steps: [
      {
        t: 'Make a table that is genuinely too big',
        blocks: [
          { p: 'Five million rows across two years, so that a month is a real slice and the plans are honest.' },
          { code: 'insert into payments (merchant_id, amount_minor, status, created_at)\nselect (random() * 5000)::int,\n       (random() * 50000)::bigint + 100,\n       (array[\'captured\',\'captured\',\'captured\',\'refunded\',\'failed\'])[(random()*4)::int + 1],\n       timestamptz \'2024-01-01\' + (random() * 729) * interval \'1 day\'\n  from generate_series(1, 5000000);', lang: 'sql' },
          { tip: 'Take the baseline measurements now, before you change anything: a monthly aggregate, a merchant lookup, ' +
                 'a delete of one month, and `pg_total_relation_size` before and after that delete. You are going to ' +
                 'quote these against the partitioned version.' }
        ],
        check: 'You have four baseline numbers written down, with the plans that produced them.'
      },
      {
        t: 'Partition it, and prove the pruning',
        blocks: [
          { p: 'Create the partitioned table beside the old one, with monthly partitions, and copy the data in. Then run ' +
               'the same monthly aggregate on both with `explain (analyze, buffers)`.' },
          { code: 'Pages touched     4,729  ->  396\nExecution time    19.7 ms -> 13.7 ms', lang: 'text' },
          { p: 'The plan must say it scanned one partition. If it scanned all of them, your filter is not on the ' +
               'partition key, or you wrapped it in a function that hides it from the planner.' }
        ],
        check: 'The plan names exactly one partition, and you can explain why the page count fell further than the time did.'
      },
      {
        t: 'Measure what it cost',
        blocks: [
          { p: 'Now the honest half. Run a lookup that does not mention time, on both tables, and compare planning time ' +
               'as well as execution time.' },
          { code: 'Index scans      1       -> 10\nPlanning time    0.188 ms -> 0.898 ms', lang: 'text' },
          { p: 'Then write the paragraph for your README that says which of your queries got better, which got worse, and ' +
               'why the trade is worth it for this table. That paragraph is the interview answer.' }
        ],
        check: 'You can state the cost of partitioning in numbers, not just the benefit.'
      },
      {
        t: 'Retention, the way it should be',
        blocks: [
          { p: 'Delete one month from the plain table. Drop the matching partition. Record time, log produced and the ' +
               'table size before and after each.' },
          { code: 'DELETE   47.2 ms   2,947 kB of log   disk returned: none\nDROP      0.9 ms   5,400 bytes       disk returned: all of it', lang: 'text' },
          { p: 'Then write the job that creates next month\'s partition, and the check that alerts if the next two months ' +
               'do not exist. A partitioned table with no future partitions fails every insert at midnight.' }
        ],
        check: 'Retention is one statement, and something will tell you before the partitions run out.'
      },
      {
        t: 'Break a migration on purpose',
        blocks: [
          { p: 'Run the five migrations from the knowledge section against your table and record what each costs. You are ' +
               'looking for the pair that differ by one word and by three orders of magnitude.' },
          { code: 'add column ... default \'standard\'            0.6 ms\nadd column ... default gen_random_uuid()  1,526 ms   70 MB of log', lang: 'text' },
          { p: 'Then reproduce the lock queue: open a long transaction that reads the table, start an `alter table` in a ' +
               'second session, and try a simple `select` in a third. The third one waits. Now add `set lock_timeout`, ' +
               'and watch the migration give up instead of taking the table hostage.' }
        ],
        check: 'You have seen an ordinary read blocked by a migration that had not started yet, and you have the setting that prevents it.'
      },
      {
        t: 'Expand, dual write, backfill',
        blocks: [
          { p: 'Add `fee_minor` as a nullable column, make the application write it on every new payment, then backfill ' +
               'the existing rows in batches, walking the primary key.' },
          { code: 'update payments set fee_minor = round(amount_minor * 0.029 + 30, 2)\n where id > %s and id <= %s and fee_minor is null;', lang: 'sql' },
          { p: 'Measure both versions, and compare the longest lock rather than the total time:' },
          { code: 'one statement     5,622 ms total, lock held 5,622 ms, not resumable\nbatches of 10k    5,980 ms total, lock held   280 ms, resumable', lang: 'text' }
        ],
        check: 'Killing the batched backfill halfway and restarting it finishes the job with no duplicated work and no wrong values.'
      },
      {
        t: 'Verify, switch, contract',
        blocks: [
          { p: 'Run the disagreement query and get zero. Then switch reads to the new column, leave the dual write in ' +
               'place for a few days, and only then remove the old path.' },
          { code: 'select count(*) from payments\n where fee_minor is distinct from round(amount_minor * 0.029 + 30, 2);', lang: 'sql' },
          { p: 'Put the contract step in your README with a date, because that is the step everybody forgets.' }
        ],
        check: 'Zero disagreements, and a written plan for removing the old column.'
      },
      {
        t: 'Prove nobody noticed',
        blocks: [
          { p: 'The acceptance test for this whole level. Run a writer that inserts payments continuously and a reader ' +
               'that queries them, both recording every error and every latency. Then run the entire migration under ' +
               'that load.' },
          { code: 'requests during migration : 42,000\nfailed                    : 0\np99 latency, steady state : 14 ms\np99 latency, during       : 21 ms', lang: 'text' },
          { p: 'Zero failures is the requirement. A latency bump is acceptable and worth reporting honestly. If you see ' +
               'failures, you have found the exact moment your migration takes a lock it should not, which is the most ' +
               'useful thing this project can teach you.' }
        ],
        check: 'A full schema migration completes with a load generator running and zero failed requests.'
      }
    ]
  },

  glossary: [
    { t: 'Partitioned table', d: 'One logical table made of many physical ones, split on a declared key.' },
    { t: 'Partition pruning', d: 'The planner skipping partitions that cannot contain matching rows.' },
    { t: 'Partition key', d: 'The column that decides which partition a row lives in. Must appear in every unique index.' },
    { t: 'ACCESS EXCLUSIVE', d: 'The strongest lock. Blocks every reader and every writer, including plain selects.' },
    { t: 'Lock queue', d: 'Postgres queues lock requests fairly, so one waiting migration blocks everything behind it.' },
    { t: 'lock_timeout', d: 'Give up waiting for a lock after this long. The single most valuable line in a migration.' },
    { t: 'Table rewrite', d: 'A migration that copies every row into a new file. The table is locked for the duration.' },
    { t: 'Volatile default', d: 'A default that produces a different value per row, which forces a rewrite.' },
    { t: 'Expand and contract', d: 'Add the new, write both, backfill, verify, switch reads, remove the old.' },
    { t: 'Backfill', d: 'Filling a new column for rows that already exist, ideally in resumable batches.' },
    { t: 'Write ahead log', d: 'The record of every change, used for crash recovery, replication and change data capture.' },
    { t: 'Read replica', d: 'A second database replaying the primary\'s log and serving read-only queries.' },
    { t: 'Replication lag', d: 'How far behind the replica is, in seconds or bytes. The source of stale reads.' },
    { t: 'Read your own writes', d: 'The guarantee that after you write something, you see it. Replicas break it.' },
    { t: 'Change data capture', d: 'Turning the database log into a stream of row changes for downstream systems.' },
    { t: 'Replication slot', d: 'The database holding log for a consumer. Abandoned slots fill the disk.' }
  ],

  quiz: [
    { q: "What is partition pruning?",
      options: [
        "Deleting old partitions on a schedule",
        "Compressing partitions that are rarely read",
        "The planner skipping partitions that cannot contain matching rows",
        "Rebalancing rows between partitions"
      ],
      answer: 2,
      why: "Measured here: 4,729 pages touched on the plain table against 396 on the partitioned one." },

    { q: "Removing one month of payments: DELETE took 47.2 ms and 2,947 kB of log, DROP partition took 0.9 ms and 5,400 bytes. What else differed?",
      options: [
        "The delete returned the disk space, the drop did not",
        "Both returned the space",
        "Neither returned any space",
        "The drop returned all the space immediately, the delete returned none"
      ],
      answer: 3,
      why: "A delete marks rows dead and leaves the table the same size. That is why delete-based retention bloats forever." },

    { q: "What does partitioning make worse?",
      options: [
        "Insert throughput, severely",
        "Queries that filter on the partition key",
        "Queries that do not mention the partition key, and planning time",
        "Retention and archiving"
      ],
      answer: 2,
      why: "Measured: one index scan became ten, and planning went from 0.188 ms to 0.898 ms, more than the execution time." },

    { q: "Why must the partition key appear in every unique index?",
      options: [
        "Because each partition has its own index, so uniqueness can only be enforced within a partition unless the key is included",
        "For performance",
        "Because Postgres requires primary keys to be composite",
        "It does not have to"
      ],
      answer: 0,
      why: "Which means a unique reference becomes unique on the pair, and level 9 idempotency needs rethinking." },

    { q: "Adding a column with `default 'standard'` took 0.6 ms. Adding one with `default gen_random_uuid()` took 1,526 ms and 70 MB of log. Why?",
      options: [
        "A constant default is stored once in the catalog, but a volatile default needs a different value per row, so the whole table is rewritten",
        "The uuid type is slower to write",
        "The second statement was not indexed",
        "gen_random_uuid() is a slow function"
      ],
      answer: 0,
      why: "One word in the migration, three orders of magnitude, and an ACCESS EXCLUSIVE lock for the whole rewrite." },

    { q: "A four minute reporting query is running. Your one second ALTER TABLE starts. What happens to ordinary queries on that table?",
      options: [
        "They are routed to the replica",
        "They queue behind the waiting ALTER, so the table is unusable for four minutes",
        "They run normally, because the ALTER is waiting",
        "They fail immediately"
      ],
      answer: 1,
      why: "Postgres lock queues are fair. The migration has not touched a row and the product is already down." },

    { q: "What does `set lock_timeout = '3s'` at the top of a migration do?",
      options: [
        "Limits how long the migration itself may run",
        "Makes the migration fail fast rather than waiting for a lock and building a queue behind it",
        "Forces the migration to use a weaker lock",
        "Retries the migration for three seconds"
      ],
      answer: 1,
      why: "Failing is fine. Queueing is not. Your deploy tool can retry a failure; it cannot undo an outage." },

    { q: "What decides whether data belongs in Postgres or in a wide column store such as DynamoDB?",
      options: [
        "The write throughput required",
        "Whether the team knows SQL",
        "The access pattern: constraints and unpredicted queries need relational, while one named access pattern at enormous scale with no cross row invariant does not",
        "The volume of data"
      ],
      answer: 2,
      why: "Pick the store from the query, not from the volume. A ledger is relational because the invariant must be enforced." },

    { q: "The one statement backfill took 5,622 ms; batches of 10,000 took 5,980 ms. Why prefer the slower one?",
      options: [
        "The longest lock held drops from 5,622 ms to 280 ms, and it can be paused or resumed",
        "It produces less write ahead log",
        "It avoids bloating the table",
        "It is more atomic"
      ],
      answer: 0,
      why: "Same log, same bloat, 6% slower. What changes is lock duration and blast radius." },

    { q: "Why walk the primary key instead of using `offset` in a backfill?",
      options: [
        "offset is not supported in updates",
        "Because offset requires an index",
        "Because offset makes the database count through and discard every skipped row, so each batch gets slower and the job degrades into quadratic time",
        "They are equivalent"
      ],
      answer: 2,
      why: "The same quadratic trap as the missing index in level 6, in a different disguise." },

    { q: "Why keep `and fee_minor is null` in the backfill predicate?",
      options: [
        "To make the job idempotent, so it can be restarted, rerun, or accidentally run twice",
        "To make the update faster",
        "To avoid locking rows",
        "Because the column is nullable"
      ],
      answer: 0,
      why: "Resumability is the property you traded whole-job atomicity for. The predicate is what delivers it." },

    { q: "Why `is distinct from` rather than `<>` in the verification query?",
      options: [
        "It is faster",
        "Because the column is numeric",
        "They behave identically",
        "Because `null <> anything` evaluates to null rather than true, so a plain comparison silently skips the rows the backfill missed"
      ],
      answer: 3,
      why: "And the rows it skips are exactly the ones you are looking for." },

    { q: "A merchant issues a refund, the page reloads, and the refund is missing. What happened?",
      options: [
        "The cache was stale",
        "The write went to the primary and the read went to a replica that had not caught up",
        "The transaction was rolled back",
        "The write failed silently"
      ],
      answer: 1,
      why: "Read your own writes goes to the primary. So does anything that decides money." },

    { q: "One backfill produced 180 MB of write ahead log. Why does that matter beyond disk?",
      options: [
        "It slows down the backfill",
        "It increases the table size",
        "It blocks vacuum",
        "Every byte ships to every replica and every change data capture consumer, so lag climbs while it replays"
      ],
      answer: 3,
      why: "Which is why the batched loop sleeps between batches: to produce log no faster than replicas can consume it." },

    { q: "When is change data capture the better choice over an outbox?",
      options: [
        "When other services need to react to business events",
        "When something needs a copy of your tables, such as a warehouse, a search index or an analytics store",
        "When you need exactly once delivery",
        "Always, because it needs no application code"
      ],
      answer: 1,
      why: "Outbox for things that react, change data capture for things that copy. The second couples consumers to your table layout." }
  ],

  project: {
    title: 'payments-at-scale: partition it, migrate it, and let nobody notice',
    story: 'You have five million payments in one table and a column that has to change. Partition the table, run a full ' +
           'expand and contract migration with a batched backfill, and do all of it with a load generator hammering the ' +
           'database, proving zero failed requests from start to finish.',
    scope: 'Postgres only. No new services. The deliverable is the measurements and the migration scripts, and the ' +
           'acceptance test is the load generator: if it records a single failure, the migration is wrong.',
    requirements: [
      'A generator that creates at least five million payments spread over two years',
      'Baseline measurements on the plain table: a monthly aggregate, a merchant lookup, a one month delete, and the table size before and after that delete',
      'The same table partitioned by month, with the copy done online rather than by dropping and recreating',
      'The pruning comparison, with `explain (analyze, buffers)` output for both',
      'The cost comparison: a query that does not mention the partition key, on both, including planning time',
      'A job that creates future partitions, and a check that alerts when fewer than two future months exist',
      'The five migration measurements, with the lock each one takes named',
      'A reproduction of the lock queue: a long reader, a blocked migration, and a third session that cannot run a plain select',
      '`lock_timeout` and `statement_timeout` set in every migration, with the values you chose and why',
      'A full expand and contract migration: add, dual write, backfill, verify, switch, and a dated plan for the contract step',
      'A batched backfill that walks the primary key, skips already filled rows, sleeps between batches, and is resumable after a kill',
      'A verification query using `is distinct from` that returns zero',
      'A load generator that writes and reads throughout the migration, recording every error and the latency distribution',
      'A README with every measurement, and a paragraph on which of your queries got worse and why the trade is worth it',
      'A one page note choosing a store for four workloads in your own platform: the ledger, the rate limiter, the token lookup and the analytics copy, with the reason for each',
      'The repository public on GitHub as `payments-at-scale`'
    ],
    starter: {
      lang: 'sql',
      code: '-- FinQuest level 13: the migration checklist.\n-- Every migration file in this project starts with these two lines.\nset lock_timeout = \'3s\';\nset statement_timeout = \'30s\';\n\n-- 1. EXPAND: instant at any table size. Nullable, no default.\nalter table payments add column fee_minor numeric(18, 2);\n\n-- 2. DUAL WRITE happens in the application, not here.\n\n-- 3. BACKFILL: one batch. The loop lives in Python and commits after each.\n--    Walk the primary key. Never use offset.\nupdate payments\n   set fee_minor = round(amount_minor * 0.029 + 30, 2)\n where id > :last_id\n   and id <= :last_id + 10000\n   and fee_minor is null;\n\n-- 4. VERIFY: this must return 0, and you must be able to run it any time.\nselect count(*) as disagreements\n  from payments\n where fee_minor is distinct from round(amount_minor * 0.029 + 30, 2);\n\n-- 5. SWITCH reads in the application. Keep writing both.\n\n-- 6. CONTRACT: not today. Put a date on it.\n-- alter table payments drop column old_fee;\n'
    },
    tests: [
      'The partitioned table returns identical results to the plain one for every baseline query',
      'A monthly aggregate touches one partition, and the plan proves it',
      'Dropping a month returns the disk immediately, and deleting a month does not',
      'Inserting a payment dated next month succeeds, because the partition already exists',
      'The future partition check fails when fewer than two future months exist',
      'A migration blocked on a lock gives up within lock_timeout instead of queueing',
      'The backfill can be killed at any point and restarted with no duplicated work',
      'Running the backfill twice changes nothing the second time',
      'The verification query returns zero after the backfill and after new writes',
      'A load generator running through the entire migration records zero failed requests',
      'The p99 latency during the migration is reported honestly, whatever it is'
    ],
    rubric: [
      { pts: 25, t: 'Partitioning, both sides', d: 'Pruning proved and the cost measured, including planning time, with a written trade-off.' },
      { pts: 20, t: 'Retention', d: 'Drop against delete measured, future partitions automated, and the alert that catches the gap.' },
      { pts: 20, t: 'Migrations understood', d: 'The five costs measured, the lock queue reproduced, and timeouts in every migration.' },
      { pts: 20, t: 'The backfill', d: 'Batched, key walking, idempotent, resumable after a kill, verified with a query that returns zero.' },
      { pts: 15, t: 'Nobody noticed', d: 'Load generator through the whole migration with zero failures and an honest latency report.' }
    ],
    stretch: [
      'Convert the plain table to partitioned online, with no downtime, using attach partition and a shadow copy',
      'Set up a real read replica, measure the lag while the backfill runs, and write the routing rule that avoids stale reads',
      'Run the backfill with and without the sleep, and plot replica lag against time for both',
      'Add change data capture with Debezium against your table, then run the migration and see which consumers break',
      'Move one genuinely key value workload out of Postgres into Redis or DynamoDB, measure both, and write down what you gave up',
      'Partition by hash of merchant instead, run the same query set, and write down which workload each key suits'
    ],
    solutionPath: 'solutions/level-13'
  },

  faq: [
    { q: 'How big does a table have to be before partitioning is worth it?',
      a: 'There is no row count that decides it. Ask instead whether you delete old data regularly, whether your queries filter by time, and whether vacuum and index maintenance are becoming a problem. If the answer to all three is no, partitioning will cost you planning time and give you nothing.' },
    { q: 'Can I partition an existing table without downtime?',
      a: 'Yes, and it is the stretch goal because it is genuinely hard. The usual shape is: create the partitioned table, dual write to both, backfill the old data in batches, verify, switch reads, then swap names in a single short transaction. Same six steps as any other expand and contract.' },
    { q: 'How many partitions is too many?',
      a: 'Planning cost grows with the number the planner has to consider, so a few hundred is usually fine and a few thousand usually is not. If monthly gives you too many, that is an argument for dropping old ones rather than for keeping them all.' },
    { q: 'Why did my backfill make the table twice as big?',
      a: 'Postgres does not update rows in place. It writes a new version and marks the old one dead, so updating every row doubles the table until vacuum reclaims the space for reuse. It is normal, it is why you do not backfill a column you could have computed on read, and it is why you should not run three backfills in a week.' },
    { q: 'Should I just use a managed service that handles all this?',
      a: 'Managed Postgres handles the machine, not the schema. Nobody will run your expand and contract for you, choose your partition key, or notice that your migration takes ACCESS EXCLUSIVE. These are the parts of the job the platform does not cover, which is exactly why interviews ask about them.' },
    { q: 'My migration passed in staging and locked production',
      a: 'Staging has no traffic, so nothing holds the lock your migration needs and nothing queues behind it. Reproduce the lock queue deliberately, the way step 5 asks you to. It is the single most valuable thing in this level.' },
    { q: 'What do I say about this project in an interview?',
      a: 'Lead with the cost, not the benefit: partitioning cut pages touched from 4,729 to 396 for monthly reports and made retention fifty times faster, and it also made key-less lookups scan ten indexes instead of one and quadrupled planning time. Then the migration: one word changed a 0.6 ms migration into a 1,526 ms table rewrite, and a load generator proved zero failed requests through the whole thing.' }
  ]
});
