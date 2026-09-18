/* =========================================================================
   LEVEL 17: portfolio construction and the risk engine
   ========================================================================= */
FQ.registerLevel({
  id: 17,
  codename: 'risk engine',
  title: 'Weights, and the risk they actually carry',
  tagline: 'The textbook optimiser handed 25% of the money to one asset and 63% of the risk with it, then asked to short another at 92%. Build the engine that produces weights a desk could hold.',
  difficulty: 9,
  minutes: 260,
  tags: ['portfolio', 'optimisation', 'VaR', 'risk decomposition'],
  summary: 'Level 7 measured one portfolio. This level decides what should be in it. Covariance and why the sample version ' +
           'is fragile, mean variance and why it maximises estimation error, constraints and risk parity, where the risk ' +
           'really sits, and a VaR engine that is backtested rather than believed.',

  objectives: [
    'Build and annualise a covariance matrix, and say why the sample estimate is fragile',
    'Run a mean variance optimisation and explain the weights it produces',
    'Add constraints, and measure what they cost and what they buy',
    'Decompose portfolio risk into each holding\'s contribution',
    'Compute VaR and expected shortfall three ways and reconcile them',
    'Backtest the risk model by counting exceptions',
    'Turn the result into a rebalancing policy with turnover in it'
  ],

  knowledge: [
    { h: 'Covariance is the whole problem' },
    { p: 'A portfolio\'s risk is not the average of its parts, as level 7 showed: it depends on how the parts move together. ' +
         'That information lives in the covariance matrix, and for four assets it is ten numbers. For a hundred assets it ' +
         'is five thousand and fifty, estimated from the same limited history, and that is where portfolio theory starts ' +
         'to hurt.' },
    { code: 'returns = prices.pct_change().dropna()\nmu = returns.mean() * 252              # annualised means\nS  = returns.cov() * 252               # annualised covariance', lang: 'python' },
    { table: {
      head: ['Asset', 'Annual return', 'Annual volatility'],
      rows: [
        ['TECHX', '10.63%', '31.43%'],
        ['BANKCO', '2.28%', '19.56%'],
        ['GOLDF', '2.49%', '14.11%'],
        ['CRYPTOZ', '32.99%', '73.37%']
      ]
    }},
    { warn: 'Those means are three years of history and nothing more. A covariance estimated from three years is noisy; a ' +
            'mean estimated from three years is barely an estimate at all, which is the single most important fact in this ' +
            'level and the reason for everything that follows.' },

    { h: 'The optimiser does what you asked, which is the problem' },
    { p: 'Mean variance optimisation finds the weights with the best return per unit of risk. Run it unconstrained on this ' +
         'data and look at what it wants:' },
    { table: {
      head: ['', 'Equal weight', 'Unconstrained optimum', 'Long only optimum'],
      rows: [
        ['TECHX', '25%', '64.1%', '26.8%'],
        ['BANKCO', '25%', '**-92.5%**', '0%'],
        ['GOLDF', '25%', '75.4%', '43.1%'],
        ['CRYPTOZ', '25%', '53.0%', '30.0%'],
        ['Return', '12.10%', '24.07%', '13.83%'],
        ['Volatility', '27.10%', '47.89%', '28.99%'],
        ['**Sharpe**', '**0.45**', '**0.50**', '**0.48**']
      ]
    }},
    { p: 'The unconstrained answer shorts a quarter of the universe at ninety two percent of the portfolio to buy more of ' +
         'everything else, and it earns a Sharpe of 0.50 against 0.45 for dividing the money into four equal parts. That is ' +
         'the entire prize: five hundredths, for a position that needs a margin account, a borrow and a strong stomach.' },
    { p: 'This is **error maximisation**. The optimiser cannot tell an estimate from a fact, so the asset whose mean happened ' +
         'to be overstated by noise looks best, and it gets the most money. Small changes in the inputs produce large ' +
         'changes in the weights, which is the opposite of what anybody wants from an allocation.' },
    { check: {
      q: 'Your optimiser puts 92% short into one asset. Your colleague says the maths is correct so the weights must be ' +
         'right. What is wrong with that argument?',
      a: 'The maths is correct, and the inputs are guesses. Mean variance is exact given the true means and covariances, and ' +
         'nobody has those: you have three years of history, from which a mean is estimated with enormous uncertainty. The ' +
         'optimiser treats that estimate as certain and pushes as hard as it can in the direction the noise happened to ' +
         'point. A better solver changes nothing. What helps is to stop feeding it numbers it cannot support: constrain the ' +
         'weights, shrink the estimates, or use a method that does not need the means at all.'
    }},

    { h: 'Constraints are not a compromise' },
    { p: 'Long only, and a cap per position. On this data those constraints cost 0.02 of Sharpe and remove the borrowing, the ' +
         'short and the margin call. Practitioners reach for them first, and the theory eventually agreed: a constraint is a ' +
         'crude way of saying you do not believe your own estimates, and disbelieving them is correct.' },
    { ul: [
      '**Long only**: no shorts. Removes the most extreme positions, which are where the estimation error concentrates.',
      '**Position cap**, for example 40% each: stops one asset dominating on the strength of one noisy mean.',
      '**Turnover limit**: how far the new weights may move from the current ones. Level 16 taught what turnover costs.',
      '**Shrinkage**: pull the sample covariance towards something simple and stable. Ledoit and Wolf is the standard reference and one line in scikit-learn.'
    ]},
    { p: 'And the method that sidesteps the means entirely: **minimum variance**, which asks only for the covariance. On this ' +
         'data it produces 12.20% volatility against equal weight\'s 27.10%, by holding mostly the two calm assets.' },
    { check: {
      q: 'Minimum variance gives 12.20% volatility against 27.10% for equal weight, but its return is 2.52% against 12.10%. ' +
         'Has it helped?',
      a: 'It has answered a different question honestly. Minimum variance does not ask what you will earn; it asks how little ' +
         'you can move, and on this book the calm assets earned little, so a low volatility portfolio is also a low return ' +
         'one. It is the right tool when you have no confidence in the means at all, and it is a bad tool when you do, ' +
         'because it will happily avoid the asset that carries the entire return. The useful comparison is Sharpe: 0.21 for ' +
         'minimum variance against 0.45 for equal weight, which says that on this book, dividing the money evenly beat ' +
         'being clever about the covariance.'
    }},

    { h: 'Where the risk actually is' },
    { p: 'An equal weight portfolio is not an equal risk one. Decompose it and the difference is stark.' },
    { code: 'port_vol = sqrt(w @ S @ w)\nmarginal = (S @ w) / port_vol          # change in risk per unit of weight\ncontribution = w * marginal            # sums to port_vol', lang: 'python' },
    { table: {
      head: ['Asset', 'Share of money', 'Share of risk'],
      rows: [
        ['TECHX', '25%', '21.6%'],
        ['BANKCO', '25%', '11.7%'],
        ['GOLDF', '25%', '**3.9%**'],
        ['CRYPTOZ', '25%', '**62.7%**']
      ]
    }},
    { p: 'A quarter of the money carries nearly two thirds of the risk. Nobody chose that: it fell out of holding equal ' +
         'amounts of things with very different volatilities. Say it out loud to a committee and the allocation discussion ' +
         'changes, which is what a risk decomposition is for.' },
    { p: '**Risk parity** is the allocation that equalises the last column instead of the first. It needs no return ' +
         'estimates, it holds more of the calm assets and less of the wild ones, and it is a serious alternative rather ' +
         'than a curiosity.' },

    { h: 'Value at risk, three ways' },
    { p: 'Level 7 introduced historical VaR. A risk engine computes it three ways, because when they disagree the ' +
         'disagreement is the finding.' },
    { table: {
      head: ['Method', 'VaR 95%', 'VaR 99%', 'Assumes'],
      rows: [
        ['Historical', '-2.63%', '-3.79%', 'The future resembles this sample'],
        ['Parametric normal', '-2.76%', '-3.92%', 'Returns are normal'],
        ['Monte Carlo, normal', '-2.76%', '-3.90%', 'The same, simulated'],
        ['**Expected shortfall**', '**-3.35%**', '**-4.17%**', 'The average loss beyond VaR']
      ]
    }},
    { p: 'They agree here to within about a tenth of a percentage point, and that is a property of this dataset rather than ' +
         'a general truth: the excess kurtosis of these daily returns is 0.15, which is almost exactly normal. Real markets ' +
         'run between three and ten, so on real data the parametric number would be the optimistic one and the gap would be ' +
         'the warning.' },
    { warn: 'The moment the three methods disagree on real data, believe the historical and the Monte Carlo with a fat tailed ' +
            'distribution, and treat the normal one as the number that looks nicest in a slide.' },

    { h: 'A risk number nobody checks is a decoration' },
    { p: 'A 99% VaR says you should lose more than that on about one day in a hundred. So count. Over the 781 days in this ' +
         'sample, the equal weight portfolio breached its parametric numbers like this:' },
    { table: {
      head: ['Level', 'Exceptions observed', 'Expected', 'Reading'],
      rows: [
        ['95%', '35', '39', 'Slightly conservative'],
        ['99%', '5', '8', 'Conservative']
      ]
    }},
    { p: 'Both are in the range you would expect from chance at this sample size, so the model passes. Far too many ' +
         'exceptions means the model understates risk and somebody is trading on a number that is wrong in the dangerous ' +
         'direction; far too few means it overstates risk, which costs money in capital and opportunity and is a real ' +
         'finding rather than a comfortable one.' },
    { check: {
      q: 'Your 99% VaR is breached on 22 days out of 781. What do you conclude, and what do you check first?',
      a: 'The model is understating risk badly: eight breaches were expected and you have nearly three times that, which is ' +
         'not chance. First check whether the exceptions cluster. Independent breaches scattered through the sample point ' +
         'at the distribution being wrong, usually tails fatter than normal, and the fix is a historical or fat tailed ' +
         'simulation. Breaches bunched into a fortnight point at volatility clustering, meaning the model uses one ' +
         'volatility for a calm period and a storm, and the fix is an estimate that reacts, such as an exponentially ' +
         'weighted covariance. The count tells you there is a problem; the pattern tells you which one.'
    }},

    { h: 'Rebalancing is where the theory meets level 16' },
    { p: 'Optimal weights drift as prices move. Rebalancing costs money, so a policy has to say when, not only what.' },
    { ul: [
      '**Calendar**: monthly or quarterly. Simple, predictable, and occasionally rebalances for no reason.',
      '**Threshold**: only when a weight drifts more than a set distance from target. Trades less and trades for a reason.',
      '**No trade band**: a region around the target where nothing happens at all, which is the honest version of the above.'
    ]},
    { p: 'Whatever the rule, report turnover per year and apply the costs from level 16. An allocation that looks better ' +
         'on paper and rebalances weekly is usually worse after costs, and the only way to know is to run it through the ' +
         'engine you already built.' }
  ],

  tutorial: {
    intro: 'numpy, pandas and scipy on the level 7 prices. Every table in this level was produced by the code below, so ' +
           'you can check each figure as you go. Keep the level 16 engine to hand: the last step feeds this into it.',
    steps: [
      {
        t: 'Means, covariance, and a portfolio function',
        blocks: [
          { code: 'import numpy as np\nimport pandas as pd\n\nprices = pd.read_csv("{{RAW}}/data/level-07-prices.csv", parse_dates=["date"]).set_index("date")\nrets = prices.pct_change().dropna()\n\nmu = rets.mean() * 252\nS = rets.cov() * 252\n\ndef portfolio(w, mu=mu, S=S):\n    w = np.asarray(w, dtype=float)\n    ret = float(w @ mu)\n    vol = float(np.sqrt(w @ S.values @ w))\n    return {"return": ret, "vol": vol, "sharpe": ret / vol if vol else np.nan}', lang: 'python' },
          { p: 'Check it against level 7: an equal weight portfolio should give 12.10% return, 27.10% volatility and a Sharpe ' +
               'of 0.45 with no risk free rate.' }
        ],
        check: 'portfolio([0.25]*4) reproduces the equal weight figures from level 7.'
      },
      {
        t: 'Optimise, and look at what you get',
        blocks: [
          { code: 'from scipy.optimize import minimize\n\ndef max_sharpe(mu, S, bounds=None, cap=None):\n    n = len(mu)\n    x0 = np.repeat(1 / n, n)\n    cons = [{"type": "eq", "fun": lambda w: w.sum() - 1}]\n    if cap is not None:\n        bounds = [(0, cap)] * n\n    return minimize(lambda w: -portfolio(w, mu, S)["sharpe"],\n                    x0, bounds=bounds, constraints=cons).x\n\nprint("unconstrained", (np.linalg.inv(S.values) @ mu.values / (np.linalg.inv(S.values) @ mu.values).sum()).round(3))\nprint("long only    ", max_sharpe(mu, S, bounds=[(0, 1)] * 4).round(3))', lang: 'python' },
          { warn: 'Print the weights every time, before the Sharpe. A number like -0.925 in a weight vector is the finding, ' +
                  'and it is invisible if you only look at the summary statistics.' }
        ],
        check: 'The unconstrained solution shorts BANKCO at about -92.5% and gains 0.05 of Sharpe over equal weight.'
      },
      {
        t: 'Shrink the covariance',
        blocks: [
          { code: 'from sklearn.covariance import LedoitWolf\n\nlw = LedoitWolf().fit(rets.values)\nS_shrunk = pd.DataFrame(lw.covariance_ * 252, index=S.index, columns=S.columns)\nprint("shrinkage intensity", round(lw.shrinkage_, 3))\n\nprint("weights, sample   ", max_sharpe(mu, S, bounds=[(0, 1)] * 4).round(3))\nprint("weights, shrunk   ", max_sharpe(mu, S_shrunk, bounds=[(0, 1)] * 4).round(3))', lang: 'python' },
          { p: 'With four assets and 781 days the effect is small, which is worth seeing: shrinkage earns its place when the ' +
               'number of assets approaches the number of observations, and saying when a technique does nothing is part of ' +
               'knowing it.' }
        ],
        check: 'The shrinkage intensity prints, and the weights move less than a percentage point on this small universe.'
      },
      {
        t: 'Decompose the risk',
        blocks: [
          { code: 'def risk_contributions(w, S=S):\n    w = np.asarray(w, dtype=float)\n    vol = float(np.sqrt(w @ S.values @ w))\n    marginal = (S.values @ w) / vol\n    contribution = w * marginal\n    return pd.Series(contribution / contribution.sum(), index=S.index)\n\nprint((risk_contributions([0.25] * 4) * 100).round(1))', lang: 'python' },
          { p: 'You should see CRYPTOZ at about 62.7% and GOLDF at about 3.9%. Put that next to the weights in your report: ' +
               'two columns, money and risk, and let the gap make the argument.' }
        ],
        check: 'The contributions sum to 100% and reproduce the table in this level.'
      },
      {
        t: 'Risk parity',
        blocks: [
          { code: 'def risk_parity(S, tol=1e-10):\n    n = S.shape[0]\n    target = np.repeat(1 / n, n)\n\n    def error(w):\n        rc = risk_contributions(w, S)\n        return float(((rc - target) ** 2).sum())\n\n    cons = [{"type": "eq", "fun": lambda w: w.sum() - 1}]\n    return minimize(error, np.repeat(1 / n, n),\n                    bounds=[(1e-6, 1)] * n, constraints=cons, tol=tol).x', lang: 'python' },
          { tip: 'Compare risk parity, equal weight and minimum variance in one table: weights, return, volatility, Sharpe ' +
                 'and the four risk contributions. That single table is the deliverable a committee reads.' }
        ],
        check: 'Risk parity gives four risk contributions near 25% each, and holds far less CRYPTOZ than equal weight.'
      },
      {
        t: 'VaR three ways',
        blocks: [
          { code: 'import scipy.stats as st\n\nport_daily = rets.values @ np.repeat(0.25, 4)\n\ndef var_historical(x, level=0.95):\n    return float(np.quantile(x, 1 - level))\n\ndef var_parametric(x, level=0.95):\n    return float(x.mean() + x.std() * st.norm.ppf(1 - level))\n\ndef var_monte_carlo(mu_d, S_d, w, level=0.95, n=200_000, seed=7):\n    rng = np.random.default_rng(seed)\n    sims = rng.multivariate_normal(mu_d, S_d, size=n) @ w\n    return float(np.quantile(sims, 1 - level))\n\ndef expected_shortfall(x, level=0.95):\n    cut = var_historical(x, level)\n    return float(x[x <= cut].mean())', lang: 'python' },
          { p: 'Print all four at 95% and 99% in one table. On this data they land within about a tenth of a percentage ' +
               'point of each other, and the reason is in the next step.' }
        ],
        check: 'Historical VaR95 is about -2.63%, ES95 about -3.35%, and the parametric and Monte Carlo figures agree closely.'
      },
      {
        t: 'Ask whether normal was a fair assumption',
        blocks: [
          { code: 'print("excess kurtosis", round(st.kurtosis(port_daily), 2))\nprint("skew", round(st.skew(port_daily), 2))', lang: 'python' },
          { p: 'About 0.15 and 0.16 here: this synthetic data is nearly normal, which is why the parametric number worked. ' +
               'Write that in the report, because on real returns the excess kurtosis runs between three and ten and the ' +
               'parametric VaR is the one that understates the danger.' }
        ],
        check: 'The kurtosis is printed and the report says what it implies for the parametric method.'
      },
      {
        t: 'Backtest the risk model',
        blocks: [
          { code: 'def exceptions(x, var_level, level=0.95):\n    breaches = x < var_level\n    return {"observed": int(breaches.sum()),\n            "expected": round((1 - level) * len(x), 1),\n            "days": len(x),\n            "worst": float(x.min())}\n\nprint(exceptions(port_daily, var_parametric(port_daily, 0.99), 0.99))', lang: 'python' },
          { p: 'Five observed against eight expected over 781 days. Then check clustering: if the breaches are bunched into ' +
               'one fortnight, the problem is that your volatility estimate does not react, and an exponentially weighted ' +
               'covariance is the next thing to try.' }
        ],
        check: 'The exception count is printed at both levels, along with the dates of the breaches.'
      }
    ]
  },

  glossary: [
    { t: 'Covariance matrix', d: 'How every pair of assets moves together. Ten numbers for four assets, 5,050 for a hundred.' },
    { t: 'Mean variance optimisation', d: 'Choosing weights for the best return per unit of risk, given estimated means and covariances.' },
    { t: 'Error maximisation', d: 'What mean variance does in practice: it puts the most money where the estimate was most overstated.' },
    { t: 'Tangency portfolio', d: 'The weights with the highest Sharpe ratio for a given set of estimates.' },
    { t: 'Minimum variance', d: 'The lowest volatility portfolio. Needs the covariance and no return estimates at all.' },
    { t: 'Shrinkage', d: 'Pulling a noisy sample covariance towards a simple stable target. Ledoit and Wolf is the standard.' },
    { t: 'Long only', d: 'No short positions. The crudest and most effective way to say you distrust your estimates.' },
    { t: 'Marginal contribution to risk', d: 'How much portfolio volatility changes per unit of weight in one asset.' },
    { t: 'Risk contribution', d: 'Weight times marginal contribution. Sums to the portfolio volatility, and rarely matches the weights.' },
    { t: 'Risk parity', d: 'Weights chosen so every holding contributes the same risk rather than the same money.' },
    { t: 'Value at risk', d: 'A loss threshold at a confidence level. A threshold, never a maximum.' },
    { t: 'Expected shortfall', d: 'The average loss on the days that breach VaR. What VaR refuses to tell you.' },
    { t: 'Exception', d: 'A day whose loss exceeded the VaR. Counting them is how you find out whether the model works.' },
    { t: 'Volatility clustering', d: 'Calm periods and stormy ones. Why a single volatility estimate produces bunched exceptions.' },
    { t: 'No trade band', d: 'A region around the target weights where rebalancing does not happen, so turnover has a reason.' }
  ],

  quiz: [
    { q: "Why does an unconstrained mean variance optimiser produce extreme weights?",
      options: [
        "It treats noisy estimates as certain, so it pushes hardest where the noise pointed",
        "The covariance matrix is singular",
        "The solver has not converged",
        "Because returns are not normal"
      ],
      answer: 0,
      why: "Error maximisation. The fix is constraints, shrinkage, or a method that does not need the means, not a better solver." },

    { q: "On this data, unconstrained optimisation gains 0.05 of Sharpe over equal weight. What does it require?",
      options: [
        "A 92% short position, with the margin and borrow that implies",
        "A risk free asset",
        "Daily rebalancing",
        "A longer sample"
      ],
      answer: 0,
      why: "0.50 against 0.45. Five hundredths of Sharpe for a position most investors cannot hold and none should want." },

    { q: "What does a long only constraint actually express?",
      options: [
        "A preference for simplicity",
        "That short selling is expensive",
        "That you do not believe your own estimates enough to bet against anything",
        "A regulatory requirement"
      ],
      answer: 2,
      why: "Constraints are a crude prior. Practitioners reached for them first and the theory eventually agreed." },

    { q: "Minimum variance needs which inputs?",
      options: [
        "Neither, only prices",
        "The covariance matrix only",
        "Both, plus a risk free rate",
        "Expected returns only"
      ],
      answer: 1,
      why: "That is its attraction: the means are the least reliable estimate you have, and this method does not ask for them." },

    { q: "Equal weight gives every asset 25% of the money. On this data CRYPTOZ carries what share of the risk?",
      options: [
        "62.7%",
        "25%",
        "11.7%",
        "38%"
      ],
      answer: 0,
      why: "Equal money is not equal risk when volatilities differ by a factor of five. Nobody chose that concentration; it fell out of the weights." },

    { q: "Risk parity chooses weights so that:",
      options: [
        "Volatility is minimised",
        "Every asset has the same weight",
        "Every asset contributes the same risk",
        "The Sharpe ratio is maximised"
      ],
      answer: 2,
      why: "It needs no return estimates, holds more of the calm assets, and is a serious alternative rather than a curiosity." },

    { q: "Historical, parametric and Monte Carlo VaR agree closely on this dataset. Why?",
      options: [
        "Because these returns are nearly normal, with excess kurtosis of 0.15",
        "Because all three use the same quantile function",
        "Because the portfolio is equal weight",
        "Because the sample is large"
      ],
      answer: 0,
      why: "Real markets run between three and ten, and there the parametric number is the optimistic one and the gap is the warning." },

    { q: "Expected shortfall at 95% on this portfolio is -3.35% against a VaR of -2.63%. What does that mean?",
      options: [
        "The VaR was computed wrongly",
        "The portfolio loses 3.35% on 5% of days",
        "The worst possible day is -3.35%",
        "On the days that breach the VaR, the average loss is 3.35%"
      ],
      answer: 3,
      why: "VaR gives the threshold, ES gives the average beyond it, and the worst single day here was -5.00%. Report all three." },

    { q: "A 99% VaR is breached 22 times in 781 days. The most likely explanations are:",
      options: [
        "The sample is too short to say",
        "Fat tails or volatility clustering",
        "A bug in the quantile function",
        "Too few assets"
      ],
      answer: 1,
      why: "Eight were expected. Scattered breaches point at the distribution; bunched ones point at a volatility estimate that does not react." },

    { q: "Far fewer exceptions than expected means:",
      options: [
        "The model is working well",
        "Nothing worth reporting",
        "The model overstates risk, which costs capital and opportunity",
        "The confidence level was set too low"
      ],
      answer: 2,
      why: "Being wrong in the safe direction is still being wrong, and it is a real finding rather than a comfortable one." },

    { q: "What does shrinkage do to a covariance matrix?",
      options: [
        "Scales it to annual units",
        "Pulls the noisy sample estimate towards a simple stable target",
        "Reduces its dimensions",
        "Removes the correlations"
      ],
      answer: 1,
      why: "It earns its place as the number of assets approaches the number of observations. On four assets and 781 days it does almost nothing." },

    { q: "Risk contribution is computed as:",
      options: [
        "The correlation with the portfolio",
        "Weight times marginal contribution to risk",
        "Weight times volatility",
        "Weight squared times variance"
      ],
      answer: 1,
      why: "And the contributions sum to the portfolio volatility, which is what makes the percentages meaningful." },

    { q: "Why does a rebalancing policy need a threshold rather than only a calendar?",
      options: [
        "Because thresholds are easier to implement",
        "Because calendars vary by country",
        "Because a calendar rebalances when nothing has moved, and every trade pays the costs from level 16",
        "Because monthly is too frequent for any portfolio"
      ],
      answer: 2,
      why: "A no trade band is the honest version: nothing happens until a weight has drifted far enough to be worth the cost." },

    { q: "Which is the best summary of what constraints cost on this data?",
      options: [
        "They always improve the result",
        "Nothing at all",
        "About half the return",
        "About 0.02 of Sharpe, in exchange for removing the borrowing, the short and the margin call"
      ],
      answer: 3,
      why: "0.50 unconstrained against 0.48 long only. Cheap insurance against estimates you know are noisy." },

    { q: "Ten numbers describe the covariance of four assets. How many for a hundred?",
      options: [
        "1,000",
        "400",
        "10,000",
        "5,050"
      ],
      answer: 3,
      why: "n(n+1)/2, all estimated from the same limited history. That growth is why portfolio theory starts to hurt at scale." }
  ],

  project: {
    title: 'The portfolio and risk engine',
    story: 'The society\'s investment group has four assets, strong opinions and no process. Build the engine that produces ' +
           'the weights, shows where the risk actually sits, reports the loss numbers three ways, and proves the risk model ' +
           'has been checked rather than believed.',
    scope: 'Uses this level plus level 7 (returns, volatility, correlation, drawdown) and level 16 (costs and turnover). ' +
           'numpy, pandas, scipy and scikit-learn for shrinkage only.',
    dataset: '{{RAW}}/data/level-07-prices.csv',
    requirements: [
      'A portfolio(w) returning annualised return, volatility and Sharpe, checked against the level 7 equal weight figures',
      'max_sharpe() and min_variance(), each accepting bounds and a per position cap',
      'The unconstrained solution printed with its weights, including the short, next to the constrained one',
      'Ledoit and Wolf shrinkage as an option, with the shrinkage intensity reported and a note on why it matters little here',
      'risk_contributions(w) that sums to one, reproducing the equal weight decomposition in this level',
      'risk_parity() solved numerically, with a test that the contributions are equal to within a tolerance',
      'A comparison table of equal weight, minimum variance, maximum Sharpe and risk parity: weights, return, volatility, Sharpe and risk contributions',
      'VaR at 95% and 99% by historical, parametric and Monte Carlo methods, plus expected shortfall',
      'The excess kurtosis reported next to the VaR table, with one sentence on what it means for the parametric figure',
      'An exception backtest counting breaches at both levels against expectation, and listing the dates so clustering is visible',
      'A rebalancing policy with a no trade band, reporting turnover per year and the cost from the level 16 engine',
      'A README with the comparison table, the risk decomposition and the exception count, written for somebody choosing an allocation',
      'The repository in your GitHub portfolio as finquest-portfolio-engine'
    ],
    starter: {
      lang: 'python',
      code: '"""FinQuest level 17: the portfolio and risk engine.\n\nLayout:\n  engine/inputs.py      returns, means, covariance, shrinkage\n  engine/optimise.py    max_sharpe, min_variance, risk_parity\n  engine/decompose.py   marginal and total risk contributions\n  engine/var.py         historical, parametric, monte carlo, expected shortfall\n  engine/backtest.py    exception counting and clustering\n  engine/rebalance.py   the no trade band and its turnover\n"""\n\nimport numpy as np\nimport pandas as pd\n\nURL = "{{RAW}}/data/level-07-prices.csv"\n\n\ndef load(url=URL):\n    """Prices, daily returns, annualised mu and S."""\n    # TODO\n    pass\n\n\ndef portfolio(w, mu, S):\n    """Annualised return, volatility and Sharpe."""\n    # TODO\n    pass\n\n\ndef max_sharpe(mu, S, bounds=None, cap=None):\n    # TODO\n    pass\n\n\ndef min_variance(S, bounds=None):\n    # TODO\n    pass\n\n\ndef risk_contributions(w, S):\n    """Fractions summing to one."""\n    # TODO\n    pass\n\n\ndef risk_parity(S):\n    """Weights whose risk contributions are equal."""\n    # TODO\n    pass\n\n\ndef var_historical(x, level=0.95):\n    # TODO\n    pass\n\n\ndef expected_shortfall(x, level=0.95):\n    # TODO\n    pass\n\n\ndef exceptions(x, var_level, level=0.95):\n    """Observed against expected breaches, with the dates."""\n    # TODO\n    pass\n'
    },
    tests: [
      'portfolio([0.25]*4) gives about 12.10% return, 27.10% volatility and Sharpe 0.45',
      'The unconstrained maximum Sharpe solution shorts BANKCO at about -92.5% and reaches Sharpe about 0.50',
      'The long only solution holds nothing negative and reaches Sharpe about 0.48',
      'Minimum variance long only gives volatility about 12.20% and holds mostly GOLDF and BANKCO',
      'Risk contributions of the equal weight portfolio sum to 1.0 and give CRYPTOZ about 62.7%',
      'Risk parity contributions are equal to within 1e-6, and it holds less CRYPTOZ than equal weight',
      'Historical VaR95 is about -2.63% and expected shortfall about -3.35%',
      'Parametric and Monte Carlo VaR99 agree to within 0.05 percentage points on this data',
      'The exception count at 99% is 5 against an expectation of 8 over 781 days',
      'Rebalancing with a no trade band produces lower turnover than a monthly calendar on the same data'
    ],
    rubric: [
      { pts: 25, t: 'Weights you can defend', d: 'The unconstrained result is shown and explained rather than hidden, and constraints are justified by what they cost.' },
      { pts: 20, t: 'Risk located', d: 'Contributions computed correctly, compared against the weights, and risk parity implemented and tested.' },
      { pts: 20, t: 'Loss numbers done properly', d: 'Three VaR methods, expected shortfall, and the kurtosis check that says whether the normal assumption was fair.' },
      { pts: 20, t: 'The model is checked', d: 'Exception counts at both levels against expectation, with dates so clustering is visible, and a conclusion drawn.' },
      { pts: 15, t: 'Usable', d: 'One comparison table a committee could read, a rebalancing policy with turnover and costs, and a README that leads with the decision.' }
    ],
    stretch: [
      'Add an exponentially weighted covariance and rerun the exception backtest, comparing the clustering',
      'Add a Monte Carlo with a Student t distribution and compare the 99% figure with the normal one',
      'Run the whole allocation through the level 16 engine as a strategy, with rebalancing costs, and report the net result',
      'Add a factor model: regress the four assets on one common factor and compare the covariance it implies with the sample one'
    ],
    solutionPath: 'solutions/level-17'
  },

  faq: [
    { q: 'Why does everybody still teach mean variance if it behaves this badly?',
      a: 'Because it is the right frame: return, risk, and the trade between them. The failure is in the inputs rather than in the idea, and every practical method in this level is a way of admitting that.' },
    { q: 'Should I use a risk free rate in the Sharpe ratio?',
      a: 'Yes in a report, with the rate stated. This level uses zero throughout so the figures can be compared with level 7, and that choice is written down rather than assumed.' },
    { q: 'How many assets before shrinkage matters?',
      a: 'It grows with the ratio of assets to observations. With four assets and 781 days it does almost nothing; with two hundred assets and two years of daily data the sample covariance is close to unusable.' },
    { q: 'Is risk parity better than equal weight?',
      a: 'It is more honest about what it is doing. Whether it performs better depends on the assets, and on this book equal weight has the higher Sharpe, which is worth reporting rather than hiding.' },
    { q: 'Why is expected shortfall preferred by regulators now?',
      a: 'Because VaR says nothing about how bad the bad days are, and the 2008 experience was largely about the size of the tail rather than its frequency. ES averages the breaches, which is the question that matters.' },
    { q: 'My optimiser returns weights that do not sum to one',
      a: 'The equality constraint is missing or the solver failed. Check the return status rather than the weights, and assert the sum in a test so it can never pass silently.' },
    { q: 'How often should a portfolio rebalance?',
      a: 'Rarely enough that the costs do not eat the benefit, which is a question for the level 16 engine rather than for theory. Start with a no trade band and measure.' }
  ]
});
