/* =========================================================================
   LEVEL 5: the money library everything else imports
   ========================================================================= */
FQ.registerLevel({
  id: 5,
  codename: 'moneykit',
  title: 'The money library everything else imports',
  tagline: 'Every payments company has one library that owns arithmetic on money, and everything else calls it. You are going to write that library, test it the way people test money code, and ship it behind a pipeline that blocks bad merges.',
  difficulty: 5,
  minutes: 300,
  tags: ['Python', 'Decimal', 'testing', 'packaging', 'CI'],
  summary: 'Level 4 stored cents as integers and moved on. That stops working once there are several currencies, percentages, ' +
           'fees to split and a tax line. This level builds a real Money type, gets its rounding and splitting right to the ' +
           'cent, tests it with properties rather than examples, and packages it so other projects can install it. It is also ' +
           'where you pick up the tooling every backend team assumes you already use.',

  objectives: [
    'Say exactly why floats cannot hold money, and what integers and Decimal each cost',
    'Design an immutable Money type that refuses to add two currencies',
    'Choose a rounding rule on purpose, and know what half-even changes',
    'Split an amount without losing or inventing a cent, and prove it',
    'Write property-based tests that find the cases you would not have thought of',
    'Package the library, type check it, and gate merges with a pipeline',
    'Publish it as a repository a reviewer can read in two minutes'
  ],

  knowledge: [
    { h: 'Why money needs its own type' },
    { p: 'Level 4 stored amounts as a whole number of cents, and that solved one problem. Here are three more that a bare ' +
         'integer does not solve. All three have caused real incidents at real companies.' },
    { p: '**Problem one: a decimal amount arrives from outside.** Prices, tax rates and interest rates are written with ' +
         'decimal points, and the obvious way to handle them loses money:' },
    { code: '>>> 0.1 + 0.2\n0.30000000000000004\n\n>>> total = 0.0\n>>> for _ in range(1_000_000):\n...     total += 0.01\n>>> total\n10000.000000171856          # should be exactly 10000.00', lang: 'python' },
    { p: 'A **float** is how a computer stores a number with a decimal point: as a fraction in binary. Most decimal amounts ' +
         'have no exact binary form, in the same way one third has no exact decimal form, so each one is stored as a very ' +
         'close approximation. A million small additions turned into an error of 0.00000017. Tiny, and exactly the kind of ' +
         'number that makes a daily reconciliation fail.' },
    { p: '**Problem two: currencies get mixed.** An integer knows nothing about what it counts:' },
    { code: 'usd_balance = 1000        # $10.00\nvnd_balance = 1000        # 1,000 dong, about four cents\n\ntotal = usd_balance + vnd_balance     # 2000 of... what?', lang: 'python' },
    { p: 'Nothing raises an error. The number 2000 travels through your system and is printed as $20.00 on a statement. This ' +
         'is the most common money bug in companies that operate in more than one country.' },
    { p: '**Problem three: not every currency has two decimal places.** The number of digits after the point is called the ' +
         'currency\'s **exponent**, and it is set by an international standard, ISO 4217:' },
    { table: {
      head: ['Currency', 'Exponent', 'Smallest unit', '1,000 smallest units is'],
      rows: [
        ['USD, EUR, GBP', '2', 'cent, cent, penny', '$10.00'],
        ['JPY, VND, KRW', '0', 'the whole yen, dong, won', '1,000 yen'],
        ['BHD, KWD, TND', '3', 'a thousandth of a dinar', '1.000 dinar']
      ]
    }},
    { p: 'Code that assumes "divide by 100 to display" shows 10.00 yen where it should show 1,000 yen. The fix for all three ' +
         'problems is the same: stop passing bare numbers around, and build a **type** that carries the amount, the currency ' +
         'and the rules together.' },
    { check: {
      q: 'A colleague says the float problem is theoretical, because their amounts are small and the error is in the ' +
         'fourteenth decimal place. Give them a concrete reason to care.',
      a: 'Two reasons, and neither needs a large amount. First, errors add up: a million additions of one cent produced an ' +
         'error of 0.00000017 above, and a real system does far more arithmetic than that, on balances compared for exact ' +
         'equality against a bank statement. A reconciliation that requires a difference of exactly zero fails on a difference ' +
         'of 0.0000002, and somebody spends a day finding out why. Second, comparisons quietly go wrong: `0.1 + 0.2 == 0.3` ' +
         'is `False`, so an `if balance == amount` that should be true is false, and a payment is refused for a reason no log ' +
         'explains.'
    }},

    { h: 'Integers or Decimal: pick one, and know why' },
    { p: 'Python gives you two ways to hold money exactly, and professional codebases use both, in different places.' },
    { table: {
      head: ['', 'Integer minor units', '`Decimal`'],
      rows: [
        ['Holds', '`1999`, meaning $19.99', '`Decimal("19.99")`'],
        ['Exact?', 'Yes: whole numbers are exact', 'Yes: it works in base ten, like a person'],
        ['Speed', 'The fastest thing in the language', 'Roughly ten times slower'],
        ['Good for', 'Storing and moving amounts: ledger columns, API fields', 'Percentages, tax, interest, conversion rates'],
        ['Bad at', 'Anything with a fractional cent in the middle', 'Being fast in a hot loop']
      ]
    }},
    { p: '**`Decimal`** is a number type in Python\'s standard library that stores digits in base ten, the way you write them ' +
         'on paper, so `Decimal("0.1") + Decimal("0.2")` is exactly `Decimal("0.3")`. It is the right tool the moment a ' +
         'calculation has a fractional cent in the middle of it, such as 8.25% tax on $19.99.' },
    { warn: 'Never build a `Decimal` from a float. `Decimal(2.675)` is `2.674999999999999822...` because the float was already ' +
            'wrong before `Decimal` saw it. Always build from a string or an integer: `Decimal("2.675")`.' },
    { p: 'The rule this course uses, and that most payments companies use: **store and move integers, calculate in `Decimal`, ' +
         'and come back to integers before anything is saved.**' },

    { h: 'Rounding is a decision, not a detail' },
    { p: 'Any calculation with a percentage in it produces fractions of a cent, and you have to decide what happens to them. ' +
         'Python\'s built-in `round` is not that decision, and it will surprise you:' },
    { code: '>>> round(2.675, 2)\n2.67                # not 2.68: the float was really 2.674999999999999822', lang: 'python' },
    { p: '`Decimal` makes the decision explicit with `quantize`, which means "give me this number with exactly this many ' +
         'decimal places, rounded this way":' },
    { code: 'from decimal import Decimal, ROUND_HALF_UP, ROUND_HALF_EVEN\n\nDecimal("2.665").quantize(Decimal("0.01"), ROUND_HALF_UP)     # 2.67\nDecimal("2.665").quantize(Decimal("0.01"), ROUND_HALF_EVEN)   # 2.66', lang: 'python' },
    { table: {
      head: ['Rule', 'What it does with an exact half', 'Where you meet it'],
      rows: [
        ['`ROUND_HALF_UP`', 'Always rounds away from zero: 2.665 becomes 2.67', 'What people expect. Common in retail pricing and tax'],
        ['`ROUND_HALF_EVEN`', 'Rounds to the nearest even digit: 2.665 becomes 2.66, 2.675 becomes 2.68', 'The banking default, also called banker\'s rounding'],
        ['`ROUND_DOWN`', 'Cuts the extra digits off', 'Interest some products pay. Read the contract']
      ]
    }},
    { p: 'Why does banking prefer half-even? Because always rounding halves upward adds a tiny bias in one direction, and ' +
         'across millions of rows that bias is real money moving to one side. Half-even sends half the ties up and half down, ' +
         'so it cancels.' },
    { p: 'Now the part that decides real invoices. Seven lines of $1.99, with 8.25% tax. Round each line, or round the ' +
         'invoice once?' },
    { code: 'per line:     7 x round(1.99 x 0.0825) = 7 x 0.16 = $1.12\nper invoice:  round(7 x 1.99 x 0.0825) = round(1.149225) = $1.15\n\nthree cents apart, on one small order', lang: 'text' },
    { p: 'Neither is wrong as arithmetic. One of them is wrong for your business, because tax authorities, card networks and ' +
         'accounting standards each say which they expect. What is always wrong is not knowing which one your code does.' },
    { check: {
      q: 'Your invoice shows three line totals that add up to $59.98, and an order total of $59.97. Both were computed with ' +
         'the same rounding rule. Explain how that happens, and what you do about it.',
      a: 'Each line was rounded before being added, and the order total was calculated from the unrounded amounts and rounded ' +
         'once. Every cent is a legitimate rounding decision and the two paths disagree, which is normal, and is why the fix ' +
         'is a rule rather than a bug fix. Pick one place where rounding happens, usually the line, and make the total the sum ' +
         'of the rounded lines, so the invoice adds up in front of the customer. Then write a test that adds the lines and ' +
         'asserts they equal the total, because this comes back every time somebody adds a discount.'
    }},

    { h: 'Splitting money without losing a cent' },
    { p: 'Three people share a $100.00 bill. In cents, 10000 divided by 3 is 3333 with 1 left over. If you round each share ' +
         'you get 3333 three times, which is $99.99, and a cent has vanished. Money that vanishes breaks the level 4 rule ' +
         'that a transaction sums to zero.' },
    { p: 'The standard answer is the **largest remainder method**: give everybody their whole part, then hand out the leftover ' +
         'units one at a time, starting with whoever was cut by the most:' },
    { code: 'allocate(10000, [1, 1, 1])   ->  [3334, 3333, 3333]      sums to 10000\nallocate(5,     [3, 7])      ->  [2, 3]                  sums to 5\nallocate(1999,  [1, 2, 3])   ->  [333, 666, 1000]        sums to 1999', lang: 'text', label: 'allocation, in cents' },
    { p: 'Read the middle line. Five cents split three to seven cannot be exact, so somebody gets two and somebody gets three, ' +
         'and the rule decides who, the same way every time. Those are the two properties that matter: the shares always add ' +
         'back to the original amount, and the same inputs always give the same answer.' },
    { money: 'This exact function is in the public interface of every payments library worth using, because splitting a ' +
             'payment between a merchant, a platform and a tax authority is the daily business of a payments company. ' +
             'Interviewers ask for it because it is small enough for forty minutes and shows immediately whether a candidate ' +
             'thinks about the leftover.' },
    { check: {
      q: 'A teammate implements the split as `[round(total * w / sum(weights)) for w in weights]`, and the tests pass. What ' +
         'did the tests miss, and what would you add?',
      a: 'They only tried amounts that divide evenly. As soon as the division has a remainder, rounding each share on its own ' +
         'produces a set that does not add back to the total: $100.00 three ways gives $99.99, and other combinations give ' +
         'more than the total, which is worse because it invents money. The test to add is a rule rather than another example: ' +
         'for any amount and any weights, the shares must sum exactly to the amount. That one assertion, run against hundreds ' +
         'of generated cases, is the subject of the next section.'
    }},

    { h: 'Testing money code: examples are not enough' },
    { p: 'What you have written so far are **example tests**: with this input, expect that output. They are necessary, and ' +
         'they share one weakness that the allocation bug shows: you only test the cases you thought of, and bugs live in the ' +
         'cases you did not.' },
    { p: '**Property-based testing** turns that around. You state a rule that must hold for every input, and a library ' +
         'generates hundreds of inputs trying to break it. In Python that library is **Hypothesis**:' },
    { code: 'from hypothesis import given, strategies as st\n\n@given(total=st.integers(min_value=0, max_value=10**9),\n       weights=st.lists(st.integers(min_value=1, max_value=1000), min_size=1, max_size=10))\ndef test_allocation_conserves_money(total, weights):\n    shares = allocate(total, weights)\n    assert sum(shares) == total          # nothing lost, nothing invented\n    assert len(shares) == len(weights)\n    assert all(s >= 0 for s in shares)', lang: 'python' },
    { p: 'Run that and Hypothesis tries hundreds of combinations, including the ones you avoid by instinct: zero, a single ' +
         'weight, a billion, weights of wildly different sizes. When it finds a failure it does something better than ' +
         'reporting it: it **shrinks** the case, cutting it down to the smallest input that still fails, so you get ' +
         '`total=1, weights=[1, 1]` instead of a wall of digits.' },
    { table: {
      head: ['Property', 'What it says'],
      rows: [
        ['`sum(allocate(t, w)) == t`', 'Splitting conserves money'],
        ['`(a + b) - b == a`', 'Adding and subtracting undo each other'],
        ['`Money.parse(str(m)) == m`', 'Formatting and parsing round trip'],
        ['`m * 2 == m + m`', 'Multiplication agrees with repeated addition'],
        ['`a + b == b + a`', 'Order does not change a total']
      ]
    }},
    { tip: 'Keep both kinds. Example tests document intent, and a reviewer reads them to learn what the code is for. Property ' +
           'tests hunt for bugs nobody imagined. Interviewers notice the second kind, because most candidates have never ' +
           'written one.' },

    { h: 'Type hints, and the checker that reads them' },
    { p: 'Python does not make you say what type a value is, which is pleasant until a function receives a string where it ' +
         'expected an amount. **Type hints** are annotations that say what you meant:' },
    { code: 'def allocate(total: int, weights: list[int]) -> list[int]:\n    ...', lang: 'python' },
    { p: 'Python itself ignores them while running. A separate tool called **mypy** reads them and checks your whole codebase ' +
         'for contradictions before you run anything:' },
    { code: '$ mypy src/moneykit\nsrc/moneykit/allocation.py:14: error: Argument 1 to "allocate" has incompatible type "str"; expected "int"\nFound 1 error in 1 file (checked 6 source files)', lang: 'text' },
    { p: 'For a library other people import this matters more than for a script: their editor reads your hints and offers the ' +
         'right arguments, and their own checks catch their mistakes at the boundary with your code. Job descriptions that ' +
         'say "strong Python" almost always mean typed Python with tests, not clever Python.' },

    { h: 'A library, not a folder of files' },
    { p: 'So far your code has been files you open. A **library** is code packaged so that other projects can install it and ' +
         '`import` it without copying anything. In Python you declare one in a file called `pyproject.toml`:' },
    { code: '[project]\nname = "moneykit"\nversion = "0.1.0"\nrequires-python = ">=3.11"\ndependencies = []                 # a money library should need nothing\n\n[project.optional-dependencies]\ndev = ["pytest", "hypothesis", "mypy", "ruff", "pytest-cov"]\n\n[build-system]\nrequires = ["hatchling"]\nbuild-backend = "hatchling.build"', lang: 'toml', label: 'pyproject.toml' },
    { p: 'Then `pip install -e ".[dev]"` installs your own package in **editable** mode: the code stays where it is, your ' +
         'edits take effect immediately, and `import moneykit` works from any folder. That one command is how almost every ' +
         'Python repository you will ever join expects to be set up.' },
    { p: 'The version number is a promise in three parts, called **semantic versioning**:' },
    { table: {
      head: ['What changed', 'Version goes', 'Because'],
      rows: [
        ['You fixed a bug, nothing else', '0.1.0 to 0.1.1', 'Callers can upgrade without reading anything'],
        ['You added something new', '0.1.1 to 0.2.0', 'New things exist, old things still work'],
        ['You renamed or removed something', '0.2.0 to 1.0.0', 'Callers must change their code, so warn them loudly']
      ]
    }},
    { check: {
      q: 'You rename `Money.cents` to `Money.minor_units` because it reads better, bump the version from 0.3.1 to 0.3.2, and ' +
         'release. Three services at your company use the library. What happens, and what should you have done?',
      a: 'Every service that reads `.cents` breaks the moment it upgrades, and because you only changed the last number, ' +
         'automatic upgrades pick it up without anybody reading a note. That is what the version number is for: a rename is a ' +
         'breaking change and belongs in a new major version. The kinder path is to add `minor_units`, keep `.cents` working ' +
         'as an alias, say in the changelog that it is going away, and remove it in 1.0.0. Adding is safe; removing and ' +
         'renaming are not.'
    }},

    { h: 'The tools a backend team assumes you use' },
    { p: 'Four tools, one job each. Nobody will teach you these on your first day, and every repository you join has them.' },
    { table: {
      head: ['Tool', 'What it does', 'Why anyone cares'],
      rows: [
        ['**ruff**', 'Reads your code for style problems and likely bugs, and fixes many of them', 'Ends arguments about formatting, catches unused and shadowed names'],
        ['**mypy**', 'Checks that your type hints are consistent', 'Finds "a string reached a function expecting an int" before a customer does'],
        ['**pytest**', 'Runs your tests and reports what failed', 'The one command that says whether a change is safe'],
        ['**GitHub Actions**', 'Runs all of the above on a clean machine on every push', 'Stops a merge that would break the library, including your own']
      ]
    }},
    { p: 'The pipeline is the piece worth understanding, because it turns habits into guarantees. One file in your repository ' +
         'says what to run, and GitHub runs it on a fresh machine every time anybody pushes:' },
    { code: 'name: ci\non: [push, pull_request]\njobs:\n  check:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-python@v5\n        with: { python-version: "3.12" }\n      - run: pip install -e ".[dev]"\n      - run: ruff check .\n      - run: mypy src/moneykit --strict\n      - run: pytest -q --cov=moneykit --cov-fail-under=95', lang: 'yaml', label: '.github/workflows/ci.yml' },
    { p: 'The clean machine is the point. "It works on my laptop" usually means something is installed on your laptop that is ' +
         'written down nowhere, and a pipeline finds that on the first run.' },
    { check: {
      q: 'Your tests pass locally and the pipeline fails with `ModuleNotFoundError: No module named hypothesis`. What does ' +
         'that tell you about your project, and where exactly is the fix?',
      a: 'Hypothesis is installed on your machine but is not written down as a dependency, so the clean machine does not have ' +
         'it. The fix is in `pyproject.toml`, in the `dev` list, not in the pipeline file: the pipeline is right and your ' +
         'project was lying about what it needs. This is the whole value of a clean environment. Every undeclared assumption ' +
         'on your laptop is an incident waiting for the next person who clones the repository.'
    }},

    { h: 'What a reviewer sees' },
    { p: 'This library is the first repository in your portfolio that a backend interviewer might actually open. They will ' +
         'spend about two minutes. Here is what they look for, in order:' },
    { ol: [
      '**Does the README say what it is in one line, and show one usage example?**',
      '**Is there a tests folder, and does it contain properties as well as examples?**',
      '**Is there a pipeline badge, and is it green?**',
      '**Are the public functions typed, with short docstrings saying what they return?**',
      '**Does the commit history show work, or one commit called "initial commit" with everything in it?**',
      '**Is there a section saying what it does not do?** Rounding rules not implemented, currencies not supported.'
    ]},
    { money: 'A small library, complete and tested, beats a large application that half works. The reviewer is not asking ' +
             '"is this impressive". They are asking "would I merge this person\'s pull request without rewriting it".' }
  ],

  tutorial: {
    intro: 'On your own machine this time, not a notebook: a library is a project with a folder structure. If level 4 was the ' +
           'last thing you did in Colab, this is the step across. You need Python 3.11 or newer, an editor, and a terminal. ' +
           'Every command below is meant to be typed, in order.',
    steps: [
      {
        t: 'Make the project and its environment',
        blocks: [
          { p: 'A **virtual environment** is a private folder of libraries for one project, so two projects can use different ' +
               'versions of the same thing without fighting. Make one, switch into it, and keep it out of git.' },
          { code: 'mkdir moneykit && cd moneykit\ngit init\npython -m venv .venv\n\n# Windows\n.venv\\Scripts\\activate\n# macOS or Linux\nsource .venv/bin/activate\n\nprintf ".venv/\\n__pycache__/\\n*.egg-info/\\n.coverage\\n" > .gitignore', lang: 'bash' },
          { p: 'Your prompt now starts with `(.venv)`. That is how you know which environment a command will affect, and ' +
               'forgetting it causes half of all "but I installed it" conversations.' }
        ],
        check: 'The prompt shows (.venv), and git status lists only .gitignore.'
      },
      {
        t: 'Declare the package',
        blocks: [
          { code: 'moneykit/\n  pyproject.toml\n  README.md\n  src/moneykit/__init__.py\n  src/moneykit/currency.py\n  src/moneykit/money.py\n  src/moneykit/allocation.py\n  src/moneykit/errors.py\n  tests/test_money.py\n  tests/test_allocation.py\n  tests/test_properties.py', lang: 'text', label: 'the shape to build' },
          { p: 'Write the `pyproject.toml` from the knowledge section, then install the package into your environment in ' +
               'editable mode:' },
          { code: 'pip install -e ".[dev]"\npython -c "import moneykit; print(moneykit.__file__)"', lang: 'bash' },
          { tip: 'The `src/` folder is a deliberate habit. It makes it impossible to import your package by accident from the ' +
                 'folder you are standing in, so your tests exercise the installed package exactly as a user would.' }
        ],
        check: 'import moneykit works from any directory, and the path it prints is inside src/.'
      },
      {
        t: 'The currency table',
        blocks: [
          { p: 'Currencies differ in how many decimal places they have, so that belongs in data, not in `/ 100` scattered ' +
               'through your code.' },
          { code: 'from dataclasses import dataclass\n\n@dataclass(frozen=True)\nclass Currency:\n    code: str           # "USD"\n    exponent: int       # 2\n    symbol: str = ""\n\nCURRENCIES = {\n    "USD": Currency("USD", 2, "$"),\n    "EUR": Currency("EUR", 2, "\\u20ac"),\n    "GBP": Currency("GBP", 2, "\\u00a3"),\n    "JPY": Currency("JPY", 0, "\\u00a5"),\n    "VND": Currency("VND", 0, "\\u20ab"),\n    "BHD": Currency("BHD", 3, ""),\n}', lang: 'python' },
          { p: '`@dataclass(frozen=True)` writes the boilerplate for a small value type and makes it **immutable**: once ' +
               'created it cannot be changed. That matters for money, because a value that can change underneath you is a ' +
               'value two parts of your program can disagree about.' }
        ],
        check: 'CURRENCIES["JPY"].exponent is 0, and assigning to a Currency field raises FrozenInstanceError.'
      },
      {
        t: 'The Money type',
        blocks: [
          { code: 'from decimal import Decimal, ROUND_HALF_UP\n\n@dataclass(frozen=True)\nclass Money:\n    minor_units: int          # 1999 means $19.99\n    currency: Currency\n\n    @classmethod\n    def parse(cls, text: str, code: str) -> "Money":\n        """Money.parse("19.99", "USD") -> Money(1999, USD)."""\n        cur = CURRENCIES[code]\n        scaled = Decimal(text) * (10 ** cur.exponent)\n        if scaled != scaled.to_integral_value():\n            raise InvalidAmount(f"{text} has more places than {cur.code} allows")\n        return cls(int(scaled), cur)\n\n    def __add__(self, other: "Money") -> "Money":\n        self._same_currency(other)\n        return Money(self.minor_units + other.minor_units, self.currency)\n\n    def _same_currency(self, other: "Money") -> None:\n        if self.currency != other.currency:\n            raise CurrencyMismatch(f"{self.currency.code} and {other.currency.code}")\n\n    def __str__(self) -> str:\n        units = Decimal(self.minor_units) / (10 ** self.currency.exponent)\n        return f"{self.currency.symbol}{units:,.{self.currency.exponent}f}"', lang: 'python' },
          { p: 'Writing `__add__` is what makes `a + b` work on your own type. Calling `_same_currency` inside it is what ' +
               'makes the multi-currency bug impossible rather than unlikely. Add `__sub__`, `__mul__` by an integer, ' +
               '`__neg__` and the comparisons the same way.' },
          { warn: 'Do not add a `__float__` method, however convenient it looks. The moment somebody can turn your Money into ' +
                  'a float, every guarantee in this library becomes optional.' }
        ],
        check: 'Money.parse("19.99", "USD") + Money.parse("0.01", "USD") prints $20.00, adding USD to VND raises, and parse("19.999", "USD") raises.'
      },
      {
        t: 'Allocation, the function interviewers ask for',
        blocks: [
          { code: 'def allocate(total: int, weights: list[int]) -> list[int]:\n    """Split total into len(weights) parts, in proportion, losing nothing."""\n    if not weights:\n        raise ValueError("need at least one weight")\n    if any(w < 0 for w in weights):\n        raise ValueError("weights cannot be negative")\n\n    weight_sum = sum(weights)\n    shares = [total * w // weight_sum for w in weights]        # the whole parts\n    remainder = total - sum(shares)                            # what is left over\n\n    # hand the leftover units to whoever was cut by the most\n    order = sorted(range(len(weights)),\n                   key=lambda i: (-((total * weights[i]) % weight_sum), i))\n    for i in order[:remainder]:\n        shares[i] += 1\n    return shares', lang: 'python' },
          { code: '>>> allocate(10000, [1, 1, 1])\n[3334, 3333, 3333]\n>>> allocate(5, [3, 7])\n[2, 3]\n>>> allocate(1999, [1, 2, 3])\n[333, 666, 1000]', lang: 'python' },
          { p: 'Then wrap it on `Money`, so callers work in money rather than integers: `price.allocate([1, 1, 1])` returning ' +
               'a list of `Money`.' }
        ],
        check: 'All three examples match, and the shares always add back to the input.'
      },
      {
        t: 'Property tests that hunt',
        blocks: [
          { code: 'from hypothesis import given, strategies as st\n\namounts = st.integers(min_value=0, max_value=10**12)\nweight_lists = st.lists(st.integers(min_value=1, max_value=10**6), min_size=1, max_size=12)\n\n@given(total=amounts, weights=weight_lists)\ndef test_allocation_conserves(total, weights):\n    assert sum(allocate(total, weights)) == total\n\n@given(total=amounts, weights=weight_lists)\ndef test_allocation_is_deterministic(total, weights):\n    assert allocate(total, weights) == allocate(total, weights)\n\n@given(a=amounts, b=amounts)\ndef test_add_then_subtract_returns_original(a, b):\n    usd = CURRENCIES["USD"]\n    assert (Money(a, usd) + Money(b, usd)) - Money(b, usd) == Money(a, usd)', lang: 'python' },
          { p: 'Run `pytest`. If a property fails, read the shrunk example Hypothesis prints: it is the smallest input that ' +
               'still breaks, and it usually tells you the bug without further thought.' },
          { tip: 'Run it once with `--hypothesis-show-statistics` to see how many cases ran and how many were thrown away. If ' +
                 'most inputs are rejected, your generators are too narrow and the tests are weaker than they look.' }
        ],
        check: 'pytest runs both example and property tests, and every property passes.'
      },
      {
        t: 'Types, style, coverage',
        blocks: [
          { code: 'ruff check . --fix\nmypy src/moneykit --strict\npytest -q --cov=moneykit --cov-report=term-missing', lang: 'bash' },
          { p: '`--strict` makes mypy demand a type on everything, which is right for a small library and too strong for a ' +
               'large old codebase. Coverage shows which lines no test ever ran; aim high here precisely because the library ' +
               'is small enough that there is no excuse.' },
          { warn: 'High coverage means every line ran, not that every line is correct. A test that calls a function and ' +
                  'asserts nothing gives full coverage and catches nothing. Coverage finds untested code; properties find bugs.' }
        ],
        check: 'ruff is clean, mypy --strict reports no errors, and coverage is above 95%.'
      },
      {
        t: 'The pipeline, and the badge',
        blocks: [
          { p: 'Add the workflow file from the knowledge section, push, and watch it run on GitHub under the Actions tab. ' +
               'Then break something on purpose, push, and watch it go red. That red is the point of the whole exercise.' },
          { code: '# README.md, under the title\n![ci](https://github.com/<you>/moneykit/actions/workflows/ci.yml/badge.svg)', lang: 'text' },
          { p: 'Finish the README with one sentence saying what the library is, a five line usage example, the install ' +
               'command, how to run the tests, and a short "what this does not do yet" section.' }
        ],
        check: 'The badge is green on GitHub, and a deliberate bug turns it red within a minute.'
      }
    ]
  },

  glossary: [
    { t: 'Float', d: 'A number with a decimal point stored in binary. Fast, and never exact for most decimal amounts.' },
    { t: 'Minor units', d: 'The smallest unit of a currency, such as cents. Stored as whole numbers, which are exact.' },
    { t: 'Exponent', d: 'How many decimal places a currency has: 2 for USD, 0 for JPY and VND, 3 for BHD.' },
    { t: 'Decimal', d: 'A Python type that stores numbers in base ten, so decimal arithmetic is exact. Build it from strings.' },
    { t: 'quantize', d: 'Decimal\'s method for rounding to a fixed number of places with a stated rule.' },
    { t: 'ROUND_HALF_UP', d: 'Ties round away from zero. What most people expect, and common in retail and tax.' },
    { t: 'ROUND_HALF_EVEN', d: 'Ties round to the nearest even digit, so the bias cancels. The banking default.' },
    { t: 'Allocation', d: 'Splitting an amount in proportion without losing or inventing a unit, by largest remainder.' },
    { t: 'Immutable', d: 'A value that cannot be changed after it is created. `@dataclass(frozen=True)` makes one.' },
    { t: 'Type hint', d: 'An annotation saying what type a value is. Ignored while running, checked by mypy.' },
    { t: 'mypy', d: 'A type checker that reads your hints and reports contradictions without running the code.' },
    { t: 'ruff', d: 'A fast linter and formatter: style problems and likely bugs, many fixed automatically.' },
    { t: 'Property-based testing', d: 'Stating a rule that must hold for all inputs and letting a tool generate them. Hypothesis.' },
    { t: 'Shrinking', d: 'What Hypothesis does after a failure: cuts the input down to the smallest one that still fails.' },
    { t: 'pyproject.toml', d: 'The file that declares a Python project: name, version, dependencies, build system.' },
    { t: 'Editable install', d: '`pip install -e .`, so the package is importable everywhere while the code stays where you edit it.' },
    { t: 'Semantic versioning', d: 'Major.minor.patch, where the major number changes when callers must change their code.' },
    { t: 'CI', d: 'Continuous integration: a pipeline that runs your checks on a clean machine on every push.' }
  ],

  quiz: [
    { q: "Why can a float not be trusted to hold $19.99?",
      options: [
        "Python floats cannot hold numbers above 1,000,000",
        "Floats round every result to two places",
        "Most decimal fractions have no exact binary form, so the stored value is slightly off",
        "Floats are limited to six decimal places"
      ],
      answer: 2,
      why: "The error is tiny and it accumulates, and it breaks exact comparisons such as a reconciliation that must come to zero." },

    { q: "What does `Decimal(2.675)` produce?",
      options: [
        "2.674999999999999822..., because the float was already inexact",
        "Exactly 2.675",
        "2.68",
        "A TypeError"
      ],
      answer: 0,
      why: "Decimal faithfully copies the broken float. Always build from a string: `Decimal(\"2.675\")`." },

    { q: "Which of these currencies has an exponent of 0?",
      options: [
        "USD",
        "BHD",
        "EUR",
        "JPY"
      ],
      answer: 3,
      why: "Yen and dong have no smaller unit in use, so dividing by 100 to display them is wrong by a factor of a hundred." },

    { q: "ROUND_HALF_EVEN is the banking default because:",
      options: [
        "It is faster to compute",
        "Regulators require it in every country",
        "Always rounding ties upward adds a small bias that becomes real money over millions of rows",
        "It always rounds in the bank's favour"
      ],
      answer: 2,
      why: "Half the ties go up and half go down, so the bias cancels instead of accumulating." },

    { q: "Seven lines of $1.99 at 8.25% tax give $1.12 rounded per line and $1.15 rounded once at the end. Which is correct?",
      options: [
        "Per line, always",
        "Whichever your tax rules require, decided once and covered by a test",
        "Neither: the tax rate must be rounded first",
        "Per invoice, always"
      ],
      answer: 1,
      why: "Both are legitimate arithmetic. What is always wrong is not knowing which one your code does." },

    { q: "What does `allocate(10000, [1, 1, 1])` return, in cents?",
      options: [
        "[3334, 3333, 3333]",
        "[3333, 3333, 3333]",
        "[3334, 3334, 3332]",
        "[3333.33, 3333.33, 3333.33]"
      ],
      answer: 0,
      why: "The leftover cent goes to the share cut by the most, and the parts still add up to exactly 10000." },

    { q: "The essential property of an allocation function is:",
      options: [
        "No share is ever zero",
        "The shares sum exactly to the amount being split",
        "Every share is the same size",
        "Shares are always rounded up"
      ],
      answer: 1,
      why: "Anything else loses or invents money, and a transaction that does not sum to zero is invalid, as level 4 showed." },

    { q: "What does property-based testing add that example tests cannot?",
      options: [
        "Faster test runs",
        "It generates hundreds of inputs, including ones you never thought of, and shrinks a failure to the smallest case",
        "It proves the code is correct",
        "It removes the need for a type checker"
      ],
      answer: 1,
      why: "Example tests document intent; property tests hunt. Neither proves correctness, but the second finds real bugs." },

    { q: "`@dataclass(frozen=True)` on Money gives you:",
      options: [
        "Faster attribute access",
        "Automatic currency conversion",
        "Thread safety across the whole program",
        "A value that cannot be changed after creation, so two parts of a program cannot disagree about it"
      ],
      answer: 3,
      why: "Immutability is why passing Money around is safe. Operations return new values instead of editing old ones." },

    { q: "Why should Money not have a `__float__` method?",
      options: [
        "Python forbids it on frozen dataclasses",
        "It would be slow",
        "Floats cannot represent currencies with exponent 0",
        "Because any caller could then turn an exact amount back into an inexact float, and every guarantee becomes optional"
      ],
      answer: 3,
      why: "A type protects a rule only while there is no easy way around it." },

    { q: "What does mypy do?",
      options: [
        "Reads your type hints and reports contradictions without running the code",
        "Speeds up Python by compiling the type hints",
        "Enforces a code style",
        "Runs your tests"
      ],
      answer: 0,
      why: "Python ignores hints while running. A separate checker is what turns them into a safety net." },

    { q: "Your tests pass locally and the pipeline fails with a missing module. Where is the fix?",
      options: [
        "On the pipeline machine: pre-install common libraries",
        "Nowhere: pin the pipeline to your local Python version",
        "In pyproject.toml: the project failed to declare a dependency it needs",
        "In the pipeline file: install the module there"
      ],
      answer: 2,
      why: "The clean machine is right. Every undeclared assumption on your laptop is an incident for whoever clones it next." },

    { q: "You rename a public attribute and release it as a patch version. What is wrong?",
      options: [
        "Renames require a new package name",
        "Nothing, as long as the tests pass",
        "A rename breaks callers, so it belongs in a major version, with the old name kept as an alias first",
        "Patch versions cannot contain code changes"
      ],
      answer: 2,
      why: "Adding is safe; removing and renaming are not. The version number is how callers know which one happened." },

    { q: "Full test coverage means:",
      options: [
        "Every line of code ran during the tests",
        "Every line of code is correct",
        "The type checker passed",
        "Every possible input was tried"
      ],
      answer: 0,
      why: "A test that asserts nothing still produces coverage. Coverage finds untested code; properties find bugs." },

    { q: "Why put the package under a `src/` folder?",
      options: [
        "To keep the repository tidy",
        "So tests exercise the installed package instead of accidentally importing the folder you are standing in",
        "It makes imports faster",
        "pyproject.toml requires it"
      ],
      answer: 1,
      why: "It removes a whole class of \"works in the repository, fails once installed\" surprises." }
  ],

  project: {
    title: 'moneykit: the library every later level imports',
    story: 'Write the money library that levels 6 to 20 will actually use. It has to be exact, it has to refuse to mix ' +
           'currencies, it has to split amounts without losing a cent, and somebody who has never spoken to you has to be ' +
           'able to install it from GitHub and use it. This is the first repository on your CV that a backend reviewer will ' +
           'open.',
    scope: 'Uses levels 1 to 4 plus this level. The package itself depends on the standard library only: pytest, Hypothesis, ' +
           'mypy and ruff are development dependencies. No database, no network.',
    dataset: '{{RAW}}/data/level-05-fx-snapshot.json',
    requirements: [
      'A `src/moneykit` package installable with `pip install -e ".[dev]"` and importable from any directory',
      'A frozen `Currency` type with at least USD, EUR, GBP, JPY, VND and BHD, carrying the ISO 4217 exponent',
      'A frozen `Money` type holding integer minor units and a currency, with add, subtract, multiply by an integer, negate, compare and format',
      'Adding or comparing two different currencies raises `CurrencyMismatch`, with a test for each',
      '`Money.parse("19.99", "USD")` and `Money.from_minor(1999, "USD")`, where parse rejects more decimal places than the currency allows',
      'Formatting that respects the exponent: $19.99, 1,000 yen, 1.000 dinar',
      '`allocate(total, weights)` by largest remainder, and `Money.allocate` returning Money objects',
      '`Money.percentage(rate, rounding)` using Decimal inside, with the rounding rule as an argument rather than a hidden default',
      'Conversion between currencies at a given rate, recording the rate used on the result, tested against the shipped FX snapshot',
      'Example tests for every public function, including the three allocation cases from this level',
      'At least five Hypothesis properties, including conservation under allocation and a format then parse round trip',
      'mypy --strict clean, ruff clean, coverage above 95%, all three enforced by a GitHub Actions pipeline',
      'A README with one line of purpose, a usage example, install and test commands, and a limitations section',
      'A CHANGELOG.md with a 0.1.0 entry, and a version number that follows semantic versioning',
      'The repository public on GitHub as `moneykit`, with a green pipeline badge'
    ],
    starter: {
      lang: 'python',
      code: '"""moneykit: exact money arithmetic for people who get paid to be right.\n\nLayout to build:\n  src/moneykit/__init__.py      public exports only\n  src/moneykit/currency.py      Currency, CURRENCIES, ISO 4217 exponents\n  src/moneykit/money.py         Money: parse, format, arithmetic, comparisons\n  src/moneykit/allocation.py    allocate() by largest remainder\n  src/moneykit/errors.py        MoneyError, CurrencyMismatch, InvalidAmount\n  tests/                        examples, properties, and the three worked cases\n"""\n\nfrom dataclasses import dataclass\nfrom decimal import Decimal, ROUND_HALF_UP\n\n\nclass MoneyError(Exception):\n    """Base class for everything this library refuses to do."""\n\n\nclass CurrencyMismatch(MoneyError):\n    pass\n\n\nclass InvalidAmount(MoneyError):\n    pass\n\n\n@dataclass(frozen=True)\nclass Currency:\n    code: str\n    exponent: int\n    symbol: str = ""\n\n\n@dataclass(frozen=True)\nclass Money:\n    minor_units: int\n    currency: Currency\n\n    @classmethod\n    def parse(cls, text: str, code: str) -> "Money":\n        """Money.parse("19.99", "USD") -> Money(1999, USD). Reject "19.999"."""\n        # TODO\n        raise NotImplementedError\n\n    def allocate(self, weights: list[int]) -> list["Money"]:\n        """Split this amount in proportion, losing nothing."""\n        # TODO\n        raise NotImplementedError\n\n    def percentage(self, rate: Decimal, rounding: str = ROUND_HALF_UP) -> "Money":\n        """A percentage of this amount, rounded on purpose."""\n        # TODO\n        raise NotImplementedError\n\n\ndef allocate(total: int, weights: list[int]) -> list[int]:\n    """Largest remainder. sum(allocate(t, w)) == t must hold for every input."""\n    # TODO\n    raise NotImplementedError\n'
    },
    tests: [
      'Money.parse("19.99", "USD").minor_units == 1999',
      'Money.parse("1000", "JPY").minor_units == 1000, and printing it shows 1,000 rather than 10.00',
      'Money.parse("19.999", "USD") raises InvalidAmount',
      'USD + EUR raises CurrencyMismatch, and so does comparing them',
      'allocate(10000, [1, 1, 1]) == [3334, 3333, 3333]',
      'allocate(5, [3, 7]) == [2, 3]',
      'allocate(1999, [1, 2, 3]) == [333, 666, 1000]',
      'Property: for any total and any weights, the shares sum exactly to the total',
      'Property: allocate is deterministic, the same inputs always give the same answer',
      'Property: (a + b) - b == a for any two amounts in one currency',
      'Property: Money.parse(str(m)) == m for every currency in the table',
      '8.25% of $19.99 is $1.65, and the rounding rule is an argument the caller can see rather than a hidden default',
      'Converting $100.00 to VND at 25,480 gives 2,548,000 dong, and the result records the rate used',
      'mypy --strict, ruff and pytest all pass in the pipeline on a clean machine'
    ],
    rubric: [
      { pts: 25, t: 'Correct by construction', d: 'Immutable types, integer storage, Decimal only inside calculations, currency mixing impossible rather than unlikely.' },
      { pts: 25, t: 'Allocation and rounding', d: 'Largest remainder implemented and proved, rounding rules explicit arguments, the exponent respected everywhere.' },
      { pts: 20, t: 'Tested like money code', d: 'Examples plus at least five properties, with the shrunk failure from a deliberate bug shown in the README or a commit.' },
      { pts: 15, t: 'Shipped as a library', d: 'Editable install works from a clean clone, mypy --strict and ruff clean, pipeline green, semantic version and changelog.' },
      { pts: 15, t: 'Readable by a stranger', d: 'README understood in two minutes, typed public functions with docstrings, and an honest limitations section.' }
    ],
    stretch: [
      'Add `Money.split_evenly(n)` and prove with a property that it agrees with `allocate` for equal weights',
      'Add a currency with an exponent of 4 and find every place in your code that assumed 2',
      'Benchmark integer arithmetic against Decimal over a million operations, and put the numbers in the README',
      'Accept "$19.99", "19,99 EUR" and "1.000 BHD" on input, with a property that every format you produce can be parsed back',
      'Publish to TestPyPI, then install it into a fresh virtual environment and import it'
    ],
    solutionPath: 'solutions/level-05'
  },

  faq: [
    { q: 'Why not just use an existing library like py-moneyed?',
      a: 'In a job, you would. Here the point is that you can read one, argue with its rounding choices, and fix it. Build yours, then read theirs and list three differences in your README.' },
    { q: 'Integers or Decimal for storage? I have seen both.',
      a: 'Integers for anything stored or sent: a database column, an API field, a ledger entry. Decimal inside a calculation that has a fractional cent in the middle of it. The mistake is letting a Decimal reach a database column, or a float reach either.' },
    { q: 'My allocation gives a different answer from a colleague\'s for the same input',
      a: 'You break ties differently. Both can be correct as long as each is deterministic and conserves the total, but a payments system needs one rule written down, because a refund has to reverse the exact split that happened.' },
    { q: 'Do I really need Hypothesis for a library this small?',
      a: 'It finds the allocation bug in about four lines. It is also a strong signal in an interview, because most candidates have never written a property test, and the ones who have think differently about failure.' },
    { q: 'mypy --strict is fighting me',
      a: 'On a small library that is a feature. Fix the annotations rather than adding ignores, and if you must ignore one, put the reason in the comment. On a large old codebase the usual approach is to turn strictness on one module at a time.' },
    { q: 'How long should this take?',
      a: 'A focused weekend for the library, and an evening for the pipeline and the README. If it takes longer, the usual reason is allocation, which is exactly the part interviewers like, because it is harder than it looks.' },
    { q: 'What do I say about this in an interview?',
      a: 'Two sentences: you built the money type your other projects import, and it refuses to mix currencies or lose a cent when splitting. Then offer the allocation function, because it is concrete and most candidates have only ever divided by three.' }
  ]
});
