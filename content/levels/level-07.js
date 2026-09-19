/* =========================================================================
   LEVEL 7: Risk and return
   ========================================================================= */
FQ.registerLevel({
  id: 7,
  codename: 'risk desk',
  title: 'Risk and return',
  tagline: 'The best performer here also lost 89% of its value along the way. Your job is to report both numbers.',
  difficulty: 7,
  minutes: 180,
  tags: ['returns', 'volatility', 'Sharpe', 'drawdown'],
  summary: 'A return with no risk number attached is marketing. This level builds the standard risk toolkit (volatility, ' +
           'Sharpe, drawdown, correlation, VaR) on three years of daily prices, and shows why diversification is the ' +
           'only thing in finance that is genuinely free.',

  objectives: [
    'Compute simple returns from prices and compound them into an equity curve',
    'Explain the gap between arithmetic and geometric mean returns: volatility drag',
    'Annualize returns and volatility correctly (x252 and xsqrt(252))',
    'Compute and interpret the Sharpe ratio and maximum drawdown',
    'Use a correlation matrix to show why a portfolio is less volatile than its parts',
    'Estimate historical Value at Risk and state honestly what it cannot tell you'
  ],

  knowledge: [
    { h: 'Compare returns, not prices' },
    { p: 'This level\'s data is three years of daily prices, September 2022 to August 2025, for four made-up assets: a tech ' +
         'stock (TECHX), a bank (BANKCO), a gold fund (GOLDF) and a cryptocurrency (CRYPTOZ). On the first day TECHX cost ' +
         '$100.00 and CRYPTOZ cost $240.00. If one moves by $2 and the other by $5, which moved more?' },
    { p: 'You cannot tell from the dollars, because a $5 move on a $240 asset is smaller, relative to what you paid, than a ' +
         '$2 move on a $100 one. So everything in this level uses **returns**: the change in price as a share of the price ' +
         'you started from.' },
    { code: 'return = (price today - price yesterday) / price yesterday', lang: 'text' },
    { p: 'TECHX\'s first three days, worked by hand:' },
    { table: {
      head: ['Day', 'TECHX price', 'Return'],
      rows: [
        ['1 Sep 2022', '$100.00', 'none, there is no day before'],
        ['2 Sep', '$101.53', '(101.53 - 100.00) / 100.00 = **+1.53%**'],
        ['5 Sep', '$102.01', '(102.01 - 101.53) / 101.53 = **+0.47%**'],
        ['6 Sep', '$103.13', '(103.13 - 102.01) / 102.01 = **+1.10%**']
      ]
    }},
    { p: 'pandas does the whole table in one line, `prices.pct_change()` ("percentage change"). Notice the first row: there is ' +
         'no previous day, so its return is empty, `NaN`. `.dropna()` throws that row away. Forget it and the empty value leaks ' +
         'into every average you calculate afterwards.' },
    { code: 'returns = prices.pct_change().dropna()     # 782 prices become 781 daily returns', lang: 'python' },

    { h: 'Returns multiply, they do not add' },
    { p: 'Three days of +10%, then -10%, then +10% sounds like +10% overall. It is not. Each day\'s return applies to whatever ' +
         'you held when the previous day closed:' },
    { code: '$100 x 1.10 = $110.00     (+10%)\n$110 x 0.90 =  $99.00     (-10% of the bigger amount)\n $99 x 1.10 = $108.90     (+10%)\n\ntotal: +8.9%, not +10%', lang: 'text' },
    { p: 'So to find what your money grew to, you multiply `(1 + return)` day after day. The running result is called an ' +
         '**equity curve**: what $1 invested on the first day was worth on every day after. In pandas, `cumprod()` means ' +
         '"cumulative product", a running multiplication:' },
    { code: 'equity_curve = (1 + returns).cumprod()      # starts near 1.0, the $1 you put in', lang: 'python' },
    { check: {
      q: 'An asset rises 50% one day and falls 50% the next, so the average daily return is zero. A member put in $10,000. ' +
         'What do they hold, and what does the asset have to do next to make them whole?',
      a: '$7,500. The rise took $10,000 to $15,000, and the fall took half of the larger number away, which is $7,500 rather ' +
         'than the $5,000 the gain added. Getting back to $10,000 from $7,500 needs +33.3%, and if the asset had halved first ' +
         'it would need +100%. The average says flat, the member is down a quarter, and neither number is lying: they answer ' +
         'different questions. This is why you multiply returns rather than adding them.'
    }},

    { h: 'Two kinds of average, and the gap between them' },
    { p: 'There are two ways to describe how fast something grew, and they can disagree wildly:' },
    { ul: [
      '**The average return**: add up the 781 daily returns, divide by 781, and scale it to a year. It describes a typical day.',
      '**The compound annual growth rate, CAGR**: the single steady yearly rate that would take the first price to the last ' +
      'price over the same three years. It describes what actually happened to the money.'
    ]},
    { table: {
      head: ['Asset', '3-year total', 'Average, per year', 'CAGR', 'Volatility', 'Worst fall'],
      rows: [
        ['TECHX', '+19.3%', '11.2%', '5.9%', '31.4%', '-60.2%'],
        ['BANKCO', '+1.2%', '2.3%', '0.4%', '19.6%', '-33.5%'],
        ['GOLDF', '+4.7%', '2.5%', '1.5%', '14.1%', '-33.8%'],
        ['CRYPTOZ', '+21.3%', '**39.1%**', '**6.4%**', '73.4%', '**-88.6%**']
      ]
    }},
    { p: 'CRYPTOZ\'s average says 39.1% a year. Its price went from $240.00 to $291.17, which is 21.3% in total, or 6.4% a ' +
         'year. Both numbers are correct. The gap is called **volatility drag**, and you have already seen why it happens: a ' +
         'loss is taken from a bigger amount than the gain was added to, so wild swings eat into what you keep. The bigger ' +
         'the swings, the bigger the gap.' },
    { p: 'That is why professionals quote CAGR, and why an advert quoting an "average annual return" deserves a second look.' },
    { check: {
      q: 'A colleague sees 39.1% next to 6.4% for CRYPTOZ and says your code must have a bug. Use the other three rows of ' +
         'the table to show that it does not.',
      a: 'Line the gap up against the volatility. GOLDF swings 14.1% a year and its average sits 1.0 point above its CAGR. ' +
         'BANKCO at 19.6% is 1.9 points apart. TECHX at 31.4% is 5.4 points apart. CRYPTOZ at 73.4% is 32.6 points apart. The ' +
         'gap grows with the swings every time, in the same order, which is not what a bug looks like. It is the 50% up, 50% ' +
         'down example at scale: each loss is taken off a larger base than the matching gain was added to, and averaging the ' +
         'daily numbers throws that away.'
    }},
    { money: 'Two products can advertise the same "average return" and leave you with completely different amounts. The one ' +
             'that swings more leaves you with less. Always work out the compounded result yourself.' },

    { h: 'Volatility: how much it jumps around' },
    { p: 'Picture two assets that both average zero a day. One moves +1%, -1%, +1%, -1%. The other moves +5%, -5%, +5%, ' +
         '-5%. Same average, very different experience. **Volatility** is the number that tells them apart: it measures the ' +
         'typical size of a move, whichever direction it went.' },
    { p: 'Technically it is the **standard deviation** of the returns: how far, on average, each day lands from the average ' +
         'day. You do not need to calculate it by hand. `returns.std()` does it. What you need is the feel for it:' },
    { table: {
      head: ['Asset', 'Daily volatility', 'What that means'],
      rows: [
        ['GOLDF', '0.89%', 'A normal day moves it by about 0.9%'],
        ['BANKCO', '1.23%', 'About 1.2%'],
        ['TECHX', '1.98%', 'About 2%'],
        ['CRYPTOZ', '4.62%', 'About 4.6%, and its worst day in the sample was -12.5%']
      ]
    }},
    { p: 'Volatility is the industry\'s default measure of risk because it is easy to calculate and to combine across assets. ' +
         'It is not complete, and the next sections show what it misses.' },

    { h: 'Turning daily numbers into yearly ones: 252 and its square root' },
    { p: 'Nobody thinks in daily returns, so you convert to yearly figures, called **annualizing**. Stock markets are open ' +
         'about **252 days a year** (weekdays, minus holidays), so that is the number you scale by. But the two measures ' +
         'scale differently:' },
    { ul: [
      '**Average return** scales with the number of days: 252 days of a small gain add up to about 252 times as much.',
      '**Volatility** scales with the **square root** of the number of days, about 15.87. The ups and downs partly cancel ' +
      'each other out over a year, so the spread of yearly outcomes grows more slowly than the number of days.'
    ]},
    { code: 'annual_return = (1 + daily.mean()) ** 252 - 1\nannual_vol    = daily.std() * (252 ** 0.5)      # 252 ** 0.5 is about 15.87\n\n# GOLDF:  0.889% a day x 15.87 = 14.1% a year', lang: 'python' },
    { warn: 'Multiplying volatility by 252 instead of by the square root of 252 makes risk look about 16 times bigger. It is ' +
            'the most common mistake in first-time risk code.' },
    { check: {
      q: 'You annualize volatility with x252 instead of the square root of 252. GOLDF\'s daily standard deviation is 0.889%. ' +
         'What does your report say about it, and would you notice?',
      a: 'It says GOLDF has 224.0% yearly volatility, against the correct 14.1%. Its Sharpe ratio collapses from -0.03 to ' +
         'about 0.00, and every asset in the table does the same, so the ranking survives and nothing looks broken. You notice ' +
         'by reading the number out loud: 224% volatility means a gold fund swinging three times as hard as the crypto row. ' +
         'Checking a figure against the thing it describes catches mistakes that no test you thought to write would have ' +
         'caught.'
    }},

    { h: 'What volatility misses' },
    { p: 'Volatility has three blind spots worth knowing by heart:' },
    { ol: [
      '**It ignores direction.** A 5% gain and a 5% loss count the same, even though only one of them hurts.',
      '**It assumes the future looks like the past.** Three calm years say nothing certain about next year.',
      '**It underestimates extreme days.** The maths behind it assumes the familiar bell curve, where huge moves almost ' +
      'never happen. Real markets have **fat tails**: crashes happen far more often than the bell curve predicts. (The ' +
      'made-up data in this level is closer to the bell curve than real markets are, so real numbers will look worse.)'
    ]},
    { check: {
      q: 'Two assets both show 20% yearly volatility. One drifts upward with the occasional sharp fall, the other drifts ' +
         'downward with the occasional sharp rise. What does the volatility figure say about them?',
      a: 'That they are identical, because a standard deviation counts a move by its size and ignores which way it went. That ' +
         'is the whole limitation in one example. The compounded return says which way the drift ran, the worst fall says how ' +
         'deep the drops went, and the worst few days say how fat the tails are. Volatility describes the middle of the ' +
         'picture, and the part that drives people out of the market lives at the edges.'
    }},

    { h: 'The Sharpe ratio: reward for each unit of risk' },
    { p: 'A calm asset returning 8% and a wild one returning 20%: which is better? The **Sharpe ratio** puts them on the same ' +
         'scale by asking how much extra return you got for each unit of volatility you sat through.' },
    { p: '"Extra" means above the **risk-free rate**: what you could earn with no risk at all, such as by lending to the ' +
         'government for a few months. This level assumes 3% a year. Any return below that, you could have had for free.' },
    { code: 'Sharpe = (yearly return - risk-free rate) / yearly volatility\n\nTECHX:  (11.21% - 3%) / 31.43% = 0.26', lang: 'text' },
    { table: {
      head: ['Sharpe', 'What it means'],
      rows: [
        ['Below 0', 'You would have done better leaving the money somewhere safe'],
        ['0 to 0.5', 'Weak: a lot of stress for the reward'],
        ['0.5 to 1', 'Respectable'],
        ['1 to 2', 'Good'],
        ['Above 2', 'Excellent, or too little data, or something is wrong']
      ]
    }},
    { p: 'In this data CRYPTOZ has the highest Sharpe ratio, 0.49, **and** the worst fall, -88.6%. That is not a contradiction. ' +
         'It shows that no single number captures risk. A fall that deep would have made most real people sell near the ' +
         'bottom, and the Sharpe ratio has no way of saying so.' },
    { check: {
      q: 'A member is about to put their deposit into CRYPTOZ because it has the best Sharpe in the table. Which number do ' +
         'you put in front of them first, and in what units?',
      a: 'The worst fall, in their own money: $10,000 put in at the February 2024 peak was worth about $1,138 by July 2025, ' +
         'and needed a gain of 779% to get back to where it started. The Sharpe ratio is calculated as though the holder sat ' +
         'perfectly still for three years; the fall is the reason almost nobody does. Show the ratio second, and say plainly ' +
         'that it rewards an asset for going up violently as much as for going up steadily.'
    }},

    { h: 'Maximum drawdown: the number people actually feel' },
    { p: 'A **drawdown** is how far the value has fallen from the highest point it had reached so far. The **maximum ' +
         'drawdown** is the worst of those falls. For CRYPTOZ:' },
    { table: {
      head: ['', 'Date', 'Price'],
      rows: [
        ['Highest point', '15 Feb 2024', '$1,871.42'],
        ['Lowest point after it', '15 Jul 2025', '$213.05'],
        ['Fall', '', '**-88.6%**']
      ]
    }},
    { p: 'In code, you keep a running record of the highest value seen so far, `cummax()`, and compare each day against it:' },
    { code: 'curve    = (1 + returns).cumprod()\npeak     = curve.cummax()          # the highest value seen up to each date\ndrawdown = curve / peak - 1        # 0 at a new high, negative everywhere else\nmax_dd   = drawdown.min()          # the deepest point', lang: 'python' },
    { p: 'Volatility describes the whole ride; drawdown describes the worst moment of it. People give up on investments ' +
         'because of drawdowns, not because of standard deviations, which makes it the most honest risk number you can show ' +
         'a normal person.' },

    { h: 'Correlation: the only free lunch in finance' },
    { p: '**Correlation** measures whether two assets tend to move together. It runs from -1 to +1:' },
    { ul: [
      '**+1**: they always move in the same direction together.',
      '**0**: knowing what one did tells you nothing about the other.',
      '**-1**: they always move in opposite directions.'
    ]},
    { table: {
      head: ['Correlation in this data', 'TECHX', 'BANKCO', 'GOLDF', 'CRYPTOZ'],
      rows: [
        ['**TECHX**', '1.00', '0.51', '0.13', '0.51'],
        ['**BANKCO**', '0.51', '1.00', '0.15', '0.45'],
        ['**GOLDF**', '0.13', '0.15', '1.00', '0.16'],
        ['**CRYPTOZ**', '0.51', '0.45', '0.16', '1.00']
      ]
    }},
    { p: 'GOLDF barely moves with anything: its correlations are all near zero. On 48% of days, TECHX and GOLDF went in ' +
         'opposite directions.' },
    { p: 'Here is why that matters. A **portfolio** is a mix of assets held together. Put a quarter of your money in each of ' +
         'the four, and on the days one falls while another rises, the losses and gains partly cancel. The result:' },
    { code: 'average of the four volatilities:     34.6%\nvolatility of the 25% each mix:        27.1%', lang: 'text' },
    { p: 'A fifth less risk, for the same average return, just from holding things that do not move together. That is ' +
         '**diversification**, and it is called the only free lunch in finance because nothing else lowers risk without ' +
         'giving up return.' },
    { check: {
      q: 'The four volatilities average 34.6%, and holding all four equally gives 27.1%. Nobody sold anything and nothing ' +
         'was hedged. Where did 7.5 points of risk go?',
      a: 'Into the days the assets disagreed. On a day when TECHX falls 2% and GOLDF rises 1%, the mix moves less than ' +
         'either, and with a correlation of 0.13 between them that happens often. Adding up the size of each asset\'s moves ' +
         'overstates what the mix actually did, and the difference is the 7.5 points. GOLDF does most of the work because it ' +
         'moves least with everything else. Notice what did not change: the expected return is still the average of the ' +
         'parts. Less risk for the same return is why this is called the free lunch.'
    }},
    { warn: 'Correlations rise in a crisis. Assets that looked unrelated for years fall together on the worst day, which is ' +
            'exactly when you needed them not to. Never treat a past correlation as a promise.' },

    { h: 'Value at Risk, and what it will not tell you' },
    { p: 'Risk managers are often asked one question: "how much could we lose on a bad day?". **Value at Risk**, VaR, is the ' +
         'standard answer. Take the 781 daily returns of the 25% each mix and sort them from worst to best. The 95% VaR is ' +
         'the return 5% of the way up that list: 95% of days were better than it, 5% were worse.' },
    { code: 'var_95 = portfolio.quantile(0.05)     # -2.63%\n# "On 95% of days the loss was smaller than 2.63%."\n# 39 of the 781 days were worse.', lang: 'python' },
    { p: 'Now the famous problem. VaR tells you where the bad days **start**. It says nothing about how bad they get past that ' +
         'point. A day at -3% and a day at -40% are both just "worse than VaR". So you always report a second number, the ' +
         '**expected shortfall**: the average of the days that were worse than VaR. Here it is -3.35%, and the single worst ' +
         'day was -5.00%.' },
    { check: {
      q: 'The mix has a 95% VaR of -2.63% and an expected shortfall of -3.35%, and its worst day in the sample was -5.00%. A ' +
         'draft risk report says "we cannot lose more than 2.63% in a day". Correct it.',
      a: 'Everything after "cannot" is wrong. VaR is a threshold, not a maximum: on 95% of days the loss is smaller than ' +
         '2.63%, and about one day in twenty is worse, by an amount VaR says nothing about. On this sample those days average ' +
         '-3.35% and the worst was -5.00%, nearly double the figure the report called a limit. Write it as three numbers: the ' +
         'threshold, the average of the days past it, and the worst day seen. The last two are the ones that tell you what a ' +
         'bad day costs.'
    }},
    { money: 'VaR was at the centre of bank risk management going into 2008, and its silence about losses past the threshold ' +
             'is a documented part of why so many institutions were caught out. Report it, but never report it alone.' }
  ],

  tutorial: {
    intro: 'New notebook: `finquest-level-07.ipynb`. Three years of daily prices for four fictional assets, generated for ' +
           'this course. Every statistic below is reproducible from that file.',
    steps: [
      {
        t: 'Load prices with a date index',
        blocks: [
          { code: 'import pandas as pd\nimport numpy as np\n\nURL = "{{RAW}}/data/level-07-prices.csv"\nprices = pd.read_csv(URL, parse_dates=["date"]).set_index("date")\n\nprint(prices.shape)          # (782, 4)\nprint(prices.head(3))\nprint(prices.iloc[-1])       # last row: closing prices', lang: 'python' },
          { p: '`set_index("date")` makes the date the row label, so every column is an asset and pandas can align ' +
               'them by date automatically. `.iloc[-1]` is the last row by position.' }
        ],
        check: 'prices.shape is (782, 4) and the columns are TECHX, BANKCO, GOLDF, CRYPTOZ.'
      },
      {
        t: 'Returns and the equity curve',
        blocks: [
          { code: 'returns = prices.pct_change().dropna()\nprint(returns.shape)          # (781, 4): one row lost to the first day\n\ncurve = (1 + returns).cumprod()\nprint(curve.iloc[-1])         # growth of 1 unit over three years\n\ntotal_return = prices.iloc[-1] / prices.iloc[0] - 1\nprint((total_return * 100).round(1))', lang: 'python' },
          { p: 'The last row of the equity curve and the total return agree: two routes to the same number, which is a ' +
               'good habit for checking your own work.' }
        ],
        check: 'TECHX shows about +19.3% total and CRYPTOZ about +21.3%.'
      },
      {
        t: 'Annualize, and meet volatility drag',
        blocks: [
          { code: 'TRADING_DAYS = 252\n\nann_return = (1 + returns.mean()) ** TRADING_DAYS - 1     # arithmetic, annualized\nann_vol    = returns.std() * np.sqrt(TRADING_DAYS)        # sqrt, not 252\nyears      = len(returns) / TRADING_DAYS\ncagr       = (1 + total_return) ** (1 / years) - 1        # what you actually earned\n\nsummary = pd.DataFrame({\n    "total": total_return,\n    "ann_mean": ann_return,\n    "cagr": cagr,\n    "vol": ann_vol,\n})\nprint((summary * 100).round(1))', lang: 'python' },
          { p: 'Look at the `CRYPTOZ` row: an annualized mean of 39.1% next to a CAGR of 6.4%. The difference is entirely ' +
               'the cost of volatility. Report both, and lead with the CAGR.' }
        ],
        check: 'Your table shows CRYPTOZ at roughly 39% ann_mean, 6.4% CAGR and 73% volatility.'
      },
      {
        t: 'Sharpe ratio',
        blocks: [
          { code: 'RISK_FREE = 0.03      # 3% a year; state your assumption\n\nsharpe = (ann_return - RISK_FREE) / ann_vol\nprint(sharpe.round(2))\n#  TECHX 0.26   BANKCO -0.04   GOLDF -0.03   CRYPTOZ 0.49', lang: 'python' },
          { p: 'Two assets here have negative Sharpe ratios: over this period they returned less than a risk-free bill while ' +
               'still making their holders sit through a 33% drawdown. That is the sentence a risk report exists to produce.' },
          { tip: 'Always state the risk-free rate you used. A Sharpe ratio computed against 0% is not comparable with one ' +
                 'computed against 5%, and papers get this wrong constantly.' }
        ],
        check: 'You can name the highest-Sharpe asset and the two negative ones.'
      },
      {
        t: 'Drawdown, properly',
        blocks: [
          { code: 'def drawdown_series(returns_series):\n    """Drawdown from the running peak, as a negative fraction."""\n    curve = (1 + returns_series).cumprod()\n    peak = curve.cummax()\n    return curve / peak - 1\n\n\ndd = returns.apply(drawdown_series)\nprint((dd.min() * 100).round(1))        # max drawdown per asset\n\nworst_day = dd["CRYPTOZ"].idxmin()\nprint("CRYPTOZ deepest point:", worst_day.date())', lang: 'python' },
          { p: '`cummax` is the running maximum: the highest value seen *so far*, which is exactly what a peak is. ' +
               '`idxmin` returns the index label (here a date) of the minimum, not the value.' }
        ],
        check: 'Max drawdowns are about -60% TECHX, -33% BANKCO, -34% GOLDF, -89% CRYPTOZ.'
      },
      {
        t: 'Correlation and portfolio construction',
        blocks: [
          { code: 'print(returns.corr().round(2))\n\nweights = np.array([0.25, 0.25, 0.25, 0.25])\nport_returns = returns.dot(weights)          # weighted daily return\n\nport_ann = (1 + port_returns.mean()) ** 252 - 1\nport_vol = port_returns.std() * np.sqrt(252)\nprint(f"portfolio: {port_ann:.1%} return, {port_vol:.1%} vol")\nprint(f"average of the four vols: {ann_vol.mean():.1%}")', lang: 'python' },
          { p: '`returns.dot(weights)` multiplies each asset\'s return by its weight and sums across the row: the portfolio ' +
               'return for that day. The portfolio volatility (27.1%) coming in below the average of the parts (34.6%) ' +
               '**is** diversification, measured.' },
          { warn: 'Weights must sum to 1.0. Assert it: `assert abs(weights.sum() - 1) < 1e-9`. A silent 0.9 makes every ' +
                  'number in the report 10% too small.' }
        ],
        check: 'Your equally weighted portfolio shows about 12.9% return and 27.1% volatility.'
      },
      {
        t: 'VaR and expected shortfall',
        blocks: [
          { code: 'var_95 = port_returns.quantile(0.05)\nvar_99 = port_returns.quantile(0.01)\nes_95 = port_returns[port_returns <= var_95].mean()\n\nprint(f"VaR 95%: {var_95:.2%} per day")\nprint(f"VaR 99%: {var_99:.2%} per day")\nprint(f"Expected shortfall beyond VaR95: {es_95:.2%}")', lang: 'python' },
          { p: 'Expected shortfall is the average of the tail VaR refuses to describe. Reporting the pair: "95% of days ' +
               'you lose less than 2.6%, but on the bad days you average -3.4%", is far more honest than either alone.' }
        ],
        check: 'VaR95 is about -2.6% and expected shortfall is a meaningfully worse number.'
      },
      {
        t: 'Two charts that tell the story',
        blocks: [
          { code: 'import matplotlib.pyplot as plt\n\nfig, (ax1, ax2) = plt.subplots(2, 1, figsize=(10, 7), sharex=True)\n\ncurve.plot(ax=ax1)\nax1.set_title("Growth of 1 unit, three years")\nax1.set_ylabel("multiple of start")\nax1.axhline(1, color="grey", linewidth=0.8)\n\ndd.plot(ax=ax2)\nax2.set_title("Drawdown from running peak")\nax2.set_ylabel("drop")\nax2.axhline(0, color="grey", linewidth=0.8)\n\nplt.tight_layout()\nplt.show()', lang: 'python' },
          { p: 'Equity curve on top, drawdown underneath, sharing an x-axis: this pairing is the standard way every risk ' +
               'desk presents a strategy, because it shows the reward and the pain in the same glance.' },
          { tip: 'Consider a log scale (`ax1.set_yscale("log")`) when one series grows far more than the others: on a ' +
                 'linear axis the small movers become invisible.' }
        ],
        check: 'Two stacked charts render with titles, labels, and a zero line on the drawdown panel.'
      }
    ]
  },

  glossary: [
    { t: 'Simple return', d: 'P_today / P_yesterday - 1. The percentage change between two prices.' },
    { t: 'Equity curve', d: 'Cumulative product of (1 + returns): the value of one unit over time.' },
    { t: 'CAGR', d: 'Compound annual growth rate: the constant annual rate matching the actual total result.' },
    { t: 'Volatility drag', d: 'The gap between arithmetic mean return and compounded return, caused by swings.' },
    { t: 'Volatility', d: 'Standard deviation of returns, annualized by multiplying by sqrt(252).' },
    { t: 'Risk-free rate', d: 'Return on a near-zero-risk asset, used as the baseline in Sharpe.' },
    { t: 'Sharpe ratio', d: '(return - risk free) / volatility. Excess return per unit of risk.' },
    { t: 'Drawdown', d: 'Percentage fall from the running peak of the equity curve.' },
    { t: 'Max drawdown', d: 'The worst peak-to-trough fall in the period.' },
    { t: 'Correlation', d: 'How two return series move together, from -1 to +1.' },
    { t: 'Diversification', d: 'Combining imperfectly correlated assets so portfolio risk falls below the average of the parts.' },
    { t: 'VaR', d: 'Value at Risk: the loss threshold exceeded only x% of the time.' },
    { t: 'Expected shortfall', d: 'Average loss on the days that breach VaR. Describes the tail VaR ignores.' },
    { t: 'Fat tails', d: 'Extreme outcomes occurring far more often than a normal distribution implies.' }
  ],

  quiz: [
    { q: "Why is `.dropna()` needed after `prices.pct_change()`?",
      options: [
        "The first row has no previous price, so it is NaN and would poison every later statistic",
        "To remove negative returns",
        "To remove weekends",
        "Because pandas requires it before groupby"
      ],
      answer: 0,
      why: "pct_change cannot compute a change for the first row. A single NaN propagates through mean, std, and every downstream number." },

    { q: "Three consecutive daily returns of +10%, -10%, +10% give a total of:",
      options: [
        "+10%",
        "+33.1%",
        "+8.9%",
        "+30%"
      ],
      answer: 2,
      why: "1.1 x 0.9 x 1.1 = 1.089. Returns compound rather than add, which is why you use cumprod on (1 + r) instead of a sum." },

    { q: "How do you annualize daily volatility?",
      options: [
        "Multiply by sqrt(252)",
        "Divide by 252",
        "Multiply by 252",
        "Multiply by 365"
      ],
      answer: 0,
      why: "Variance scales with time, so standard deviation scales with its square root: about 15.87x. Using 252 overstates risk roughly sixteenfold." },

    { q: "CRYPTOZ has an annualized mean return of 39.1% but a CAGR of 6.4%. What explains the gap?",
      options: [
        "Inflation",
        "Trading fees",
        "Volatility drag, large swings make the compounded result fall short of the average",
        "A calculation error"
      ],
      answer: 2,
      why: "A 50% loss requires a 100% gain to recover. The bigger the swings, the further compounding lags the arithmetic mean, which is why CAGR is the honest headline." },

    { q: "What does the Sharpe ratio measure?",
      options: [
        "The probability of a loss",
        "Return above the risk-free rate per unit of volatility",
        "The worst drop from a peak",
        "Total return over the period"
      ],
      answer: 1,
      why: "It makes a calm 8% and a wild 20% comparable by dividing excess return by the volatility endured to earn it." },

    { q: "An asset has a Sharpe ratio of -0.04. What does that mean?",
      options: [
        "It returned less than the risk-free rate while still being volatile",
        "The calculation is invalid",
        "It lost money every day",
        "Its volatility was negative"
      ],
      answer: 0,
      why: "Negative Sharpe means cash would have beaten it. The holder took real risk (a 33% drawdown here) and was paid less than a government bill." },

    { q: "How is maximum drawdown calculated?",
      options: [
        "The standard deviation of negative returns",
        "The minimum of (equity curve / running peak - 1)",
        "The largest single-day loss",
        "The difference between the highest and lowest price"
      ],
      answer: 1,
      why: "Compare each point against the highest value seen so far (cummax) and take the worst result. It measures peak-to-trough pain, not one bad day." },

    { q: "Why is maximum drawdown often more useful than volatility when talking to an investor?",
      options: [
        "It describes the worst moment they would have lived through, which is what makes people sell",
        "It is required by regulators",
        "It is always smaller than volatility",
        "It is easier to compute"
      ],
      answer: 0,
      why: "Investors abandon strategies during drawdowns, not because of standard deviations. Drawdown is the most behaviourally honest single risk number." },

    { q: "CRYPTOZ has the highest Sharpe ratio and the worst drawdown (-88.6%). What does this show?",
      options: [
        "The Sharpe calculation must be wrong",
        "Drawdown is irrelevant when Sharpe is high",
        "No single ratio captures risk: Sharpe rewards average efficiency and says nothing about the worst path",
        "The asset is risk-free"
      ],
      answer: 2,
      why: "Sharpe uses the whole distribution symmetrically. An -88.6% fall would have removed most real investors from the strategy long before the recovery." },

    { q: "The four assets have an average individual volatility of 34.6%, and an equally weighted portfolio of them has 27.1%. Why?",
      options: [
        "Because equal weighting always reduces returns",
        "A calculation error, the portfolio must equal the average",
        "Because the portfolio has fewer observations",
        "Imperfect correlation: assets do not fall at the same moment, so the swings partly offset"
      ],
      answer: 3,
      why: "This is diversification, measured. Only perfectly correlated assets (+1) give a portfolio volatility equal to the weighted average." },

    { q: "Which asset contributes most to diversification in this dataset?",
      options: [
        "TECHX, because it has the highest return",
        "GOLDF, because its correlation with everything else is near zero",
        "CRYPTOZ, because it is the most volatile",
        "BANKCO, because it is a bank"
      ],
      answer: 1,
      why: "GOLDF correlates at 0.13-0.16 with the others, so it moves when they do not. Low correlation, not low volatility, is what diversifies." },

    { q: "What is the crucial caveat about historical correlations?",
      options: [
        "They cannot be computed on daily data",
        "They are always negative",
        "They tend to rise toward 1 in a crisis, exactly when diversification is needed",
        "They only apply to equities"
      ],
      answer: 2,
      why: "In a panic everything is sold at once. Portfolios built on calm-period correlations lose their protection on the day it matters most." },

    { q: "A daily VaR at 95% of -2.6% means:",
      options: [
        "You will lose 2.6% every day",
        "The maximum possible loss is 2.6%",
        "You have a 2.6% chance of losing everything",
        "On 95% of days the loss is smaller than 2.6%"
      ],
      answer: 3,
      why: "VaR is a threshold on the distribution, not a maximum and not a forecast. It is silent about how bad the other 5% of days get." },

    { q: "What does expected shortfall add to VaR?",
      options: [
        "A confidence interval on the estimate",
        "The average loss on the days that breach VaR: the size of the tail",
        "A longer time horizon",
        "An adjustment for inflation"
      ],
      answer: 1,
      why: "VaR gives the threshold; expected shortfall (CVaR) gives the average severity beyond it. Reporting only VaR hides the tail that actually causes failures." },

    { q: "Before computing a weighted portfolio return, what should you assert?",
      options: [
        "That there are exactly 252 observations",
        "That the assets are uncorrelated",
        "That all returns are positive",
        "That the weights sum to 1.0"
      ],
      answer: 3,
      why: "Weights summing to 0.9 silently scale every result down by 10% without any error being raised. A single assert line catches it immediately." }
  ],

  project: {
    title: 'Portfolio risk dashboard',
    story: 'The investment club holds four assets and argues about them every month with no data to hand. Build the ' +
           'risk report that settles it: what each one returned, what it cost in risk along the way, and whether the ' +
           'mix beats its parts.',
    scope: 'Uses this level plus level 3 (pandas) and level 2 (formatting): pct_change, cumprod, cummax, std, corr, dot, ' +
           'quantile, and matplotlib. Numpy is used only for sqrt and arrays.',
    dataset: '{{RAW}}/data/level-07-prices.csv',
    requirements: [
      '`load_prices(url)` returning a DataFrame indexed by date, with a shape check',
      '`compute_returns(prices)` returning daily simple returns with the first NaN row dropped',
      '`annualize(returns, trading_days=252)` returning annualized mean return and volatility (sqrt scaling)',
      '`cagr(prices)` computing the true compounded annual growth rate from first and last prices',
      '`sharpe(ann_return, ann_vol, risk_free=0.03)` with the risk-free rate stated in the output',
      '`drawdown_series(returns)` and `max_drawdown(returns)` built from the running peak',
      '`asset_table(prices)` producing one row per asset with total return, ann mean, CAGR, volatility, Sharpe, and max drawdown',
      'Your table must show the volatility-drag gap between ann mean and CAGR for CRYPTOZ',
      '`correlation_matrix(returns)` rounded to two decimals',
      '`portfolio_returns(returns, weights)` that asserts the weights sum to 1.0',
      '`portfolio_stats(...)` reporting return, volatility, Sharpe, max drawdown, VaR95, VaR99 and expected shortfall',
      'A `diversification_check(...)` comparing portfolio volatility against the weighted average of individual volatilities, printing the benefit',
      'Compare at least three weightings (equal weight, a no-crypto mix, and one of your own) in a single table',
      'Two stacked charts sharing an x-axis: equity curves and drawdowns, fully labelled',
      'A written conclusion naming which weighting you would recommend, with the numbers behind it and an explicit statement of what your analysis cannot tell you',
      'Saved to your portfolio repo as `level-07-risk-dashboard.ipynb`'
    ],
    starter: {
      lang: 'python',
      code: '"""FinQuest level 7: Portfolio risk dashboard"""\n\nimport numpy as np\nimport pandas as pd\nimport matplotlib.pyplot as plt\n\nURL = "{{RAW}}/data/level-07-prices.csv"\nTRADING_DAYS = 252\nRISK_FREE = 0.03          # state your assumption, always\n\n\ndef load_prices(url=URL):\n    """Date-indexed price DataFrame."""\n    # TODO\n    pass\n\n\ndef compute_returns(prices):\n    """Daily simple returns, first row dropped."""\n    # TODO\n    pass\n\n\ndef annualize(returns, trading_days=TRADING_DAYS):\n    """Return (ann_mean_return, ann_volatility). Remember sqrt for vol."""\n    # TODO\n    pass\n\n\ndef cagr(prices):\n    """Compounded annual growth rate from first to last price."""\n    # TODO\n    pass\n\n\ndef sharpe(ann_return, ann_vol, risk_free=RISK_FREE):\n    # TODO\n    pass\n\n\ndef drawdown_series(returns_series):\n    """Drawdown from the running peak, as a negative fraction."""\n    # TODO\n    pass\n\n\ndef max_drawdown(returns_series):\n    # TODO\n    pass\n\n\ndef asset_table(prices):\n    """One row per asset: total, ann_mean, cagr, vol, sharpe, max_dd."""\n    # TODO\n    pass\n\n\ndef correlation_matrix(returns):\n    # TODO\n    pass\n\n\ndef portfolio_returns(returns, weights):\n    """Weighted daily returns. Assert the weights sum to 1."""\n    # TODO\n    pass\n\n\ndef portfolio_stats(returns, weights, label="portfolio"):\n    """Return + vol + sharpe + max_dd + VaR95 + VaR99 + expected shortfall."""\n    # TODO\n    pass\n\n\ndef diversification_check(returns, weights):\n    """Portfolio vol vs weighted average of individual vols."""\n    # TODO\n    pass\n\n\ndef plot_dashboard(returns):\n    """Equity curves above, drawdowns below, shared x-axis."""\n    # TODO\n    pass\n\n\ndef report():\n    # TODO\n    pass\n\n\nif __name__ == "__main__":\n    report()\n'
    },
    tests: [
      'prices.shape is (782, 4); returns.shape is (781, 4)',
      'Total returns: TECHX +19.3%, BANKCO +1.2%, GOLDF +4.7%, CRYPTOZ +21.3% (to 0.1%)',
      'Annualized volatility: TECHX 31.4%, BANKCO 19.6%, GOLDF 14.1%, CRYPTOZ 73.4%',
      'CRYPTOZ annualized mean is about 39.1% while its CAGR is about 6.4% (using years = rows / 252), the drag must be visible in your table',
      'Sharpe at 3% risk-free: TECHX 0.26, BANKCO -0.04, GOLDF -0.03, CRYPTOZ 0.49',
      'Max drawdowns: TECHX -60.2%, BANKCO -33.5%, GOLDF -33.8%, CRYPTOZ -88.6%',
      'GOLDF correlates below 0.2 with every other asset',
      'Equally weighted portfolio: about 12.9% annualized return, 27.1% volatility, Sharpe 0.36, max drawdown -56.9%',
      'Average individual volatility is 34.6%, so the diversification benefit is roughly 7.5 percentage points',
      'Equal-weight VaR95 is about -2.63% daily, VaR99 about -3.79%, and expected shortfall beyond VaR95 about -3.35%',
      'portfolio_returns raises AssertionError when given weights that sum to 0.9'
    ],
    rubric: [
      { pts: 25, t: 'Correct statistics', d: 'Every number in the test list reproduced, with sqrt(252) scaling applied properly.' },
      { pts: 20, t: 'Risk beyond return', d: 'Drawdown, VaR and expected shortfall all present and correctly interpreted in words.' },
      { pts: 20, t: 'Diversification argument', d: 'Correlation matrix plus a quantified comparison of portfolio vol against the average of the parts.' },
      { pts: 15, t: 'Charts', d: 'Stacked equity and drawdown panels, shared axis, labelled, readable.' },
      { pts: 10, t: 'Honest conclusion', d: 'A recommendation with numbers, and an explicit statement of the analysis\'s limits.' },
      { pts: 10, t: 'Shipped', d: 'Runs top to bottom in a fresh session and is committed to your portfolio repo.' }
    ],
    stretch: [
      'Add a 60-day rolling volatility chart and mark the most turbulent period',
      'Find the minimum-variance weights by grid search over combinations that sum to 1',
      'Add a rebalancing comparison: monthly rebalanced equal weight vs buy-and-hold drift',
      'Compute the Sortino ratio (downside deviation only) and explain where it disagrees with Sharpe'
    ],
    solutionPath: 'solutions/level-07'
  },

  faq: [
    { q: 'My volatility numbers are enormous',
      a: 'You multiplied by 252 instead of sqrt(252). Volatility scales with the square root of time because variance, not standard deviation, adds.' },
    { q: 'Everything is NaN',
      a: 'You skipped.dropna() after pct_change, so the first row of NaNs propagated into every statistic. Drop it immediately after computing returns.' },
    { q: 'Why does my CAGR differ from the annualized mean?',
      a: 'It should. The annualized arithmetic mean ignores compounding; CAGR reflects it. The gap is volatility drag and is largest for the most volatile asset.' },
    { q: 'My Sharpe ratios look wrong',
      a: 'Check three things: the risk-free rate you subtracted, that volatility is annualized with sqrt(252), and that return and volatility are on the same annual basis.' },
    { q: 'How do I compute drawdown?',
      a: 'curve = (1 + returns).cumprod(); peak = curve.cummax(); drawdown = curve / peak - 1. Maximum drawdown is the minimum of that series.' },
    { q: 'My portfolio numbers look 10% too small',
      a: 'Your weights probably do not sum to 1.0. Assert it before using them: assert abs(sum(weights) - 1) < 1e-9.' },
    { q: 'Is a high Sharpe always better?',
      a: 'No. In this dataset the highest-Sharpe asset also fell 88.6% peak to trough. Report Sharpe alongside drawdown and tail risk, never alone.' }
  ]
});
