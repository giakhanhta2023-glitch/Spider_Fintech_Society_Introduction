/* =========================================================================
   LEVEL 9: Shipping a fintech service
   ========================================================================= */
FQ.registerLevel({
  id: 9,
  codename: 'deploy',
  title: 'Shipping a fintech service',
  tagline: 'Turn your notebook into something with a real address, so anyone can open it and use it.',
  difficulty: 9,
  minutes: 210,
  tags: ['Streamlit', 'deployment', 'validation', 'testing'],
  summary: 'Eight levels of analysis have lived inside your notebooks. This level moves the code into a real application ' +
           'with inputs, validation, tests, and a public address, and yes, this is where you finally set up a proper editor.',

  objectives: [
    'Explain the client-server model and where your code runs',
    'Separate pure calculation from interface so both can be tested',
    'Build a multi-input web app with Streamlit',
    'Validate every user input and fail with a message instead of a traceback',
    'Write tests that run without a browser',
    'Manage dependencies with requirements.txt and deploy to a public URL'
  ],

  knowledge: [
    { h: 'A notebook is not a product' },
    { p: 'Notebooks are brilliant for exploring and terrible for delivering. They run top to bottom in an order only you ' +
         'remember, they have no inputs a stranger can use, and "just run this cell" is not a product. ' +
         'An application flips all three: it waits for input, validates it, computes, and responds.' },
    { table: {
      head: ['Notebook', 'Application'],
      rows: [
        ['You are the only user', 'Anyone with the link is a user'],
        ['Inputs are edited in code', 'Inputs come from a form'],
        ['A crash is a red cell you ignore', 'A crash is an outage'],
        ['Cell order is in your head', 'Every path must work in any order'],
        ['Runs on your machine', 'Runs on a server, somewhere else']
      ]
    }},

    { h: 'Client and server' },
    { p: 'A **client** (the browser) sends a request; a **server** runs your Python and sends back a response. Your code ' +
         'never runs on the user\'s machine, which is why secrets can live on the server and why the server has to cope ' +
         'with every input a stranger might type.' },
    { code: 'browser  --- HTTP request  --->  server (your Python)\n         <-- HTML / JSON  ----      + your data sources', lang: 'text' },
    { p: 'Two common shapes for the server half:' },
    { table: {
      head: ['Shape', 'Returns', 'Use it when'],
      rows: [
        ['**Web app** (Streamlit)', 'A page a human looks at', 'The user is a person who wants an answer'],
        ['**API** (FastAPI/Flask)', 'JSON another program reads', 'The user is another system']
      ]
    }},
    { p: 'This level builds a **web app**, because seeing a stranger use your loan calculator is a better first experience ' +
         'than reading a JSON response. The architecture lesson is identical.' },

    { h: 'Separate the maths from the buttons' },
    { p: 'The single most important structural decision: **pure functions in one file, interface in another**.' },
    { code: 'finance.py     <- pure functions. No printing, no widgets, no I/O\napp.py         <- Streamlit UI. Imports finance, calls it, displays results\ntest_finance.py <- tests. Imports finance only, needs no browser', lang: 'text', label: 'project layout' },
    { p: 'A **pure function** takes arguments and returns a value, with no side effects. It can be tested in one line, ' +
         'reused in an API tomorrow, and reasoned about without running the app. The moment a calculation contains ' +
         '`st.write()`, it is welded to the interface forever.' },
    { money: 'In regulated fintech this separation is not just tidiness. The calculation engine is the part that gets ' +
             'audited, version-pinned, and tested to death. It must be readable on its own, without a UI framework in the way.' },

    { h: 'Validate everything a stranger can type' },
    { p: 'Your users will enter a negative loan, a 900% rate, a zero term, and text where a number should be. Every one of ' +
         'those must produce a clear message, never a traceback.' },
    { code: 'if principal <= 0:\n    st.error("Loan amount must be greater than zero.")\n    st.stop()\n\nif term_years > 40:\n    st.warning("Terms over 40 years are unusual. Check this is intended.")', lang: 'python' },
    { table: {
      head: ['Input', 'Guard'],
      rows: [
        ['Loan amount', 'Positive, with a sane upper bound'],
        ['Interest rate', '0% to ~50%, and handle exactly 0%'],
        ['Term', 'At least 1 period, capped at something plausible'],
        ['Extra payment', 'Not negative, and warn if it exceeds the payment itself'],
        ['Income', 'Positive if you are dividing by it, never divide by user input unchecked']
      ]
    }},
    { warn: 'Widget constraints (`min_value`, `max_value`) are a convenience, not a security control. Validate in your ' +
            'functions too: the same code may later be called by an API where no widget exists.' },

    { h: 'Dependencies and environments' },
    { p: 'Your app needs specific libraries at specific versions. `requirements.txt` lists them; the deployment platform ' +
         'installs exactly that list. Without it, your app works locally and dies on the server.' },
    { code: 'streamlit==1.38.0\npandas==2.2.2\nnumpy==1.26.4\nmatplotlib==3.9.2', lang: 'text', label: 'requirements.txt' },
    { p: 'A **virtual environment** is a private library folder per project, so one project\'s pandas upgrade cannot break ' +
         'another. Create it once and forget about it:' },
    { code: 'python -m venv .venv\n\n# Windows\n.venv\\Scripts\\activate\n# macOS / Linux\nsource .venv/bin/activate\n\npip install -r requirements.txt', lang: 'bash' },
    { tip: 'Add `.venv/` to your `.gitignore`. It is hundreds of megabytes of files that anyone can rebuild from ' +
           'requirements.txt in thirty seconds.' },

    { h: 'Tests that run in a second' },
    { p: 'You separated the maths precisely so you could do this. A test file of plain `assert` statements catches the ' +
         'bugs that a UI hides, and running it takes less time than clicking through the app once.' },
    { code: 'from finance import monthly_payment\n\ndef test_known_payment():\n    assert round(monthly_payment(250000, 0.055, 30), 2) == 1419.47\n\ndef test_zero_rate():\n    assert round(monthly_payment(12000, 0.0, 4), 2) == 250.00\n\ndef test_rejects_negative():\n    try:\n        monthly_payment(-100, 0.05, 10)\n    except ValueError:\n        return\n    raise AssertionError("should have raised")', lang: 'python' },
    { p: 'Run them with `pytest` (or just call each function at the bottom of the file). The habit that matters: ' +
         '**every bug you fix gets a test** so it cannot come back quietly.' },

    { h: 'Secrets in a deployed app' },
    { p: 'Level 5\'s rule still holds, with one addition: deployment platforms give you a secrets store. Streamlit Cloud ' +
         'has a settings panel that populates `st.secrets`; the values never appear in your repository.' },
    { code: 'import streamlit as st\n\napi_key = st.secrets.get("MARKET_API_KEY")     # set in the platform UI\nif not api_key:\n    st.info("Running without a market feed: using bundled snapshot data.")', lang: 'python' },
    { p: 'Note the fallback. An app that dies because an optional key is missing is worse than one that degrades and says so.' },

    { h: 'Caching, because the server is shared' },
    { p: 'Streamlit re-runs your entire script on every interaction. That is a simple and surprising model: move a slider, ' +
         'the whole file runs again. Anything slow (a CSV download, an API call) must be cached or your app will crawl.' },
    { code: '@st.cache_data(ttl=3600)      # remember for an hour\ndef load_prices(url):\n    return pd.read_csv(url, parse_dates=["date"])', lang: 'python' },
    { warn: 'Never cache anything that must be fresh per user, and never cache a function that writes to a database. ' +
            'Cache reads, not writes.' }
  ],

  tutorial: {
    intro: 'This is the level where you set up a real editor, and you get to choose how. Path A needs no installation at ' +
           'all; Path B is the classic local setup. Both end with a deployed app.',
    steps: [
      {
        t: 'Choose your workspace: Codespaces or local',
        blocks: [
          { h4: 'Path A: GitHub Codespaces (browser, nothing to install)' },
          { ol: [
            'Create a new GitHub repository called `finquest-loan-advisor` with a README.',
            'On the repo page click **Code -> Codespaces -> Create codespace on main**.',
            'Wait about a minute. You now have VS Code in a browser tab, with Python already installed.',
            'The terminal at the bottom is a normal shell: `python --version` should answer.'
          ]},
          { p: 'The free tier gives every GitHub account a generous monthly allowance of Codespaces hours: plenty for this ' +
               'level. Stop the codespace when you finish and it stops consuming them.' },
          { h4: 'Path B: local install' },
          { ol: [
            'Install Python from [python.org/downloads](https://python.org/downloads). **On Windows, tick "Add Python to PATH"** on the first screen: this one checkbox causes most beginner setup pain.',
            'Install [VS Code](https://code.visualstudio.com) and its Python extension.',
            'Clone your repo: **File -> Open Folder** after using GitHub Desktop, or `git clone <url>` in a terminal.',
            'Verify with `python --version` in the VS Code terminal.'
          ]},
          { tip: 'Genuinely stuck on installation? Take Path A. It has no installation to be stuck on, and the rest of the ' +
                 'level is identical. Setting up a local machine is a worthwhile skill, not a prerequisite for shipping.' }
        ],
        check: '`python --version` prints 3.10 or newer in your terminal, in either environment.'
      },
      {
        t: 'Set up the project',
        blocks: [
          { code: 'python -m venv .venv\nsource .venv/bin/activate        # Windows: .venv\\Scripts\\activate\npip install streamlit pandas numpy matplotlib\npip freeze > requirements.txt', lang: 'bash' },
          { p: 'Then create these files:' },
          { code: 'finquest-loan-advisor/\n  app.py              <- the interface\n  finance.py          <- the maths (pure functions)\n  test_finance.py     <- the tests\n  requirements.txt\n  .gitignore          <- contains.venv/ and __pycache__/\n  README.md', lang: 'text' },
          { warn: 'If `streamlit` is "not recognised" after installing, your virtual environment is not active. The prompt ' +
                  'should show `(.venv)`. Activate it again, or use `python -m streamlit run app.py`.' }
        ],
        check: 'The folder exists with all six files and `pip list` shows streamlit.'
      },
      {
        t: 'Write the engine first (no UI anywhere)',
        blocks: [
          { code: '"""finance.py: pure loan maths. No printing, no widgets, no I/O."""\n\n\ndef monthly_payment(principal, annual_rate, years, periods_per_year=12):\n    """Equal payment that amortizes a loan to zero."""\n    if principal <= 0:\n        raise ValueError("principal must be positive")\n    if annual_rate < 0:\n        raise ValueError("rate cannot be negative")\n    if years <= 0:\n        raise ValueError("term must be at least one period")\n\n    i = annual_rate / periods_per_year\n    n = int(years * periods_per_year)\n    if i == 0:\n        return principal / n\n    return principal * i / (1 - (1 + i) ** -n)\n\n\ndef schedule(principal, annual_rate, years, extra=0.0, periods_per_year=12):\n    """List of dicts: month, payment, interest, principal, balance."""\n    payment = monthly_payment(principal, annual_rate, years, periods_per_year)\n    i = annual_rate / periods_per_year\n    if extra < 0:\n        raise ValueError("extra payment cannot be negative")\n\n    balance = principal\n    rows = []\n    month = 0\n    while balance > 0.005 and month < 1200:\n        month += 1\n        interest = balance * i\n        principal_part = min(payment + extra - interest, balance)\n        if principal_part <= 0:\n            raise ValueError("payment does not cover the interest")\n        balance -= principal_part\n        rows.append({\n            "month": month,\n            "payment": round(interest + principal_part, 2),\n            "interest": round(interest, 2),\n            "principal": round(principal_part, 2),\n            "balance": round(max(balance, 0), 2),\n        })\n    return rows', lang: 'python' },
          { p: 'Notice this file imports nothing but the standard library, raises on bad input, and returns plain data. ' +
               'It could be dropped into an API, a batch job, or a test suite unchanged.' }
        ],
        check: 'python -c "import finance; print(finance.monthly_payment(250000, 0.055, 30))" prints 1419.47...'
      },
      {
        t: 'Test it before you look at it',
        blocks: [
          { code: '"""test_finance.py"""\nimport pytest\nfrom finance import monthly_payment, schedule\n\n\ndef test_known_payment():\n    assert round(monthly_payment(250000, 0.055, 30), 2) == 1419.47\n\n\ndef test_zero_rate_splits_evenly():\n    assert round(monthly_payment(12000, 0.0, 4), 2) == 250.00\n\n\ndef test_schedule_ends_at_zero():\n    rows = schedule(20000, 0.07, 5)\n    assert len(rows) == 60\n    assert rows[-1]["balance"] == 0.0\n\n\ndef test_extra_payment_shortens_term():\n    assert len(schedule(20000, 0.07, 5, extra=100)) < 60\n\n\n@pytest.mark.parametrize("bad", [-1000, 0])\ndef test_rejects_bad_principal(bad):\n    with pytest.raises(ValueError):\n        monthly_payment(bad, 0.05, 10)', lang: 'python' },
          { code: 'pip install pytest\npytest -q', lang: 'bash' },
          { p: '`pytest.raises` asserts that an error *does* happen: testing the refusals matters as much as testing the ' +
               'happy path. `parametrize` runs the same test for each value in the list.' }
        ],
        check: 'pytest reports 6 passed.'
      },
      {
        t: 'Build the interface',
        blocks: [
          { code: '"""app.py: Streamlit interface."""\nimport pandas as pd\nimport streamlit as st\n\nfrom finance import monthly_payment, schedule\n\nst.set_page_config(page_title="Loan Advisor", page_icon="\\U0001F4B0", layout="wide")\nst.title("Loan Advisor")\nst.caption("Educational tool. Not financial advice.")\n\nwith st.sidebar:\n    st.header("Your loan")\n    principal = st.number_input("Amount borrowed", min_value=1000.0,\n                                max_value=5_000_000.0, value=250_000.0, step=1000.0)\n    rate_pct = st.slider("Interest rate (%)", 0.0, 25.0, 5.5, 0.1)\n    years = st.slider("Term (years)", 1, 40, 30)\n    extra = st.number_input("Extra monthly payment", min_value=0.0, value=0.0, step=50.0)\n\nrate = rate_pct / 100\n\nif extra > 0 and extra > monthly_payment(principal, rate, years) * 3:\n    st.warning("That extra payment is unusually large compared with the scheduled one.")\n\nbase = pd.DataFrame(schedule(principal, rate, years))\nfast = pd.DataFrame(schedule(principal, rate, years, extra=extra))\n\ncol1, col2, col3 = st.columns(3)\ncol1.metric("Monthly payment", f"${monthly_payment(principal, rate, years):,.2f}")\ncol2.metric("Total interest", f"${base[\'interest\'].sum():,.0f}")\ncol3.metric("Months to clear", len(fast),\n            delta=f"{len(fast) - len(base)} vs standard" if extra else None)\n\ntab1, tab2 = st.tabs(["Balance over time", "Full schedule"])\nwith tab1:\n    chart = pd.DataFrame({"standard": base["balance"]})\n    if extra > 0:\n        chart["with extra"] = fast["balance"]\n    st.line_chart(chart)\nwith tab2:\n    st.dataframe(fast, use_container_width=True, hide_index=True)\n    st.download_button("Download schedule (CSV)",\n                       fast.to_csv(index=False).encode("utf-8"),\n                       "schedule.csv", "text/csv")', lang: 'python' },
          { code: 'streamlit run app.py', lang: 'bash' },
          { p: 'Your browser opens on localhost. Move a slider and the whole script re-runs. That is the Streamlit model, ' +
               'and it is why slow work belongs behind `@st.cache_data`.' }
        ],
        check: 'The app runs, the metrics update as you move the sliders, and the CSV downloads.'
      },
      {
        t: 'Handle the unhappy paths',
        blocks: [
          { p: 'Wrap calls that can raise, and turn the error into a sentence a user understands.' },
          { code: 'try:\n    base = pd.DataFrame(schedule(principal, rate, years))\nexcept ValueError as err:\n    st.error(f"Cannot build a schedule: {err}")\n    st.stop()          # nothing below this line runs', lang: 'python' },
          { p: '`st.stop()` halts the script cleanly, leaving the error on screen and no half-drawn charts below it. ' +
               'Try every bad input you can think of before you deploy. That is a real testing pass, not an optional one.' }
        ],
        check: 'No input combination produces a red Python traceback on the page.'
      },
      {
        t: 'Deploy to a public URL',
        blocks: [
          { ol: [
            'Commit and push everything to GitHub (in Codespaces: the Source Control panel; locally: `git add. && git commit -m "Loan advisor" && git push`).',
            'Go to [share.streamlit.io](https://share.streamlit.io) and sign in with GitHub.',
            'Click **New app**, choose your repo, branch `main`, and main file `app.py`.',
            'Click **Deploy**. The first build takes a couple of minutes while it installs requirements.txt.',
            'You get a public URL. Open it on your phone: it works.'
          ]},
          { warn: 'Deployment failing is almost always requirements.txt: a missing package, or a version that does not exist ' +
                  'on the platform\'s Python. Read the build log: it names the package on the failing line.' },
          { p: 'Put the live URL at the top of your README with a screenshot. This is the single most valuable artefact ' +
               'in your portfolio, because anyone can click it without reading a line of your code.' }
        ],
        check: 'A stranger can open your URL on their phone and get a loan schedule.'
      }
    ]
  },

  glossary: [
    { t: 'Client / server', d: 'The browser sends requests; your Python runs on the server and responds.' },
    { t: 'Pure function', d: 'Takes arguments, returns a value, no side effects. Easy to test and reuse.' },
    { t: 'Streamlit', d: 'A Python library that turns a script into a web app by re-running it on every interaction.' },
    { t: 'Widget', d: 'An input control (slider, number box) whose value your script reads on each run.' },
    { t: 'requirements.txt', d: 'The pinned list of libraries a deployment platform installs.' },
    { t: 'Virtual environment', d: 'A per-project library folder that isolates dependencies.' },
    { t: 'Validation', d: 'Rejecting bad input with a clear message before it reaches the calculation.' },
    { t: 'st.stop()', d: 'Halts the Streamlit script immediately, leaving the error visible.' },
    { t: 'Caching', d: 'Storing the result of slow work so repeated runs skip it.' },
    { t: 'Secrets store', d: 'A platform feature holding credentials outside your repository.' },
    { t: 'pytest', d: 'The standard Python test runner; collects functions named test_*.' },
    { t: 'Codespaces', d: 'A browser-based VS Code with a ready Python environment, requiring no local install.' },
    { t: 'Build log', d: 'The deployment platform\'s output, where install failures are explained.' }
  ],

  quiz: [
    { q: "Why keep calculations in finance.py rather than inside app.py?",
      options: [
        "Streamlit cannot do arithmetic",
        "GitHub requires multiple files",
        "Pure functions can be tested, reused, and audited without running the interface",
        "It makes the app load faster"
      ],
      answer: 2,
      why: "A calculation containing st.write() is welded to the UI forever. Separated, the engine can be unit-tested in milliseconds and reused by an API later." },

    { q: "What happens when a user moves a slider in a Streamlit app?",
      options: [
        "The page reloads and state is lost",
        "The entire script re-runs from the top",
        "A callback function fires and nothing else runs",
        "Only the affected widget updates"
      ],
      answer: 1,
      why: "Streamlit re-executes the whole file on every interaction. It keeps the code simple, and it is exactly why slow operations must be cached." },

    { q: "What is `@st.cache_data` for?",
      options: [
        "Encrypting sensitive data",
        "Saving user input between sessions",
        "Speeding up chart rendering",
        "Avoiding repeating slow work like file downloads on every re-run"
      ],
      answer: 3,
      why: "Since the script re-runs constantly, uncached downloads or API calls would repeat on every slider move. Cache reads, never cache writes." },

    { q: "Where should a deployed app get its API key?",
      options: [
        "From a text file committed beside the code",
        "From a query parameter in the URL",
        "Hardcoded in app.py",
        "From the platform's secrets store, read via st.secrets"
      ],
      answer: 3,
      why: "The secrets store injects values at runtime and keeps them out of the repository. A key in a URL ends up in logs and browser history." },

    { q: "What does requirements.txt do?",
      options: [
        "Tells the deployment platform exactly which libraries and versions to install",
        "Documents the API endpoints",
        "Configures the server's memory",
        "Lists the features the app must have"
      ],
      answer: 0,
      why: "Without it the server has none of your libraries and the app fails on import. Most first deployment failures are a missing or wrong line in this file." },

    { q: "Why use a virtual environment?",
      options: [
        "Because Streamlit requires one",
        "To keep each project's libraries separate so upgrades cannot break other projects",
        "To make Python run faster",
        "To encrypt your source code"
      ],
      answer: 1,
      why: "A per-project library folder means one project upgrading pandas cannot silently break another. Add .venv/ to .gitignore. It is rebuildable." },

    { q: "A user enters a loan of 0. What should happen?",
      options: [
        "The app silently uses a default of 1000",
        "A Python traceback appears on the page",
        "A clear error message is shown and the script stops before computing",
        "The page reloads"
      ],
      answer: 2,
      why: "Validate, message, st.stop(). A traceback exposes internals and tells the user nothing they can act on; a silent default produces answers to a question they did not ask." },

    { q: "Why validate inside your functions as well as with widget min/max values?",
      options: [
        "Because the same function may later be called by an API or a test where no widget exists",
        "Because Streamlit ignores min_value",
        "Widgets are unreliable",
        "To slow down malicious users"
      ],
      answer: 0,
      why: "Widget limits are a convenience of one particular interface. The engine must defend itself wherever it is called from." },

    { q: "What does `st.stop()` do?",
      options: [
        "Shuts down the server",
        "Logs the user out",
        "Halts the current script run so nothing below it executes",
        "Clears the cache"
      ],
      answer: 2,
      why: "It ends this run cleanly, leaving your error message on screen with no half-rendered charts underneath it." },

    { q: "Which test is most valuable for a payment calculation?",
      options: [
        "That the chart colours are correct",
        "That the page loads under two seconds",
        "That a known input produces a known output, and that bad input raises",
        "That the app opens without errors"
      ],
      answer: 2,
      why: "Fixed known values catch silent maths regressions, and testing the refusals proves your validation actually fires. Both run in milliseconds without a browser." },

    { q: "What does `pytest.raises(ValueError)` assert?",
      options: [
        "That the code inside the block does raise a ValueError",
        "That the code never raises an error",
        "That errors are logged",
        "That ValueError is imported"
      ],
      answer: 0,
      why: "It is how you test refusals. If the block completes without raising, the test fails, which is exactly what you want when checking validation." },

    { q: "Your app works locally but fails on Streamlit Cloud. What do you check first?",
      options: [
        "Your internet connection",
        "requirements.txt and the build log, which names the failing package",
        "The GitHub repository description",
        "The colour scheme"
      ],
      answer: 1,
      why: "The server starts empty. A library you installed locally but never listed is the most common cause, and the build log states exactly which one." },

    { q: "Which best describes the client-server split for a Streamlit app?",
      options: [
        "The server only serves static files",
        "Both run the same code simultaneously",
        "Your Python runs in the user's browser",
        "Your Python runs on the server; the browser only sends input and displays results"
      ],
      answer: 3,
      why: "That is why secrets can live server-side, and why the server must survive whatever a stranger types into the form." },

    { q: "What belongs in .gitignore for this project?",
      options: [
        ".venv/ and __pycache__/",
        "README.md",
        "app.py and finance.py",
        "requirements.txt"
      ],
      answer: 0,
      why: "Ignore anything rebuildable or machine-specific. The virtual environment is hundreds of megabytes and reinstalls from requirements.txt in seconds." },

    { q: "What is the most valuable thing to put at the top of your README?",
      options: [
        "The install instructions for Python",
        "The live URL and a screenshot",
        "Your full source code",
        "A list of every function"
      ],
      answer: 1,
      why: "A reviewer with thirty seconds clicks a link and looks at a picture. Everything else in the README is for the people who stay." }
  ],

  project: {
    title: 'Loan advisor, a web app you can share',
    story: 'Everything you built in levels 2 and 6 is sitting in notebooks nobody else can run. Time to ship it: a ' +
           'loan advisor a member can open on their phone, with your name on it.',
    scope: 'Uses this level plus Levels 2, 6, and 3: the amortization engine you already wrote, pandas for tables, ' +
           'Streamlit for the interface, pytest for the tests. Nothing beyond that is required.',
    requirements: [
      'A repository named `finquest-loan-advisor` with app.py, finance.py, test_finance.py, requirements.txt, .gitignore and README.md',
      'finance.py contains only pure functions: no Streamlit import anywhere in it',
      '`monthly_payment`, `schedule`, `summarise`, `compare_terms`, and `affordability` all live in finance.py',
      'Every public function raises ValueError with a readable message on invalid input',
      'test_finance.py with at least 8 tests including known values, the zero-rate case, and at least two `pytest.raises` tests',
      'All tests pass with `pytest -q` and the passing output is shown in your README',
      'Sidebar inputs for amount, rate, term, extra payment, and monthly income',
      'Three headline metrics using `st.metric`: monthly payment, total interest, months to clear',
      'A chart of balance over time showing standard vs overpaid when an extra payment is entered',
      'A tab or expander with the full schedule table and a CSV download button',
      'An affordability panel showing DTI with a comfortable / stretched / high-risk band',
      'Every invalid input handled with `st.error` and `st.stop()`: no traceback is ever visible on the page',
      'A visible disclaimer that the tool is educational and not financial advice',
      '`@st.cache_data` used on at least one genuinely slow operation, with a comment explaining why',
      'Deployed to Streamlit Community Cloud with a working public URL',
      'README with the live URL, a screenshot, what it does, how to run it locally, and what you would build next'
    ],
    starter: {
      lang: 'python',
      code: '"""app.py: FinQuest level 9 starter.\nKeep every calculation in finance.py. This file is interface only.\n"""\nimport pandas as pd\nimport streamlit as st\n\nfrom finance import monthly_payment, schedule, summarise, affordability\n\nst.set_page_config(page_title="Loan Advisor", page_icon="\\U0001F4B0", layout="wide")\nst.title("Loan Advisor")\nst.caption("Educational tool built for the Spider Fintech Society. Not financial advice.")\n\nwith st.sidebar:\n    st.header("Your loan")\n    # TODO: number_input / slider for amount, rate, term, extra, income\n\n# TODO: validate inputs -> st.error(...) + st.stop()\n\n# TODO: build the schedules (standard and with extra)\n\n# TODO: three st.metric headline numbers\n\n# TODO: tabs -> balance chart, full schedule + download button\n\n# TODO: affordability panel with DTI banding\n'
    },
    tests: [
      'monthly_payment(250000, 0.055, 30) == 1419.47 to 2dp',
      'monthly_payment(12000, 0.0, 4) == 250.00 exactly',
      'monthly_payment(-1000, 0.05, 10) raises ValueError',
      'monthly_payment(1000, 0.05, 0) raises ValueError',
      'schedule(20000, 0.07, 5) has 60 rows and a final balance of 0.0',
      'schedule(20000, 0.07, 5, extra=100) has fewer than 60 rows',
      'schedule(..., extra=-50) raises ValueError',
      'grep finance.py for "streamlit" returns nothing',
      'pytest -q passes with at least 8 tests',
      'The deployed URL loads and responds to slider changes',
      'Entering a zero loan amount shows a friendly error, not a traceback'
    ],
    rubric: [
      { pts: 25, t: 'It is live', d: 'A public URL a stranger can open and use on a phone.' },
      { pts: 20, t: 'Separation', d: 'finance.py is pure and importable with no UI dependency; app.py holds no maths.' },
      { pts: 20, t: 'Tests', d: 'At least 8 meaningful tests including refusals; all passing.' },
      { pts: 15, t: 'Robustness', d: 'No input combination produces a traceback; every error is a sentence.' },
      { pts: 10, t: 'Usefulness', d: 'Metrics, chart, schedule, download and affordability all present and clear.' },
      { pts: 10, t: 'README', d: 'Live URL, screenshot, local run instructions, and honest next steps.' }
    ],
    stretch: [
      'Add a second page with the Level 2 savings projector using st.navigation or a page selector',
      'Add st.session_state so a user can save and compare up to three scenarios side by side',
      'Rebuild the same engine behind a FastAPI endpoint and call it from the app: one engine, two interfaces',
      'Add a GitHub Action that runs pytest on every push and shows a passing badge in the README'
    ],
    solutionPath: 'solutions/level-09'
  },

  faq: [
    { q: 'I cannot install Python / PATH errors on Windows',
      a: 'Use GitHub Codespaces instead: VS Code in a browser tab with Python already installed. If you retry the installer, tick "Add Python to PATH" on the first screen.' },
    { q: 'streamlit: command not found',
      a: 'Your virtual environment is not active (the prompt should show (.venv)), or streamlit was installed elsewhere. Activate it, or run python -m streamlit run app.py.' },
    { q: 'My app is very slow',
      a: 'Streamlit re-runs the whole script on every interaction. Put @st.cache_data on any download or heavy computation, and keep the uncached path small.' },
    { q: 'Deployment fails on Streamlit Cloud',
      a: 'Read the build log: it names the failing package. Usually requirements.txt is missing a library or pins a version that is unavailable. Regenerate it with pip freeze inside a clean environment.' },
    { q: 'Should finance.py import streamlit?',
      a: 'No. That is the one rule that keeps the engine testable and reusable. If a calculation needs to report a problem, raise ValueError and let app.py turn it into st.error.' },
    { q: 'How many tests are enough?',
      a: 'Cover each public function with one known-value test and one refusal test, then add a test for every bug you fix. Eight is the floor for this project, not the target.' },
    { q: 'A user typed something that crashed the app',
      a: 'Wrap the call in try/except ValueError, show st.error with the message, then st.stop(). Then add a test reproducing that input so it cannot come back.' }
  ]
});
