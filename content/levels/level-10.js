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
    { p: 'Handling other people\'s money is one of the most regulated activities there is. You do not need to be a lawyer, ' +
         'but shipping a fintech product while unaware of these four obligations is how teams get shut down.' },
    { table: {
      head: ['Obligation', 'What it demands', 'What it means in your code'],
      rows: [
        ['**KYC**', 'Verify identity before a user holds money', 'An onboarding state machine; no transactions until verified'],
        ['**AML**', 'Detect and report suspicious patterns', 'Monitoring rules, alerts, case records, retained evidence'],
        ['**Data protection**', 'Lawful, minimal, secure use of personal data', 'Store less, encrypt, restrict access, log who read what'],
        ['**Audit and retention**', 'Reconstruct any decision years later', 'Append-only ledgers, immutable logs, versioned rules']
      ]
    }},
    { p: 'Notice how much of this is *engineering*, not paperwork. Append-only storage, immutable audit logs, and ' +
         'explainable decisions are architectural choices made early. Retrofitting them is close to impossible, which ' +
         'is why they belong in your capstone from the first commit.' },

    { h: 'PII: the data that changes your obligations' },
    { p: '**Personally Identifiable Information** is anything that identifies a person: name, address, national ID, ' +
         'card number, and (importantly) combinations that identify someone together, like a postcode plus a birth date.' },
    { ul: [
      '**Minimise**: do not collect what you do not need. The safest PII is the field you never stored.',
      '**Mask**: show `**** 4471`, not the full number. Full card numbers ("PAN") have their own standard, PCI DSS, and you do not want to be in scope for it.',
      '**Separate**: keep identity data apart from transaction data, joined by an opaque id.',
      '**Expire**: define how long you keep records, and actually delete them.',
      '**Log access**: in a regulated system, reading data is an event worth recording too.'
    ]},
    { warn: 'Never commit real personal data to a repository, even privately, even briefly. Every dataset in this course ' +
            'is synthetic for exactly this reason, and your capstone must be too. If you want realistic data, generate it.' },

    { h: 'Open banking, in one paragraph' },
    { p: 'Regulation in the UK, EU, and a growing list of countries requires banks to expose customer data through APIs ' +
         '**when the customer consents**. That is what lets a budgeting app read your bank transactions without asking for ' +
         'your password. The pattern that matters: **consent is explicit, scoped, time limited, and revocable**. ' +
         'If your product reads someone else\'s data, that is the standard you design to.' },

    { h: 'Architecture: layers and why they exist' },
    { code: 'interface        Streamlit pages, CLI, API endpoints\n     |           (no business logic: just input and display)\nservices         ledger, lending, risk, fraud, fx\n     |           (the rules. Pure where possible. Fully tested)\ndata             loaders, validators, synthetic generators\n     |           (everything that touches a file or a network)\nstorage          CSV / SQLite / append-only entry log', lang: 'text', label: 'four layers' },
    { p: 'The rule points one way: **upper layers may call lower ones, never the reverse**. Your ledger must not know ' +
         'a Streamlit page exists. Follow it and you can swap the interface, test the middle in isolation, and reason about ' +
         'one layer at a time. Break it and everything becomes one thing that can only be tested by clicking.' },
    { table: {
      head: ['Symptom', 'Layer violation'],
      rows: [
        ['A calculation calls `st.write`', 'Interface logic inside services'],
        ['A service reads a CSV path directly', 'Data access inside business rules'],
        ['A test needs a browser', 'Logic trapped in the interface'],
        ['Changing a chart breaks the ledger', 'No layer boundary at all']
      ]
    }},

    { h: 'Project structure a stranger can follow' },
    { code: 'neobank/\n  README.md            <- the front door\n  requirements.txt\n  .gitignore\n  app.py               <- Streamlit entry point\n  neobank/\n    __init__.py\n    ledger.py          <- Level 4\n    analytics.py       <- Level 3\n    lending.py         <- Levels 2 + 6\n    risk.py            <- Level 7\n    fraud.py           <- Level 8\n    fx.py              <- Level 5\n    loaders.py         <- data access, one place\n  data/                <- synthetic CSVs only\n  tests/\n    test_ledger.py\n    test_lending.py\n    test_fraud.py\n  docs/\n    architecture.md\n    screenshots/', lang: 'text' },
    { tip: 'A folder with an `__init__.py` is a **package**, so `from neobank.ledger import Ledger` works from anywhere ' +
           'in the project. One module per domain, and the filename tells a reviewer where to look.' },

    { h: 'The README is the product' },
    { p: 'A reviewer gives your repository about thirty seconds before deciding whether to read the code. The README is ' +
         'what they spend it on. In order:' },
    { ol: [
      '**One sentence** saying what it is and who it is for.',
      '**A live link and a screenshot**: the fastest possible proof it is real.',
      '**Features**, as five or six bullets of what it actually does.',
      '**Architecture**: the layer diagram and one line per module.',
      '**Run it locally**: commands that work when copied, in order.',
      '**Tests**: how to run them and what passes.',
      '**Data**: stated clearly as synthetic, with the generator script.',
      '**Limitations and next steps**: the section that signals seniority.'
    ]},
    { money: 'That last section is the one people skip and the one interviewers notice. Writing "this ledger is ' +
             'single-process and would need row-level locking to be concurrent" tells a reviewer you understand the ' +
             'difference between a demo and a system. Claiming production-readiness you do not have does the opposite.' },

    { h: 'Reconciliation: the daily ritual' },
    { p: 'Every real money system runs a **reconciliation** job: compare your ledger against an external source of truth ' +
         '(a bank statement, a processor\'s settlement file) and explain every difference. A break that nobody explains ' +
         'is either a bug, a timing difference, or fraud, and you cannot tell which until you look.' },
    { code: 'internal_total = sum(all ledger entries for the account)\nexternal_total = statement closing balance\nbreak         = internal_total - external_total\n\nif break != 0:\n    investigate, categorise, and record the explanation', lang: 'text' },
    { p: 'Including even a simple reconciliation check in your capstone puts you ahead of most student projects, because ' +
         'it shows you understand that a ledger is only trustworthy if something independent agrees with it.' },

    { h: 'Ethics is a design activity' },
    { p: 'You have now built things that decide who gets credit and whose card gets blocked. Three questions belong in ' +
         'your capstone report, and in every design review you will ever attend:' },
    { ul: [
      '**Who is harmed if this is wrong?** A false fraud flag strands someone at a checkout with no other payment method.',
      '**Can the person affected find out why?** If your answer is "the model decided", you have built something you cannot defend.',
      '**Who does this work badly for?** Systems trained on the average user fail thin-file customers, new arrivals, and irregular earners first.'
    ]},
    { p: 'Writing these answers down is not decoration. It is the difference between an engineer who ships features and ' +
         'one who can be trusted with a product that touches people\'s money.' }
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
