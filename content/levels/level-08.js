/* =========================================================================
   LEVEL 8: concurrency, and the bug that only happens under load
   ========================================================================= */
FQ.registerLevel({
  id: 8,
  codename: 'race',
  title: 'Eight requests, one balance, minus $540',
  tagline: 'Your API is correct when you test it by hand and wrong when eight people press pay at once. This level reproduces that on a real database, then fixes it three ways and measures each one.',
  difficulty: 8,
  minutes: 420,
  tags: ['concurrency', 'locking', 'isolation', 'connection pools'],
  summary: 'The single most asked question in a payments backend interview is what happens when two requests touch one ' +
           'account at the same moment. This level answers it with a test rig you write: eight workers, one account holding ' +
           '$100, each spending $80. The naive version ends at minus $540. Then you fix it with a row lock, with ' +
           'serializable isolation, and with a constraint, and measure the cost of each. Every number here came out of a ' +
           'real run.',

  objectives: [
    'Reproduce a lost update deliberately, with a test rig that fails every time',
    'Explain isolation levels and what read committed does not promise',
    'Fix a race with a row lock and say what it costs',
    'Fix the same race with serializable isolation and a retry loop',
    'Push the rule into the database so no application can get it wrong',
    'Find the setting a connection pooler silently threw away',
    'Size a connection pool, and recognise a pool that has become the bottleneck',
    'Write tests for concurrency that fail reliably rather than sometimes'
  ],

  knowledge: [
    { h: 'The bug, first' },
    { p: 'Here is the experiment. One account holds **$100.00**. Eight workers each try to spend **$80.00**, all at the same ' +
         'instant. Each one does exactly what your level 7 API does: read the balance, check it is enough, write the two ' +
         'entries.' },
    { code: 'select coalesce(sum(amount_minor), 0) from entries where account_id = 7;   -- 10000\n-- 8000 <= 10000, fine\ninsert into transactions ...\ninsert into entries ... -8000 ...\ncommit;', lang: 'sql', label: 'what each worker runs' },
    { p: 'Run against a real Postgres, with all eight connections opened in advance so they truly start together:' },
    { code: '--- naive ---\n  succeeded 8 of 8   final balance -54000   367 ms\n     8 x spent (saw 10000, attempts 1)', lang: 'text', label: 'measured' },
    { p: 'Every worker read $100.00. Every worker decided $80.00 was affordable. Every worker was right at the moment it ' +
         'looked. The account ends at **minus $540.00**, and not one line of that code is wrong when you read it.' },
    { p: 'This is a **race condition**: the outcome depends on the timing of things happening at once. This particular one ' +
         'is a **lost update**, and the gap it lives in has a name worth remembering. Between your read and your write, the ' +
         'world changed, and nothing forced you to notice.' },
    { money: 'Every payments interview asks some version of this. Most candidates describe the problem. Very few have ' +
             'reproduced it, and almost none can tell you what each fix costs, which is the part the job actually needs.' },

    { h: 'What read committed actually promises' },
    { p: 'Postgres did not fail here. It did exactly what its default **isolation level**, `read committed`, promises. ' +
         'Isolation level is the setting for how much transactions running at the same time are allowed to affect each ' +
         'other, and the promises get stronger as you go down this table:' },
    { table: {
      head: ['Level', 'What it promises', 'What it still allows'],
      rows: [
        ['`read uncommitted`', 'In Postgres, the same as read committed', 'Everything below'],
        ['**`read committed`** (default)', 'Each statement sees a consistent snapshot of committed data', 'The world changing between two of your statements'],
        ['`repeatable read`', 'Every statement in the transaction sees the same snapshot', 'Two transactions writing different rows on a shared rule'],
        ['`serializable`', 'The result is as if transactions ran one after another', 'Nothing, and some transactions are aborted to keep that promise']
      ]
    }},
    { p: 'Read that second row again, because it is the whole bug. `read committed` gives each **statement** a consistent ' +
         'view. It says nothing about a decision you made in Python between two statements. Your `if balance >= amount` was ' +
         'true when you asked, and stale by the time you wrote.' },
    { check: {
      q: 'A colleague says the fix is to put the read and the write inside one database transaction. The eight workers ' +
         'already did exactly that. Why did it not help?',
      a: 'Because a transaction is about atomicity and visibility, not about exclusivity. Wrapping the pair in `begin` and ' +
         '`commit` guarantees that both entries land together and that nobody sees half of it. It does not stop seven other ' +
         'transactions reading the same balance at the same moment and reaching the same conclusion. To stop that, something ' +
         'has to either make the others wait, or detect the conflict and refuse one. Those are the next two sections.'
    }},

    { h: 'Fix one: make them queue, with a row lock' },
    { p: '`select ... for update` locks the rows it returns until your transaction ends. Any other transaction asking for ' +
         'the same rows waits. It is called **pessimistic** locking: assume a conflict and prevent it.' },
    { code: 'begin;\nselect id from accounts where id = %s for update;      -- other workers stop here and wait\nselect coalesce(sum(amount_minor), 0) from entries where account_id = %s;\n-- now the balance cannot change under you\ninsert into entries ...\ncommit;                                                -- the lock is released here', lang: 'sql' },
    { p: 'The same eight workers, with that one extra line:' },
    { code: '--- for_update ---\n  succeeded 1 of 8   final balance 2000   691 ms\n     1 x spent (saw 10000, attempts 1)\n     7 x refused (saw 2000)', lang: 'text', label: 'measured' },
    { p: 'One worker spent, the other seven arrived after the lock was released, saw the real balance of $20.00, and refused ' +
         'themselves. The account ends correct. Notice the cost in the last number: **691 ms** against 367 ms for the broken ' +
         'version, because spending from this account now happens one at a time.' },
    { table: {
      head: ['What a row lock gives you', 'What it costs'],
      rows: [
        ['Correct without retries: the caller never sees a conflict error', 'Requests against one account are serialised'],
        ['Simple to reason about', 'A busy account, such as a platform fee account, becomes a queue'],
        ['Works at any isolation level', 'Hold it too long and everything behind it waits'],
        ['', 'Two transactions locking rows in different orders can deadlock']
      ]
    }},
    { p: 'That last row is worth a rule. If a transfer locks both accounts, **always lock them in the same order**, for ' +
         'example by account id, lowest first. If one transaction locks A then B while another locks B then A, each ends up ' +
         'holding what the other needs. Postgres notices the cycle after a moment and kills one of them with SQLSTATE ' +
         '`40P01`, "deadlock detected", so it does not hang forever, but one caller got an error that lock ordering would ' +
         'have avoided.' },
    { warn: 'Lock the smallest thing for the shortest time. Never hold a database lock while calling another service: your ' +
            'lock is now held for as long as somebody else\'s network takes, and their bad day becomes your outage.' },

    { h: 'Fix two: let them run, and refuse the loser' },
    { p: 'The other approach is **optimistic**: assume conflicts are rare, let everybody run, and have the database detect ' +
         'the clash at the end. That is what `serializable` does. Postgres tracks what each transaction read and wrote, and ' +
         'if the result could not have happened in any order, it aborts one with a serialization failure.' },
    { code: 'conn.isolation_level = psycopg.IsolationLevel.SERIALIZABLE\n\nwhile True:\n    try:\n        do_the_transfer(conn)          # read, check, write, commit\n        break\n    except errors.SerializationFailure:\n        conn.rollback()                # somebody else won: try again\n        time.sleep(backoff())', lang: 'python' },
    { code: '--- serializable ---\n  succeeded 1 of 8   final balance 2000   368 ms\n     1 x spent (saw 10000, attempts 1)\n     7 x refused (saw 2000)', lang: 'text', label: 'measured' },
    { p: 'Correct again, and faster than the lock here: 368 ms against 691 ms, because nobody waited in a queue. The price ' +
         'is moved rather than removed. Every caller now has to be written to retry, and a retry is only safe if the ' +
         'operation is idempotent, which is exactly why level 7 put an idempotency key on every write.' },
    { table: {
      head: ['', 'Row lock', 'Serializable'],
      rows: [
        ['Conflicts are', 'Prevented by waiting', 'Detected and one is aborted'],
        ['The caller must', 'Nothing special', 'Retry on serialization failure'],
        ['Best when', 'Conflicts are common: a hot account', 'Conflicts are rare'],
        ['Worst when', 'One account is busy: everything queues', 'Conflicts are common: retry storms'],
        ['Measured here', '691 ms, 1 of 8 succeeded', '368 ms, 1 of 8 succeeded']
      ]
    }},
    { check: {
      q: 'You switch to serializable isolation and your error rate jumps, with callers seeing failures they never saw ' +
         'before. Is the database broken?',
      a: 'No: it is telling you about conflicts that were previously silent and wrong. Under read committed those same ' +
         'transactions committed and produced a state that could not have happened if they had run one at a time, which is ' +
         'the overdraft you just fixed. What is missing is the other half of the pattern: serializable is only usable with a ' +
         'retry loop, and the retry has to be safe to repeat, which means an idempotency key. If you cannot add retries to ' +
         'the callers, use a row lock instead, where the waiting happens inside your service and nobody outside sees it.'
    }},

    { h: 'Fix three: make the database refuse it' },
    { p: 'Both fixes above still rely on your application checking the balance. The third approach puts the rule where no ' +
         'application can get it wrong. Keep a balance column, as in level 6, and add a constraint:' },
    { code: 'alter table accounts add constraint balance_never_negative\n  check (balance_minor >= 0 or allow_negative);', lang: 'sql' },
    { p: 'Now the eight workers can race as much as they like. The updates to one row are serialised by Postgres anyway, ' +
         'because two transactions cannot update the same row at the same time, and the ninth dollar that would take the ' +
         'balance below zero fails the check. You still catch the error and return `422 insufficient_funds`, but the ' +
         'guarantee no longer depends on anybody remembering to check.' },
    { p: 'The trade is that you now maintain a balance column, which means the reconciliation job from level 6 stops being ' +
         'optional. Most real ledgers do exactly this: a stored balance, a constraint on it, and a job that proves it still ' +
         'equals the sum of the entries.' },

    { h: 'The setting that was silently thrown away' },
    { p: 'While measuring the serializable fix, it did not work. Eight workers, serializable isolation set, and the balance ' +
         'still ended at minus $540. The reason is worth more than the fix.' },
    { p: 'The code set the isolation level on the session, which is the obvious way to do it:' },
    { code: "conn.execute(\"set transaction_isolation to 'serializable'\")\nconn.commit()\n\n# then, in the very next transaction:\nshow transaction_isolation;   -->   read committed", lang: 'text', label: 'measured: the setting did not survive' },
    { p: 'The connection went through a **connection pooler**, a service that sits between your application and the ' +
         'database and shares a small number of real database connections among many clients. In its usual mode, a pooler ' +
         'hands you a real connection **for one transaction at a time** and gives it to somebody else afterwards. Anything ' +
         'you set on "your" session is therefore either lost or, worse, inherited by a stranger, so poolers discard it.' },
    { p: 'The fix is to ask for the isolation level **per transaction**, which sends it as part of `begin`:' },
    { code: 'conn.isolation_level = psycopg.IsolationLevel.SERIALIZABLE\n\nshow transaction_isolation;   -->   serializable', lang: 'text', label: 'measured: this one sticks' },
    { warn: 'Session level things that quietly stop working behind a transaction-mode pooler: `SET` of any kind, session ' +
            'advisory locks, `LISTEN` and `NOTIFY`, temporary tables, and server side prepared statements. None of them ' +
            'raise an error. They simply do not do what you think, which is why this is a favourite interview question and ' +
            'a common production incident.' },
    { check: {
      q: 'Your application sets `statement_timeout` once when it starts a connection, and you notice queries occasionally ' +
         'running for minutes anyway. You are behind a pooler. What is happening, and what do you do?',
      a: 'The setting was applied to whichever real connection the pooler happened to give you for that one transaction, and ' +
         'discarded afterwards, so most of your queries run with the server default. Nothing errors, which is why it took a ' +
         'production incident to notice. The fix is to stop treating it as session state: set the timeout per transaction, ' +
         'or configure it on the database role with `alter role ... set statement_timeout`, which the pooler cannot throw ' +
         'away because it is not session state at all. The general rule behind a pooler: if it feels like something you set ' +
         'once and forget, check whether it survives.'
    }},

    { h: 'The pool is a queue' },
    { p: 'Level 7 measured what opening a connection per request costs: 202.7 ms median against 62.3 ms on a connection ' +
         'already open. A **connection pool** keeps a set of connections open and lends them out. Here is the same work, 24 ' +
         'requests across 8 workers, measured three ways:' },
    { table: {
      head: ['Setup', 'p50', 'p95', 'Throughput'],
      rows: [
        ['No pool, connect every request', '228.8 ms', '296.0 ms', '31.4 requests/s'],
        ['**Pool of 8, 8 workers**', '**59.8 ms**', '**61.8 ms**', '**127.1 requests/s**'],
        ['Pool of 2, 8 workers', '251.1 ms', '272.7 ms', '30.8 requests/s']
      ]
    }},
    { p: 'Four times the throughput from the middle row, for no change to the query. And then read the third row, which is ' +
         'the one worth remembering: **a pool that is too small is as slow as no pool at all.** Six of the eight workers ' +
         'spend their time waiting for a connection rather than for the database, and the waiting does not show up in your ' +
         'query timings at all.' },
    { p: 'How big should it be? Not as big as possible. Every connection is memory and a process on the database, and past ' +
         'a point more connections make the database slower, not faster. Start from what you are waiting for:' },
    { ol: [
      '**Measure how long one request holds a connection**, including the query and anything you do while holding it.',
      '**Decide the throughput you need**, in requests per second.',
      '**Multiply.** Ten requests per second, each holding a connection for 60 ms, needs about 0.6 connections busy on ' +
      'average, so a pool of 5 is generous and a pool of 50 is waste.',
      '**Leave headroom for the slow days**, then cap it well below what the database can accept in total, because every ' +
      'instance of your service has its own pool and they all add up.'
    ]},
    { p: 'And set a timeout on getting a connection. Without one, a pool that has run dry turns into an unbounded queue of ' +
         'requests waiting for a connection, and your service stops answering anybody. With one, the requests that cannot be ' +
         'served fail fast with `503`, which is worse for them and much better for everybody else.' },
    { check: {
      q: 'Your API\'s p99 latency is fine at 50 requests a second and collapses to seconds at 200, while the database\'s own ' +
         'slow query log shows nothing above 3 ms. Where is the time going?',
      a: 'Into the queue in front of the pool. Each request is waiting for a connection rather than for the database, so the ' +
         'database sees nothing wrong: from its point of view every query it receives is fast. That is exactly the third row ' +
         'of the table above, where a pool of 2 was no better than no pool. You find it by measuring the wait to acquire a ' +
         'connection as its own number, separately from query time, which is a metric every pool library exposes and almost ' +
         'nobody records. Then either raise the pool size, if the database can take it, or reduce how long each request ' +
         'holds a connection, which is usually the better fix.'
    }},

    { h: 'Timeouts, retries and the shape of a safe retry' },
    { p: 'Under load, everything that can wait eventually waits too long. Four timeouts belong in a payments service, and ' +
         'they should get shorter as you go outward:' },
    { table: {
      head: ['Timeout', 'What it bounds', 'Sensible starting point'],
      rows: [
        ['`lock_timeout`', 'How long a statement waits for a lock', 'A few seconds'],
        ['`statement_timeout`', 'How long one statement may run', 'Longer than your slowest legitimate query'],
        ['Pool acquire timeout', 'How long a request waits for a connection', 'Under a second'],
        ['Client timeout', 'How long the caller waits for your whole response', 'Shorter than their patience, longer than your p99']
      ]
    }},
    { p: 'Retries then follow three rules. **Only retry what is safe to repeat**, which means an idempotency key on every ' +
         'write. **Only retry what can succeed next time**: a serialization failure, a deadlock, a timeout, a `503`. Never a ' +
         '`422`. And **back off with jitter**: if every client retries after exactly one second, they all arrive together ' +
         'and rebuild the pile-up they were retreating from.' },
    { code: 'delay = min(cap, base * 2 ** attempt) * random.uniform(0.5, 1.0)     # jitter', lang: 'python' },

    { h: 'Testing something that only fails sometimes' },
    { p: 'A concurrency bug that appears one run in twenty is worse than useless as a test. The test rig in this level fails ' +
         '**every** time, and it does that through two deliberate choices:' },
    { ol: [
      '**Open every connection before starting.** Otherwise the workers are staggered by their TLS handshakes, and by the ' +
      'time the last one connects the first has already committed. When this level was written, that alone was the ' +
      'difference between a race that fired and one that did not.',
      '**Release them with a barrier.** A `threading.Barrier(8)` makes all eight threads wait until the eighth arrives, then ' +
      'releases them at the same instant.'
    ]},
    { code: 'barrier = threading.Barrier(WORKERS)\n\ndef worker(w):\n    conn = psycopg.connect(URL)      # connect first\n    barrier.wait()                   # then everybody starts together\n    return spend(conn)', lang: 'python' },
    { p: 'That is the whole trick, and it turns "it happens in production sometimes" into a test that fails on your laptop ' +
         'in under a second. Put it in your test suite with the assertion that matters: **the final balance is never below ' +
         'zero**, whatever the workers did.' },
    { money: 'Bringing a reproduction like this to an interview changes the conversation. "I wrote a test rig that overdraws ' +
             'an account by $540 every time, then fixed it three ways and measured each" is a sentence very few graduates ' +
             'can say, and it answers the concurrency question, the testing question and the measurement question at once.' }
  ],

  tutorial: {
    intro: 'This builds directly on the level 6 database and the level 7 API. You need Postgres, psycopg, and the patience ' +
           'to make something fail on purpose before you fix it. Work in the payments-api repository, in a `bench/` folder.',
    steps: [
      {
        t: 'Set the scene',
        blocks: [
          { p: 'Write a `setup()` that creates two accounts, clears their entries, and puts exactly $100.00 into the first ' +
               'one with a balanced transaction. It must be runnable repeatedly, because you will run the experiment many ' +
               'times.' },
          { code: 'WORKERS = 8\nSPEND = 8000          # each worker tries to spend $80.00\nSTART = 10000         # the account starts with $100.00', lang: 'python' },
          { warn: 'Seed the money with a balanced transaction against the `world` account, not by inserting a single entry. ' +
                  'The level 6 trigger will refuse a lone entry, and it is right to.' }
        ],
        check: 'Running setup() twice leaves the account holding exactly 10000 both times.'
      },
      {
        t: 'Reproduce the overdraft',
        blocks: [
          { p: 'Write the naive worker: read the balance, check it, write both entries, commit. Then run eight of them with ' +
               'a thread pool, connections opened before the barrier.' },
          { code: 'def worker(w, barrier):\n    conn = psycopg.connect(URL)\n    barrier.wait()\n    with conn.cursor() as cur:\n        cur.execute("select coalesce(sum(amount_minor), 0) from entries where account_id = %s", (src,))\n        available = cur.fetchone()[0]\n        if available < SPEND:\n            return f"refused (saw {available})"\n        ...\n    conn.commit()\n    return f"spent (saw {available})"', lang: 'python' },
          { code: 'succeeded 8 of 8   final balance -54000', lang: 'text' },
          { p: 'If yours does not overdraw, the workers are not actually concurrent. Check that every connection is open ' +
               'before the barrier, and that the barrier count matches the worker count.' }
        ],
        check: 'The run ends with a negative balance, and it does so every time you run it.'
      },
      {
        t: 'Fix it with a row lock',
        blocks: [
          { p: 'Add one statement before the balance read, and change nothing else.' },
          { code: 'cur.execute("select id from accounts where id = %s for update", (src,))', lang: 'python' },
          { p: 'Run it again. Exactly one worker should spend, the rest should see the real balance and refuse themselves. ' +
               'Record the wall clock time as well as the result: the correct version is slower, and knowing by how much is ' +
               'the point of the exercise.' },
          { tip: 'Then try eight workers spending $10.00 each from the same $100.00. All eight should succeed, and the ' +
                 'balance should be exactly 2000. A lock is not a refusal: it is a queue.' }
        ],
        check: 'One worker spends, seven refuse, the balance is 2000, and you have recorded both timings.'
      },
      {
        t: 'Fix it with serializable isolation',
        blocks: [
          { p: 'Remove the lock. Set the isolation level per transaction, wrap the work in a retry loop, and catch ' +
               '`SerializationFailure` specifically rather than catching everything.' },
          { code: 'conn.isolation_level = psycopg.IsolationLevel.SERIALIZABLE\n\nwhile attempts < 5:\n    try:\n        ...\n        conn.commit()\n        break\n    except psycopg.errors.SerializationFailure:\n        conn.rollback()\n        time.sleep(0.005 * attempts * random.uniform(0.5, 1.0))', lang: 'python' },
          { warn: 'Check that the isolation level actually applied before you trust the result: run `show ' +
                  'transaction_isolation` inside a transaction and print it. If it says `read committed`, you are behind a ' +
                  'pooler that discarded your session setting, which is exactly what happened while writing this level.' }
        ],
        check: 'show transaction_isolation prints serializable, and the run ends with one spend and a balance of 2000.'
      },
      {
        t: 'Fix it with a constraint',
        blocks: [
          { p: 'Add the cached balance column from level 6 if you have not, then a check constraint that makes an overdraft ' +
               'impossible whatever the application does.' },
          { code: 'alter table accounts add constraint balance_never_negative\n  check (balance_minor >= 0 or allow_negative);', lang: 'sql' },
          { p: 'Now run the **naive** worker again, with no lock and no serializable. It should still be impossible to ' +
               'overdraw: some workers get a constraint violation, which your code turns into `422 insufficient_funds`.' }
        ],
        check: 'With no application level protection at all, the balance never goes below zero.'
      },
      {
        t: 'Add a pool, and measure it',
        blocks: [
          { code: 'from psycopg_pool import ConnectionPool\n\npool = ConnectionPool(DATABASE_URL, min_size=8, max_size=8, timeout=1.0, open=True)\n\nwith pool.connection() as conn, conn.cursor() as cur:\n    ...', lang: 'python' },
          { p: 'Then run the same fixed workload three ways and put the table in your README: no pool, a pool the size of ' +
               'your concurrency, and a pool deliberately too small. The reference numbers, for shape rather than ' +
               'comparison:' },
          { code: 'no pool, connect every request     p50 228.8 ms   31.4 req/s\npool of 8, 8 workers               p50  59.8 ms  127.1 req/s\npool of 2, 8 workers               p50 251.1 ms   30.8 req/s', lang: 'text' },
          { tip: 'Record the time spent waiting for a connection separately from the time spent querying. That single metric ' +
                 'is how you tell a slow database from a starved pool, and almost nobody has it before their first incident.' }
        ],
        check: 'Your three rows show the same shape: a right sized pool much faster, a too small pool no better than none.'
      },
      {
        t: 'Wire the fix into the API',
        blocks: [
          { p: 'Take the winning approach back into the level 7 service. For a ledger, the usual answer is a row lock on the ' +
               'source account plus the database constraint, because it needs no retry from the caller and still cannot be ' +
               'bypassed.' },
          { p: 'Then put the pool behind it, with a timeout, and return `503` with a `Retry-After` header when the pool is ' +
               'exhausted rather than queueing forever.' },
          { code: 'except PoolTimeout:\n    return problem(503, "service_busy", "No database connection available.", rid,\n                   headers={"Retry-After": "1"})', lang: 'python' }
        ],
        check: 'Eight concurrent API calls spending more than the balance produce one 201 and seven 422s, and never a negative balance.'
      },
      {
        t: 'Make it a test that always fails without the fix',
        blocks: [
          { p: 'Move the test rig into your test suite with the assertion that matters, and make it run in CI. Then delete ' +
               'the fix temporarily and watch the test go red, because a concurrency test you have never seen fail is not ' +
               'evidence of anything.' },
          { code: 'def test_cannot_overdraw_under_concurrency():\n    setup(start=10_000)\n    results = run_workers(8, spend=8_000)\n    assert balance(src) >= 0\n    assert sum(1 for r in results if r.startswith("spent")) == 1', lang: 'python' },
          { p: 'Finish the README with the four results, the timings, the pool table, and one paragraph choosing an approach ' +
               'and saying why. That paragraph is the interview answer.' }
        ],
        check: 'The test passes with the fix, fails without it, and takes under a second.'
      }
    ]
  },

  glossary: [
    { t: 'Race condition', d: 'A bug whose outcome depends on the timing of things happening at once.' },
    { t: 'Lost update', d: 'Two transactions read the same value, both act on it, and one decision is silently discarded.' },
    { t: 'Isolation level', d: 'The setting for how much concurrent transactions may affect each other.' },
    { t: 'read committed', d: 'Postgres\' default: each statement sees committed data, and the world may change between your statements.' },
    { t: 'serializable', d: 'The strongest level: the result must be as if transactions ran one at a time. Conflicts abort one.' },
    { t: 'Serialization failure', d: 'The error telling you your transaction was aborted to keep that promise. Retry it.' },
    { t: 'Pessimistic locking', d: 'Assume a conflict and prevent it, by making others wait. `select ... for update`.' },
    { t: 'Optimistic concurrency', d: 'Assume no conflict, detect one at commit, and retry the loser.' },
    { t: 'Row lock', d: 'A lock on specific rows, held until the transaction ends.' },
    { t: 'Deadlock', d: 'Two transactions each holding what the other needs. Postgres aborts one with SQLSTATE 40P01.' },
    { t: 'Lock ordering', d: 'Always taking locks in the same order, so a cycle cannot form. Usually by id.' },
    { t: 'Connection pool', d: 'A set of open connections lent to requests, so the handshake happens once rather than per request.' },
    { t: 'Pool timeout', d: 'How long a request waits for a free connection before failing fast.' },
    { t: 'Connection pooler', d: 'A service between your app and the database that shares real connections between clients.' },
    { t: 'Transaction mode pooling', d: 'A pooler that lends a real connection for one transaction, which is why session settings do not survive.' },
    { t: 'lock_timeout', d: 'How long a statement waits for a lock before giving up.' },
    { t: 'statement_timeout', d: 'How long one statement may run before the server cancels it.' },
    { t: 'Jitter', d: 'Randomness added to a retry delay, so retrying clients do not all return at the same instant.' },
    { t: 'Barrier', d: 'A synchronisation tool that holds threads until all have arrived, then releases them together.' }
  ],

  quiz: [
    { q: "Eight workers each read a balance of $100.00 and each spend $80.00. The account ends at minus $540.00. What is the name for this?",
      options: [
        "A dirty read",
        "A deadlock",
        "A lost update caused by a race between the read and the write",
        "A rollback failure"
      ],
      answer: 2,
      why: "Every worker was right when it looked. Nothing forced any of them to notice the world changing in between." },

    { q: "Wrapping the read and the write in one transaction does not fix it because:",
      options: [
        "The entries table has no primary key",
        "Postgres ignores transactions under load",
        "The transaction was too short",
        "Transactions are only about atomicity and visibility, not exclusivity"
      ],
      answer: 3,
      why: "It guarantees both entries land together. It does not stop seven other transactions reading the same balance." },

    { q: "Under `read committed`, what exactly is guaranteed?",
      options: [
        "Each statement sees a consistent snapshot of committed data",
        "No other transaction can write while yours is open",
        "Your transaction sees one snapshot for its whole life",
        "Transactions behave as if run one at a time"
      ],
      answer: 0,
      why: "Per statement, not per transaction, which is exactly the gap a read-then-write decision falls into." },

    { q: "`select ... for update` fixes the race by:",
      options: [
        "Copying the row into a temporary table",
        "Detecting the conflict at commit and aborting one transaction",
        "Locking the rows so other transactions wait until you commit",
        "Making the query faster"
      ],
      answer: 2,
      why: "Pessimistic: assume a conflict and prevent it. Measured, it took the run from 367 ms to 691 ms and from wrong to right." },

    { q: "The measured cost of the row lock in this level was:",
      options: [
        "A negative balance on one account",
        "A retry for every caller",
        "Spending from that account became serialised: 691 ms against 367 ms",
        "A deadlock in one run of eight"
      ],
      answer: 2,
      why: "Correctness had a price, and knowing the price is the part an interviewer is listening for." },

    { q: "Serializable isolation requires what from every caller?",
      options: [
        "A second connection",
        "A retry loop, because a conflicting transaction is aborted rather than delayed",
        "A longer timeout",
        "A row lock as well"
      ],
      answer: 1,
      why: "And a retry is only safe if the operation is idempotent, which is why level 7 required an idempotency key." },

    { q: "When is a row lock the better choice than serializable?",
      options: [
        "When you cannot change the schema",
        "When conflicts are common, such as a hot account, and you do not want callers to see retries",
        "When the table has no index",
        "When conflicts are rare"
      ],
      answer: 1,
      why: "Serializable is cheaper when clashes are rare and turns into retry storms when they are not." },

    { q: "A check constraint such as `balance_minor >= 0` is stronger than an application check because:",
      options: [
        "It is enforced for every writer, including code that forgets to check, and two transactions cannot update one row at once",
        "It runs faster",
        "It removes the need for transactions",
        "It prevents deadlocks"
      ],
      answer: 0,
      why: "The trade is that you now maintain a balance column, so the reconciliation job stops being optional." },

    { q: "You set the isolation level on the session and `show transaction_isolation` reports `read committed` anyway. Why?",
      options: [
        "The setting takes effect only after a reconnect",
        "Postgres ignores that setting",
        "The isolation level can only be set by a superuser",
        "A transaction mode connection pooler discarded your session setting"
      ],
      answer: 3,
      why: "Set it per transaction instead. Nothing raises an error, which is why this one reaches production." },

    { q: "Which of these also stops working quietly behind a transaction mode pooler?",
      options: [
        "Session advisory locks, LISTEN and NOTIFY, temporary tables and session SET",
        "Write ahead logging",
        "Primary key indexes",
        "Foreign key constraints"
      ],
      answer: 0,
      why: "Anything that assumes you keep the same real connection between transactions." },

    { q: "Measured: no pool 31.4 req/s, a pool of 8 with 8 workers 127.1 req/s, a pool of 2 with 8 workers 30.8 req/s. What does the third number teach?",
      options: [
        "Pools only help with more than 8 workers",
        "Pools should always be as large as possible",
        "The database was overloaded",
        "A pool that is too small is as slow as no pool, and the waiting never appears in your query timings"
      ],
      answer: 3,
      why: "The pool is a queue. Requests wait for a connection while the database reports that every query it ran was fast." },

    { q: "How should you size a connection pool?",
      options: [
        "As large as the database will allow",
        "From measured hold time and required throughput, with headroom, capped well below the database total across all instances",
        "One connection per expected user",
        "Twice the number of CPU cores, always"
      ],
      answer: 1,
      why: "Every instance has its own pool and they all add up. Past a point, more connections make the database slower." },

    { q: "Why put a timeout on acquiring a connection from the pool?",
      options: [
        "To force connections to be recycled",
        "Because otherwise an exhausted pool becomes an unbounded queue and the service stops answering anybody",
        "Because the database requires it",
        "To detect network failures"
      ],
      answer: 1,
      why: "Fail fast with 503 for the requests you cannot serve, rather than slowly for everybody." },

    { q: "Which of these should never be retried?",
      options: [
        "A 422 insufficient funds",
        "A 503",
        "A serialization failure",
        "A deadlock"
      ],
      answer: 0,
      why: "Retry only what can succeed next time, and only what is safe to repeat, which means an idempotency key." },

    { q: "Why does the test rig open every connection before the barrier?",
      options: [
        "To share one connection between threads",
        "Because psycopg requires it",
        "Because otherwise the workers are staggered by their handshakes and the first commits before the last connects",
        "To reduce database load"
      ],
      answer: 2,
      why: "It is the difference between a test that fails every time and one that fails occasionally, which is no test at all." }
  ],

  project: {
    title: 'race-lab: break it, fix it three ways, measure all three',
    story: 'Write the test rig that overdraws an account on purpose, then fix it with a lock, with serializable isolation, ' +
           'and with a constraint. Measure each. Put a connection pool behind your level 7 API and show what it did. The ' +
           'deliverable is the evidence, more than the fix.',
    scope: 'Uses levels 6 and 7. Postgres, psycopg, psycopg_pool, threads. No new frameworks.',
    dataset: '{{RAW}}/data/level-03-transactions.csv',
    requirements: [
      'A `setup()` that is safe to run repeatedly and seeds a known balance with a balanced transaction',
      'A test rig of N workers that open their connections before a barrier and start together',
      'A naive mode that overdraws the account on every single run, with the final balance printed',
      'A row lock mode that ends correct, with the wall clock time recorded alongside',
      'A serializable mode with a retry loop that catches only SerializationFailure, with retries counted',
      'A check that prints `show transaction_isolation` from inside a transaction, so you can prove the level applied',
      'A constraint mode where the naive worker cannot overdraw because the database refuses it',
      'A benchmark of the same workload with no pool, a right sized pool and a deliberately small pool, reporting p50, p95 and throughput',
      'The wait for a connection recorded as its own metric, separate from query time',
      'The chosen fix wired into the level 7 API, returning 422 for insufficient funds and 503 with Retry-After when the pool is exhausted',
      'A test in CI that fails when the fix is removed and passes with it, in under a second',
      'A README with the four results, both tables of timings, and a paragraph choosing one approach and defending it',
      'The repository public on GitHub as `race-lab`, or a documented folder inside `payments-api`'
    ],
    starter: {
      lang: 'python',
      code: '"""FinQuest level 8: reproduce the race, then fix it three ways.\n\nRun:\n  python -m bench.race naive\n  python -m bench.race for_update\n  python -m bench.race serializable\n  python -m bench.pool\n"""\n\nimport threading\nimport time\nfrom concurrent.futures import ThreadPoolExecutor\n\nimport psycopg\n\nWORKERS = 8\nSPEND = 8_000          # each worker tries to spend $80.00\nSTART = 10_000         # the account starts with $100.00\n\n\ndef setup() -> tuple[int, int]:\n    """Create the accounts, clear them, seed START with a balanced transaction."""\n    # TODO\n    raise NotImplementedError\n\n\ndef worker(mode: str, src: int, dst: int, w: int, barrier: threading.Barrier) -> str:\n    """Connect BEFORE the barrier, then all workers start together.\n\n    mode is one of: naive, for_update, serializable.\n    Return a short string describing what happened, including what balance was seen.\n    """\n    # TODO\n    raise NotImplementedError\n\n\ndef run(mode: str) -> None:\n    """Run WORKERS workers, then print how many spent, the final balance, and the time."""\n    # TODO\n    raise NotImplementedError\n'
    },
    tests: [
      'The naive mode ends with a negative balance on ten runs out of ten',
      'The row lock mode ends with a balance of exactly 2000 and one successful spend',
      'The serializable mode ends with a balance of exactly 2000, and any retries are counted and reported',
      'Eight workers spending 1000 each from 10000 all succeed under the row lock, ending at 2000',
      '`show transaction_isolation` inside a transaction prints serializable in that mode',
      'With the check constraint in place, the naive worker still cannot produce a negative balance',
      'The pool benchmark reports higher throughput for a right sized pool than for no pool',
      'The pool benchmark shows a too small pool performing no better than no pool',
      'Removing the fix from the API makes the concurrency test fail',
      'An exhausted pool returns 503 with a Retry-After header rather than hanging'
    ],
    rubric: [
      { pts: 25, t: 'A reproduction that always fails', d: 'Connections opened before a barrier, the overdraft on every run, and the test rig in CI.' },
      { pts: 25, t: 'Three fixes, understood', d: 'Lock, serializable with retries, and a constraint, each working, each with its cost stated.' },
      { pts: 20, t: 'Measured', d: 'Timings for each fix, the pool table with p50, p95 and throughput, and connection wait recorded separately.' },
      { pts: 15, t: 'Carried into the service', d: 'The API cannot overdraw under concurrent calls, and fails fast when the pool is exhausted.' },
      { pts: 15, t: 'Defended', d: 'A README paragraph choosing one approach for this system and saying what it costs.' }
    ],
    stretch: [
      'Reproduce a deadlock with two transfers in opposite directions, then fix it by locking account ids in sorted order',
      'Measure how the row lock scales: 2, 8, 32 and 128 workers against one account, and plot throughput against concurrency',
      'Add an advisory lock version, and explain when you would prefer it to a row lock',
      'Run the same experiment with the pooler and without it, and show which settings survive each',
      'Add write skew: two transactions that each pass a rule looked at separately and break it together, and find the isolation level that stops it'
    ],
    solutionPath: 'solutions/level-08'
  },

  faq: [
    { q: 'My naive test rig does not overdraw',
      a: 'The workers are not really concurrent. Open every connection before the barrier, check the barrier count equals the worker count, and make sure each worker has its own connection rather than sharing one.' },
    { q: 'Is serializable always the safest choice?',
      a: 'It is the strongest promise, and it is only safe in practice if every caller retries and every write is idempotent. A row lock is often the better engineering answer because the waiting stays inside your service.' },
    { q: 'How do I know whether I am behind a pooler?',
      a: 'Set something on the session and read it back in the next transaction. If it does not survive, you are. Hosted databases frequently give you two connection strings, one pooled and one direct, and the difference is exactly this.' },
    { q: 'Should I use async instead of threads?',
      a: 'For the test rig, threads are clearer. For the service, async helps when you are waiting on the network, which you mostly are. Neither fixes a race: concurrency control is a property of your database access, not of your language.' },
    { q: 'What pool size should I actually use?',
      a: 'Measure hold time and required throughput, then add headroom, then check the total across every instance against what the database accepts. A common production mistake is twenty instances with a pool of fifty each, pointed at a database that allows a hundred connections.' },
    { q: 'Do I need all three fixes in one system?',
      a: 'Most real ledgers run a row lock plus a database constraint: the lock makes the common path clean, and the constraint means a bug in a new code path cannot overdraw anybody. Serializable is the right answer for workloads where conflicts are genuinely rare.' },
    { q: 'What do I say about this in an interview?',
      a: 'Lead with the reproduction: eight workers, one $100 account, minus $540 every run. Then the three fixes with their measured costs, and then the pooler that threw the isolation level away. That last one is a senior engineer\'s war story and you will have had it as a student.' }
  ]
});
