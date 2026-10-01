/* =========================================================================
   ANALYST TRACK, LEVEL 3: the part you used to do by hand
   ========================================================================= */
FQ.registerLevel({
  id: 102,
  track: 'fpa',
  position: 2,
  codename: 'automate',
  title: 'The part you used to do by hand',
  tagline: 'The same pack, from the same files, in 39 milliseconds, with checks that stop it printing when it is wrong.',
  difficulty: 5,
  minutes: 240,
  tags: ['pandas', 'automation', 'data quality', 'month end'],
  summary: 'The close pack is the one page a finance team argues over every month: what we planned, what happened, and ' +
           'why they differ. This level builds it as a program: load, clean, check, aggregate, report. The point is not speed. It is that the month ' +
           'becomes an argument, the checks run every single time, and nobody can paste a value over a formula.',

  objectives: [
    'Read a general ledger export, including the sign convention that trips everybody up',
    'Sign a variance so that positive always means favourable, whichever side of the profit and loss it is on',
    'Split a revenue variance into the part that is volume and the part that is price',
    'Load a messy export into pandas and repair it once, at the boundary',
    'Group, join and aggregate to produce the same pack you built by hand',
    'Write checks that refuse to produce a pack rather than producing a wrong one',
    'Tell a fatal problem from something that only needs saying in the commentary',
    'Avoid the merge that silently doubles your revenue',
    'Produce a chart and a draft memo from the same run, with the causes left blank'
  ],

  knowledge: [
    { h: 'What automation is actually for' },
    { p: 'This pack takes about ninety minutes a month by hand and 39 milliseconds as a script, and **the time is the least ' +
         'interesting part of that sentence**. Once a month, ninety minutes is affordable. What is not affordable is ' +
         'the fourth month, when somebody pastes a number over a formula at 7pm, or the range in a `SUMIFS` stops one ' +
         'row short of the new data, or two people have two versions of the file.' },
    { p: 'A script fixes those because it does the same thing every time, it can be tested, and it can refuse. That ' +
         'last one is the real prize: **a spreadsheet cannot decline to show you a number**, and a script can.' },
    { money: 'The rule this level is built around: a pack that cannot prove itself does not print. The pack total is ' +
             'checked against the ledger it was built from on every run, and a pack that does not tie exits 1 and ' +
             'prints nothing anybody could paste into an email.' },

    { h: 'The file, and the sign that trips everybody up' },
    { p: 'The pack is built from two files. The first is a **general ledger export**: one row per account per cost ' +
         'centre per month, straight out of the accounting system. These are its real first rows:' },
    { table: {
      head: ['journal_id', 'month', 'cost_centre', 'account_code', 'account_name', 'amount'],
      rows: [
        ['JE000001', '2024-01', 'CC900', '4000', 'Transaction fees', '**-1,188,222.14**'],
        ['JE000002', '2024-01', 'CC900', '4100', 'Subscription fees', '**-486,000.00**'],
        ['JE000004', '2024-01', 'CC900', '5000', 'Scheme and interchange costs', '676,057.43'],
        ['JE000006', '2024-01', 'CC100', '6000', 'Salaries and wages', '448,400.00']
      ]
    }},
    { warn: 'Revenue is **negative**, because it is a credit. Every accounting system in the world writes revenue as ' +
            'a credit, and credits export as negative numbers. Sum the amount column as it comes and a profitable ' +
            'month reads as a catastrophe.' },
    { p: 'So the first rule, before any analysis: flip the sign **once**, where the data arrives, and never think ' +
         'about it again. After that one line, every number in the pack means "how much of this was there", which is ' +
         'what a reader assumes anyway.' },
    { p: 'The second file is the **budget**: the FY2025 plan, in whole dollars, positive everywhere, with its own ' +
         'names for two accounts. The plan calls 5100 `Hosting` and the ledger calls it `Cloud hosting`, which is why ' +
         'the two are joined on the account **code** and the label comes from your own mapping. A join on a label ' +
         'fails silently: the row does not appear, the pack still totals something, and the difference turns up as an ' +
         'unexplained variance.' },

    { h: 'Favourable is not the same as good' },
    { p: 'A variance is actual minus budget, and its sign means opposite things on opposite sides of the profit and ' +
         'loss. Revenue above plan is favourable. Cost above plan is unfavourable. A pack showing raw differences ' +
         'makes every reader work out the sign for themselves, and one of them gets it wrong out loud in a meeting.' },
    { p: 'So **the variance column is signed so that positive is always favourable to profit**, decided by the group ' +
         'the line belongs to rather than by its name. One rule, written down once:' },
    { code: 'variance = actual - budget   if the line is revenue\nvariance = budget - actual   if the line is a cost', lang: 'text' },
    { table: {
      head: ['Line', 'Actual', 'Budget', 'Variance', 'Reads as'],
      rows: [
        ['Revenue', '3,361,050', '3,220,357', '**+140,693**', 'favourable'],
        ['Cost of sales', '1,457,482', '1,290,386', '**-167,096**', 'unfavourable'],
        ['Gross profit', '1,903,569', '1,929,971', '**-26,402**', 'unfavourable'],
        ['Operating expenses', '1,637,580', '1,551,580', '**-86,000**', 'unfavourable'],
        ['EBITDA', '265,989', '378,391', '**-112,402**', 'unfavourable']
      ]
    }},
    { p: 'Read that table twice, because it is the month this level is about. **Revenue beat the plan and gross ' +
         'profit missed it.** Selling more of something you make less on happens to real companies every month, and ' +
         'the pack has to make it visible rather than bury it in a net number.' },
    { p: 'Two other lines are worth knowing before you build anything. Marketing is **210,000 over** plan because a ' +
         'campaign moved forward from Q4, so the full year is 80,000 **under**: a timing difference, which reverses ' +
         'by definition. And cost centre **CC600 is 96,000 under** plan every month because it is a team that was ' +
         'budgeted and never created. Nothing was saved there, and reporting it as a saving is a lie by omission.' },

    { h: 'Price and volume, the only split you need this month' },
    { p: 'Transaction fees beat the plan by 151,993. Underneath that one number are two movements pulling against ' +
         'each other, with different owners and different fixes:' },
    { code: 'planned:  354,224,934 of volume  x  0.6200%  =  2,196,195\nactual:   404,860,085 of volume  x  0.5800%  =  2,348,188\n                                                   -----------\n                                          variance   =   +151,993\n\nvolume effect   (404,860,085 - 354,224,934) x 0.6200%  =  +313,938\nrate effect     (0.5800% - 0.6200%) x 404,860,085      =  -161,944\n                                                          --------\n                                                          +151,994', lang: 'text' },
    { p: 'Volume was **14.3% ahead** of plan and the take rate **6.5% behind** it. The sales team is ahead of its ' +
         'number and pricing is giving more than half of that gain back. Those are two conversations with two ' +
         'different people, and neither happens if the pack says "transaction fees, favourable 152k".' },
    { p: 'The two effects add to 151,994 and the ledger says the variance was 151,993. **You are a dollar out and you ' +
         'say so**: the ledger rounds every posting to the cent and the bridge multiplies two rounded rates. Write ' +
         '"rounding" next to it, because plugging the dollar is how a model starts lying.' },
    { tip: 'The cross term, the part where the extra volume also came at the lower rate, lands inside the rate effect ' +
           'because the rate difference is valued at actual volume. Any consistent convention works. Two conventions ' +
           'in two months is how a bridge stops meaning anything.' },
    { check: {
      q: 'Volume beat the plan by 14.3% and the take rate missed by 6.5%. What single business change produces ' +
         'exactly that shape, and why does it matter more than the net number?',
      a: 'A mix shift towards larger merchants. Big merchants bring volume and negotiate lower pricing, so both ' +
         'numbers move at once and in opposite directions. It matters because the two have different futures: volume ' +
         'growth compounds, and a lower average rate is permanent until pricing changes. A pack reporting only the ' +
         'favourable 152k tells the reader that pricing is fine, which is the opposite of what the data says. It also ' +
         'predicts the gross margin problem one line down, because scheme costs scale with volume at a fixed rate: ' +
         'if the fee rate falls while the cost rate does not, margin is squeezed from both ends.'
    }},

    { h: 'Load once, clean once' },
    { p: 'Everything ugly about the export is dealt with in one function, and every number downstream is computed ' +
         'from the cleaned frame. Three repairs, in this order:' },
    { table: {
      head: ['Problem', 'In the data', 'The repair'],
      rows: [
        ['Amounts as text', '`180,000.00` and `(700,200.00)`', 'One function: strip commas, read brackets as a minus sign'],
        ['A label with a trailing space', '`Cloud hosting ` in May', '`.str.strip()` on every text column'],
        ['A duplicated journal', '`JE000261`, 590,000, in June', '`drop_duplicates(subset="journal_id")`, and **count what you dropped**']
      ]
    }},
    { code: 'def to_number(value):\n    """`(700,200.00)` is negative seven hundred thousand two hundred."""\n    if isinstance(value, (int, float)):\n        return float(value)\n    text = str(value).strip().replace(",", "")\n    if text.startswith("(") and text.endswith(")"):\n        return -float(text[1:-1])\n    return float(text)', lang: 'python' },
    { warn: 'One text value anywhere makes the **whole column** an object dtype, so every value in it is a string, ' +
            'including the 316 that were fine. That is why `df["amount"].sum()` on a dirty column does not raise: it ' +
            'concatenates or skips rather than adding, and you get a number that is quietly wrong.' },
    { p: 'And the sign rule, which in the spreadsheet lived in one column and here lives in one line:' },
    { code: 'frame["value"] = frame["amount"].where(frame["line_type"] != "revenue", -frame["amount"])', lang: 'python' },

    { h: 'Report what you repaired' },
    { p: 'Silently cleaning an export is a trap. Your pack now disagrees with the raw file, the accountant is looking ' +
         'at the raw file, and neither of you knows why. So the loader returns what it did and the pack prints it:' },
    { code: '317 ledger rows, 1 duplicate journal removed, 2 text amounts repaired, 1 label trimmed', lang: 'text' },
    { p: 'That line is worth more than it looks. It is the sentence you send the accountant, it is the evidence that ' +
         'the duplicate was handled deliberately, and if it ever reads `0 duplicate journals removed` you know the ' +
         'export changed.' },

    { h: 'The pack, in about fifteen lines' },
    { code: 'this_month  = actuals[actuals["month"] == month]\nthis_plan   = budget[budget["month"] == month]\n\nactual_by_line = this_month.groupby("pack_line")["value"].sum()\nbudget_by_line = this_plan.groupby("pack_line")["budget_amount"].sum()\n\nfor line in PACK_ORDER:\n    a = float(actual_by_line.get(line, 0.0))\n    b = float(budget_by_line.get(line, 0.0))\n    rows.append({"line": line, "actual": a, "budget": b,\n                 "variance": a - b if group == "revenue" else b - a})', lang: 'python' },
    { p: 'Two details make it a finance report rather than a ' +
         'data dump. The variance is **signed so that positive is favourable**, decided by the line\'s group rather ' +
         'than by its name. And `get(line, 0.0)` means a line that exists in the plan and not in the ledger shows as ' +
         'a zero rather than vanishing, which is how CC600 stays visible.' },
    { check: {
      q: 'Why use `.get(line, 0.0)` rather than joining the two frames and letting pandas line them up?',
      a: 'Because a join would drop the line that exists on only one side, and that line is the interesting one. The ' +
         'budgeted cost centre with no actuals is the difference between a pack that says "we are 96,000 under ' +
         'budget" and one that says "the plan contains a team that was never hired". An inner join is a decision to ' +
         'hide unmatched rows, and in finance the unmatched row is usually the finding. If you do join, use ' +
         '`how="outer"` and look at what the nulls are telling you.'
    }},

    { h: 'The merge that doubles your revenue' },
    { p: 'The single most expensive pandas mistake in finance work, and it never raises an error:' },
    { code: 'invoices  = pd.DataFrame({"customer_id": ["A", "B"], "amount": [100.0, 200.0]})\ncustomers = pd.DataFrame({"customer_id": ["A", "B"], "segment": ["mid", "mid"]})\n\ninvoices.merge(customers, on="customer_id")["amount"].sum()      # 300.0, correct\n\n# now customers has A twice, because somebody re-ran an export\nduplicated = pd.concat([customers, customers.head(1)])\ninvoices.merge(duplicated, on="customer_id")["amount"].sum()     # 400.0\n#                                              ^ no error, no warning', lang: 'python' },
    { p: 'The lookup table gained one duplicate row and the revenue went up by a third. At 3,778 invoices you would ' +
         'not notice. The habit that prevents it is one line before every merge:' },
    { code: 'assert customers["customer_id"].is_unique, "the lookup key is not unique"', lang: 'python' },
    { tip: 'pandas can tell you afterwards too: `merge(..., validate="many_to_one")` raises if the right side is not ' +
           'unique. Use it on every merge you write against a lookup table and the class of bug disappears.' },

    { h: 'Checks that refuse' },
    { p: 'The gates run before the pack is built, and they split into two kinds. The split is a judgement about money ' +
         'rather than about data:' },
    { table: {
      head: ['', 'Means', 'Examples from this pack'],
      rows: [
        ['**Fatal**', 'The pack would be wrong. Print nothing', 'An account code with no mapping, a month missing from the plan, an amount that is still not a number'],
        ['**Warning**', 'The pack is right and somebody needs to know', 'A cost centre budgeted with no actuals, a duplicate journal removed, a credit note not in the ledger']
      ]
    }},
    { p: 'Getting that split wrong in either direction is costly. Treat everything as fatal and the pack never runs; ' +
         'treat everything as a warning and the warnings scroll past unread. **A gate that cries wolf is switched off ' +
         'within two months**, and then the real one is off too.' },
    { code: 'findings = run_checks(actuals, budget, month)\nif any(f.level == "fatal" for f in findings):\n    print("the pack was not produced. Fix these first:")\n    for f in findings: print("   ", f)\n    sys.exit(1)', lang: 'python' },

    { h: 'The check cell, after automation' },
    { p: 'In the spreadsheet the check cell compared the pack total to the ledger total. Automated, it has to be ' +
         'built from two genuinely different routes or it proves nothing:' },
    { code: 'pack_total   = revenue lines - cost lines          # built from PACK_ORDER\nledger_total = revenue rows  - cost rows           # built from every row in the month\ndifference   = round(pack_total - ledger_total, 2)   # must be 0.00', lang: 'text' },
    { p: 'The pack side walks the layout. The ledger side walks the data. So the realistic failure, where somebody ' +
         'adds an account and nobody adds it to the layout, shows up as a difference rather than as a number quietly ' +
         'missing from a report nobody re-adds by hand.' },
    { warn: 'Then test the test. Remove a line from the layout on purpose and assert the check complains. **A check ' +
            'that has never failed is decoration**, and you do not find out which kind you have on the night it ' +
            'matters.' },

    { h: 'The memo, and the part a script must not write' },
    { p: 'The script knows what moved and by how much. It does not know why, and this is the boundary worth being ' +
         'strict about: it writes the arithmetic and leaves the cause as the word TODO.' },
    { code: '**Marketing programmes, -210,000 unfavourable.** TODO: why. TODO: what happens next.\n**Scheme and interchange, -167,096 unfavourable.** TODO: why. TODO: what happens next.\n**Transaction fees, +151,993 favourable.** TODO: why. TODO: what happens next.', lang: 'text' },
    { p: 'A tool that invents the explanation is worse than no tool, because the explanation is the part you are ' +
         'accountable for and the only part anybody reads twice. What the script should do is make sure no material ' +
         'variance is ever missing from the list, which is the failure mode of a hand written memo at 7pm.' },
    { p: 'What you write in place of each TODO is three sentences: **what moved, why it moved, and what happens ' +
         'next**. In that order, and with no adjectives.' },
    { code: 'Weak:\n  "Marketing spend was significantly higher than budget due to increased\n   campaign activity in the period."\n\nStrong:\n  "Marketing is 210k over plan in September because the Q4 brand campaign\n   was moved forward to catch the peak trading season. October and November\n   are now 290k under plan, so the full year is 80k favourable. No action."\n\nWeak:\n  "Support costs were favourable versus budget."\n\nStrong:\n  "Support salaries are 28k under plan because five of the six budgeted\n   hires have not been made. Volume per support head is up 40% since January.\n   Recruitment is the constraint, not the budget."', lang: 'text' },
    { p: 'The strong version of each is shorter than it looks, carries a number in every sentence, and ends by ' +
         'telling the reader whether they have to do anything. That is the whole format, and it is the part of this ' +
         'job no amount of Python will do for you.' },
    { check: {
      q: 'Your script produces the pack, the chart and the draft memo in one command. What is the first thing to ' +
         'check before sending any of it?',
      a: 'That the check cell is zero and the gates are clean, which the script prints. After that, the repair line: ' +
         'if it says something different from last month, the export changed and the difference needs explaining ' +
         'before the numbers do. Then read the TODO list and fill it in, because a memo sent with TODO in it is ' +
         'worse than a memo that was late, and it is the one thing in this pipeline a person cannot skip.'
    }}
  ],

  tutorial: {
    intro: 'Python with pandas, in a folder rather than a notebook: this is the first thing on the track that is a ' +
           'program rather than an analysis. About two hours. Run the tests as you go.',
    steps: [
      {
        t: 'Make it a package, not a notebook',
        blocks: [
          { code: 'close-pack/\n  closepack/\n    __init__.py\n    load.py        the files, and the three repairs\n    checks.py      the gates\n    bridge.py      price and volume\n    pack.py        the pack, and the check cell\n    report.py      the chart and the draft memo\n  tests/\n    test_pack.py\n  README.md', lang: 'text' },
          { p: 'A notebook is the right tool for looking at data and the wrong one for a thing that runs every month: ' +
               'cells run out of order, state survives edits, and nothing can be imported into a test.' }
        ],
        check: '`python -c "import closepack"` works from the close-pack folder.'
      },
      {
        t: 'Load and repair, with a report',
        blocks: [
          { code: 'frame = pd.read_csv(DATA / "fpa-actuals.csv", dtype={"account_code": str})\n\ntext_amounts = int(pd.to_numeric(frame["amount"], errors="coerce").isna().sum())\nframe["amount"] = frame["amount"].map(to_number)\n\ntrimmed = int((frame["account_name"] != frame["account_name"].str.strip()).sum())\nfor column in ["account_name", "cost_centre", "line_type"]:\n    frame[column] = frame[column].str.strip()\n\nbefore = len(frame)\nframe = frame.drop_duplicates(subset="journal_id").reset_index(drop=True)\nduplicates = before - len(frame)', lang: 'python' },
          { warn: '`dtype={"account_code": str}` matters. Left alone, pandas reads 4000 as an integer, and the day an ' +
                  'account code starts with a zero the leading zero disappears and the join stops matching.' }
        ],
        check: '317 rows, 1 duplicate, 2 text amounts, 1 trimmed label.'
      },
      {
        t: 'Map, then aggregate',
        blocks: [
          { p: 'One dictionary from account code to pack line and group. It is the only place the shape of the pack is ' +
               'written down, so adding an account next month is a one line change.' },
          { code: 'MAPPING = {\n    "4000": ("Transaction fees", "revenue"),\n    "4100": ("Subscription fees", "revenue"),\n    ...\n    "6100": ("Marketing programmes", "opex"),\n}\n\nframe["pack_line"] = frame["account_code"].map(lambda c: MAPPING[c][0])\nframe["group"]     = frame["account_code"].map(lambda c: MAPPING[c][1])', lang: 'python' },
          { p: 'A `KeyError` here is a feature: an account code the mapping has never seen should stop the run rather ' +
               'than land in a line called NaN.' }
        ],
        check: 'Every row has a pack_line, and September revenue is 3,361,050.'
      },
      {
        t: 'The gates',
        blocks: [
          { p: 'Five checks, each returning findings rather than raising, so the run can report all of them at once ' +
               'rather than one per attempt.' },
          { code: 'unmapped = set(actuals["account_code"]) - set(MAPPING)\nmissing_month = month not in set(budget["month"])\nghost_centres = (set(budget_month["cost_centre"])\n                 - set(actual_month["cost_centre"]))', lang: 'python' },
          { tip: 'Fixing five problems in one pass beats five runs. It reads as a small thing and it changes whether ' +
                 'anybody keeps using your tool.' }
        ],
        check: 'September is clean, and asking for 2024-05 is fatal because the plan starts in 2025.'
      },
      {
        t: 'The check cell as an exit code',
        blocks: [
          { code: 'difference = round(pack_total - ledger_total, 2)\nprint(f"   check: pack against ledger {difference:+,.2f}")\nreturn 0 if abs(difference) < 0.005 else 1', lang: 'python' },
          { p: 'Now the script can be run by something other than you: a scheduler, a colleague, a build. Exit code 1 ' +
               'means nobody sends this pack.' }
        ],
        check: 'check: pack against ledger +0.00, and the command exits 0.'
      },
      {
        t: 'Break it on purpose',
        blocks: [
          { p: 'Delete a line from PACK_ORDER, run again, and watch the check cell go non zero. Then write that as a ' +
               'test so it is checked every time rather than the once.' },
          { code: 'def test_the_check_catches_a_dropped_pack_line(monkeypatch):\n    monkeypatch.setattr(load, "PACK_ORDER",\n                        [l for l in load.PACK_ORDER if l != "FX markup"])\n    broken = pack.build("2025-09")\n    assert not broken.ties\n    assert round(broken.tie_difference) == -255_062', lang: 'python' }
        ],
        check: 'The test passes, which means the check works, which is a different claim from the check being present.'
      },
      {
        t: 'The chart and the draft memo',
        blocks: [
          { p: 'A waterfall from budget EBITDA to actual EBITDA, one bar per material variance, and a markdown memo ' +
               'with the numbers filled in and the causes left blank.' },
          { code: 'moves = [(row["line"], row["variance"]) for _, row in lines.iterrows()\n         if abs(row["variance"]) >= MATERIALITY]\nmoves.sort(key=lambda pair: -abs(pair[1]))', lang: 'python' },
          { p: 'Sorting by absolute size is the whole design of the chart: the reader sees the three bars that matter ' +
               'before reading a single label.' }
        ],
        check: 'A png where the bars step from 378,391 down to 265,989, and a memo with three TODOs in it.'
      }
    ]
  },

  glossary: [
    { t: 'Credit', d: 'A negative amount in an export. Revenue is a credit, which is why it exports negative.' },
    { t: 'Variance', d: 'Actual minus budget, signed so that positive means favourable to profit.' },
    { t: 'Favourable', d: 'Better for profit than planned. Not the same as good: an underspend from a hire that never happened is favourable and bad.' },
    { t: 'Timing difference', d: 'Spend that moved between periods rather than changing in total. Reverses by definition.' },
    { t: 'Take rate', d: 'Revenue as a share of payment volume. 0.58% here, meaning 58 cents of every hundred dollars processed.' },
    { t: 'Price and volume variance', d: 'Splitting a revenue difference into how much was sold and what it was sold for.' },
    { t: 'DataFrame', d: 'A pandas table: named, typed columns and an index.' },
    { t: 'dtype', d: 'A column\'s type. One text value makes the whole column object, and then sums stop meaning what you expect.' },
    { t: 'groupby', d: 'Split rows into groups, aggregate each, combine. The SQL GROUP BY, in pandas.' },
    { t: 'merge', d: 'Join two frames on a key. Defaults to an inner join, like SQL.' },
    { t: 'validate="many_to_one"', d: 'A merge argument that raises if the right side\'s key is not unique. Use it on every lookup.' },
    { t: 'Boundary', d: 'The single place where outside data becomes internal data, and therefore the only place it is cleaned.' },
    { t: 'Idempotent', d: 'Running it twice gives the same answer as running it once. What a monthly job has to be.' },
    { t: 'Exit code', d: 'The number a program returns. Zero means it worked, and a scheduler reads it even when nobody does.' },
    { t: 'Materiality', d: 'The size at which a variance is worth explaining. A number in a constant, not a feeling.' },
    { t: 'Gate', d: 'A check that stops the run. Distinct from a warning, which lets it continue.' },
    { t: 'Waterfall chart', d: 'Bars that step from a starting number to an ending one, one step per cause.' },
    { t: 'Regression test', d: 'A test that fails if a thing that used to work stops working.' },
    { t: 'Package', d: 'A folder of Python modules with an __init__.py, which can be imported and therefore tested.' },
    { t: 'Assertion', d: 'A statement of what must be true, written where it can fail loudly rather than in a comment.' },
    { t: 'Draft', d: 'Output that is deliberately incomplete, so that the part only a person can write stays visible.' }
  ],

  quiz: [
    { q: "Why is `df[\"amount\"].sum()` dangerous on a column that contains `(700,200.00)`?",
      options: [
        "It treats the brackets as a positive number",
        "It raises a TypeError that is easy to miss",
        "It rounds to the nearest thousand",
        "One text value makes the whole column object dtype, so the sum silently skips or concatenates rather than adding"
      ],
      answer: 3,
      why: "Nothing raises. The column type changed, the sum returns a plausible number, and the only thing that catches it is a check that knows what the answer should be." },

    { q: "The loader says \"2 text amounts repaired\" out of 318 rows. An earlier version said 318. What was it measuring?",
      options: [
        "A caching bug in pandas",
        "The number of rows in the file",
        "The column dtype: with one text value present, every value in the column is a string, including the good ones",
        "The number of rows with a comma anywhere"
      ],
      answer: 2,
      why: "It counted values that were not int or float, which after the dtype changes is all of them. Counting what a plain conversion would throw away is the measure that means something." },

    { q: "Where should the sign rule that flips revenue live?",
      options: [
        "In the source file, corrected before loading",
        "In the chart, so the raw numbers stay untouched",
        "In every aggregation that touches revenue",
        "In one line in the loader, where the data arrives"
      ],
      answer: 3,
      why: "Once, at the boundary. Editing the source file loses the fix on the next export, and scattering the rule guarantees one place misses it." },

    { q: "A lookup table gains one duplicate row and revenue rises by a third. What happened?",
      options: [
        "The merge matched each invoice to both copies of that customer, so those invoices appear twice",
        "The amounts were stored as text",
        "pandas summed the duplicate column twice",
        "The index was reset incorrectly"
      ],
      answer: 0,
      why: "A one to many join where you assumed one to one. No error, no warning, and a total that is wrong by exactly the duplicated rows. `validate=\"many_to_one\"` turns it into an exception." },

    { q: "Which of these should be fatal rather than a warning?",
      options: [
        "A duplicate journal that was removed",
        "An account code in the ledger that the mapping has never seen",
        "A cost centre with a budget and no actuals",
        "A credit note in billing that is not in the ledger"
      ],
      answer: 1,
      why: "An unmapped code is money in the ledger that appears nowhere in the pack, so the pack would be wrong. The other three leave the pack correct and need saying in the commentary." },

    { q: "Why does the check cell build its two sides by different routes?",
      options: [
        "So it can catch a line that is in the mapping and missing from the layout, which is how packs actually drift",
        "Because pandas cannot sum the same frame twice",
        "To handle rounding differences",
        "For speed"
      ],
      answer: 0,
      why: "Comparing a number to itself proves nothing. One side walks the layout, the other walks the data, and the difference between them is the class of error that silently drops a line." },

    { q: "What does `test_the_check_catches_a_dropped_pack_line` prove?",
      options: [
        "That the ledger is clean",
        "That the check works, by breaking the pack on purpose and asserting the check complains",
        "That the pack is correct",
        "That pandas merges are safe"
      ],
      answer: 1,
      why: "A check that has never failed might be checking nothing. Making it fail on demand is the only way to know which kind you have." },

    { q: "Why does the generated memo write \"TODO: why\" instead of an explanation?",
      options: [
        "Because the script knows what moved and cannot know why, and an invented cause is worse than a blank one",
        "Because the data is synthetic",
        "Because the feature is unfinished",
        "To keep the file short"
      ],
      answer: 0,
      why: "The explanation is what you are accountable for. What the script can do is guarantee that no material variance is ever missing from the list, which is exactly what a person writing at 7pm gets wrong." },

    { q: "The pack takes 39 ms and the command takes about three seconds. Where does the rest go?",
      options: [
        "Writing the output",
        "Starting Python and importing pandas",
        "The checks",
        "Reading the CSV files"
      ],
      answer: 1,
      why: "Import time dominates anything this small. It is worth knowing before optimising: for a monthly pack neither number matters, and speed was never the reason to automate it." },

    { q: "Why `.get(line, 0.0)` rather than joining the actual and budget frames?",
      options: [
        "pandas cannot join on strings",
        "It avoids duplicating the index",
        "Joins are slower",
        "A join drops the line that exists on only one side, and that line, CC600, is the interesting one"
      ],
      answer: 3,
      why: "An inner join is a decision to hide unmatched rows. In finance the unmatched row is usually the finding: a budget with no actuals is a team that was never hired." },

    { q: "What does an exit code of 1 from the pack script mean?",
      options: [
        "The pack did not tie or a gate was fatal, so nobody should send it",
        "The month was not found",
        "One check failed",
        "One row was dropped"
      ],
      answer: 0,
      why: "It is the automated form of the red check cell. A scheduler or a colleague can act on it without reading the output, which a spreadsheet cannot offer." },

    { q: "Why `dtype={\"account_code\": str}` when reading the CSV?",
      options: [
        "pandas cannot group by integers",
        "It is faster than inferring the type",
        "Read as a number, a code with a leading zero loses it and stops matching the other file",
        "Strings use less memory"
      ],
      answer: 2,
      why: "The day somebody adds account 0450, an inferred integer column turns it into 450 and the join quietly finds nothing." },

    { q: "The repair line reads \"0 duplicate journals removed\" this month, and \"1\" for the last six months. What is that?",
      options: [
        "A bug in the loader",
        "Proof that the accountant fixed the ledger",
        "Information: the export changed, and the change needs explaining before the numbers do",
        "Good news, and nothing to do"
      ],
      answer: 2,
      why: "It might be the fix, and it might be a different export with a different problem. A repair line that changes is a question, and asking it takes a minute." },

    { q: "A material variance is defined here as 25,000 or more. Where should that number live?",
      options: [
        "In the CSV file",
        "In one named constant, so the threshold is visible and changing it is one edit",
        "In each function that needs it",
        "Nowhere: judge each one by eye"
      ],
      answer: 1,
      why: "A threshold that lives in three places becomes three thresholds. Named once, it is also a thing you can argue about in a review, which is the point of writing it down." },

    { q: "What is the strongest argument for the script over the spreadsheet?",
      options: [
        "It produces nicer charts",
        "Finance teams prefer Python",
        "It can refuse to produce a number, and it does the same thing every month whoever runs it",
        "It is faster"
      ],
      answer: 2,
      why: "Speed is the weakest of the reasons. Repeatability and the ability to fail loudly are what a monthly process actually needs." }
  ],

  project: {
    title: 'close-pack: the pack, rebuilt as a program',
    story: 'It is the third working day. The ledger for September has landed, the plan has not moved since January, ' +
           'and the head of finance wants one page before Thursday. Produce it from the two files with one command. It has to refuse to print when something is wrong, say what it repaired, and ' +
           'leave the commentary to you.',
    scope: 'Python and pandas, as a small package with tests. No notebook, no Excel output, no database: the files ' +
           'are the input and the terminal is the output.',
    dataset: '{{RAW}}/data/fpa-actuals.csv',
    requirements: [
      'A package with load, checks, pack and report modules, and an __init__.py so it can be imported',
      'One loader that repairs text amounts, trims labels and removes duplicate journals, and reports the counts',
      'The sign rule applied exactly once, in the loader',
      'A mapping from account code to pack line and group, in one place',
      'The pack: revenue, cost of sales, gross profit, gross margin, operating expenses and EBITDA, actual against budget',
      'Variance signed so that positive is always favourable to profit',
      'The month as a command line argument, defaulting to 2025-09',
      'Fatal checks for an unmapped account, a missing month and an unreadable amount, which stop the run',
      'Warnings for a budgeted cost centre with no actuals and for anything the loader repaired',
      'A check that the pack ties to the ledger, printed every run, returned as the exit code',
      'A price and volume bridge that sums to the reported variance, with the rounding difference shown rather than hidden',
      'A waterfall chart from budget EBITDA to actual EBITDA, one bar per material variance',
      'A draft memo with the numbers filled in and the causes left as TODO',
      'Tests: at least one for the loader, one for the pack totals, one that proves the check cell catches a dropped line, and one for the merge trap'
    ],
    starter: {
      lang: 'python',
      code: '"""FinQuest analyst level 2: close-pack."""\nfrom pathlib import Path\nimport pandas as pd\n\nDATA = Path("data")          # or the {{RAW}} URL\n\nMAPPING = {\n    "4000": ("Transaction fees", "revenue"),\n    "4100": ("Subscription fees", "revenue"),\n    "4200": ("FX markup", "revenue"),\n    "5000": ("Scheme and interchange", "cogs"),\n    "5100": ("Cloud hosting", "cogs"),\n    "6000": ("Salaries", "opex"),\n    "6100": ("Marketing programmes", "opex"),\n    "6200": ("Facilities and admin", "opex"),\n    "7000": ("Depreciation", "below"),\n    "8000": ("Interest", "below"),\n    "9000": ("Tax", "below"),\n}\n\n\ndef to_number(value):\n    """(700,200.00) -> -700200.0, and 180,000.00 -> 180000.0"""\n    # TODO\n\n\ndef load_actuals(path=DATA / "fpa-actuals.csv"):\n    """Return the cleaned frame and a report of what was repaired."""\n    # TODO: dtype on account_code, repair amounts, trim labels,\n    #       drop duplicate journal ids and count them, apply the sign rule\n\n\ndef build(month="2025-09"):\n    """Return the pack: one row per line, plus totals and the tie check."""\n    # TODO\n\n\nif __name__ == "__main__":\n    # TODO: print the pack, print the check, exit non zero if it does not tie\n    pass\n'
    },
    tests: [
      'python -m closepack.pack prints the pack and exits 0',
      'The loader reports 1 duplicate removed, 2 text amounts repaired and 1 label trimmed',
      'September revenue is 3,361,050 and EBITDA is 265,989, matching the pack you built by hand',
      'Running with --month 2025-08 produces August with no other edit',
      'Removing a line from the layout makes the check cell non zero and the command exit 1',
      'An unmapped account code stops the run and names the code',
      'The CC600 warning appears and does not stop the run',
      'The bridge sums to the transaction fee variance, with any rounding difference under a dollar and shown',
      'The tests pass from a clean checkout with no manual setup'
    ],
    rubric: [
      { pts: 25, t: 'It ties', d: 'The pack agrees with the ledger, the check is printed every run and is the exit code.' },
      { pts: 20, t: 'It refuses', d: 'Fatal checks stop the run and name the problem; warnings do not. The split is defensible.' },
      { pts: 20, t: 'It is clean once', d: 'Repairs happen in the loader and are reported. Nothing downstream re-cleans anything.' },
      { pts: 20, t: 'It is tested', d: 'Tests cover the loader, the totals, the merge trap, and a check that is proven to fail when it should.' },
      { pts: 15, t: 'It is handed over', d: 'A README with the command, the numbers, and what the script deliberately does not do.' }
    ],
    stretch: [
      'Add a --compare flag that runs two months and shows what changed between them',
      'Add the invoice detail from level 1 and reconcile it to the ledger inside the same run',
      'Write the pack to an Excel file with openpyxl, and then decide honestly whether it is better than the printed one',
      'Make the script fetch the files from the repository URL rather than a local path, and handle being offline'
    ],
    solutionPath: 'solutions/fpa-02'
  },

  faq: [
    { q: 'Should I use a notebook?',
      a: 'To explore, yes. To produce something monthly, no. Cells run out of order, deleted code leaves its variables behind, and nothing in a notebook can be imported by a test. The moment a thing has to run again next month, it belongs in a file.' },
    { q: 'This took longer than doing it by hand.',
      a: 'The first month always does, by a lot. The return comes in month three, and it is mostly not the time: it is that the checks run every time, the month is an argument, and the thing cannot be half edited by somebody in a hurry.' },
    { q: 'How much pandas do I actually need?',
      a: 'read_csv, dtypes, map, groupby, merge with validate, sort_values, and the .str accessor. That is most of this level. The rest of the library can wait until you have a problem that needs it.' },
    { q: 'What about Polars, or DuckDB, or Excel with Power Query?',
      a: 'All fine, and all of them would work here. pandas is the one you will meet in job descriptions and in other people\'s code, so it is the one this track teaches. The ideas, clean once at the boundary and check before you publish, do not change with the tool.' },
    { q: 'My numbers match except for a few cents.',
      a: 'That is usually float arithmetic, and the fix is to round once when you present rather than repeatedly as you calculate. If it is more than a few cents, it is not rounding: check the duplicate, then check whether a SUMIFS-style filter is catching a row your script is not.' }
  ]
});
