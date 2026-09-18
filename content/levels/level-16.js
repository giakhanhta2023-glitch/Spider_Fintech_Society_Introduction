/* =========================================================================
   LEVEL 16: backtesting without fooling yourself
   ========================================================================= */
FQ.registerLevel({
  id: 16,
  codename: 'backtest',
  title: 'The backtest that does not lie to you',
  tagline: 'One line moved by one day turned a strategy that loses 26% into one that returns twenty one million percent. Every number in this level is measured, including that one.',
  difficulty: 9,
  minutes: 260,
  tags: ['backtesting', 'lookahead', 'costs', 'overfitting'],
  summary: 'Anybody can produce a rising equity curve. This level is about the four ways a backtest flatters itself, ' +
           'measured on the level 7 prices: lookahead, costs, survivorship and the parameter search. Then the honest ' +
           'alternative, walk forward, and the write up that says what would prove you wrong.',

  objectives: [
    'Shift a signal correctly and show what happens when you do not',
    'Model commission and slippage, and relate the damage to turnover',
    'Explain survivorship and selection bias in the data you were handed',
    'Search a parameter grid and measure how much of the best result was luck',
    'Run a walk forward test and report it instead of a single split',
    'Report the metrics that matter together rather than the one that looks best',
    'Write the paragraph naming what would falsify the strategy'
  ],

  knowledge: [
    { h: 'A backtest is a claim you cannot check' },
    { p: 'A backtest says: if I had run this, that would have happened. Nobody can verify it, the data is the only witness, ' +
         'and every mistake pushes the number the same direction, upward. That asymmetry is why this level exists, and it ' +
         'is why quant interviews spend more time on how you avoided fooling yourself than on what you built.' },
    { money: 'The single best answer to "tell me about a project" in a quant interview is a backtest with a written list of ' +
             'the biases it avoids and a number attached to each. It says you know what the job is.' },

    { h: 'Lookahead: the one line that decides everything' },
    { p: 'You can only act on what you knew. A signal computed from today\'s close is acted on with tomorrow\'s return, which ' +
         'in code is one `shift(1)` and in results is the difference between a strategy and a fantasy.' },
    { code: 'position = signal.shift(1)        # decided yesterday, applied today\nstrategy = position * returns', lang: 'python' },
    { p: 'Here is the measurement, on TECHX from the level 7 dataset. The rule is the simplest one there is: hold the asset ' +
         'when the daily return is positive.' },
    { table: {
      head: ['Rule', 'Total return over three years', 'Sharpe'],
      rows: [
        ['Decide using **today\'s** return, act **today**', '**+21,745,676%**', '**21.47**'],
        ['The same rule, shifted one day', '-26.05%', '-0.15']
      ]
    }},
    { p: 'The first row is not a good strategy. It is a machine that already knows the answer, and the giveaway is the ' +
         'Sharpe ratio: a real equity strategy lives between 0 and 2, so anything above about 3 is a bug until proven ' +
         'otherwise. A Sharpe of 21 is arithmetic telling you that you cheated.' },
    { check: {
      q: 'Your monthly rebalance uses each month\'s closing price to pick next month\'s holdings, and the code runs on the ' +
         'first of the month. Where is the lookahead, and is there any?',
      a: 'There is none, if the close is genuinely available before you trade. The test is not whether a date looks like it ' +
         'is in the past: it is whether the value was published before the moment you act on it. Month end closes are known ' +
         'that evening, so trading the next morning is honest. The same code with a fundamental like quarterly earnings is ' +
         'not, because those arrive weeks after the quarter they describe, and dating them to the quarter end gives your ' +
         'strategy a month of foresight that nobody had.'
    }},

    { h: 'Costs, and the turnover that decides them' },
    { p: 'Every trade pays. Commission is the visible part, the spread and slippage are the rest, and the total is usually ' +
         'quoted in basis points of the amount traded. How often you pay it decides how much it costs you.' },
    { code: 'turnover = position.diff().abs()               # 1.0 means fully in or out\nnet = gross - turnover * cost_bps / 10_000', lang: 'python' },
    { table: {
      head: ['Cost per trade', 'Daily flipper (248 turns a year)', 'Crossover (5.5 turns a year)'],
      rows: [
        ['0 bps', '-26.05%', '+33.26%'],
        ['2 bps', '-36.63%', ''],
        ['10 bps', '**-65.85%**', '+31.02%'],
        ['25 bps', '', '+27.72%'],
        ['50 bps', '', '**+22.38%**']
      ]
    }},
    { p: 'Read the two columns against each other. Ten basis points, which is a modest retail cost, takes the fast strategy ' +
         'from bad to catastrophic and barely touches the slow one. The same cost assumption is decisive for one and ' +
         'irrelevant for the other, and the thing that decides which is turnover.' },
    { check: {
      q: 'A strategy returns 14% a year gross, turns over its whole portfolio twice a week, and you cannot find anybody who ' +
         'will tell you the real cost. What do you do?',
      a: 'Solve for the cost that kills it. Two turns a week is about 200 a year, so each basis point of round trip cost ' +
         'takes roughly two percentage points a year off the return, which means the strategy stops making money somewhere ' +
         'around seven basis points. Then ask whether seven is plausible, and for most instruments it is not: spreads ' +
         'alone are wider than that. Reporting the break even cost is more useful than picking a number and defending it, ' +
         'because it turns an argument about assumptions into one number a reader can judge.'
    }},

    { h: 'The data you were handed is not the data that existed' },
    { p: 'Two biases live in the file rather than in your code, and neither is visible from inside it.' },
    { ul: [
      '**Survivorship**: a list of today\'s index members backtested over ten years contains only the companies that lasted. Every failure was removed from the file and from your result, and the effect is worth a percentage point or two a year on equity studies.',
      '**Selection**: the sample you were given because it is clean, free or convenient. Three years of four assets that all still trade, as in this course, is a demonstration set rather than evidence.'
    ]},
    { p: 'You cannot fix either with better code. You name them in the write up, and where it matters you buy or build a ' +
         'point in time universe that includes what has since been delisted.' },
    { warn: 'The level 7 dataset is synthetic, four assets, three years, all of them alive at the end. Any result on it is ' +
            'a demonstration of a method. Saying so is part of the exercise, and a reviewer who sees you say it will trust ' +
            'the rest of the document more, not less.' },

    { h: 'The parameter search that finds nothing' },
    { p: 'Here is the most common way a good engineer produces a bad strategy. Take the crossover, try every sensible pair ' +
         'of windows, keep the best. Seventy nine combinations, fitted on the first half of the sample and tested on the ' +
         'second, with ten basis points of cost.' },
    { table: {
      head: ['', 'First half (chosen on)', 'Second half (held out)'],
      rows: [
        ['Best combination, 30 and 80 days', '**Sharpe 2.18**', '**Sharpe -1.95**'],
        ['Median across all 79', 'Sharpe 1.58', 'Sharpe -1.10'],
        ['Correlation between the two columns', '', '**-0.57**']
      ]
    }},
    { p: 'The best in sample setting was the worst kind of lucky, and the correlation is **negative**: across this grid, ' +
         'doing better in the first half predicted doing worse in the second. None of the top five in sample beat the ' +
         'median out of sample.' },
    { p: 'That is not a quirk of this dataset. Search enough variations of anything on a finite sample and the winner is ' +
         'mostly noise, because you are choosing the combination that best fits the accidents of that particular history. ' +
         'The more combinations you try, the more certain that becomes.' },
    { check: {
      q: 'Somebody shows you a strategy with an in sample Sharpe of 2.4 and asks what you want to know. Give three ' +
         'questions, in order.',
      a: 'How many variations did you try before this one, because a Sharpe of 2.4 means one thing after two attempts and ' +
         'nothing after four hundred. What does it do on data you did not touch while choosing, and was that data really ' +
         'untouched. And what is the turnover and the assumed cost, because the answer to the first two is uninteresting if ' +
         'the strategy dies at five basis points. Notice that none of the three is about the strategy idea: the idea is ' +
         'the part that is easy to have.'
    }},

    { h: 'Walk forward instead of one split' },
    { p: 'A single split still bets everything on one period. Walk forward fits on a window, tests on the period ' +
         'immediately after, then rolls both forward, so every test period is genuinely out of sample and you get a series ' +
         'of results rather than one number.' },
    { code: 'fit    2023-01 .. 2023-12   test  2024-01 .. 2024-03\nfit    2023-04 .. 2024-03   test  2024-04 .. 2024-06\nfit    2023-07 .. 2024-06   test  2024-07 .. 2024-09\n...\nreport: the test periods, joined end to end', lang: 'text' },
    { ul: [
      '**Anchored** keeps the start fixed and lets the window grow. **Rolling** keeps the window a fixed length and drops the oldest data, which is right when you think the world changes.',
      'The result you report is the joined test periods, never the fits.',
      'How stable the chosen parameters are between folds matters as much as the returns. Windows that jump from 5 and 20 to 35 and 90 and back are telling you there is nothing to choose.'
    ]},
    { p: 'Walk forward does not make overfitting impossible. It makes it visible, because a strategy that only works when ' +
         'you get to pick the parameters afterwards will produce a series of mediocre test periods and one glorious fit.' },

    { h: 'One number is never the answer' },
    { p: 'Level 7 built the risk toolkit. A backtest report uses all of it, plus two that only exist when you are trading:' },
    { table: {
      head: ['Metric', 'Says'],
      rows: [
        ['CAGR', 'What it compounded at'],
        ['Sharpe', 'Return per unit of volatility. Above 3 on equities, suspect a bug'],
        ['Max drawdown', 'The worst moment, which is what decides whether anybody holds it'],
        ['Turnover', 'How often you pay costs, and therefore how fragile the result is'],
        ['Hit rate', 'Share of periods positive. Low with a good return means a few large wins'],
        ['Time in market', 'A strategy invested 12% of the time is not comparable to buy and hold'],
        ['Against a benchmark', 'Buy and hold returned 19.31% here with a 60.2% drawdown. Beat that, or say why not']
      ]
    }},
    { p: 'The crossover, correctly shifted and costed at ten basis points, returns 31.02% total against buy and hold\'s ' +
         '19.31%, with a maximum drawdown of 28.2% against 60.2%. The return is the smaller half of that comparison: the ' +
         'drawdown is what a person could actually live through.' },

    { h: 'Write down what would prove you wrong' },
    { p: 'Finish the report with the paragraph that separates research from marketing. It names the assumptions the result ' +
         'depends on and the observation that would end it.' },
    { ul: [
      'The cost assumption, and the break even cost at which the edge disappears.',
      'The sample: what is in it, what is missing, and what period it covers.',
      'How many variations were tried in total, including the ones you abandoned.',
      'What live performance would have to look like, and for how long, before you stopped.'
    ]},
    { check: {
      q: 'Your walk forward result is a Sharpe of 0.45 net of costs, which is worse than the single split you ran first. ' +
         'Which do you put in the report?',
      a: 'The walk forward, and the other one as well, with a sentence saying why they differ. The single split is a better ' +
         'number produced by a weaker method, and a reader who later discovers you ran both and reported the flattering one ' +
         'will not believe anything else in the document. Reporting the worse figure with the method that earned it is what ' +
         'makes the 0.45 worth reading at all.'
    }}
  ],

  tutorial: {
    intro: 'pandas and numpy, on the level 7 price file. The engine is deliberately small: signals, positions, costs, ' +
           'metrics. Everything in this tutorial is measurable on that data, and every number quoted in the level came ' +
           'from running it.',
    steps: [
      {
        t: 'Prices, returns, and a signal',
        blocks: [
          { code: 'import pandas as pd\nimport numpy as np\n\nURL = "{{RAW}}/data/level-07-prices.csv"\nprices = pd.read_csv(URL, parse_dates=["date"]).set_index("date")\nreturns = prices.pct_change().fillna(0)\n\ndef crossover(px, fast=20, slow=50):\n    """1 when the fast average is above the slow one, else 0."""\n    return (px.rolling(fast).mean() > px.rolling(slow).mean()).astype(int)', lang: 'python' }
        ],
        check: 'The signal is 0 until the slow window fills, then flips between 0 and 1.'
      },
      {
        t: 'The shift, and what it is worth',
        blocks: [
          { code: 'def run(returns, signal, cost_bps=10):\n    position = signal.shift(1).fillna(0)          # the whole level, in one line\n    gross = position * returns\n    turnover = position.diff().abs().fillna(0)\n    net = gross - turnover * cost_bps / 10_000\n    return pd.DataFrame({"position": position, "gross": gross,\n                         "turnover": turnover, "net": net})', lang: 'python' },
          { p: 'Then prove the shift matters. Run the same rule both ways and print the two totals side by side.' },
          { code: 'ret = returns["TECHX"]\ncheating = (np.sign(ret) * ret)                  # decided with today\'s own return\nhonest = (np.sign(ret).shift(1).fillna(0) * ret)\n\nfor name, series in [("cheating", cheating), ("honest", honest)]:\n    print(f"{name:<9} total {(1 + series).prod() - 1:>14.2%}")', lang: 'python' },
          { warn: 'You should see about +21,745,676% against about -26%. Keep that comparison in your README: it is the ' +
                  'most persuasive single thing in the project.' }
        ],
        check: 'The cheating version returns millions of percent and the honest one loses money, from the same rule.'
      },
      {
        t: 'Metrics, in one function',
        blocks: [
          { code: 'def metrics(daily, benchmark=None, periods=252):\n    total = (1 + daily).prod() - 1\n    years = len(daily) / periods\n    cagr = (1 + total) ** (1 / years) - 1\n    vol = daily.std() * np.sqrt(periods)\n    sharpe = (daily.mean() * periods) / vol if vol else np.nan\n    curve = (1 + daily).cumprod()\n    drawdown = (curve / curve.cummax() - 1).min()\n    hit = (daily > 0).mean()\n    out = {"total": total, "cagr": cagr, "sharpe": sharpe,\n           "max_drawdown": drawdown, "hit_rate": hit}\n    if benchmark is not None:\n        out["excess_total"] = total - ((1 + benchmark).prod() - 1)\n    return out', lang: 'python' },
          { tip: 'Print time in market and turnover next to these. A strategy flat two thirds of the time has a flattering ' +
                 'Sharpe and a fraction of the exposure, and comparing it to buy and hold without saying so is misleading.' }
        ],
        check: 'The 20/50 crossover, shifted and costed at 10 bps, gives about 31.02% total, Sharpe about 0.49, drawdown about -28%.'
      },
      {
        t: 'Cost sensitivity, not a cost assumption',
        blocks: [
          { code: 'for bps in (0, 2, 5, 10, 25, 50):\n    result = run(ret, crossover(prices["TECHX"]), cost_bps=bps)\n    m = metrics(result["net"])\n    print(f"{bps:>3} bps  total {m[\'total\']:>8.2%}  sharpe {m[\'sharpe\']:>5.2f}")', lang: 'python' },
          { p: 'Then find the cost at which the edge disappears and report that number. It is a single figure a reader can ' +
               'judge against reality, which an assumption never is.' },
          { code: 'def break_even_cost(returns, signal, hi=200):\n    for bps in range(0, hi):\n        if metrics(run(returns, signal, bps)["net"])["total"] <= 0:\n            return bps\n    return None', lang: 'python' }
        ],
        check: 'The table shows the crossover surviving 50 bps while the daily flipper dies before 10.'
      },
      {
        t: 'Search the grid, and measure the damage',
        blocks: [
          { code: 'half = len(prices) // 2\nrows = []\nfor fast in range(5, 41, 5):\n    for slow in range(20, 121, 10):\n        if fast >= slow:\n            continue\n        net = run(ret, crossover(prices["TECHX"], fast, slow))["net"]\n        rows.append({"fast": fast, "slow": slow,\n                     "in_sample": metrics(net[:half])["sharpe"],\n                     "out_sample": metrics(net[half:])["sharpe"]})\n\ngrid = pd.DataFrame(rows)\nbest = grid.sort_values("in_sample", ascending=False).iloc[0]\nprint(best)\nprint("correlation:", round(grid.in_sample.corr(grid.out_sample), 2))', lang: 'python' },
          { p: 'On this data: 79 combinations, the best in sample scores 2.18 and then -1.95 out of sample, and the ' +
               'correlation between the two columns is -0.57. Write those three numbers in your README under a heading that ' +
               'says what they mean.' }
        ],
        check: 'The grid reproduces those figures, and the best in sample parameters lose money out of sample.'
      },
      {
        t: 'Walk forward',
        blocks: [
          { code: 'def walk_forward(px, ret, fit_days=252, test_days=63, cost_bps=10):\n    """Fit the parameters on a window, test on the window after it, roll."""\n    results, chosen = [], []\n    start = 0\n    while start + fit_days + test_days <= len(px):\n        fit = slice(start, start + fit_days)\n        test = slice(start + fit_days, start + fit_days + test_days)\n\n        best, best_sharpe = None, -np.inf\n        for fast in range(5, 41, 5):\n            for slow in range(20, 121, 10):\n                if fast >= slow:\n                    continue\n                net = run(ret, crossover(px, fast, slow), cost_bps)["net"]\n                s = metrics(net.iloc[fit])["sharpe"]\n                if s > best_sharpe:\n                    best, best_sharpe = (fast, slow), s\n\n        net = run(ret, crossover(px, *best), cost_bps)["net"]\n        results.append(net.iloc[test])\n        chosen.append(best)\n        start += test_days\n\n    return pd.concat(results), chosen', lang: 'python' },
          { p: 'Report the joined test periods and the list of chosen parameters. If the choice jumps around between folds, ' +
               'say so: it is evidence that there is nothing to choose, and it is more useful than the return.' }
        ],
        check: 'Walk forward returns one series covering the test windows only, plus the parameters chosen in each fold.'
      },
      {
        t: 'The report',
        blocks: [
          { p: 'One function, one page of output, and the same shape every time so results are comparable.' },
          { code: 'def report(name, net, benchmark, turnover, cost_bps, tried):\n    m = metrics(net, benchmark)\n    print(f"{name}\\n" + "=" * len(name))\n    print(f"  total          {m[\'total\']:>9.2%}   benchmark {(1 + benchmark).prod() - 1:>9.2%}")\n    print(f"  CAGR           {m[\'cagr\']:>9.2%}")\n    print(f"  Sharpe         {m[\'sharpe\']:>9.2f}")\n    print(f"  max drawdown   {m[\'max_drawdown\']:>9.2%}")\n    print(f"  hit rate       {m[\'hit_rate\']:>9.2%}")\n    print(f"  turnover/yr    {turnover:>9.1f}")\n    print(f"  cost assumed   {cost_bps:>9} bps")\n    print(f"  variations tried {tried:>7}")', lang: 'python' },
          { tip: 'That last line is the one nobody prints and everybody should. It turns a Sharpe ratio into a claim with a ' +
                 'denominator.' }
        ],
        check: 'The report prints the same nine lines for any strategy, including how many variations were tried.'
      }
    ]
  },

  glossary: [
    { t: 'Backtest', d: 'A simulation of a strategy on historical data. Every mistake in one pushes the result upward.' },
    { t: 'Lookahead bias', d: 'Using information that was not available at the moment of the decision. Fixed with a shift, and worth millions of percent when it is not.' },
    { t: 'Signal and position', d: 'The signal is the decision, the position is what you hold. The position is the signal shifted.' },
    { t: 'Turnover', d: 'How much of the position changes. The multiplier on every cost assumption.' },
    { t: 'Basis point', d: 'One hundredth of a percent. Costs are quoted in these, and 10 bps is 0.1%.' },
    { t: 'Slippage', d: 'The gap between the price you assumed and the price you got. Part of the cost, and larger when you are in a hurry.' },
    { t: 'Break even cost', d: 'The cost per trade at which the edge disappears. More useful to report than an assumed cost.' },
    { t: 'Survivorship bias', d: 'Testing on the names that lasted, because the failures were removed from the file.' },
    { t: 'Selection bias', d: 'Testing on the sample you were given because it was convenient, and treating the result as evidence.' },
    { t: 'Overfitting', d: 'Choosing the variation that best fits the accidents of one sample. Guaranteed by a large enough search.' },
    { t: 'In sample and out of sample', d: 'The data used to choose, and the data used to judge. Only the second is evidence.' },
    { t: 'Walk forward', d: 'Fit on a window, test on the period after it, roll. Every test period is genuinely out of sample.' },
    { t: 'Anchored and rolling', d: 'A growing fit window against a fixed length one that drops the oldest data.' },
    { t: 'Hit rate', d: 'The share of periods that were positive. Low with a good return means a few large wins carried it.' },
    { t: 'Time in market', d: 'How much of the period the strategy was invested. Makes a comparison to buy and hold fair or unfair.' }
  ],

  quiz: [
    { q: "What does position = signal.shift(1) prevent?",
      options: [
        "Division by zero in the returns",
        "Acting on information you did not have yet",
        "Costs being double counted",
        "Trading on the last day of the sample"
      ],
      answer: 1,
      why: "Measured on this course's data: the same rule gives +21,745,676% unshifted and -26.05% shifted." },

    { q: "A backtest reports a Sharpe ratio of 21. What is the most likely explanation?",
      options: [
        "Costs were set too low",
        "Too little data",
        "Lookahead bias",
        "A very strong strategy"
      ],
      answer: 2,
      why: "Real equity strategies live between 0 and 2. Above about 3 is a bug until proven otherwise, and 21 is arithmetic telling you the model knew the answer." },

    { q: "Ten basis points of cost destroys one strategy and barely touches another. What decides which?",
      options: [
        "Turnover",
        "The Sharpe ratio",
        "The asset class",
        "The length of the sample"
      ],
      answer: 0,
      why: "248 turns a year against 5.5. The cost rate is the same; how often you pay it is not." },

    { q: "Why report the break even cost rather than the cost you assumed?",
      options: [
        "Because regulators require it",
        "Because it is always lower",
        "It is easier to compute",
        "Because it is a single number a reader can judge against reality, instead of an assumption to argue about"
      ],
      answer: 3,
      why: "It turns a debate about assumptions into one figure. A strategy that breaks even at seven basis points is dead for most instruments, and everybody can see that at once." },

    { q: "What is survivorship bias?",
      options: [
        "Keeping only the strategies that worked",
        "Overweighting recent data",
        "Ignoring dividends",
        "Testing on names that lasted, because the failures were removed from the data"
      ],
      answer: 3,
      why: "It lives in the file rather than in your code, and no amount of careful programming removes it. You need a point in time universe." },

    { q: "Seventy nine parameter combinations are tested. The best in sample scores Sharpe 2.18 and -1.95 out of sample, and the correlation between the two is -0.57. What does that say?",
      options: [
        "The out of sample period was unusual",
        "The best in sample result was mostly luck, and searching harder makes that more certain",
        "The parameters need finer steps",
        "The cost assumption was wrong"
      ],
      answer: 1,
      why: "None of the top five in sample beat the median out of sample. Choosing the best fit to one history is choosing its accidents." },

    { q: "What are the first three questions to ask about a strategy with an in sample Sharpe of 2.4?",
      options: [
        "Which library, which data vendor, and which language",
        "The maximum drawdown, the hit rate and the time in market",
        "How many variations were tried, what happened on untouched data, and what the turnover and cost are",
        "What is the idea, who else uses it, and how much capital it takes"
      ],
      answer: 2,
      why: "None of the three is about the idea. The idea is the part that is easy to have." },

    { q: "In walk forward testing, which periods go in the reported result?",
      options: [
        "All of it, fits and tests together",
        "The best fold",
        "The test periods only, joined end to end",
        "The fits, because they use more data"
      ],
      answer: 2,
      why: "Every test period is genuinely out of sample, which is what makes the joined series worth reading." },

    { q: "The parameters chosen by walk forward jump from 5 and 20 to 35 and 90 and back between folds. What does that tell you?",
      options: [
        "There is probably nothing to choose, and the parameter is noise",
        "The optimiser has a bug",
        "The market is changing quickly",
        "The fit window is too long"
      ],
      answer: 0,
      why: "Stability across folds is evidence. Instability is the absence of it, and it is worth more in a report than the return." },

    { q: "A strategy is invested 12% of the time and reports a Sharpe higher than buy and hold. What must the report say?",
      options: [
        "That it is riskier by definition",
        "Its time in market, so the comparison is fair",
        "Nothing extra, Sharpe already accounts for it",
        "The number of trades only"
      ],
      answer: 1,
      why: "Sitting in cash is not skill. Without exposure alongside it, the comparison flatters the strategy." },

    { q: "Why is maximum drawdown reported next to the return?",
      options: [
        "Because it determines the tax treatment",
        "Because regulators require it",
        "Because it is what decides whether anybody could hold the strategy through",
        "Because it is the same as volatility"
      ],
      answer: 2,
      why: "Level 7 made the point in money: the crossover here draws down 28% against buy and hold's 60%, and that difference matters more than the extra return." },

    { q: "Monthly rebalancing using quarterly earnings dated to the quarter end is:",
      options: [
        "Survivorship bias",
        "Fine, the date is in the past",
        "Only a problem for daily strategies",
        "Lookahead, because earnings are published weeks after the quarter they describe"
      ],
      answer: 3,
      why: "The test is whether the value was published before you act, not whether its timestamp looks historical." },

    { q: "What belongs in the write up that almost nobody includes?",
      options: [
        "How many variations were tried in total, including abandoned ones",
        "The Sharpe ratio",
        "The list of libraries used",
        "The equity curve"
      ],
      answer: 0,
      why: "It gives the Sharpe ratio a denominator. Without it the number means one thing after two attempts and nothing after four hundred." },

    { q: "Anchored walk forward differs from rolling in that:",
      options: [
        "Anchored keeps the start fixed and lets the fit window grow",
        "Anchored tests on the fit period",
        "Rolling cannot be used with daily data",
        "Rolling uses all history every time"
      ],
      answer: 0,
      why: "Rolling drops the oldest data, which is the right choice when you believe the world changes rather than accumulates." },

    { q: "Your walk forward Sharpe is worse than your single split Sharpe. What goes in the report?",
      options: [
        "The walk forward only",
        "Both, with a sentence explaining why they differ",
        "Whichever is closer to the benchmark",
        "The single split, since it used more data for fitting"
      ],
      answer: 1,
      why: "A reader who later finds you ran both and reported the flattering one will not believe anything else in the document." }
  ],

  project: {
    title: 'The backtest engine',
    story: 'The society\'s investment group keeps sharing screenshots of rising equity curves. Build the engine that ' +
           'settles it: one interface every strategy plugs into, costs, walk forward, and a report that says how many ' +
           'variations were tried and what cost would kill the result.',
    scope: 'Uses this level plus level 7 (returns, Sharpe, drawdown, correlation) and level 3 (pandas). pandas and numpy ' +
           'only. No backtesting library: the whole point is that you can see every line that touches a return.',
    dataset: '{{RAW}}/data/level-07-prices.csv',
    requirements: [
      'A Strategy interface: given prices, return a signal series. At least three implemented, including buy and hold',
      'run(returns, signal, cost_bps) applying the one day shift, computing turnover, and returning gross and net series',
      'A deliberate lookahead test comparing the shifted and unshifted version of one rule, with both numbers printed',
      'metrics() returning total, CAGR, Sharpe, max drawdown, hit rate, turnover per year and time in market',
      'A cost sensitivity table at 0, 2, 5, 10, 25 and 50 basis points for every strategy',
      'break_even_cost() returning the cost in basis points at which the total return reaches zero',
      'A parameter grid search reporting the best in sample result, its out of sample result, and the correlation across the grid',
      'walk_forward() with configurable fit and test windows, returning the joined test series and the parameters chosen per fold',
      'Every result compared against buy and hold on the same asset and period',
      'A report function printing the same fields for every strategy, including how many variations were tried',
      'A README with the lookahead comparison, the cost table, the grid result, and a paragraph naming what would falsify the strategy and what is wrong with the sample',
      'The repository in your GitHub portfolio as finquest-backtest'
    ],
    starter: {
      lang: 'python',
      code: '"""FinQuest level 16: the backtest engine.\n\nLayout:\n  engine/core.py       run, metrics, break_even_cost\n  engine/strategies.py buy_and_hold, crossover, momentum\n  engine/search.py     grid search and walk_forward\n  engine/report.py     one shape of output for every result\n  tests/\n"""\n\nimport numpy as np\nimport pandas as pd\n\nURL = "{{RAW}}/data/level-07-prices.csv"\n\n\ndef run(returns, signal, cost_bps=10):\n    """Shift the signal by one day, apply costs to turnover, return the series."""\n    # TODO\n    pass\n\n\ndef metrics(daily, benchmark=None, periods=252):\n    """total, cagr, sharpe, max_drawdown, hit_rate, and excess over a benchmark."""\n    # TODO\n    pass\n\n\ndef break_even_cost(returns, signal, hi=200):\n    """The cost in basis points at which the total return reaches zero."""\n    # TODO\n    pass\n\n\ndef grid_search(prices, returns, fasts, slows, cost_bps=10):\n    """In sample and out of sample Sharpe for every combination."""\n    # TODO\n    pass\n\n\ndef walk_forward(prices, returns, fit_days=252, test_days=63, cost_bps=10):\n    """Fit on a window, test on the next, roll. Return the joined test series."""\n    # TODO\n    pass\n'
    },
    tests: [
      'run() shifts the signal: a signal that is 1 on day t produces a position of 1 on day t+1',
      'A strategy that is always in matches buy and hold exactly at zero cost',
      'Turnover is 2.0 for a position that goes 0 to 1 to 0 over three days',
      'The unshifted version of the sign rule returns over one million percent and the shifted version loses money',
      'metrics() on the 20/50 crossover at 10 bps gives total near 31.02%, Sharpe near 0.49 and drawdown near -28%',
      'break_even_cost on the daily flipper is under 10 basis points',
      'The grid search over 79 combinations reproduces the best in sample Sharpe near 2.18 and its out of sample Sharpe near -1.95',
      'The correlation between in sample and out of sample Sharpe across the grid is negative',
      'walk_forward returns a series covering only the test windows, and one parameter pair per fold',
      'Every strategy report includes turnover, time in market and the count of variations tried'
    ],
    rubric: [
      { pts: 25, t: 'Honest mechanics', d: 'The shift is correct and tested, turnover is right, and costs are applied to turnover rather than to returns.' },
      { pts: 20, t: 'Bias demonstrated', d: 'The lookahead comparison is in the repository with both numbers, and the sample limitations are written down.' },
      { pts: 20, t: 'Overfitting measured', d: 'The grid search reports out of sample results and the correlation, rather than the best number.' },
      { pts: 20, t: 'Walk forward', d: 'Implemented, reported on test periods only, with the chosen parameters per fold shown.' },
      { pts: 15, t: 'Reported like research', d: 'One report shape, a benchmark on every result, the break even cost, and a paragraph on what would falsify it.' }
    ],
    stretch: [
      'Extend the engine to a portfolio of all four assets with weights, and report the diversification effect from level 7',
      'Add a volatility target that scales the position, and measure what it does to drawdown and turnover',
      'Implement a simple deflated Sharpe ratio that adjusts for the number of variations tried, and apply it to your grid',
      'Add a bootstrap: resample the returns a thousand times and report where the real result sits in that distribution'
    ],
    solutionPath: 'solutions/level-16'
  },

  faq: [
    { q: 'Why does shift(1) and not shift(-1)?',
      a: 'Because the position you hold today was decided from data available yesterday. shift(-1) pulls tomorrow into today, which is the bias this level is about, with a number attached.' },
    { q: 'Ten basis points: is that realistic?',
      a: 'For a liquid stock at retail scale, roughly. For a small illiquid one, nowhere near. This is why the level asks for a sensitivity table and a break even cost rather than one assumed figure.' },
    { q: 'My Sharpe is 4 and I cannot find the bug',
      a: 'Look for the future first: a rolling window that includes the current bar, a fill that reaches backwards, a merge on a date that aligns the wrong rows, or a signal built from a column derived after the fact.' },
    { q: 'Is the level 7 data good enough to draw conclusions from?',
      a: 'No, and saying so is part of the work. It is four synthetic assets over three years with no failures in it. The engine is the deliverable; the strategy result is a demonstration.' },
    { q: 'How many parameter combinations is too many?',
      a: 'There is no clean line, which is why you report the count. Two is a choice, four hundred is a search, and the reader can weigh a Sharpe ratio against the number of attempts that produced it.' },
    { q: 'Should I use a backtesting library in a job?',
      a: 'Probably, and you will be able to read what it does because you wrote the small version. The interview question is never which library; it is which bias you checked for.' },
    { q: 'What about intraday, or limit orders, or partial fills?',
      a: 'All real and all out of scope here. A daily close to close engine with honest costs is enough to learn the discipline, and the biases it teaches get worse rather than better at higher frequency.' }
  ]
});
