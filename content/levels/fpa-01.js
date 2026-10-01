/* =========================================================================
   ANALYST TRACK, LEVEL 1: the lab, before any of the work
   ========================================================================= */
FQ.registerLevel({
  id: 101,
  track: 'fpa',
  position: 1,
  codename: 'lab',
  title: 'Mission zero: a lab that works',
  tagline: 'No build this time. A place to run code, an account to keep it in, and enough words to follow the next four levels without guessing.',
  difficulty: 1,
  minutes: 90,
  tags: ['setup', 'colab', 'python', 'github'],
  summary: 'This track assumes you can already use a spreadsheet and assumes nothing else. Before the first query ' +
           'there is an evening of setup: somewhere to run Python that needs no installation, the eight pieces of ' +
           'Python the rest of the track uses, a GitHub account that will hold your work, and the vocabulary that ' +
           'makes the next four levels readable rather than intimidating.',

  objectives: [
    'Run Python in a browser with nothing installed, and read the course data from a URL',
    'Write the eight pieces of Python the whole track is built from',
    'Read an error message instead of being stopped by one',
    'Explain what a library, a package manager and a terminal are, in a sentence each',
    'Create a GitHub account and a portfolio repository that will hold four builds',
    'Install Python locally for the levels that become a folder of files rather than a notebook'
  ],

  knowledge: [
    { h: 'What this track is, and what it is not' },
    { p: 'You can use a spreadsheet. This track does not teach that, and it does not think less of it: a workbook is ' +
         'the interface finance runs on, and it will still be open on your second screen for the rest of your ' +
         'career. What it teaches is the half of the job a workbook cannot do.' },
    { table: {
      head: ['A spreadsheet is the right tool for', 'And the wrong one for'],
      rows: [
        ['Looking at a number and arguing about it', 'Doing the same thing identically every month'],
        ['A model somebody will read and change', 'Anything with more rows than the screen'],
        ['Showing your working to a person', 'Refusing to produce an answer it cannot defend'],
        ['One off analysis you will throw away', 'Joining two systems that disagree']
      ]
    }},
    { p: 'The right column is this track. Four levels: ask a database the questions the export never answers, write ' +
         'the monthly pack as a program that refuses to print when it is wrong, build a forecast whose balance sheet ' +
         'balances in every scenario, and join all of it into one command.' },
    { money: 'The one number worth knowing before you start: the pack in level 3 takes about ninety minutes a month ' +
             'by hand and 39 milliseconds as a script. **The time saved is the least interesting part of that.** ' +
             'What changes is that the checks run every single time, and nobody can paste a value over a formula.' },

    { h: 'Where the code runs' },
    { p: 'Two places, and you will use both. Start with the first.' },
    { table: {
      head: ['', 'Google Colab', 'Python on your own machine'],
      rows: [
        ['What it is', 'A notebook in a browser tab, free, nothing to install', 'The real thing, in a folder, run from a terminal'],
        ['Good for', 'Levels 2 and 3: querying, exploring, one off analysis', 'Levels 4 and 5, which are folders of files with tests'],
        ['The catch', 'It forgets everything when you close it unless you save to Drive or GitHub', 'An evening of setup, once'],
        ['Start here', '**Yes**', 'Later in this level, and it is fine to come back to it']
      ]
    }},
    { p: 'Nobody serious writes a monthly process in a notebook, and nobody serious explores a new dataset in a ' +
         'folder of modules. Knowing which is which is part of the skill.' },

    { h: 'The eight pieces of Python this track uses' },
    { p: 'Not a programming course. Eight things, and every line in the next four levels is built from them:' },
    { table: {
      head: ['', 'Looks like', 'In a sentence'],
      rows: [
        ['A **variable**', '`month = "2025-09"`', 'A name for a value, so you write it once'],
        ['A **string**', '`"Cloud hosting"`', 'Text. Quotes are what make it text rather than a name'],
        ['A **number**', '`3361050.34`', 'No commas, no dollar sign, no percent. Those are formatting'],
        ['A **list**', '`["alice", "bob"]`', 'Several things in order, counted from zero'],
        ['A **dictionary**', '`{"4000": "Transaction fees"}`', 'A lookup: give it a key, get a value. The VLOOKUP of Python'],
        ['A **function**', '`def fee(amount): return amount * 0.029`', 'A named calculation you can call again'],
        ['A **loop**', '`for row in rows:`', 'Do this once for each of those'],
        ['An **f-string**', '`f"revenue {total:,.0f}"`', 'Build text with numbers in it, formatted the way you want']
      ]
    }},
    { warn: 'Python counts from **zero**, so the first item of a list is `rows[0]`. Spreadsheets count from one. This ' +
            'will catch you twice and then never again.' },

    { h: 'Libraries, pip, and the terminal' },
    { p: 'Three words that sound like infrastructure and are each one idea.' },
    { p: '**A library is somebody else\'s code that you use.** `pandas` is a library for tables, `sqlite3` is a ' +
         'library for databases, `matplotlib` draws charts. You write `import pandas as pd` at the top and then use ' +
         'it. Colab already has the ones this track needs.' },
    { p: '**pip is how you get a library onto your own machine.** `pip install pandas`, once, in a terminal. It is ' +
         'the app store for Python code and it is free.' },
    { p: '**A terminal is a window where you type a command and the computer runs it.** No icons, no mouse. You will ' +
         'type perhaps five commands all track, and the one you will type most is `python close.py`. It is not a ' +
         'test of character, it is a text box.' },
    { tip: 'Everything in this track also works in VS Code, PyCharm or any editor you prefer. The course does not ' +
           'care. If you have never installed one, do not start now: Colab first, a text editor later.' },

    { h: 'Why a GitHub account, when you are not a developer' },
    { p: 'Two reasons, and the second is the one that gets you a job.' },
    { p: 'The first is **history**. Git keeps every version of every file with a note about what changed, which is ' +
         'the thing finance teams fake with `budget_v4_FINAL_v2_jm.xlsx`. The second is that **a hiring manager can ' +
         'open a link**. A repository with four builds in it, each with a README saying what it does and what it ' +
         'produced, is evidence in a way a line on a CV is not.' },
    { warn: 'Nothing real goes in a public repository. No client names, no actual company numbers, no credentials, ' +
            'no exports from your employer. Everything in this course is synthetic for exactly that reason, and that ' +
            'habit is one somebody will check.' },
    { check: {
      q: 'Your manager asks why you are learning SQL when the finance system already has a reports tab. What is the ' +
         'honest answer?',
      a: 'That the reports tab answers the questions somebody anticipated, and the useful questions are the ones ' +
         'nobody did: which merchants drove the September upside, whether the new customers pay later than the old ' +
         'ones, what share of revenue sits in the five biggest accounts. Each of those is currently a request, a ' +
         'queue and a file that answers yesterday\'s question. The second half of the answer is that the reports tab ' +
         'cannot be checked against anything: one of the first things this track teaches is tying a number to a ' +
         'second source before publishing it, which is the difference between a report and a number somebody can ' +
         'sign.'
    }},

    { h: 'How a level works' },
    { p: 'Four parts, in this order, and the order matters.' },
    { table: {
      head: ['', 'What it is', 'How long'],
      rows: [
        ['**Learn**', 'The ideas, with the real numbers worked through', '20 to 30 minutes'],
        ['**Tutorial**', 'Follow along, typing it yourself. Every line the build needs is introduced here', '40 to 90 minutes'],
        ['**Drill**', '15 questions. 12 right opens the build', '10 minutes'],
        ['**Build**', 'Something to make with only what you have just learned, with a full solution if you get stuck', 'An evening or two']
      ]
    }},
    { p: 'The solutions are public from the start, which is deliberate. Attempt the build, get stuck, read the part ' +
         'you are stuck on, close it and retype the fix from memory. Copying a solution into your own repository ' +
         'skips the only step that teaches anything, and an interviewer finds that out in ninety seconds.' }
  ],

  tutorial: {
    intro: 'About ninety minutes, and no build at the end of it. Work through it in order: everything after step 4 ' +
           'is optional tonight and necessary by level 4.',
    steps: [
      {
        t: 'Open Colab and run one line',
        blocks: [
          { p: 'Go to **colab.research.google.com**, sign in with a Google account, and choose **New notebook**. You ' +
               'are now looking at an empty cell. Type this and press **Shift and Enter** together:' },
          { code: 'print("FinQuest online")', lang: 'python' },
          { p: 'That is the whole loop you will repeat for the rest of the track: type in a cell, run it, read what ' +
               'comes back. Rename the notebook `finquest-analyst-01.ipynb` by clicking its name at the top left.' },
          { tip: 'Three shortcuts are worth learning tonight. **Shift and Enter** runs a cell and moves on, ' +
                 '**Ctrl and Enter** runs it and stays, and **Ctrl and M then B** adds a cell below.' }
        ],
        check: 'The words FinQuest online appear under the cell.'
      },
      {
        t: 'The eight pieces, in one cell each',
        blocks: [
          { p: 'Type these rather than copying them. The typing is the point: it is how the shapes become familiar.' },
          { code: 'month = "2025-09"              # a variable holding a string\nrevenue = 3361050.34           # a number: no commas, no dollar sign\n\naccounts = ["alice", "bob", "carol"]        # a list\nprint(accounts[0])                          # counts from zero: alice\n\nnames = {"4000": "Transaction fees", "6100": "Marketing"}   # a dictionary\nprint(names["4000"])                        # Transaction fees\n\ndef fee(amount, rate=0.029):   # a function, with a default\n    return amount * rate\n\nprint(fee(2500))               # 72.5\n\nfor code in names:             # a loop over the keys\n    print(code, names[code])\n\nprint(f"revenue {revenue:,.0f} in {month}")   # an f-string\n# revenue 3,361,050 in 2025-09', lang: 'python' },
          { p: 'The `:,.0f` inside the f-string is the formatting: a thousands comma and no decimal places. That is ' +
               'the same idea as a number format in a spreadsheet, written where the number is printed rather than ' +
               'attached to a cell.' }
        ],
        check: 'All seven prints produce what the comments say they will.'
      },
      {
        t: 'Read the course data without downloading anything',
        blocks: [
          { p: 'Every file this track uses is in the repository and readable by URL. One line gets you the ledger ' +
               'that levels 2 and 3 are built on:' },
          { code: 'import pandas as pd\n\nURL = "{{RAW}}/data/fpa-actuals.csv"\nledger = pd.read_csv(URL)\n\nprint(ledger.shape)      # (318, 9)\nledger.head()', lang: 'python' },
          { p: '`import pandas as pd` is the library line: pandas is now available, under the short name `pd`. ' +
               '`read_csv` reads a comma separated file, which is what a spreadsheet looks like with the formatting ' +
               'taken away. `shape` is rows and columns, and `head()` shows the first five rows.' },
          { warn: 'If the URL is blocked on your network, download the file from the repository and drag it into ' +
                  'the file pane on the left of Colab, then read it as `pd.read_csv("fpa-actuals.csv")`.' }
        ],
        check: '(318, 9) and a table with journal_id, month, account_code and amount in it.'
      },
      {
        t: 'Break something on purpose',
        blocks: [
          { p: 'Errors are the normal condition of writing code, and the only skill is reading them. Run this:' },
          { code: 'ledger["amont"]        # a typo: there is no such column', lang: 'python' },
          { p: 'You get a wall of red. **Read the last line first**, always: it names the problem, and the lines ' +
               'above it are the path the computer took to get there.' },
          { code: 'KeyError: \'amont\'', lang: 'text' },
          { p: 'A `KeyError` means you asked for a name that does not exist. `NameError` means you used a variable ' +
               'you never created. `TypeError` means you did something to the wrong kind of thing, like adding a ' +
               'number to text. Those three cover most of what you will hit this track.' },
          { tip: 'When the last line is not enough, paste it into a search engine without your own file names in it. ' +
                 'Somebody has had that exact error, in public, since about 2009.' }
        ],
        check: 'You can say in one sentence what the last line of an error means.'
      },
      {
        t: 'A GitHub account and a repository',
        blocks: [
          { p: 'Go to **github.com**, sign up, and choose a username you would put on a CV: your name, or your name ' +
               'and a number. Not a joke you chose at eighteen.' },
          { p: 'Then **New repository**, named `finquest-analyst`, public, with a README ticked. That README is the ' +
               'first thing anybody opening the link reads, so put two sentences in it: who you are and what the ' +
               'repository holds.' },
          { p: 'Saving a Colab notebook into it needs no git commands at all: **File, Save a copy in GitHub**, pick ' +
               'the repository, write a one line message about what changed.' },
          { warn: 'Public means public. No employer data, no client names, no passwords or keys in a notebook. If ' +
                  'you want to practise on your own company\'s numbers, do it in a private repository or not at all.' }
        ],
        check: 'github.com/your-name/finquest-analyst exists, is public, and has your level 1 notebook in it.'
      },
      {
        t: 'Python on your own machine, for later',
        blocks: [
          { p: 'Levels 4 and 5 are folders of files with tests rather than notebooks, so at some point you need ' +
               'Python locally. Tonight is a good time, and so is the evening before level 4.' },
          { code: '1. python.org/downloads  ->  the big yellow button\n   On Windows, tick "Add python.exe to PATH" on the first screen.\n\n2. Open a terminal:\n     Windows   press the Start key, type "terminal"\n     macOS     press Command and Space, type "terminal"\n\n3. Check it arrived:\n     python --version        ->  Python 3.11.x or newer\n\n4. Get the three libraries this track uses:\n     pip install pandas matplotlib pytest', lang: 'text' },
          { p: 'That is the whole installation. `sqlite3`, the database in level 2, comes with Python and needs ' +
               'nothing.' },
          { tip: 'If `python` is not found on Windows, you missed the PATH checkbox. Re-run the installer, choose ' +
                 'Modify, and tick it. On macOS try `python3` and `pip3` instead.' }
        ],
        check: '`python --version` prints 3.11 or newer, and `pip install pandas` finishes without an error.'
      },
      {
        t: 'Prove the lab works',
        blocks: [
          { p: 'One script checks everything at once. Save it as `check_setup.py` and run `python check_setup.py`, ' +
               'or paste it into a Colab cell.' },
          { code: 'import sys\n\nprint("python", sys.version.split()[0])\n\nfor name in ["pandas", "sqlite3", "matplotlib"]:\n    try:\n        module = __import__(name)\n        print("ok  ", name)\n    except ImportError:\n        print("MISSING", name, "  ->  pip install", name)\n\nimport pandas as pd\nledger = pd.read_csv("{{RAW}}/data/fpa-actuals.csv")\nprint("the course data loads:", ledger.shape)', lang: 'python' },
          { p: 'The full version of this, with a few more checks and a friendlier report, is in the solutions folder ' +
               'for this level. Run yours first.' }
        ],
        check: 'Python 3.11 or newer, three libraries present, and the ledger loading at (318, 9).'
      }
    ]
  },

  glossary: [
    { t: 'Colab', d: 'Google\'s free Python notebook in a browser tab. Nothing to install, forgets everything unless you save it.' },
    { t: 'Notebook', d: 'A document of cells you run one at a time. Good for exploring, wrong for anything monthly.' },
    { t: 'Cell', d: 'One block of code in a notebook. Shift and Enter runs it.' },
    { t: 'Library', d: 'Somebody else\'s code that you import and use. pandas, sqlite3, matplotlib.' },
    { t: 'import', d: 'The line that makes a library available: `import pandas as pd`.' },
    { t: 'pip', d: 'The command that installs a library on your own machine: `pip install pandas`.' },
    { t: 'Terminal', d: 'A window where you type a command and the computer runs it. Five commands all track.' },
    { t: 'CSV', d: 'Comma separated values: a spreadsheet with the formatting taken away. One row per line.' },
    { t: 'DataFrame', d: 'A table in pandas: named columns, typed values. What a sheet becomes once it is in Python.' },
    { t: 'Variable', d: 'A name for a value, so you write the value once.' },
    { t: 'Function', d: 'A named calculation you can call again, written with def.' },
    { t: 'Dictionary', d: 'A lookup from a key to a value. The VLOOKUP of Python.' },
    { t: 'f-string', d: 'Text with values built into it: f"revenue {total:,.0f}".' },
    { t: 'Traceback', d: 'The wall of red after an error. Read the last line first.' },
    { t: 'Git', d: 'Version history for files, with a note on every change. What budget_v4_FINAL_v2.xlsx is pretending to be.' },
    { t: 'Repository', d: 'A project folder with its history. Public ones can be opened by a hiring manager.' },
    { t: 'README', d: 'The first file anybody reads in a repository. Two sentences beats nothing by a mile.' }
  ],

  quiz: [
    { q: "Where should you run the SQL and pandas levels, 2 and 3?",
      options: [
        "In Google Colab, which needs no installation and is right for querying and exploring",
        "In a terminal, writing files by hand",
        "In a local Python installation, because notebooks are not professional",
        "In Excel, using the Python integration"
      ],
      answer: 0,
      why: "Colab removes the entire installation problem for the levels that are about asking questions. The later levels become folders of files, and that is when a local Python earns its evening." },

    { q: "What is a library, in one sentence?",
      options: [
        "A paid add-in for Python",
        "The place a notebook saves its history",
        "Somebody else's code that you import and use, like pandas for tables",
        "A folder where Python keeps your files"
      ],
      answer: 2,
      why: "pandas, sqlite3 and matplotlib are libraries. `import pandas as pd` is you borrowing years of somebody else's work in one line." },

    { q: "What does `pip install pandas` do?",
      options: [
        "Updates Python itself",
        "Creates a new notebook",
        "Downloads the pandas library onto your machine so you can import it",
        "Runs pandas"
      ],
      answer: 2,
      why: "pip is the package manager: it fetches libraries. You need it on your own machine and not in Colab, which already has the common ones." },

    { q: "In Python, what is the first item of the list `[\"alice\", \"bob\", \"carol\"]`?",
      options: [
        "rows.first()",
        "rows[0]",
        "rows[1]",
        "rows[\"alice\"]"
      ],
      answer: 1,
      why: "Python counts from zero. Spreadsheets count from one. This catches everybody twice and then never again." },

    { q: "An error ends with `KeyError: 'amont'`. What does that mean?",
      options: [
        "Python ran out of memory",
        "The network is down",
        "The file is corrupt",
        "You asked for a name that does not exist, in this case a mistyped column"
      ],
      answer: 3,
      why: "A KeyError is asking for a key that is not there. Read the last line of a traceback first: it names the problem, and the lines above it are only the path that reached it." },

    { q: "Which of these is formatting rather than a number?",
      options: [
        "3361050.34",
        "$3,361,050",
        "0.58",
        "318"
      ],
      answer: 1,
      why: "Commas, currency symbols and percent signs are how a number is shown, not what it is. In Python the number is bare and the formatting happens at the moment you print it." },

    { q: "What does `f\"revenue {total:,.0f}\"` produce when total is 3361050.34?",
      options: [
        "revenue 3,361,050",
        "revenue {total}",
        "revenue 3361050.34",
        "revenue 3.36e6"
      ],
      answer: 0,
      why: "The part after the colon is the format: a thousands comma and no decimals. It is the same idea as a cell format, written where the value is printed." },

    { q: "Why does the course insist that every dataset in it is synthetic?",
      options: [
        "To avoid paying for a data provider",
        "Because synthetic data is easier to analyse",
        "Real data is too large for a course",
        "So that nothing in a public repository could ever be somebody's real financial data"
      ],
      answer: 3,
      why: "Your repository is public and a hiring manager will open it. The habit of never putting employer or client data where strangers can read it is one somebody will check." },

    { q: "What is git actually giving you?",
      options: [
        "A way to run Python in the cloud",
        "Every version of every file with a note on what changed, which is what budget_v4_FINAL_v2.xlsx is pretending to be",
        "Somewhere to store large files",
        "Automatic backups of your laptop"
      ],
      answer: 1,
      why: "History with reasons attached. The second reason is that a public repository is a link a hiring manager can open, which a line on a CV is not." },

    { q: "Which task belongs in a spreadsheet rather than in code?",
      options: [
        "Joining the billing system to the general ledger",
        "The month end pack, produced identically every month",
        "A quick look at a number somebody is arguing about in a meeting",
        "A forecast that must balance in four scenarios"
      ],
      answer: 2,
      why: "Spreadsheets are excellent for looking and arguing. They are poor at doing the same thing identically every month, which is the whole of the rest of this track." },

    { q: "What is a CSV file?",
      options: [
        "A database",
        "A compressed spreadsheet",
        "A file only Python can read",
        "Plain text, one row per line, values separated by commas: a sheet with the formatting removed"
      ],
      answer: 3,
      why: "No formulas, no colours, no merged cells. It is the lowest common denominator every finance system can export, which is why every file in this course is one." },

    { q: "What does `import pandas as pd` do?",
      options: [
        "Makes the pandas library available under the short name pd",
        "Installs pandas",
        "Reads a CSV file",
        "Starts a notebook"
      ],
      answer: 0,
      why: "Importing is borrowing: pip puts the library on the machine, import brings it into this file. The `as pd` is a convention everybody uses, so your code reads like everybody else's." },

    { q: "Your notebook worked yesterday and today a variable is undefined. What happened?",
      options: [
        "The notebook forgot everything when it closed. The cells need running again, in order",
        "pandas was updated",
        "The data URL changed",
        "Colab lost your file"
      ],
      answer: 0,
      why: "A notebook keeps its text but not its memory. That is also why anything that must run every month belongs in a file rather than in cells somebody has to run in the right order." },

    { q: "What is the right way to use the published solutions?",
      options: [
        "Read all of them before starting the level",
        "Avoid them completely",
        "Attempt the build, get stuck, read the part you are stuck on, close it and retype the fix from memory",
        "Copy the solution into your repository and move on"
      ],
      answer: 2,
      why: "Copying skips the only step that teaches anything, and an interviewer asking \"why does this line exist\" finds that out in ninety seconds." },

    { q: "What does this level ask you to produce?",
      options: [
        "Nothing at all",
        "A working lab: Colab running, the course data loading, a GitHub repository, and Python installed for later",
        "A SQL query",
        "A variance pack"
      ],
      answer: 1,
      why: "There is no build this time on purpose. An evening spent on installers is the most common reason people stop before writing anything that works." }
  ],

  setup: {
    title: 'Mission zero: a lab that works',
    story: 'There is no build project this time, and that is deliberate. By the end of the evening you need a place ' +
           'to run code, the course data loading in one line, somewhere public to keep what you make, and enough ' +
           'vocabulary that the next four levels read as instructions rather than as noise.',
    checklist: [
      'Signed in to Google Colab and created a notebook called finquest-analyst-01.ipynb',
      'Ran a cell with print("FinQuest online") and saw the output',
      'Written each of the eight pieces of Python at least once, by typing rather than pasting',
      'Loaded the course ledger from its URL and seen (318, 9)',
      'Caused an error on purpose and read the last line of it',
      'Created a GitHub account with a username you would put on a CV',
      'Created a public repository called finquest-analyst with a README of two sentences',
      'Saved your level 1 notebook into it from Colab, with a message saying what changed',
      'Installed Python 3.11 or newer locally and run python --version in a terminal',
      'Run pip install pandas matplotlib pytest without an error',
      'Run check_setup.py and seen every line say ok'
    ],
    solutionPath: 'solutions/fpa-01'
  },

  faq: [
    { q: 'I have never written a line of code. Is this track going to work?',
      a: 'Yes, and that is who it is written for. The eight pieces in this level are the whole of the Python the ' +
         'first three levels use, and level 4 adds exactly one more idea. The hard parts of this track are the ' +
         'finance judgements, which you already have, rather than the syntax.' },
    { q: 'Do I really need GitHub if I only want the skills?',
      a: 'For the skills, no. For the job, yes, and it costs an hour. Four builds with a README each is the single ' +
         'most useful artefact you can have in an interview for a finance role that touches data, because almost ' +
         'nobody applying has one.' },
    { q: 'Colab or a local Python?',
      a: 'Colab tonight, local before level 4. Levels 2 and 3 are about asking questions, which is what notebooks ' +
         'are for. Levels 4 and 5 are a folder of files with tests, which is what a notebook is bad at.' },
    { q: 'My company blocks Colab and GitHub.',
      a: 'Most do. Use a personal machine for the course, which you should be doing anyway: nothing in this track ' +
         'should touch employer data, and the habit of keeping the two apart is worth more than the convenience.' },
    { q: 'How long is this track, honestly?',
      a: 'Four builds at an evening or two each, plus this setup. Three to four weeks at a few evenings a week, and ' +
         'the pace that matters is whether you can explain what you built rather than whether you finished it.' }
  ]
});
