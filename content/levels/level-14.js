/* =========================================================================
   LEVEL 14: the credit scorecard
   ========================================================================= */
FQ.registerLevel({
  id: 14,
  codename: 'scorecard',
  title: 'The scorecard a regulator can read',
  tagline: 'Banks still underwrite with logistic regression on binned variables, because the model has to be explained to an applicant who was declined. Build one properly, points and all.',
  difficulty: 9,
  minutes: 270,
  tags: ['credit risk', 'WOE', 'logistic regression', 'model risk'],
  summary: 'This is the technique credit risk teams actually use, and almost nobody teaches it. Weight of evidence binning, ' +
           'information value, a logistic model fitted on the bins, and the result scaled into points a human can read. ' +
           'Then the parts that make it a job rather than a notebook: reason codes, fairness testing and monitoring.',

  objectives: [
    'Define good, bad and indeterminate, and defend the performance window you chose',
    'Bin a variable into coarse classes and compute weight of evidence per bin',
    'Use information value to rank features, and know when a high one is a warning',
    'Fit a logistic regression on weight of evidence and read the coefficients',
    'Scale probabilities into points with a stated points to double the odds',
    'Produce reason codes for a decline, in the order that cost the applicant most',
    'Test the scorecard for proxy discrimination and write the monitoring plan'
  ],

  knowledge: [
    { h: 'Why not gradient boosting' },
    { p: 'A boosted tree would beat this scorecard on the same data. Lenders use the scorecard anyway, and the reason is not ' +
         'nostalgia: a declined applicant has a legal right to be told why, a regulator can ask you to justify any decision ' +
         'from three years ago, and a model risk team has to validate the thing before it goes anywhere near a customer.' },
    { table: {
      head: ['What the job needs', 'Scorecard', 'Boosted tree'],
      rows: [
        ['Explain one decline in plain words', 'Read the points off the card', 'Post hoc, approximate, arguable'],
        ['Show the effect of one variable', 'One row of the card', 'A partial dependence plot and a caveat'],
        ['Stay stable as the population drifts', 'Bins absorb small shifts', 'Sensitive to shifts in the tails'],
        ['Squeeze the last points of accuracy', 'No', 'Yes']
      ]
    }},
    { money: 'The pattern in the industry is a scorecard for the decision and a stronger model in the background, used for ' +
             'pricing, limits or fraud, where the explanation requirements are lighter. Knowing why both exist is a better ' +
             'interview answer than knowing either technique.' },

    { h: 'Good, bad, and the window' },
    { p: 'Before any modelling, three definitions, and they are choices rather than facts. This level\'s data uses the ' +
         'common one: **bad** means ninety days past due within twelve months of the loan being taken.' },
    { ul: [
      '**Performance window**: how long you watch. Too short and you miss the defaults that arrive in month eleven; too long and your model is trained on a world that has moved on.',
      '**Indeterminate**: accounts that are neither clean nor clearly bad, say thirty to sixty days late once. They are usually excluded from fitting and reported separately, because forcing them into one class teaches the model something untrue.',
      '**Exclusions**: staff accounts, fraud, and anything closed for a reason unrelated to credit. Write them down, because an unexplained exclusion is the first thing a validator asks about.'
    ]},
    { code: '8,000 applications, each observed for twelve months\n  799 bad (9.99%)\n7,201 good (90.01%)', lang: 'text', label: 'this level\'s book' },
    { check: {
      q: 'Your colleague suggests a six month window instead of twelve, because the data is fresher and the model can be ' +
         'retrained sooner. Name the cost.',
      a: 'Every borrower who defaults in months seven to twelve is labelled good, so the model learns that people who were ' +
         'about to fail were fine. The bad rate in training drops, the model looks better on paper, and it approves the ' +
         'slow failures. A short window is defensible when the product itself is short, for example a three month loan, ' +
         'and the rule is that the window matches the life of the thing you are lending on rather than how quickly you ' +
         'would like to retrain.'
    }},

    { h: 'Coarse classing and weight of evidence' },
    { p: 'Every variable is cut into a handful of bins, and each bin is replaced by one number: the log odds of good to bad ' +
         'in that bin, relative to the book as a whole. That number is the **weight of evidence**.' },
    { code: 'WOE = ln( (goods in bin / all goods) / (bads in bin / all bads) )\n\npositive WOE  ->  this bin is safer than the book\nnegative WOE  ->  this bin is riskier than the book\nzero          ->  this bin tells you nothing', lang: 'text' },
    { p: 'Here is debt to income on the level\'s own data, cut into five equal sized bins:' },
    { table: {
      head: ['DTI bin', 'Applications', 'Bad', 'Bad rate', 'WOE'],
      rows: [
        ['up to 0.068', '1,600', '57', '3.56%', '**+1.100**'],
        ['0.068 to 0.115', '1,603', '88', '5.49%', '+0.647'],
        ['0.115 to 0.183', '1,599', '100', '6.25%', '+0.509'],
        ['0.183 to 0.307', '1,600', '163', '10.19%', '-0.022'],
        ['above 0.307', '1,598', '391', '24.47%', '**-1.071**']
      ]
    }},
    { p: 'Three things that table buys you. The relationship is **monotonic**, which is what a credit team wants to see: more ' +
         'debt, more risk, no bumps. Outliers are harmless, because a debt to income of 3.0 falls in the last bin along with ' +
         '0.4. And missing values get their own bin rather than an average, because "we could not find out" is information.' },
    { warn: 'Bins are fitted on the training set and then applied unchanged to everything else. Recomputing them on the test ' +
            'set leaks the answer and makes your validation meaningless, in exactly the way level 8 warned about.' },
    { check: {
      q: 'Your prior arrears variable comes out with WOE +0.31 for zero arrears, -0.62 for one, -1.48 for two and -1.70 for ' +
         'three. Only ninety applications have three. What do you do with that last bin?',
      a: 'Merge it with the bin for two. Ninety applications is too few to trust a WOE from, the two bins already say the ' +
         'same thing, and a bin that thin will swing wildly when you refit next quarter. Coarse classing is called coarse on ' +
         'purpose: you are trading a little separation for a lot of stability, and a bin under about five percent of the ' +
         'book is usually not worth keeping on its own.'
    }},

    { h: 'Information value ranks the candidates' },
    { p: 'One number per variable, summed over its bins, saying how much the variable separates good from bad.' },
    { code: 'IV = sum over bins of (good% - bad%) x WOE', lang: 'text' },
    { table: {
      head: ['Variable', 'IV on this book', 'Reading'],
      rows: [
        ['debt to income', '**0.609**', 'Very strong, and high enough to check for leakage'],
        ['prior defaults', '0.340', 'Strong'],
        ['income', '0.304', 'Strong'],
        ['term in months', '0.071', 'Weak, might earn a place'],
        ['purpose', '0.060', 'Weak'],
        ['inquiries in 6 months', '0.052', 'Weak'],
        ['employment years', '0.010', 'Useless here'],
        ['age', '0.005', 'Useless, and would be illegal to use in many places'],
        ['region', '0.004', 'Useless, and a proxy risk if it were not']
      ]
    }},
    { p: 'The rule of thumb everybody uses: under 0.02 is noise, 0.02 to 0.1 is weak, 0.1 to 0.3 is medium, 0.3 to 0.5 is ' +
         'strong, and above 0.5 is suspiciously good. Suspicious does not mean wrong. It means go and check that the ' +
         'variable was actually knowable at the moment of the decision.' },
    { check: {
      q: 'Debt to income scores 0.609, above the "suspicious" line. Is that a problem here?',
      a: 'It is a prompt, and here the answer is no. Ask one question: was this value knowable when the application was ' +
         'decided? Debt to income is computed from the income the applicant declared and the loan they asked for, both ' +
         'known at the moment of the decision, so it is fair. Compare a variable like "number of collection calls", which ' +
         'would score enormously and is only high because the account was already going bad. That is leakage, and it turns ' +
         'a model that cannot work into one that looks brilliant in testing.'
    }},

    { h: 'Fit on the evidence, not on the raw values' },
    { p: 'The model is a logistic regression whose inputs are the WOE values rather than the raw numbers. Every input is now ' +
         'on the same scale, in log odds, so the coefficients are comparable and each one has a sign you can argue about.' },
    { code: 'from sklearn.linear_model import LogisticRegression\n\nmodel = LogisticRegression(max_iter=1000)\nmodel.fit(X_train_woe, y_train)          # X is WOE, y is 1 for bad', lang: 'python' },
    { code: 'AUC on train   0.785\nAUC on test    0.771      <- the number to report\nGini           0.543      (Gini = 2 x AUC - 1)', lang: 'text', label: 'five variables, this book' },
    { p: 'A Gini in the fifties is a normal, working application scorecard. Published behavioural scorecards, which get to ' +
         'see how you have handled an account you already have, run higher; application scorecards, deciding about a ' +
         'stranger, run lower. A Gini of 0.95 on an application model means leakage until proven otherwise.' },
    { warn: 'Every coefficient should have the sign the WOE construction implies. One that comes out backwards is usually two ' +
            'correlated variables fighting, and a credit team will make you drop one rather than ship a card that says ' +
            'more income raises your risk.' },

    { h: 'Points, and why they exist' },
    { p: 'A probability of 0.087 means nothing to a branch manager. The industry scales the log odds into points with two ' +
         'chosen constants: a score that means a particular odds, and the **points to double the odds**.' },
    { code: 'factor = PDO / ln(2)\noffset = target_score - factor x ln(target_odds)\n\nscore  = offset + factor x ln(odds of good)\n\nwith PDO = 20, target 600 points at odds of 50 to 1:\n  factor = 20 / 0.6931 = 28.854\n  offset = 600 - 28.854 x ln(50) = 487.1', lang: 'text' },
    { p: 'The pay off is that the card becomes additive. Every bin of every variable carries a fixed number of points, an ' +
         'applicant\'s score is the sum, and a twenty point gain always means the same thing: half the odds of going bad.' },
    { table: {
      head: ['Score band', 'Applications (test set)', 'Bad rate'],
      rows: [
        ['below 540', '577', '**24.8%**'],
        ['540 to 580', '977', '7.8%'],
        ['580 to 620', '846', '**2.5%**']
      ]
    }},
    { p: 'That table is the whole model in a form a credit committee can set policy on. Where to put the cut off is their ' +
         'decision and not yours, and it is the same shape of decision as the fraud threshold in level 8: the number falls ' +
         'out of what an approval is worth and what a default costs, not out of the model.' },
    { check: {
      q: 'The committee asks for the cut off that maximises accuracy. Why is that the wrong question, and what do you ask ' +
         'them instead?',
      a: 'Because with a ten percent bad rate, approving nobody is ninety percent accurate and earns nothing. The question ' +
         'is what an approved good account is worth over its life, what an approved bad one costs after recoveries, and ' +
         'what volume the business needs. Then the cut off is arithmetic: at 540 you decline 577 applications to avoid 143 ' +
         'defaults, and whether that trade is good depends on numbers only they have. Bring the table, ask for the two ' +
         'figures, and let the policy be theirs.'
    }},

    { h: 'Reason codes: the part with legal weight' },
    { p: 'In the United States a declined applicant must be told the principal reasons, and other jurisdictions have their ' +
         'own version of the same duty. With an additive card this is arithmetic rather than interpretation: compare each ' +
         'variable\'s points against a neutral reference, and rank what cost them the most.' },
    { code: 'def reason_codes(points, reference, top=4):\n    """points and reference: {variable: points}. Reference is usually the\n    best achievable bin, or the population mean."""\n    gaps = {v: reference[v] - points[v] for v in points}\n    ranked = sorted(gaps.items(), key=lambda kv: kv[1], reverse=True)\n    return [v for v, gap in ranked[:top] if gap > 0]', lang: 'python' },
    { code: 'Declined at 512 points, cut off 540.\n  1. debt to income above 0.31            -34 points\n  2. two or more prior arrears            -21 points\n  3. income below 28,000                  -11 points\n  4. loan purpose: debt consolidation      -6 points', lang: 'text', label: 'what the applicant is entitled to be told' },
    { p: 'Write those four lines in words a person can act on. "Your existing debt is high relative to your income" is a ' +
         'reason. "Your WOE for the DTI attribute was negative" is a way of not answering.' },

    { h: 'Proxies, and testing for them' },
    { p: 'Age and region are in this dataset and neither earns a place: their information value is under 0.01. That is ' +
         'convenient. The uncomfortable case is a variable that does carry signal and also carries a protected ' +
         'characteristic, and the only way to know is to measure it.' },
    { ol: [
      'Split the test set by each protected group you can identify.',
      'Compare **approval rate** at your cut off, and compare **bad rate among the approved**.',
      'A lower approval rate with the same bad rate means the score is working the same way for everybody and the groups differ. A lower approval rate with a **lower** bad rate among those approved means the card is holding that group to a higher standard, which is the thing to fix.',
      'Record the numbers, the date and the decision, because the first question after an accusation is what you knew and when.'
    ]},
    { warn: 'Removing the protected attribute from the model does not remove the problem. Postcode, employer, school, and ' +
            'shopping category can all reconstruct it, which is why the test is on outcomes rather than on inputs.' },

    { h: 'The model is a document, not a file' },
    { p: 'A model that goes in front of customers ships with a written record, and a validator reads that record before ' +
         'anybody reads your code. It is not bureaucracy; it is the thing that makes the model defensible in two years ' +
         'when you have left.' },
    { ul: [
      '**Definitions**: good, bad, indeterminate, exclusions, the window, the sample and the dates it covers.',
      '**The card itself**: every variable, every bin, every point value.',
      '**Performance**: Gini on train and test, the score band table, and the population you measured it on.',
      '**Fairness**: the outcome comparison above, with the numbers.',
      '**Monitoring**: what you will watch, how often, and what number triggers a rebuild.'
    ]},
    { p: 'The monitoring number to know is the **population stability index**, which compares the distribution of scores ' +
         'today against the distribution when the card was built. Under 0.1 is stable, 0.1 to 0.25 needs watching, and ' +
         'above 0.25 means the people applying are not the people you built this for.' },
    { code: 'PSI = sum over bands of (actual% - expected%) x ln(actual% / expected%)', lang: 'text' },
    { check: {
      q: 'Six months after launch, PSI on the score is 0.31 and the Gini is unchanged. What has happened, and is the model ' +
         'broken?',
      a: 'The population has shifted: marketing changed, a channel opened, or a competitor left, and the people applying now ' +
         'are distributed differently across the score bands. The model is not broken, because it still ranks risk as well ' +
         'as it did, which is what the steady Gini says. What is broken is the policy built on top of it: your cut off was ' +
         'set to approve a certain share of a population that no longer exists, so volumes and the approved bad rate will ' +
         'both have moved. Recalibrate the cut off now and schedule a rebuild.'
    }}
  ],

  tutorial: {
    intro: 'Back to a notebook, or a script, whichever suits you: this level is analysis rather than a service. ' +
           'pandas, numpy and scikit-learn only. The dataset is 8,000 synthetic applications with a twelve month outcome, ' +
           'generated for this course.',
    steps: [
      {
        t: 'Load the book and split it before you look',
        blocks: [
          { code: 'import pandas as pd\nfrom sklearn.model_selection import train_test_split\n\nURL = "{{RAW}}/data/level-14-applications.csv"\ndf = pd.read_csv(URL)\nprint(df.shape)                       # (8000, 13)\nprint(df.defaulted_12m.mean())        # 0.0999\n\ntrain, test = train_test_split(\n    df, test_size=0.3, random_state=7, stratify=df.defaulted_12m\n)', lang: 'python' },
          { p: 'Split first, then explore the training half only. Every bin edge, every WOE and every decision in this level ' +
               'comes from `train`, and `test` stays sealed until the end. That is the level 8 lesson applied to a technique ' +
               'that makes it very easy to cheat.' }
        ],
        check: 'The book is 8,000 rows with a 9.99% bad rate, and the split is stratified.'
      },
      {
        t: 'Bin a variable and compute weight of evidence',
        blocks: [
          { code: 'import numpy as np\n\ndef woe_table(frame, col, bins=5, target="defaulted_12m"):\n    d = frame[[col, target]].copy()\n    if d[col].dtype == object or d[col].nunique() <= 6:\n        d["bin"] = d[col].astype(str)\n        edges = None\n    else:\n        d["bin"], edges = pd.qcut(d[col], bins, duplicates="drop", retbins=True)\n\n    g = d.groupby("bin", observed=True)[target].agg(["count", "sum"])\n    g.columns = ["n", "bad"]\n    g["good"] = g.n - g.bad\n    g["bad_rate"] = g.bad / g.n\n    g["woe"] = np.log((g.good / g.good.sum()) / (g.bad / g.bad.sum()))\n    g["iv"] = ((g.good / g.good.sum()) - (g.bad / g.bad.sum())) * g.woe\n    return g, edges\n\ntable, edges = woe_table(train, "dti")\nprint(table.round(4))\nprint("IV", round(table.iv.sum(), 4))', lang: 'python' },
          { tip: 'Look at the WOE column before anything else. If it does not move in one direction as the variable rises, ' +
                 'either the relationship is genuinely not monotonic or your bins are too fine. Merge and look again.' }
        ],
        check: 'The DTI table has five bins, bad rates rising from about 3.6% to about 24%, and an IV near 0.61.'
      },
      {
        t: 'Rank every candidate by information value',
        blocks: [
          { code: 'CANDIDATES = ["dti", "prior_defaults", "income", "inquiries_6m",\n              "employment_years", "term_months", "purpose", "age", "region"]\n\nivs = {}\nfor col in CANDIDATES:\n    table, _ = woe_table(train, col)\n    ivs[col] = round(table.iv.sum(), 4)\n\nfor col, iv in sorted(ivs.items(), key=lambda kv: -kv[1]):\n    print(f"{col:<18} {iv:.4f}")', lang: 'python' },
          { p: 'Then decide, and write down why. Keep the strong ones, keep a weak one only if it is stable and adds ' +
               'something the others do not, and drop age and region whatever they score: one is protected in most places ' +
               'and the other is a proxy waiting to happen.' }
        ],
        check: 'DTI leads near 0.61, prior defaults and income follow, and age and region are under 0.01.'
      },
      {
        t: 'Apply the training bins to both halves',
        blocks: [
          { code: 'def fit_binning(train, cols):\n    """Learn the edges and the WOE map on train only."""\n    spec = {}\n    for col in cols:\n        table, edges = woe_table(train, col)\n        spec[col] = {"edges": edges, "woe": table["woe"].to_dict()}\n    return spec\n\ndef transform(frame, spec):\n    out = pd.DataFrame(index=frame.index)\n    for col, s in spec.items():\n        if s["edges"] is None:\n            key = frame[col].astype(str)\n        else:\n            key = pd.cut(frame[col], s["edges"], include_lowest=True)\n        out[col] = key.map(s["woe"]).astype(float).fillna(0.0)\n    return out\n\nFEATURES = ["dti", "prior_defaults", "income", "term_months", "purpose"]\nspec = fit_binning(train, FEATURES)\nX_train, X_test = transform(train, spec), transform(test, spec)', lang: 'python' },
          { warn: 'A value in the test set outside every training bin maps to nothing. Filling with 0.0 means neutral, which ' +
                  'is the safe default, and counting how often it happens is worth a line of code: a lot of them means your ' +
                  'bins do not cover the world.' }
        ],
        check: 'transform() returns one WOE column per feature for both halves, using edges learned only on train.'
      },
      {
        t: 'Fit, and report the honest number',
        blocks: [
          { code: 'from sklearn.linear_model import LogisticRegression\nfrom sklearn.metrics import roc_auc_score\n\nmodel = LogisticRegression(max_iter=1000).fit(X_train, train.defaulted_12m)\n\nfor name, X, y in [("train", X_train, train.defaulted_12m),\n                   ("test", X_test, test.defaulted_12m)]:\n    auc = roc_auc_score(y, model.predict_proba(X)[:, 1])\n    print(f"{name:<6} AUC {auc:.3f}  Gini {2 * auc - 1:.3f}")\n\nprint(dict(zip(FEATURES, model.coef_[0].round(3))))', lang: 'python' },
          { p: 'You should see roughly 0.785 on train and 0.771 on test. A small gap is healthy. A large one means the bins ' +
               'are too fine and the model has memorised them.' }
        ],
        check: 'Test Gini is around 0.54, and every coefficient has the sign the WOE construction implies.'
      },
      {
        t: 'Turn it into a card',
        blocks: [
          { code: 'import numpy as np\n\nPDO, TARGET_SCORE, TARGET_ODDS = 20, 600, 50\nfactor = PDO / np.log(2)                       # 28.854\noffset = TARGET_SCORE - factor * np.log(TARGET_ODDS)   # 487.1\n\ndef score(probabilities):\n    odds_good = (1 - probabilities) / probabilities\n    return offset + factor * np.log(odds_good)\n\ntest_scores = score(model.predict_proba(X_test)[:, 1])', lang: 'python' },
          { p: 'Then the points per bin, which is what a credit officer actually receives. Each bin contributes its WOE times ' +
               'the variable\'s coefficient times the factor, and the intercept is spread across the variables.' },
          { code: 'def card(spec, model, features):\n    rows = []\n    n = len(features)\n    for coef, col in zip(model.coef_[0], features):\n        for bin_label, woe in spec[col]["woe"].items():\n            points = -(coef * woe + model.intercept_[0] / n) * factor + offset / n\n            rows.append({"variable": col, "bin": str(bin_label), "points": round(points)})\n    return pd.DataFrame(rows)\n\nprint(card(spec, model, FEATURES).to_string(index=False))', lang: 'python' }
        ],
        check: 'Scores land roughly between 450 and 615, and summing the card points for an applicant reproduces their score.'
      },
      {
        t: 'Band it, and look at the bad rates',
        blocks: [
          { code: 'bands = pd.cut(test_scores, [-np.inf, 540, 580, 620, np.inf],\n               labels=["<540", "540-580", "580-620", "620+"])\nsummary = (pd.DataFrame({"band": bands, "bad": test.defaulted_12m.values})\n           .groupby("band", observed=True)["bad"]\n           .agg(["count", "mean"]))\nsummary["bad_rate"] = (summary["mean"] * 100).round(1)\nprint(summary.drop(columns="mean"))', lang: 'python' },
          { p: 'Below 540 the bad rate is about 24.8%, between 540 and 580 about 7.8%, and between 580 and 620 about 2.5%. ' +
               'That monotonic drop is the model working. A band where the rate goes back up is a problem to chase.' }
        ],
        check: 'The bad rate falls as the score rises, with no reversals.'
      },
      {
        t: 'Reason codes and the fairness check',
        blocks: [
          { code: 'def reasons(applicant_points, best_points, top=4):\n    gaps = {v: best_points[v] - applicant_points[v] for v in applicant_points}\n    return sorted(((v, round(g)) for v, g in gaps.items() if g > 0),\n                  key=lambda kv: -kv[1])[:top]', lang: 'python' },
          { p: 'Then the outcome comparison. The dataset has no protected attribute in it, which is deliberate, so use region ' +
               'as a stand in for the mechanics and write the paragraph explaining that a real review uses the real ones.' },
          { code: 'approved = test_scores >= 540\nreview = (pd.DataFrame({"group": test.region.values,\n                        "approved": approved,\n                        "bad": test.defaulted_12m.values})\n          .groupby("group")\n          .agg(approval_rate=("approved", "mean"),\n               bad_rate_of_approved=("bad", lambda s: s[approved[s.index]].mean())))\nprint(review.round(4))', lang: 'python' },
          { tip: 'Similar approval rates and similar bad rates among the approved is the boring result you want. Report it ' +
                 'either way, with the date, because a fairness test you ran and did not record is a fairness test you ' +
                 'cannot prove you ran.' }
        ],
        check: 'Four reason codes come out ranked by points lost, and the fairness table shows both rates per group.'
      }
    ]
  },

  glossary: [
    { t: 'Scorecard', d: 'A points table: every bin of every variable carries points, and an applicant\'s score is the sum.' },
    { t: 'Good and bad', d: 'The outcome definition, usually ninety days past due within a fixed window. A choice, not a fact.' },
    { t: 'Performance window', d: 'How long an account is watched before it is labelled. Should match the life of the product.' },
    { t: 'Indeterminate', d: 'Accounts that are neither clean nor clearly bad. Excluded from fitting and reported separately.' },
    { t: 'Coarse classing', d: 'Cutting a variable into a few wide bins, trading a little separation for a lot of stability.' },
    { t: 'Weight of evidence', d: 'ln(good share / bad share) in a bin. Positive is safer than the book, negative is riskier.' },
    { t: 'Information value', d: 'One number per variable saying how much it separates good from bad. Above 0.5, go looking for leakage.' },
    { t: 'Monotonic binning', d: 'Bins arranged so risk moves in one direction. What a credit team expects to see.' },
    { t: 'Gini', d: '2 x AUC - 1. An application scorecard in the fifties is normal; in the nineties is leakage.' },
    { t: 'PDO', d: 'Points to double the odds. With PDO 20, twenty more points means half the odds of going bad.' },
    { t: 'Factor and offset', d: 'The two constants that turn log odds into points. factor = PDO / ln 2.' },
    { t: 'Cut off', d: 'The score at which you decline. A business decision made from the value of an approval and the cost of a default.' },
    { t: 'Reason code', d: 'The principal reasons for a decline, ranked by points lost against a reference. A legal requirement in many places.' },
    { t: 'Proxy', d: 'A variable that carries a protected characteristic without naming it. Found by testing outcomes, not inputs.' },
    { t: 'PSI', d: 'Population stability index. Under 0.1 stable, over 0.25 the applicants are not the ones you built for.' }
  ],

  quiz: [
    { q: 'Why do lenders still use a scorecard when a boosted tree scores better?',
      options: [
        'Trees cannot handle missing values',
        'Because a decline has to be explained, justified years later and validated before launch',
        'Because logistic regression is faster to train',
        'Because regulators ban machine learning'
      ],
      answer: 1,
      why: 'The industry pattern is a scorecard for the decision and a stronger model where the explanation duty is lighter.' },

    { q: 'What does a weight of evidence of +1.10 for a bin mean?',
      options: [
        'The bin contains 110% of the expected goods',
        'The bin is riskier than the book',
        'The bin is safer than the book',
        'The variable is not useful'
      ],
      answer: 2,
      why: 'WOE is ln(good share / bad share). Positive means the bin holds proportionally more goods than the book average.' },

    { q: 'A variable comes out with an information value of 0.9. What is the right response?',
      options: [
        'Use it immediately, it is the best predictor you have',
        'Check whether the value was knowable at the moment of the decision',
        'Drop it automatically',
        'Split it into more bins'
      ],
      answer: 1,
      why: 'Above 0.5 is a prompt, not a verdict. Something like a count of collection calls scores enormously and is only high because the account was already going bad.' },

    { q: 'Why are bin edges learned on the training set and applied unchanged to the test set?',
      options: [
        'To save computation',
        'Because pandas cannot recompute them',
        'Because the test set is smaller',
        'Because refitting them on the test set leaks the answer into the validation'
      ],
      answer: 3,
      why: 'Same rule as level 8. Anything learned from the test set makes the test result optimistic by an amount you cannot estimate.' },

    { q: 'A bin holds ninety applications out of eight thousand. What should you usually do?',
      options: [
        'Merge it with a neighbouring bin',
        'Keep it, because it has the strongest WOE',
        'Drop those applications',
        'Give it a WOE of zero'
      ],
      answer: 0,
      why: 'A thin bin gives an unstable WOE that will swing at the next refit. Coarse classing trades separation for stability on purpose.' },

    { q: 'A twelve month performance window is shortened to six. What happens to the model?',
      options: [
        'It becomes more accurate because the data is fresher',
        'Nothing, the ranking is unchanged',
        'Borrowers who fail in months seven to twelve are labelled good, and the model learns to approve slow failures',
        'The bad rate rises'
      ],
      answer: 2,
      why: 'The window should match the life of the product, not how quickly you would like to retrain.' },

    { q: 'What is the Gini coefficient of a model with AUC 0.771?',
      options: [
        '0.771',
        '0.229',
        '0.386',
        '0.542'
      ],
      answer: 3,
      why: 'Gini is 2 x AUC - 1. The fifties are normal for an application scorecard; the nineties mean leakage until proven otherwise.' },

    { q: 'With PDO 20, what does twenty more points mean?',
      options: [
        'Half the odds of going bad',
        'Twice the probability of approval',
        'Twenty percent lower risk',
        'A one grade improvement'
      ],
      answer: 0,
      why: 'Points to double the odds is the scale constant. It is what makes a score readable across an organisation without anybody quoting a log odds.' },

    { q: 'A coefficient comes out with the opposite sign to the one the WOE construction implies. What is it usually?',
      options: [
        'Evidence of a genuine reversal in risk',
        'Two correlated variables fighting',
        'A bug in scikit-learn',
        'Proof that the variable should be squared'
      ],
      answer: 1,
      why: 'Credit teams will not ship a card that says more income raises your risk. Drop one of the pair rather than explaining it away.' },

    { q: 'What is a reason code?',
      options: [
        'An internal error code for the underwriting system',
        'The principal reasons for a decline, ranked by points lost',
        'The bin label with the strongest WOE',
        'A code identifying which model version scored the application'
      ],
      answer: 1,
      why: 'With an additive card it is arithmetic: compare each variable against a reference and rank the gaps. Written in words the applicant can act on.' },

    { q: 'Removing age and postcode from the model means it cannot discriminate. True?',
      options: [
        'True, the attributes are gone',
        'True, provided the data was anonymised',
        'False: employer, school and shopping behaviour can reconstruct them, so the test is on outcomes',
        'False, but only for models with more than ten variables'
      ],
      answer: 2,
      why: 'Compare approval rates and the bad rate among the approved, by group. A lower approval rate with a lower bad rate means that group is being held to a higher standard.' },

    { q: 'PSI on the score is 0.31 and the Gini is unchanged. What has happened?',
      options: [
        'The model has stopped ranking risk',
        'The population applying has shifted, so the policy built on the old distribution needs recalibrating',
        'The score has been miscalculated',
        'Nothing worth acting on'
      ],
      answer: 1,
      why: 'A steady Gini says the ranking still works. The cut off was set to approve a share of a population that no longer exists.' },

    { q: 'Where should the cut off come from?',
      options: [
        'The score that maximises accuracy',
        'The median score of the applicants',
        'Whatever the model author thinks is prudent',
        'The value of an approved good account against the cost of an approved bad one'
      ],
      answer: 3,
      why: 'With a ten percent bad rate, approving nobody is ninety percent accurate and earns nothing. Bring the band table and ask for the two figures.' },

    { q: 'Why is a missing value given its own bin rather than being filled with the mean?',
      options: [
        'Because pandas cannot compute a mean with nulls',
        'Because "we could not find out" is itself information about the applicant',
        'Because it keeps the bins equal in size',
        'Because regulators require it'
      ],
      answer: 1,
      why: 'Missingness often carries as much signal as the value would have. Filling it with an average throws that away and quietly invents data.' },

    { q: 'What belongs in the model document that does not belong in the notebook?',
      options: [
        'The definitions, the card, the fairness numbers and the monitoring plan',
        'The training code',
        'The raw data',
        'The library versions'
      ],
      answer: 0,
      why: 'A validator reads the document before the code, and it is what makes the model defensible in two years when you have left.' }
  ],

  project: {
    title: 'The application scorecard',
    story: 'A credit union will lend to members and wants a scorecard they can put in front of their regulator. They need ' +
           'the card, the numbers behind it, the reasons an applicant is told when they are declined, and the plan for ' +
           'noticing when it stops working.',
    scope: 'Uses this level plus level 6 (credit ratios and the five Cs), level 8 (splitting, thresholds, precision and ' +
           'recall) and level 3 (pandas). pandas, numpy and scikit-learn only: no boosting library, because the deliverable ' +
           'is a card rather than a score.',
    dataset: '{{RAW}}/data/level-14-applications.csv',
    requirements: [
      'A stratified train and test split made before any exploration, with the random state written down',
      'woe_table(frame, col) returning n, bad, bad rate, WOE and IV per bin, for numeric and categorical variables',
      'An information value ranking of all nine candidate variables, with your keep or drop decision and one line of reasoning each',
      'Binning fitted on train only and applied unchanged to test, with a count of test values that fell outside every training bin',
      'Monotonic bins for every numeric variable in the final model, with any merges you made and why',
      'A logistic regression on WOE, reporting AUC and Gini on both halves, and a check that every coefficient has the expected sign',
      'Scaling to points with PDO 20, 600 points at 50 to 1 odds, and a printed card of every variable, bin and point value',
      'A score band table on the test set showing volume and bad rate, with no reversals',
      'reason_codes(applicant) returning the top four reasons for a decline, in words rather than variable names',
      'A fairness section comparing approval rate and bad rate among the approved across groups, with the numbers recorded',
      'A monitoring plan naming PSI, its thresholds, what you would watch monthly, and what triggers a rebuild',
      'A model document as MODEL.md covering definitions, the card, performance, fairness and monitoring',
      'The repository in your GitHub portfolio as finquest-scorecard'
    ],
    starter: {
      lang: 'python',
      code: '"""FinQuest level 14: the application scorecard.\n\nLayout:\n  scorecard/binning.py    woe_table, fit_binning, transform\n  scorecard/model.py      fit, evaluate, scale_to_points, build_card\n  scorecard/reasons.py    reason_codes\n  scorecard/fairness.py   the outcome comparison\n  scorecard/monitor.py    psi\n  MODEL.md                the document a validator reads first\n"""\n\nimport numpy as np\nimport pandas as pd\n\nURL = "{{RAW}}/data/level-14-applications.csv"\nTARGET = "defaulted_12m"\nPDO, TARGET_SCORE, TARGET_ODDS = 20, 600, 50\n\n\ndef woe_table(frame, col, bins=5, target=TARGET):\n    """n, bad, bad_rate, woe and iv per bin. Numeric or categorical."""\n    # TODO\n    pass\n\n\ndef fit_binning(train, cols):\n    """Learn edges and WOE maps on the training half only."""\n    # TODO\n    pass\n\n\ndef transform(frame, spec):\n    """Apply a fitted binning. Unseen values map to neutral, and are counted."""\n    # TODO\n    pass\n\n\ndef evaluate(model, X, y):\n    """AUC and Gini."""\n    # TODO\n    pass\n\n\ndef scale_to_points(probabilities, pdo=PDO, target_score=TARGET_SCORE, target_odds=TARGET_ODDS):\n    # TODO\n    pass\n\n\ndef build_card(spec, model, features):\n    """One row per variable and bin, with the points it contributes."""\n    # TODO\n    pass\n\n\ndef reason_codes(applicant_points, reference_points, top=4):\n    """The principal reasons for a decline, ranked by points lost."""\n    # TODO\n    pass\n\n\ndef psi(expected, actual, bands):\n    """Population stability index between two score distributions."""\n    # TODO\n    pass\n'
    },
    tests: [
      'The book is 8,000 applications with a 9.99% bad rate',
      'The DTI table has five bins with bad rates rising from about 3.6% to about 24.5%, and IV near 0.609',
      'Prior defaults has IV near 0.340 and income near 0.304',
      'Age and region both come out under 0.01 and are excluded from the model',
      'Test AUC is about 0.77 and Gini about 0.54, with a train to test gap under 0.03',
      'Every coefficient in the final model has the sign the WOE construction implies',
      'factor is 28.854 and offset is 487.1 for PDO 20 at 600 points and 50 to 1 odds',
      'Summing the card points for any applicant reproduces the score from the model within a point',
      'The band table shows bad rates falling as the score rises, with no reversals',
      'reason_codes returns at most four reasons, all with a positive points gap, ordered largest first',
      'psi() returns near zero when a distribution is compared with itself'
    ],
    rubric: [
      { pts: 25, t: 'Correct technique', d: 'WOE and IV computed right, bins fitted on train only, monotonic where it matters, thin bins merged.' },
      { pts: 20, t: 'An honest result', d: 'Both halves reported, the gap small, the Gini plausible, and the leakage question asked of the strongest variable.' },
      { pts: 20, t: 'A usable card', d: 'Points scaled with stated constants, printed per bin, and reproducing the model score when summed.' },
      { pts: 20, t: 'Decisions somebody can defend', d: 'Reason codes in words, a fairness comparison with numbers, and a cut off framed as a business decision rather than an accuracy maximum.' },
      { pts: 15, t: 'Documented', d: 'MODEL.md covers definitions, the card, performance, fairness and monitoring. A validator could read it without you.' }
    ],
    stretch: [
      'Add a reject inference section explaining why a scorecard trained only on approved applicants is biased, and implement one simple method',
      'Refit on the first half of the sample by date and measure the Gini on the second half, which is a harder and more honest test than a random split',
      'Add a challenger gradient boosted model, compare Gini, and write the paragraph on why the scorecard still ships',
      'Compute PSI per variable as well as on the score, and say what a stable score with an unstable variable would mean'
    ],
    solutionPath: 'solutions/level-14'
  },

  faq: [
    { q: 'Why fit on WOE rather than on the raw numbers?',
      a: 'Because it makes the relationship linear in log odds by construction, handles outliers and missing values, and produces a card that is additive in points. The cost is that you lose within bin detail, which is the trade coarse classing is named after.' },
    { q: 'How many bins?',
      a: 'Usually three to six. Enough to see the shape, few enough that every bin holds a few percent of the book and will still be there at the next refit.' },
    { q: 'My WOE is infinite for one bin',
      a: 'The bin has no bads or no goods. Merge it with a neighbour. Adding a small constant to both counts is a common alternative and hides the same problem.' },
    { q: 'Is Gini 0.54 good?',
      a: 'It is normal for an application scorecard, which is deciding about a stranger. Behavioural scorecards on existing customers run higher because they can see how the account has been handled.' },
    { q: 'Can I use age if it is predictive?',
      a: 'In many jurisdictions no, and where it is allowed it invites the question anyway. In this dataset it carries almost nothing, which makes the decision easy; when it does carry something, that is exactly when you should be most careful.' },
    { q: 'What is reject inference?',
      a: 'The problem that you only see outcomes for the applicants you approved, so the model is trained on a biased sample. It has a literature and no clean answer. Knowing the problem exists is the level 14 requirement; solving it is the stretch.' },
    { q: 'Where does the cut off actually come from?',
      a: 'From the business. Bring the band table, the expected volume at each cut off, and ask what an approved good account earns and what an approved bad one costs. Then it is arithmetic.' }
  ]
});
