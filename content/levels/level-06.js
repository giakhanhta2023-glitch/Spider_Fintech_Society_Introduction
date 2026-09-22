/* =========================================================================
   LEVEL 6: the ledger in Postgres
   ========================================================================= */
FQ.registerLevel({
  id: 6,
  codename: 'ledger-db',
  title: 'The ledger in Postgres, and the query plan that proves it',
  tagline: 'A ledger in a Python list is a demo. Put it in a real database, make the schema refuse money that does not balance, then measure one query before and after an index and watch it go from 31 milliseconds to 0.1.',
  difficulty: 6,
  minutes: 360,
  tags: ['Postgres', 'SQL', 'indexes', 'EXPLAIN', 'migrations'],
  summary: 'Every backend interview at a payments company goes through the database, and most candidates can write a SELECT ' +
           'and nothing else. This level takes the level 4 ledger into Postgres: the schema, the constraints that make bad ' +
           'money impossible, transactions, deferred checks, indexes read through EXPLAIN on 400,000 real rows, and ' +
           'migrations you can run twice. Every number in it was measured on a live database, including the insert that ' +
           'never finished.',

  objectives: [
    'Design a three table double entry schema with the right types',
    'Use constraints so that bad data is impossible rather than unlikely',
    'Wrap a multi row write in one transaction and watch the rollback work',
    'Enforce "entries sum to zero" in the database with a deferred trigger',
    'Read an EXPLAIN ANALYZE plan and say why Postgres chose it',
    'Add the right index, measure the difference, and know what it costs',
    'Find the unindexed foreign key that makes writes quietly quadratic',
    'Write migrations that can be applied to a running system'
  ],

  knowledge: [
    { h: 'Why the list had to go' },
    { p: 'Level 4 built a working ledger inside one Python program. It failed three tests that any real system has to pass, ' +
         'and those three are why databases exist:' },
    { table: {
      head: ['Problem with the list', 'What a database gives you'],
      rows: [
        ['Everything vanished when the program stopped', '**Durability**: once saved, it survives a crash or a power cut'],
        ['Only one program could use it at a time', '**Concurrency**: many programs read and write at once, safely'],
        ['Answering "what did Alice spend in March" meant a loop', '**Queries**: you say what you want, the database works out how']
      ]
    }},
    { p: 'This level uses **Postgres**, the database most payments companies run on. You talk to it in **SQL**, a language ' +
         'for describing data and asking for it back. Some vocabulary first, because the rest of the level leans on it:' },
    { table: {
      head: ['Word', 'Plain meaning'],
      rows: [
        ['**Table**', 'Like one sheet of a spreadsheet: named columns, one row per record'],
        ['**Column type**', 'What a column may hold: a whole number, text, a moment in time'],
        ['**Schema**', 'The design of all your tables together: columns, types and rules'],
        ['**Constraint**', 'A rule the database enforces on every row, whoever writes it'],
        ['**Index**', 'A separate sorted structure that makes finding certain rows fast'],
        ['**Query plan**', 'The strategy Postgres chose for answering your question. You can ask to see it']
      ]
    }},
    { warn: 'One word now means two things. A **money transaction** is an event like "Alice paid Bob". A **database ' +
            'transaction** is a group of changes saved together or not at all. In this schema one money transaction is ' +
            'written inside one database transaction, which is convenient and still worth keeping straight in your head.' },

    { h: 'The schema: three tables' },
    { p: 'An **account** is somewhere money sits. A **transaction** is one money event. An **entry** is one line of that ' +
         'event: an account and a signed amount. Alice paying Bob $25.00 is one row in `transactions` and two rows in ' +
         '`entries`: -2500 and +2500.' },
    { code: 'create table accounts (\n  id             bigserial primary key,\n  name           text        not null unique,\n  kind           text        not null check (kind in (\'customer\', \'revenue\', \'world\')),\n  allow_negative boolean     not null default false,\n  created_at     timestamptz not null default now()\n);\n\ncreate table transactions (\n  id              bigserial primary key,\n  memo            text        not null,\n  idempotency_key text        unique,\n  created_at      timestamptz not null default now()\n);\n\ncreate table entries (\n  id             bigserial primary key,\n  transaction_id bigint      not null references transactions(id),\n  account_id     bigint      not null references accounts(id),\n  amount_minor   bigint      not null check (amount_minor <> 0),\n  created_at     timestamptz not null default now()\n);', lang: 'sql', label: 'the whole ledger' },
    { table: {
      head: ['Piece of the schema', 'What it does'],
      rows: [
        ['`bigserial primary key`', 'Numbers every row automatically. The **primary key** is how you point at one row'],
        ['`bigint` for money', 'Whole minor units, exactly as level 5 stores them, with room for any real balance'],
        ['`not null`', 'This column can never be left empty'],
        ['`references transactions(id)`', 'A **foreign key**: an entry can only point at a transaction that exists'],
        ['`check (amount_minor <> 0)`', 'Refuses an entry of zero, which is always a bug'],
        ['`unique` on the idempotency key', 'The retry guard from level 4, now enforced by the database itself'],
        ['`timestamptz`', 'A moment in time that remembers its time zone. Always this, never plain `timestamp`']
      ]
    }},
    { warn: 'Notice there is no `balance` column on `accounts`. A balance is the sum of the entries. Store it as well and you ' +
            'have two answers to one question, which this level comes back to at the end, with the query that keeps them ' +
            'honest.' },

    { h: 'Constraints are the cheapest tests you will ever write' },
    { p: 'A constraint is a rule the database enforces itself, so it holds no matter which program writes the row: your API, ' +
         'a one-off script, a colleague typing SQL at midnight, or a service somebody writes next year. Here is what each one ' +
         'says when you break it, on a real database:' },
    { code: 'insert into entries (transaction_id, account_id, amount_minor) values (1, 1, 0);\nERROR:  new row for relation "entries" violates check constraint "entries_amount_minor_check"\n\ninsert into entries (transaction_id, account_id, amount_minor) values (1, 999999, 500);\nERROR:  insert or update on table "entries" violates foreign key constraint "entries_account_id_fkey"\n\ninsert into transactions (memo, idempotency_key) values (\'a retry\', \'key-1\');\nERROR:  duplicate key value violates unique constraint "transactions_idempotency_key_key"', lang: 'text', label: 'three rules, three refusals' },
    { p: 'The third one is worth sitting with. In level 4 you stopped a double charge by checking a dictionary before ' +
         'writing. Here the check and the write are one operation inside the database, so two retries arriving in the same ' +
         'millisecond cannot both get through. Your code catches the error and returns the original transaction.' },
    { check: {
      q: 'Your API already validates that an amount is not zero before inserting. Why write the `check` constraint as well?',
      a: 'Because your API is one door into the data and a database has many. A migration script, a colleague fixing ' +
         'something by hand, a second service written next year, and a bug fix that adds a new write path all skip your ' +
         'validation entirely. The constraint holds for all of them, including the ones that do not exist yet. The division ' +
         'of labour is: checks in your code give friendly messages and catch mistakes early, checks in the database are the ' +
         'ones that are actually guarantees.'
    }},

    { h: 'One transfer is one database transaction' },
    { p: 'Both entries must land together. In SQL you open a transaction with `begin`, make your changes, and save them all ' +
         'at once with `commit`. If anything goes wrong in between, `rollback` throws away everything since `begin`, as if ' +
         'none of it happened.' },
    { code: 'begin;\n  insert into transactions (memo, idempotency_key) values (\'coffee\', \'k-7741\') returning id;\n  insert into entries (transaction_id, account_id, amount_minor) values (7741, 1, -2500);\n  insert into entries (transaction_id, account_id, amount_minor) values (7741, 2,  2500);\ncommit;', lang: 'sql' },
    { p: 'That all or nothing guarantee is called **atomicity**, the A in ACID:' },
    { table: {
      head: ['Letter', 'The promise', 'For a transfer'],
      rows: [
        ['**A**tomicity', 'All of it happens or none of it does', 'Both entries are saved, or neither is'],
        ['**C**onsistency', 'Every rule still holds when it is saved', 'A transfer that does not balance cannot be saved'],
        ['**I**solation', 'Transactions running at once do not see each other half done', 'Two transfers cannot both spend the last $10'],
        ['**D**urability', 'Once saved, it stays saved', 'A power cut a second later does not undo it']
      ]
    }},
    { p: 'Isolation is the hardest of the four, and it gets a whole level of its own: level 8, where you will reproduce the ' +
         'failure it exists to prevent.' },

    { h: 'Making the balance rule impossible to break' },
    { p: 'The rule that matters is that **the entries of one transaction sum to zero**. A `check` constraint cannot express ' +
         'it, because a check only ever sees one row and this is a statement about a group of rows. A **trigger** can: a ' +
         'small function the database runs automatically when a row changes.' },
    { code: 'create or replace function entries_balance() returns trigger language plpgsql as $$\nbegin\n  if (select sum(amount_minor) from entries where transaction_id = new.transaction_id) <> 0 then\n    raise exception \'transaction % does not balance\', new.transaction_id;\n  end if;\n  return null;\nend $$;\n\ncreate constraint trigger entries_must_balance\n  after insert on entries\n  deferrable initially deferred        -- check at commit, not after each row\n  for each row execute function entries_balance();', lang: 'sql' },
    { p: 'The `deferrable initially deferred` line is what makes it work. Think about the moment after the first entry is ' +
         'inserted: -2500 is there and +2500 is not yet, so the transaction is unbalanced on purpose, briefly. Checked then, ' +
         'every transfer would fail. **Deferred** means "wait until commit, when every entry is in".' },
    { p: 'Here is the trigger doing its job on the database this level was written against, with a deliberately unbalanced ' +
         'transfer of -2500 against +2400:' },
    { code: 'ERROR:  transaction 200002 does not balance\n\n-- and afterwards:\nselect count(*) from transactions where idempotency_key = \'key-bad-1\';   -- 0\nselect count(*) from entries;                                            -- unchanged\nselect sum(amount_minor) from entries;                                   -- 0', lang: 'text' },
    { p: 'Nothing survived the failure: no transaction row, no entry, and the ledger as a whole still sums to exactly zero. ' +
         'That is atomicity and the trigger working together, and it is what an auditor actually asks about. Not "is your ' +
         'code careful", but "could this system record money going missing".' },
    { money: 'This is the difference between a candidate who says "we use double entry" and one who can show the trigger and ' +
             'the error message. Very few people have written a deferred constraint, and describing one places you above ' +
             'most of the pile immediately.' },

    { h: 'EXPLAIN: asking Postgres how it plans to answer' },
    { p: 'The database decides how to run your query, and you can ask what it decided. `EXPLAIN ANALYZE` runs the query and ' +
         'reports the plan with real timings. Everything below was measured on 400,002 entries across 2,000 accounts, about ' +
         '26 MB of data, on a small cloud database.' },
    { p: 'The most important query in a ledger is one account\'s balance:' },
    { code: 'explain (analyze, buffers)\nselect coalesce(sum(amount_minor), 0) from entries where account_id = 1337;', lang: 'sql' },
    { code: 'Finalize Aggregate (actual rows=1.00 loops=1)\n  Buffers: shared hit=3334\n  ->  Gather (actual rows=3.00 loops=1)\n        Workers Planned: 2\n        Workers Launched: 2\n        ->  Partial Aggregate (actual rows=1.00 loops=3)\n              ->  Parallel Seq Scan on entries (actual rows=66.67 loops=3)\n                    Filter: (account_id = 1337)\n                    Rows Removed by Filter: 133267\nExecution Time: 30.917 ms', lang: 'text', label: 'no index: 30.917 ms' },
    { p: 'Read it from the bottom up, because that is the order the work happens in:' },
    { ul: [
      '**Seq Scan** means Postgres read every row of the table. It had no faster option.',
      '**Rows Removed by Filter: 133267** is the waste: each of three workers looked at about 133,000 rows to find about 67 useful ones.',
      '**Buffers: shared hit=3334** is how many 8 kilobyte pages it touched, about 26 MB. Buffers are the honest measure of work, because they do not change with how busy the machine is.',
      '**Workers Launched: 2** means it split the scan across three processes. Postgres reaching for parallel workers on a small query is usually a sign that an index is missing.'
    ]},

    { h: 'The index, and what it is worth' },
    { p: 'An **index** is a second structure holding the values of one or more columns in sorted order, with pointers back ' +
         'to the rows. Postgres uses a **B-tree**: a shape that finds any value in a handful of steps rather than by reading ' +
         'everything, the way a book index sends you to page 214 without your reading the book.' },
    { code: 'create index entries_account_idx on entries (account_id);', lang: 'sql' },
    { code: 'Aggregate (actual rows=1.00 loops=1)\n  Buffers: shared hit=203 read=3\n  ->  Bitmap Heap Scan on entries (actual rows=200.00 loops=1)\n        Recheck Cond: (account_id = 1337)\n        Heap Blocks: exact=200\n        ->  Bitmap Index Scan on entries_account_idx (actual rows=200.00 loops=1)\n              Index Cond: (account_id = 1337)\nExecution Time: 0.375 ms', lang: 'text', label: 'with an index: 0.375 ms' },
    { p: 'The same answer, from 3,334 buffers to 206, and from 30.917 ms to 0.375 ms: about **82 times faster**. The plan now ' +
         'names the index, and "Rows Removed by Filter" is gone, because it no longer reads rows it does not want.' },
    { p: 'You can go further. That index finds the rows, and Postgres still visits the table to read the amount. An index ' +
         'that **includes** the amount carries everything the query needs:' },
    { code: 'create index entries_account_amount_idx on entries (account_id) include (amount_minor);', lang: 'sql' },
    { code: 'Aggregate (actual rows=1.00 loops=1)\n  Buffers: shared hit=2 read=4\n  ->  Index Only Scan using entries_account_amount_idx on entries (actual rows=200.00 loops=1)\n        Index Cond: (account_id = 1337)\n        Heap Fetches: 0\nExecution Time: 0.106 ms', lang: 'text', label: 'covering index: 0.106 ms' },
    { p: '**Index Only Scan** with **Heap Fetches: 0** means the table was never touched: six buffers instead of 3,334, and ' +
         '0.106 ms instead of 30.917, which is **291 times faster** than where you started.' },
    { p: 'Indexes are not free, and the cost side is the half an interviewer actually wants to hear:' },
    { table: {
      head: ['Object', 'Size on disk'],
      rows: [
        ['The `entries` table itself, 400,002 rows', '26 MB'],
        ['`entries_pkey`, the primary key index', '9,256 kB'],
        ['`entries_account_idx`', '2,872 kB'],
        ['`entries_account_amount_idx`, the covering one', '13 MB']
      ]
    }},
    { p: 'Every index has to be updated on every insert, so writes get slower as you add them, and each one takes disk and ' +
         'memory. The covering index here is half the size of the table. The rule: index what you filter and join on, ' +
         'measure before and after, and delete indexes that no query uses.' },
    { check: {
      q: 'A colleague adds six indexes to `entries` "to be safe", covering every column. Name two things that get worse, and ' +
         'say how you would decide which to keep.',
      a: 'Writes and storage. Every insert now maintains seven structures rather than one, so the write path, which in a ' +
         'payments system is the path that matters, slows down on every single payment. And the indexes can easily add up to ' +
         'more disk than the table, which also means less of the useful data fits in memory. Decide by measurement: Postgres ' +
         'records how often each index has been used in `pg_stat_user_indexes`, so keep the ones with real scans, drop the ' +
         'ones still at zero after a representative week, and check the plans of your top queries before and after.'
    }},

    { h: 'The unindexed foreign key that made writes quadratic' },
    { p: 'This section is a bug that happened while writing this level, on the same database, and it is the most useful part ' +
         'here because it is exactly how this goes wrong in a real system.' },
    { p: 'With the balance trigger in place, an insert of 20,000 entries was started. It never finished. Nothing in the ' +
         'schema looked wrong, and smaller inserts had been instant.' },
    { p: 'The cause was in the trigger, which runs this query once for every row inserted:' },
    { code: 'select sum(amount_minor) from entries where transaction_id = 200003;', lang: 'sql' },
    { p: 'And `transaction_id` had no index. Postgres **automatically indexes the primary key**, which is the `transactions` ' +
         'side, and does **not** index the referencing column, which is the `entries` side. So the trigger\'s query was a ' +
         'full scan of 400,000 rows, measured at:' },
    { code: 'Parallel Seq Scan on entries\n  Filter: (transaction_id = 200003)\n  Rows Removed by Filter: 133666\nExecution Time: 41.697 ms', lang: 'text', label: 'once per inserted row' },
    { p: 'Twenty thousand rows times 41.697 ms is about **fourteen minutes** of trigger work for one insert. The fix is one ' +
         'line, and the same query then costs:' },
    { code: 'create index entries_txn_idx on entries (transaction_id);\n\nIndex Scan using entries_txn_idx on entries (actual rows=4.00 loops=1)\n  Index Cond: (transaction_id = 200003)\nExecution Time: 0.112 ms', lang: 'text', label: 'after the index: 372 times faster' },
    { warn: 'Index the referencing side of every foreign key you look up or cascade through. Postgres does not do it for you, ' +
            'and the symptom is not an error. It is a system that gets slower as it fills up, which is the hardest kind of ' +
            'problem to notice and the easiest to prevent.' },
    { check: {
      q: 'Your write path is fine in testing with 5,000 rows and unusable in production with 5 million, and no query in your ' +
         'code changed. What kind of bug is that, and where do you look first?',
      a: 'A missing index behind something that runs per row: a trigger, a foreign key check, or a lookup inside a loop. ' +
         'Anything that scans the whole table costs time in proportion to the table, so at 5,000 rows it is invisible and at ' +
         '5 million it is fatal. Look first at what runs per row rather than per request, run EXPLAIN ANALYZE on the query it ' +
         'performs, and look for a Seq Scan with a large "Rows Removed by Filter". The habit that prevents it: test ' +
         'performance against a table the size you expect in a year, not the size your test fixture happens to be.'
    }},

    { h: 'The balance you show, and the balance that is true' },
    { p: 'Summing entries is correct, and gets slower as an account grows. At some size you keep a copy of the balance on ' +
         'the account row. From that moment there are two numbers that must agree, and something has to check:' },
    { code: 'alter table accounts add column balance_minor bigint not null default 0;\n\n-- keep it current inside the same transaction as the entry\ncreate or replace function apply_entry() returns trigger language plpgsql as $$\nbegin\n  update accounts set balance_minor = balance_minor + new.amount_minor\n   where id = new.account_id;\n  return new;\nend $$;\n\ncreate trigger entries_apply after insert on entries\n  for each row execute function apply_entry();', lang: 'sql' },
    { p: 'Because the trigger runs inside the same database transaction as the entry, the two are saved together or not at ' +
         'all. That removes most ways for them to drift, and not all, so a job runs every morning and should print nothing:' },
    { code: 'select a.id, a.name, a.balance_minor, coalesce(sum(e.amount_minor), 0) as from_entries\n  from accounts a\n  left join entries e on e.account_id = a.id\n group by a.id\nhaving a.balance_minor <> coalesce(sum(e.amount_minor), 0);', lang: 'sql', label: 'the query that should return no rows' },
    { p: 'Level 8 shows you how those two numbers drift apart under concurrent writers, which is the point where this stops ' +
         'being a tidiness exercise.' },

    { h: 'Migrations: changing a schema you cannot stop' },
    { p: 'This schema will change: a new column, a new index, a new table. In a running system you cannot simply edit it, ' +
         'because other people\'s code is using it right now. So every change is written as a **migration**: a small, ' +
         'numbered, forward-only file, applied once and never edited afterwards.' },
    { code: 'migrations/\n  0001_initial_schema.sql\n  0002_balance_trigger.sql\n  0003_index_entries_transaction_id.sql', lang: 'text' },
    { ol: [
      '**Never edit a migration that has run anywhere.** Somebody else\'s database already applied the old version and will never see your edit. Write another migration.',
      '**Make it safe to run twice**, with `create index if not exists` and `add column if not exists`. Deploys get retried.',
      '**Separate adding from removing.** Adding a column or an index is safe while old code runs. Dropping or renaming one breaks it, so that goes in a later release once nothing uses the old name. This is **expand and contract**.',
      '**Build indexes without blocking**: `create index concurrently` takes longer and does not lock out writers. On a busy payments table the plain form can stop every payment while it runs.',
      '**Set a lock timeout.** `set lock_timeout = \'3s\'` makes a blocked migration fail quickly instead of queueing every query in the system behind it.'
    ]},
    { check: {
      q: 'Your migration adds a `not null` column with a default to a table of forty million rows, and the deploy times out ' +
         'with the service unavailable. What happened, and what is the safe sequence?',
      a: 'The migration took a lock the whole table needed, and every query queued behind it until the connection pool ran ' +
         'out, so the outage was not the migration being slow, it was everything else waiting. Modern Postgres avoids ' +
         'rewriting the table for a constant default, which is why this surprises people who have only read older advice, ' +
         'but the safe habit still holds: add the column nullable, backfill in batches with a pause between them, then add ' +
         'the constraint. And set `lock_timeout`, so a blocked migration fails in seconds rather than taking the service ' +
         'with it.'
    }},

    { h: 'What this level gives you in an interview' },
    { p: 'Database questions are where most backend candidates thin out. These are the ones this level answers, and you now ' +
         'answer them with something you measured rather than something you read:' },
    { table: {
      head: ['The question', 'Your answer comes from'],
      rows: [
        ['"How would you design a ledger schema?"', 'Three tables, constraints, no balance column, and why'],
        ['"What does this EXPLAIN tell you?"', 'Seq Scan, rows removed by filter, buffers, and what you would add'],
        ['"When is an index a bad idea?"', 'Write cost and size, measured: 13 MB of index on a 26 MB table'],
        ['"Tell me about a performance bug you found"', 'The unindexed foreign key, 41.697 ms per row, an insert that never finished'],
        ['"How do you ship a schema change safely?"', 'Expand and contract, concurrently, lock timeout, never edit a migration']
      ]
    }}
  ],

  tutorial: {
    intro: 'You need a Postgres you can break. Two ways in, and everything after step 1 is identical: Docker on your own ' +
           'machine, which is what most jobs expect you to know, or a free hosted branch in the browser if Docker will not ' +
           'run where you are. Work in files, not a notebook, and keep every SQL file in the repository.',
    steps: [
      {
        t: 'Get a database and connect to it',
        blocks: [
          { code: '# Option A: Docker\ndocker run --name fq-pg -e POSTGRES_PASSWORD=dev -p 5432:5432 -d postgres:17\ndocker exec -it fq-pg psql -U postgres\n\n# Option B: a free hosted branch, no install\n#   create a project, copy the connection string, then:\npsql "postgresql://user:pass@host/dbname?sslmode=require"', lang: 'bash' },
          { p: '`psql` is the command line client. Three commands make it usable: `\\dt` lists tables, `\\d entries` describes ' +
               'one table, and `\\timing on` makes it print how long each statement took.' },
          { code: 'psql> \\timing on\nTiming is on.\npsql> select version();', lang: 'text' },
          { warn: 'The connection string contains a password. It goes in an environment variable, never in a file you commit. ' +
                  'Level 5\'s rule about keys applies to database URLs word for word.' }
        ],
        check: 'select version() prints a Postgres version, and \\timing is on.'
      },
      {
        t: 'Create the schema as a migration',
        blocks: [
          { p: 'Put the three `create table` statements from the knowledge section into `migrations/0001_initial_schema.sql`, ' +
               'and apply the file rather than typing SQL into the shell. From here on, every schema change is a new numbered ' +
               'file.' },
          { code: 'psql "$DATABASE_URL" -f migrations/0001_initial_schema.sql\npsql "$DATABASE_URL" -c "\\dt"', lang: 'bash' },
          { tip: 'Add a `schema_migrations` table with one row per file applied, and a ten line Python runner that applies any ' +
                 'file not yet recorded. That is all a migration tool is, and writing one once makes every framework version ' +
                 'of it obvious afterwards.' }
        ],
        check: '\\dt lists accounts, transactions and entries, and running the runner twice applies nothing the second time.'
      },
      {
        t: 'Seed 400,000 entries',
        blocks: [
          { p: 'You cannot learn anything about performance from twelve rows. Generate real volume with `generate_series`, ' +
               'which produces numbers inside SQL, so the database does the work without a round trip per row.' },
          { code: 'insert into accounts (name, kind)\nselect \'C\' || lpad(g::text, 6, \'0\'), \'customer\' from generate_series(1, 2000) g;\n\ninsert into transactions (memo, idempotency_key)\nselect \'transfer \' || g, \'key-\' || g from generate_series(1, 200000) g;\n\ninsert into entries (transaction_id, account_id, amount_minor)\nselect t.id,\n       case when s = 1 then 1 + (t.id * 7) % 2000 else 1 + (t.id * 13 + 5) % 2000 end,\n       case when s = 1 then -(100 + (t.id * 37) % 90000) else (100 + (t.id * 37) % 90000) end\nfrom transactions t cross join generate_series(1, 2) s;', lang: 'sql' },
          { code: 'select (select count(*) from entries) as entries,\n       (select sum(amount_minor) from entries) as ledger_sum,\n       pg_size_pretty(pg_total_relation_size(\'entries\')) as size;\n\n entries | ledger_sum |  size\n---------+------------+--------\n  400000 |          0 | 35 MB', lang: 'text' },
          { p: 'The ledger sums to exactly zero across 400,000 rows, which is the first useful thing this data tells you.' }
        ],
        check: 'You have 400,000 entries, the sum is 0, and the table is about 35 MB including its primary key.'
      },
      {
        t: 'Measure before you optimise',
        blocks: [
          { code: 'explain (analyze, buffers)\nselect coalesce(sum(amount_minor), 0) from entries where account_id = 1337;', lang: 'sql' },
          { p: 'Write down three numbers: execution time, buffer count, and "Rows Removed by Filter". Those are what you will ' +
               'compare against. Then look at the plan and say out loud why Postgres had no better option.' },
          { warn: 'Run it twice and use the second run. The first pulls data from disk into memory, so it measures your disk ' +
                  'rather than your query.' }
        ],
        check: 'You have a Seq Scan plan, a time in the tens of milliseconds, and a buffer count in the thousands.'
      },
      {
        t: 'Add the index and prove the difference',
        blocks: [
          { code: 'create index entries_account_idx on entries (account_id);\nanalyze entries;                  -- refresh the statistics the planner uses\n\n-- then run exactly the same explain again', lang: 'sql' },
          { p: 'Then build the covering version and compare all three in a small table in your README. On the database this ' +
               'level was written against:' },
          { code: 'no index          30.917 ms    3334 buffers    Parallel Seq Scan\nplain index        0.375 ms     206 buffers    Bitmap Index Scan\ncovering index     0.106 ms       6 buffers    Index Only Scan, Heap Fetches: 0', lang: 'text' },
          { p: 'Your numbers will differ and the shape will not. Report your own.' }
        ],
        check: 'Your three plans name Seq Scan, Bitmap Index Scan and Index Only Scan, and your times fall in the same order.'
      },
      {
        t: 'Make bad money impossible',
        blocks: [
          { p: 'Add the deferred constraint trigger from the knowledge section as migration `0002`, then try to break it.' },
          { code: 'do $$\ndeclare txn bigint;\nbegin\n  insert into transactions (memo, idempotency_key)\n    values (\'deliberately unbalanced\', \'key-bad-1\') returning id into txn;\n  insert into entries (transaction_id, account_id, amount_minor) values (txn, 1, -2500);\n  insert into entries (transaction_id, account_id, amount_minor) values (txn, 2,  2400);\nend $$;\n\nERROR:  transaction 200002 does not balance', lang: 'sql' },
          { p: 'Then check that nothing survived: the transaction row is gone, the entry count is unchanged, and the ledger ' +
               'still sums to zero. Do the same with a balanced pair and watch it succeed.' },
          { warn: 'Before moving on, index `transaction_id`. The trigger queries by it once per row, and without the index ' +
                  'that query costs about 40 ms on this table, which is the fourteen minute insert from the knowledge section.' }
        ],
        check: 'An unbalanced transfer is refused and leaves nothing behind, a balanced one succeeds, and entries_txn_idx exists.'
      },
      {
        t: 'The statement query',
        blocks: [
          { p: 'Support asks for a statement: every entry for an account, with a running balance. A **window function** ' +
               'computes a value across rows without collapsing them, which is exactly what a running total needs.' },
          { code: 'select e.id, e.created_at, e.amount_minor,\n       sum(e.amount_minor) over (order by e.id\n                                 rows between unbounded preceding and current row) as running_balance\n  from entries e\n where e.account_id = 1337\n order by e.id\n limit 20;', lang: 'sql' },
          { p: 'Run `EXPLAIN ANALYZE` on it too. You should see your index feeding a sort and a WindowAgg, and a time under a ' +
               'millisecond.' }
        ],
        check: 'The statement prints 20 rows whose running balance matches the sum of those same 20 entries.'
      },
      {
        t: 'Cache the balance, then check it',
        blocks: [
          { p: 'Add the `balance_minor` column and the `apply_entry` trigger as a migration, backfill it once from the ' +
               'entries, then write the reconciliation query that compares the two.' },
          { code: 'update accounts a\n   set balance_minor = coalesce((select sum(amount_minor) from entries e where e.account_id = a.id), 0);', lang: 'sql' },
          { p: 'Put the reconciliation query in `scripts/reconcile.sql` and make the script exit non-zero if it returns any ' +
               'rows, so it can run on a schedule. A check nobody looks at is not a check.' },
          { tip: 'Finish the README with the three plans, the index sizes, the trigger error message, and one sentence on ' +
                 'what you would do differently at a hundred million rows. That last sentence is what a reviewer reads twice.' }
        ],
        check: 'The reconciliation query returns no rows, and returns one immediately if you change a cached balance by hand.'
      }
    ]
  },

  glossary: [
    { t: 'Postgres', d: 'The open source relational database most payments companies run on.' },
    { t: 'SQL', d: 'The language for describing data and asking a database for it.' },
    { t: 'Schema', d: 'The design of your tables: columns, types, and the rules they must obey.' },
    { t: 'Primary key', d: 'The column that identifies one row uniquely. Postgres indexes it automatically.' },
    { t: 'Foreign key', d: 'A column that must match a row in another table. Postgres does not index this side for you.' },
    { t: 'Constraint', d: 'A rule the database enforces on every write, whoever makes it.' },
    { t: 'Database transaction', d: 'A group of changes saved together with commit, or thrown away with rollback.' },
    { t: 'ACID', d: 'Atomicity, consistency, isolation, durability: the four promises about transactions.' },
    { t: 'Trigger', d: 'A function the database runs automatically when a row changes.' },
    { t: 'Deferred constraint', d: 'A check that runs at commit rather than per row, so a transaction can be briefly invalid.' },
    { t: 'Index', d: 'A sorted structure over one or more columns that turns a scan into a lookup.' },
    { t: 'B-tree', d: 'The shape of a standard index: a few steps from the top to any value, however large the table.' },
    { t: 'EXPLAIN ANALYZE', d: 'Runs a query and reports the plan used, with real timings and row counts.' },
    { t: 'Seq Scan', d: 'Reading every row of a table. Fine on small tables, a warning sign with a selective filter.' },
    { t: 'Index Only Scan', d: 'Answering entirely from an index, never touching the table. Heap Fetches: 0.' },
    { t: 'Buffers', d: '8 kilobyte pages of data a query touched. The most honest measure of the work it did.' },
    { t: 'Window function', d: 'A calculation across rows that keeps the rows, such as a running balance.' },
    { t: 'Migration', d: 'A numbered, forward-only file describing one schema change, applied once and never edited.' },
    { t: 'Expand and contract', d: 'Add the new thing, move the traffic, remove the old thing in a later release.' },
    { t: 'lock_timeout', d: 'A setting that makes a blocked statement fail quickly instead of queueing the system behind it.' }
  ],

  quiz: [
    { q: "Why does the schema have no `balance` column on `accounts` at first?",
      options: [
        "Balances change too often to store",
        "It would break the foreign key",
        "Postgres cannot store a running total",
        "A balance is the sum of the entries, and a second copy is a second answer that can disagree"
      ],
      answer: 3,
      why: "You add the copy later, deliberately, together with the job that checks it still matches the entries." },

    { q: "What does `check (amount_minor <> 0)` buy you that validation in your API does not?",
      options: [
        "Better error messages for users",
        "Faster inserts",
        "It holds for every writer, including scripts and services that never touch your API",
        "It prevents duplicate entries"
      ],
      answer: 2,
      why: "Checks in code catch mistakes early; checks in the database are the ones that are actually guarantees." },

    { q: "Why must the balance trigger be `deferrable initially deferred`?",
      options: [
        "Because triggers cannot read other rows",
        "To avoid locking the accounts table",
        "Deferred triggers run faster",
        "Because after the first entry the transaction is deliberately unbalanced, so an immediate check would fail every transfer"
      ],
      answer: 3,
      why: "Deferred means the check happens at commit, when every entry of the transaction is present." },

    { q: "In a plan, \"Rows Removed by Filter: 133267\" tells you:",
      options: [
        "The query returned 133,267 rows",
        "133,267 rows were deleted",
        "The query read 133,267 rows it did not want, which usually means a missing index",
        "The filter ran after sorting"
      ],
      answer: 2,
      why: "It is the clearest single sign of wasted work in an EXPLAIN plan." },

    { q: "Buffers are a better measure of query cost than time because:",
      options: [
        "They are measured in milliseconds",
        "They count pages of data touched, which does not change with how busy the machine is",
        "They ignore indexes",
        "They include planning time"
      ],
      answer: 1,
      why: "Time varies with load and caching. Buffers are the work the query actually did." },

    { q: "The balance query went from 30.917 ms to 0.375 ms after one index. What changed in the plan?",
      options: [
        "It started using parallel workers",
        "A Seq Scan became a Bitmap Index Scan, and the filtered-out rows disappeared",
        "Postgres rewrote the SQL",
        "The table moved into memory"
      ],
      answer: 1,
      why: "It stopped reading rows it did not want: 3,334 buffers became 206 for the same answer." },

    { q: "What does `Heap Fetches: 0` on an Index Only Scan mean?",
      options: [
        "The table has no primary key",
        "The index is empty",
        "The query was answered entirely from the index, without touching the table",
        "No rows matched"
      ],
      answer: 2,
      why: "That is what an INCLUDE column buys: 6 buffers instead of 206 for the same sum." },

    { q: "Which is a real cost of adding an index?",
      options: [
        "Foreign keys stop being enforced",
        "Reads of other columns get slower",
        "Every insert must update it, and it takes disk and memory: the covering index here was 13 MB on a 26 MB table",
        "The table can no longer be altered"
      ],
      answer: 2,
      why: "In a payments system the write path is the one that matters, so unused indexes are a real tax." },

    { q: "Postgres automatically creates an index for:",
      options: [
        "Nothing at all",
        "Primary keys and unique constraints only",
        "Every column used in a WHERE clause",
        "Every foreign key column"
      ],
      answer: 1,
      why: "The referencing side of a foreign key is left to you, which is where the fourteen minute insert came from." },

    { q: "A trigger runs an unindexed query costing 41.697 ms once per inserted row. Inserting 20,000 rows means:",
      options: [
        "About 14 minutes of trigger work",
        "The same as without the trigger",
        "About 42 milliseconds in total",
        "A cost that depends only on disk speed"
      ],
      answer: 0,
      why: "Per-row work multiplies by the number of rows. This is how a system gets slower as it fills, with no error anywhere." },

    { q: "Your write path is fine at 5,000 rows and unusable at 5 million, with no code change. Look first at:",
      options: [
        "Anything that runs per row: a trigger, a foreign key check, or a lookup inside a loop",
        "Network latency",
        "The connection pool size",
        "The Postgres version"
      ],
      answer: 0,
      why: "Work proportional to table size is invisible in a test fixture and fatal in production." },

    { q: "Why is a migration never edited once it has been applied?",
      options: [
        "The file becomes read-only",
        "Editing breaks a checksum Postgres stores",
        "Migrations are compiled",
        "Other databases already applied the old version and will never see your edit"
      ],
      answer: 3,
      why: "Forward-only, numbered files. If something is wrong, the fix is another migration." },

    { q: "`create index concurrently` exists because:",
      options: [
        "The plain form locks out writers, which on a payments table stops every payment while it runs",
        "It builds the index faster",
        "It builds several indexes at once",
        "It is required for unique indexes"
      ],
      answer: 0,
      why: "It takes longer and lets traffic continue, which is the trade you want on a live system." },

    { q: "Setting `lock_timeout` on a migration means:",
      options: [
        "The migration runs faster",
        "A blocked migration fails in seconds instead of queueing the whole system behind it",
        "The migration cannot be rolled back",
        "Other queries wait longer"
      ],
      answer: 1,
      why: "The outage is rarely the migration itself. It is everything else waiting on the lock it took." },

    { q: "After adding a cached `balance_minor` column, what keeps it honest?",
      options: [
        "A daily query comparing it against the sum of entries, which should return no rows",
        "The primary key index",
        "The foreign key",
        "Nothing: the trigger makes drift impossible"
      ],
      answer: 0,
      why: "The trigger removes most ways to drift, not all. A check nobody looks at is not a check." }
  ],

  project: {
    title: 'ledger-db: the ledger, in a database that refuses bad money',
    story: 'Take the level 4 ledger into Postgres properly: migrations, constraints, a deferred balance check, 400,000 rows ' +
           'of realistic data, measured query plans, and a reconciliation job. The README is half the work, because the ' +
           'numbers you measured are the part an interviewer will ask about.',
    scope: 'Uses levels 4 and 5 plus this level. Postgres 16 or newer, in Docker or on a free hosted branch. Python with ' +
           'psycopg for the runner and the benchmark. No web framework yet: that is level 7.',
    dataset: '{{RAW}}/data/level-03-transactions.csv',
    requirements: [
      'A `migrations/` folder of numbered, forward-only SQL files, and a runner that applies only what has not been applied',
      'The three table schema with primary keys, foreign keys, not null, the amount check and the unique idempotency key',
      'Money stored as `bigint` minor units, times as `timestamptz`',
      'A seed script that creates 2,000 accounts and at least 400,000 balanced entries, deterministically',
      'A deferred constraint trigger that refuses a transaction whose entries do not sum to zero, with a test proving nothing is written when it fires',
      'An index on the referencing side of every foreign key you query through, including `entries.transaction_id`',
      'A benchmark script printing execution time, buffers and plan type for the balance query with no index, a plain index and a covering index',
      'Those three plans pasted into the README with your own numbers',
      'A statement query with a running balance, using a window function',
      'A cached `balance_minor` column kept current by a trigger inside the same transaction',
      'A reconciliation script comparing the cached balance against the entries, exiting non-zero if any account disagrees',
      'A `transfer()` in Python that writes a transaction and its entries inside one database transaction, and returns the existing transaction when the idempotency key is reused',
      'Tests: an unbalanced transfer is refused, a duplicate key returns the original, and a transfer that raises halfway leaves no rows',
      'A README with the schema, the measured plans, the index sizes, and a paragraph on what you would change at a hundred million rows',
      'The repository public on GitHub as `ledger-db`'
    ],
    starter: {
      lang: 'python',
      code: '"""FinQuest level 6: the ledger in Postgres.\n\nLayout:\n  migrations/0001_initial_schema.sql   tables and constraints\n  migrations/0002_balance_trigger.sql  the deferred check\n  migrations/0003_indexes.sql          account_id, transaction_id, covering\n  migrations/0004_cached_balance.sql   balance_minor and its trigger\n  ledgerdb/migrate.py                  apply files not yet recorded\n  ledgerdb/seed.py                     2,000 accounts, 400,000 entries\n  ledgerdb/transfer.py                 one transfer, one database transaction\n  ledgerdb/bench.py                    EXPLAIN ANALYZE, three ways\n  scripts/reconcile.sql                the query that should return nothing\n"""\n\nimport os\nimport psycopg\n\nDATABASE_URL = os.environ["DATABASE_URL"]      # never hardcode this\n\n\ndef transfer(conn, src: str, dst: str, amount_minor: int, memo: str, key: str) -> int:\n    """Write one balanced transfer and return the transaction id.\n\n    Must: run inside one database transaction, return the original id when the\n    idempotency key has been seen before, and never leave a single entry behind.\n    """\n    # TODO\n    raise NotImplementedError\n\n\ndef balance(conn, account_name: str) -> int:\n    """Sum of entries for one account, in minor units."""\n    # TODO\n    raise NotImplementedError\n\n\ndef explain(conn, sql: str, params: tuple = ()) -> str:\n    """Return the EXPLAIN (ANALYZE, BUFFERS) output as text."""\n    # TODO\n    raise NotImplementedError\n'
    },
    tests: [
      'Running the migration runner twice applies every file once and reports the second run as a no-op',
      'Inserting an entry with amount 0 raises a check constraint error',
      'Inserting an entry for an account id that does not exist raises a foreign key error',
      'Reusing an idempotency key raises a unique violation, and transfer() returns the original transaction id',
      'A transfer whose entries do not sum to zero is refused, and afterwards its transaction row does not exist',
      'After seeding, the sum of every entry in the ledger is exactly 0',
      'The balance query plan contains "Seq Scan" before the index and "Index Scan" or "Index Only Scan" after it',
      'The benchmark reports fewer buffers with the covering index than with the plain index',
      'A statement for one account ends at the same number the balance query returns',
      'The reconciliation script exits 0 normally and non-zero after you change a cached balance by hand',
      'A transfer that raises halfway through leaves no transaction row and no entries'
    ],
    rubric: [
      { pts: 25, t: 'A schema that refuses bad data', d: 'Constraints, foreign keys, the deferred balance trigger, and a test proving each one fires.' },
      { pts: 25, t: 'Measured, not assumed', d: 'Three plans with your own times and buffer counts, index sizes reported, and the reasoning written down.' },
      { pts: 20, t: 'Correct writes', d: 'One transfer is one database transaction, idempotency enforced by a unique index, rollback proven by a test.' },
      { pts: 15, t: 'Operable', d: 'Numbered migrations, a runner safe to run twice, a reconciliation job with an exit code.' },
      { pts: 15, t: 'Explained', d: 'A README a reviewer can read in five minutes, ending with what you would change at a hundred million rows.' }
    ],
    stretch: [
      'Partition `entries` by month and compare the same balance query with and without partitioning',
      'Enable `pg_stat_statements` and find your three most expensive queries by total time',
      'Write the migration that renames `amount_minor` to `amount_cents` as an expand and contract sequence, with old code still running',
      'Measure the write cost of each index: time 10,000 inserts with one, two and three indexes on the table',
      'Replace the trigger with a check done in the application, and write down honestly what you lost'
    ],
    solutionPath: 'solutions/level-06'
  },

  faq: [
    { q: 'Docker or a hosted database?',
      a: 'Docker if it runs where you are: knowing the command matters in interviews and you can break things freely. A free hosted branch is fine otherwise, because the SQL is identical and only the connection string changes.' },
    { q: 'My numbers are nothing like the ones in the level',
      a: 'They should not be. Yours depend on your machine, your memory and your disk. What has to match is the shape: a scan in the tens of milliseconds, an index scan under a millisecond, and a covering index touching a handful of buffers.' },
    { q: 'EXPLAIN says Seq Scan even with my index',
      a: 'Three usual causes. The table is small enough that scanning really is cheaper. Your statistics are stale, so run `analyze`. Or the query cannot use the index, for example because the column is wrapped in a function such as `where lower(name) = ...` with no matching expression index.' },
    { q: 'Should the balance rule be a trigger at all?',
      a: 'Reasonable engineers disagree. In the database it cannot be bypassed and costs one indexed query per row. In the application it is easier to test and easy to skip by accident. Most payments companies keep the database check and do the friendly validation in code as well.' },
    { q: 'Why bigint and not numeric?',
      a: '`numeric` is exact too and much slower, and money in minor units is a whole number by construction. Keep amounts as `bigint`, and use `numeric` for rates and percentages if you store them.' },
    { q: 'How do I test SQL?',
      a: 'Point the tests at a throwaway database, apply the migrations in a fixture, and run each test inside a transaction that is rolled back at the end. Testcontainers does this properly, and level 18 uses it from Java.' },
    { q: 'What do I say about this project in an interview?',
      a: 'Lead with the measurement rather than the schema: the balance query at 31 milliseconds, the index taking it to 0.375, the covering index to 0.106, and the unindexed foreign key that turned one insert into fourteen minutes of trigger work. That is a performance story with numbers, which is rare from a new graduate.' }
  ]
});
