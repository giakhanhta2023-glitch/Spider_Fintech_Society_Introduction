/* =========================================================================
   LEVEL 13: event sourcing
   ========================================================================= */
FQ.registerLevel({
  id: 13,
  codename: 'event log',
  title: 'The log is the truth, the balance is an opinion',
  tagline: 'Store what happened, not what is. Then rebuild every balance from zero and prove the two agree, which is the only way to answer "what did this account look like in March".',
  difficulty: 9,
  minutes: 240,
  tags: ['event sourcing', 'CQRS', 'projections', 'auditability'],
  summary: 'Banks, exchanges and every serious ledger keep an append only log of facts and derive the rest. This level ' +
           'builds that: events with a sequence per account, optimistic concurrency, projections you can throw away and ' +
           'rebuild, snapshots for speed, and the replay test that proves the derived state matches the log.',

  objectives: [
    'Tell an event from a command, and write events as facts in the past tense',
    'Append to a stream with an expected version, so two writers cannot interleave silently',
    'Build a projection by folding events, and rebuild it from zero on demand',
    'Answer a question about the past without keeping a copy of the past',
    'Add a field to an event type without breaking readers of the old ones',
    'Take a snapshot and say exactly what it is allowed to be used for',
    'Say when event sourcing is the wrong choice'
  ],

  knowledge: [
    { h: 'The row you keep overwriting is a lie about time' },
    { p: 'A balance column answers one question: what is it now. Every question a bank actually gets asked is about the ' +
         'past. What was this worth on the last day of March. Why did it change on the 14th. Who moved it, in what order, ' +
         'and what did the system believe at the time. A column that gets overwritten cannot answer any of them.' },
    { p: 'The level 11 entries table already pointed at the answer: it never changed a row, so the history was in there. ' +
         'Event sourcing takes that idea and applies it to everything, not only to money. You store the facts, and every ' +
         'piece of state in the system is something you compute from them.' },
    { table: {
      head: ['', 'State stored', 'Events stored'],
      rows: [
        ['What a row means', 'The current answer', 'Something that happened, at a time'],
        ['Fixing a mistake', 'Update the row and the old value is gone', 'Append a correcting event; both are visible'],
        ['"What was it in March?"', 'Nothing you can do', 'Fold the events up to March'],
        ['Adding a new report', 'Backfill from whatever survived', 'Replay the log into a new projection'],
        ['Cost', 'Cheap to read, cheap to be wrong', 'More machinery, and the past is always there']
      ]
    }},
    { check: {
      q: 'Your product manager asks for a chart of every customer\'s balance at the end of each of the last twelve months. ' +
         'With a balance column, what can you build, and with an event log, what do you run?',
      a: 'With a column, nothing truthful. You can chart today\'s balance twelve times, or guess by working backwards ' +
         'through whatever transaction history survived, which will not tie out. With a log you fold the events for each ' +
         'account up to each month end and read the number off, and it is exact, because it is the same arithmetic the ' +
         'live balance came from. That question is why banks do this, and it is asked far more often than anybody expects ' +
         'when they design the table.'
    }},

    { h: 'Commands ask, events state' },
    { p: 'A command is a request that can be refused: `TransferMoney`. An event is a fact that already happened and cannot ' +
         'be argued with: `MoneyTransferred`. The names matter because they keep the two kinds of thinking apart: you ' +
         'validate a command, and you never validate an event, because it is already true.' },
    { code: '# command: might be refused\n{"type": "TransferMoney", "from": "alice", "to": "bob", "amount_cents": 2500}\n\n# event: already happened, past tense, with everything a reader needs\n{"type": "MoneyTransferred", "version": 1, "stream": "account-alice",\n "seq": 42, "at": "2026-03-14T09:31:02Z",\n "data": {"to": "account-bob", "amount_cents": 2500, "memo": "coffee"}}', lang: 'json' },
    { ul: [
      '**Past tense, always.** `AccountOpened`, `MoneyDeposited`, `TransferReversed`. If you can name it in the future tense it is a command.',
      '**Self contained.** A reader in two years has your schema and nothing else, so put the amount in the event rather than a pointer to a row that may have moved on.',
      '**Immutable.** A wrong event is followed by a correcting one. It is never edited, because editing history is the one thing this design exists to prevent.'
    ]},
    { check: {
      q: 'A junior writes an event `{"type": "SetBalance", "balance_cents": 4200}`. Two things are wrong with it. What are ' +
         'they?',
      a: 'It is a command in the present tense, and it destroys the reason for the log. `SetBalance` says what the state ' +
         'should become rather than what happened, so anybody reading the log later can see the balance changed but not ' +
         'why, and cannot check it against anything. The events wanted here are the facts that moved it: `MoneyDeposited`, ' +
         '`FeeCharged`, `TransferReversed`. If the balance ever needs correcting, the event is `BalanceCorrected` with a ' +
         'reason and an amount, which is a fact about a correction rather than an instruction.'
    }},

    { h: 'One stream per account, one sequence per stream' },
    { p: 'Events go in a stream, usually one per thing that has a life: an account, a payment, a customer. Within a stream ' +
         'they are numbered from 1, and that number is what makes concurrency safe.' },
    { code: 'create table events (\n  id         bigserial primary key,     -- global order, for readers\n  stream     text        not null,    -- \'account-alice\'\n  seq        int         not null,    -- 1, 2, 3 within the stream\n  type       text        not null,\n  version    int         not null default 1,\n  data       jsonb       not null,\n  recorded_at timestamptz not null default now(),\n  unique (stream, seq)                 -- the whole concurrency story, in one line\n);', lang: 'sql' },
    { p: 'That unique constraint is doing the same job the unique index did in level 11. To append, you say which version ' +
         'of the stream you read: if somebody else appended in between, your insert collides and you lose, which is what ' +
         'you want.' },
    { code: 'def append(conn, stream, event_type, data, expected_seq):\n    """expected_seq is the seq you last read. Collide and the caller re-reads."""\n    with conn.cursor() as cur:\n        cur.execute(\n            "insert into events (stream, seq, type, data) values (%s, %s, %s, %s)",\n            (stream, expected_seq + 1, event_type, json.dumps(data)),\n        )', lang: 'python' },
    { p: 'This is **optimistic** concurrency: no locks, no waiting, and one of two racing writers gets a unique violation ' +
         'and retries from the new state. Level 11 took a lock instead, which is **pessimistic**. Both are correct, and the ' +
         'trade is the same one as before: locks make the loser wait, optimistic makes the loser retry.' },
    { check: {
      q: 'Two transfers read account-alice at seq 41 and both try to append seq 42. What happens, and what should the loser ' +
         'do that is different from simply trying again?',
      a: 'One insert succeeds and the other violates the unique constraint on (stream, seq). The loser must not retry the ' +
         'same append: it has to re-read the stream, which now ends at 42 with somebody else\'s withdrawal in it, redo the ' +
         'decision against that state, and only then append 43. Retrying blindly would write a transfer that was approved ' +
         'against a balance that no longer exists, which is the lost update from level 11 wearing a different hat.'
    }},

    { h: 'A projection is a fold' },
    { p: 'State is what you get by starting from nothing and applying every event in order. In Python that is one function ' +
         'and a loop, and the important property is that it is pure: the same events always produce the same state.' },
    { code: 'def apply(state, event):\n    kind, data = event["type"], event["data"]\n    if kind == "AccountOpened":\n        return {"balance_cents": 0, "opened_at": event["at"], "status": "open"}\n    if kind == "MoneyDeposited":\n        return state | {"balance_cents": state["balance_cents"] + data["amount_cents"]}\n    if kind == "MoneyTransferred":\n        return state | {"balance_cents": state["balance_cents"] - data["amount_cents"]}\n    if kind == "AccountFrozen":\n        return state | {"status": "frozen"}\n    return state                      # unknown types are skipped, not fatal\n\ndef project(events):\n    state = {}\n    for event in events:\n        state = apply(state, event)\n    return state', lang: 'python' },
    { p: 'Two things fall out of that shape for free. A **read model** is any projection you like: a balance table, a ' +
         'monthly statement, a report for the regulator, each one a different `apply`. And **time travel** is the same fold ' +
         'with a filter: stop at a date and you have the state on that date.' },
    { code: 'def balance_at(events, when):\n    return project([e for e in events if e["at"] <= when])["balance_cents"]', lang: 'python' },
    { money: 'Splitting writes from reads like this has a name, **CQRS**: commands go to the log, queries go to whatever ' +
             'projection answers them fastest. The name appears in job descriptions. The idea is the six lines above.' },

    { h: 'Replay is the test that matters' },
    { p: 'If the projection is a pure fold of the log, you can throw it away and rebuild it, and the rebuilt copy must match ' +
         'the one that has been running for months. That test catches the bug class this design exists to prevent: state ' +
         'that drifted from the facts.' },
    { code: 'def test_replay_matches_live(conn):\n    live = fetch_balances(conn)                  # the projection as it stands\n    rebuilt = {}\n    for event in stream_all_events(conn):         # in id order, from the beginning\n        rebuilt = apply_to_balances(rebuilt, event)\n    assert rebuilt == live', lang: 'python' },
    { p: 'When it fails, the log wins. The projection is the thing you rebuild, because the events are the record of what ' +
         'happened and the projection is only a convenient summary of them.' },
    { check: {
      q: 'You fix a bug in the fee calculation that has been wrong for three months. With state stored in a column you ' +
         'would write a migration. What do you do here, and what happens to the three months?',
      a: 'You fix `apply`, drop the projection and replay the log, and the three months are recomputed correctly because the ' +
         'events recorded what happened rather than what you concluded at the time. Nothing in the log changes, which is ' +
         'the point: the facts were always right and your reading of them was wrong. The one thing to be careful about is ' +
         'anything you already told the outside world, because replaying does not unsend a statement or a webhook.'
    }},

    { h: 'Events outlive the code that wrote them' },
    { p: 'An event written today will be read by code nobody has written yet, so the schema has to change without breaking ' +
         'old events. The rules are the same as the API contract in level 12, with a longer time horizon.' },
    { ul: [
      '**Adding an optional field is safe.** Old events lack it and readers default it.',
      '**Renaming or removing a field is not.** Bump `version` on the event type and keep handling the old one.',
      '**Never change what a field means.** A `amount_cents` that silently became major units in March is a bug you will find in a rounding report years later.'
    ]},
    { code: 'def upcast(event):\n    """Bring an old event up to the shape today\'s code expects."""\n    if event["type"] == "MoneyTransferred" and event["version"] == 1:\n        data = dict(event["data"], fee_cents=0)     # v2 added a fee, v1 had none\n        return dict(event, version=2, data=data)\n    return event', lang: 'python' },
    { warn: 'Upcast on read, never in the database. Rewriting stored events to a new shape is editing history, and it means ' +
            'you can no longer prove what the system was told at the time.' },

    { h: 'Snapshots, and their one job' },
    { p: 'Folding four million events to answer one balance is slow. A snapshot is the state at a sequence number, stored so ' +
         'you can start from there and apply only what came after.' },
    { code: 'create table snapshots (\n  stream text  primary key,\n  seq    int   not null,\n  state  jsonb not null,\n  taken_at timestamptz not null default now()\n);', lang: 'sql' },
    { code: 'def load(conn, stream):\n    snap = latest_snapshot(conn, stream)           # may be None\n    state, since = (snap["state"], snap["seq"]) if snap else ({}, 0)\n    for event in events_after(conn, stream, since):\n        state = apply(state, event)\n    return state', lang: 'python' },
    { p: 'A snapshot is a cache and nothing more. Delete every snapshot in the system and it must still answer every ' +
         'question correctly, only slower. That property is what you test, because a snapshot that is load bearing is a ' +
         'stored state that can drift, and you have just rebuilt the problem you started with.' },
    { check: {
      q: 'A colleague suggests taking a snapshot every hundred events and then deleting the events before it, to save ' +
         'space. What have they proposed?',
      a: 'They have proposed a balance column with extra steps. Once the events are gone you cannot replay, cannot rebuild a ' +
         'projection after a bug, cannot answer a question about the period you deleted, and cannot prove anything to an ' +
         'auditor. The log is the product; the snapshot is the cache. If space is the worry, the answers are compression, ' +
         'cheaper storage for old partitions, and a written retention policy that legal signs, not deletion by convenience.'
    }},

    { h: 'When not to do this' },
    { p: 'Event sourcing costs real complexity, and the honest version of this level says where it is not worth paying.' },
    { table: {
      head: ['Good fit', 'Bad fit'],
      rows: [
        ['The history is the product: ledgers, orders, trades', 'A settings page nobody audits'],
        ['Audit is a legal requirement', 'A cache or a search index'],
        ['You will want reports you have not thought of yet', 'The shape of the data is fixed and small'],
        ['Corrections must be visible, not silent', 'Data that must be deleted on request']
      ]
    }},
    { warn: 'That last cell is the serious one. Data protection law gives people a right to erasure, and an append only log ' +
            'is built to make erasure impossible. The usual answer is to keep personal data out of events entirely, ' +
            'referencing a customer by an opaque id and storing the person in a normal table you can delete from. Decide ' +
            'this before the first event, because afterwards it is a rewrite.' }
  ],

  tutorial: {
    intro: 'Postgres again, from level 11, and the same project layout from level 9. You will build an account service where ' +
           'nothing is ever updated, and then prove it by deleting every derived table and rebuilding them.',
    steps: [
      {
        t: 'The log table',
        blocks: [
          { p: 'One table, one unique constraint, one index for reading a stream in order.' },
          { code: 'create table events (\n  id          bigserial primary key,\n  stream      text        not null,\n  seq         int         not null,\n  type        text        not null,\n  version     int         not null default 1,\n  data        jsonb       not null,\n  recorded_at timestamptz not null default now(),\n  unique (stream, seq)\n);\n\ncreate index events_stream_idx on events (stream, seq);\n\nrevoke update, delete on events from app_user;   -- level 11\'s rule, again', lang: 'sql' }
        ],
        check: 'Inserting the same (stream, seq) twice raises a unique violation.'
      },
      {
        t: 'Append, with a version you expect',
        blocks: [
          { code: 'import json\nfrom psycopg import errors\n\nclass ConcurrencyError(Exception):\n    """Somebody appended to this stream after you read it."""\n\ndef append(conn, stream, event_type, data, expected_seq, version=1):\n    try:\n        with conn.cursor() as cur:\n            cur.execute(\n                "insert into events (stream, seq, type, version, data) "\n                "values (%s, %s, %s, %s, %s) returning id",\n                (stream, expected_seq + 1, event_type, version, json.dumps(data)),\n            )\n            return cur.fetchone()[0]\n    except errors.UniqueViolation as exc:\n        raise ConcurrencyError(f"{stream} moved past {expected_seq}") from exc\n\ndef read(conn, stream, after=0):\n    with conn.cursor() as cur:\n        cur.execute(\n            "select seq, type, version, data, recorded_at from events "\n            " where stream = %s and seq > %s order by seq",\n            (stream, after),\n        )\n        return cur.fetchall()', lang: 'python' },
          { p: 'Note what `append` does not do: it does not decide whether the transfer is allowed. That is the command ' +
               'handler\'s job, and keeping them apart is what makes the log trustworthy.' }
        ],
        check: 'Two appends with the same expected_seq: one succeeds, one raises ConcurrencyError.'
      },
      {
        t: 'A command handler that refuses',
        blocks: [
          { code: 'def withdraw(conn, stream, amount_cents, attempts=3):\n    for _ in range(attempts):\n        events = read(conn, stream)\n        state = project(events)\n        seq = events[-1][0] if events else 0\n\n        if state.get("status") != "open":\n            raise ValueError("account is not open")\n        if state["balance_cents"] < amount_cents:\n            raise ValueError("insufficient funds")\n\n        try:\n            return append(conn, stream, "MoneyWithdrawn",\n                          {"amount_cents": amount_cents}, expected_seq=seq)\n        except ConcurrencyError:\n            continue                  # somebody moved first: read again and redo the decision\n    raise ConcurrencyError("gave up after 3 attempts")', lang: 'python' },
          { p: 'Read the retry carefully. It goes back to the top and reads the stream again, so the balance check happens ' +
               'against the new state. A retry that jumped straight to `append` would be the lost update.' }
        ],
        check: 'Two threads withdrawing 80 from a balance of 100 leave exactly one success, one refusal, and two events at most.'
      },
      {
        t: 'Project, and travel in time',
        blocks: [
          { code: 'def project(rows):\n    state = {}\n    for seq, kind, version, data, at in rows:\n        state = apply(state, kind, version, data, at)\n    return state\n\ndef balance_at(conn, stream, when):\n    with conn.cursor() as cur:\n        cur.execute(\n            "select seq, type, version, data, recorded_at from events "\n            " where stream = %s and recorded_at <= %s order by seq",\n            (stream, when),\n        )\n        return project(cur.fetchall()).get("balance_cents", 0)', lang: 'python' },
          { p: 'Try it: deposit, transfer, deposit again, then ask for the balance as of a moment between the two deposits. ' +
               'No extra table, no history column, and the number is exact.' }
        ],
        check: 'balance_at returns the balance before the later events, and the same call with now() matches the live projection.'
      },
      {
        t: 'The read model',
        blocks: [
          { p: 'A projection that lives in a table so queries are fast. It is written by folding events and can always be ' +
               'thrown away.' },
          { code: 'create table balances (\n  stream        text primary key,\n  balance_cents bigint not null,\n  last_seq      int    not null\n);\n\n-- rebuild from zero: this must be safe to run at any time\ntruncate balances;', lang: 'sql' },
          { code: 'def rebuild_balances(conn):\n    with conn.cursor() as cur:\n        cur.execute("truncate balances")\n        cur.execute("select stream, seq, type, version, data, recorded_at "\n                    "  from events order by id")\n        totals = {}\n        for stream, seq, kind, version, data, at in cur.fetchall():\n            state = apply(totals.get(stream, {}), kind, version, data, at)\n            totals[stream] = state | {"last_seq": seq}\n        cur.executemany(\n            "insert into balances (stream, balance_cents, last_seq) values (%s, %s, %s)",\n            [(s, v["balance_cents"], v["last_seq"]) for s, v in totals.items()],\n        )\n    conn.commit()', lang: 'python' }
        ],
        check: 'Rebuilding the balances table produces exactly the rows it held before.'
      },
      {
        t: 'Handle an old event',
        blocks: [
          { p: 'Add a fee to `MoneyTransferred` and bump it to version 2. Every event already in the log is version 1 and ' +
               'must keep working, which is what the upcast is for.' },
          { code: 'def upcast(kind, version, data):\n    if kind == "MoneyTransferred" and version == 1:\n        return 2, dict(data, fee_cents=0)\n    return version, data', lang: 'python' },
          { tip: 'Write the test before the upcast: append a version 1 event, change the code, and assert the projection ' +
                 'still gives the same balance. That test is the one that stops a schema change quietly rewriting history.' }
        ],
        check: 'A version 1 event projects the same balance after version 2 ships.'
      },
      {
        t: 'Snapshot, then prove you do not need it',
        blocks: [
          { code: 'def snapshot(conn, stream):\n    rows = read(conn, stream)\n    state = project(rows)\n    seq = rows[-1][0]\n    with conn.cursor() as cur:\n        cur.execute(\n            "insert into snapshots (stream, seq, state) values (%s, %s, %s) "\n            "on conflict (stream) do update set seq = excluded.seq, "\n            "state = excluded.state, taken_at = now()",\n            (stream, seq, json.dumps(state)),\n        )\n    conn.commit()', lang: 'python' },
          { p: 'Then the test that keeps it honest: read a balance with the snapshot, delete every snapshot, read it again, ' +
               'and assert the two agree.' },
          { code: 'def test_snapshots_are_only_a_cache(conn):\n    snapshot(conn, "account-alice")\n    fast = load(conn, "account-alice")\n    conn.execute("truncate snapshots")\n    slow = load(conn, "account-alice")\n    assert fast == slow', lang: 'python' }
        ],
        check: 'The two loads agree, and the suite still passes with snapshots disabled entirely.'
      }
    ]
  },

  glossary: [
    { t: 'Event', d: 'A fact in the past tense that has already happened. Never edited, never deleted.' },
    { t: 'Command', d: 'A request that can be refused. Validated, and if accepted it produces one or more events.' },
    { t: 'Stream', d: 'The ordered events of one thing: an account, a payment, an order.' },
    { t: 'Sequence number', d: 'The position of an event within its stream, starting at 1, unique with the stream name.' },
    { t: 'Optimistic concurrency', d: 'Writing with the version you read. A collision means somebody moved first, so you read again and redo the decision.' },
    { t: 'Projection', d: 'State computed by folding events. Throwaway by design, because it can always be rebuilt.' },
    { t: 'Read model', d: 'A projection stored in a table so queries are fast. One log can feed many.' },
    { t: 'CQRS', d: 'Separating the write path from the read path: commands append events, queries read projections.' },
    { t: 'Replay', d: 'Rebuilding a projection from the beginning of the log, and the test that it matches the live one.' },
    { t: 'Upcasting', d: 'Converting an old event version to the shape current code expects, on read and never in storage.' },
    { t: 'Snapshot', d: 'State at a sequence number, kept to avoid folding from zero. A cache, never a source of truth.' },
    { t: 'Eventual consistency', d: 'A read model can be a moment behind the log. Fine for a report, not for a balance check inside a command.' },
    { t: 'Right to erasure', d: 'The legal right to have personal data deleted. The reason personal data does not go in an append only log.' }
  ],

  quiz: [
    { q: "Which of these is an event rather than a command?",
      options: [
        "SetBalance",
        "FreezeAccount",
        "MoneyDeposited",
        "TransferMoney"
      ],
      answer: 2,
      why: "Events are facts in the past tense. The other three are instructions, and an instruction can be refused, which means it is a command." },

    { q: "What makes the (stream, seq) unique constraint the whole concurrency story?",
      options: [
        "It sorts the events for reading",
        "It compresses the stream",
        "It lets two writers append at once",
        "Two writers who read the same version cannot both append the next one"
      ],
      answer: 3,
      why: "One insert wins and the other gets a unique violation, which is the signal to read again and redo the decision against the new state." },

    { q: "An append fails with ConcurrencyError. What must the caller do?",
      options: [
        "Increment the sequence and retry",
        "Fall back to a lock",
        "Re-read the stream, redo the decision, and append after the new last sequence",
        "Retry the same append immediately"
      ],
      answer: 2,
      why: "Retrying the same append writes a decision made against a state that no longer exists. That is the lost update in a new costume." },

    { q: "What is a projection?",
      options: [
        "State computed by folding events in order",
        "A forecast of future balances",
        "A database view over the snapshots",
        "A copy of the event table"
      ],
      answer: 0,
      why: "Same events, same order, same result. That purity is what makes rebuilding it from zero a meaningful test." },

    { q: "The replay test fails: the rebuilt balances differ from the live table. Which one do you trust?",
      options: [
        "The log, and you rebuild the projection",
        "Whichever is larger",
        "The live table, because it has been serving traffic",
        "Neither, until an auditor decides"
      ],
      answer: 0,
      why: "The events are the record of what happened. A projection is a summary of them, and a summary that disagrees with its source is simply wrong." },

    { q: "How do you answer \"what was this balance on 31 March\"?",
      options: [
        "Subtract this year's transactions from today's balance",
        "Fold the events up to that date",
        "Restore a database backup",
        "Keep a monthly balance table"
      ],
      answer: 1,
      why: "Time travel is the same fold with a filter, which is the single most useful thing an event log gives you." },

    { q: "You add a fee field to an event type. What keeps the events already in the log working?",
      options: [
        "A migration that rewrites the old events",
        "An upcast on read that fills the new field with a default",
        "Deleting events older than the change",
        "A second events table"
      ],
      answer: 1,
      why: "Upcast on read, never in storage. Rewriting stored events means you can no longer prove what the system was told at the time." },

    { q: "What is a snapshot allowed to be?",
      options: [
        "A backup of the read model",
        "A replacement for the events before it",
        "A cache that the system must work correctly without",
        "The source of truth for old periods"
      ],
      answer: 2,
      why: "Delete every snapshot and every answer must still be correct, only slower. A snapshot that is load bearing is a stored state that can drift." },

    { q: "A colleague proposes deleting events older than the latest snapshot to save space. What have they proposed?",
      options: [
        "A balance column with extra steps",
        "A faster replay",
        "Standard practice in event sourcing",
        "A reasonable retention policy"
      ],
      answer: 0,
      why: "You lose replay, rebuilds after a bug, questions about that period, and any proof for an auditor. Space is solved by compression and cheaper storage, not by deletion." },

    { q: "Why does personal data not belong inside events?",
      options: [
        "It makes the table large",
        "Because events must be under 1KB",
        "Because the log is append only, and erasure requests require deletion",
        "JSONB cannot hold unicode names"
      ],
      answer: 2,
      why: "Reference the person by an opaque id and keep them in a normal table you can delete from. Decide it before the first event, because afterwards it is a rewrite." },

    { q: "What does CQRS name?",
      options: [
        "Separating the write path from the read path",
        "A snapshotting strategy",
        "A message queue protocol",
        "A consistency level for distributed databases"
      ],
      answer: 0,
      why: "Commands append events, queries read projections. The name is in the job description; the idea is a handful of lines." },

    { q: "Which of these is the strongest reason to choose event sourcing?",
      options: [
        "It is faster than a normalised schema",
        "It avoids writing tests",
        "It removes the need for a database",
        "The history is the product, and corrections have to stay visible"
      ],
      answer: 3,
      why: "Ledgers, orders and trades are histories. A settings page is not, and paying this complexity for one is a bad trade." },

    { q: "Why should append not decide whether a transfer is allowed?",
      options: [
        "Because validation is slow",
        "Because the decision belongs to the command handler, and mixing them makes the log untrustworthy",
        "Because appends must be async",
        "Because the database cannot express the rule"
      ],
      answer: 1,
      why: "Events are facts. Validation lives in the handler that turns a command into an event, and keeping them apart is what lets a reader trust the log." },

    { q: "What is eventual consistency in this design?",
      options: [
        "Snapshots may be stale",
        "Events can arrive out of order",
        "Two projections may disagree forever",
        "A read model can be a moment behind the log"
      ],
      answer: 3,
      why: "Fine for a report, not for a balance check inside a command. A command reads its own stream, which is always current." },

    { q: "Level 11 took a row lock, this level uses a version number. What is the trade?",
      options: [
        "Version numbers require a single writer",
        "Locks make the loser wait, optimistic concurrency makes the loser retry",
        "Locks are always slower",
        "Locks work only in Postgres"
      ],
      answer: 1,
      why: "Pick the lock when the conflict is the normal case, and the version when it is rare, because a retry costs nothing if it almost never happens." }
  ],

  project: {
    title: 'The event sourced account service',
    story: 'The society\'s treasurer asks a question the level 11 ledger cannot answer: what did every member owe at the end ' +
           'of last term. Rebuild the account service so that the log is the record, every balance is derived, and any ' +
           'question about any past moment is one fold away.',
    scope: 'Uses this level plus level 11 (Postgres, transactions, unique constraints) and level 9 (tests, layout). No ' +
           'framework and no message broker: the point is that event sourcing is a table and a fold, and that you can see ' +
           'every part of it.',
    requirements: [
      'An events table with a unique (stream, seq), an index for reading a stream in order, and UPDATE and DELETE revoked from the application role',
      'append(conn, stream, type, data, expected_seq) raising ConcurrencyError on a collision, and never validating business rules',
      'Command handlers for open, deposit, withdraw, transfer and freeze, each validating against a freshly projected state and retrying on a collision',
      'A pure apply() and project() with no database access, so they can be tested with a list of dictionaries',
      'balance_at(stream, when) answering the balance at any past moment, with a test at three different times',
      'A balances read model with rebuild_balances() that truncates and folds the whole log',
      'A replay test asserting the rebuilt read model equals the live one',
      'Two versions of one event type, an upcast on read, and a test that a version 1 event still projects correctly',
      'Snapshots, plus a test that deleting every snapshot changes no answer',
      'A concurrency test: two threads withdrawing from one account leave exactly one success and a log with no gap in the sequence',
      'A README explaining the event types, the streams, and what is deliberately not in the events',
      'The repository in your GitHub portfolio as finquest-event-ledger'
    ],
    starter: {
      lang: 'python',
      code: '"""FinQuest level 13: the event sourced account service.\n\nLayout:\n  schema.sql          events, snapshots, balances\n  es/log.py           append, read, ConcurrencyError\n  es/events.py        the event types and the upcasts\n  es/projections.py   apply, project, balance_at, rebuild_balances\n  es/commands.py      open, deposit, withdraw, transfer, freeze\n  tests/\n"""\n\nimport json\n\n\nclass ConcurrencyError(Exception):\n    """Somebody appended to this stream after you read it."""\n\n\ndef append(conn, stream, event_type, data, expected_seq, version=1):\n    """Insert at expected_seq + 1. Raise ConcurrencyError if it is taken."""\n    # TODO\n    pass\n\n\ndef read(conn, stream, after=0):\n    """Events of one stream, in sequence order."""\n    # TODO\n    pass\n\n\ndef apply(state, kind, version, data, at):\n    """Pure: state in, state out. No database, no clock, no randomness."""\n    # TODO\n    pass\n\n\ndef project(rows):\n    # TODO\n    pass\n\n\ndef balance_at(conn, stream, when):\n    # TODO\n    pass\n\n\ndef rebuild_balances(conn):\n    """Truncate the read model and fold the entire log into it."""\n    # TODO\n    pass\n\n\ndef withdraw(conn, stream, amount_cents, attempts=3):\n    """Read, decide, append. On a collision, read again and decide again."""\n    # TODO\n    pass\n'
    },
    tests: [
      'Appending twice at the same expected_seq raises ConcurrencyError exactly once',
      'apply() and project() run on a plain list of dictionaries with no database',
      'A withdrawal larger than the balance raises before any event is appended',
      'balance_at returns the correct figure at three moments, including one before the account existed',
      'Rebuilding the balances table from the log reproduces it exactly',
      'A version 1 MoneyTransferred event projects the same balance after version 2 ships',
      'Deleting every snapshot changes no answer the service gives',
      'Two threads withdrawing 80 from 100 leave one success, one refusal, and no gap in the sequence numbers',
      'The application role cannot UPDATE or DELETE an event, proved by a test that expects the failure'
    ],
    rubric: [
      { pts: 25, t: 'The log is the truth', d: 'Nothing updates or deletes an event, corrections are events, and the replay test passes.' },
      { pts: 20, t: 'Concurrency handled', d: 'Optimistic append, and handlers that re-read and re-decide rather than retrying blindly.' },
      { pts: 20, t: 'Projections are pure', d: 'apply and project touch nothing but their arguments, and are tested without a database.' },
      { pts: 20, t: 'Time and versions', d: 'balance_at works at arbitrary moments, old event versions still project, and snapshots are provably only a cache.' },
      { pts: 15, t: 'Shipped', d: 'Runs from a clean clone, tests pass, and the README says what the events hold and what they deliberately do not.' }
    ],
    stretch: [
      'Add a second read model, a monthly statement per account, fed from the same log',
      'Add a projection worker that follows the log by id and updates the read model incrementally, with a test that a restart loses nothing',
      'Publish each new event to a level 12 webhook and make the delivery idempotent on the event id',
      'Measure how long a full replay takes at ten thousand, a hundred thousand and a million events, and write up when a snapshot starts to matter'
    ],
    solutionPath: 'solutions/level-13'
  },

  faq: [
    { q: 'Is this not just an audit table next to my normal tables?',
      a: 'An audit table is written after the fact and can disagree with the state. Here there is no state to disagree with: the events are the only stored truth and everything else is derived, which is why a replay is meaningful.' },
    { q: 'What if I need a balance inside a command?',
      a: 'Read the stream and project it. It is exact and current, because a stream is small. Read models are for queries, where being a moment behind is fine.' },
    { q: 'How big does a stream get before folding is too slow?',
      a: 'Measure it rather than guessing. Thousands of events fold in milliseconds. Snapshot when your own measurement says so, and keep the test that proves the snapshot is only a cache.' },
    { q: 'Do I need Kafka?',
      a: 'No. A table with a sequence is an event log, and it is transactional with the rest of your data, which a broker is not. Brokers matter when other systems need the stream, which is a different problem from storing it.' },
    { q: 'Where do I put the memo the user typed?',
      a: 'In the event, if it is part of what happened. Keep anything that identifies a person out of it and reference them by an opaque id, because the log cannot be deleted from.' },
    { q: 'My replay is slow because of a query per event',
      a: 'Read the whole log in id order once, in batches, and fold in memory. A replay should be one scan, not N queries.' },
    { q: 'Can two streams be updated in one transaction?',
      a: 'In Postgres, yes: append to both inside one transaction and they commit together. That is a genuine advantage of keeping the log in your database rather than in a broker.' }
  ]
});
