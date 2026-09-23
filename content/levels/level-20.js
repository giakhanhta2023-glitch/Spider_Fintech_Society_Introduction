/* =========================================================================
   LEVEL 20: the whiteboard, and the thing you hand over
   ========================================================================= */
FQ.registerLevel({
  id: 20,
  codename: 'shipped',
  title: 'The whiteboard, and the thing you hand over',
  tagline: 'The final round asks you to design a payments system in forty five minutes. You have built most of one. This level turns fifteen repositories into an answer, a platform, and a package somebody can hire from.',
  difficulty: 10,
  minutes: 900,
  tags: ['system design', 'capacity', 'capstone', 'portfolio'],
  summary: 'The end. Capacity arithmetic you can do out loud, six payment designs written up properly, the numbers you ' +
           'carry into the room (which are your own measurements from this course), and then the capstone: the whole ' +
           'platform assembled, load tested, documented, and packaged so that a hiring manager opening one link can see ' +
           'what you can do in ninety seconds.',

  objectives: [
    'Run a system design conversation instead of waiting to be asked things',
    'Do capacity arithmetic out loud without a calculator',
    'Design six canonical payment systems and name the trap in each',
    'Defend a data model before drawing any boxes',
    'Assemble your work into one running platform and load test it',
    'Build a package a hiring manager can read in ninety seconds'
  ],

  knowledge: [
    { h: 'What the round actually is' },
    { p: 'Forty five to sixty minutes, a vague prompt, and a person watching how you think. The prompt is deliberately ' +
         'underspecified, because the first thing being assessed is whether you ask. The shape that works:' },
    { table: {
      head: ['Phase', 'Minutes', 'What you do'],
      rows: [
        ['**Requirements**', '5 to 8', 'Ask what it must do, for whom, at what scale, and what it must never do'],
        ['**Estimation**', '3 to 5', 'Traffic, storage, peak. Out loud, with round numbers'],
        ['**The data model**', '5', 'Tables and keys, before any boxes. Almost nobody does this, and it is the strongest move available'],
        ['**High level design**', '10 to 15', 'Boxes, arrows, what each one owns'],
        ['**Deep dive**', '15', 'They pick something and press. Usually consistency, failure or scale'],
        ['**Wrap up**', '2', 'What you would build first, and what you knowingly left out']
      ]
    }},
    { p: 'The most common failure is starting at the boxes. A candidate who begins "we would have an API gateway, a ' +
         'service, a queue and a database" has drawn something generic and has said nothing about payments. A candidate ' +
         'who begins "before I draw anything, can a payment be retried, and is the customer waiting for the answer?" has ' +
         'already demonstrated more than the rest of the hour usually does.' },
    { money: 'Your advantage in this round is specific rather than general. Everybody has read about idempotency. You ' +
             'measured that 13% of payouts ended inconsistent without compensation, that 3.50% of events were delivered ' +
             'twice with an outbox, and that a default histogram bucket set reported a p99 that was wrong by 49%. Bring ' +
             'one of those numbers into the room and the conversation changes.' },

    { h: 'Estimation, out loud' },
    { p: 'Four numbers to memorise, and everything else is multiplication:' },
    { code: 'seconds in a day        86,400          (call it 100,000 and adjust)\nseconds in a month       2,600,000\npeak to average          3x to 5x for consumer payments\nrows a Postgres index\n  lookup costs            microseconds, not milliseconds (level 6)', lang: 'text' },
    { p: 'Now a worked example, the kind you say aloud while writing on the board. "A mid sized payments company, 50 ' +
         'payments a second on average, peaking at 200."' },
    { code: 'traffic    50 x 86,400          = 4.32 million payments a day\n                                 = 130 million a month\npeak       200 a second, so size compute for 200 and average for cost\n\nstorage    payment row            500 bytes\n           two ledger entries      400 bytes\n           events and audit        600 bytes\n           ------------------------------------\n           per payment           1,500 bytes\n           130 M x 1.5 kB       = 195 GB a month  =  2.3 TB a year\n\nreads      roughly 10 per write (dashboards, support, retries)\n                                 = 500 a second average, 2,000 at peak', lang: 'text' },
    { p: 'Three conclusions fall straight out of those numbers, and saying them is the point of having done the ' +
         'arithmetic: **2.3 TB a year fits on one Postgres**, so this is not a sharding problem and anybody who starts ' +
         'sharding has misread the question. **Reads outnumber writes ten to one**, so replicas and caching matter more ' +
         'than write throughput. And **peak is four times average**, so the compute bill is mostly insurance, which is ' +
         'the level 17 cost conversation.' },
    { tip: 'Round aggressively and say that you are. "Call it a hundred thousand seconds in a day" is what a working ' +
           'engineer does, and the interviewer will not care about the 15% as long as you said you rounded. Reaching for ' +
           'a calculator, or getting lost in precision, both read badly.' },

    { h: 'The data model first' },
    { p: 'Before boxes, put the tables on the board. It forces every important question into the open: what is unique, ' +
         'what is immutable, what the states are, and what you will need to query.' },
    { code: 'payments(id, merchant_id, amount_minor, currency, state, idempotency_key,\n         created_at)\n         unique (merchant_id, idempotency_key)      <- level 7\n\nledger_entries(id, transaction_id, account_id, direction, amount_minor,\n         created_at)\n         append only, never updated                 <- level 4\n         sum(debits) = sum(credits) per transaction\n\ncard_events(id, payment_id, type, at, network_ref)\n         the state machine lives here               <- level 9\n\noutbox(id, aggregate_id, payload, published_at)\n         written in the business transaction        <- level 11\n\npayouts(id, our_ref unique, state, updated_at)\n         partial index on unfinished                <- level 12', lang: 'text' },
    { p: 'Five tables, five earlier levels, and every one of them answers a question the interviewer was going to ask. ' +
         'The unique constraint is your idempotency answer. The append only entries are your audit answer. The outbox is ' +
         'your "how do other services find out" answer. Putting them up front means the deep dive starts from something ' +
         'concrete rather than from a box labelled "payment service".' },

    { h: 'Six designs worth having ready' },
    { p: 'Nearly every payments system design question is one of these. For each, the decisions that matter and the ' +
         'mistake that gets made:' },
    { table: {
      head: ['Design', 'The decisions', 'The trap'],
      rows: [
        ['**A payment API**', 'Idempotency keys, a versioned contract, synchronous authorisation and asynchronous everything else, webhooks with signatures and retries', 'Making the whole flow synchronous, so a slow bank becomes your outage'],
        ['**A ledger at scale**', 'Double entry, append only, balances as a projection, partitioning by time, a daily proof that it balances', 'A mutable balance column, which loses the history and races under concurrency'],
        ['**Reconciliation**', 'Ingest the file, match on reference then on amount and date, classify breaks, an exception queue with owners', 'Treating a break as an error rather than a normal daily quantity that needs a workflow'],
        ['**Card authorisation**', 'A hard latency budget, cached limits and rules, fail closed or open as a business decision, no synchronous dependency you do not control', 'A fraud check with no timeout, which turns a slow model into declined payments'],
        ['**Payouts**', 'A saga with compensation, an explicit unknown state, a sweeper, our own reference on every request', 'Retrying a timeout, which pays twice, or compensating it, which cancels a real payment'],
        ['**Fraud and velocity**', 'Counters in Redis with sliding windows, the rules in configuration rather than in code, a shadow mode before enforcing', 'Putting the counter in Postgres and discovering it is your hottest row']
      ]
    }},
    { p: 'For each of the six you should be able to draw it in three minutes, name where the money can be lost, and say ' +
         'what you would monitor. That last part is unusual and it lands: "I would alert on payouts in a non final state ' +
         'for more than fifteen minutes, because that is the one that silently keeps money" is a sentence from somebody ' +
         'who has run something.' },
    { check: {
      q: 'The prompt is "design a payment system". Before drawing anything, what five questions would you ask, and why ' +
         'those five?',
      a: 'First, who is paying whom, because a consumer paying a merchant, a merchant being paid out and a business ' +
         'moving its own money are three different systems. Second, is the payer waiting for the answer, because that ' +
         'sets your latency budget and decides what can be asynchronous. Third, what volume and what peak, because the ' +
         'answer decides whether this is one Postgres or a much harder problem, and the arithmetic usually says one ' +
         'Postgres. Fourth, what happens on a duplicate request, which is an idempotency question dressed as a product ' +
         'question and tells you whether they are testing the thing most candidates get wrong. Fifth, what must never ' +
         'happen, because in payments the answer is normally "we must never pay twice" and that single sentence dictates ' +
         'the retry policy, the reference scheme and the recovery design. Those five fix the shape of everything you ' +
         'would draw, and asking them takes ninety seconds.'
    }},

    { h: 'The deep dive, and what they press on' },
    { p: 'Fifteen minutes on one thing. It is almost always one of five, and you have built all five:' },
    { table: {
      head: ['"What happens if..."', 'Your answer comes from'],
      rows: [
        ['...the same request arrives twice?', 'Level 7: a unique idempotency key, the stored response, and the 409 on a conflicting body'],
        ['...two requests hit the same balance at once?', 'Level 8: row locks, or an optimistic version, and the race you reproduced'],
        ['...the bank never answers?', 'Level 12: an explicit unknown state, a sweeper, and never retrying blindly'],
        ['...this table reaches a billion rows?', 'Level 13: partitioning by time, retention by dropping partitions, and an online migration'],
        ['...you need to change a column with no downtime?', 'Level 13: expand and contract, six deploys, a batched backfill and a verification query']
      ]
    }},
    { p: 'Two habits make this phase go well. **Say the failure mode before they ask**: "the risk here is that the ' +
         'publish succeeds and the transaction rolls back, so I would use an outbox" invites a better conversation than ' +
         'waiting to be caught. And **give a number when you have one**, because "we measured 20 of 400 events lost at a ' +
         '5% crash rate with a dual write" is not something a candidate usually has.' },

    { h: 'Trade-offs, in the words people use' },
    { table: {
      head: ['Choice', 'Take this when', 'Cost'],
      rows: [
        ['Strong consistency', 'Money moves, limits are checked, idempotency is decided', 'Latency, and coordination'],
        ['Eventual consistency', 'Dashboards, search, analytics, notifications', 'Somebody sees stale data and files a bug'],
        ['Synchronous', 'The caller cannot continue without the answer', 'Their outage becomes yours'],
        ['Asynchronous', 'The work can finish later', 'Ordering, duplicates, and a queue to operate'],
        ['SQL', 'Transactions, constraints and joins matter, which for money is always', 'One machine\'s worth of writes, for a long time'],
        ['NoSQL', 'One access pattern, enormous scale, no cross row invariants', 'You implement the invariants yourself, badly']
      ]
    }},
    { p: 'On the last row, be direct in the room: **a ledger goes in a relational database.** The invariant that debits ' +
         'equal credits is a constraint you want the database to enforce, and giving that up to gain write throughput ' +
         'you do not need is the wrong trade. Saying so clearly, with the storage arithmetic behind it, is a better ' +
         'answer than listing both options politely.' },
    { p: 'And the phrase that improves almost any answer: **"it depends on..."** followed by the specific thing it ' +
         'depends on. "It depends on whether the payer is waiting" is a real answer. "It depends" on its own is not.' },

    { h: 'The capstone' },
    { p: 'One repository that runs everything you have built, with one command, against generated traffic. Not new code: ' +
         'assembly, and the documents that make it legible.' },
    { code: 'docker compose up\n\n  gateway        the level 7 API, idempotent, versioned\n  ledger         level 4 and 6, double entry, constrained, indexed\n  cards          level 9, the lifecycle state machine\n  payouts        level 12, saga, sweeper, stuck detection\n  events         level 11, outbox, consumers, replay\n  recon          level 10, the daily job and the exception queue\n  vault          level 15, tokens, envelope encryption\n  observability  level 16, metrics, traces, SLOs, burn rate alerts\n  loadgen        level 14, open loop, and the report', lang: 'text' },
    { p: 'Then run it hard, for an hour, while breaking things, and write down what happened:' },
    { ul: [
      '**A sustained load test** at a stated rate, with p50, p99 and goodput, warmed up, and the utilisation you can hold while meeting your objective.',
      '**A chaos run**: kill a service, slow the bank, fill the queue, expire a credential. For each, what fired, how long detection took, and whether any money was lost.',
      '**A daily reconciliation** across the whole platform that comes out at zero, which is the single best evidence that the pieces agree.',
      '**A migration under load**, from level 13, with zero failed requests.'
    ]},
    { p: 'That set of results is the capstone. Any one of them is a better interview answer than a description of the ' +
         'architecture, because each one is something that either happened or did not.' },

    { h: 'The package somebody hires from' },
    { p: 'A hiring manager gives your application about ninety seconds. Build for that, honestly:' },
    { table: {
      head: ['Artefact', 'What it must do in ninety seconds'],
      rows: [
        ['One landing README', 'Say what the platform is, show the architecture diagram, and list five measured results'],
        ['A two minute video', 'Start it, send traffic, break something, show the alert firing. No slides'],
        ['An architecture document', 'Every service, what it owns, what it depends on, and the three decisions you would defend'],
        ['A CV with numbers', '"Reduced inconsistent payouts from 13% to 0% with a saga and a sweeper", not "familiar with distributed systems"'],
        ['Fifteen repositories', 'Each with a README that leads with the measurement rather than the technology']
      ]
    }},
    { p: 'The rule that makes all of it work: **lead with what you measured, not what you used.** "Built a payments API ' +
         'with FastAPI and Postgres" is a sentence about tools that says nothing about you. "Reproduced a lost update ' +
         'under concurrent captures, fixed it three ways, and measured each: row locks, optimistic version, serialisable ' +
         'isolation" describes an engineer.' },
    { warn: 'Every number in the package must be one you can reproduce on the spot, because somebody will ask. If you ' +
            'cannot rerun it in front of them, take it out. A single number you cannot defend undoes all the others.' },
    { check: {
      q: 'You have fifteen repositories and a hiring manager will look at one. Which do you point at, and what goes in ' +
         'the first three lines of its README?',
      a: 'Point at the capstone, because it is the only one that shows the pieces working together, and because the ' +
         'chaos run and the reconciliation coming out at zero are results rather than descriptions. The first three ' +
         'lines are the architecture diagram, one sentence saying what the platform does, and the five measured ' +
         'results, in that order. No installation instructions, no technology list and no paragraph about your ' +
         'motivation, because none of those survive ninety seconds. If a single repository is a better fit for a ' +
         'specific role, point at that one instead: the payouts saga for a payments infrastructure team, the ' +
         'reconciliation for an operations heavy one, the latency lab for a team that advertises high volume. Matching ' +
         'the repository to the job description takes two minutes and is the highest return thing you can do with them.'
    }},

    { h: 'What you actually have now' },
    { p: 'This track started at level 5 with a money type. The list, said plainly, because you should be able to say it:' },
    { p: 'A money library with exact arithmetic and property tests. A double entry ledger with constraints, indexes and ' +
         'query plans you can read. A payments API with idempotency, versioning and pagination. A reproduced lost update ' +
         'and three measured fixes. A card lifecycle with a real state machine. A reconciliation that finds planted ' +
         'breaks. An outbox with idempotent consumers and a replay. A payout saga with compensation and a sweeper that ' +
         'takes inconsistency to zero. A partitioned schema migrated under live traffic. A latency lab with a cache, a ' +
         'limiter, a breaker and load shedding. A card vault with envelope encryption and a rotation that rewrites no ' +
         'rows. Metrics, traces, SLOs and burn rate alerts that page for symptoms. A deploy you can undo, with a cost ' +
         'per payment. The same service on the JVM. And forty problems with an honest log.' },
    { p: 'That is more production payments engineering than most people have after two years in the job. **Go and apply ' +
         'before you feel ready**, because the feeling arrives some time after the evidence does, and you now have the ' +
         'evidence.' }
  ],

  tutorial: {
    intro: 'Two weeks. One week assembling and running the platform, one week on the six designs and the package. Work ' +
           'in a repository called `payments-platform-capstone`.',
    steps: [
      {
        t: 'One command, everything up',
        blocks: [
          { p: 'A compose file that starts every service, a shared network, one Postgres with a schema per service, one ' +
               'Redis, one Kafka or Redpanda, and the observability stack from level 16. Then a script that seeds a ' +
               'merchant and sends one payment end to end.' },
          { warn: 'If a service needs code changes to run alongside the others, that is the exercise, not an ' +
                  'inconvenience. Hard coded ports, hard coded database names and a configuration that only works on ' +
                  'your laptop are exactly what level 17 was about.' }
        ],
        check: 'A fresh clone, one command, and a payment flows from the API to the ledger, the events and the payout.'
      },
      {
        t: 'Load it properly',
        blocks: [
          { p: 'The open loop generator from level 14 against the whole platform, warmed up, for an hour. Report p50, ' +
               'p99 and goodput, and find the utilisation at which you stop meeting your SLO.' },
          { code: 'sustained    120 payments per second for 60 minutes\np50          ...\np99          ...   against an objective of ...\ngoodput      ...\nbudget spent ...% of the monthly error budget in one hour', lang: 'text' },
          { p: 'That last line is worth computing. An hour of load test that spends a third of your monthly error ' +
               'budget tells you the objective is wrong, or the system is.' }
        ],
        check: 'An hour long run with percentiles, goodput, and the utilisation where the objective breaks.'
      },
      {
        t: 'Break it on purpose',
        blocks: [
          { p: 'Four failures, one at a time, under load. For each: what fired, how long until you knew, how long until ' +
               'it recovered, and whether any money was lost or duplicated.' },
          { code: '1. kill the ledger database for 60 seconds\n2. make the bank simulator take 5 seconds, then time out\n3. stop the outbox publisher for 10 minutes\n4. revoke the vault credential', lang: 'text' },
          { p: 'The result you want is that every one of them ends with the reconciliation at zero. The result you will ' +
               'probably get first is that one of them does not, and finding out which is the entire value of the ' +
               'exercise.' }
        ],
        check: 'After every injected failure, the daily reconciliation comes out at zero breaks.'
      },
      {
        t: 'Migrate while it runs',
        blocks: [
          { p: 'The level 13 expand and contract, performed on the live platform while the load generator runs. Zero ' +
               'failed requests is the requirement; a latency bump is fine and should be reported.' }
        ],
        check: 'A full schema change completes under load with no failed requests.'
      },
      {
        t: 'Write the architecture document',
        blocks: [
          { p: 'One diagram and one table: every service, what data it owns, what it depends on, and what happens when ' +
               'that dependency is unavailable. Then three decisions you would defend, each with the alternative you ' +
               'rejected and why.' },
          { tip: 'Write the decisions as short records: context, options, decision, consequences. Four paragraphs each. ' +
                 'It is the format most companies use, and having written some already is a small, real advantage.' }
        ],
        check: 'Somebody who has never seen the code can draw the system from your document.'
      },
      {
        t: 'The six designs',
        blocks: [
          { p: 'Write each of the six up as a one page design: requirements, estimation, data model, diagram, failure ' +
               'modes, what you would monitor. Then practise saying each one in eight minutes, out loud, to a person.' },
          { p: 'Use your own measurements wherever they fit, because that is the part nobody else has.' }
        ],
        check: 'You can present any of the six from memory in under ten minutes, including the numbers.'
      },
      {
        t: 'Two minutes of video',
        blocks: [
          { p: 'Screen recording, no slides, no introduction. Start the platform, send traffic, open the dashboard, kill ' +
               'a service, show the alert firing, show the reconciliation at zero. Stop.' },
          { p: 'Rerecord it until it is under two minutes. The discipline of cutting is what makes it watchable, and a ' +
               'watchable two minutes gets opened far more often than a repository does.' }
        ],
        check: 'Somebody who does not know the project understands what it does, from the video alone, in two minutes.'
      },
      {
        t: 'The package, and then apply',
        blocks: [
          { p: 'The landing README with five measured results. The CV rewritten so every line has a number. Each ' +
               'repository README rewritten to lead with its measurement. Then pick fifteen companies, match a ' +
               'repository to each job description, and send them.' },
          { code: 'Reduced inconsistent payouts from 13.0% to 0% with a saga and a recovery sweeper\nCut monthly retention work from a 47 ms delete to a 0.9 ms partition drop\nFound a 49% error in reported p99 caused by default histogram buckets\nReproduced a lost update under concurrency and fixed it three ways, measured\nBuilt a card vault that took systems holding card numbers from seven to one', lang: 'text' },
          { p: 'Those five lines are a CV that gets read. Every one of them is something you did and can rerun in front ' +
               'of somebody.' }
        ],
        check: 'Fifteen applications sent, each pointing at the repository that matches the role.'
      }
    ]
  },

  glossary: [
    { t: 'Capacity estimation', d: 'Traffic, storage and peak, computed out loud with round numbers.' },
    { t: 'Peak to average ratio', d: 'How much bigger the busiest second is than the typical one. Usually 3x to 5x.' },
    { t: 'Data model first', d: 'Putting tables and keys on the board before boxes. The strongest opening available.' },
    { t: 'Deep dive', d: 'The fifteen minutes where one part of your design is pressed on.' },
    { t: 'Fail closed', d: 'On a dependency failure, decline. Safer for money, worse for conversion.' },
    { t: 'Fail open', d: 'On a dependency failure, allow. A business decision, never a default.' },
    { t: 'Shadow mode', d: 'Running new rules and recording what they would have done, without acting on it.' },
    { t: 'Architecture decision record', d: 'Context, options, decision, consequences. Four paragraphs.' },
    { t: 'Chaos run', d: 'Injecting failures under load and recording detection and recovery.' },
    { t: 'Capstone', d: 'The assembly of everything, running, measured, and documented.' }
  ],

  quiz: [
    { q: "What is the most common way to lose a system design round in the first five minutes?",
      options: [
        "Drawing boxes immediately instead of asking what the system must do and must never do",
        "Choosing the wrong database",
        "Getting the arithmetic wrong",
        "Talking too much about failure"
      ],
      answer: 0,
      why: "The prompt is vague on purpose. The first thing being assessed is whether you ask." },

    { q: "50 payments a second on average. How many a month, roughly?",
      options: [
        "4.3 million",
        "1.3 billion",
        "130 million",
        "13 million"
      ],
      answer: 2,
      why: "50 x 86,400 = 4.32 million a day, times 30. Round numbers said aloud beat a calculator." },

    { q: "130 million payments a month at about 1.5 kB each. What does that tell you?",
      options: [
        "That storage will dominate the cost",
        "About 195 GB a month and 2.3 TB a year, which fits on one Postgres, so this is not a sharding problem",
        "That you need a NoSQL store",
        "That you need to shard immediately"
      ],
      answer: 1,
      why: "Doing the arithmetic stops you solving a problem the question does not have." },

    { q: "Reads outnumber writes about ten to one in a payments system. What follows?",
      options: [
        "You should denormalise everything",
        "Write throughput is the constraint",
        "Replicas and caching matter more than write scaling, with the level 13 rule about which reads may go to a replica",
        "The database should be NoSQL"
      ],
      answer: 2,
      why: "And anything deciding money still reads from the primary." },

    { q: "Why put the data model on the board before the boxes?",
      options: [
        "To avoid discussing services",
        "Because it forces uniqueness, immutability, states and query patterns into the open, and almost no candidate does it",
        "It is faster to draw",
        "Because interviewers ask for it"
      ],
      answer: 1,
      why: "The unique constraint is your idempotency answer and the append only table is your audit answer, before anybody asks." },

    { q: "What is the trap when designing a ledger?",
      options: [
        "Partitioning by time",
        "Using double entry",
        "A mutable balance column, which loses the history and races under concurrency",
        "Storing amounts in minor units"
      ],
      answer: 2,
      why: "Balances are a projection of entries, which is levels 4 and 8 in one sentence." },

    { q: "What is the trap when designing card authorisation?",
      options: [
        "Using a state machine",
        "A synchronous fraud check with no timeout, which turns a slow model into declined payments",
        "Failing closed",
        "Caching the limits"
      ],
      answer: 1,
      why: "Every outbound call gets a timeout shorter than your caller's, and failing open or closed is a business decision." },

    { q: "Where do velocity counters belong, and why?",
      options: [
        "In Postgres, for durability",
        "In the application's memory",
        "In the event log",
        "In Redis with sliding windows, because a counter in Postgres becomes your hottest row"
      ],
      answer: 3,
      why: "And the rules live in configuration, run in shadow mode first, and only then enforce." },

    { q: "The interviewer asks what happens if the bank never answers. Your answer comes from which level?",
      options: [
        "Level 7: idempotency keys",
        "Level 16: alerting",
        "Level 13: partitioning",
        "Level 12: an explicit unknown state, a sweeper, and never retrying or compensating blindly"
      ],
      answer: 3,
      why: "Retrying pays twice and compensating cancels a real payment. Uncertainty needs its own mechanism." },

    { q: "What improves nearly any trade-off answer?",
      options: [
        "Saying \"it depends on...\" and naming the specific thing it depends on",
        "Listing both options neutrally",
        "Saying \"it depends\"",
        "Choosing the more scalable option"
      ],
      answer: 0,
      why: "\"It depends on whether the payer is waiting\" is an answer. \"It depends\" is not." },

    { q: "Should a ledger go in a relational database?",
      options: [
        "Only for small volumes",
        "It makes no difference",
        "No, because it will not scale",
        "Yes, because the invariant that debits equal credits is a constraint you want enforced, and the storage arithmetic says one machine is enough"
      ],
      answer: 3,
      why: "Giving up constraints to gain write throughput you do not need is the wrong trade, and saying so plainly is a better answer than listing both." },

    { q: "What single result is the strongest evidence that a multi service platform is correct?",
      options: [
        "A daily reconciliation across every service that comes out at zero, including after injected failures",
        "A clean architecture diagram",
        "All tests passing",
        "A load test meeting its objective"
      ],
      answer: 0,
      why: "It is the one check that requires every piece to agree with every other piece." },

    { q: "What should the first three lines of your capstone README contain?",
      options: [
        "The technology list",
        "The architecture diagram, one sentence on what it does, and five measured results",
        "Installation instructions",
        "Your motivation for building it"
      ],
      answer: 1,
      why: "A hiring manager gives it about ninety seconds. Build for that honestly." },

    { q: "Which CV line is stronger?",
      options: [
        "\"Reduced inconsistent payouts from 13.0% to 0% with a saga and a recovery sweeper\"",
        "\"Built a payments API with FastAPI and Postgres\"",
        "\"Experienced with Docker, Kubernetes and CI/CD\"",
        "\"Familiar with distributed systems and event driven architecture\""
      ],
      answer: 0,
      why: "Lead with what you measured, not what you used. The others are sentences about tools." },

    { q: "What is the rule about numbers in your package?",
      options: [
        "Cite the tool that produced them",
        "Round them for readability",
        "Every one must be reproducible on the spot, because a single number you cannot defend undoes all the others",
        "Include only the impressive ones"
      ],
      answer: 2,
      why: "If you cannot rerun it in front of them, take it out." }
  ],

  project: {
    title: 'payments-platform-capstone: all of it, running, measured, and packaged',
    story: 'One repository that starts the whole platform with a single command, takes an hour of real load, survives ' +
           'four injected failures with the reconciliation still at zero, performs a schema migration without dropping ' +
           'a request, and hands a stranger enough to decide to interview you in ninety seconds.',
    scope: 'Assembly and evidence rather than new features. Anything that has to change to make the services run ' +
           'together is part of the exercise, and the documents count as much as the code.',
    requirements: [
      'One compose file starting every service, with the observability stack, on a fresh clone',
      'A seed script that produces a merchant and one end to end payment as a smoke test',
      'A sustained load test of at least an hour, warmed up, with p50, p99, goodput and the utilisation at which the objective breaks',
      'The share of your monthly error budget spent during that hour',
      'Four injected failures: database loss, a slow then failing bank, a stopped publisher, a revoked credential',
      'For each failure: what fired, time to detection, time to recovery, and whether money was lost or duplicated',
      'A daily reconciliation across every service that returns zero breaks, including after every injected failure',
      'An expand and contract migration performed under load with zero failed requests',
      'An architecture document: a diagram, every service with what it owns and depends on, and what happens when each dependency is unavailable',
      'Three architecture decision records: context, options, decision, consequences',
      'Six one page system designs, each with requirements, estimation, data model, diagram, failure modes and what you would monitor',
      'A two minute video with no slides, showing the platform running, failing and recovering',
      'A landing README leading with the diagram, one sentence, and five measured results',
      'Every repository README rewritten to lead with its measurement rather than its technology',
      'A CV in which every line contains a number',
      'The repository public on GitHub as `payments-platform-capstone`'
    ],
    starter: {
      lang: 'text',
      code: '# FinQuest level 20: the capstone.\n#\n#   docker-compose.yml     everything, one command\n#   seed.py                a merchant and one payment, as a smoke test\n#   bench/                  the hour long run, and the report it writes\n#   chaos/                  four failures, injected under load\n#   recon/daily.py          the check that must return zero, always\n#   ARCHITECTURE.md         diagram, ownership, dependencies, failure behaviour\n#   decisions/              three records: context, options, decision, consequences\n#   designs/                six one page system designs\n#   README.md               diagram, one sentence, five measured results\n\n# The five results go here, and each must be reproducible on demand:\n#\n#   1. ...\n#   2. ...\n#   3. ...\n#   4. ...\n#   5. ...\n#\n# If you cannot rerun one of them in front of somebody, delete it.\n'
    },
    tests: [
      'A fresh clone starts the platform with one command and passes the smoke test',
      'A payment flows from the API through the ledger, the events and the payout without manual intervention',
      'The hour long load test completes and writes a report with percentiles and goodput',
      'Killing the ledger database under load loses no money, and the reconciliation still returns zero afterwards',
      'A bank that times out leaves payouts in an explicit unknown state, and the sweeper resolves all of them',
      'Stopping the publisher for ten minutes loses no events, and the consumer catches up',
      'A revoked vault credential produces a clear failure and a firing alert rather than silent errors',
      'A schema migration under load completes with zero failed requests',
      'The daily reconciliation returns zero breaks after every chaos scenario',
      'Every number in the landing README can be reproduced by a command in the repository'
    ],
    rubric: [
      { pts: 20, t: 'It runs', d: 'One command, a fresh clone, a payment end to end through every service.' },
      { pts: 25, t: 'It holds', d: 'An hour under load with percentiles and goodput, and the utilisation where the objective breaks.' },
      { pts: 25, t: 'It survives', d: 'Four injected failures with detection and recovery times, and reconciliation at zero after each.' },
      { pts: 15, t: 'It is legible', d: 'Architecture document, three decision records, and six one page designs.' },
      { pts: 15, t: 'It is hireable', d: 'A two minute video, a README leading with five measured results, and a CV where every line has a number.' }
    ],
    stretch: [
      'Run the platform on a cloud account for a week with real monitoring, and report what it actually cost',
      'Add a second region and work out honestly what breaks, rather than assuming it works',
      'Run a game day with a friend playing incident commander, using only your runbooks',
      'Publish a write up of one measurement that surprised you, and post it where engineers read',
      'Take one of the six designs to a mock interview with somebody who works in payments, and rewrite it afterwards'
    ],
    solutionPath: 'solutions/level-20'
  },

  faq: [
    { q: 'How long should the capstone take?',
      a: 'Two weeks part time if the earlier levels are genuinely finished, and much longer if they are not, which is the honest test of whether they were. The assembly is where you find out which services only ever worked on your laptop.' },
    { q: 'Is one big repository better than fifteen small ones?',
      a: 'Keep both. The fifteen show depth on a specific topic and match individual job descriptions; the capstone shows the pieces working together. The capstone is what you link to first, and the others are what you point at when the role is specific.' },
    { q: 'What if I cannot get every service running together?',
      a: 'Then that is the most valuable thing this level will teach you, and it is worth writing down. Get as many as you can, document exactly what stopped the rest, and fix what is fixable. Integration failures are the normal condition of real systems, and the write up is worth more than a diagram claiming everything works.' },
    { q: 'Do I really need a video?',
      a: 'It is optional and it is the single highest return two minutes in the package, because it gets watched when a repository does not get cloned. No slides, no introduction, no music: start it, load it, break it, show the alert.' },
    { q: 'I still do not feel ready to apply',
      a: 'That feeling arrives some time after the evidence does, and often a long time after. Set a date, send fifteen applications on it, and treat the first two interviews as practice you happen to be paid nothing for. The alternative is one more month of preparation that will not change the outcome.' },
    { q: 'What if I get rejected?',
      a: 'Write down the questions you were asked while they are fresh, fix the specific thing, and apply again. Screens are noisy and interviewers have bad days. A rejection is information about one hour, and the only serious mistake is letting it stop the next application.' },
    { q: 'What comes after this course?',
      a: 'Depth in one direction, chosen deliberately: the database internals, the card networks and scheme rules, distributed systems properly, or the regulatory side. Pick one, go a level deeper than this course did, and write about what you find. That habit, more than any particular topic, is what separates the fifth year from the first repeated five times.' }
  ]
});
