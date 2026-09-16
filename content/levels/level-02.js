/* =========================================================================
   LEVEL 2: The Time Value of Money
   ========================================================================= */
FQ.registerLevel({
  id: 2,
  codename: 'COMPOUNDING',
  title: 'The Time Value of Money',
  tagline: 'Interest, compounding, and the single formula the whole industry is built on.',
  difficulty: 2,
  minutes: 90,
  tags: ['interest', 'compounding', 'python basics'],
  summary: 'A dollar today is worth more than a dollar next year. Every product in finance (savings, loans, bonds, ' +
           'pensions, valuations) is a variation on that sentence. This level turns it into code.',

  objectives: [
    'Separate simple interest from compound interest and explain why the gap explodes over time',
    'Apply the future-value formula with any compounding frequency',
    'Add regular contributions using the annuity formula',
    'Convert between APR, periodic rate, and APY/EAR, and say why banks quote each one',
    'Discount a future amount back to present value and adjust returns for inflation',
    'Write Python functions with default arguments, loops, and formatted output'
  ],

  knowledge: [
    { h: 'Interest is rent on money' },
    { p: 'If you lend someone $1,000 for a year, you cannot use it, and they might not pay it back. **Interest** is what you ' +
         'charge for those two costs. Everything else in this level is bookkeeping on top of that idea.' },
    { p: '**Simple interest** is charged only on the original amount (the *principal*):' },
    { code: 'Interest = P x r x t\nFV      = P x (1 + r x t)', lang: 'text', label: 'simple interest' },
    { p: '**Compound interest** is charged on the principal *plus all interest accumulated so far*. Your interest earns interest:' },
    { code: 'FV = P x (1 + r/n) ** (n x t)\n\nP = principal        r = annual rate (0.05 = 5%)\nn = compounds/year   t = years', lang: 'text', label: 'compound interest' },
    { table: {
      head: ['$1,000 at 8%', 'After 10 yrs', 'After 30 yrs', 'After 45 yrs'],
      rows: [
        ['Simple', '$1,800', '$3,400', '$4,600'],
        ['Compound (yearly)', '$2,159', '$10,063', '$31,920'],
        ['Gap', '+$359', '+$6,663', '**+$27,320**']
      ]
    }},
    { money: 'This table is why pension products, student loans, and credit-card debt all behave so differently from what ' +
             'people expect. Compounding is not a small correction. Over decades it is the whole result.' },

    { h: 'Compounding frequency: n matters, but less than you think' },
    { p: 'The same 8% can be applied once a year, monthly, daily, or continuously. More frequent compounding means each ' +
         'slice of interest starts earning sooner, so the effective return rises, but with diminishing returns.' },
    { table: {
      head: ['Compounding of 8% on $1,000 for 1 year', 'n', 'Result'],
      rows: [
        ['Annually', '1', '$1,080.00'],
        ['Quarterly', '4', '$1,082.43'],
        ['Monthly', '12', '$1,083.00'],
        ['Daily', '365', '$1,083.28'],
        ['Continuously', 'infinity', '$1,083.29']
      ]
    }},
    { p: 'Notice the jump from annual to monthly is worth $3.00, and going from monthly all the way to continuous is worth ' +
         '29 cents. Frequency matters most at high rates and long horizons.' },

    { h: 'APR vs APY: the same money, two quotes' },
    { p: 'The **APR** (also called the nominal rate) is just the periodic rate multiplied out: 1% a month is quoted as a 12% APR. ' +
         'It ignores the fact that you compound along the way. The **APY** (savings) or **EAR** (loans) folds compounding in:' },
    { code: 'periodic rate = APR / n\nAPY = (1 + APR/n) ** n - 1', lang: 'text', label: 'converting between quotes' },
    { p: 'A credit card at 24% APR compounding monthly has a periodic rate of 2% a month and an **APY of 26.82%**. ' +
         'That 2.82-point gap is real money you owe that the headline number never showed you.' },
    { warn: 'Rule of thumb for reading any product: **lenders advertise APR (looks smaller), savers are shown APY (looks bigger)**. ' +
            'When comparing two offers, always convert both to the same basis first.' },

    { h: 'Adding regular contributions' },
    { p: 'Real savings are not one lump sum. They are $200 every month. Each contribution compounds for a different length of time, ' +
         'and summing that series gives the **future value of an annuity**:' },
    { code: 'FV_contributions = C x [ ((1 + i) ** N - 1) / i ]\n\nC = payment per period   i = rate per period (r/n)\nN = total periods (n x t)', lang: 'text', label: 'annuity (end of period)' },
    { p: 'The total for a plan with both a starting balance and monthly deposits is simply the two formulas added together. ' +
         'When `i` is 0 the formula divides by zero: with no interest the answer is just `C x N`, and your code has to handle that case.' },
    { tip: '**Rule of 72**: money doubles in roughly `72 / rate%` years. At 8%, about 9 years. It is accurate enough for ' +
           'mental math in a meeting and it impresses people.' },

    { h: 'Running the formula backwards: present value' },
    { p: 'If $10,000 lands in your account in 5 years, what is that promise worth today at a 6% discount rate?' },
    { code: 'PV = FV / (1 + r) ** t\n\n10000 / 1.06 ** 5 = $7,472.58', lang: 'text', label: 'discounting' },
    { p: 'This operation (**discounting**) is how bonds, company valuations, lease accounting and insurance reserves are priced. ' +
         'The rate you discount at expresses how risky and how delayed the money is.' },

    { h: 'Inflation: the return you actually keep' },
    { p: 'Earning 6% while inflation runs at 4% does not leave you 2% better off in a naive sense, the exact relationship is:' },
    { code: 'real return = (1 + nominal) / (1 + inflation) - 1\n\n(1.06 / 1.04) - 1 = 0.01923  ->  1.92%', lang: 'text', label: 'Fisher relation' },
    { p: 'Subtracting (6% - 4% = 2%) is a decent approximation at low rates and badly wrong at high ones. Any savings ' +
         'projection that ignores inflation is selling an illusion: a "$1,000,000 retirement" in 40 years at 3% inflation ' +
         'buys about $306,000 of today\'s shopping.' },

    { h: 'Floats are fine here: with one rule' },
    { p: 'Level 1 said never store a *balance* as a float. Projections are different: you are modelling the future, ' +
         'not recording what happened, so tiny rounding is harmless. The rule is: **compute in full precision, round only when you print**.' },
    { code: 'total = 1234.5678\nprint(f"${total:,.2f}")   # $1,234.57  <- rounded for display only', lang: 'python' }
  ],

  tutorial: {
    intro: 'Open a fresh Colab notebook called `finquest-level-02.ipynb`. Every tool the project needs is introduced below. ' +
           'Nothing else is required.',
    steps: [
      {
        t: 'Arithmetic and the power operator',
        blocks: [
          { p: 'Python uses `**` for exponents, not `^`. This is the single most common first-day mistake in financial code.' },
          { code: 'principal = 1000\nrate = 0.08\nyears = 10\n\nsimple = principal * (1 + rate * years)\ncompound = principal * (1 + rate) ** years\n\nprint(f"Simple:   ${simple:,.2f}")\nprint(f"Compound: ${compound:,.2f}")\nprint(f"Gap:      ${compound - simple:,.2f}")', lang: 'python' },
          { warn: '`^` is **not** a power operator in Python. It is bitwise XOR. With a float rate you get ' +
                  '`TypeError: unsupported operand type(s) for ^`, and with whole numbers it is worse: `2 ^ 10` quietly ' +
                  'returns `8` instead of `1024`. Always `**`.' }
        ],
        check: 'You printed the simple and compound results and the gap between them.'
      },
      {
        t: 'Write a reusable future-value function',
        blocks: [
          { p: 'Arguments with an `=` are **defaults**: callers may leave them out. Put required arguments first.' },
          { code: 'def future_value(principal, annual_rate, years, compounds_per_year=1):\n    """Future value of a lump sum with periodic compounding."""\n    i = annual_rate / compounds_per_year        # rate per period\n    n = compounds_per_year * years              # number of periods\n    return principal * (1 + i) ** n\n\nprint(future_value(1000, 0.08, 10))            # annual  -> 2158.92\nprint(future_value(1000, 0.08, 10, 12))        # monthly -> 2219.64\nprint(future_value(1000, 0.08, 10, compounds_per_year=365))', lang: 'python' },
          { p: 'You can pass arguments by position or by name. Naming them makes financial code far easier to read six months later.' }
        ],
        check: 'future_value(1000, 0.08, 10) returns about 2158.92.'
      },
      {
        t: 'Add contributions with the annuity formula',
        blocks: [
          { p: 'Guard the zero-rate case before you divide. This is the kind of edge case that crashes a real calculator ' +
               'the first time a user types 0.' },
          { code: 'def contributions_value(payment, annual_rate, years, compounds_per_year=12):\n    """Future value of a regular payment made at the end of each period."""\n    i = annual_rate / compounds_per_year\n    n = compounds_per_year * years\n    if i == 0:\n        return payment * n            # no interest: just the deposits\n    return payment * (((1 + i) ** n - 1) / i)\n\nplan = future_value(2000, 0.07, 20, 12) + contributions_value(200, 0.07, 20, 12)\nprint(f"20-year plan: ${plan:,.2f}")', lang: 'python' }
        ],
        check: 'A $2,000 start plus $200/month at 7% for 20 years gives $112,262.81.'
      },
      {
        t: 'Build a year-by-year table with a loop',
        blocks: [
          { p: 'A single number tells a user nothing. A schedule shows them where the growth comes from. ' +
               '`range(1, years + 1)` counts 1..years inclusive.' },
          { code: 'def growth_table(principal, rate, years, monthly=0):\n    """Print a year-by-year breakdown."""\n    print(f"{\'Year\':<6}{\'Balance\':>14}{\'Deposited\':>14}{\'Interest\':>14}")\n    for year in range(1, years + 1):\n        balance = (future_value(principal, rate, year, 12)\n                   + contributions_value(monthly, rate, year, 12))\n        deposited = principal + monthly * 12 * year\n        interest = balance - deposited\n        print(f"{year:<6}{balance:>14,.2f}{deposited:>14,.2f}{interest:>14,.2f}")\n\ngrowth_table(2000, 0.07, 10, monthly=200)', lang: 'python' },
          { p: 'In an f-string, `:<6` left-aligns in 6 characters and `:>14,.2f` right-aligns in 14 with thousands separators. ' +
               'Aligned columns are how you make a plain text table readable.' }
        ],
        check: 'Your table has aligned columns and the interest column grows faster each year.'
      },
      {
        t: 'Solve backwards with a while loop',
        blocks: [
          { p: '"When do I hit $50,000?" cannot be answered by the formula directly, so step forward until you cross the target. ' +
               'Always include a safety limit so a bad input cannot loop forever.' },
          { code: 'def years_to_target(principal, rate, target, monthly=0, max_years=100):\n    """Return the first whole year in which the balance reaches target."""\n    for year in range(1, max_years + 1):\n        balance = (future_value(principal, rate, year, 12)\n                   + contributions_value(monthly, rate, year, 12))\n        if balance >= target:\n            return year\n    return None          # unreachable within max_years\n\nprint(years_to_target(2000, 0.07, 50000, monthly=200))   # 13', lang: 'python' },
          { tip: 'Returning `None` instead of crashing is a deliberate choice: the caller decides how to tell the user ' +
                 '"this goal is not reachable". Your project is graded on handling that case.' }
        ],
        check: 'years_to_target returns a number for a reachable goal and None for an impossible one.'
      },
      {
        t: 'APY, real returns, and rounding for display',
        blocks: [
          { code: 'def apy(apr, compounds_per_year):\n    """Effective annual yield from a nominal APR."""\n    return (1 + apr / compounds_per_year) ** compounds_per_year - 1\n\ndef real_value(nominal_amount, inflation, years):\n    """What a future amount buys in today\'s money."""\n    return nominal_amount / (1 + inflation) ** years\n\nprint(f"24% APR monthly  -> APY {apy(0.24, 12):.2%}")     # 26.82%\nprint(f"$1,000,000 in 40y -> ${real_value(1_000_000, 0.03, 40):,.0f} today")', lang: 'python' },
          { p: 'Underscores in numbers (`1_000_000`) are ignored by Python and make large amounts readable. ' +
               'The `.2%` format multiplies by 100 and adds the sign for you, never do that by hand.' }
        ],
        check: 'apy(0.24, 12) prints 26.82% and the inflation-adjusted million is about $306,557.'
      }
    ]
  },

  glossary: [
    { t: 'Principal', d: 'The original amount invested or borrowed, before any interest.' },
    { t: 'Simple interest', d: 'Interest charged only on the principal: P x r x t.' },
    { t: 'Compound interest', d: 'Interest charged on principal plus accumulated interest: P(1 + r/n)^(nt).' },
    { t: 'Compounding frequency (n)', d: 'How many times per year interest is applied. Higher n means a higher effective rate.' },
    { t: 'Future value (FV)', d: 'What an amount today will be worth at a future date given a rate.' },
    { t: 'Present value (PV)', d: 'What a future amount is worth today: FV / (1 + r)^t.' },
    { t: 'Discounting', d: 'Converting a future cash flow into present value: the core of every valuation.' },
    { t: 'APR', d: 'Nominal annual rate: periodic rate x periods. Ignores compounding within the year.' },
    { t: 'APY / EAR', d: 'Effective annual rate including compounding: (1 + APR/n)^n - 1.' },
    { t: 'Annuity', d: 'A series of equal payments at regular intervals.' },
    { t: 'Rule of 72', d: 'Money roughly doubles in 72 / rate% years.' },
    { t: 'Real return', d: 'Return after inflation: (1 + nominal)/(1 + inflation) - 1.' },
    { t: 'Nominal amount', d: 'A number of currency units before adjusting for inflation.' }
  ],

  quiz: [
    { q: "$5,000 earns 6% simple interest for 3 years. What is the total interest?",
      options: [
        "$1,080",
        "$955.08",
        "$300",
        "$900"
      ],
      answer: 3,
      why: "Simple interest is P x r x t = 5000 x 0.06 x 3 = $900. Compound interest over the same period would give $955.08." },

    { q: "Which expression correctly computes compound future value in Python?",
      options: [
        "principal * (1 + rate * years)",
        "principal ** (1 + rate) * years",
        "principal * (1 + rate) ^ years",
        "principal * (1 + rate) ** years"
      ],
      answer: 3,
      why: "Python uses ** for exponents. The ^ operator is bitwise XOR: with a float rate it raises a TypeError, and with whole numbers it silently returns a wrong answer (2 ^ 10 gives 8, not 1024)." },

    { q: "In FV = P(1 + r/n)^(nt), what does n represent?",
      options: [
        "The number of years",
        "How many times interest compounds per year",
        "The nominal rate",
        "The number of payments made"
      ],
      answer: 1,
      why: "n is the compounding frequency. It divides the annual rate into a periodic rate and multiplies the years into total periods." },

    { q: "A card advertises 24% APR compounding monthly. What is the effective annual rate?",
      options: [
        "26.82%",
        "24.00%",
        "22.14%",
        "2.00%"
      ],
      answer: 0,
      why: "(1 + 0.24/12)^12 - 1 = 0.2682. The monthly 2% compounds into 26.82% a year: the gap the headline APR hides." },

    { q: "Why do lenders advertise APR while savings accounts advertise APY?",
      options: [
        "Regulators require exactly that split in every country",
        "APY cannot be calculated for loans",
        "APR is the smaller-looking number for a borrower and APY the bigger-looking one for a saver",
        "APR includes inflation and APY does not"
      ],
      answer: 2,
      why: "Both describe the same money; each side quotes the basis that flatters it. Always convert competing offers to a common basis before comparing." },

    { q: "Increasing compounding from monthly to daily on an 8% account has what effect?",
      options: [
        "Roughly doubles the interest earned",
        "Adds a very small amount: the returns to frequency diminish quickly",
        "Has no effect at all",
        "Reduces the effective rate"
      ],
      answer: 1,
      why: "On $1,000 for a year, monthly gives $1,083.00 and daily $1,083.28. Continuous compounding only reaches $1,083.29: frequency matters far less than rate or time." },

    { q: "What does the annuity formula C x [((1+i)^N - 1) / i] calculate?",
      options: [
        "The present value of a lump sum",
        "The monthly payment needed to repay a loan",
        "The future value of a series of equal periodic payments",
        "The effective annual rate"
      ],
      answer: 2,
      why: "It sums a stream of equal deposits, each compounding for a different remaining time. Level 6 rearranges the same relationship to solve for a loan payment." },

    { q: "Your contributions function must handle a 0% rate. Why?",
      options: [
        "Because the future value would be negative",
        "Because Python cannot multiply by zero",
        "Because the formula divides by i, and dividing by zero raises ZeroDivisionError",
        "Because a 0% rate is illegal in most countries"
      ],
      answer: 2,
      why: "With i = 0 the formula is undefined; the correct answer is simply payment x periods. Guard the case explicitly with an if statement." },

    { q: "What is $10,000 received in 5 years worth today at a 6% discount rate?",
      options: [
        "$7,472.58",
        "$13,382.26",
        "$9,433.96",
        "$8,000.00"
      ],
      answer: 0,
      why: "PV = 10000 / 1.06^5 = $7,472.58. Discounting is the same compounding relationship run backwards." },

    { q: "You earn 6% nominal while inflation is 4%. What is the real return?",
      options: [
        "1.92%",
        "Exactly 2.00%",
        "2.08%",
        "10.24%"
      ],
      answer: 0,
      why: "(1.06 / 1.04) - 1 = 1.92%. Subtracting rates is a shortcut that is close at low rates and increasingly wrong as rates rise." },

    { q: "Using the Rule of 72, roughly how long does money take to double at 9%?",
      options: [
        "4 years",
        "8 years",
        "12 years",
        "18 years"
      ],
      answer: 1,
      why: "72 / 9 = 8 years. The exact answer via logarithms is 8.04 years: close enough for mental math." },

    { q: "Why is `for year in range(1, years + 1)` used instead of `range(years)`?",
      options: [
        "It avoids floating point errors",
        "range(years) is not valid Python",
        "It runs faster",
        "range is exclusive of its end, and a schedule should start at year 1, not year 0"
      ],
      answer: 3,
      why: "range(1, 11) yields 1 through 10. Using range(10) would give 0 through 9, labelling your first row \"Year 0\"." },

    { q: "In an f-string, what does `f\"{rate:.2%}\"` produce for rate = 0.0682?",
      options: [
        "0.07",
        "6.82%",
        "0.0682%",
        "68.20%"
      ],
      answer: 1,
      why: "The % format multiplies by 100, appends the sign, and applies the given precision. Doing it manually is a common source of 100x bugs." },

    { q: "Your goal-solver loop must return something when a target is unreachable. What is the best design?",
      options: [
        "Cap the search with max_years and return None so the caller can report it",
        "Loop forever until it is reached",
        "Raise an error that crashes the program",
        "Return 0 years"
      ],
      answer: 0,
      why: "An unbounded loop can hang the whole app on a 0% rate. A bounded search with a None result lets the interface say \"not reachable in 100 years\" gracefully." },

    { q: "When should a financial projection round its numbers?",
      options: [
        "Never, always show full precision",
        "Only when the number exceeds 1,000",
        "Only when displaying the result to a user",
        "After every single calculation step"
      ],
      answer: 2,
      why: "Rounding mid-calculation injects error that compounds along with the interest. Keep full precision internally and format at the edge." }
  ],

  project: {
    title: 'Compound Growth Engine',
    story: 'The Spider Fintech Society is building a savings coach. Members enter what they have, what they can add each ' +
           'month, and what they are aiming for. Your engine answers three questions: how much will I have, when do I hit my ' +
           'goal, and what is it actually worth after inflation.',
    scope: 'Everything you need is in this level: arithmetic with **, functions with defaults, for and while loops, ' +
           'if statements, f-string formatting. No libraries, no file reading, no classes.',
    requirements: [
      'A function `future_value(principal, annual_rate, years, compounds_per_year=12)` returning the lump-sum future value',
      'A function `contributions_value(payment, annual_rate, years, compounds_per_year=12)` that correctly returns payment x periods when the rate is 0',
      'A function `plan_value(...)` that combines a starting balance and monthly contributions into one total',
      'A function `growth_table(...)` printing year, balance, total deposited, and interest earned in aligned columns',
      'A function `years_to_target(...)` returning the first year the goal is reached, or None if it is not reachable within 100 years',
      'A function `apy(apr, compounds_per_year)` and a printed comparison of a 24% APR card vs its true APY',
      'A function `real_value(amount, inflation, years)` and a final line showing the goal in today\'s money',
      'A `summary(...)` function that prints a readable report: inputs, final balance, interest share, year the goal is hit, inflation-adjusted value',
      'Every printed money amount formatted with thousands separators and 2 decimals; every rate with `.2%`',
      'At least three worked scenarios at the bottom of the notebook (conservative 4%, balanced 7%, aggressive 10%)',
      'A short markdown cell explaining, in your own words, why the interest column grows faster each year',
      'Notebook saved to your finquest-portfolio repo as `level-02-compound-growth.ipynb`'
    ],
    starter: {
      lang: 'python',
      code: '"""FinQuest Level 2: Compound Growth Engine\nAuthor: <your name>\n"""\n\ndef future_value(principal, annual_rate, years, compounds_per_year=12):\n    """Future value of a lump sum. FV = P(1 + r/n)^(nt)"""\n    # TODO\n    pass\n\n\ndef contributions_value(payment, annual_rate, years, compounds_per_year=12):\n    """Future value of regular end-of-period payments.\n    Remember the zero-rate case: with no interest the answer is payment * periods.\n    """\n    # TODO\n    pass\n\n\ndef plan_value(principal, payment, annual_rate, years, compounds_per_year=12):\n    """Starting balance + contributions."""\n    # TODO\n    pass\n\n\ndef growth_table(principal, payment, annual_rate, years):\n    """Print year | balance | deposited | interest, aligned."""\n    # TODO\n    pass\n\n\ndef years_to_target(principal, payment, annual_rate, target, max_years=100):\n    """First whole year the balance reaches target, else None."""\n    # TODO\n    pass\n\n\ndef apy(apr, compounds_per_year):\n    """Effective annual yield."""\n    # TODO\n    pass\n\n\ndef real_value(amount, inflation, years):\n    """Purchasing power of a future amount in today\'s money."""\n    # TODO\n    pass\n\n\ndef summary(principal, payment, annual_rate, years, target, inflation=0.03):\n    """Print the full report."""\n    # TODO\n    pass\n\n\n# --- scenarios -------------------------------------------------------------\nsummary(principal=2000, payment=200, annual_rate=0.07, years=20, target=50000)\n'
    },
    tests: [
      'future_value(1000, 0.08, 10, 1) is 2158.92 (to 2dp)',
      'future_value(1000, 0.08, 10, 12) is 2219.64 (to 2dp)',
      'contributions_value(200, 0.0, 10, 12) is exactly 24000: no crash',
      'contributions_value(200, 0.07, 20, 12) is 104,185.33 (to 2dp)',
      'apy(0.24, 12) is 0.2682 (26.82%)',
      'years_to_target(2000, 200, 0.07, 50000) returns 13',
      'years_to_target(100, 0, 0.0, 1000000) returns None rather than looping forever',
      'real_value(1_000_000, 0.03, 40) is 306,556.84 (to 2dp)'
    ],
    rubric: [
      { pts: 30, t: 'Correct math', d: 'All eight functions return the values in the test list, including the zero-rate and unreachable-goal edge cases.' },
      { pts: 20, t: 'Readable output', d: 'Aligned table columns, consistent money and percentage formatting, a report a non-programmer could read.' },
      { pts: 20, t: 'Structure', d: 'Small single-purpose functions with docstrings and sensible default arguments; no copy-pasted blocks.' },
      { pts: 15, t: 'Scenarios & explanation', d: 'Three scenarios run, plus your own written explanation of accelerating interest.' },
      { pts: 15, t: 'Shipped', d: 'Notebook committed to your GitHub portfolio repo with a clear filename.' }
    ],
    stretch: [
      'Add `monthly_needed(target, years, rate)`: solve the annuity formula for the payment instead of the total',
      'Compare beginning-of-period contributions (multiply the annuity by (1 + i)) against end-of-period',
      'Add a simple text bar chart of the yearly balance using "#" * int(balance / 1000)'
    ],
    solutionPath: 'solutions/level-02'
  },

  faq: [
    { q: 'My compound number looks far too small',
      a: 'You almost certainly used ^ instead of **. In Python ^ is bitwise XOR, so it returns a wrong answer without raising an error.' },
    { q: 'ZeroDivisionError in contributions_value',
      a: 'The annuity formula divides by i. When the rate is 0 you must return payment * periods instead. Add: if i == 0: return payment * n.' },
    { q: 'What is the difference between APR and APY again?',
      a: 'APR is the periodic rate multiplied out and ignores compounding. APY compounds it: (1 + APR/n)^n - 1. A 24% APR card charging monthly really costs 26.82% a year.' },
    { q: 'My years_to_target never returns',
      a: 'It has no upper bound. Use for year in range(1, max_years + 1) and return None if the loop finishes: a 0% rate with no contributions can never reach a positive target.' },
    { q: 'How do I format a percentage?',
      a: 'f"{rate:.2%}": it multiplies by 100 and adds the % sign. Do not multiply by 100 yourself as well, or you will report 682% instead of 6.82%.' },
    { q: 'Should I round inside my functions?',
      a: 'No. Keep full precision in the calculation and round only in the f-string when you print. Rounding early compounds the error along with the interest.' }
  ]
});
