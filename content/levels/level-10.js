/* =========================================================================
   Level 10: capstone, the whole system
   ========================================================================= */
FQ.registerLevel({
  id: 10,
  codename: 'capstone',
  title: 'Compliance, architecture and the capstone build',
  tagline: 'Nine levels of parts become one system, with one README and a link worth putting on your CV.',
  difficulty: 10,
  minutes: 300,
  tags: ['architecture', 'RegTech', 'documentation', 'capstone'],
  summary: 'The final level covers the two things that separate a student project from a professional one (compliance ' +
           'awareness and architecture) then asks you to assemble everything you have built into a single coherent product.',

  objectives: [
    'Describe the compliance obligations a product that handles money carries: KYC, AML, PII, retention',
    'Design a layered architecture and explain why the layers exist',
    'Structure a multi-module Python project that a stranger can run',
    'Write a README that gets your work taken seriously in thirty seconds',
    'Integrate ledger, analytics, lending, risk and fraud into one application',
    'Present the result honestly, including what it does not do'
  ],

  knowledge: [
    { h: 'The rules you are building inside' },
    { p: 'Handling other people\'s money is one of the most tightly regulated things a business can do. You do not need to ' +
         'be a lawyer, but building a money product without knowing these four obligations is how teams get shut down. Each ' +
         'one turns into code:' },
    { table: {
      head: ['Obligation', 'In plain words', 'What it means in your code'],
      rows: [
        ['**KYC**, know your customer', 'Check who someone is before they can hold money', 'A sign-up process with stages, and no payments until the person is verified'],
        ['**AML**, anti-money-laundering', 'Spot and report money that looks like it comes from crime', 'Rules that watch payments, alerts, and records of what was investigated'],
        ['**Data protection**', 'Collect little personal data, keep it safe, use it only for what you said', 'Store less, encrypt it, limit who can read it, record who did'],
        ['**Audit and record keeping**', 'Be able to show, years later, exactly what happened and why', 'Records that are only ever added to, never changed, with versioned rules']
      ]
    }},
    { p: 'KYC in a real app is a sequence of states a new customer moves through, and the code refuses to skip any:' },
    { code: 'signed_up  ->  documents_submitted  ->  verified  ->  active\n                      |\n                      +->  rejected\n\nOnly "active" customers can receive or send money.', lang: 'text', label: 'a KYC process' },
    { p: 'And AML means watching for patterns, not single payments. A classic one: somebody deposits $9,500 in cash on ' +
         'Monday, $9,600 on Tuesday and $9,400 on Wednesday. Each is below $10,000, the cash amount at which a US bank must file a report, which is ' +
         'exactly the point, and exactly what an AML rule looks for. Level 19 builds a full monitoring system.' },
    { p: 'Notice how much of this is **engineering** rather than paperwork. Keeping every record, never overwriting history, ' +
         'and being able to explain every decision are choices you make in the first week of a project. Adding them later is ' +
         'close to impossible, which is why they belong in your capstone from the first commit.' },
    { check: {
      q: 'Your project keeps a balance column it updates on each payment, and one KYC status per customer that it overwrites. ' +
         'Someone asks what the balance was on 3 March and who approved that verification. What can you tell them?',
      a: 'Nothing, and no amount of careful work will recover it. Both tables hold only the present, so every earlier state ' +
         'was written over the moment it changed. A ledger of entries that are only ever added to answers the first question, ' +
         'by adding up entries to that date. A status table with one row per change, each stamped with who and when, answers ' +
         'the second. That is why these go in at the first commit: history you never stored cannot be recovered later, only ' +
         'made up.'
    }},

    { h: 'Personal data: the information that changes your obligations' },
    { p: '**PII**, personally identifiable information, is anything that can identify a real person. Some of it is obvious. ' +
         'Some of it only identifies someone in combination:' },
    { table: {
      head: ['Obviously PII', 'PII in combination'],
      rows: [
        ['Full name', 'Postcode'],
        ['Home address', 'Date of birth'],
        ['National ID or passport number', 'Gender'],
        ['Full card number', 'Employer and job title'],
        ['Phone number, email', 'The exact times someone buys coffee']
      ]
    }},
    { p: 'The right-hand column is the one people underestimate. A well-known study in 2000 estimated that about 87% of the US ' +
         'population could be picked out uniquely by just postcode, date of birth and gender together.' },
    { p: 'Five habits cover most of what you owe:' },
    { ul: [
      '**Collect less.** Do not store what you do not need. The safest personal data is the field you never stored.',
      '**Mask what you show.** Display `**** 4471`, not the full card number. The full number, called the **PAN**, is covered ' +
      'by its own strict security standard, **PCI DSS**, and storing it pulls your whole system under those rules.',
      '**Keep it apart.** Store who a person is in one place and what they did in another, linked by a meaningless id such as ' +
      '`C0381`, so a leak of one is less harmful.',
      '**Delete on schedule.** Decide how long you keep each kind of record, and actually delete it when the time is up.',
      '**Record who looked.** In a regulated system, reading personal data is an event worth recording, not just changing it.'
    ]},
    { check: {
      q: 'A teammate wants to store the full card number so the profile page can show it. Talk them out of it, or agree with ' +
         'them, using the five habits above.',
      a: '"Collect less" decides it. The page shows `**** 4471`, so what it needs is the last four digits, and storing sixteen ' +
         'to display four is keeping data you have no use for. The cost is real: a stored full card number puts the whole ' +
         'system under PCI DSS, with the audits, key management and breach exposure that follow, for a feature nobody asked ' +
         'for. The safest field is still the one you never stored.'
    }},
    { warn: 'Never commit real personal data to a repository, even a private one, even for a minute. Every dataset in this ' +
            'course is made up for exactly this reason, and your capstone must be too. If you want realistic data, generate it.' },
    { check: {
      q: 'You export a dataset for a coursework partner, removing names, emails and account numbers, and leaving postcode, ' +
         'date of birth and gender. Is that export anonymous?',
      a: 'No. Those three fields together identify a large share of any population, as the 2000 study showed, and a partner ' +
         'who holds an electoral roll or a marketing list can put the names back. Whether someone can be identified depends on ' +
         'your file plus everything else that exists, so removing the obvious columns is not enough. Either group the rows ' +
         'into totals, blur the fields (year of birth instead of date, the first half of the postcode), or generate made-up ' +
         'data, which is what this course does and what your capstone should do.'
    }},

    { h: 'Open banking, and what consent means' },
    { p: 'In the UK, the EU and a growing list of other countries, the law makes banks share a customer\'s data with other ' +
         'apps **when the customer agrees**. That is how a budgeting app can read your bank payments without ever asking for ' +
         'your bank password. Level 18 builds one.' },
    { p: 'The idea to carry into everything you build is what "agreeing" has to mean. Proper **consent** has four properties:' },
    { table: {
      head: ['Consent must be', 'Meaning'],
      rows: [
        ['**Explicit**', 'The person actively said yes to this specific thing'],
        ['**Scoped**', 'It covers only what was asked for: one account, not all of them'],
        ['**Time limited**', 'It ends on a known date, often after 90 days, unless renewed'],
        ['**Revocable**', 'The person can withdraw it whenever they like, easily']
      ]
    }},
    { check: {
      q: 'Your app asks for access to every account a member holds, stores the access pass, and keeps renewing it quietly ' +
         'after they stop using the product. Which parts of that consent standard have you broken?',
      a: 'Three of the four. Scoped: you asked for every account when the budgeting feature reads one. Time limited: a pass ' +
         'that renews itself has no end. Revocable: nothing in the product lets them stop it, and a member who cannot find ' +
         'the off switch has not really agreed to what follows. Only explicit survives, and in its weakest form, a single ' +
         'screen at sign-up. The fix is product work rather than clever code: ask for less, let it expire, and put a ' +
         'disconnect button where it can be found.'
    }},

    { h: 'Architecture: layers, and why they exist' },
    { p: 'By now your code does five different jobs: showing pages, applying money rules, loading data, saving it, and ' +
         'testing it. **Architecture** is the decision about how those pieces are arranged and which may talk to which. The ' +
         'standard answer is **layers**:' },
    { code: 'interface        Streamlit pages, command line, API endpoints\n     |           (no money rules here: just take input and show results)\nservices         ledger, lending, risk, fraud, fx\n     |           (the rules. Pure functions where possible. Fully tested)\ndata             loaders, input checks, data generators\n     |           (everything that touches a file or the network)\nstorage          CSV files, a SQLite database, the ledger\'s entry log', lang: 'text', label: 'four layers' },
    { p: 'Follow one click through it. A member presses "Send $25". The **interface** reads the form and calls ' +
         '`ledger.transfer("alice", "bob", 2500)`. The **service** checks the rules: enough money, both accounts exist. It asks ' +
         'the **data** layer to save two entries, which writes them to **storage**. The answer travels back up, and the ' +
         'interface shows "Sent".' },
    { p: 'The one rule: **higher layers may call lower ones, never the other way round.** The ledger must not know a Streamlit ' +
         'page exists. Keep to that and you can swap the interface for an API, test the rules without a browser, and think ' +
         'about one layer at a time. Break it and everything becomes one tangle that can only be tested by clicking.' },
    { table: {
      head: ['Warning sign', 'What it means'],
      rows: [
        ['A calculation calls `st.write`', 'Screen code has leaked into the rules'],
        ['A service opens a CSV file itself', 'Data loading has leaked into the rules'],
        ['A test needs a browser to run', 'The rules are trapped inside the screen'],
        ['Changing a chart breaks the ledger', 'There are no layers at all']
      ]
    }},
    { check: {
      q: '`fraud.py` opens `data/level-08-transactions.csv` using that relative path, and it works. Name two things it has ' +
         'quietly broken.',
      a: 'Anyone running the program from a different folder, because a relative path is looked up from wherever the program ' +
         'was started, not from where `fraud.py` lives. And the tests, which now cannot check the scoring rules without that ' +
         'CSV sitting in the right place, so a small test depends on a file on disk. Both come from one broken rule: a service ' +
         'reached down into data loading. Pass the table in, or call a loader, and the rules become testable with four rows ' +
         'written by hand.'
    }},

    { h: 'A project a stranger can find their way around' },
    { p: 'Here is how the capstone is laid out. Each file maps to a level you already finished:' },
    { code: 'neobank/\n  README.md            <- the front door\n  requirements.txt\n  .gitignore\n  app.py               <- the Streamlit page\n  neobank/\n    __init__.py\n    ledger.py          <- level 4\n    analytics.py       <- level 3\n    lending.py         <- levels 2 and 6\n    risk.py            <- level 7\n    fraud.py           <- level 8\n    fx.py              <- level 5\n    loaders.py         <- all data loading, in one place\n  data/                <- made-up CSVs only\n  tests/\n    test_ledger.py\n    test_lending.py\n    test_fraud.py\n  docs/\n    architecture.md\n    screenshots/', lang: 'text' },
    { tip: 'A folder containing a file called `__init__.py` is a **package**: Python treats the folder as one importable unit, ' +
           'so `from neobank.ledger import Ledger` works from anywhere in the project. One file per topic, named so a reviewer ' +
           'knows where to look.' },

    { h: 'The README is the product' },
    { p: 'The **README** is the page GitHub shows first when someone opens your repository. A reviewer gives it about thirty ' +
         'seconds before deciding whether to read any code. Spend those thirty seconds well, in this order:' },
    { ol: [
      '**One sentence** saying what it is and who it is for.',
      '**A live link and a screenshot**: the fastest proof that it is real.',
      '**Features**: five or six bullets of what it actually does.',
      '**Architecture**: the layer diagram and one line per file.',
      '**Run it yourself**: commands that work when copied, in order.',
      '**Tests**: how to run them, and what passes.',
      '**Data**: said plainly to be made up, with the script that generates it.',
      '**Limitations and next steps**: what it does not do yet. The section that marks you out as serious.'
    ]},
    { money: 'That last section is the one people skip and the one interviewers notice. Writing "this ledger runs in one ' +
             'process and would need database locking to handle two writers at once" tells a reviewer you know the difference ' +
             'between a demo and a real system. Claiming it is ready for real customers when it is not does the opposite.' },
    { check: {
      q: 'Your ledger is a Python list inside one running program. Does that belong in the README, and if so, how do you ' +
         'word it?',
      a: 'It belongs under limitations, written as the consequence rather than the fact: two programs writing at once could ' +
         'interleave their entries and the sum-to-zero rule could no longer be guaranteed, so this build runs as a single ' +
         'program by design and would need database locking to go further. A reviewer reading that learns you know where the ' +
         'edge is. The same reviewer reading "production ready" over the same code learns something worse, and finds the list ' +
         'in about a minute.'
    }},

    { h: 'Reconciliation: checking your books against someone else\'s' },
    { p: 'Every real money system runs a daily job called **reconciliation**: compare your own records with an independent ' +
         'source, such as the bank\'s statement, and explain every difference. A difference is called a **break**. Here is ' +
         'one, explained line by line:' },
    { table: {
      head: ['', 'Amount'],
      rows: [
        ['Your ledger says the account holds', '$12,430.00'],
        ['The bank statement says', '$12,380.00'],
        ['Break to explain', '**$50.00**'],
        ['A $12.50 monthly bank fee, on the statement but never recorded in your ledger', '-$12.50'],
        ['A $37.50 card payment the bank processed today; your ledger will record it tomorrow', '-$37.50'],
        ['Left unexplained', '**$0.00**']
      ]
    }},
    { p: 'The fee is a genuine gap: you post it to the ledger, with a note. The card payment is a **timing difference**: both ' +
         'sides will agree by tomorrow, and you check that they do. Only when every dollar has a reason is the reconciliation ' +
         'finished.' },
    { code: 'internal = sum of every ledger entry for the account\nexternal = closing balance on the statement\nbreak    = internal - external\n\nif break != 0:\n    find each cause, label it, and record the explanation', lang: 'text' },
    { p: 'Even a simple reconciliation check puts your capstone ahead of most student projects, because it shows you ' +
         'understand that a ledger is only trustworthy when something independent agrees with it.' },
    { check: {
      q: 'Your ledger says an account holds $12,430.00 and the bank statement says $12,380.00. Before you have looked at any ' +
         'entries, what do you do about the $50 difference?',
      a: 'Explain it before you touch anything. It could be a timing difference (something recorded on one side that the other ' +
         'records tomorrow), a fee that was never recorded, or a bug, and all three look identical until you read the entries. ' +
         'What you never do is adjust the ledger until the numbers agree. If a fee was missed, post the fee with a note saying ' +
         'so; if the code is wrong, fix the code and let the correcting entry stand. A silent adjustment destroys the evidence ' +
         'and makes the next break impossible to trust, which is exactly why fraudsters like them.'
    }},

    { h: 'Ethics is a design decision' },
    { p: 'You have now built things that decide who gets a loan and whose card gets blocked. Three questions belong in your ' +
         'capstone report, and in every design meeting you will ever attend:' },
    { ul: [
      '**Who is harmed if this is wrong?** A false fraud flag strands someone at a checkout with no other way to pay.',
      '**Can the person affected find out why?** If your answer is "the model decided", you have built something you cannot ' +
      'defend.',
      '**Who does this work badly for?** Systems built around the average customer fail first for people with little credit ' +
      'history, people new to the country, and people whose income arrives irregularly.'
    ]},
    { check: {
      q: 'Take the first question seriously for one case: your fraud score blocks a member\'s card at a supermarket till, ' +
         'wrongly. What does "who is harmed if this is wrong" change in the code you write?',
      a: 'It turns into features with owners. A phone notification that arrives before they reach the front of the queue, ' +
         'saying what was blocked and offering one tap to confirm it was them. A way to reach a human, with a stated response ' +
         'time, that does not need an account number they cannot get to. A recorded reason for the block, in words, so ' +
         'support can say more than "the system declined it". None of that is ethics as a paragraph at the end of a report. ' +
         'It is the difference between a decline that costs a member ten seconds and one that leaves them with a full trolley ' +
         'and no way to pay.'
    }},
    { p: 'Writing these answers down is not decoration. It is the difference between an engineer who ships features and one ' +
         'who can be trusted with a product that touches people\'s money.' }
  ],

  tutorial: {
    intro: 'This tutorial is about assembly rather than new syntax: turning nine notebooks into one installable, testable, ' +
           'documented project. Work in Codespaces or locally: whichever you chose in level 9.',
    steps: [
      {
        t: 'Create the skeleton',
        blocks: [
          { code: 'mkdir -p neobank/neobank neobank/data neobank/tests neobank/docs/screenshots\ncd neobank\ntouch neobank/__init__.py app.py README.md requirements.txt.gitignore', lang: 'bash' },
          { p: 'On Windows without a bash shell, create the folders in the VS Code explorer: the structure matters, ' +
               'not the command that made it.' },
          { code: '# .gitignore\n.venv/\n__pycache__/\n*.pyc\n.streamlit/secrets.toml\n*.cache.json', lang: 'text' }
        ],
        check: 'The folder tree exists and `git status` shows no .venv or __pycache__ files.'
      },
      {
        t: 'Move your code into modules',
        blocks: [
          { p: 'Copy each notebook\'s functions into the matching module. Two rules while you do it: **delete every print ' +
               'statement from the service layer**, and **make every function take its inputs as arguments** rather than ' +
               'reading a global.' },
          { code: '# neobank/lending.py\n"""Loan pricing and amortization (FinQuest levels 2 and 6)."""\n\n\ndef monthly_payment(principal, annual_rate, years, periods_per_year=12):\n    if principal <= 0:\n        raise ValueError("principal must be positive")\n...\n\n\ndef schedule(principal, annual_rate, years, extra=0.0):\n...', lang: 'python' },
          { code: '# app.py\nfrom neobank.lending import monthly_payment, schedule\nfrom neobank.fraud import score_transactions\nfrom neobank.risk import portfolio_stats', lang: 'python' },
          { warn: 'If an import fails with `ModuleNotFoundError: neobank`, you are running from inside the package folder. ' +
                  'Run from the project root, where `app.py` lives.' }
        ],
        check: 'python -c "from neobank.lending import monthly_payment; print(monthly_payment(250000, 0.055, 30))" works from the project root.'
      },
      {
        t: 'One loader module for all data access',
        blocks: [
          { code: '# neobank/loaders.py\n"""Every file and network read lives here. Nothing else touches the disk."""\nfrom pathlib import Path\nimport pandas as pd\n\nDATA = Path(__file__).resolve().parent.parent / "data"\n\n\ndef load_transactions(path=None):\n    path = Path(path) if path else DATA / "transactions.csv"\n    if not path.exists():\n        raise FileNotFoundError(f"missing data file: {path}")\n    df = pd.read_csv(path, parse_dates=["date"])\n    required = {"date", "description", "category", "amount"}\n    missing = required - set(df.columns)\n    if missing:\n        raise ValueError(f"transactions file is missing columns: {sorted(missing)}")\n    return df', lang: 'python' },
          { p: 'Two things worth stealing here. `Path(__file__).resolve().parent.parent` finds the project root regardless ' +
               'of where the app was started from. The fix for "it works on my machine". And **validating the schema on ' +
               'load** means a malformed CSV fails immediately with a clear message instead of producing a wrong number ten ' +
               'functions later.' }
        ],
        check: 'Loading works from any working directory, and a file with a missing column raises a clear error.'
      },
      {
        t: 'Tests per module',
        blocks: [
          { code: '# tests/test_ledger.py\nimport pytest\nfrom neobank.ledger import Ledger, InsufficientFunds\n\n\ndef make_ledger():\n    led = Ledger()\n    led.open_account("world", allow_negative=True)\n    led.open_account("alice")\n    led.open_account("bob")\n    led.deposit("alice", 10_000)\n    return led\n\n\ndef test_transfer_moves_money():\n    led = make_ledger()\n    led.transfer("alice", "bob", 2_500)\n    assert led.balance("alice") == 7_500\n    assert led.balance("bob") == 2_500\n    assert led.check_invariant()\n\n\ndef test_overdraft_refused_and_nothing_written():\n    led = make_ledger()\n    before = len(led.entries)\n    with pytest.raises(InsufficientFunds):\n        led.transfer("alice", "bob", 999_999)\n    assert len(led.entries) == before\n\n\ndef test_idempotent_retry():\n    led = make_ledger()\n    first = led.transfer("alice", "bob", 100, key="abc")\n    count = len(led.entries)\n    second = led.transfer("alice", "bob", 100, key="abc")\n    assert first == second and len(led.entries) == count', lang: 'python' },
          { code: 'pytest -q', lang: 'bash' },
          { p: 'A helper like `make_ledger()` that builds a known starting state keeps every test short and readable. ' +
               'Aim for one test per behaviour, named so a failure tells you what broke without opening the file.' }
        ],
        check: 'pytest runs every test file from the project root and all pass.'
      },
      {
        t: 'Wire the dashboard together',
        blocks: [
          { code: '# app.py\nimport streamlit as st\n\nfrom neobank import analytics, fraud, lending, risk\nfrom neobank.loaders import load_transactions, load_prices\n\nst.set_page_config(page_title="NeoBank analytics", page_icon="\\U0001F3E6", layout="wide")\n\nPAGES = {\n    "Overview": "overview",\n    "Spending": "spending",\n    "Lending": "lending",\n    "Portfolio risk": "risk",\n    "Fraud queue": "fraud",\n}\nchoice = st.sidebar.radio("Section", list(PAGES))\nst.sidebar.caption("Synthetic data. Educational project. Not financial advice.")\n\n\n@st.cache_data(ttl=3600)\ndef get_transactions():\n    return load_transactions()\n\n\nif choice == "Spending":\n    df = get_transactions()\n    st.header("Spending")\n    st.metric("Savings rate", f"{analytics.savings_rate(df):.1%}")\n    st.bar_chart(analytics.by_category(df))\n# ... one branch per section', lang: 'python' },
          { p: 'Each branch does the same three things: load (cached), call a service, display. No branch contains a formula. ' +
               'If you find yourself computing something inside `app.py`, it belongs in a module.' }
        ],
        check: 'Every sidebar section renders without error and app.py contains no financial formulas.'
      },
      {
        t: 'Add a reconciliation check',
        blocks: [
          { code: '# neobank/reconcile.py\ndef reconcile(ledger, external_balances):\n    """Compare ledger balances against an external source and report breaks."""\n    breaks = []\n    for account, external in external_balances.items():\n        internal = ledger.balance(account)\n        if internal != external:\n            breaks.append({\n                "account": account,\n                "internal": internal,\n                "external": external,\n                "difference": internal - external,\n            })\n    return breaks', lang: 'python' },
          { p: 'Display it as a green "all accounts reconciled" line or a red table of breaks. It is a dozen lines of code ' +
               'that demonstrates you know what a ledger is *for*.' }
        ],
        check: 'The dashboard reports reconciliation status, and deliberately corrupting a balance makes a break appear.'
      },
      {
        t: 'Write the README last, and properly',
        blocks: [
          { code: '# NeoBank analytics\n\nA personal-finance and risk platform built across the FinQuest fintech course:\nledger, spending analytics, loan pricing, portfolio risk, and fraud scoring\nin one Streamlit application.\n\n**Live demo:** https://your-app.streamlit.app\n\n![Dashboard](docs/screenshots/overview.png)\n\n## Features\n- Double-entry ledger with idempotent transfers and reversals\n- Spending analytics with recurring-charge detection\n- Loan pricing, amortization, and early-payoff comparison\n- Portfolio risk: volatility, Sharpe, drawdown, correlation, VaR\n- Fraud scoring with a cost-tuned threshold and an explained review queue\n- Daily reconciliation against an external balance file\n\n## Architecture\n    app.py         Streamlit interface, no business logic\n    neobank/       services: ledger, analytics, lending, risk, fraud, fx\n    neobank/loaders.py   all file and network access\n    data/          synthetic datasets (see data/generate.py)\n    tests/         pytest suite, 31 tests, all passing\n\n## Run locally\n    python -m venv.venv && source.venv/bin/activate\n    pip install -r requirements.txt\n    pytest -q\n    streamlit run app.py\n\n## Data\nAll data is synthetic and generated by `data/generate.py`. No real customer\ndata is used anywhere in this project.\n\n## Limitations and next steps\n- The ledger is single-process; concurrent writes would need row-level locking\n- Fraud thresholds are tuned on one static sample and would drift in production\n- Risk statistics assume the past resembles the future, which is the standard\n  weakness of every historical risk measure\n- Next: move storage to SQLite, add an authentication layer, schedule the\n  reconciliation job', lang: 'text', label: 'README.md' },
          { tip: 'Take screenshots at a normal window size and commit them under `docs/screenshots/`. A README with a ' +
                 'picture gets read; one without usually does not.' }
        ],
        check: 'A classmate can clone your repo and have it running from the README alone, without asking you anything.'
      }
    ]
  },

  glossary: [
    { t: 'KYC', d: 'Identity verification required before a customer may hold or move money.' },
    { t: 'AML', d: 'Monitoring and reporting designed to stop criminal funds moving through the system.' },
    { t: 'PII', d: 'Personally identifiable information: data that identifies a person, alone or combined.' },
    { t: 'PAN masking', d: 'Displaying only the last four digits of a card number.' },
    { t: 'PCI DSS', d: 'The security standard that applies when you store or process full card numbers.' },
    { t: 'Data minimisation', d: 'Collecting only the personal data you actually need.' },
    { t: 'Retention policy', d: 'A defined lifetime for records, after which they are deleted.' },
    { t: 'Audit log', d: 'An immutable record of what happened and who did it.' },
    { t: 'Open banking', d: 'Regulated, consented API access to a customer\'s bank data.' },
    { t: 'Layered architecture', d: 'Interface, services, data, storage: upper layers call lower ones only.' },
    { t: 'Package', d: 'A folder with __init__.py that can be imported as a module path.' },
    { t: 'Reconciliation', d: 'Comparing internal records against an external source and explaining every difference.' },
    { t: 'Break', d: 'An unexplained difference found during reconciliation.' },
    { t: 'Thin file', d: 'A customer with little credit history, whom scoring systems serve badly.' }
  ],

  quiz: [
    { q: "What does KYC require of a product that handles money?",
      options: [
        "Verifying a customer's identity before they can hold or move money",
        "Reporting profits to regulators quarterly",
        "Encrypting all customer data",
        "Keeping customer funds in a separate bank"
      ],
      answer: 0,
      why: "KYC is identity verification at onboarding. In code it usually appears as a state machine where no transaction is permitted until verification completes." },

    { q: "Which is the best example of data minimisation?",
      options: [
        "Encrypting the full card number at rest",
        "Backing up data twice a day",
        "Storing data in a different country",
        "Not collecting a date of birth at all if the product never needs one"
      ],
      answer: 3,
      why: "The safest PII is the field you never stored. Minimisation reduces breach impact, compliance scope, and retention obligations simultaneously." },

    { q: "Why store a masked card number like `**** 4471` rather than the full PAN?",
      options: [
        "It uses less disk space",
        "Masking makes queries faster",
        "Storing full card numbers puts you in scope for PCI DSS and raises breach impact enormously",
        "Full card numbers cannot be stored in a database"
      ],
      answer: 2,
      why: "Full PANs carry a heavy security standard and severe consequences if leaked. Most products only ever need the last four digits to help a user recognise a card." },

    { q: "In a layered architecture, which dependency direction is allowed?",
      options: [
        "The interface may call services, but services must never know the interface exists",
        "Storage may call services",
        "Any layer may call any other",
        "Services may import the interface"
      ],
      answer: 0,
      why: "Dependencies that point one way are what make the middle testable and the interface swappable. A service calling st.write is the classic violation." },

    { q: "What does \"a test needs a browser\" tell you about a codebase?",
      options: [
        "The test framework is misconfigured",
        "The app is too fast to test",
        "Business logic is trapped inside the interface layer",
        "The tests are thorough"
      ],
      answer: 2,
      why: "Pure logic can be tested by importing a function. Needing a browser means the calculation and the UI are the same code." },

    { q: "What is the purpose of `__init__.py` in a folder?",
      options: [
        "It marks the folder as a package so it can be imported as a module path",
        "It runs when the app starts",
        "It stores configuration",
        "It initialises the database"
      ],
      answer: 0,
      why: "It makes `from neobank.ledger import Ledger` work. It may be empty; its presence is what matters." },

    { q: "Why does `loaders.py` build paths from `Path(__file__).resolve().parent.parent`?",
      options: [
        "Because pandas requires absolute paths",
        "To make the code shorter",
        "To hide the file location from users",
        "So data files are found regardless of which directory the app was started from"
      ],
      answer: 3,
      why: "Relative paths depend on the working directory, which is why \"it works on my machine\" happens. Anchoring to the module's own location removes the ambiguity." },

    { q: "What is reconciliation?",
      options: [
        "Correcting a failed payment",
        "Comparing internal records against an external source and explaining every difference",
        "Rebalancing a portfolio to target weights",
        "Merging two customer accounts"
      ],
      answer: 1,
      why: "Every real money system reconciles daily. An unexplained break is a bug, a timing difference, or fraud, and you cannot tell which without investigating." },

    { q: "Your ledger says $10,450 and the bank statement says $10,400. What is the correct response?",
      options: [
        "Ignore it, since it is under 1%",
        "Record the $50 break and investigate its cause before changing anything",
        "Adjust the ledger to match the statement",
        "Delete the most recent ledger entry"
      ],
      answer: 1,
      why: "Silently adjusting destroys the evidence and may be hiding a real problem. Ledgers are append-only: investigate, then post a documented correcting entry if one is warranted." },

    { q: "Which README section most signals professional maturity?",
      options: [
        "Limitations and next steps",
        "A complete list of every function",
        "The programming languages used",
        "A long installation troubleshooting guide"
      ],
      answer: 0,
      why: "Knowing and stating what your system does not do is the difference between a demo and an engineer. Overclaiming has the opposite effect on a reviewer." },

    { q: "What belongs at the very top of a portfolio README?",
      options: [
        "The licence",
        "One sentence on what it is, then a live link and a screenshot",
        "The full architecture diagram",
        "Your contact details"
      ],
      answer: 1,
      why: "A reviewer gives you about thirty seconds. A sentence, a link, and a picture is the fastest possible proof the thing is real." },

    { q: "Why must every dataset in your capstone be synthetic?",
      options: [
        "Real data is too large for GitHub",
        "Committing real personal or financial data is a serious privacy and legal risk, and history cannot be un-pushed",
        "Synthetic data produces better charts",
        "Regulators require open source projects to use synthetic data"
      ],
      answer: 1,
      why: "Repositories keep history forever and may become public. Generate realistic data instead, and say clearly in the README that it is generated." },

    { q: "Open banking is best summarised as:",
      options: [
        "Banks publishing their source code",
        "Cryptocurrency exchanges connecting to banks",
        "Regulated API access to a customer's bank data with their explicit, scoped, revocable consent",
        "Free banking for everyone"
      ],
      answer: 2,
      why: "The consent model is the part worth internalising: explicit, limited in scope, time limited, and revocable. Anything reading someone else's data should meet that bar." },

    { q: "Which question belongs in an ethics section for a fraud model?",
      options: [
        "How fast does the model train?",
        "How large is the dataset?",
        "Who is harmed when it is wrong, and can they find out why?",
        "Which library version was used?"
      ],
      answer: 2,
      why: "A false flag can strand someone at a checkout with no other way to pay. If your explanation is \"the model decided\", you have built something you cannot defend." },

    { q: "Which statement is the most honest in a capstone report?",
      options: [
        "\"This is a production-ready banking platform.\"",
        "\"No known limitations.\"",
        "\"The model is 99% accurate.\"",
        "\"The ledger is single-process; concurrent writes would need row-level locking.\""
      ],
      answer: 3,
      why: "A specific, technically accurate limitation demonstrates understanding. The other three are claims a reviewer will test in the first two minutes of an interview." }
  ],

  project: {
    title: 'NeoBank analytics, the capstone',
    story: 'One repository, one deployed application, and everything you have learned so far pulled together. Aim ' +
           'for something you would be glad to have an interviewer open in front of you.',
    scope: 'Uses everything from levels 2 through 9 and nothing new: your ledger, analytics, lending, risk, fraud and FX ' +
           'code, restructured into modules behind one Streamlit interface, with tests and documentation.',
    requirements: [
      'A public repository named `neobank-analytics` (or your own name) with the layered structure from the tutorial',
      'A `neobank/` package with at least five modules: ledger, analytics, lending, risk, fraud',
      'All data access confined to `loaders.py`, with schema validation and clear errors on malformed files',
      'No business logic in `app.py` and no `streamlit` import anywhere inside the package',
      'Ledger: double-entry, idempotent transfers, reversals, and an invariant check exposed in the UI',
      'Analytics: spending by category, monthly trend, recurring-charge detection, savings rate',
      'Lending: payment, schedule, total interest, and an overpayment comparison',
      'Risk: returns, volatility, Sharpe, max drawdown, correlation matrix, and VaR for a chosen weighting',
      'Fraud: engineered features, a scored review queue with reasons, and a stated threshold with its cost justification',
      'A reconciliation view comparing ledger balances against an external balances file, listing any breaks',
      'A Streamlit app with at least five navigable sections and a visible note that the data is synthetic',
      'A `tests/` suite of at least 20 tests across at least four modules, all passing with `pytest -q`',
      'Tests must include the ledger invariant, a refused overdraft that writes nothing, and an idempotent retry',
      '`data/generate.py` producing every dataset the app uses, so the repo is reproducible from scratch',
      'requirements.txt that works on a clean machine, and a .gitignore excluding .venv, __pycache__, and secrets',
      'Deployed to a public URL that loads and works on a phone',
      'A README with: a description in one line, live link, screenshot, features, architecture diagram, local run steps, test instructions, a statement that the data is synthetic, and a limitations-and-next-steps section',
      '`docs/architecture.md` explaining each layer and why the boundaries are where they are',
      'An ethics section answering: who is harmed when this is wrong, can they find out why, and who does it serve badly',
      'A three-minute demo script (written, or recorded) walking a stranger through the app'
    ],
    starter: {
      lang: 'text',
      code: 'neobank-analytics/\n  README.md\n  requirements.txt\n  .gitignore\n  app.py                    # Streamlit entry point: interface only\n  neobank/\n    __init__.py\n    ledger.py               # Level 4\n    analytics.py            # Level 3\n    lending.py              # Levels 2 + 6\n    risk.py                 # Level 7\n    fraud.py                # Level 8\n    fx.py                   # Level 5   (optional but recommended)\n    reconcile.py            # Level 10\n    loaders.py              # all file and network access\n  data/\n    generate.py             # produces every CSV below\n    transactions.csv\n    prices.csv\n    card_transactions.csv\n    external_balances.csv\n  tests/\n    test_ledger.py\n    test_lending.py\n    test_analytics.py\n    test_fraud.py\n  docs/\n    architecture.md\n    demo-script.md\n    screenshots/\n\n# Build order that works:\n#   1. Loaders.py + data/generate.py      (get data flowing)\n#   2. One service module + its tests     (prove the pattern)\n#   3. The remaining services + tests\n#   4. App.py, one section at a time\n#   5. Reconciliation, README, deploy\n'
    },
    tests: [
      'A fresh clone plus `pip install -r requirements.txt` then `pytest -q` passes with 20 or more tests',
      '`streamlit run app.py` starts with no errors on a machine that has never run the project',
      'grep for "streamlit" inside neobank/ returns nothing',
      'grep for "read_csv" outside loaders.py returns nothing',
      'Ledger invariant holds after every operation exercised by the test suite',
      'A refused overdraft leaves the entry count unchanged',
      'A repeated idempotency key returns the same transaction id and adds no entries',
      'Deleting a data file produces a clear error message, not a traceback',
      'Every app section renders with the default dataset',
      'The reconciliation view reports zero breaks on clean data and lists the break when one is introduced',
      'The deployed URL loads on a phone and every section is usable'
    ],
    rubric: [
      { pts: 20, t: 'It runs for a stranger', d: 'Clone, install, test, run: all from the README, with no undocumented steps.' },
      { pts: 20, t: 'Architecture', d: 'Clean layers, no logic in the interface, all data access in one module, imports pointing one way.' },
      { pts: 15, t: 'Integration', d: 'All five domains genuinely present and working together, not five disconnected demos.' },
      { pts: 15, t: 'Tests', d: '20+ meaningful tests across modules, covering invariants and refusals, all passing.' },
      { pts: 10, t: 'Deployed', d: 'A public URL that works on a phone.' },
      { pts: 10, t: 'Documentation', d: 'README that sells it in thirty seconds, plus an architecture document.' },
      { pts: 10, t: 'Judgement', d: 'Honest limitations, a real ethics section, and a reconciliation view that shows you know what a ledger is for.' }
    ],
    stretch: [
      'Replace CSV storage with SQLite and prove balances reconstruct identically from the entry table',
      'Add a scheduled GitHub Action that runs the test suite and the reconciliation job daily',
      'Add an audit log recording every ledger write with a timestamp and an actor',
      'Add a FastAPI service exposing the same engine, so one core serves both a UI and an API',
      'Write the case study: the problem, your design decisions, what you would change, and what you learned'
    ],
    solutionPath: 'solutions/level-10'
  },

  faq: [
    { q: 'ModuleNotFoundError: No module named "neobank"',
      a: 'Run from the project root (the folder containing app.py), not from inside the package. Confirm neobank/__init__.py exists.' },
    { q: 'How much of my old notebook code can I reuse?',
      a: 'All of it: that is the point. Strip the prints, turn globals into arguments, and move each function into the module that owns its domain.' },
    { q: 'How many tests are enough for the capstone?',
      a: 'Twenty across four modules is the floor. Prioritise invariants (the ledger balances), refusals (bad input raises), and known values (a payment you can verify by hand).' },
    { q: 'Can I use real bank data for realism?',
      a: 'No. Generate synthetic data instead. Repository history is permanent and may become public; committing real financial data is a serious privacy risk.' },
    { q: 'My app is slow after combining everything',
      a: 'Cache every data load with @st.cache_data and compute only what the selected section needs. Streamlit re-runs the entire script on every interaction.' },
    { q: 'What goes in the limitations section?',
      a: 'Concrete technical facts: single-process ledger, thresholds tuned on one static sample, risk statistics assuming the past resembles the future. Specific beats modest.' },
    { q: 'How do I present this in an interview?',
      a: 'Open the live URL, complete one user journey in ninety seconds, then show the ledger invariant test. Lead with a limitation you have already identified: it changes the whole conversation.' }
  ]
});
