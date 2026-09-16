/* =========================================================================
   LEVEL 3 — Reading the Money: transaction data with pandas
   ========================================================================= */
FQ.registerLevel({
  id: 3,
  codename: 'TRANSACTIONS',
  title: 'Reading the Money',
  tagline: 'Turn 233 raw transaction rows into the five numbers a person actually needs.',
  difficulty: 3,
  minutes: 120,
  tags: ['pandas', 'data cleaning', 'analytics'],
  summary: 'Every fintech product is, underneath, a pile of transaction rows. This level teaches you to load them, ' +
           'clean them, group them, and answer questions with them — the single most employable skill in the industry.',

  objectives: [
    'Describe the anatomy of a transaction record and why sign conventions matter',
    'Load a CSV into a pandas DataFrame and check its types before trusting it',
    'Filter rows with boolean masks and build new columns',
    'Aggregate with groupby to answer "how much per month / per category / per merchant"',
    'Detect recurring subscriptions by finding repeated identical charges',
    'Compute a savings rate and present findings as a readable report and a chart'
  ],

  knowledge: [
    { h: 'Anatomy of a transaction' },
    { p: 'Whatever the bank, a transaction row carries the same skeleton. Everything else — merchant logos, categories, ' +
         'emoji in your app — is decoration built on these fields.' },
    { table: {
      head: ['Field', 'Purpose', 'The trap'],
      rows: [
        ['`date`', 'When it happened', 'Booking date vs value date can differ by days'],
        ['`description`', 'Raw merchant string from the rail', 'Messy, inconsistent, uppercase, full of reference codes'],
        ['`amount`', 'Signed value', 'Sign convention is a **decision**, not a fact'],
        ['`category`', 'Grouping for the user', 'Usually guessed by a model and often wrong'],
        ['`account`', 'Which account moved', 'Transfers appear twice, once on each side'],
        ['`method`', 'Card, transfer, direct debit', 'Determines reversibility and fees']
      ]
    }},
    { p: 'In this course **money out is negative and money in is positive**, from the account holder\'s point of view. ' +
         'Banks differ: some send all amounts positive plus a separate `debit/credit` flag. Get this wrong and every ' +
         'number downstream is wrong, so it is the first thing you check.' },
    { warn: 'A **refund** is a positive amount that is not income. If you compute income as `amount > 0` you will report ' +
            'a $70 clothing refund as salary. Filter by *category*, not by sign, when you mean income.' },

    { h: 'Why pandas' },
    { p: '**pandas** is the spreadsheet-shaped library Python uses for tabular data. Its core object is the ' +
         '**DataFrame**: rows, named columns, and a type for each column. One line replaces the loop you would ' +
         'otherwise write, and it is what analysts at every fintech actually use.' },
    { code: 'df.groupby("category")["amount"].sum()', lang: 'python', label: 'a whole report in one line' },
    { p: 'A **Series** is a single column. A **boolean mask** is a Series of True/False used to select rows. ' +
         'Those three words — DataFrame, Series, mask — cover 80% of everything you will read in pandas code.' },

    { h: 'Types are the first thing to check' },
    { p: 'A CSV has no types: everything arrives as text and pandas guesses. Dates load as strings unless you say otherwise, ' +
         'and a single stray value like `"N/A"` in an amount column turns the whole column into text — at which point ' +
         '`.sum()` silently concatenates strings instead of adding numbers.' },
    { code: 'df.info()          # types and non-null counts for every column\ndf.dtypes          # just the types\ndf.head()          # first five rows\ndf.shape           # (rows, columns)', lang: 'python' },
    { tip: '`object` in `dtypes` means "text or mixed". Seeing `object` on a column you expect to be numeric is the ' +
           'single most common data bug in analytics.' },

    { h: 'Split, apply, combine' },
    { p: 'Almost every analytics question is the same shape: **split** the rows into groups, **apply** a calculation to each, ' +
         '**combine** the answers into a table. In pandas that is `groupby`.' },
    { code: '# how much did I spend in each category?\nspend = df[df["amount"] < 0].copy()\nspend["abs_amount"] = spend["amount"].abs()\nby_cat = spend.groupby("category")["abs_amount"].sum().sort_values(ascending=False)', lang: 'python' },
    { p: 'To group by month you need a month column first. pandas gives you date parts through the `.dt` accessor ' +
         'once the column is a real datetime:' },
    { code: 'df["month"] = df["date"].dt.to_period("M")      # 2025-03, 2025-04, ...\ndf["weekday"] = df["date"].dt.day_name()        # Monday, Tuesday, ...\nmonthly = df.groupby("month")["amount"].sum()', lang: 'python' },
    { warn: 'Filtering then adding a column to the filtered result raises `SettingWithCopyWarning`. The fix is `.copy()` ' +
            'when you filter, as above — it tells pandas you meant to make a new table.' },

    { h: 'Finding subscriptions: the same charge, again and again' },
    { p: 'A subscription is a merchant that bills an **identical amount** on a **regular cadence**. You do not need machine ' +
         'learning for this — grouping by merchant *and* amount and counting occurrences finds them immediately.' },
    { code: 'counts = (spend.groupby(["description", "abs_amount"])\n                .size()\n                .reset_index(name="times"))\nrecurring = counts[counts["times"] >= 3]', lang: 'python' },
    { money: 'Every serious money app ships this feature, because forgotten subscriptions are the fastest saving a user can ' +
             'make. In this dataset one of the five recurring charges is a streaming service the user clearly never watches — ' +
             'finding it is worth more to them than any chart you draw.' },

    { h: 'The numbers a user actually wants' },
    { ul: [
      '**Net cash flow** — did more come in than went out? `df["amount"].sum()`',
      '**Total income** — sum of rows where category is income (*not* where amount is positive)',
      '**Total spend** — absolute sum of negative rows, usually excluding transfers to your own savings',
      '**Savings rate** — `(income - spend) / income`, the one number that predicts financial health',
      '**Fixed vs variable split** — rent, utilities and subscriptions versus everything you choose each day'
    ]},
    { p: 'A transfer to your own savings account is **not spending** — the money is still yours. Counting it as an expense ' +
         'makes users look poorer than they are, and is a genuine bug in several shipped budgeting apps.' },

    { h: 'One chart, chosen on purpose' },
    { p: 'Charts are for comparison, not decoration. For "which category is biggest" use a **horizontal bar chart sorted by size**: ' +
         'bars share a baseline so the eye compares lengths accurately. Pie charts ask people to compare angles, which they cannot do. ' +
         'For "how did this change over time" use a **line**.' },
    { code: 'import matplotlib.pyplot as plt\n\nby_cat.sort_values().plot(kind="barh", figsize=(8, 4))\nplt.title("Spending by category — Mar to Aug 2025")\nplt.xlabel("USD")\nplt.tight_layout()\nplt.show()', lang: 'python' }
  ],

  tutorial: {
    intro: 'New notebook: `finquest-level-03.ipynb`. pandas and matplotlib are already installed in Colab — no pip needed. ' +
           'The dataset is six months of a fictional person\'s account, generated for this course.',
    steps: [
      {
        t: 'Load the data straight from the web',
        blocks: [
          { p: '`read_csv` accepts a URL as happily as a filename, so there is nothing to download.' },
          { code: 'import pandas as pd\n\nURL = "{{RAW}}/data/level-03-transactions.csv"\ndf = pd.read_csv(URL, parse_dates=["date"])\n\nprint(df.shape)        # (233, 6)\ndf.head()', lang: 'python' },
          { p: '`parse_dates=["date"]` is what turns that column from text into real timestamps. Without it, `.dt` will not exist ' +
               'and sorting by date sorts alphabetically — which puts 2025-10 before 2025-3.' },
          { tip: 'Prefer working offline, or the URL is blocked on your network? Download the CSV from the repo, then in Colab ' +
                 'click the folder icon on the left and drag the file in. Load it with `pd.read_csv("level-03-transactions.csv", parse_dates=["date"])`.' }
        ],
        check: 'df.shape prints (233, 6) and df.head() shows dates, descriptions and amounts.'
      },
      {
        t: 'Inspect before you trust',
        blocks: [
          { code: 'df.info()\nprint(df["amount"].dtype)          # float64 — good\nprint(df["category"].value_counts())\nprint(df["date"].min(), "->", df["date"].max())', lang: 'python' },
          { p: 'You are checking three things: the amount column is numeric, the date range is what you expect, ' +
               'and there are no surprise categories. `value_counts()` on any text column is the fastest way to see what is in it.' }
        ],
        check: 'amount is float64, date runs from 2025-03-01 to 2025-08-27, and you can list the categories.'
      },
      {
        t: 'Filter rows with boolean masks',
        blocks: [
          { p: 'A comparison on a column produces a True/False Series. Put it inside `df[...]` to keep only the True rows.' },
          { code: 'spend = df[df["amount"] < 0].copy()          # money out only\nincome = df[df["category"] == "income"]      # NOT amount > 0 — refunds!\n\nprint(len(spend), "outgoing rows")\nprint(f"Income:  ${income[\'amount\'].sum():,.2f}")\nprint(f"Outgoing: ${spend[\'amount\'].sum():,.2f}")', lang: 'python' },
          { p: 'Combine conditions with `&` (and) / `|` (or), and wrap each condition in brackets — Python\'s operator ' +
               'precedence will bite you otherwise:' },
          { code: 'big_dining = df[(df["category"] == "dining") & (df["amount"] < -30)]\nprint(big_dining[["date", "description", "amount"]].to_string(index=False))', lang: 'python' }
        ],
        check: 'Income prints $20,100.00 — confirming that the refunds were correctly excluded.'
      },
      {
        t: 'Add columns you need',
        blocks: [
          { code: 'spend["abs_amount"] = spend["amount"].abs()\nspend["month"] = spend["date"].dt.to_period("M")\nspend["weekday"] = spend["date"].dt.day_name()\n\nspend.head(3)', lang: 'python' },
          { p: 'Assigning to a column name that does not exist creates it. This is why you took a `.copy()` when filtering — ' +
               'without it pandas cannot tell whether you meant to modify the original table.' }
        ],
        check: 'spend has abs_amount, month and weekday columns and no SettingWithCopyWarning.'
      },
      {
        t: 'Aggregate with groupby',
        blocks: [
          { code: '# by category, largest first\nby_cat = spend.groupby("category")["abs_amount"].sum().sort_values(ascending=False)\nprint(by_cat.round(2).to_string())\n\n# by month\nby_month = spend.groupby("month")["abs_amount"].sum()\nprint(by_month.round(2).to_string())\n\n# top merchants\ntop = spend.groupby("description")["abs_amount"].sum().sort_values(ascending=False).head(10)', lang: 'python' },
          { p: 'You can aggregate several ways at once with `.agg()` — useful when you want both a total and a count:' },
          { code: 'summary = spend.groupby("category")["abs_amount"].agg(["sum", "count", "mean"]).round(2)\nsummary = summary.sort_values("sum", ascending=False)\nsummary', lang: 'python' }
        ],
        check: 'Housing is the largest category at $6,900.00 and subscriptions total $461.76.'
      },
      {
        t: 'Detect recurring charges',
        blocks: [
          { p: 'Group by merchant **and** amount together by passing a list. `.size()` counts rows in each group; ' +
               '`reset_index` turns the result back into a normal DataFrame.' },
          { code: 'counts = (spend.groupby(["description", "abs_amount"])\n                .size()\n                .reset_index(name="times"))\n\nrecurring = counts[counts["times"] >= 3].sort_values("abs_amount", ascending=False)\nrecurring["yearly_cost"] = recurring["abs_amount"] * 12\nprint(recurring.to_string(index=False))', lang: 'python' },
          { p: 'Rent and the savings transfer will show up too — they are genuinely recurring. Your report should separate ' +
               '"subscriptions you could cancel" from "fixed commitments you cannot", and that is a judgement your code makes explicit.' }
        ],
        check: 'You can list the recurring charges with their annual cost, including CLOUDSTREAM TV at $191.88 a year.'
      },
      {
        t: 'Draw one honest chart',
        blocks: [
          { code: 'import matplotlib.pyplot as plt\n\nchart = by_cat.drop("savings", errors="ignore").sort_values()\nax = chart.plot(kind="barh", figsize=(8, 4), color="#2ee6a8")\nax.set_title("Spending by category — Mar to Aug 2025")\nax.set_xlabel("USD")\nplt.tight_layout()\nplt.show()', lang: 'python' },
          { p: 'Dropping `savings` is a deliberate analytical choice, not a trick: transfers to yourself are not consumption, ' +
               'and leaving them in the chart makes the biggest bar a lie. Say so in a comment.' },
          { tip: 'Save a chart with `plt.savefig("spending.png", dpi=150, bbox_inches="tight")` and upload the PNG to your ' +
                 'repo so the README can show it.' }
        ],
        check: 'A sorted horizontal bar chart appears with a title and an axis label.'
      },
      {
        t: 'Format a report humans will read',
        blocks: [
          { code: 'income_total = df[df["category"] == "income"]["amount"].sum()\nspend_total = spend[spend["category"] != "savings"]["abs_amount"].sum()\nsaved = income_total - spend_total\nrate = saved / income_total\n\nprint("=" * 46)\nprint(f"{\'SIX-MONTH MONEY REPORT\':^46}")\nprint("=" * 46)\nprint(f"Income          ${income_total:>14,.2f}")\nprint(f"Spending        ${spend_total:>14,.2f}")\nprint(f"Saved           ${saved:>14,.2f}")\nprint(f"Savings rate    {rate:>14.1%}")', lang: 'python' },
          { p: '`:^46` centres text in 46 characters, `:>14,.2f` right-aligns money. Plain text reports like this are what ' +
               'gets pasted into a chat channel, so make them tidy.' }
        ],
        check: 'Your report prints with aligned columns and a savings rate around 33.5%.'
      }
    ]
  },

  glossary: [
    { t: 'DataFrame', d: 'A pandas table: named columns, typed values, an index of row labels.' },
    { t: 'Series', d: 'A single typed column of a DataFrame.' },
    { t: 'Boolean mask', d: 'A True/False Series used inside df[...] to select rows.' },
    { t: 'groupby', d: 'Split rows into groups, apply an aggregation, combine results into a table.' },
    { t: 'dtype', d: 'The type of a column. object means text or mixed — usually a warning sign on numeric data.' },
    { t: 'parse_dates', d: 'read_csv argument that converts text columns into real datetimes.' },
    { t: '.dt accessor', d: 'Gives date parts (month, day_name, year) from a datetime column.' },
    { t: 'Sign convention', d: 'The rule deciding whether money out is negative. Must be verified before analysis.' },
    { t: 'Savings rate', d: '(income - spending) / income. The clearest single indicator of financial health.' },
    { t: 'Recurring charge', d: 'An identical amount billed by the same merchant on a regular cadence.' },
    { t: 'Fixed vs variable', d: 'Commitments you cannot change this month versus daily discretionary choices.' }
  ],

  quiz: [
    { q: "Why is `df[df[\"amount\"] > 0]` the wrong way to find income in this dataset?",
      options: [
        "Because income is stored as a negative number",
        "Because it returns a Series instead of a DataFrame",
        "Because pandas cannot compare numbers to columns",
        "Because refunds are also positive amounts, and they are not income"
      ],
      answer: 3,
      why: "Refunds, reversals, and interest credits are all positive. Filter on the category column when you mean income, or you will overstate it." },

    { q: "What does `parse_dates=[\"date\"]` do in read_csv?",
      options: [
        "Removes rows with invalid dates",
        "Sets the date column as the index",
        "Converts the column from text into real datetime values",
        "Sorts the rows by date"
      ],
      answer: 2,
      why: "Without it the column stays text, the .dt accessor is unavailable, and sorting is alphabetical — which places 2025-10 before 2025-3." },

    { q: "df.dtypes shows the amount column as `object`. What does that mean?",
      options: [
        "It is a currency type with correct rounding",
        "It is an integer column",
        "The column has been indexed",
        "It contains text or mixed values — a stray non-numeric entry got in"
      ],
      answer: 3,
      why: "object means text or mixed. Calling .sum() on it concatenates strings instead of adding numbers, giving a silently wrong answer." },

    { q: "What is a boolean mask?",
      options: [
        "A True/False Series used inside df[...] to select rows",
        "A way of hiding columns from display",
        "A pandas method that converts types",
        "A password on a DataFrame"
      ],
      answer: 0,
      why: "df[\"amount\"] < 0 produces a True/False Series; df[mask] keeps the True rows. It is the standard filtering idiom." },

    { q: "Which expression correctly selects dining transactions over $30?",
      options: [
        "df[df[\"category\"] == \"dining\" and df[\"amount\"] < -30]",
        "df[(df[\"category\"] == \"dining\") & (df[\"amount\"] < -30)]",
        "df[df[\"category\"] == \"dining\" && df[\"amount\"] < -30]",
        "df.filter(\"dining\", -30)"
      ],
      answer: 1,
      why: "pandas uses & and |, not and/or, and every condition needs its own brackets because & binds tighter than the comparison operators." },

    { q: "What does `SettingWithCopyWarning` usually indicate?",
      options: [
        "You filtered a DataFrame and then added a column without taking a .copy()",
        "A column contains missing values",
        "Your data contains duplicates",
        "You are out of memory"
      ],
      answer: 0,
      why: "pandas cannot tell whether you meant to modify the original or the filtered view. Adding .copy() when you filter states your intent and removes the warning." },

    { q: "What does the split-apply-combine pattern describe?",
      options: [
        "Splitting a column into first and last name",
        "Grouping rows, aggregating each group, and combining the results into a table",
        "Merging two DataFrames on a key",
        "Splitting a CSV into several files"
      ],
      answer: 1,
      why: "That is exactly what groupby does, and nearly every analytics question reduces to it." },

    { q: "How do you get a month column from a datetime column?",
      options: [
        "df[\"date\"].dt.to_period(\"M\")",
        "df[\"date\"].month",
        "df[\"date\"].astype(\"month\")",
        "df.month(\"date\")"
      ],
      answer: 0,
      why: "Date parts live under the .dt accessor on a Series. .dt.to_period(\"M\") gives a month period; .dt.month would give just the number 3." },

    { q: "What does `spend.groupby([\"description\", \"abs_amount\"]).size()` produce?",
      options: [
        "The average amount per merchant",
        "A count of rows for each unique merchant-and-amount pair",
        "The total amount per merchant",
        "The number of columns in each group"
      ],
      answer: 1,
      why: "Passing a list groups by both keys at once, and .size() counts the rows — which is how identical repeated charges reveal themselves." },

    { q: "Why should a transfer to your own savings account be excluded from \"spending\"?",
      options: [
        "Because savings transfers are usually duplicates",
        "Because banks do not report transfers",
        "Because transfers always have a zero amount",
        "Because the money is still yours — counting it as an expense understates the user's position"
      ],
      answer: 3,
      why: "Moving money between your own accounts changes location, not net worth. Several shipped budgeting apps get this wrong and users notice immediately." },

    { q: "A subscription-detection rule finds merchants with at least three identical charges. What false positive should you expect?",
      options: [
        "Fixed commitments like rent or a savings transfer, which are recurring but not cancellable",
        "One-off electronics purchases",
        "Refunds",
        "Coffee shop visits at random prices"
      ],
      answer: 0,
      why: "Rent is perfectly recurring and perfectly identical. A useful report separates cancellable subscriptions from fixed commitments rather than lumping them together." },

    { q: "Which chart best answers \"which category did I spend most on\"?",
      options: [
        "A pie chart of all categories",
        "A scatter plot of amount against date",
        "A horizontal bar chart sorted by size",
        "A stacked area chart"
      ],
      answer: 2,
      why: "Bars share a common baseline so the eye compares lengths precisely. Pie charts require comparing angles, which people do badly." },

    { q: "Income is $20,100 and spending excluding savings transfers is $13,358.30. What is the savings rate?",
      options: [
        "65.4%",
        "8.96%",
        "33.5%",
        "66.5%"
      ],
      answer: 2,
      why: "(20,100 - 13,358.30) / 20,100 = 0.3354. The savings rate is the share of income that did not get spent — not the share that was transferred." },

    { q: "What does `.value_counts()` on a text column tell you?",
      options: [
        "The number of missing values",
        "How many times each distinct value appears",
        "The column type",
        "The sum of the column"
      ],
      answer: 1,
      why: "It is the fastest way to see what is actually in a categorical column — including typos and unexpected categories." },

    { q: "In `f\"${total:>14,.2f}\"`, what does the `>` do?",
      options: [
        "Adds a greater-than sign to the output",
        "Rounds up to the next whole number",
        "Right-aligns the value within 14 characters",
        "Compares total to 14"
      ],
      answer: 2,
      why: "Alignment specifiers are < left, > right, ^ centre, followed by the width. Right-aligned money columns are what make a text report readable." }
  ],

  project: {
    title: 'Personal Spending Analyzer',
    story: 'A society member hands you six months of their bank export and one question: "where is my money going?" ' +
           'Build the analyzer that answers it — and finds them at least one thing worth cancelling.',
    scope: 'Uses only this level plus Level 2: pandas (read_csv, masks, groupby, sort_values, value_counts, .dt, .abs), ' +
           'matplotlib bar charts, f-string formatting, and functions. No machine learning, no APIs, no classes.',
    dataset: '{{RAW}}/data/level-03-transactions.csv',
    requirements: [
      'Load the CSV from the URL with dates parsed, and print shape plus dtypes to prove the load is clean',
      'A function `load_data(url)` returning a DataFrame with `abs_amount`, `month` and `weekday` columns added',
      'A function `headline_numbers(df)` returning total income, total spend excluding savings transfers, net cash flow, and savings rate',
      'A function `by_category(df)` returning spend per category sorted largest first',
      'A function `by_month(df)` returning spend and income per month side by side',
      'A function `top_merchants(df, n=10)` returning the biggest merchants by total spend',
      'A function `find_recurring(df, min_times=3)` returning merchant, amount, times seen, and annual cost',
      'Your recurring output must separate cancellable subscriptions from fixed commitments (rent, utilities, savings)',
      'A function `weekday_pattern(df)` showing which day of the week the user spends most on',
      'One sorted horizontal bar chart of spending by category, excluding savings transfers, with a title and axis label',
      'A `report(df)` function printing an aligned plain-text summary of everything above',
      'Three written findings in a markdown cell, each with the number that supports it and one concrete recommendation',
      'Notebook saved to your portfolio repo as `level-03-spending-analyzer.ipynb`'
    ],
    starter: {
      lang: 'python',
      code: '"""FinQuest Level 3 — Personal Spending Analyzer"""\n\nimport pandas as pd\nimport matplotlib.pyplot as plt\n\nURL = "{{RAW}}/data/level-03-transactions.csv"\n\n\ndef load_data(url=URL):\n    """Read the CSV and add abs_amount, month and weekday columns."""\n    # TODO: parse_dates, then build the helper columns\n    pass\n\n\ndef headline_numbers(df):\n    """Return a dict: income, spend (excl. savings), net, savings_rate."""\n    # TODO\n    pass\n\n\ndef by_category(df):\n    """Spend per category, largest first."""\n    # TODO\n    pass\n\n\ndef by_month(df):\n    """Spend and income per month."""\n    # TODO\n    pass\n\n\ndef top_merchants(df, n=10):\n    """Biggest merchants by total spend."""\n    # TODO\n    pass\n\n\ndef find_recurring(df, min_times=3):\n    """Merchants charging an identical amount at least min_times.\n    Include a yearly_cost column and a flag for cancellable vs fixed.\n    """\n    # TODO\n    pass\n\n\ndef weekday_pattern(df):\n    """Total spend by day of week."""\n    # TODO\n    pass\n\n\ndef plot_categories(df):\n    """Sorted horizontal bar chart, savings transfers excluded."""\n    # TODO\n    pass\n\n\ndef report(df):\n    """Print the whole analysis as an aligned text report."""\n    # TODO\n    pass\n\n\nif __name__ == "__main__":\n    data = load_data()\n    report(data)\n    plot_categories(data)\n'
    },
    tests: [
      'The DataFrame has 233 rows and 6 original columns',
      'Total income (category == "income") is exactly $20,100.00',
      'Total spend excluding savings transfers is $13,358.30',
      'Net cash flow (sum of every amount) is $5,072.74',
      'Savings rate is 33.5% (to one decimal)',
      'Housing is the top category at $6,900.00; subscriptions total $461.76 over six months',
      'find_recurring finds 8 recurring charges at min_times=3, of which 5 are cancellable subscriptions',
      'CLOUDSTREAM TV appears at $15.99 x 6 — an annual cost of $191.88',
      'Monthly subscription cost is $76.96'
    ],
    rubric: [
      { pts: 25, t: 'Correct aggregation', d: 'Headline numbers match the expected values, including the income-vs-refund and savings-transfer distinctions.' },
      { pts: 20, t: 'Recurring detection', d: 'Finds all repeated identical charges and separates cancellable from fixed.' },
      { pts: 20, t: 'Clean pandas', d: 'Masks and groupby instead of loops, .copy() when filtering, no SettingWithCopyWarning, no hardcoded totals.' },
      { pts: 20, t: 'Communication', d: 'Readable text report, one honest labelled chart, three findings each backed by a number and a recommendation.' },
      { pts: 15, t: 'Shipped', d: 'Notebook in your GitHub portfolio repo, runs top to bottom without errors after Restart & Run All.' }
    ],
    stretch: [
      'Flag any month where spending exceeded income and print by how much',
      'Add a `category_share(df)` that expresses each category as a percentage of total spend',
      'Detect a subscription price increase: same merchant, two different repeated amounts',
      'Rebuild the report for a rolling 3-month window instead of the whole file'
    ],
    solutionPath: 'solutions/level-03'
  },

  faq: [
    { q: 'read_csv gives a 404 or connection error',
      a: 'Check the URL is the raw.githubusercontent.com form, not the github.com page. Otherwise download the CSV and drag it into ' +
         'the Colab file panel, then read it by filename.' },
    { q: 'What is SettingWithCopyWarning and how do I fix it?',
      a: 'It appears when you add a column to a filtered slice. Take a copy at filter time: spend = df[df["amount"] < 0].copy().' },
    { q: 'My income total looks too high',
      a: 'You are probably using amount > 0, which includes refunds. Filter on category == "income" instead. The correct total is $20,100.00.' },
    { q: 'Why is my savings rate negative or over 100%?',
      a: 'You likely counted the transfer to savings as spending, or included it in both places. Exclude category == "savings" from spend, then (income - spend) / income.' },
    { q: 'How do I group by month?',
      a: 'Make sure the date column is datetime (parse_dates), then df["month"] = df["date"].dt.to_period("M") and group on that.' },
    { q: 'My chart is unreadable / bars are in random order',
      a: 'Sort before plotting: by_cat.sort_values().plot(kind="barh"). Add a title and an axis label, and drop savings transfers.' },
    { q: 'How do I find subscriptions?',
      a: 'Group by both description and absolute amount, count with .size(), and keep groups seen 3+ times. Then separate cancellable subscriptions from fixed commitments like rent.' }
  ]
});
