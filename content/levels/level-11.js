/* =========================================================================
   LEVEL 11: the ledger on a real database
   ========================================================================= */
FQ.registerLevel({
  id: 11,
  codename: 'postgres ledger',
  title: 'The ledger that survives two writers',
  tagline: 'Level 4 balanced the books in a Python list. Now two people spend the same money at the same moment, and the database has to be the thing that says no.',
  difficulty: 8,
  minutes: 240,
  tags: ['Postgres', 'transactions', 'concurrency', 'SQL'],
  summary: 'Every payments company runs on a ledger in a database, and every interview for those jobs asks what happens ' +
           'when two requests hit one account at once. This level moves the level 4 ledger into Postgres, puts the balancing ' +
           'invariant in the schema where the application cannot forget it, and then breaks it on purpose with two writers.',

  objectives: [
    'Design a double entry schema with accounts, transactions and entries',
    'Wrap a multi row write in one database transaction so it is all or nothing',
    'Enforce the balancing invariant in the database rather than in the application',
    'Explain read committed against serializable, and produce a lost update on purpose',
    'Take a row lock with SELECT FOR UPDATE and say what it costs',
    'Make a write idempotent with a unique index rather than with an if statement',
    'Reconcile a cached balance against the entries that produced it'
  ],

  knowledge: [
    { h: 'What the Python list could not do' },
    { p: 'The level 4 ledger was correct, and useless for a real business, for two reasons. It lived in one running Python ' +
         'program, so everything vanished when the program stopped. And only one person could use it at a time, so the ' +
         'question that decides whether a payments system works never came up: what happens when two payments touch the same ' +
         'account in the same thousandth of a second?' },
    { p: 'A **database** solves both. It is a program whose whole job is to store data safely on disk and let many users read ' +
         'and change it at once without corrupting it. This level uses **Postgres**, the free database most fintech companies ' +
         'run on. You talk to it in **SQL**, a language for asking a database to store and fetch data.' },
    { p: 'A few words you need first:' },
    { table: {
      head: ['Word', 'Plain meaning'],
      rows: [
        ['**Table**', 'Like a spreadsheet sheet: named columns, and one row per record'],
        ['**Schema**', 'The design of your tables: which columns, what type each holds, and what rules they must follow'],
        ['**Constraint**', 'A rule the database enforces on every row, whoever writes it. Break it and the write is refused'],
        ['**Query**', 'A question or command sent to the database in SQL']
      ]
    }},
    { p: 'One word needs special care, because it means two things in this level. In money, a **transaction** is an event ' +
         'like "Alice paid Bob". In a database, a **transaction** is a group of changes that are saved together or not at ' +
         'all. The good news is that one money transfer is exactly one database transaction, as you will see.' },
    { p: 'Databases make four promises about transactions, known by their initials as **ACID**:' },
    { table: {
      head: ['Letter', 'The promise', 'What it means for a transfer'],
      rows: [
        ['**A**tomicity', 'All of it happens, or none of it does', 'Both entries are saved, or neither is'],
        ['**C**onsistency', 'Every rule still holds when the change is saved', 'A transfer that does not balance cannot be saved'],
        ['**I**solation', 'Two transactions running at once cannot see each other half finished', 'Two transfers cannot both spend the last $10'],
        ['**D**urability', 'Once saved, it stays saved', 'A power cut a second later does not undo it']
      ]
    }},
    { check: {
      q: 'Level 4 said a transaction that does not balance is invalid, and your Python checked that before saving. Why is the ' +
         'same check in the database worth writing again?',
      a: 'Because your Python is one door into the data, and a database has many. A one-off fix-up script, a colleague typing ' +
         'SQL directly, a second service written next year, and a bug fix that adds a new way to write all skip your Python ' +
         'entirely. A rule in the schema holds for every one of them, including the ones that do not exist yet. Checks in your ' +
         'code give friendlier error messages and catch problems earlier; checks in the database are the ones that are actually ' +
         'guarantees.'
    }},

    { h: 'The design: three tables' },
    { p: 'The ledger needs three tables. An **account** is somewhere money can sit. A **transaction** is one money event. An ' +
         '**entry** is one line of that event: an account and an amount. Alice paying Bob $25 is one row in `transactions` and ' +
         'two rows in `entries`, -2500 for Alice and +2500 for Bob. Amounts are whole cents, as in level 4, stored in a column ' +
         'of type `bigint` (a whole number that can go very large).' },
    { code: 'create table accounts (\n  id           bigserial primary key,\n  name         text        not null unique,\n  kind         text        not null check (kind in (\'customer\', \'revenue\', \'world\')),\n  allow_negative boolean   not null default false,\n  created_at   timestamptz not null default now()\n);\n\ncreate table transactions (\n  id              bigserial primary key,\n  memo            text        not null,\n  idempotency_key text        unique,          -- the retry guard, see below\n  created_at      timestamptz not null default now()\n);\n\ncreate table entries (\n  id             bigserial primary key,\n  transaction_id bigint      not null references transactions(id),\n  account_id     bigint      not null references accounts(id),\n  amount_cents   bigint      not null check (amount_cents <> 0),\n  created_at     timestamptz not null default now()\n);\n\ncreate index entries_account_idx on entries (account_id);', lang: 'sql', label: 'the whole ledger' },
    { p: 'Read it one piece at a time:' },
    { table: {
      head: ['Piece', 'What it does'],
      rows: [
        ['`bigserial primary key`', 'Gives every row a unique number, 1, 2, 3, filled in automatically. The **primary key** is how you refer to one row'],
        ['`not null`', 'This column can never be left empty'],
        ['`references accounts(id)`', 'An entry can only point at an account that exists. This link is called a **foreign key**'],
        ['`check (amount_cents <> 0)`', 'Refuses an entry of zero, which is always a bug'],
        ['`unique`', 'No two rows may have the same value here. On the idempotency key, this is the retry guard'],
        ['`timestamptz ... default now()`', 'Records the moment the row was written, with its time zone'],
        ['`create index`', 'A lookup table, like the index at the back of a book, so finding one account\'s entries stays fast with a million rows']
      ]
    }},
    { warn: 'There is no `balance` column on `accounts`, on purpose. A balance is the sum of the entries, as in level 4. Store ' +
            'it as well and you have two answers to the same question, which is the subject of the last section.' },

    { h: 'One transfer, one database transaction' },
    { p: 'Both entries of a transfer must be saved together. In SQL you start a database transaction with `begin`, make your ' +
         'changes, and save them all at once with `commit`. If anything goes wrong in between, `rollback` throws every change ' +
         'away, as if none of it happened.' },
    { p: 'In Python, the psycopg library does this for you with a `with` block. Leave the block normally and it commits. Hit ' +
         'an error inside it and it rolls back:' },
    { code: 'with conn:                       # begin; then commit at the end, or rollback on an error\n    with conn.cursor() as cur:\n        cur.execute(\n            "insert into transactions (memo, idempotency_key) values (%s, %s) returning id",\n            (memo, key),\n        )\n        txn_id = cur.fetchone()[0]\n        cur.executemany(\n            "insert into entries (transaction_id, account_id, amount_cents) values (%s, %s, %s)",\n            [(txn_id, src_id, -amount), (txn_id, dst_id, amount)],\n        )', lang: 'python', label: 'all of it or none of it' },
    { p: 'Notice the `%s` placeholders. They are not ordinary Python string formatting. psycopg sends the SQL and the values to ' +
         'the database separately, so a value can never be mistaken for a command. That matters because of this:' },
    { code: '# NEVER do this\nname = "Bob\'); delete from entries; --"\ncur.execute(f"insert into accounts (name) values (\'{name}\')")\n\n# the database receives:\n#   insert into accounts (name) values (\'Bob\'); delete from entries; --\')\n#   ...and deletes your whole ledger', lang: 'python' },
    { warn: 'That attack is called **SQL injection**, and it is one of the most common security holes on the internet. The whole ' +
            'defence is a habit: never build SQL by gluing strings together with f-strings or `+`. Always use placeholders.' },
    { check: {
      q: 'Your transfer inserts the transaction row, inserts the first entry, and then the program is killed. What is in the ' +
         'database when it comes back up?',
      a: 'Nothing from that transfer. The inserts were inside a database transaction that never reached `commit`, so Postgres ' +
         'throws them away when the connection dies: no transaction row, no entry, no half written transfer. That is atomicity, ' +
         'and it is why the level 4 worry about a program dying between two entries stops being your problem. What is still your ' +
         'problem is telling the caller it failed, because from outside, a crash just before the commit and just after it look ' +
         'identical.'
    }},

    { h: 'Make the database enforce the balance rule' },
    { p: 'The rule is that the entries of one money transaction add up to zero. A `check` constraint cannot express that, ' +
         'because a check only ever looks at one row at a time, and this rule is about a group of rows. A **trigger** can. A ' +
         'trigger is a small function the database runs automatically when something happens, here whenever an entry is ' +
         'inserted:' },
    { code: 'create or replace function entries_balance() returns trigger as $$\nbegin\n  if (select sum(amount_cents) from entries where transaction_id = new.transaction_id) <> 0 then\n    raise exception \'transaction % does not balance\', new.transaction_id;\n  end if;\n  return null;\nend;\n$$ language plpgsql;\n\ncreate constraint trigger entries_must_balance\n  after insert on entries\n  deferrable initially deferred        -- run the check at commit, not after each row\n  for each row execute function entries_balance();', lang: 'sql' },
    { p: 'The line `deferrable initially deferred` is the part that matters. Think about the moment after the first entry is ' +
         'inserted: Alice\'s -2500 is there and Bob\'s +2500 is not yet. The transaction is unbalanced, on purpose, for a moment. ' +
         'Checked then, every transfer would fail. **Deferred** means "wait until commit, when every entry is in, then check".' },
    { money: 'A ledger with this trigger cannot hold an unbalanced transaction, no matter which program wrote it or how buggy ' +
             'that program was. Auditors ask for exactly this: not whether your code is careful, but whether the system could ' +
             'even record money going missing.' },

    { h: 'Two payments, one balance, the same moment' },
    { p: 'Here is the failure that separates people who have run a ledger from people who have written one. An account holds ' +
         '$100. Two transfers of $80 each arrive at the same moment, from two different requests, each handled by its own ' +
         'connection to the database (each called a **session**):' },
    { code: 'session A                          session B\n---------------------------------  ---------------------------------\nbegin;                             begin;\nselect sum(amount_cents)           select sum(amount_cents)\n  from entries                       from entries\n where account_id = 7;               where account_id = 7;\n-- 10000                            -- 10000\n-- 8000 <= 10000, fine              -- 8000 <= 10000, fine\ninsert ... -8000 ...                insert ... -8000 ...\ncommit;                            commit;\n\n-- balance is now -6000', lang: 'text', label: 'the lost update, step by step' },
    { p: 'Both read the balance, both saw $100, both decided $80 was affordable, both saved. The account ends at **-$60**, ' +
         'and each session believes it behaved perfectly. This is called a **lost update**, one kind of **race condition**: a ' +
         'bug that only appears when two things happen at almost exactly the same time.' },
    { p: 'Nothing here is a bug in your Python. Postgres\'s default **isolation level**, the setting for how much transactions ' +
         'running at once can affect each other, is called `read committed`. It guarantees each individual query sees a ' +
         'consistent picture. It says nothing about a decision you made in Python between two queries. There are three ways to ' +
         'close the gap:' },
    { table: {
      head: ['Fix', 'What it does', 'What it costs'],
      rows: [
        ['`select ... for update`', 'Locks the account\'s row. The second session has to wait until the first commits', 'Payments from one account happen one at a time'],
        ['`serializable` isolation', 'Postgres notices the two sessions clashed and cancels one with an error', 'Your code must be ready to retry the cancelled one'],
        ['A rule on a stored balance', 'The database refuses to let a balance go below zero', 'You need a stored balance to put the rule on']
      ]
    }},
    { p: 'The first fix, the **row lock**, is the most common. Here is the same race with it:' },
    { code: '-- lock the account first, then decide\nselect id from accounts where id = %s for update;\nselect coalesce(sum(amount_cents), 0) from entries where account_id = %s;\n\n-- session A takes the lock, sees $100, spends $80, commits, releases the lock\n-- session B was waiting at the first line; now it runs, sees $20, and refuses', lang: 'sql' },
    { check: {
      q: 'You add `for update` on the source account and the double spend stops. A colleague asks why you did not use ' +
         '`serializable` instead, which needs no lock. Answer them.',
      a: 'Both work, and they fail differently. `for update` makes the second transfer wait, then succeed or be refused on the ' +
         'real balance, so the caller never sees a retry: the cost is that spending from one account now happens single file, ' +
         'which matters for a very busy account like the fee income account. `serializable` lets both run and cancels one with ' +
         'an error, which is cheaper when clashes are rare, but every caller has to be written to retry, and a retry that is not ' +
         'idempotent charges somebody twice. Pick the lock when clashes are normal, and serializable with a retry loop when ' +
         'they are rare.'
    }},

    { h: 'Idempotency, done by the database' },
    { p: 'Level 4 remembered idempotency keys in a Python dictionary. A database can do better: put a `unique` constraint on ' +
         'the key column, and simply try to insert. If the key already exists, the database refuses the insert, and you look ' +
         'up the original transaction instead:' },
    { code: 'try:\n    txn_id = post_transfer(...)          # inserts with idempotency_key\nexcept psycopg.errors.UniqueViolation:\n    # this key was used before: by an earlier attempt of this same payment\n    txn_id = lookup_by_key(key)\nreturn txn_id', lang: 'python' },
    { p: 'Why not the obvious way, "look for the key, and insert if it is not there"? Because there is a gap between the look ' +
         'and the insert, and two retries of the same payment can both fit inside it:' },
    { code: 'request 1                         request 2 (a retry, same key)\nselect ... where key = \'k9\'   ->  select ... where key = \'k9\'\n  -- not found                       -- not found\ninsert ... key = \'k9\'              insert ... key = \'k9\'\n  -- charged                         -- charged again', lang: 'text' },
    { p: 'The unique constraint has no gap: checking and inserting are one operation inside the database, so exactly one of ' +
         'the two can ever succeed.' },
    { check: {
      q: 'Why is "select where key = ..., and insert if there is no row" wrong, when it passes every test you can write for it?',
      a: 'Because the failure needs two requests inside the same few thousandths of a second, and your tests run one at a time. ' +
         'Both select, both find nothing, both insert, and you have charged the customer twice with code that reads as if it ' +
         'checked. It is the same shape as the double spend above: a decision made between two statements is a decision made on ' +
         'out-of-date information. The unique constraint has no gap, because the check and the write are one operation.'
    }},

    { h: 'The balance you show, and the balance that is true' },
    { p: 'Adding up every entry is correct, and gets slower as the ledger grows: an account with a million entries means adding ' +
         'a million numbers for every balance on screen. At some size you store a copy of the balance on the account row. From ' +
         'that moment you have two numbers that are supposed to agree, and checking that they do is your job.' },
    { code: 'alter table accounts add column balance_cents bigint not null default 0;\n\n-- keep it up to date in the same transaction as the entry\ncreate or replace function apply_entry() returns trigger as $$\nbegin\n  update accounts set balance_cents = balance_cents + new.amount_cents\n   where id = new.account_id;\n  return new;\nend;\n$$ language plpgsql;\n\ncreate trigger entries_apply after insert on entries\n  for each row execute function apply_entry();', lang: 'sql' },
    { p: 'The trigger runs inside the same database transaction as the entry, so the stored balance and the entry are saved ' +
         'together or not at all. That removes most ways for them to drift apart, but not every way, so a check still runs ' +
         'every day. This query lists any account whose stored balance disagrees with its entries:' },
    { code: 'select a.id, a.name, a.balance_cents, coalesce(sum(e.amount_cents), 0) as from_entries\n  from accounts a\n  left join entries e on e.account_id = a.id\n group by a.id\nhaving a.balance_cents <> coalesce(sum(e.amount_cents), 0);', lang: 'sql', label: 'the query that should return nothing' },
    { check: {
      q: 'That check returns nothing every morning for six months. What has it been worth?',
      a: 'It has been worth the six months. A check that finds nothing is not a check that did nothing: it is the evidence that ' +
         'the rule held, and it is the reason anybody can trust the balance column at all. The day it does return a row you ' +
         'will know within hours instead of hearing it from a customer, and you will know which account and by how much. Cheap ' +
         'jobs that usually print nothing are most of what running a system looks like.'
    }},

    { h: 'Only ever add, and make the database insist' },
    { p: 'The ledger is a record of what happened, so nothing in it is ever changed or deleted. A wrong transfer is fixed with ' +
         'a reversing transaction, exactly as in level 4, and the original stays visible forever.' },
    { p: 'You can write that rule in a comment, or you can make the database enforce it. Databases have **roles**, named users ' +
         'with specific permissions, and you can take away a role\'s permission to change or delete rows:' },
    { code: 'revoke update, delete on entries, transactions from app_user;\ngrant insert, select on entries, transactions to app_user;', lang: 'sql' },
    { p: 'Now the application, which connects as `app_user`, can add entries and read them, and physically cannot rewrite ' +
         'history, even if a bug or an attacker tells it to.' },
    { warn: 'This only works if the application really connects as that limited role, and changes to the table design run as a ' +
            'different one. If the same connection details can both post entries and delete the table, "we never change ' +
            'history" is a promise rather than a fact.' }
  ],

  tutorial: {
    intro: 'This level needs Postgres. Two ways in: Docker on your own machine, which is the version most jobs expect you to ' +
           'know, or a free Neon branch in the browser if Docker will not run where you are. Everything after the first step ' +
           'is identical. Work in a file rather than a notebook: this is a project, and level 9 set you up for it.',
    steps: [
      {
        t: 'Get a database and connect to it',
        blocks: [
          { p: 'Docker is one command and gives you a real Postgres on your machine:' },
          { code: 'docker run --name fq-ledger -e POSTGRES_PASSWORD=ledger \\\n  -e POSTGRES_DB=ledger -p 5432:5432 -d postgres:16\n\n# check it answers\ndocker exec -it fq-ledger psql -U postgres -d ledger -c "select version();"', lang: 'bash' },
          { p: 'Then the driver, and a connection that reads its details from the environment rather than from the source:' },
          { code: 'pip install "psycopg[binary]" python-dotenv\n\n# .env, and .env goes in .gitignore\nDATABASE_URL=postgresql://postgres:ledger@localhost:5432/ledger', lang: 'bash' },
          { code: 'import os\nimport psycopg\nfrom dotenv import load_dotenv\n\nload_dotenv()\n\ndef connect():\n    """One connection. The caller owns the transaction."""\n    return psycopg.connect(os.environ["DATABASE_URL"])\n\nwith connect() as conn, conn.cursor() as cur:\n    cur.execute("select now()")\n    print(cur.fetchone()[0])', lang: 'python' },
          { tip: 'No Docker? Create a free project at neon.tech, copy the connection string into the same `DATABASE_URL`, and ' +
                 'every later step works unchanged. That is the whole point of a connection string.' }
        ],
        check: 'A timestamp prints, and DATABASE_URL is in .env rather than in your code.'
      },
      {
        t: 'Create the schema',
        blocks: [
          { p: 'Put the SQL in a file, `schema.sql`, and run it from Python. A schema you can recreate from a file is a schema ' +
               'somebody else can run, which is the difference between a project and a thing on your laptop.' },
          { code: 'def apply_schema(conn, path="schema.sql"):\n    with open(path, encoding="utf-8") as fh:\n        sql = fh.read()\n    with conn.cursor() as cur:\n        cur.execute(sql)\n    conn.commit()', lang: 'python' },
          { p: 'Open the three accounts you will move money between. `world` is the outside, as in level 4, and it is the one ' +
               'allowed to go negative.' },
          { code: 'ACCOUNTS = [("world", "world", True), ("alice", "customer", False),\n            ("bob", "customer", False), ("fee_income", "revenue", True)]\n\nwith conn.cursor() as cur:\n    cur.executemany(\n        "insert into accounts (name, kind, allow_negative) values (%s, %s, %s) "\n        "on conflict (name) do nothing",\n        ACCOUNTS,\n    )\nconn.commit()', lang: 'python' }
        ],
        check: 'select count(*) from accounts returns 4, and running the script twice still returns 4.'
      },
      {
        t: 'Post one balanced transfer',
        blocks: [
          { code: 'def post(conn, legs, memo, key=None):\n    """legs: [(account_name, signed_cents), ...]. One database transaction."""\n    if sum(amount for _, amount in legs) != 0:\n        raise ValueError("legs do not balance")\n\n    with conn.transaction():\n        with conn.cursor() as cur:\n            cur.execute(\n                "insert into transactions (memo, idempotency_key) values (%s, %s) returning id",\n                (memo, key),\n            )\n            txn_id = cur.fetchone()[0]\n            for name, amount in legs:\n                cur.execute(\n                    "insert into entries (transaction_id, account_id, amount_cents) "\n                    "select %s, id, %s from accounts where name = %s",\n                    (txn_id, amount, name),\n                )\n    return txn_id', lang: 'python' },
          { p: '`conn.transaction()` is the begin and commit. Raise anywhere inside it, including from a constraint, and ' +
               'nothing survives.' },
          { code: 'post(conn, [("world", -50_000), ("alice", 50_000)], "opening balance")\npost(conn, [("alice", -2_500), ("bob", 2_450), ("fee_income", 50)], "alice pays bob")', lang: 'python' }
        ],
        check: 'Alice holds 47,500 cents, Bob holds 2,450, fee income holds 50, and world holds -50,000.'
      },
      {
        t: 'Break it on purpose',
        blocks: [
          { p: 'A test that has never seen the constraint refuse is not a test of the constraint. Take the Python guard out ' +
               'of your head for a moment and send the database something that does not balance.' },
          { code: 'from psycopg import errors\n\ntry:\n    with conn.transaction():\n        with conn.cursor() as cur:\n            cur.execute("insert into transactions (memo) values (\'broken\') returning id")\n            txn = cur.fetchone()[0]\n            cur.execute(\n                "insert into entries (transaction_id, account_id, amount_cents) "\n                "select %s, id, -1000 from accounts where name = \'alice\'",\n                (txn,),\n            )\n            # and no second leg\nexcept errors.RaiseException as err:\n    print("refused:", err)', lang: 'python' },
          { p: 'The exception arrives at the commit rather than at the insert, because the trigger is deferred. That is worth ' +
               'seeing once: the database let you write a half transaction and then refused to keep it.' }
        ],
        check: 'The insert is refused, and select count(*) from entries is unchanged afterwards.'
      },
      {
        t: 'Produce a double spend, then stop it',
        blocks: [
          { p: 'Two threads, one account, no lock. Run this and watch an account go negative that is not allowed to.' },
          { code: 'import threading\n\ndef spend(amount):\n    with connect() as c:\n        with c.transaction():\n            with c.cursor() as cur:\n                cur.execute(\n                    "select coalesce(sum(amount_cents), 0) from entries "\n                    "where account_id = (select id from accounts where name = \'alice\')"\n                )\n                balance = cur.fetchone()[0]\n                if balance < amount:\n                    raise ValueError("insufficient funds")\n                import time; time.sleep(0.2)          # widen the gap on purpose\n                cur.execute(\n                    "insert into transactions (memo) values (\'race\') returning id"\n                )\n                txn = cur.fetchone()[0]\n                cur.executemany(\n                    "insert into entries (transaction_id, account_id, amount_cents) "\n                    "select %s, id, %s from accounts where name = %s",\n                    [(txn, -amount, "alice"), (txn, amount, "bob")],\n                )\n\nts = [threading.Thread(target=spend, args=(40_000,)) for _ in range(2)]\n[t.start() for t in ts]\n[t.join() for t in ts]', lang: 'python' },
          { p: 'Now add the lock as the first statement of the transaction and run it again. The second thread stops at the ' +
               'lock, waits for the first to commit, reads the balance that actually exists, and refuses itself.' },
          { code: 'cur.execute("select id from accounts where name = \'alice\' for update")', lang: 'python' },
          { warn: 'Always take locks in a consistent order, usually by account id. Two transfers locking the same two ' +
                  'accounts in opposite orders deadlock, and Postgres resolves that by killing one of them.' }
        ],
        check: 'Without the lock the balance goes negative; with it, one transfer succeeds and the other raises insufficient funds.'
      },
      {
        t: 'Make the retry safe',
        blocks: [
          { code: 'def post_idempotent(conn, legs, memo, key):\n    try:\n        return post(conn, legs, memo, key=key)\n    except errors.UniqueViolation:\n        with conn.cursor() as cur:\n            cur.execute("select id from transactions where idempotency_key = %s", (key,))\n            return cur.fetchone()[0]', lang: 'python' },
          { p: 'Call it twice with the same key and count the rows. One transaction, one pair of entries, the same id back ' +
               'both times. That is the level 4 lesson with the gap closed.' }
        ],
        check: 'Two calls with one key give the same transaction id and leave exactly two entries behind.'
      },
      {
        t: 'Cache the balance and reconcile it',
        blocks: [
          { p: 'Add the column and the trigger from the knowledge section, then write the check that proves they agree. Run ' +
               'it after every test in your project.' },
          { code: 'def reconcile(conn):\n    """Returns a list of accounts whose cached balance disagrees with their entries."""\n    with conn.cursor() as cur:\n        cur.execute(\n            "select a.name, a.balance_cents, coalesce(sum(e.amount_cents), 0) "\n            "  from accounts a left join entries e on e.account_id = a.id "\n            " group by a.id having a.balance_cents <> coalesce(sum(e.amount_cents), 0)"\n        )\n        return cur.fetchall()\n\nassert reconcile(conn) == [], "the cached balance has drifted"', lang: 'python' },
          { tip: 'Also assert that the sum of every entry in the whole ledger is zero. Money is only ever moved, so the total ' +
                 'of a correct ledger is zero at every moment, and that single number catches most of what can go wrong.' }
        ],
        check: 'reconcile returns an empty list, and the global sum of amount_cents is 0.'
      }
    ]
  },

  glossary: [
    { t: 'ACID', d: 'Atomicity, consistency, isolation, durability: the four promises a database transaction makes.' },
    { t: 'Transaction (database)', d: 'A group of statements that commit together or not at all. Not the same word as a money transaction, which is why this level names the table carefully.' },
    { t: 'Entry (leg)', d: 'One row of one side of a money transaction: an account and a signed amount in minor units.' },
    { t: 'Constraint', d: 'A rule the database enforces itself, for every writer, rather than trusting the application.' },
    { t: 'Constraint trigger', d: 'A function the database runs on write. Deferred means it runs at commit, when all the rows of a transaction are present.' },
    { t: 'Isolation level', d: 'How much two concurrent transactions are allowed to see of each other. Postgres defaults to read committed.' },
    { t: 'Lost update', d: 'Two transactions read the same value, both decide on it, and the second overwrites the first. The classic double spend.' },
    { t: 'SELECT FOR UPDATE', d: 'Locks the rows it reads until the transaction ends, so another writer waits rather than reading stale data.' },
    { t: 'Serializable', d: 'The strictest isolation level: the result must match some order of running the transactions one at a time. Conflicts abort instead of waiting.' },
    { t: 'Deadlock', d: 'Two transactions each holding a lock the other wants. The database kills one, so lock order matters.' },
    { t: 'Unique index', d: 'A guarantee of at most one row per value. The correct way to make a write idempotent.' },
    { t: 'Reconciliation', d: 'A scheduled comparison of two numbers that must agree, such as a cached balance and the entries under it.' },
    { t: 'Append only', d: 'A table that is inserted into and never updated or deleted, enforced by permissions rather than by good intentions.' },
    { t: 'SQL injection', d: 'Treating a value as part of the statement. Prevented by parameters, never by escaping by hand.' }
  ],

  quiz: [
    { q: "What does atomicity guarantee for a two leg transfer?",
      options: [
        "The entries are written in the order you sent them",
        "Both entries are written or neither is",
        "No other transaction can read the account",
        "The transfer completes within one millisecond"
      ],
      answer: 1,
      why: "Atomicity is all or nothing. It says nothing about speed, visibility to others, or ordering, which are the other three letters and the isolation level." },

    { q: "Why can a CHECK constraint not enforce that the entries of a transaction sum to zero?",
      options: [
        "Because CHECK sees one row at a time and this is a rule about a group of rows",
        "Because CHECK only runs on update",
        "Because CHECK cannot use arithmetic",
        "Because the sum is not known until the transaction commits"
      ],
      answer: 0,
      why: "A CHECK is evaluated per row against that row. The balancing rule is about every entry sharing a transaction id, which needs a trigger that can run at commit." },

    { q: "What does `deferrable initially deferred` change about a constraint trigger?",
      options: [
        "It runs the trigger once at commit rather than after each row",
        "It makes the trigger optional",
        "It runs the trigger before the insert instead of after",
        "It disables the trigger inside transactions"
      ],
      answer: 0,
      why: "Without it the trigger fires after the first leg, when the transaction is deliberately unbalanced, and every transfer fails." },

    { q: "Two sessions read a balance of $100 and each spends $80 under read committed. What happens?",
      options: [
        "The second session reads $20 because the first is in progress",
        "The second session blocks until the first commits",
        "Both succeed and the account ends at minus $60",
        "Postgres aborts the second with a serialization failure"
      ],
      answer: 2,
      why: "Read committed gives each statement a consistent view and says nothing about a decision made between two statements. This is the lost update, and it is the default behaviour." },

    { q: "What does `select ... for update` do?",
      options: [
        "Takes an exclusive lock on the rows read until the transaction ends",
        "Upgrades the transaction to serializable",
        "Caches the rows for faster reads",
        "Marks rows as needing an update later"
      ],
      answer: 0,
      why: "The lock makes a second writer wait rather than act on a balance that is about to change. It serialises spending per account, which is the cost." },

    { q: "What must a caller be able to do before you choose serializable isolation over a row lock?",
      options: [
        "Disable all triggers",
        "Retry the transaction when it aborts",
        "Hold the connection open for longer",
        "Run inside a single process"
      ],
      answer: 1,
      why: "Serializable detects the conflict and aborts one side. Without a retry, one of your users just got an error instead of a payment, and a retry that is not idempotent double charges." },

    { q: "Why is a unique index the right way to make a write idempotent?",
      options: [
        "It is faster than a dictionary lookup",
        "It gives a better error message",
        "The check and the write are one operation, so two racing requests cannot both pass",
        "It compresses the key column"
      ],
      answer: 2,
      why: "Select then insert leaves a gap between the two statements wide enough for exactly the retry you are protecting against." },

    { q: "A transfer inserts the transaction row, then the process is killed before the commit. What is in the database?",
      options: [
        "The transaction row, with no entries",
        "Nothing from that transfer",
        "Whatever was flushed to disk at the time",
        "A locked row that must be cleaned up by hand"
      ],
      answer: 1,
      why: "Uncommitted work is rolled back when the connection dies. The visible difference between a crash before and after the commit is the caller's problem, not the database's." },

    { q: "Why store money as `bigint` in minor units rather than `numeric` or `float`?",
      options: [
        "Because bigint uses less storage than any alternative",
        "Because floats cannot represent most decimals exactly, and integers of cents cannot drift",
        "Because numeric cannot be summed",
        "Because bigint is the only type Postgres indexes"
      ],
      answer: 1,
      why: "numeric is exact too and is a defensible choice; float is not. Integer minor units keep the arithmetic exact and match what the payment rails send." },

    { q: "Why does this schema have no `balance` column at the start?",
      options: [
        "Because the balance belongs in the application cache",
        "Because balances change too often to store",
        "Because Postgres cannot sum a column quickly",
        "Because a stored balance is a second answer to a question the entries already answer"
      ],
      answer: 3,
      why: "Two sources of truth eventually disagree. You add the column when the sum is too slow, and you accept a reconciliation job on the same day." },

    { q: "What should the reconciliation query return on a healthy ledger?",
      options: [
        "Nothing",
        "The total balance",
        "One row per account",
        "Every transaction from the last day"
      ],
      answer: 0,
      why: "It selects accounts whose cached balance disagrees with their entries. A row means drift, and the job exists so that you find it rather than a customer." },

    { q: "Why run the application as a role with no UPDATE or DELETE on the entries table?",
      options: [
        "It makes inserts faster",
        "It reduces the size of the write ahead log",
        "Because Postgres requires separate roles for triggers",
        "Because append only is then a property of the system rather than a promise in a comment"
      ],
      answer: 3,
      why: "If the connection that posts entries can also rewrite them, the audit trail depends on everyone remembering not to. Permissions survive new colleagues." },

    { q: "Two transfers lock the same two accounts in opposite orders. What happens?",
      options: [
        "The locks merge into one",
        "Both wait forever",
        "The database detects a deadlock and aborts one of them",
        "Postgres escalates to a table lock"
      ],
      answer: 2,
      why: "Deadlock detection resolves it by killing a victim. Taking locks in a consistent order, usually by account id, means it does not happen." },

    { q: "What does `%s` do in a psycopg query?",
      options: [
        "Formats the value into the SQL string before sending it",
        "Marks the column as a string type",
        "Sends the value to the server separately from the statement",
        "Escapes quotes in the value"
      ],
      answer: 2,
      why: "The statement and the values travel separately, so a value can never become SQL. That is the whole of injection defence, and f-strings undo it." },

    { q: "Your ledger is correct but a balance query on a hot account has become slow. What is the first thing to check?",
      options: [
        "Whether the disk is full",
        "Whether to shard the table",
        "Whether to switch to serializable",
        "Whether there is an index on entries(account_id)"
      ],
      answer: 3,
      why: "Summing one account means finding its rows. Without the index that is a scan of every entry ever written, and the fix is one line before any of the interesting answers." }
  ],

  project: {
    title: 'The ledger service',
    story: 'The society is going to run a tab for its events: members top up, buy things, and get refunded, and nobody is ' +
           'going to accept "the spreadsheet says so". Build the ledger underneath it, in Postgres, so that two people ' +
           'spending at the same moment is a solved problem rather than a story.',
    scope: 'Uses this level plus level 4 (double entry, minor units, reversal) and level 9 (a project layout, a virtual ' +
           'environment, tests). Postgres, psycopg, pytest. No ORM and no web framework: level 12 puts an API in front of ' +
           'this, and mixing the two is how people end up unable to say which layer broke.',
    requirements: [
      'schema.sql that creates accounts, transactions and entries, with the foreign keys, the amount check, the unique idempotency key, and the index on entries(account_id)',
      'A deferred constraint trigger that refuses any transaction whose entries do not sum to zero',
      'A ledger module with open_account, post, transfer, reverse, balance and statement, taking a connection rather than making one',
      'transfer validates first and writes once: unknown account, zero or negative amount, and insufficient funds all raise before any row is written',
      'transfer takes an optional fee and writes it as a third leg to fee_income',
      'Every write is one database transaction, and a failure part way leaves nothing behind',
      'Idempotency by unique index: the same key twice returns the same transaction id and writes one set of entries',
      'Row locking so that two threads spending from one account cannot drive it negative, with the lock taken in account id order',
      'reverse posts a mirror transaction and never updates or deletes an entry',
      'reconcile() comparing every cached balance against its entries, plus an assertion that the whole ledger sums to zero',
      'A pytest suite including a concurrency test that fails without the lock and passes with it',
      'A README with the schema diagram in text, how to run it, and a limitations section',
      'The repository in your GitHub portfolio as finquest-ledger-service'
    ],
    starter: {
      lang: 'python',
      code: '"""FinQuest level 11: the ledger service.\n\nLayout:\n  schema.sql        the tables, constraints and triggers\n  ledger/db.py      connection and schema loading\n  ledger/core.py    open_account, post, transfer, reverse, balance, statement\n  ledger/audit.py   reconcile and the global sum\n  tests/            including test_concurrency.py\n"""\n\nimport os\nimport psycopg\nfrom psycopg import errors\n\n\ndef connect():\n    """A connection from DATABASE_URL. The caller owns the transaction."""\n    # TODO\n    pass\n\n\ndef apply_schema(conn, path="schema.sql"):\n    """Create the tables, constraints and triggers. Safe to run twice."""\n    # TODO\n    pass\n\n\ndef open_account(conn, name, kind="customer", allow_negative=False):\n    # TODO\n    pass\n\n\ndef post(conn, legs, memo, key=None):\n    """legs: [(account_name, signed_cents), ...]. One transaction, all or nothing."""\n    # TODO: validate the sum, insert the transaction row, insert every leg\n    pass\n\n\ndef transfer(conn, src, dst, amount_cents, memo="transfer", fee_cents=0, key=None):\n    """Validate everything, lock in account id order, then write once."""\n    # TODO\n    pass\n\n\ndef reverse(conn, transaction_id, memo=None):\n    """Post the mirror image. Never update, never delete."""\n    # TODO\n    pass\n\n\ndef balance(conn, account_name):\n    # TODO\n    pass\n\n\ndef statement(conn, account_name):\n    """Every entry for one account, oldest first, with a running balance."""\n    # TODO\n    pass\n\n\ndef reconcile(conn):\n    """Accounts whose cached balance disagrees with their entries. Empty is good."""\n    # TODO\n    pass\n\n\nif __name__ == "__main__":\n    with connect() as conn:\n        apply_schema(conn)\n        print("schema applied")\n'
    },
    tests: [
      'Applying the schema twice leaves the same tables and no error',
      'A transfer of 2,500 cents with a 50 cent fee writes three entries summing to zero',
      'An unbalanced insert is refused by the trigger at commit, and leaves no rows behind',
      'A transfer from an account with 1,000 cents for 2,000 cents raises before any row is written',
      'The same idempotency key twice returns one transaction id and leaves one set of entries',
      'Two threads each spending 40,000 cents from an account holding 50,000 end with exactly one success and one refusal',
      'Reversing a transfer returns both balances to their earlier values and leaves the original entries in place',
      'reconcile() is empty and the sum of every entry in the ledger is 0, after every test in the suite'
    ],
    rubric: [
      { pts: 25, t: 'Correct under concurrency', d: 'The double spend test fails with the lock removed and passes with it. Locks are taken in a consistent order.' },
      { pts: 20, t: 'The database enforces the rules', d: 'Balancing, non zero amounts, account existence and idempotency are constraints, not if statements.' },
      { pts: 20, t: 'Atomic writes', d: 'Every write path is one transaction. A failure part way through leaves nothing behind, and there is a test that proves it.' },
      { pts: 20, t: 'Auditability', d: 'Append only, reversal rather than deletion, a working reconciliation, and a statement anybody could read.' },
      { pts: 15, t: 'Shipped', d: 'Runs from a clean clone with docker run and pytest. The README explains the schema and says what the service does not do.' }
    ],
    stretch: [
      'Add a materialised balance with a trigger and prove with a test that it never disagrees with the entries',
      'Add multi currency: a currency column per account, and a rule that a transaction must balance within each currency',
      'Write the same double spend test against serializable isolation with a retry loop, and measure which is faster under contention',
      'Add a daily statement view in SQL rather than in Python'
    ],
    solutionPath: 'solutions/level-11'
  },

  faq: [
    { q: 'Docker will not run on my machine',
      a: 'Use a free Neon project instead: create one at neon.tech, copy the connection string into DATABASE_URL, and every step works unchanged. Postgres is Postgres.' },
    { q: 'psycopg or psycopg2?',
      a: 'psycopg version 3, installed as "psycopg[binary]". psycopg2 is the older one and most of the internet still talks about it; the API in this level is version 3.' },
    { q: 'My trigger fires on the first leg and every transfer fails',
      a: 'The trigger is not deferred. It needs to be a constraint trigger declared deferrable initially deferred, so it runs at commit when all the legs are present.' },
    { q: 'The concurrency test passes even without the lock',
      a: 'The two threads are not overlapping. Add a short sleep between reading the balance and writing the entry, which widens the gap the race needs. If it still passes, check that both threads have their own connection.' },
    { q: 'I get "current transaction is aborted, commands ignored until end of transaction block"',
      a: 'A statement failed earlier in the same transaction. Postgres refuses everything after that until you roll back. Use conn.transaction() blocks so the rollback happens for you.' },
    { q: 'Should I use an ORM?',
      a: 'Not here. The point of this level is what the database is doing, and an ORM is a layer over exactly that. Use one in a job, after you can say what it is generating.' },
    { q: 'How do I put the connection string in GitHub Actions later?',
      a: 'As a repository secret, read from the environment, never in the file. Level 5 covered the rule and level 20 covers the pipeline.' }
  ]
});
