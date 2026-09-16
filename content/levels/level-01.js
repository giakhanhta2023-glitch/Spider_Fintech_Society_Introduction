/* =========================================================================
   Level 1: orientation and toolkit   (no build project: knowledge + setup)
   ========================================================================= */
FQ.registerLevel({
  id: 1,
  codename: 'onboarding',
  title: 'Fintech orientation and your zero-install toolkit',
  tagline: 'Find out what fintech really means, then get your own lab running in a browser tab. Nothing to install, about twenty minutes.',
  difficulty: 1,
  minutes: 60,
  tags: ['fintech basics', 'vocabulary', 'setup'],
  summary: 'Before you build anything, you need a map of the industry and a place to run code. ' +
           'This level gives you both, and you will not install a single thing.',

  objectives: [
    'Explain what fintech is and name the six sectors it is usually split into',
    'Trace the path of a card payment from tap to settlement',
    'Use the core vocabulary: ledger, rail, API, KYC, APR, neobank',
    'Run Python in your browser with Google Colab: no installation',
    'Create a GitHub account and put a notebook in a repository without touching a terminal'
  ],

  /* ==================== KNOWLEDGE ==================== */
  knowledge: [
    { h: 'What fintech actually means' },
    { p: '**Fintech** is short for *financial technology*: software that delivers, improves, or replaces a financial service. ' +
         'That is the whole definition. A bank app is fintech. A payment terminal in a coffee shop is fintech. ' +
         'A spreadsheet a loan officer uses to price a mortgage is, honestly, also fintech.' },
    { p: 'The reason fintech is a *career* and not just a word is that money has rules. Every product you build sits on top of ' +
         'accounting law, payment networks, regulators, and other people\'s systems. A photo-sharing app that loses a photo ' +
         'has a bug. A payments app that loses a dollar has a **breach of trust, an audit, and possibly a regulator on the phone**.' },
    { money: 'Fintech engineering is ordinary programming plus three unusual constraints: money must balance exactly, ' +
             'every action must be explainable afterwards, and you are never the only system that touches the transaction.' },

    { h: 'The six sectors you will hear about' },
    { table: {
      head: ['Sector', 'What it does', 'Examples of the problem'],
      rows: [
        ['**Payments**', 'Moves money between people and businesses', 'Cards, wallets, QR, cross-border transfers'],
        ['**Lending / credit**', 'Gives money now for repayment later', 'Loan pricing, credit scoring, buy-now-pay-later'],
        ['**Banking / neobanks**', 'Holds deposits and runs accounts', 'App-only banks with no branches'],
        ['**WealthTech / investing**', 'Helps people grow money', 'Robo-advisors, brokerages, portfolio tools'],
        ['**InsurTech**', 'Prices and pays out risk', 'Usage-based car insurance, instant claims'],
        ['**RegTech**', 'Keeps everyone legal', 'Anti-money-laundering checks, reporting, audit trails']
      ]
    }},
    { p: 'The projects in FinQuest walk through these one at a time: you will build calculators for lending, ' +
         'a ledger for payments, analytics for wealth, a detector for fraud, and a dashboard that ties them together.' },

    { h: 'How money actually moves: one card payment' },
    { p: 'You tap a card for a $10 coffee. It feels instant. It is not: what happened in that second is an *authorization*, ' +
         'and the money itself arrives days later.' },
    { ol: [
      '**Tap**: the card sends its details to the shop\'s terminal.',
      '**Acquirer**: the shop\'s payment provider (the *merchant acquirer*) receives the request and passes it on.',
      '**Card network**: Visa/Mastercard routes the request to the bank that issued your card.',
      '**Issuer**: your bank checks the balance, runs fraud rules, and answers **approve** or **decline**. This is the *authorization*: a promise, not a payment. Your available balance drops; the money has not moved.',
      '**Capture**: usually at end of day, the shop confirms the sale it wants to actually collect.',
      '**Settlement**: a day or three later, real money moves between banks in a batch, and the shop is paid ~$9.70 after fees.'
    ]},
    { tip: 'The gap between *authorization* and *settlement* is where a huge amount of fintech engineering lives: ' +
           'pending transactions, refunds, chargebacks, reconciliation, and "why does my balance look wrong?" support tickets.' },

    { h: 'Rails, ledgers, and the vocabulary that unlocks the rest' },
    { p: 'A **rail** is a pipe money travels along: card networks, bank transfers (ACH in the US, SEPA in Europe, ' +
         'Faster Payments in the UK, PromptPay/VietQR style instant schemes in Asia), and newer blockchain rails. ' +
         'Rails differ in speed, cost, reversibility, and limits, and choosing between them is a real product decision.' },
    { p: 'A **ledger** is the record of what money exists and who owns it. Your bank balance is not a number stored in a box; ' +
         'it is the *sum of every entry ever written to your account*. Ledgers are append-only: you never edit a mistake, ' +
         'you write a correcting entry. That is how the past stays auditable.' },
    { table: {
      head: ['Term', 'Plain-English meaning'],
      rows: [
        ['**API**', 'A doorway one program uses to ask another program for data or an action, over the internet'],
        ['**Ledger**', 'The append-only list of entries whose sum is a balance'],
        ['**KYC**', '*Know Your Customer*: legally verifying who a user is before they can hold money'],
        ['**AML**', '*Anti-Money-Laundering*: rules and monitoring that stop criminal money being cleaned'],
        ['**APR**', '*Annual Percentage Rate*: the yearly cost of borrowing including fees, stated as a percentage'],
        ['**Neobank**', 'A bank that exists only as an app, usually with no branches and often no banking licence of its own'],
        ['**PSP**', '*Payment Service Provider*: a company that handles payments for merchants (Stripe, Adyen, PayPal)'],
        ['**Settlement**', 'The moment real money actually changes hands between institutions']
      ]
    }},

    { h: 'One engineering rule you need before you write any code' },
    { p: 'Money is **not** a decimal number. `0.1 + 0.2` in almost every programming language gives `0.30000000000000004`, ' +
         'because computers store decimals in binary and 0.1 has no exact binary form. Multiply that tiny error by ten million ' +
         'transactions and you have a reconciliation problem that a human has to chase.' },
    { code: '>>> 0.1 + 0.2\n0.30000000000000004\n\n>>> 0.1 + 0.2 == 0.3\nFalse', lang: 'python', label: 'the classic float trap' },
    { p: 'Professional systems store money as **integers in the smallest unit** (cents, satoshi, dong) and only format to ' +
         'decimals for display. $10.45 is stored as `1045`. You will use floats for *rates and projections* (where a rounding ' +
         'error is harmless) and integers for *balances and ledgers* (where it is not). Level 4 builds a real ledger this way.' },
    { warn: 'If you remember one sentence from level 1: **never store a balance as a float**.' },

    { h: 'Why you will not be installing VS Code today' },
    { p: 'The fastest way to quit programming is to spend your first evening on installers, PATH variables, and version errors ' +
         'before writing a single line that does anything. So levels 1 to 8 of FinQuest run entirely in **Google Colab**: ' +
         'Python in a browser tab, with pandas, matplotlib and scikit-learn already installed, free, on any laptop.' },
    { p: 'You will only set up a local editor in level 9, when you have something worth deploying and the setup finally pays ' +
         'for itself. By then it will take ten minutes and make sense.' },
    { table: {
      head: ['Tool', 'What it is for', 'Cost / install'],
      rows: [
        ['**Google Colab**', 'Writing and running Python notebooks', 'Free, browser only'],
        ['**GitHub**', 'Storing your projects and reading the solution keys', 'Free, browser only'],
        ['**This site**', 'Knowledge, drills, briefs, and the AI tutor', 'Already open'],
        ['*(Level 9 only)* **Codespaces or local Python**', 'Running a real web app', 'Free tier / one installer']
      ]
    }},

    { h: 'How a FinQuest level works' },
    { ol: [
      '**Learn**: the knowledge page you are reading now.',
      '**Tutorial**: hands-on steps you follow in Colab, with every tool you will need for the project.',
      '**Drill**: 15 questions. You need 12 correct to unlock the project. Every answer has an explanation.',
      '**Build**: a project you can complete using *only* this level and the ones before it. Nothing new is required.',
      '**Compare**: a full solution key waits in the GitHub repo. Write yours first, then read theirs.'
    ]},
    { tip: 'Stuck at any point, hit the **Tutor** button in the top right (or Ctrl+K). It knows which level you are on.' }
  ],

  /* ==================== TUTORIAL ==================== */
  tutorial: {
    intro: 'Twenty minutes, two free accounts, zero installs. At the end you will have run Python in your browser and ' +
           'saved a notebook to your own GitHub repository.',
    steps: [
      {
        t: 'Open Google Colab and run your first cell',
        blocks: [
          { p: 'Go to [colab.research.google.com](https://colab.research.google.com) and sign in with any Google account. ' +
               'Choose **New notebook**. You now have a Python environment running on Google\'s servers.' },
          { p: 'A notebook is a stack of **cells**. A code cell runs Python and prints the result underneath it. ' +
               'Click the first cell, type this, and press **Shift + Enter** to run it.' },
          { code: 'print("FinQuest online")\n2 + 2', lang: 'python' },
          { p: 'The last expression in a cell is displayed automatically. That is why `4` appears without a `print`.' }
        ],
        check: 'You see "FinQuest online" and 4 printed below the cell.'
      },
      {
        t: 'Rename the notebook and learn the three shortcuts that matter',
        blocks: [
          { p: 'Click the title (*Untitled0.ipynb*) and rename it `finquest-level-01.ipynb`. Colab autosaves to your Google Drive.' },
          { ul: [
            '**Shift + Enter**: run the cell and move to the next one',
            '**Ctrl + Enter**: run the cell and stay where you are',
            '**Ctrl + M, B**: insert a new cell below (or use the **+ Code** button)'
          ]},
          { tip: 'If anything ever behaves strangely, use **Runtime → Restart session** and run your cells again from the top. ' +
                 'That fixes roughly 90% of notebook confusion, because cells remember everything you ran earlier, even code you deleted.' }
        ],
        check: 'Your notebook is renamed and you can add a new code cell without using the mouse.'
      },
      {
        t: 'Python in ten minutes: the five things you need',
        blocks: [
          { p: 'Everything in level 2 is built from these five ideas. Run each block and change the numbers.' },
          { h4: '1. Variables hold values' },
          { code: 'balance = 1045        # an integer: $10.45 stored as cents\nrate = 0.045          # a float: 4.5% as a decimal\nname = "Mai"          # a string\nis_verified = True    # a boolean\n\nprint(balance, rate, name, is_verified)', lang: 'python' },
          { h4: '2. f-strings format output for humans' },
          { code: 'principal = 1500\nprint(f"Deposit: ${principal:,.2f}")     # Deposit: $1,500.00\nprint(f"Rate: {0.045:.2%}")              # Rate: 4.50%', lang: 'python' },
          { p: 'The part after `:` is a format spec. `,.2f` means *thousands separator, two decimals*. `.2%` means ' +
               '*show as a percentage with two decimals*. You will use these constantly.' },
          { h4: '3. Functions package a calculation' },
          { code: 'def interest(principal, rate):\n    """Return one year of simple interest."""\n    return principal * rate\n\nprint(interest(1000, 0.05))   # 50.0', lang: 'python' },
          { warn: 'Python uses **indentation** (4 spaces) instead of braces. Everything indented under `def` belongs to the function. ' +
                  'An `IndentationError` almost always means a missing or extra space.' },
          { h4: '4. Loops repeat work' },
          { code: 'balance = 1000\nfor year in range(1, 4):          # 1, 2, 3\n    balance = balance * 1.05\n    print(f"Year {year}: ${balance:,.2f}")', lang: 'python' },
          { h4: '5. Lists hold many values' },
          { code: 'payments = [120, 95, 210]\nprint(len(payments))    # 3\nprint(sum(payments))    # 425\nprint(payments[0])      # 120  (counting starts at zero)', lang: 'python' }
        ],
        check: 'You can write a function, call it, and print a dollar amount with two decimal places.'
      },
      {
        t: 'Read an error message instead of panicking',
        blocks: [
          { p: 'Errors are the normal state of programming. Python tells you exactly what went wrong on the **last line** of the message, read that first.' },
          { code: 'total = "100" + 50', lang: 'python' },
          { code: 'TypeError: can only concatenate str (not "int") to str', lang: 'text', label: 'output' },
          { p: 'Translation: you tried to glue a number onto a piece of text. The fix is `int("100") + 50`. ' +
               'Three errors cover most of your first month:' },
          { table: {
            head: ['Error', 'What it really means'],
            rows: [
              ['`NameError`', 'You used a variable you never created (or a typo in the name)'],
              ['`TypeError`', 'Wrong kind of value, text where a number was needed'],
              ['`IndentationError`', 'Your spaces are inconsistent']
            ]
          }},
          { tip: 'Paste any error into the FinQuest tutor and ask "what does this mean?" That is what it is there for.' }
        ],
        check: 'You caused an error on purpose, read the last line, and fixed it.'
      },
      {
        t: 'Create your GitHub account',
        blocks: [
          { p: 'Go to [github.com/signup](https://github.com/signup). Pick a username you would put on a CV. ' +
               'This becomes part of your portfolio URL. Verify your email; that is all the setup required.' },
          { p: 'Vocabulary you need and nothing more:' },
          { table: {
            head: ['Word', 'Meaning'],
            rows: [
              ['**Repository (repo)**', 'One folder for one project, stored on GitHub'],
              ['**Commit**', 'A saved snapshot of your files with a short message'],
              ['**README**', 'The file GitHub shows on the repo\'s front page: your project\'s cover letter'],
              ['**Public / private**', 'Who can see it. Portfolio work should be public.']
            ]
          }},
          { warn: 'Never commit an API key, password, or real customer data. Public repos are indexed within minutes, ' +
                  'and bots scan GitHub for leaked keys continuously. Level 5 shows you how to keep secrets out of your code.' }
        ],
        check: 'You are logged in to github.com with a username you are happy to show people.'
      },
      {
        t: 'Make your portfolio repo: no terminal, no git commands',
        blocks: [
          { ol: [
            'On GitHub click **+ → New repository**.',
            'Name it `finquest-portfolio`. Set it to **Public**. Tick **Add a README file**. Click **Create repository**.',
            'Back in Colab, use **File → Save a copy in GitHub**. Authorise Colab the first time.',
            'Pick your `finquest-portfolio` repo, keep the filename, write the commit message `Level 1 notebook`, and click OK.'
          ]},
          { p: 'Colab pushes the notebook straight into your repo and opens the GitHub link. That is a real commit: ' +
               'you just used version control without learning git.' },
          { tip: 'Alternative route if you ever need it: on GitHub click **Add file → Upload files** and drag any file in. ' +
                 'Same result, works for CSVs, images, anything.' }
        ],
        check: 'Your notebook is visible on github.com inside your finquest-portfolio repository.'
      },
      {
        t: 'Find the solution keys (and how to use them honestly)',
        blocks: [
          { p: 'Every project from level 2 onward has a complete, commented solution in the FinQuest repo under `solutions/level-XX/`. ' +
               'Each folder holds the working code, a walkthrough README, and the quiz answer key.' },
          { p: 'The keys exist so you are never permanently stuck, but reading code teaches you far less than writing it. ' +
               'Use this order every time:' },
          { ol: [
            'Attempt the requirement yourself for at least 15 minutes.',
            'Ask the tutor for a **hint**: it is built to nudge, not to dump answers.',
            'Open the key, read only the part you are stuck on, close it.',
            'Type the fix yourself from memory. Never copy-paste a solution into your own project.'
          ]}
        ],
        check: 'You can open the solutions folder on GitHub and see the level folders.'
      }
    ]
  },

  /* ==================== GLOSSARY ==================== */
  glossary: [
    { t: 'Fintech', d: 'Technology that delivers, improves, or replaces a financial service.' },
    { t: 'Rail', d: 'A network money travels along, such as card networks, ACH, SEPA, or an instant payment scheme.' },
    { t: 'Ledger', d: 'An append-only record of entries whose running sum is a balance.' },
    { t: 'Authorization', d: 'The issuer\'s approval of a payment. A promise to pay; no money has moved yet.' },
    { t: 'Settlement', d: 'The point at which real money changes hands between institutions, usually days after authorization.' },
    { t: 'Acquirer', d: 'The payment provider on the merchant\'s side that receives card requests and routes them onward.' },
    { t: 'Issuer', d: 'The bank that issued the customer\'s card and decides to approve or decline.' },
    { t: 'KYC', d: 'Know Your Customer: legally required identity verification before someone can hold or move money.' },
    { t: 'AML', d: 'Anti-Money-Laundering: controls that detect and prevent criminal funds entering the system.' },
    { t: 'APR', d: 'Annual Percentage Rate: the yearly cost of borrowing including fees.' },
    { t: 'Neobank', d: 'An app-only bank with no branches, often operating on a partner bank\'s licence.' },
    { t: 'Minor units', d: 'The smallest unit of a currency (cents). Money is stored as integers of these to avoid float errors.' },
    { t: 'Notebook', d: 'A .ipynb file of runnable code cells and notes: the standard format for financial analysis in Python.' },
    { t: 'Repository', d: 'A GitHub folder holding one project and its history.' }
  ],

  /* ==================== 15-QUESTION DRILL ==================== */
  quiz: [
    { q: "Which definition of \"fintech\" is the most accurate?",
      options: [
        "Technology that delivers, improves, or replaces a financial service",
        "Cryptocurrency and blockchain products specifically",
        "The department of a bank that buys software",
        "Any startup that has raised venture capital"
      ],
      answer: 0,
      why: "Fintech is defined by what the technology does (serving a financial need) not by company size, funding, or a specific technology like blockchain." },

    { q: "A customer taps a card and the terminal says APPROVED. What has just happened?",
      options: [
        "Money moved from the customer's bank to the shop's bank",
        "The card network transferred funds instantly and irreversibly",
        "The issuing bank promised to pay: an authorization, not a transfer",
        "The shop's bank lent the shop the money"
      ],
      answer: 2,
      why: "Approval is an authorization: the issuer reserves the funds and promises payment. Actual money movement happens at settlement, typically one to three days later." },

    { q: "In a card payment, which party decides to approve or decline?",
      options: [
        "The payment terminal",
        "The merchant acquirer",
        "The issuing bank",
        "The card network (Visa/Mastercard)"
      ],
      answer: 2,
      why: "The issuer (the bank that gave the customer the card) checks the balance and fraud rules and returns the decision. The network only routes the message." },

    { q: "What is a \"rail\" in payments?",
      options: [
        "The physical cable connecting a terminal to the internet",
        "A network money travels along, such as cards, ACH, or SEPA",
        "The fee a merchant pays per transaction",
        "A regulation limiting transaction size"
      ],
      answer: 1,
      why: "Rails are the pipes money moves through. They differ in speed, cost, reversibility, and limits. Picking between them is a genuine product decision." },

    { q: "What makes a ledger different from simply storing a balance in a database column?",
      options: [
        "There is no real difference; the words are interchangeable",
        "A ledger is encrypted and a balance column is not",
        "A ledger can only be used by licensed banks",
        "A ledger is append-only, so the balance is the sum of entries and history stays auditable"
      ],
      answer: 3,
      why: "Ledgers never overwrite. Corrections are new entries, so you can always reconstruct how a balance came to be, which is exactly what auditors and support teams need." },

    { q: "KYC refers to:",
      options: [
        "Keep Your Cash: a liquidity rule",
        "Know Your Customer: verifying a user's identity as required by law",
        "Key Yield Calculation: a pricing method",
        "Known Yearly Cost: a lending disclosure"
      ],
      answer: 1,
      why: "KYC is the legally required identity verification done before a customer can hold or move money. It sits alongside AML monitoring." },

    { q: "Why do production systems store $10.45 as the integer 1045 rather than the float 10.45?",
      options: [
        "Binary floating point cannot represent most decimals exactly, so errors accumulate across many transactions",
        "Integers use less memory than floats",
        "Databases cannot store decimal points",
        "It makes currency conversion unnecessary"
      ],
      answer: 0,
      why: "Values like 0.1 have no exact binary representation, which is why 0.1 + 0.2 != 0.3. Tiny errors multiplied across millions of transactions break reconciliation, so balances are stored in minor units." },

    { q: "In Python, what does `0.1 + 0.2 == 0.3` evaluate to?",
      options: [
        "True",
        "It raises a TypeError",
        "It depends on the operating system",
        "False"
      ],
      answer: 3,
      why: "It is False. 0.1 + 0.2 produces 0.30000000000000004 because of binary floating point, the reason money belongs in integers." },

    { q: "Which tool lets you write and run Python with no installation at all?",
      options: [
        "Visual Studio Code",
        "Google Colab",
        "GitHub Desktop",
        "Microsoft Excel"
      ],
      answer: 1,
      why: "Colab runs notebooks on Google's servers in a browser tab, with pandas, matplotlib, and scikit-learn already available." },

    { q: "In a Colab notebook, what does Shift + Enter do?",
      options: [
        "Saves the notebook to Google Drive",
        "Restarts the Python session",
        "Runs the current cell and moves to the next one",
        "Inserts a new cell above"
      ],
      answer: 2,
      why: "Shift + Enter runs and advances; Ctrl + Enter runs and stays put. Restarting is done from the Runtime menu." },

    { q: "Your notebook throws `NameError: name \"blance\" is not defined`. What is the most likely cause?",
      options: [
        "Python ran out of memory",
        "You need to install a library",
        "The value is too large for an integer",
        "You misspelled a variable name, or never created it"
      ],
      answer: 3,
      why: "A NameError means Python has never seen that name. It is nearly always a typo or a cell you have not run yet." },

    { q: "What is a GitHub repository?",
      options: [
        "One folder holding one project, with its file history",
        "A backup of your entire hard drive",
        "A database of financial market data",
        "A paid hosting plan for websites"
      ],
      answer: 0,
      why: "A repo is one project plus its commit history. Your portfolio repo will hold your FinQuest notebooks." },

    { q: "Which action is genuinely dangerous?",
      options: [
        "Committing a file containing your API key to a public repository",
        "Renaming a notebook after you created it",
        "Making a repository public",
        "Uploading a .ipynb notebook through the GitHub web interface"
      ],
      answer: 0,
      why: "Bots scan public GitHub for leaked credentials within minutes of a push. Keys belong in environment variables: covered in level 5." },

    { q: "APR stands for Annual Percentage Rate. What does it express?",
      options: [
        "The bank's profit margin on deposits",
        "The annual return of a stock portfolio",
        "The yearly cost of borrowing, including fees",
        "The percentage of loan applications approved"
      ],
      answer: 2,
      why: "APR is a borrowing-cost disclosure that folds fees into a single yearly percentage so different loans can be compared. Level 6 builds it properly." },

    { q: "What unlocks a FinQuest project?",
      options: [
        "Reading the knowledge page",
        "Scoring at least 12 of 15 on the level drill",
        "Completing the previous project",
        "Paying for a subscription"
      ],
      answer: 1,
      why: "Each drill needs 12/15 (80%) to unlock its project, and the project must be marked complete before the next level opens." }
  ],

  /* ==================== SETUP CHECKLIST (instead of a project) ==================== */
  setup: {
    title: 'Mission zero: get your lab running',
    story: 'There is no build project this time, and that is on purpose. All you need by the end is a lab that works ' +
           'and enough vocabulary to hold your own in a conversation. Tick everything below and level 2 opens.',
    checklist: [
      'Signed in to Google Colab and created a notebook called finquest-level-01.ipynb',
      'Ran a cell with print("FinQuest online") and saw the output',
      'Wrote a function that takes two arguments and returns a number',
      'Printed a dollar amount with an f-string, formatted to two decimal places',
      'Caused an error on purpose and read the last line of the message',
      'Created a GitHub account with a portfolio-worthy username',
      'Created a public repository called finquest-portfolio with a README',
      'Saved your level 1 notebook into that repository from Colab',
      'Opened the FinQuest solutions folder on GitHub and found the level folders'
    ],
    solutionPath: 'solutions/level-01'
  },

  /* ==================== TUTOR KNOWLEDGE ==================== */
  faq: [
    { q: 'Do I need to install Python?',
      a: 'No. Levels 1 to 8 run entirely in Google Colab in your browser. You only set up a local environment in level 9, ' +
         'when you deploy a real web app and the setup finally earns its keep.' },
    { q: 'Colab asks me to sign in / my notebook will not save',
      a: 'Colab saves to Google Drive, so you need to be signed in to a Google account. If saving fails, use File → Save a copy ' +
         'in Drive, or File → Download → .ipynb to keep a local copy.' },
    { q: 'My cell runs but nothing prints',
      a: 'Only the last expression in a cell is auto-displayed. If you assign a value (x = 5) nothing shows. Add print(x), ' +
         'or put the bare variable name on the last line.' },
    { q: 'What is the difference between authorization and settlement?',
      a: 'Authorization is the issuer approving the payment and reserving funds. It is a promise. Settlement is the actual ' +
         'movement of money between banks, usually one to three days later, in a batch.' },
    { q: 'Why can I not just use floats for money?',
      a: 'Binary floating point cannot represent most decimals exactly, so 0.1 + 0.2 is 0.30000000000000004. Across millions of ' +
         'transactions the drift becomes real money. Store balances as integer minor units (cents) and format only for display.' },
    { q: 'How do I put my notebook on GitHub?',
      a: 'In Colab: File → Save a copy in GitHub, authorise once, pick your repo, write a commit message, click OK. ' +
         'No terminal and no git commands needed.' }
  ]
});
