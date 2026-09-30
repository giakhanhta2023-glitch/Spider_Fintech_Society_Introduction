/* =========================================================================
   ANALYST TRACK, LEVEL 4: a model that ties
   ========================================================================= */
FQ.registerLevel({
  id: 104,
  track: 'fpa',
  position: 4,
  codename: 'model',
  title: 'A model that ties',
  tagline: 'Fifteen months, four scenarios, sixty forecast months, and a balance sheet that balances to the cent in every one of them.',
  difficulty: 6,
  minutes: 300,
  tags: ['three statement model', 'forecasting', 'working capital', 'scenarios'],
  summary: 'The three statement model is the thing a finance interview is really asking about. This level builds one ' +
           'from a real closing balance sheet: revenue from drivers, costs that behave differently from each other, ' +
           'working capital, a debt schedule, and the circular reference every real model contains.',

  objectives: [
    'Forecast revenue from drivers rather than from a growth rate on a total',
    'Build the three statements so that cash is an output and the balance sheet is an identity',
    'Model working capital as days, and see what a collections slip costs in cash',
    'Build scenarios as multiples of one base case instead of four separate models',
    'Resolve the circular reference a revolving facility creates, and know when it has not converged',
    'Use a sensitivity table to find which argument is worth having',
    'Read and write a small class, which is the last new piece of Python this track needs'
  ],

  knowledge: [
    { h: 'Why the three statements are one model' },
    { p: 'A profit and loss says what you earned. A balance sheet says what you own and owe. A cash flow statement ' +
         'says what actually moved. They are three views of one set of facts, and the reason a model links them is ' +
         'that **a company can be profitable and run out of money**, which is not a hypothetical: it is the single ' +
         'most common way a growing business dies.' },
    { p: 'The link is mechanical. Net income goes to retained earnings. Depreciation is a cost that moves no cash. ' +
         'Receivables are revenue you have not collected. Put them together and cash falls out at the bottom, which ' +
         'is the only correct way to forecast it.' },
    { money: 'The rule that makes a model a model: **cash is an output**. If you type a cash forecast in and plug ' +
             'the balance sheet to match, you have built a spreadsheet of hopes. Every month in this level is ' +
             'asserted to balance to the cent, and the assertion is what turns the identity into a test.' },

    { h: 'Start from a balance sheet, not from zero' },
    { p: 'A forecast begins at the last closed month. Level 1 closed September, so the model starts from the ' +
         'September balance sheet, and the first thing it does is refuse to start if that sheet does not balance:' },
    { code: 'cash                     8,995,577\naccounts receivable      4,201,313\nfixed assets, net        3,888,709\n                        ----------\nassets                  17,085,598\n\naccounts payable         3,257,960\ndebt                     3,375,000\npaid in capital         22,000,000\nretained earnings      -11,547,361\n                        ----------\nliabilities and equity  17,085,598', lang: 'text' },
    { p: 'Retained earnings are negative because the company has raised more than it has earned, which is the normal ' +
         'state of a growing payments business and not a problem by itself. Somebody will ask about it in a review, ' +
         'and the answer is one sentence: **cumulative losses since founding, against twenty two million raised.**' },

    { h: 'The Python this level uses, in one page' },
    { p: 'Level 3 was functions and tables. This level needs one more idea, and it is the last new piece of Python ' +
         'in the track: **a class**. If you have never met one, read this section before the code starts. If you ' +
         'have, skip to the next heading, because there is nothing unusual here.' },
    { p: 'A **class** is a shape for a thing, and an **object** is one thing of that shape. In spreadsheet terms, a ' +
         'class is the template and an object is one filled in row. This model needs a shape called an assumption: ' +
         'a number, where the number came from, and whether it was measured or decided. Twenty of those, each with ' +
         'three parts, and the alternative is three parallel dictionaries that drift apart the first time somebody ' +
         'adds a driver to one of them.' },
    { code: '@dataclass(frozen=True, slots=True)\nclass Driver:\n    value: float\n    source: str\n    judgement: bool = False\n\ntake_rate = Driver(0.0058, "the last twelve months of actuals", judgement=True)\n\ntake_rate.value       # 0.0058\ntake_rate.source      # "the last twelve months of actuals"', lang: 'python' },
    { p: 'Six lines, and every part of them is doing something worth knowing:' },
    { table: {
      head: ['What you see', 'What it means', 'Why it is there'],
      rows: [
        ['`class Driver:`', 'Define a shape called Driver', 'One place that says what an assumption is made of'],
        ['`value: float`', 'A driver has a value, and it is a number', 'The three lines under the class are its fields, in order'],
        ['`judgement: bool = False`', 'And a true or false flag, false unless you say otherwise', 'So most drivers need only two arguments'],
        ['`@dataclass`', 'Python writes the boring parts for you', 'Without it you would hand write the code that builds one, prints one, and compares two'],
        ['`frozen=True`', '**Once made, it cannot be changed**', 'An assumption quietly reassigned halfway through a run is the model version of typing over a formula'],
        ['`slots=True`', 'A misspelt field is an error, not a new field', '`driver.sorce = 0.006` stops the program instead of being silently ignored'],
        ['`Driver(0.0058, "...")`', 'Make one', 'This is an object. The class is the template, this is the row'],
        ['`take_rate.value`', 'Read a field off it, with a dot', 'Like `B4` on a tab, except the name says what it is']
      ]
    }},
    { p: 'Two more pieces appear in the model, and both exist for a reason you already believe from level 1.' },
    { p: '**A property is a number worked out when you ask for it, never stored.** Assets are cash plus receivables ' +
         'plus fixed assets, every single time anybody reads them, so they cannot go stale after one of the three ' +
         'moves. It is the same rule as the check cell: a balance is worked out, never typed in.' },
    { code: '@property\ndef assets(self):\n    return self.cash + self.receivables + self.ppe\n\nmonth.assets          # no brackets: it reads like a field and runs like a formula', lang: 'python' },
    { p: '`self` is the object the line is working on, handed in automatically. Inside the class you write ' +
         '`self.cash`; outside it you write `month.cash`, and they are the same number.' },
    { p: '**And `replace` makes a copy with one or two fields changed, leaving the original alone.** That is how the ' +
         'four scenarios are built out of one base case: the upside is the base with two numbers swapped, rather ' +
         'than a second file.' },
    { code: 'from dataclasses import replace\n\nupside = replace(base, name="upside", volume_growth=Driver(0.029, "..."))\n\nbase.volume_growth.value      # still 0.0215: the original never moved', lang: 'python' },
    { table: {
      head: ['Also in the code', 'What it means'],
      rows: [
        ['`def scaled(self, name, **factors)`', 'The named arguments you pass get collected into a dictionary called `factors`, so the function works with whatever drivers you hand it rather than a fixed list'],
        ['`getattr(self, "take_rate")`', 'Read a field whose name is in a variable. The loop does not know the names in advance, so it cannot write a dot'],
        ['`field(default_factory=list)`', 'Give each object its own empty list. Writing `= []` instead would share one list between every object ever made, which is the oldest trap in Python'],
        ['`lambda f: f["revenue"]`', 'A small function with no name, written where it is used'],
        ['`for attempt in range(1, 51): ... break`', 'Try up to fifty times and stop early when the answer stops moving. The attempt number is the evidence that it converged rather than gave up']
      ]
    }},
    { tip: 'You do not need to be able to write these from memory to finish the level. You need to be able to read ' +
           'them, because everything the model knows about an assumption is carried in a Driver, and everything a ' +
           'reviewer will ask you about is in the `source` field of one.' },
    { check: {
      q: 'Why is `Driver` frozen, when it would be more convenient to be able to change a value in place?',
      a: 'Because a model is judged on whether its inputs can be traced, and a value that can be reassigned anywhere ' +
         'in a run cannot be. Frozen means the only way to get a different assumption is to make a new one, which is ' +
         'exactly what the scenarios do: `replace(base, take_rate=...)` produces a second object and leaves the first ' +
         'untouched. It is the same instinct as never typing over a formula in the workbook, and it turns an entire ' +
         'class of "why is this number different from yesterday" into something that cannot happen.'
    }},

    { h: 'Revenue from drivers' },
    { p: 'Growing last month\'s revenue by a percentage produces a trend line with an opinion attached, ' +
         'which is a different object from a forecast. Drive it from the things the business actually does:' },
    { code: 'transaction fees  = payment volume x take rate\nsubscription fees = merchants x platform fee\nFX markup         = payment volume x cross border share x markup\n\nvolume next month = volume x (1 + volume growth)\nmerchants         = merchants x (1 + net merchant growth)', lang: 'text' },
    { p: 'Two reasons this is better, and the second is the one that matters in a review. It **decomposes**: when the ' +
         'forecast misses, you know whether it was volume or price, which is the same split level 1 used on the ' +
         'variance. And it is **arguable**: a sales director can disagree with 2.15% monthly volume growth and that ' +
         'is a useful conversation, where disagreeing with "revenue grows 26% a year" is not.' },
    { table: {
      head: ['Driver', 'Value', 'Where it came from'],
      rows: [
        ['volume growth', '2.15% a month', 'Measured: the median of the last six months of history'],
        ['take rate', '0.58%', '**Judgement**: the last twelve months of actuals. The plan still says 0.62% and the business has not run at that since January'],
        ['scheme cost rate', '0.33%', 'Measured: stable in every month of history'],
        ['DSO', '38 days', 'Measured: receivables over revenue, unchanged across the history'],
        ['minimum cash', '5,000,000', '**Judgement**: the board\'s stated floor, and the reason the facility ever draws']
      ]
    }},
    { p: 'Every driver in the model carries its source, and the three that are opinions rather than measurements are ' +
         'marked as such. A model that cannot tell you which of its inputs are facts will be believed too much, and ' +
         'the first question in any review is where a number came from.' },

    { h: 'Costs do not all behave the same way' },
    { p: 'The most common modelling shortcut is to forecast every cost as a percentage of revenue. It is wrong in a ' +
         'specific and expensive way: it makes the model unable to show operating leverage, which is the whole ' +
         'economic story of a scaling business.' },
    { table: {
      head: ['Cost', 'Behaviour', 'In this model'],
      rows: [
        ['Scheme and interchange', 'Variable with volume', '0.33% of payment volume'],
        ['Cloud hosting', 'Steps with scale, not with revenue', 'Grows 1.8% a month on its own trend'],
        ['Payroll', 'Fixed until somebody is hired', 'The approved hiring plan, 0.8% a month'],
        ['Marketing', 'A decision, not a consequence', '180,000 a month, set by a person'],
        ['Facilities', 'Fixed', 'Flat']
      ]
    }},
    { p: 'Model them that way and the base case shows EBITDA margin going from 7.9% in September to 19.3% across ' +
         '2026, because revenue grows at 2.15% a month and most of the cost base does not. **That is ' +
         'operating leverage, and a percentage of revenue model cannot produce it.**' },
    { warn: 'Operating leverage runs backwards just as well, which is what the stress case is for. If volume stops growing and ' +
            'pricing is conceded, the costs stay where they are, and EBITDA falls from 19.3% to 1.2% without a ' +
            'single dramatic event.' },

    { h: 'Working capital, in days' },
    { p: 'Receivables and payables are forecast as days of the thing they follow, because days are stable and ' +
         'comparable while balances are not:' },
    { code: 'receivables = revenue x DSO / 30.4\npayables    = (cogs + opex) x DPO / 30.4', lang: 'text' },
    { p: 'The cash effect is the **change** in the balance, not the balance. Growing revenue consumes cash through ' +
         'receivables even when every invoice is paid on time, which is why profitable growing companies raise ' +
         'money. And a slip in collections is a one off cash cost you can size in one line:' },
    { code: 'DSO from 38 days to 57 days, on revenue of 3.36m a month:\n\n   3,360,000 x (57 - 38) / 30.4  =  2.1 million of cash, once', lang: 'text' },
    { check: {
      q: 'Revenue is growing 2% a month, every customer pays exactly on the agreed terms, and the cash balance keeps ' +
         'falling. What is happening, and what would you look at first?',
      a: 'Growth is consuming working capital. Each month\'s revenue is collected 38 days later, so a growing ' +
         'business is always lending the growth to its customers, and the faster it grows the more it lends. The ' +
         'first thing to look at is the change in receivables against the change in revenue: if receivables are ' +
         'growing faster than revenue then DSO is slipping as well, which is a collections problem on top of a ' +
         'growth one. If they are growing in line, the business is working exactly as designed and needs funding ' +
         'rather than fixing.'
    }},

    { h: 'The circular reference every real model has' },
    { p: 'The company has a revolving facility and a floor on cash. When the forecast dips below the floor, it ' +
         'draws. Drawing costs interest, interest reduces cash, less cash means a bigger draw. **Interest depends on ' +
         'the draw and the draw depends on interest**, and that is a circular reference.' },
    { code: 'draw      = max(0, minimum cash - cash before financing)\ninterest  = term loan interest + (revolver + draw / 2) x revolver rate / 12\ncash      = cash before financing + draw     <- which changes the draw', lang: 'text' },
    { p: 'Excel resolves this with an iterative calculation setting most people never find, and when it fails to ' +
         'converge it quietly shows a stale number. A script does it in a loop and can say what happened:' },
    { code: 'for attempt in range(1, 51):\n    interest = ...\n    new_draw = ...\n    if abs(new_draw - draw) < 0.005:\n        break\n    draw = new_draw\n\n# balance sheet ties in every month,\n# worst case 5 passes to resolve the circularity', lang: 'python' },
    { p: 'Five passes in the stress case, and the model reports it. Two things are then testable that a spreadsheet ' +
         'cannot test: that the loop **converges** rather than hitting its cap, and that it **iterates at all**, ' +
         'because a scenario that never draws proves nothing about the mechanism.' },
    { tip: 'If a model with a revolver never draws in any scenario, the circularity has never been exercised and you ' +
           'do not know whether it works. Build a case severe enough to need the facility, even if nobody believes ' +
           'it will happen. That case is also the one the board will ask about.' },

    { h: 'Scenarios, and the mistake of four files' },
    { p: 'The tempting way to build three cases is to save the file twice and change some numbers. Within a month ' +
         'they have drifted, and nobody can say whether the difference between base and downside is the assumption ' +
         'or the drift.' },
    { code: 'base     = Assumptions()\nupside   = base.scaled("upside",   volume_growth=1.35, take_rate=1.02)\ndownside = base.scaled("downside", volume_growth=0.35, take_rate=0.95, payroll_growth=1.4)\nstress   = base.scaled("stress",   volume_growth=-0.2, take_rate=0.85,\n                                   dso_days=1.55, payroll_growth=1.8)', lang: 'python' },
    { p: 'One base, three sets of multiples. Correct a measured driver and all four cases move together, and the ' +
         'only difference between them remains the thing being varied.' },
    { table: {
      head: ['Case', 'FY2026 revenue', 'FY2026 EBITDA', 'Margin', 'Revolver'],
      rows: [
        ['base', '49.0m', '9.5m', '19.3%', 'never'],
        ['upside', '52.6m', '11.6m', '22.0%', 'never'],
        ['downside', '42.7m', '5.2m', '12.1%', 'never'],
        ['**stress**', '**36.6m**', '**0.4m**', '**1.2%**', '**September 2026, peaking at 1,001,355**']
      ]
    }},

    { h: 'The sensitivity table, and what it is for' },
    { p: 'A two way table of FY2026 EBITDA against the take rate and volume growth. Twenty full fifteen month ' +
         'models, every one of them balancing, in about a second:' },
    { code: '   growth            0.50%        0.54%        0.58%        0.62%        0.66%\n    -0.50%            1.6m         3.4m         5.3m         7.2m         9.0m\n     0.50%            2.7m         4.7m         6.7m         8.8m        10.8m\n     2.15%            4.7m         7.1m         9.5m        11.8m        14.2m\n     3.00%            5.9m         8.5m        11.0m        13.6m        16.2m', lang: 'text' },
    { p: 'Read across, then down. **Sixteen basis points of take rate is worth more than three and a half points of ' +
         'monthly volume growth.** Moving the rate from 0.50% to 0.66% at base growth takes FY2026 EBITDA from 4.7m ' +
         'to 14.2m; moving growth from -0.5% to 3.0% at the base rate takes it from 5.3m to 11.0m.' },
    { p: 'The company argues about volume in every sales meeting and about pricing almost never. The table says that ' +
         'is the wrong way round, and **that** is what a sensitivity table is for: not to widen the forecast into a ' +
         'range nobody acts on, but to say which argument is worth having.' },
    { check: {
      q: 'Your model shows the base case reaching 19.3% EBITDA margin in 2026, up from 7.9% today. The CFO says it ' +
         'looks like a hockey stick. How do you answer?',
      a: 'Show the cost behaviour rather than defending the number. The margin rises because revenue grows 2.15% a ' +
         'month and payroll grows 0.8%, marketing is flat and facilities are flat, so the only costs that scale with ' +
         'the business are the scheme fees. Then show the stress case: with volume flat and pricing conceded, the ' +
         'same structure gives 1.2%. If the answer to "what if you are wrong" is a number rather than a shrug, the ' +
         'hockey stick stops being the question. And if the CFO still thinks payroll will grow faster, that is a ' +
         'driver to change rather than an argument about the shape of a line.'
    }}
  ],

  tutorial: {
    intro: 'Python, and about three hours. Build it in the order the month loop runs, and run the balance check ' +
           'after every step rather than at the end: a model that has never balanced is much harder to fix than one ' +
           'that balanced ten minutes ago.',
    steps: [
      {
        t: 'The opening balance sheet, and a refusal',
        blocks: [
          { code: 'def opening_from_history(path):\n    rows = list(csv.DictReader(open(path)))\n    last = rows[-1]\n    opening = Opening(...)\n    if not opening.balances:\n        raise ValueError(f"the opening balance sheet at {opening.month} does not balance")\n    return opening', lang: 'python' },
          { p: '`raise ValueError(...)` stops the program there and prints that message. It is the code version of ' +
               'the red check cell: the model refuses to produce anything rather than producing something wrong.' },
          { p: 'Starting from a sheet that does not balance guarantees fifteen months that do not balance, and you ' +
               'will spend the afternoon looking for the error in the forecast.' }
        ],
        check: 'Assets of 17,085,598 against the same in liabilities and equity, at 2025-09.'
      },
      {
        t: 'Drivers with sources',
        blocks: [
          { code: '@dataclass(frozen=True)\nclass Driver:\n    value: float\n    source: str\n    judgement: bool = False', lang: 'python' },
          { p: 'Three fields, and the third one is the useful one. When somebody asks where 0.58% came from, the ' +
               'model answers rather than you.' },
          { p: 'Reading it line by line: `class Driver` names the shape, the three indented lines are what one is ' +
               'made of, and `= False` on the last one means you can leave it out and get false. `@dataclass` is ' +
               'the instruction that makes Python write the code to build one, and `frozen=True` means that once ' +
               'built it cannot be edited, only replaced. Making one is `Driver(0.0058, "the last twelve months")` ' +
               'and reading it back is `take_rate.value`.' },
          { tip: 'Write the source as you type the number. Going back to fill them in afterwards is the same job ' +
                 'twice, and the ones you cannot remember are exactly the ones that needed a source.' }
        ],
        check: 'Every driver has a non empty source, and the judgement calls are marked.'
      },
      {
        t: 'The month loop, in the right order',
        blocks: [
          { code: '1. volume, merchants, hosting, payroll roll forward\n2. revenue from drivers\n3. costs, each on its own behaviour\n4. EBITDA, depreciation, EBIT\n5. working capital balances from days\n6. interest, tax, net income        <- the circular bit\n7. cash flow: operations, investing, financing\n8. balance sheet, with cash as the closing line', lang: 'text' },
          { warn: 'Depreciation is computed on the **opening** fixed assets, not the closing ones. Using the closing ' +
                  'balance is circular for no reason and produces a number 2% out every month.' }
        ],
        check: 'The first forecast month balances. If it does not, nothing after it will.'
      },
      {
        t: 'Cash as an output',
        blocks: [
          { code: 'operations = (net_income + depreciation\n              - (receivables - opening_receivables)\n              + (payables - opening_payables))\ncash = opening_cash + operations - capex + financing', lang: 'python' },
          { p: 'Then assert it. This is the line that separates a model from a spreadsheet, and it costs one test:' },
          { code: 'assert month.cash == pytest.approx(\n    previous + month.cash_from_operations - month.capex + month.financing, abs=0.005)', lang: 'python' },
          { p: '`assert` says "this must be true, and stop everything if it is not". `pytest.approx(x, abs=0.005)` ' +
               'means "equal to x, within half a cent", which is how you compare two numbers that have each been ' +
               'through a division without demanding they match to the last bit of floating point.' }
        ],
        check: 'Fifteen months, all balancing, with no plug anywhere.'
      },
      {
        t: 'The revolver, and the loop that resolves it',
        blocks: [
          { p: 'Draw when cash would fall below the floor, repay when there is spare above it, and iterate until the ' +
               'draw stops moving.' },
          { code: 'draw = 0.0\nfor attempt in range(1, MAX_PASSES + 1):\n    interest = term_loan_interest + (revolver + draw / 2) * revolver_rate / 12\n    ...\n    new_draw = max(0.0, minimum_cash - cash_before_financing)\n    passes = attempt\n    if abs(new_draw - draw) < 0.005:\n        break\n    draw = new_draw', lang: 'python' },
          { p: 'Record the pass count. It is the only evidence you have that the thing converged rather than ran out ' +
               'of patience.' }
        ],
        check: 'The base case takes one pass, because it never draws, and the stress case takes five.'
      },
      {
        t: 'Scenarios as multiples',
        blocks: [
          { code: 'def scaled(self, name, **factors):\n    changes = {}\n    for field_name, factor in factors.items():\n        current = getattr(self, field_name)\n        changes[field_name] = Driver(current.value * factor,\n                                     f"{current.source}, scaled {factor:g}x", judgement=True)\n    return replace(self, name=name, **changes)', lang: 'python' },
          { p: 'Four pieces of syntax in six lines, and each one is doing a job. `**factors` collects whatever named ' +
               'arguments you passed into a dictionary, so `scaled("stress", take_rate=0.85, dso_days=1.55)` arrives ' +
               'as two entries the loop can walk. `getattr(self, field_name)` reads a field whose name is in a ' +
               'variable, which a dot cannot do. And `replace(self, ...)` hands back a copy with those fields ' +
               'changed, leaving the base case exactly as it was.' },
          { p: 'A scaled driver keeps its own source and says it was scaled, so a reader of the stress case can see ' +
               'both the original evidence and the judgement applied to it.' }
        ],
        check: 'Four cases, one base. Changing a measured driver moves all four.'
      },
      {
        t: 'The sensitivity grid',
        blocks: [
          { p: 'Five take rates by four growth rates, each one a full model run. Then read it rather than admiring ' +
               'it: find the driver that moves the answer most and write one sentence about what that means.' },
          { code: 'for growth in VOLUME_GROWTH:\n    for rate in TAKE_RATES:\n        cell = run(base.scaled("cell", take_rate=rate / base.take_rate.value,\n                                       volume_growth=growth / base.volume_growth.value))', lang: 'python' }
        ],
        check: 'A table from 1.6m to 16.2m, where every cell came from a model that balanced.'
      }
    ]
  },

  glossary: [
    { t: 'Class', d: 'A shape for a thing: what it is made of. The template, in spreadsheet terms.' },
    { t: 'Object', d: 'One thing of that shape. The filled in row.' },
    { t: 'Field', d: 'One of the parts an object is made of, read with a dot: `driver.value`.' },
    { t: 'dataclass', d: 'A class where Python writes the repetitive parts: building one, printing it, comparing two.' },
    { t: 'frozen', d: 'Cannot be changed after it is made. The code version of not typing over a formula.' },
    { t: 'Property', d: 'A value worked out when it is read rather than stored, so it cannot go stale.' },
    { t: 'self', d: 'Inside a class, the object being worked on. `self.cash` and `month.cash` are the same number.' },
    { t: 'replace', d: 'A copy with some fields changed, leaving the original alone. How the scenarios are built.' },
    { t: 'Three statement model', d: 'A forecast where the profit and loss, balance sheet and cash flow are linked, so cash is derived rather than typed.' },
    { t: 'Driver', d: 'An input the forecast is built from: volume, take rate, days to collect. The thing you argue about.' },
    { t: 'Operating leverage', d: 'Profit growing faster than revenue, because part of the cost base does not move with it. Works in both directions.' },
    { t: 'Working capital', d: 'Receivables plus inventory less payables. The cash tied up in operating the business.' },
    { t: 'DSO', d: 'Days sales outstanding. Receivables expressed as days of revenue.' },
    { t: 'DPO', d: 'Days payable outstanding. Payables expressed as days of cost.' },
    { t: 'Depreciation', d: 'The cost of using up a fixed asset. A charge in the profit and loss that moves no cash.' },
    { t: 'EBITDA', d: 'Earnings before interest, tax, depreciation and amortisation.' },
    { t: 'Revolver', d: 'A credit facility you can draw on and repay as cash allows. The usual source of a model\'s circular reference.' },
    { t: 'Circular reference', d: 'A calculation that depends on its own result. Resolved by iterating until the answer stops moving.' },
    { t: 'Plug', d: 'A number typed in to make a statement balance. The thing a model must never contain.' },
    { t: 'Retained earnings', d: 'Cumulative profit since the company started, less dividends. Moves by net income and nothing else.' },
    { t: 'Sensitivity table', d: 'One output across a grid of two inputs. Shows which input the answer actually depends on.' },
    { t: 'Scenario', d: 'A coherent set of driver changes with a story attached, rather than one number moved.' },
    { t: 'Terminal value', d: 'What a business is assumed to be worth after the forecast ends. Not in this model, on purpose.' }
  ],

  quiz: [
    { q: "Why must cash be an output of the model rather than an input?",
      options: [
        "Because auditors require it",
        "Because it is the closing line of the cash flow statement, and typing it in means plugging the balance sheet",
        "Because cash is hard to predict",
        "Because the bank provides the forecast"
      ],
      answer: 1,
      why: "Cash falls out of net income, non cash charges, working capital movements, capex and financing. Forecast it directly and the balance sheet only balances by accident or by plug." },

    { q: "Revenue grows 2.15% a month, payroll 0.8%, and marketing and facilities are flat. What does the margin do?",
      options: [
        "Rises, because most of the cost base does not grow with revenue. That is operating leverage",
        "Stays flat, since costs are a percentage of revenue",
        "Cannot be determined without the tax rate",
        "Falls, because costs compound faster"
      ],
      answer: 0,
      why: "From 7.9% to 19.3% here. A model that forecasts every cost as a percentage of revenue cannot show this, which is the main reason not to build one that way." },

    { q: "What does DSO moving from 38 days to 57 days cost, on revenue of 3.36 million a month?",
      options: [
        "About 2.1 million of cash, once, as receivables step up",
        "19 days of revenue every month",
        "Nothing, it is a timing difference",
        "It depends on the tax rate"
      ],
      answer: 0,
      why: "3.36m x 19 / 30.4. It is a one off cash cost because the balance steps to a new level and stays there. The recurring cost is the interest on financing it." },

    { q: "A profitable, growing company keeps running out of cash. What is the most likely cause?",
      options: [
        "The tax rate is wrong",
        "Revenue is being recognised too early",
        "Depreciation is too high",
        "Growth is consuming working capital: each month sells more and collects it 38 days later"
      ],
      answer: 3,
      why: "A growing business lends its growth to its customers. It is the normal reason profitable companies raise money, and it is visible only in a model that links the three statements." },

    { q: "Why is depreciation calculated on the opening fixed asset balance?",
      options: [
        "Because capex arrives at the end of the month",
        "Using the closing balance makes it circular for no reason, since closing assets depend on depreciation",
        "Accounting standards require it",
        "It produces a larger charge"
      ],
      answer: 1,
      why: "Depreciation reduces the closing balance, so calculating it on the closing balance depends on itself. Opening balance, then add capex, then subtract the charge." },

    { q: "What creates the circular reference in this model?",
      options: [
        "Receivables, which depend on revenue",
        "The revolver: a draw costs interest, interest reduces cash, and less cash means a bigger draw",
        "Depreciation and fixed assets",
        "Tax, which depends on profit"
      ],
      answer: 1,
      why: "Interest depends on the draw and the draw depends on interest. Excel needs iterative calculation turned on; a script loops until the draw stops moving." },

    { q: "The stress case resolves the circularity in five passes and the base case in one. Why one?",
      options: [
        "It converges faster with higher revenue",
        "The base case is simpler arithmetic",
        "The base case never draws, so there is nothing to iterate. A case that never draws proves nothing about the mechanism",
        "The loop is skipped for profitable scenarios"
      ],
      answer: 2,
      why: "That is why a stress case severe enough to need the facility is worth building even if nobody expects it: it is the only thing that exercises the circular logic." },

    { q: "Why build scenarios as multiples of a base case rather than as separate files?",
      options: [
        "Because Excel cannot handle four files",
        "It is faster to calculate",
        "Because separate copies drift, and then nobody can say whether a difference is the assumption or the drift",
        "It uses less disk space"
      ],
      answer: 2,
      why: "Correct a measured driver once and all four cases move. The only difference between them stays the thing being varied, which is the entire point of having them." },

    { q: "The sensitivity table shows 16 basis points of take rate worth more than 3.5 points of monthly volume growth. What is that for?",
      options: [
        "Deciding which argument is worth having: the company debates volume constantly and pricing almost never",
        "Widening the forecast into a range",
        "Proving the model is accurate",
        "Setting the budget"
      ],
      answer: 0,
      why: "A range nobody acts on is decoration. A table that says the meeting is about the wrong thing changes what happens next week." },

    { q: "What does it mean when a driver is marked as a judgement rather than measured?",
      options: [
        "It is a placeholder to be filled in later",
        "It came from a person's decision rather than from the history, so a reviewer knows which inputs are opinions",
        "It is less important",
        "It cannot be changed in scenarios"
      ],
      answer: 1,
      why: "The take rate, the cash floor and the facility rate are decisions. Marking them is how a model stops being believed more than it deserves." },

    { q: "Retained earnings in the opening balance sheet are negative 11.5 million. What is the one sentence answer?",
      options: [
        "The company has a going concern problem",
        "Dividends exceeded profits",
        "An error in the ledger",
        "Cumulative losses since founding, against twenty two million raised. Normal for a growing business"
      ],
      answer: 3,
      why: "Retained earnings are cumulative profit since day one. A company that has raised more than it has earned has a negative balance, and it says nothing on its own about whether the business works." },

    { q: "Retained earnings should move each month by exactly what?",
      options: [
        "Net income plus depreciation",
        "EBITDA",
        "Net income",
        "Cash flow from operations"
      ],
      answer: 2,
      why: "Net income and nothing else, absent dividends or equity issues. It is one of the identities worth asserting in a test, because when it breaks the model is wrong whatever the assumptions were." },

    { q: "Your model hits its 50 pass iteration cap. What has happened?",
      options: [
        "Python ran out of memory",
        "The forecast is too long",
        "The revolver rate is too high",
        "The circular calculation is not converging, and any number it shows is meaningless"
      ],
      answer: 3,
      why: "Hitting the cap is a failure, not a result. Excel in the same situation shows a stale number with no warning, which is worse." },

    { q: "Which cost is a decision rather than a consequence?",
      options: [
        "Scheme and interchange fees",
        "Depreciation",
        "Marketing spend",
        "Receivables"
      ],
      answer: 2,
      why: "Scheme fees follow volume, depreciation follows the asset base, receivables follow revenue. Marketing is a number a person chooses, and modelling it as a percentage of revenue hides that." },

    { q: "What is the strongest evidence that a three statement model is right?",
      options: [
        "The balance sheet balances in every month of every scenario, with no plug",
        "The forecast looks reasonable",
        "It matches last year",
        "The CFO approved it"
      ],
      answer: 0,
      why: "Balancing is not proof that the assumptions are good, and it is proof that the mechanics are. Sixty forecast months balancing to the cent means every linkage is doing what it should." }
  ],

  project: {
    title: 'three-statement: the model, with its own tests',
    story: 'The board wants a fifteen month forecast from the September close, with an upside, a downside, and the ' +
           'case that puts the company on its facility. They want to know which driver matters most, and when the ' +
           'money runs short in the bad case. Build it so that somebody can check it.',
    scope: 'Python, from the closing balance sheet in fpa-history.csv. Revenue from drivers, costs by behaviour, ' +
           'working capital in days, a debt schedule, a revolver, and tests for the identities. **This is the ' +
           'first level that needs classes**: you should be able to read a class, make an object from it, and ' +
           'read a field off it with a dot. The knowledge section "The Python this level uses" covers exactly ' +
           'that much and nothing more, and it is enough for the whole build.',
    dataset: '{{RAW}}/data/fpa-history.csv',
    requirements: [
      'A drivers module where every assumption carries its source, and judgements are marked as such',
      'The opening balance sheet read from the last closed month, with a refusal if it does not balance',
      'Revenue forecast from volume, take rate, merchants and platform fee, not as a growth rate on a total',
      'Costs modelled by behaviour: variable with volume, on their own trend, or fixed',
      'Working capital as DSO and DPO days, with the cash effect being the change in the balance',
      'A term loan that amortises and never goes negative',
      'A revolver that draws to a minimum cash floor and repays when there is spare cash',
      'The circular reference resolved by iteration, with the pass count reported and a cap that is an error if hit',
      'Cash as the closing line of the cash flow statement, never typed in',
      'Four scenarios built as multiples of one base case',
      'A two way sensitivity table of FY2026 EBITDA against take rate and volume growth',
      'Tests: the balance sheet balances every month in every scenario, retained earnings move by net income, fixed assets move by capex less depreciation, cash reconciles to the cash flow, and the circularity both iterates and converges'
    ],
    starter: {
      lang: 'python',
      code: '"""FinQuest analyst level 4: the three statement model."""\nfrom dataclasses import dataclass\n\n\n@dataclass(frozen=True)\nclass Driver:\n    value: float\n    source: str\n    judgement: bool = False\n\n\n@dataclass(frozen=True)\nclass Assumptions:\n    name: str\n    volume_growth: Driver = Driver(0.0215, "median of the last six months")\n    take_rate: Driver = Driver(0.0058, "last twelve months of actuals", judgement=True)\n    # TODO: the rest, each with a source\n\n\ndef run(assumptions, opening, horizon=15):\n    """Fifteen months of three statements.\n\n    The order inside the loop is the model:\n        1. roll the drivers forward\n        2. revenue\n        3. costs\n        4. EBITDA, depreciation, EBIT\n        5. working capital balances\n        6. interest, tax, net income      <- iterate here for the revolver\n        7. cash flow\n        8. balance sheet, cash as the closing line\n    """\n    # TODO\n\n\ndef balances(month):\n    """assets - liabilities - equity, which must be zero to the cent."""\n    # TODO\n'
    },
    tests: [
      'Every month of every scenario balances to within half a cent, with no plug',
      'The opening balance sheet is read from the data and refuses to start if it does not balance',
      'Retained earnings move by exactly net income each month',
      'Fixed assets move by exactly capex less depreciation each month',
      'Cash equals opening cash plus operations less capex plus financing, every month',
      'The base, upside and downside cases never draw on the revolver, and the stress case does',
      'The stress case takes more than one pass and fewer than the cap to resolve the circularity',
      'Increasing DSO reduces closing cash',
      'Every driver has a non empty source, and the judgement calls are marked',
      'The sensitivity table runs twenty models and all of them balance'
    ],
    rubric: [
      { pts: 25, t: 'It ties', d: 'Sixty forecast months balancing to the cent, cash derived, no plug anywhere.' },
      { pts: 20, t: 'It is driven', d: 'Revenue from volume and rate, costs by behaviour, working capital in days.' },
      { pts: 20, t: 'It is honest', d: 'Every driver has a source and the judgements are marked. A reviewer can tell facts from opinions.' },
      { pts: 20, t: 'It handles the circle', d: 'The revolver works, the iteration converges, the pass count is reported, and a case exists that exercises it.' },
      { pts: 15, t: 'It decides something', d: 'A sensitivity table with a sentence saying which argument it settles.' }
    ],
    stretch: [
      'Add a monthly covenant test: EBITDA to interest above 3x, and report the first month it breaks in each case',
      'Rebuild the same model in a spreadsheet and check it against the Python output month by month',
      'Add a working capital scenario where only DSO moves, and quantify the facility it would need',
      'Forecast the next twelve months, then compare it against what the actuals would have been using the history generator'
    ],
    solutionPath: 'solutions/fpa-04'
  },

  faq: [
    { q: 'Should a model like this be in Excel?',
      a: 'In a job, almost certainly, because that is what gets reviewed and shared. Build this one in Python anyway: the identities become tests, and an analyst who has asserted that the balance sheet balances sixty times is a different modeller from one who has eyeballed it once. The structure transfers directly.' },
    { q: 'Fifteen months seems short.',
      a: 'It is the rest of this year and all of next, which is what a board actually decides on. A five year model is a different exercise with different rules, and most of them are exercises in compounding an opinion. Get the first fifteen months right before extending.' },
    { q: 'How do I pick the driver values?',
      a: 'From history where you can, and from a person where you cannot. The important part is marking which is which, and writing where each one came from while you type it rather than afterwards.' },
    { q: 'My balance sheet is out by a small amount.',
      a: 'It is nearly always one of four things: a cash flow line that does not appear in the balance sheet, depreciation calculated on the closing balance, a working capital movement using the balance rather than the change, or net income not reaching retained earnings. Check them in that order, and check the first month first.' },
    { q: 'Is the stress case realistic?',
      a: 'Every individual piece of it is, which is the point. One large merchant leaving, pricing conceded to win the next one, a two week slip in collections, and hiring that carries on because it was approved. Stress cases built from one dramatic event get dismissed; stress cases built from four ordinary ones do not.' }
  ]
});
