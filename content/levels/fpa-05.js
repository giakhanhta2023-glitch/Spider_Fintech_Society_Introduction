/* =========================================================================
   ANALYST TRACK, LEVEL 5: the pack that rebuilds itself
   ========================================================================= */
FQ.registerLevel({
  id: 105,
  track: 'fpa',
  position: 5,
  codename: 'close',
  title: 'The pack that rebuilds itself',
  tagline: 'Six stages, 258 milliseconds, one document, and a run that stops rather than publishing a number it cannot defend.',
  difficulty: 7,
  minutes: 360,
  tags: ['pipeline', 'reconciliation', 'reporting', 'capstone'],
  summary: 'The capstone. The spreadsheet, the queries, the script and the model become one command that goes from ' +
           'raw files to a pack somebody can read, with a reconciliation between two systems in the middle and a ' +
           'refusal to publish when anything is wrong.',

  objectives: [
    'Assemble four levels of work into one pipeline without copying any of it',
    'Reconcile two systems that were built separately, and find the row where they disagree',
    'Tell the difference between a stage that must stop the close and one that only needs a sentence',
    'Produce a document in the order a reader needs rather than the order you computed it',
    'Report provenance: which command produced this, from what, and whether it tied',
    'Hand over something a colleague can run next month without asking you anything'
  ],

  knowledge: [
    { h: 'What a close actually is' },
    { p: 'Four working days, every month, for the rest of your career. The books close, the numbers arrive, and ' +
         'somebody has to turn them into a document that a person who was not there can act on. Everything in this ' +
         'track so far is one stage of that, and this level is the part where they have to work together.' },
    { p: 'Assembly is where you find out which of your work only ever worked on its own. The pack cannot be built if ' +
         'the ledger will not load. The reconciliation needs both the ledger and the billing detail. The reforecast ' +
         'needs the month that just closed. **A dependency between two things that used to be separate is the whole ' +
         'exercise**, and it is the same lesson the engineering track learns in its own capstone.' },
    { money: 'The number this level ends on: six stages, **258 milliseconds**, one document, and an exit code. The ' +
             'exit code is the part that matters. A close that can say "do not send this" is a different thing from ' +
             'a spreadsheet that can only be wrong quietly.' },

    { h: 'The six stages' },
    { table: {
      head: ['Stage', 'What it does', 'Where it came from'],
      rows: [
        ['**load the data**', 'Every file into one SQLite database, rebuilt each run', 'Level 2'],
        ['**check the data**', 'The loader\'s repairs, and the gates that can stop everything', 'Level 3'],
        ['**build the pack**', 'Actual against budget, with the tie to the ledger', 'Level 3'],
        ['**query the detail**', 'Segments, the largest merchants, receivables ageing', 'Level 2'],
        ['**reconcile**', 'Billing against the ledger, month by month', 'New: it needs two systems that only now exist together'],
        ['**reforecast**', 'Four scenarios from the month that just closed', 'Level 4']
      ]
    }},
    { p: 'Each stage is timed and each one returns a verdict. The first fatal verdict stops the rest, because there ' +
         'is no point querying revenue detail when the ledger would not load.' },

    { h: 'Three states, and the one everybody gets wrong' },
    { table: {
      head: ['State', 'Means', 'What happens'],
      rows: [
        ['`ok`', 'Nothing to say', 'Continue'],
        ['`note`', 'The numbers are right and somebody needs to know', 'Continue, and say so at the end'],
        ['`STOP`', 'The output would be wrong', '**Nothing after it runs, and nothing is written**']
      ]
    }},
    { p: 'The middle one is the state people leave out, and leaving it out breaks the pipeline in one of two ways. ' +
         'Treat every difference as fatal and the close never finishes, so somebody adds a flag to skip the checks ' +
         'and within two months the flag is always on. Treat none of them as fatal and a wrong pack goes out with a ' +
         'warning nobody read.' },
    { p: 'In this close the reconciliation is a `note`. One month of billing detail disagrees with the ledger by ' +
         '**4,820**, which is exactly one credit note raised in the billing system and never posted to the books. ' +
         'That is not a reason to refuse to close. It is a reason to name the row, put it in the commentary, and send ' +
         'it to whoever posts corrections.' },
    { code: '   [note] reconcile billing to the ledger         17 ms\n           21 months compared\n           2025-06: billing 3,012,917.75 against ledger 3,017,737.75,\n                    difference -4,820.00\n           1 month(s) do not agree, which goes in the commentary', lang: 'text' },
    { check: {
      q: 'Your pipeline finds the same 4,820 difference every month from now on, because nobody posts the ' +
         'correction. What should the pipeline do about it?',
      a: 'Keep reporting it, and keep not stopping. What should change is the commentary: a break that is three ' +
         'months old is a different sentence from a new one, and if the pipeline can say "first seen in the June ' +
         'close, still open" then the document carries its own ageing. What it must not do is start ignoring ' +
         'differences below some threshold, because the threshold is where the next real break will hide. The ' +
         'pressure to silence a persistent warning is exactly the pressure that makes checks useless, and the answer ' +
         'is to fix the thing rather than the alarm.'
    }},

    { h: 'Reconciliation, the check that needs two systems' },
    { p: 'Every check before this one could be done inside a single file. This one cannot: it asks whether the ' +
         'billing system and the general ledger agree about revenue, month by month, and the answer is only ' +
         'interesting because they were built separately.' },
    { code: 'billed  = SELECT month, ROUND(SUM(amount), 2) FROM invoices GROUP BY month\nledger  = the revenue rows of the ledger, by month, sign normalised\n\ndifference = billed - ledger        -> zero in twenty of twenty one months', lang: 'text' },
    { p: 'Twenty months agree to the cent. One does not, by one row. That is what a working reconciliation looks ' +
         'like: **almost all zeroes and one specific thing to go and ask about.** A reconciliation that produces a ' +
         'long list of small differences has a tolerance problem rather than a data problem, and the fix is upstream.' },
    { warn: 'Reconcile in both directions. This one compares billing to the ledger, and the same query the other way ' +
            'round would catch revenue in the ledger with no invoice behind it, which is the more dangerous of the ' +
            'two: it means somebody booked revenue nobody billed.' },

    { h: 'Importing your own earlier work' },
    { p: 'The pack code lives in the level 3 folder and the model lives in the level 4 folder. The capstone imports ' +
         'both rather than copying either:' },
    { code: 'SOLUTIONS = Path(__file__).resolve().parents[3]\nEARLIER = [SOLUTIONS / "fpa-03" / "close-pack",\n           SOLUTIONS / "fpa-04" / "three-statement"]\n\nfor folder in EARLIER:\n    sys.path.insert(0, str(folder))\n\nfrom closepack import pack as closepack_pack\nfrom model import forecast as model_forecast', lang: 'python' },
    { p: 'In a real repository these would be one package, or two dependencies installed from a private index. This ' +
         'is the smallest honest version of that, and the file says so in its own docstring rather than making the ' +
         'imports look like they came from nowhere.' },
    { p: 'The reason not to copy is the reason this whole track exists. **Two copies of the same logic drift apart ' +
         'from the first bug fix onwards**, and then the monthly pack and the quarterly pack disagree and nobody can ' +
         'say which is right.' },

    { h: 'The document, in reading order' },
    { p: 'The pipeline computes in dependency order and the document is written in reading order, and they are not ' +
         'the same. A reader wants:' },
    { code: '1. The five numbers            revenue, gross profit, margin, opex, EBITDA\n2. What moved                 the material variances, largest first\n3. The split                  volume against price\n4. Where the revenue came from  segments\n5. What has not been collected  receivables ageing, and the DSO\n6. Does billing agree           the reconciliation, with the break named\n7. What it means for next year  the four scenarios\n8. Worth knowing                the warnings\n9. How this was produced        the command, the source, the tie', lang: 'text' },
    { p: 'Nine sections, and the last one is the one that stops the pack being questioned every month. It names the ' +
         'command, the files, and the tie difference, so a reader who doubts a number has somewhere to start that is ' +
         'not your inbox.' },
    { tip: 'Write the document as a file rather than as an email body. A file can be regenerated, diffed against ' +
           'last month, and committed. An email body exists once and then only in somebody\'s memory of it.' },

    { h: 'What a script must not write' },
    { p: 'Every cause in the generated document is the word TODO. The pipeline knows marketing is 210,000 over; it ' +
         'does not know that the campaign moved, and a tool that guesses is worse than one that leaves a gap.' },
    { code: '**Marketing programmes, -210,000 unfavourable.** TODO: why. TODO: what happens next.\n**Scheme and interchange, -167,096 unfavourable.** TODO: why. TODO: what happens next.\n**Transaction fees, +151,993 favourable.** TODO: why. TODO: what happens next.', lang: 'text' },
    { p: 'What the pipeline **can** guarantee is that no material variance is ever missing from the list, which is ' +
         'exactly what a person writing at 7pm gets wrong. That division of labour is the point: the machine does the ' +
         'completeness, the person does the causation, and the document will not go out with TODO in it because a ' +
         'human has to read it first.' },
    { check: {
      q: 'Your colleague asks whether the close could run itself overnight and email the pack to the leadership team ' +
         'automatically. What do you say?',
      a: 'The numbers can. The document cannot go out unread while it still contains TODO, because the causes are ' +
         'the part that carries the judgement and the part somebody will be asked about in the meeting. A sensible ' +
         'middle is to run the pipeline on a schedule so the numbers and the exit code are waiting first thing, with ' +
         'the document in a folder rather than in an inbox, and a person spending twenty minutes on the commentary ' +
         'before it goes anywhere. Automate the completeness, keep the accountability.'
    }},

    { h: 'Handing it over' },
    { p: 'The last requirement of the capstone is the one that is easiest to skip and hardest to fake: somebody else ' +
         'runs it next month without asking you anything. That means the README says the command, the numbers it ' +
         'should produce, and what the thing deliberately does not do.' },
    { table: {
      head: ['A reader needs to know', 'Where it goes'],
      rows: [
        ['The one command', 'The top of the README, before any explanation'],
        ['What it produces, exactly', 'A pasted run, with the real numbers in it'],
        ['When it will stop, and why', 'The table of the three states'],
        ['What it cannot do', 'A "what is not here" section, written honestly'],
        ['Whether it is currently right', 'The tie difference, printed every run']
      ]
    }},
    { p: 'And then the part that is not documentation: **run it on a machine that is not yours**. A clean checkout, ' +
         'a fresh clone, no files left over from development. Half of everything that breaks at a handover breaks ' +
         'because of a file that existed only on the machine it was written on.' }
  ],

  tutorial: {
    intro: 'Python, and about three hours if levels 3 and 4 are finished. If they are not, this level will tell you ' +
           'so immediately, which is itself the lesson about assembly.',
    steps: [
      {
        t: 'A stage type, before any stages',
        blocks: [
          { code: '@dataclass\nclass Stage:\n    name: str\n    ok: bool = True\n    fatal: bool = False\n    milliseconds: float = 0.0\n    lines: list[str] = field(default_factory=list)\n    data: dict = field(default_factory=dict)\n\n    def fail(self, text, fatal=True):\n        self.ok = False\n        self.fatal = self.fatal or fatal\n        self.lines.append(text)', lang: 'python' },
          { p: 'Two booleans rather than one. `ok` is whether there is anything to say, `fatal` is whether the close ' +
               'can continue, and the whole design of the pipeline is in the gap between them.' },
          { p: 'If the `@dataclass` line is unfamiliar, level 4 has a page on it: a class is a shape for a thing and ' +
               '`@dataclass` is the instruction that makes Python write the repetitive parts. `field(default_factory=list)` ' +
               'gives each stage its own empty list rather than one list shared by all of them.' }
        ],
        check: 'A stage can be not ok and not fatal, which is the state the reconciliation uses.'
      },
      {
        t: 'Import the earlier levels',
        blocks: [
          { code: 'for folder in [SOLUTIONS / "fpa-03" / "close-pack",\n               SOLUTIONS / "fpa-04" / "three-statement"]:\n    if not folder.exists():\n        raise ModuleNotFoundError(\n            f"{folder} is missing. The close is the assembly of levels 3 and 4.")\n    sys.path.insert(0, str(folder))', lang: 'python' },
          { warn: 'Resist copying the files in. It will work today and it will be two implementations by the end of ' +
                  'the quarter.' }
        ],
        check: 'The close imports the pack and the model, and says something useful if either folder is missing.'
      },
      {
        t: 'Stage one: everything into one database',
        blocks: [
          { code: 'path.unlink(missing_ok=True)          # rebuilt from scratch every run\nconnection = sqlite3.connect(path)\nfor name in TABLES:\n    frame = pd.read_csv(DATA / f"fpa-{name}.csv", dtype={"account_code": str})\n    frame.to_sql(name.replace("-", "_"), connection, index=False, if_exists="replace")', lang: 'python' },
          { p: 'Deleting the file first is deliberate. A database that accumulates state between runs is a database ' +
               'where last month\'s bad row lives forever, and a close has to be reproducible from the files alone.' }
        ],
        check: 'Six tables, and deleting the .db file changes nothing about the output.'
      },
      {
        t: 'Stages two and three: the gates, then the pack',
        blocks: [
          { p: 'Both come from level 3 with no changes. The only new thing is that their findings become the ' +
               'pipeline\'s verdict.' },
          { code: 'findings = closepack_checks.run(frame, budget, month, report.duplicates_removed)\nif closepack_checks.fatal(findings):\n    stage.fail(f"{len(...)} fatal finding(s): the close stops here")', lang: 'python' }
        ],
        check: 'Asking for a month the plan does not cover stops the run at stage two, and writes nothing.'
      },
      {
        t: 'Stage five: the reconciliation',
        blocks: [
          { code: 'joined = billed.merge(ledger, on="month", how="outer").fillna(0.0)\njoined["difference"] = (joined["billed"] - joined["ledger"]).round(2)\nbreaks = joined[joined["difference"].abs() > 0.005]\n\nif not breaks.empty:\n    stage.fail(f"{len(breaks)} month(s) do not agree, "\n               f"which goes in the commentary", fatal=False)', lang: 'python' },
          { p: 'An **outer** join, so a month present in one system and missing from the other shows up rather than ' +
               'disappearing. And `fatal=False`, which is the single most important argument in the file.' }
        ],
        check: 'Twenty one months compared, one difference of -4,820 in June, and the close continues.'
      },
      {
        t: 'Stage six, then the document',
        blocks: [
          { p: 'Run the four scenarios from level 4, assert they all balance, then write the document in reading ' +
               'order with every cause left as TODO.' },
          { code: 'for assumptions in model_drivers.scenarios():\n    forecast = model_forecast.run(assumptions)\n    if not forecast.balances:\n        stage.fail(f"the {assumptions.name} case does not balance")', lang: 'python' },
          { tip: 'A forecast that does not balance is fatal here even though nothing else depends on it, because a ' +
                 'pack containing a broken model is worse than a pack with no model in it.' }
        ],
        check: 'A markdown file with nine sections, three TODOs, and a footer naming the command that made it.'
      },
      {
        t: 'Test the stopping, not just the running',
        blocks: [
          { code: 'def test_a_fatal_stage_stops_everything_after_it(monkeypatch, tmp_path):\n    monkeypatch.setattr(stages, "quality_gates", broken)\n    monkeypatch.setattr(close_run, "OUT", tmp_path)\n    code, done = close_run.run("2025-09", quiet=True)\n\n    assert code == 1\n    assert all(not s.ok for s in done[2:])\n    assert not list(tmp_path.glob("close-*.md"))   # and nothing was written', lang: 'python' },
          { p: 'The last assertion is the one that matters. A pipeline that stops but has already written half a ' +
               'pack has not stopped in any useful sense.' }
        ],
        check: 'Nine tests, and the ones about stopping outnumber the ones about running.'
      },
      {
        t: 'Run it somewhere else',
        blocks: [
          { p: 'Clone your own repository into a new folder and run the command. No editing, no environment ' +
               'variables you forgot you set, no file sitting in your downloads.' },
          { tip: 'If it fails, that failure is the most valuable thing this level will give you, and fixing it is ' +
                 'what "handed over" means.' }
        ],
        check: 'A fresh clone produces the same document, byte for byte apart from the timings.'
      }
    ]
  },

  glossary: [
    { t: 'Close', d: 'The monthly process of finalising the books and reporting on them. Four working days, every month.' },
    { t: 'Pipeline', d: 'A sequence of stages where each one can stop the rest. Different from a script that does everything and hopes.' },
    { t: 'Stage', d: 'One step with a name, a timing and a verdict.' },
    { t: 'Fatal', d: 'A verdict that stops the run. Reserved for cases where the output would be wrong.' },
    { t: 'Reconciliation', d: 'Comparing two systems that arrived at the same fact independently, and explaining every difference.' },
    { t: 'Break', d: 'A difference a reconciliation finds. Normal in small numbers, and each one needs an owner.' },
    { t: 'Outer join', d: 'A join that keeps rows from both sides. What a reconciliation needs, because a missing row is a finding.' },
    { t: 'Exit code', d: 'Zero if the run was clean. The thing that lets something other than a person act on the result.' },
    { t: 'Provenance', d: 'Which command produced this, from what, and when. The footer that stops a pack being re-litigated monthly.' },
    { t: 'Idempotent', d: 'Running it twice gives the same result. Why the database is deleted and rebuilt each run.' },
    { t: 'Reading order', d: 'The order a reader needs, which is rarely the order the pipeline computed.' },
    { t: 'Handover', d: 'Somebody else runs it next month without asking you anything. The only real test of documentation.' },
    { t: 'Clean checkout', d: 'A fresh clone with nothing left over from development. Where handovers actually break.' }
  ],

  quiz: [
    { q: "The reconciliation finds one month out by 4,820. Should it stop the close?",
      options: [
        "Yes, unless it is under a materiality threshold",
        "Only if it is in the current month",
        "No: the pack is right, the break has an owner, and it belongs in the commentary",
        "Yes: a difference means the numbers cannot be trusted"
      ],
      answer: 2,
      why: "A break is a thing somebody has to own, not a reason to publish nothing. Treating every difference as fatal is how a team ends up with a flag that skips the checks." },

    { q: "What makes a stage fatal rather than a note?",
      options: [
        "Whether the output would be wrong if the run continued",
        "The size of the number involved",
        "Whether it happened in the current month",
        "Whether the person running it has time to fix it"
      ],
      answer: 0,
      why: "An unmapped account means money that appears nowhere in the pack, so the pack would be wrong. A credit note not yet posted leaves the pack correct and needs a sentence." },

    { q: "Why does the pipeline delete and rebuild the database on every run?",
      options: [
        "To save disk space",
        "To avoid locking",
        "Because SQLite requires it",
        "So the close is reproducible from the files alone, and last month's bad row cannot survive"
      ],
      answer: 3,
      why: "State that accumulates between runs is state nobody can account for. A close has to be reproducible from the source files and nothing else." },

    { q: "Why import levels 3 and 4 rather than copying their code into the capstone?",
      options: [
        "Imports are faster",
        "The files are too large",
        "Two copies of the same logic drift apart from the first bug fix onwards, and then two packs disagree",
        "Copying would break the tests"
      ],
      answer: 2,
      why: "It is the same lesson as the mapping table and the sign rule: one implementation, one place to fix it. The monthly pack and the quarterly pack disagreeing is how it shows up." },

    { q: "The reconciliation uses an outer join rather than an inner one. Why?",
      options: [
        "Outer joins are faster on small tables",
        "A month present in one system and missing from the other is a finding, and an inner join hides it",
        "To keep the column order",
        "Because pandas defaults to it"
      ],
      answer: 1,
      why: "In a reconciliation, the missing row is usually the interesting one. An inner join is a decision to only compare what both sides already agree exists." },

    { q: "Why does the generated document leave every cause as TODO?",
      options: [
        "The pipeline knows what moved and cannot know why, and an invented cause is worse than a gap",
        "The feature is unfinished",
        "To keep the document short",
        "Because the data is synthetic"
      ],
      answer: 0,
      why: "The machine guarantees completeness, which is what a person writing at 7pm gets wrong. The person supplies causation, which is what they are accountable for." },

    { q: "What is the strongest test of a pipeline that can stop?",
      options: [
        "That it retries",
        "That when a stage fails, nothing after it runs and nothing is written",
        "That it runs successfully on good data",
        "That it logs the failure"
      ],
      answer: 1,
      why: "A pipeline that stops after writing half a pack has not stopped in any useful sense. Assert the absence of the output file, not just the exit code." },

    { q: "Six stages take 258 ms and the whole command takes about 4.4 seconds. What is the rest?",
      options: [
        "Writing the document",
        "Starting Python and importing pandas and matplotlib",
        "The four forecast scenarios",
        "The database rebuild"
      ],
      answer: 1,
      why: "Import time dominates everything at this size. Knowing that stops anybody optimising the wrong thing, and the honest way to report it is both numbers." },

    { q: "What belongs in the document's footer?",
      options: [
        "The analyst's name and the date",
        "A disclaimer about accuracy",
        "The version of Python",
        "The command that produced it, the files it read, and whether the pack tied"
      ],
      answer: 3,
      why: "Provenance is what stops a pack being re-litigated every month. A reader who doubts a number gets somewhere to start that is not your inbox." },

    { q: "The document is written in a different order from the pipeline's computation. Why?",
      options: [
        "To make the file shorter",
        "To hide the implementation",
        "Because the forecast depends on the pack",
        "Because a reader wants the five numbers first, and the pipeline has to load the data first"
      ],
      answer: 3,
      why: "Dependency order and reading order are different problems. Writing the document in computation order is the most common way a technically correct pack goes unread." },

    { q: "A colleague asks to have the pack emailed automatically overnight. What is the right answer?",
      options: [
        "The numbers can run overnight; the document should not go out while it still contains TODO",
        "Only if the reconciliation is clean",
        "No, automation is unsafe",
        "Yes, it is fully automated"
      ],
      answer: 0,
      why: "Automate the completeness and keep the accountability. Run it on a schedule so the numbers and the exit code are waiting, and have a person spend twenty minutes on the commentary." },

    { q: "The same 4,820 break appears for three months running. What changes?",
      options: [
        "Adjust the ledger to match billing",
        "Remove the reconciliation stage",
        "The commentary: \"first seen in June, still open\". The break keeps being reported",
        "Add a threshold so it stops being reported"
      ],
      answer: 2,
      why: "A threshold is where the next real break will hide. Ageing the break in the document keeps the pressure on the fix rather than on the alarm." },

    { q: "Which reconciliation direction is more dangerous to leave out?",
      options: [
        "Neither, if the totals match",
        "Billing against the ledger",
        "The ledger against billing, because it catches revenue booked with no invoice behind it",
        "They are equivalent"
      ],
      answer: 2,
      why: "Comparing one way finds the things you know about. Revenue in the books with nothing billed is the break that costs the most to explain." },

    { q: "What is the real test of the handover documentation?",
      options: [
        "That somebody else runs it next month from a clean checkout without asking you anything",
        "That it covers every function",
        "That it is under two pages",
        "That it has a diagram"
      ],
      answer: 0,
      why: "Half of what breaks at a handover breaks because of a file that existed only on the machine it was written on. A fresh clone is the only way to find that." },

    { q: "What single feature separates this pipeline from doing the same work in a spreadsheet?",
      options: [
        "It uses a database",
        "It can refuse: it stops, writes nothing, and returns a non zero exit code",
        "It produces charts",
        "It is faster"
      ],
      answer: 1,
      why: "A spreadsheet cannot decline to show you a number. Everything else in this track is a convenience next to that." }
  ],

  project: {
    title: 'monthly-close: raw files to a finished pack, in one command',
    story: 'It is the third working day. Run one command and get the pack, the chart, the detail behind the revenue, ' +
           'the receivables position, a reconciliation between billing and the ledger, and a reforecast, as one ' +
           'document. If anything is wrong, produce nothing and say why.',
    scope: 'Python. Assemble levels 1 to 4 by importing them rather than copying. SQLite for the detail, pandas for ' +
           'the pack, the model for the forecast, markdown for the output.',
    dataset: '{{RAW}}/data/fpa-actuals.csv',
    requirements: [
      'One command that runs the whole close for a month given as an argument',
      'Six stages, each named, each timed, each returning a verdict',
      'A stage type that distinguishes "needs saying" from "stop the close"',
      'The earlier levels imported rather than copied, with a clear error if they are missing',
      'A database rebuilt from the files on every run, so nothing survives between runs',
      'The pack from level 3, with its tie to the ledger reported inside the pipeline',
      'The detail queries from level 2: revenue by segment, the largest merchants, receivables ageing',
      'A reconciliation of billing against the ledger for every month, using an outer join',
      'The reconciliation reported as a note rather than a failure, with the break named',
      'The four scenarios from level 4, with a fatal verdict if any of them stops balancing',
      'A markdown document written in reading order, with every cause left as TODO',
      'A footer naming the command, the source files and the tie difference',
      'A non zero exit code when any stage is fatal, and nothing written in that case',
      'Tests covering the happy path, the stopping path, and the reconciliation being a note rather than a failure',
      'A README with the command, a real pasted run, and an honest list of what it does not do'
    ],
    starter: {
      lang: 'python',
      code: '"""FinQuest analyst level 5: the monthly close."""\nfrom dataclasses import dataclass, field\n\n\n@dataclass\nclass Stage:\n    name: str\n    ok: bool = True\n    fatal: bool = False\n    milliseconds: float = 0.0\n    lines: list = field(default_factory=list)\n    data: dict = field(default_factory=dict)\n\n    def say(self, text):\n        self.lines.append(text)\n\n    def fail(self, text, fatal=True):\n        self.ok = False\n        self.fatal = self.fatal or fatal\n        self.lines.append(text)\n\n\nPLAN = [\n    ("load the data", load_database),\n    ("check the data", quality_gates),\n    ("build the pack", variance_pack),\n    ("query the detail", revenue_detail),\n    ("reconcile billing to the ledger", reconcile),\n    ("reforecast", reforecast),\n]\n\n\ndef run(month="2025-09"):\n    """Run the plan in order. The first fatal stage stops the rest.\n\n    Returns (exit_code, stages). Writes nothing if anything was fatal.\n    """\n    # TODO\n'
    },
    tests: [
      'python -m close.run completes, exits 0, and writes both the document and the chart',
      'Every stage reports a time greater than zero',
      'The pack ties to the ledger inside the pipeline, and the document says so',
      'The reconciliation finds exactly one month out, 2025-06 by -4,820, and does not stop the close',
      'The document contains the September numbers and at least one TODO',
      'All four forecast scenarios run and balance, and the stress case draws the facility in 2026-09',
      'A forced failure in an early stage stops every later stage and writes no document',
      'Asking for a month the plan does not cover exits non zero',
      'The imported modules resolve to the level 3 and level 4 folders rather than to local copies'
    ],
    rubric: [
      { pts: 25, t: 'It assembles', d: 'Four levels, one command, nothing copied, and a clear error when a piece is missing.' },
      { pts: 25, t: 'It refuses', d: 'Fatal stops everything and writes nothing. Notes continue and are reported. The split is defensible and tested.' },
      { pts: 20, t: 'It reconciles', d: 'Two systems compared both ways, every difference named, no tolerance hiding anything.' },
      { pts: 15, t: 'It reads', d: 'A document in reading order, causes left to a person, provenance in the footer.' },
      { pts: 15, t: 'It hands over', d: 'A fresh clone runs it. The README has the command, a real run, and what it cannot do.' }
    ],
    stretch: [
      'Add the reverse reconciliation: ledger revenue with no invoice behind it',
      'Age the breaks, so a difference first seen in June says so in September',
      'Add a --compare flag that diffs this month\'s document against last month\'s',
      'Run the close for every month in the history and chart how long each stage takes as the data grows',
      'Put the whole thing behind a scheduled job that writes the document to a folder and emails nobody'
    ],
    solutionPath: 'solutions/fpa-05'
  },

  faq: [
    { q: 'This is a lot of code for a monthly report.',
      a: 'It is about four hundred lines, most of which is the earlier levels being reused. The test of whether it ' +
         'was worth it is month three: the checks run every time, the month is an argument, the reconciliation is ' +
         'done before anybody asks, and the twenty minutes you spend are on the commentary rather than on the ' +
         'arithmetic.' },
    { q: 'What if my company uses a system that produces the pack already?',
      a: 'Most do, and the pack it produces is usually the numbers without the checks. The valuable part of this ' +
         'level is not the pipeline: it is knowing what a tie out is, what a break is, and which differences stop a ' +
         'close. Those transfer to any system, including the expensive ones.' },
    { q: 'Should the close run automatically?',
      a: 'The numbers, yes. The document going out, no, at least while it still contains TODO. Run it on a schedule ' +
         'so the exit code and the numbers are waiting first thing, and keep a person between the file and the ' +
         'leadership team.' },
    { q: 'How do I talk about this in an interview?',
      a: 'Lead with the refusal: "it produces nothing rather than a pack it cannot defend, and here is the test that ' +
         'proves it". Then the reconciliation: two systems, twenty one months, one break worth 4,820, found by the ' +
         'pipeline rather than by the auditor. Those two sentences say more about how you work than any list of ' +
         'tools.' },
    { q: 'What comes after this track?',
      a: 'Two directions, and they are both good. Deeper into the business: pricing, unit economics, the things the ' +
         'take rate variance in level 3 is really about. Or deeper into the tools: the engineering track on this ' +
         'site starts where level 3 left off and ends with a payments platform under load. Analysts who can do both ' +
         'are rare and they know it.' }
  ]
});
