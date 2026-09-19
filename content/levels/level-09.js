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
    { p: 'For eight levels your code has lived in notebooks. A notebook is brilliant for exploring: you try something, see the ' +
         'result, try something else. It is terrible for handing to anyone. Its cells only work in the order you ran them, ' +
         'which lives in your head. There is nowhere for a stranger to type their own numbers. And "just open Colab and run ' +
         'cell 7" is not something you can ask a customer.' },
    { p: 'An **application** turns that around. It waits for someone to give it input, checks the input makes sense, does the ' +
         'calculation, and shows the answer, for anyone, in any order, as many times as they like. Putting it on a computer ' +
         'the public can reach is called **deploying** it.' },
    { table: {
      head: ['Notebook', 'Application'],
      rows: [
        ['You are the only user', 'Anyone with the link is a user'],
        ['You change inputs by editing code', 'Users type inputs into a form'],
        ['A crash is a red cell you ignore', 'A crash is somebody unable to use your product'],
        ['Cell order is in your head', 'Every path has to work in any order'],
        ['Runs on your machine', 'Runs on a server somewhere else']
      ]
    }},
    { p: 'The last row hides the biggest change. The moment strangers can type into your code, they will type things you ' +
         'never imagined. Here is the level 6 payment formula meeting a user who enters a loan term of 0 years:' },
    { code: 'monthly_payment(250000, 0.055, 0)\n\nTraceback (most recent call last):\n  ...\nZeroDivisionError: float division by zero', lang: 'python' },
    { p: 'That wall of error text is a **traceback**: Python explaining where it crashed. It is useful to you and meaningless, ' +
         'even alarming, to a customer.' },
    { check: {
      q: 'Your notebook has computed the right payment a hundred times. The deployed app shows a stranger a traceback the ' +
         'first afternoon, because they typed a term of 0 years. Which piece of code was wrong?',
      a: 'Neither, in the sense that the arithmetic never changed. A term of zero makes n zero, so `(1 + i) ** -n` is 1, the ' +
         'bottom of the fraction is 0, and Python refuses to divide by it. In a notebook that input never arrives, because you ' +
         'are the only user and you know what the function expects. The app is the same function with the audience widened ' +
         'to everyone, and the work the notebook let you skip is exactly the work that failed: deciding what happens when the ' +
         'input is impossible.'
    }},

    { h: 'Where your code actually runs' },
    { p: 'Level 5 introduced the client and the server from the other side, when your code was the one asking. Now your code ' +
         'is the one answering. The **client** is the user\'s browser: it sends a request and draws whatever comes back. The ' +
         '**server** is the computer running your Python. Your code never runs on the user\'s machine.' },
    { code: 'their browser  --- "here are my numbers" --->  server running your Python\n               <--- a page with the answer ---      (and your data, and your keys)', lang: 'text' },
    { p: 'That one fact explains two things. It is why your API key is safe on the server: the browser only ever receives the ' +
         'finished page. And it is why the server has to protect itself: anything a stranger can type arrives at your code.' },
    { p: 'Servers come in two common shapes:' },
    { table: {
      head: ['Shape', 'What it sends back', 'Use it when'],
      rows: [
        ['**Web app**, for example with Streamlit', 'A page a person looks at', 'The user is a person who wants an answer'],
        ['**API**, for example with FastAPI', 'JSON that another program reads', 'The user is another system']
      ]
    }},
    { p: 'This level builds a **web app** with **Streamlit**, a Python library that turns a script into a web page with ' +
         'sliders, boxes and charts, without you writing any HTML. Seeing a stranger use your loan calculator is a better first ' +
         'experience than reading JSON. Level 12 builds an API.' },
    { check: {
      q: 'A member says the app is slow and asks whether a faster laptop would fix it. Answer them, and say what the answer ' +
         'means for where you can keep an API key.',
      a: 'A faster laptop will not help. Their browser sends a request and draws the page that comes back; every line of your ' +
         'Python runs on the server, so the delay is in your code, your data sources, or the network in between. What would ' +
         'help is saving the slow load so it is not repeated, making fewer calls, or a server closer to the user. The same ' +
         'fact is why a key read on the server is safe and a key in the browser\'s code is public: whatever reaches the ' +
         'client belongs to the client.'
    }},

    { h: 'Keep the maths away from the buttons' },
    { p: 'The most important decision in this level is how you split your files. The calculations go in one file, the ' +
         'screen in another, and the tests in a third:' },
    { code: 'finance.py       <- the calculations. No printing, no buttons, no files\napp.py           <- the Streamlit page. Imports finance, calls it, shows the result\ntest_finance.py  <- the tests. Imports finance only, and needs no browser', lang: 'text', label: 'project layout' },
    { p: 'Everything in `finance.py` should be a **pure function**: it takes some values in, returns a value out, and does ' +
         'nothing else along the way. No printing, no saving, no talking to the screen. Anything a function does besides ' +
         'returning its answer is called a **side effect**. Compare:' },
    { code: '# pure: numbers in, number out\ndef monthly_payment(principal, annual_rate, years):\n    ...\n    return payment\n\n# not pure: welded to one screen\ndef monthly_payment(principal, annual_rate, years):\n    ...\n    st.write(f"Your payment is {payment}")      # a side effect\n    return payment', lang: 'python' },
    { p: 'The pure version can be tested in one line, reused by an API next month, and understood without running the app. ' +
         'The second one only works inside a Streamlit page.' },
    { check: {
      q: 'Someone adds an `st.write()` inside `monthly_payment` so the working shows on screen. Name two things that function ' +
         'can no longer do.',
      a: 'It can no longer be tested without Streamlit running, because calling it outside a Streamlit page misbehaves. And ' +
         'it can no longer be called in a loop: build a 360 row schedule and you have written to the page 360 times. A third ' +
         'follows for free: it cannot be reused behind an API tomorrow, which is usually the next thing anyone asks for. A ' +
         'calculation that writes to a screen has chosen one screen forever.'
    }},
    { money: 'In regulated finance this split is not just tidiness. The calculation code is the part that gets audited, its ' +
             'exact version recorded, and tested heavily. It has to be readable on its own, with no screen code in the way.' },

    { h: 'Check everything a stranger can type' },
    { p: 'Your users will enter a negative loan, a 900% rate, a zero term, and letters where a number should be. Every one of ' +
         'those must produce a clear message, never a traceback. Checking input before using it is called **validation**.' },
    { p: 'Do it in two places. In the calculation, raise an error with a plain explanation, so the rule protects every caller:' },
    { code: 'def monthly_payment(principal, annual_rate, years):\n    if principal <= 0:\n        raise ValueError("Loan amount must be greater than zero.")\n    if years < 1:\n        raise ValueError("The term must be at least one year.")\n    ...', lang: 'python' },
    { p: 'And on the page, catch that error and show it kindly, then stop drawing the rest of the page:' },
    { code: 'try:\n    payment = monthly_payment(principal, rate, years)\nexcept ValueError as err:\n    st.error(str(err))         # a red box with the message, not a traceback\n    st.stop()\n\nif years > 40:\n    st.warning("Terms over 40 years are unusual. Check this is what you meant.")', lang: 'python' },
    { table: {
      head: ['Input', 'What to check'],
      rows: [
        ['Loan amount', 'Above zero, and below some sensible maximum'],
        ['Interest rate', 'Between 0% and about 50%, and handle exactly 0% separately'],
        ['Term', 'At least one period, and not absurdly long'],
        ['Extra payment', 'Not negative, and warn if it is bigger than the payment itself'],
        ['Income', 'Above zero before you divide by it. Never divide by something a user typed without checking']
      ]
    }},
    { warn: 'The limits you set on an input box, such as `min_value` and `max_value`, only protect that one box. Put the real ' +
            'check in the function too, because the same function may later be called from somewhere with no box at all.' },
    { check: {
      q: 'Your loan amount box is `st.number_input("Loan", min_value=1000.0, max_value=2000000.0)`. Is the loan amount ' +
         'validated?',
      a: 'On that one screen, yes. In your program, no. The rule lives in the box, so every other caller of `monthly_payment` ' +
         'has no rule at all: a test, a scheduled job, an API next month, or the same page after somebody removes a limit they ' +
         'did not understand. Put the check in the function, where it raises `ValueError`, and keep the box limits as a ' +
         'convenience that stops most people from seeing the error at all.'
    }},

    { h: 'Make it install the same way everywhere' },
    { p: 'Your app uses other people\'s code: Streamlit, pandas, numpy. Those are its **dependencies**. The server that runs ' +
         'your app starts completely empty, so it needs a list of exactly what to install. That list is a text file called ' +
         '`requirements.txt`, and the server installs everything on it, and nothing else:' },
    { code: 'streamlit==1.38.0\npandas==2.2.2\nnumpy==1.26.4\nmatplotlib==3.9.2', lang: 'text', label: 'requirements.txt' },
    { p: 'The `==2.2.2` part **pins** a version: install exactly this one. Leave it out and the server installs whatever is ' +
         'newest on the day it builds, which means an app nobody touched can break after a library changes.' },
    { p: 'On your own computer, a **virtual environment** keeps each project\'s libraries in its own folder, so upgrading ' +
         'pandas for one project cannot break another. Create it once per project:' },
    { code: 'python -m venv .venv                 # make the private folder\n\n# Windows\n.venv\\Scripts\\activate\n# macOS or Linux\nsource .venv/bin/activate\n\npip install -r requirements.txt      # install exactly the list', lang: 'bash' },
    { check: {
      q: 'The app runs locally and the deployment log says `ModuleNotFoundError: No module named pandas`. You definitely have ' +
         'pandas installed. What is going on, and what does that say about pinning versions?',
      a: 'Installed on your laptop, where nobody else runs the app. The server started empty and installed exactly what ' +
         '`requirements.txt` listed, and pandas is not on the list, so it is not there. What is installed on your machine is ' +
         'invisible to the server. The same reasoning argues for pinning: `pandas` with no version installs whatever is newest ' +
         'on build day, so an app that was never edited can break on a Tuesday. `pandas==2.2.2` builds the same thing in six ' +
         'months as it does today.'
    }},
    { tip: 'Add `.venv/` to your `.gitignore`. It is hundreds of megabytes that anyone can rebuild from `requirements.txt` in ' +
           'thirty seconds.' },

    { h: 'Tests that run in a second' },
    { p: 'You split the maths from the page precisely so you could do this. A **test** is a small function that calls your ' +
         'code with inputs where you already know the right answer, and complains if the answer is different. `assert` is ' +
         'Python\'s way of saying "this must be true, stop if it is not":' },
    { code: 'from finance import monthly_payment\n\ndef test_known_payment():\n    assert round(monthly_payment(250000, 0.055, 30), 2) == 1419.47\n\ndef test_zero_rate():\n    assert round(monthly_payment(12000, 0.0, 4), 2) == 250.00\n\ndef test_rejects_negative():\n    try:\n        monthly_payment(-100, 0.05, 10)\n    except ValueError:\n        return                      # good: it refused\n    raise AssertionError("should have refused a negative loan")', lang: 'python' },
    { p: 'A tool called **pytest** finds every function whose name starts with `test_` and runs them all:' },
    { code: '$ pytest\n...                                                    [100%]\n3 passed in 0.05s', lang: 'text' },
    { p: 'Five hundredths of a second, versus a minute of clicking through the app by hand. The habit that matters most: ' +
         '**every bug you fix gets a test**, so it cannot quietly come back.' },
    { check: {
      q: '`test_zero_rate` says $12,000 over four years at 0% must be $250.00 a month. Why is that test worth more than the one ' +
         'at 5.5%?',
      a: 'Because you can check it without trusting the formula: $12,000 over 48 months with no interest is $250.00, and ' +
         'anyone can see that. The 5.5% test tells you the code still does what it did, which is worth having, but the expected ' +
         'number was found by running the code. The zero rate case is also the one the formula cannot handle, since the bottom ' +
         'of the fraction becomes 0, so it is both the easiest test to verify and the most likely to be broken. Those two ' +
         'properties together are what make a test worth writing.'
    }},

    { h: 'Keys on a deployed app' },
    { p: 'Level 5\'s rule still holds, keys never go in your code, with one addition. Hosting platforms give you a private ' +
         'settings page for secrets. On Streamlit Cloud you paste the key there, and your code reads it through `st.secrets`. ' +
         'It never appears in your repository.' },
    { code: 'import streamlit as st\n\napi_key = st.secrets.get("MARKET_API_KEY")     # pasted into the platform\'s settings page\nif not api_key:\n    st.info("Running without a live market feed: using the saved snapshot data.")', lang: 'python' },
    { p: 'Notice what happens when the key is missing: the app keeps working and says so. An app that crashes because an ' +
         'optional key is missing is worse than one that does less and is honest about it.' },
    { check: {
      q: 'The market key is missing on the deployed app. Is it better to raise an error, so the problem is visible, or to fall ' +
         'back to the saved snapshot and carry on? Level 4 told you to fail loudly.',
      a: 'Fall back, and put the reason on the page. Level 4 was about writing money into a ledger, where a quiet failure ' +
         'leaves the books wrong. This key is optional: without it the app still teaches, on data it labels as a saved ' +
         'snapshot, and every visitor can see what they are looking at. Change the situation and the answer changes with it. ' +
         'If the key were what fetched somebody their own balance, carrying on quietly would be the worse choice, and the honest ' +
         'move would be to say the balance is unavailable rather than show an old one.'
    }},

    { h: 'Caching, because Streamlit reruns everything' },
    { p: 'Streamlit has one surprising rule: every time a user moves a slider or clicks a button, **your whole script runs ' +
         'again from the top**. That keeps things simple, but it means anything slow at the top, such as downloading a CSV, ' +
         'happens again on every click.' },
    { p: 'The fix is a **cache**: Streamlit remembers what a function returned for given inputs, and next time just hands ' +
         'back the saved answer. `ttl` ("time to live") says how long to remember it:' },
    { code: '@st.cache_data(ttl=3600)      # remember the answer for one hour\ndef load_prices(url):\n    return pd.read_csv(url, parse_dates=["date"])\n\n# first click:  downloads the file, however long that takes\n# next clicks:  returns the saved copy instantly, until the hour is up', lang: 'python' },
    { check: {
      q: 'You put `@st.cache_data` on a function that, inside it, records the member\'s calculation in a table. The member runs ' +
         'the same calculation twice. How many rows land in the table?',
      a: 'One. The second call has the same inputs, so Streamlit hands back the saved answer without running the function ' +
         'at all, and the recording never happens. The app looks perfect, because the number on screen is right both times: ' +
         'the only sign is a table that is quietly missing rows, which you discover weeks later when the counts do not add ' +
         'up. Cache the function that reads the prices, never the one that records what happened.'
    }},
    { warn: 'Never cache anything that must be fresh for each user, and never cache a function that saves or changes ' +
            'anything. Cache reading, not writing.' }
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
          { p: 'Your browser opens on localhost. Move a slider and the whole script runs again. That is the Streamlit model, ' +
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
    { t: 'Streamlit', d: 'A Python library that turns a script into a web app by running it again on every interaction.' },
    { t: 'Widget', d: 'An input control (slider, number box) whose value your script reads on each run.' },
    { t: 'requirements.txt', d: 'The pinned list of libraries a deployment platform installs.' },
    { t: 'Virtual environment', d: 'A library folder for each project, which isolates dependencies.' },
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
        "The entire script runs again from the top",
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
      why: "A library folder for each project means one project upgrading pandas cannot silently break another. Add .venv/ to .gitignore. It is rebuildable." },

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
    scope: 'Uses this level plus levels 2, 6, and 3: the amortization engine you already wrote, pandas for tables, ' +
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
      'Add a second page with the level 2 savings projector using st.navigation or a page selector',
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
