/* =========================================================================
   LEVEL 7 — Risk & Return
   ========================================================================= */
FQ.registerLevel({
  id: 7,
  codename: 'RISK DESK',
  title: 'Risk & Return',
  tagline: 'The asset with the best return in this dataset also lost 89% of its value. Learn to say both things at once.',
  difficulty: 7,
  minutes: 180,
  tags: ['returns', 'volatility', 'Sharpe', 'drawdown'],
  summary: 'A return with no risk number attached is marketing. This level builds the standard risk toolkit — volatility, ' +
           'Sharpe, drawdown, correlation, VaR — on three years of daily prices, and shows why diversification is the ' +
           'only thing in finance that is genuinely free.',

  objectives: [
    'Compute simple returns from prices and compound them into an equity curve',
    'Explain the gap between arithmetic and geometric mean returns — volatility drag',
    'Annualize returns and volatility correctly (x252 and xsqrt(252))',
    'Compute and interpret the Sharpe ratio and maximum drawdown',
    'Use a correlation matrix to show why a portfolio is less volatile than its parts',
    'Estimate historical Value at Risk and state honestly what it cannot tell you'
  ],

  knowledge: [
    { h: 'From prices to returns' },
    { p: 'Prices are not comparable across assets — a $10 move means something different for a $50 stock than a $500 one. ' +
         '**Returns** are. The simple return between two days is:' },
    { code: 'r = (P_today - P_yesterday) / P_yesterday      # or  P_today / P_yesterday - 1\n\npandas: returns = prices.pct_change().dropna()', lang: 'python' },
    { p: 'The first row is always empty — there is no previous day — so `.dropna()` is not optional. Forgetting it puts a ' +
         '`NaN` into every statistic that follows.' },
    { p: 'Returns **compound**, they do not add. Three days of +10%, -10%, +10% is not +10%: it is ' +
         '`1.1 x 0.9 x 1.1 = 1.089`, or +8.9%. That is why you multiply `(1 + r)` and take a cumulative product to ' +
         'reconstruct value over time.' },
    { code: 'equity_curve = (1 + returns).cumprod()      # 1.0 = your starting money', lang: 'python' },

    { h: 'Volatility drag: why the mean lies' },
    { p: 'Take the four assets in this level\'s dataset. `CRYPTOZ` has by far the best **average** daily return — annualized, ' +
         'it looks like 39% a year. Over the actual three years it returned **21.3% in total** — about 6.4% a year compounded.' },
    { table: {
      head: ['Asset', '3-year total', 'Annualized mean', 'Compound (CAGR)', 'Volatility', 'Max drawdown'],
      rows: [
        ['TECHX', '+19.3%', '11.2%', '5.9%', '31.4%', '-60.2%'],
        ['BANKCO', '+1.2%', '2.3%', '0.4%', '19.6%', '-33.5%'],
        ['GOLDF', '+4.7%', '2.5%', '1.5%', '14.1%', '-33.8%'],
        ['CRYPTOZ', '+21.3%', '**39.1%**', '**6.4%**', '73.4%', '**-88.6%**']
      ]
    }},
    { p: 'The gap between 39.1% and 6.4% is **volatility drag**. A 50% loss needs a 100% gain to recover; the bigger the ' +
         'swings, the further the compounded result falls behind the average. This is not a quirk of the dataset — it is ' +
         'arithmetic, and it is why professionals quote CAGR and why "average annual return" in an advert deserves suspicion.' },
    { money: 'Two products can advertise the same "average return" and deliver completely different outcomes. ' +
             'The one that swings more delivers less. Always compute the compounded result yourself.' },

    { h: 'Annualizing: 252 and the square root of 252' },
    { p: 'Markets trade about **252 days a year**. Mean daily return scales by 252; volatility scales by the *square root* ' +
         'of 252, because variance adds over time while standard deviation is its square root.' },
    { code: 'annual_return = (1 + daily.mean()) ** 252 - 1\nannual_vol    = daily.std() * (252 ** 0.5)      # about 15.87 x', lang: 'python' },
    { warn: 'Multiplying volatility by 252 instead of sqrt(252) overstates risk by a factor of ~16. It is the most common ' +
            'error in first-time risk code, and it produces Sharpe ratios that look absurdly small.' },

    { h: 'Volatility is risk, but only one kind of it' },
    { p: '**Volatility** is the standard deviation of returns: how widely they scatter around the average. High volatility ' +
         'means the outcome is uncertain in both directions. It is the industry default because it is easy to compute and ' +
         'aggregate — not because it is complete.' },
    { p: 'What volatility misses: it treats a 5% gain and a 5% loss as equally bad, it assumes the future looks like the ' +
         'past, and it badly underestimates the frequency of extreme days. Real markets have **fat tails**: crashes happen ' +
         'far more often than a normal distribution predicts.' },

    { h: 'Sharpe ratio: return per unit of risk' },
    { code: 'Sharpe = (annual_return - risk_free_rate) / annual_volatility', lang: 'text' },
    { p: 'The Sharpe ratio asks: for every unit of volatility you endured, how much return above a risk-free government ' +
         'bill did you receive? It makes a calm 8% and a wild 20% comparable.' },
    { table: {
      head: ['Sharpe', 'Reading'],
      rows: [
        ['< 0', 'You would have done better in cash'],
        ['0 – 0.5', 'Weak — a lot of stress for the reward'],
        ['0.5 – 1', 'Respectable'],
        ['1 – 2', 'Good'],
        ['> 2', 'Excellent, or a short sample, or something is wrong']
      ]
    }},
    { p: 'In this dataset `CRYPTOZ` has the highest Sharpe (0.49) *and* the worst drawdown (-88.6%). That is not a ' +
         'contradiction — it shows that one ratio never captures risk on its own. A drawdown that deep would have ' +
         'forced most real investors to sell at the bottom, and no Sharpe ratio tells you that.' },

    { h: 'Maximum drawdown: the number people actually feel' },
    { p: 'Drawdown is the drop from the highest point reached so far. Maximum drawdown is the worst of them — how much of ' +
         'your money disappeared between a peak and the following trough.' },
    { code: 'curve    = (1 + returns).cumprod()\npeak     = curve.cummax()          # highest value seen up to each date\ndrawdown = curve / peak - 1        # always <= 0\nmax_dd   = drawdown.min()', lang: 'python' },
    { p: 'Volatility describes the ride; drawdown describes the worst moment of it. Investors abandon strategies because ' +
         'of drawdowns, not because of standard deviations, which makes it the most behaviourally honest risk measure you can show.' },

    { h: 'Correlation: the only free lunch' },
    { p: 'Correlation runs from -1 (opposite) through 0 (unrelated) to +1 (identical). Combining assets that are not ' +
         'perfectly correlated produces a portfolio **less volatile than the weighted average of its parts** — extra return ' +
         'per unit of risk, from nothing but arrangement.' },
    { table: {
      head: ['Correlation in this dataset', 'TECHX', 'BANKCO', 'GOLDF', 'CRYPTOZ'],
      rows: [
        ['**TECHX**', '1.00', '0.51', '0.13', '0.51'],
        ['**BANKCO**', '0.51', '1.00', '0.15', '0.45'],
        ['**GOLDF**', '0.13', '0.15', '1.00', '0.16'],
        ['**CRYPTOZ**', '0.51', '0.45', '0.16', '1.00']
      ]
    }},
    { p: 'The average of the four individual volatilities is **34.6%**. An equal-weight portfolio of all four has a ' +
         'volatility of **27.1%** — a fifth less risk for the same average exposure. `GOLDF` is doing most of that work: ' +
         'its correlations are near zero, so it moves when the others do not.' },
    { warn: 'Correlations rise in a crisis. Assets that looked independent for years fall together on the worst day, ' +
            'which is precisely when you needed the diversification. Never treat a historical correlation as a guarantee.' },

    { h: 'Value at Risk, and its famous limitation' },
    { p: '**Historical VaR** asks: on the worst 5% of days, how much did I lose? It is a percentile of the return distribution.' },
    { code: 'var_95 = returns.quantile(0.05)     # e.g. -2.63% for this equal-weight portfolio\n# "On 95% of days I lose less than 2.63%."', lang: 'python' },
    { p: 'The limitation is what it refuses to say: VaR tells you the *threshold*, never how bad it gets **beyond** it. ' +
         'A day at -3% and a day at -40% are both simply "worse than VaR". The fix is **Expected Shortfall** (or CVaR): ' +
         'the average loss on the days that breach VaR.' },
    { money: 'VaR was central to risk management going into 2008, and its blindness past the threshold is a documented ' +
             'part of why so many institutions were surprised. Report it — but never report it alone.' }
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
          { code: 'returns = prices.pct_change().dropna()\nprint(returns.shape)          # (781, 4) — one row lost to the first day\n\ncurve = (1 + returns).cumprod()\nprint(curve.iloc[-1])         # growth of 1 unit over three years\n\ntotal_return = prices.iloc[-1] / prices.iloc[0] - 1\nprint((total_return * 100).round(1))', lang: 'python' },
          { p: 'The last row of the equity curve and the total return agree — two routes to the same number, which is a ' +
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
          { p: '`cummax` is the running maximum — the highest value seen *so far*, which is exactly what a peak is. ' +
               '`idxmin` returns the index label (here a date) of the minimum, not the value.' }
        ],
        check: 'Max drawdowns are about -60% TECHX, -33% BANKCO, -34% GOLDF, -89% CRYPTOZ.'
      },
      {
        t: 'Correlation and portfolio construction',
        blocks: [
          { code: 'print(returns.corr().round(2))\n\nweights = np.array([0.25, 0.25, 0.25, 0.25])\nport_returns = returns.dot(weights)          # weighted daily return\n\nport_ann = (1 + port_returns.mean()) ** 252 - 1\nport_vol = port_returns.std() * np.sqrt(252)\nprint(f"portfolio: {port_ann:.1%} return, {port_vol:.1%} vol")\nprint(f"average of the four vols: {ann_vol.mean():.1%}")', lang: 'python' },
          { p: '`returns.dot(weights)` multiplies each asset\'s return by its weight and sums across the row — the portfolio ' +
               'return for that day. The portfolio volatility (27.1%) coming in below the average of the parts (34.6%) ' +
               '**is** diversification, measured.' },
          { warn: 'Weights must sum to 1.0. Assert it: `assert abs(weights.sum() - 1) < 1e-9`. A silent 0.9 makes every ' +
                  'number in the report 10% too small.' }
        ],
        check: 'Your equal-weight portfolio shows about 12.9% return and 27.1% volatility.'
      },
      {
        t: 'VaR and expected shortfall',
        blocks: [
          { code: 'var_95 = port_returns.quantile(0.05)\nvar_99 = port_returns.quantile(0.01)\nes_95 = port_returns[port_returns <= var_95].mean()\n\nprint(f"VaR 95%: {var_95:.2%} per day")\nprint(f"VaR 99%: {var_99:.2%} per day")\nprint(f"Expected shortfall beyond VaR95: {es_95:.2%}")', lang: 'python' },
          { p: 'Expected shortfall is the average of the tail VaR refuses to describe. Reporting the pair — "95% of days ' +
               'you lose less than 2.6%, but on the bad days you average -3.4%" — is far more honest than either alone.' }
        ],
        check: 'VaR95 is about -2.6% and expected shortfall is a meaningfully worse number.'
      },
      {
        t: 'Two charts that tell the story',
        blocks: [
          { code: 'import matplotlib.pyplot as plt\n\nfig, (ax1, ax2) = plt.subplots(2, 1, figsize=(10, 7), sharex=True)\n\ncurve.plot(ax=ax1)\nax1.set_title("Growth of 1 unit — three years")\nax1.set_ylabel("multiple of start")\nax1.axhline(1, color="grey", linewidth=0.8)\n\ndd.plot(ax=ax2)\nax2.set_title("Drawdown from running peak")\nax2.set_ylabel("drop")\nax2.axhline(0, color="grey", linewidth=0.8)\n\nplt.tight_layout()\nplt.show()', lang: 'python' },
          { p: 'Equity curve on top, drawdown underneath, sharing an x-axis: this pairing is the standard way every risk ' +
               'desk presents a strategy, because it shows the reward and the pain in the same glance.' },
          { tip: 'Consider a log scale (`ax1.set_yscale("log")`) when one series grows far more than the others — on a ' +
                 'linear axis the small movers become invisible.' }
        ],
        check: 'Two stacked charts render with titles, labels, and a zero line on the drawdown panel.'
      }
    ]
  },

  glossary: [
    { t: 'Simple return', d: 'P_today / P_yesterday - 1. The percentage change between two prices.' },
    { t: 'Equity curve', d: 'Cumulative product of (1 + returns): the value of one unit over time.' },
    { t: 'CAGR', d: 'Compound annual growth rate — the constant annual rate matching the actual total result.' },
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
        "Volatility drag — large swings make the compounded result fall short of the average",
        "A calculation error"
      ],
      answer: 2,
      why: "A 50% loss requires a 100% gain to recover. The bigger the swings, the further compounding lags the arithmetic mean — which is why CAGR is the honest headline." },

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
      why: "Negative Sharpe means cash would have beaten it. The holder took real risk — a 33% drawdown here — and was paid less than a government bill." },

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
        "No single ratio captures risk — Sharpe rewards average efficiency and says nothing about the worst path",
        "The asset is risk-free"
      ],
      answer: 2,
      why: "Sharpe uses the whole distribution symmetrically. An -88.6% fall would have removed most real investors from the strategy long before the recovery." },

    { q: "The four assets have an average individual volatility of 34.6%, and an equal-weight portfolio of them has 27.1%. Why?",
      options: [
        "Because equal weighting always reduces returns",
        "A calculation error — the portfolio must equal the average",
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
        "The average loss on the days that breach VaR — the size of the tail",
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
      why: "Weights summing to 0.9 silently scale every result down by 10% without any error being raised. A one-line assert catches it immediately." }
  ],

  project: {
    title: 'Portfolio Risk Dashboard',
    story: 'The society investment club holds four assets and argues about them monthly with no data. Build the risk report ' +
           'that settles it: what each asset returned, what it cost in risk, and whether the mix is better than its parts.',
    scope: 'Uses this level plus Level 3 (pandas) and Level 2 (formatting): pct_change, cumprod, cummax, std, corr, dot, ' +
           'quantile, and matplotlib. numpy is used only for sqrt and arrays.',
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
      code: '"""FinQuest Level 7 — Portfolio Risk Dashboard"""\n\nimport numpy as np\nimport pandas as pd\nimport matplotlib.pyplot as plt\n\nURL = "{{RAW}}/data/level-07-prices.csv"\nTRADING_DAYS = 252\nRISK_FREE = 0.03          # state your assumption, always\n\n\ndef load_prices(url=URL):\n    """Date-indexed price DataFrame."""\n    # TODO\n    pass\n\n\ndef compute_returns(prices):\n    """Daily simple returns, first row dropped."""\n    # TODO\n    pass\n\n\ndef annualize(returns, trading_days=TRADING_DAYS):\n    """Return (ann_mean_return, ann_volatility). Remember sqrt for vol."""\n    # TODO\n    pass\n\n\ndef cagr(prices):\n    """Compounded annual growth rate from first to last price."""\n    # TODO\n    pass\n\n\ndef sharpe(ann_return, ann_vol, risk_free=RISK_FREE):\n    # TODO\n    pass\n\n\ndef drawdown_series(returns_series):\n    """Drawdown from the running peak, as a negative fraction."""\n    # TODO\n    pass\n\n\ndef max_drawdown(returns_series):\n    # TODO\n    pass\n\n\ndef asset_table(prices):\n    """One row per asset: total, ann_mean, cagr, vol, sharpe, max_dd."""\n    # TODO\n    pass\n\n\ndef correlation_matrix(returns):\n    # TODO\n    pass\n\n\ndef portfolio_returns(returns, weights):\n    """Weighted daily returns. Assert the weights sum to 1."""\n    # TODO\n    pass\n\n\ndef portfolio_stats(returns, weights, label="portfolio"):\n    """Return + vol + sharpe + max_dd + VaR95 + VaR99 + expected shortfall."""\n    # TODO\n    pass\n\n\ndef diversification_check(returns, weights):\n    """Portfolio vol vs weighted average of individual vols."""\n    # TODO\n    pass\n\n\ndef plot_dashboard(returns):\n    """Equity curves above, drawdowns below, shared x-axis."""\n    # TODO\n    pass\n\n\ndef report():\n    # TODO\n    pass\n\n\nif __name__ == "__main__":\n    report()\n'
    },
    tests: [
      'prices.shape is (782, 4); returns.shape is (781, 4)',
      'Total returns: TECHX +19.3%, BANKCO +1.2%, GOLDF +4.7%, CRYPTOZ +21.3% (to 0.1%)',
      'Annualized volatility: TECHX 31.4%, BANKCO 19.6%, GOLDF 14.1%, CRYPTOZ 73.4%',
      'CRYPTOZ annualized mean is about 39.1% while its CAGR is about 6.4% (using years = rows / 252) — the drag must be visible in your table',
      'Sharpe at 3% risk-free: TECHX 0.26, BANKCO -0.04, GOLDF -0.03, CRYPTOZ 0.49',
      'Max drawdowns: TECHX -60.2%, BANKCO -33.5%, GOLDF -33.8%, CRYPTOZ -88.6%',
      'GOLDF correlates below 0.2 with every other asset',
      'Equal-weight portfolio: about 12.9% annualized return, 27.1% volatility, Sharpe 0.36, max drawdown -56.9%',
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
      a: 'You skipped .dropna() after pct_change, so the first row of NaNs propagated into every statistic. Drop it immediately after computing returns.' },
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
