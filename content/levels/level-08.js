/* =========================================================================
   Level 8: fraud detection
   ========================================================================= */
FQ.registerLevel({
  id: 8,
  codename: 'fraud desk',
  title: 'Fraud detection and decision thresholds',
  tagline: 'Catching 98% of fraud is the easy part. Doing it without blocking 1,454 honest customers is the real job.',
  difficulty: 8,
  minutes: 180,
  tags: ['features', 'precision/recall', 'thresholds', 'ML'],
  summary: 'Fraud is 1.8% of this dataset, so a model that never flags anything is 98.2% accurate and completely useless. ' +
           'This level builds a scoring engine, measures it honestly, and tunes the threshold against money rather than a metric.',

  objectives: [
    'Engineer fraud features: velocity, card-not-present, geography, time of day',
    'Explain why accuracy is the wrong metric under class imbalance',
    'Read a confusion matrix and compute precision, recall, and F1',
    'Tune a decision threshold against a business cost, not a leaderboard score',
    'Train and evaluate a logistic regression without leaking test data',
    'Justify when a transparent rule engine beats a more accurate model'
  ],

  knowledge: [
    { h: 'The shape of the problem' },
    { p: 'In this level\'s 6,000 transactions, **108 are fraud: 1.8%**. That imbalance changes everything about how you ' +
         'build and judge a detector.' },
    { code: 'always_predict_legit  ->  accuracy = 98.2%\n                          fraud caught = 0\n                          business value = negative', lang: 'text', label: 'why accuracy is a trap' },
    { warn: 'Any time someone reports a fraud model with 99% accuracy, your first question is the base rate. ' +
            'Under imbalance, accuracy measures how common the majority class is, not how good your model is.' },

    { h: 'Features: turning a row into evidence' },
    { p: 'A raw transaction says little on its own. **Feature engineering** is the act of computing the columns that ' +
         'actually separate fraud from normal behaviour. Here is what separates them in this dataset:' },
    { table: {
      head: ['Feature', 'Legitimate', 'Fraud', 'Signal'],
      rows: [
        ['Average amount', '$31.85', '$167.25', 'Strong'],
        ['Card present', '61.1%', '3.7%', '**Very strong**'],
        ['Foreign country', '6.0%', '69.4%', '**Very strong**'],
        ['Between midnight and 6am', '5.5%', '33.3%', 'Strong'],
        ['Transactions in the last hour', '0.55', '3.66', '**Very strong**'],
        ['Travel / electronics / gaming', '38%', '76%', 'Moderate']
      ]
    }},
    { p: 'None of these is proof. Plenty of honest people buy electronics abroad at 2am. That is exactly why a single rule ' +
         'is a bad detector and a *combination* of weak signals is a good one.' },
    { money: '**Velocity** (how many transactions happened in the last hour) is the highest-value feature in real card ' +
             'fraud, because a stolen card gets tested fast: a small purchase to check it works, then rapid large ones. ' +
             'It also requires state your system must keep, which is why it is the feature junior implementations skip.' },

    { h: 'The confusion matrix' },
    { code: '                     predicted\n                 legit      fraud\nactual legit      TN         FP      <- annoyed customer\nactual fraud      FN         TP      <- money gone', lang: 'text' },
    { table: {
      head: ['Metric', 'Formula', 'The question it answers'],
      rows: [
        ['**Precision**', 'TP / (TP + FP)', 'When we flag, how often are we right?'],
        ['**Recall**', 'TP / (TP + FN)', 'Of all fraud, how much did we catch?'],
        ['**F1**', 'harmonic mean of the two', 'One number when you must have one number'],
        ['Accuracy', '(TP + TN) / all', 'Nearly useless here']
      ]
    }},
    { p: 'The two errors are not symmetrical and never cost the same. A **false negative** is money out the door. ' +
         'A **false positive** is a real customer whose card is declined in front of a queue, and studies of card issuers ' +
         'consistently find false declines cost more in lost business than the fraud they prevent.' },

    { h: 'Precision and recall trade against each other' },
    { p: 'Every detector has a knob: how suspicious must a transaction be before you act? Here is the same rule engine at ' +
         'different thresholds on the same 6,000 rows:' },
    { table: {
      head: ['Threshold', 'Flagged', 'Caught (of 108)', 'False alarms', 'Precision', 'Recall'],
      rows: [
        ['3', '1,560', '106', '1,454', '6.8%', '**98.1%**'],
        ['5', '349', '95', '254', '27.2%', '88.0%'],
        ['6', '160', '88', '72', '55.0%', '81.5%'],
        ['7', '91', '77', '14', '**84.6%**', '71.3%'],
        ['9', '31', '31', '0', '**100%**', '28.7%']
      ]
    }},
    { p: 'At threshold 3 you catch nearly everything and block 1,454 innocent people. At threshold 9 you are never wrong ' +
         'and you miss 71% of the fraud. **There is no setting that is good at both**, which means the choice is a ' +
         'business decision, not a technical one.' },

    { h: 'Tune against money, not F1' },
    { p: 'The right threshold falls out of a cost model. Say a missed fraud costs the transaction amount, and reviewing a ' +
         'flagged transaction costs $4 of an analyst\'s time:' },
    { code: 'total cost = sum(amount of missed fraud) + $4 x (false positives)\n\nthreshold 3:  missed $139    + review $5,816  = $5,955\nthreshold 4:  missed $288    + review $1,780  = $2,068   <- cheapest\nthreshold 6:  missed $1,798  + review $288    = $2,086\nthreshold 7:  missed $2,711  + review $56     = $2,767\nthreshold 9:  missed $8,580  + review $0      = $8,580', lang: 'text', label: 'cost curve' },
    { p: 'The **F1-optimal** threshold here is 7. The **cost-optimal** threshold is 4, which F1 would have told you was ' +
         'mediocre. They disagree because F1 treats both errors as equally bad and your business does not. ' +
         'Always state the costs you assumed; they are the actual model.' },
    { tip: 'Change the review cost to $20 and the optimum moves. That sensitivity is worth showing to stakeholders: ' +
           'it converts "which model is best" into "what do you want to spend".' },

    { h: 'Adding a model' },
    { p: '**Logistic regression** learns a weight for each feature and outputs a probability between 0 and 1. It is the ' +
         'default first model in financial services for one overwhelming reason: **you can explain it**. Each coefficient ' +
         'says how much that feature moves the odds, which satisfies both a regulator and an angry customer.' },
    { code: 'from sklearn.linear_model import LogisticRegression\n\nmodel = LogisticRegression(max_iter=2000, class_weight="balanced")\nmodel.fit(X_train, y_train)\nprobabilities = model.predict_proba(X_test)[:, 1]     # column 1 = P(fraud)', lang: 'python' },
    { p: '`class_weight="balanced"` tells the model that the 1.8% class matters as much as the 98.2% one. Without it, ' +
         'the fastest way to minimise error is to predict "legit" for everything: the same trap as accuracy, now inside the model.' },
    { warn: 'Always split into train and test **before** looking at anything. If you tune a threshold on data the model was ' +
            'trained on, your reported numbers are fiction. This is **leakage**, and it is the most common fatal flaw in ' +
            'student and production ML alike.' },
    { p: 'One more practical note: logistic regression is sensitive to feature scale. `amount` ranges over hundreds while ' +
         '`is_night` is 0 or 1, so the amount coefficient comes out tiny and hard to read. Standardising features ' +
         '(subtract the mean, divide by the standard deviation) makes the coefficients comparable.' },

    { h: 'When rules beat models' },
    { table: {
      head: ['Rules win when', 'Models win when'],
      rows: [
        ['You must explain every decision', 'Patterns are subtle and interact'],
        ['The pattern is known and stable', 'You have lots of labelled history'],
        ['You need it live today', 'You can monitor and retrain it'],
        ['Regulators are watching closely', 'Precision at the margin is worth real money']
      ]
    }},
    { p: 'Real fraud stacks: rules for the obvious and the legally required, a model for the rest, and a human queue for ' +
         'the ambiguous middle. The score your model produces usually routes a case rather than deciding it outright.' },
    { warn: 'A fraud model that declines more transactions from one nationality, postcode, or age group is a ' +
            'discrimination problem, not just a modelling one, and "the model learned it from the data" is not a defence. ' +
            'Check flag rates across groups before shipping, and keep a human review path.' },

    { h: 'A word on this dataset' },
    { p: 'These 6,000 rows are **synthetic and deliberately separable**: a logistic regression reaches an AUC near 0.999 on ' +
         'them, which does not happen in reality. Real card fraud models live around 0.85 to 0.95 AUC against an adversary ' +
         'who changes tactics the moment you catch them. Treat the workflow as real and the score as flattering.' }
  ],

  tutorial: {
    intro: 'New notebook: `finquest-level-08.ipynb`. Pandas, numpy and scikit-learn are all preinstalled in Colab.',
    steps: [
      {
        t: 'Load and confront the imbalance',
        blocks: [
          { code: 'import pandas as pd\nimport numpy as np\n\nURL = "{{RAW}}/data/level-08-transactions.csv"\ndf = pd.read_csv(URL, parse_dates=["timestamp"])\n\nprint(df.shape)                         # (6000, 10)\nprint(df["is_fraud"].value_counts())\nprint(f"base rate: {df[\'is_fraud\'].mean():.2%}")\n\n# the baseline you must beat\nprint(f"accuracy of never flagging: {(df[\'is_fraud\'] == 0).mean():.2%}")', lang: 'python' },
          { p: 'Write that last number at the top of your notebook. Every result you produce later gets compared to it, ' +
               'and any metric that cannot beat "do nothing" is not a result.' }
        ],
        check: 'You can state the base rate (1.80%) and the do-nothing accuracy (98.20%).'
      },
      {
        t: 'Engineer the features',
        blocks: [
          { code: 'df["hour"] = df["timestamp"].dt.hour\ndf["is_night"] = (df["hour"] < 6).astype(int)\ndf["is_foreign"] = (df["country"] != "VN").astype(int)\ndf["card_not_present"] = 1 - df["card_present"]\ndf["high_risk_cat"] = df["category"].isin(["travel", "electronics", "gaming"]).astype(int)\n\n# how well does each feature separate the classes?\nfor col in ["amount", "card_not_present", "is_foreign", "is_night", "txns_last_1h"]:\n    grouped = df.groupby("is_fraud")[col].mean()\n    print(f"{col:<20} legit {grouped[0]:>8.2f}   fraud {grouped[1]:>8.2f}")', lang: 'python' },
          { p: '`.astype(int)` turns True/False into 1/0, which both your rules and the model want. Comparing group means ' +
               'is the cheapest possible feature check and catches useless features before you waste time on them.' }
        ],
        check: 'Fraud shows a mean amount near $167 and a velocity near 3.66 transactions per hour.'
      },
      {
        t: 'Write a transparent rule engine',
        blocks: [
          { p: 'Each rule contributes points, and the reasons are collected as it goes, so the score arrives with its ' +
               'own explanation attached.' },
          { code: 'RULES = [\n    ("large amount",        lambda r: r["amount"] > 150,        2),\n    ("card not present",    lambda r: r["card_not_present"] == 1, 2),\n    ("foreign country",     lambda r: r["is_foreign"] == 1,      3),\n    ("overnight",           lambda r: r["is_night"] == 1,        2),\n    ("high velocity",       lambda r: r["txns_last_1h"] >= 3,    2),\n    ("high-risk category",  lambda r: r["high_risk_cat"] == 1,   1),\n]\n\ndef score_row(row):\n    """Return (score, [reasons]) so every decision can be explained."""\n    score, reasons = 0, []\n    for name, test, points in RULES:\n        if test(row):\n            score += points\n            reasons.append(name)\n    return score, reasons\n\n\ndf["score"] = df.apply(lambda r: score_row(r)[0], axis=1)\ndf["reasons"] = df.apply(lambda r: ", ".join(score_row(r)[1]), axis=1)\nprint(df[["amount", "score", "reasons", "is_fraud"]].head())', lang: 'python' },
          { p: 'A `lambda` is a one-line anonymous function. Keeping the rules in a list like this means adding a rule is ' +
               'one line, and the rulebook can be printed for an auditor.' }
        ],
        check: 'Every row has a score between 0 and 12 and a human-readable reason string.'
      },
      {
        t: 'Evaluate honestly',
        blocks: [
          { code: 'from sklearn.metrics import confusion_matrix, precision_score, recall_score, f1_score\n\ndef evaluate(y_true, y_pred, label=""):\n    tn, fp, fn, tp = confusion_matrix(y_true, y_pred).ravel()\n    precision = precision_score(y_true, y_pred, zero_division=0)\n    recall = recall_score(y_true, y_pred)\n    print(f"{label:<14} flagged {y_pred.sum():>5}  TP {tp:>4}  FP {fp:>5}  FN {fn:>4}"\n          f"  precision {precision:>6.1%}  recall {recall:>6.1%}  F1 {f1_score(y_true, y_pred):>5.3f}")\n    return {"tp": tp, "fp": fp, "fn": fn, "precision": precision, "recall": recall}\n\n\nfor threshold in range(3, 11):\n    evaluate(df["is_fraud"], (df["score"] >= threshold).astype(int), f"threshold {threshold}")', lang: 'python' },
          { p: '`.ravel()` flattens the 2x2 matrix into four numbers in the order tn, fp, fn, tp: memorise that order, ' +
               'it is a classic source of silently inverted metrics.' }
        ],
        check: 'Threshold 7 gives 84.6% precision and 71.3% recall; threshold 3 flags 1,560 transactions.'
      },
      {
        t: 'Tune the threshold with a cost model',
        blocks: [
          { code: 'REVIEW_COST = 4.0        # analyst time per flagged transaction\n\ndef total_cost(data, threshold, review_cost=REVIEW_COST):\n    flagged = data["score"] >= threshold\n    missed = data.loc[~flagged & (data["is_fraud"] == 1), "amount"].sum()\n    reviews = (flagged & (data["is_fraud"] == 0)).sum() * review_cost\n    return missed + reviews, missed, reviews\n\n\nbest = None\nfor threshold in range(3, 13):\n    total, missed, reviews = total_cost(df, threshold)\n    print(f"threshold {threshold:>2}: missed ${missed:>9,.0f}  reviews ${reviews:>8,.0f}  total ${total:>9,.0f}")\n    if best is None or total < best[1]:\n        best = (threshold, total)\n\nprint(f"\\ncheapest threshold: {best[0]} at ${best[1]:,.0f}")', lang: 'python' },
          { tip: 'Run the sweep again with REVIEW_COST = 20 and watch the optimum move. Showing that sensitivity is what ' +
                 'turns a model into a decision a manager can actually make.' }
        ],
        check: 'Your cheapest threshold is 4 at about $2,068, with threshold 6 close behind.'
      },
      {
        t: 'Train a model without leaking',
        blocks: [
          { code: 'from sklearn.model_selection import train_test_split\nfrom sklearn.linear_model import LogisticRegression\nfrom sklearn.preprocessing import StandardScaler\nfrom sklearn.metrics import roc_auc_score\n\nFEATURES = ["amount", "card_not_present", "is_foreign", "is_night",\n            "txns_last_1h", "high_risk_cat", "hours_since_prev_txn"]\n\nX = df[FEATURES]\ny = df["is_fraud"]\n\nX_train, X_test, y_train, y_test = train_test_split(\n    X, y, test_size=0.3, random_state=42, stratify=y)\n\nscaler = StandardScaler().fit(X_train)          # fit on the training split only\nX_train_s = scaler.transform(X_train)\nX_test_s = scaler.transform(X_test)\n\nmodel = LogisticRegression(max_iter=2000, class_weight="balanced")\nmodel.fit(X_train_s, y_train)\n\nprobabilities = model.predict_proba(X_test_s)[:, 1]\nprint(f"AUC: {roc_auc_score(y_test, probabilities):.3f}")', lang: 'python' },
          { p: '`stratify=y` keeps the same 1.8% fraud rate in both halves: without it a random split can leave your test ' +
               'set with almost no fraud, and every metric becomes noise. Fitting the scaler on the training set only is ' +
               'the other half of not leaking.' }
        ],
        check: 'AUC is around 0.99. High because this data is synthetic, as the knowledge page warns.'
      },
      {
        t: 'Read the coefficients out loud',
        blocks: [
          { code: 'coefs = pd.Series(model.coef_[0], index=FEATURES).sort_values(key=abs, ascending=False)\nprint(coefs.round(3))\n\nfor name, value in coefs.items():\n    direction = "increases" if value > 0 else "decreases"\n    print(f"A higher {name} {direction} the estimated fraud odds.")', lang: 'python' },
          { p: 'Because you standardised the features, these coefficients are comparable: the biggest absolute value is the ' +
               'strongest driver. This paragraph (in English, from the model) is what makes logistic regression acceptable ' +
               'in a regulated product.' }
        ],
        check: 'You can name the top three drivers and say which way each pushes the odds.'
      },
      {
        t: 'Produce a review queue, not a verdict',
        blocks: [
          { code: 'test = df.loc[X_test.index].copy()\ntest["probability"] = probabilities\n\nqueue = (test[test["probability"] >= 0.9]\n         .sort_values("probability", ascending=False)\n         [["txn_id", "amount", "country", "probability", "reasons", "is_fraud"]])\n\nprint(f"{len(queue)} cases for review")\nprint(queue.head(10).to_string(index=False))', lang: 'python' },
          { p: 'This is the deliverable an operations team actually wants: a ranked queue with the amount at stake and the ' +
               'reasons attached, highest risk first. A bare 0/1 prediction cannot be worked by a human.' }
        ],
        check: 'Your queue is sorted by probability and each row carries its rule reasons.'
      }
    ]
  },

  glossary: [
    { t: 'Class imbalance', d: 'One outcome is far rarer than the other, making accuracy misleading.' },
    { t: 'Base rate', d: 'The proportion of positives in the data: here 1.8% fraud.' },
    { t: 'Feature engineering', d: 'Creating columns that expose a signal the raw data only implies.' },
    { t: 'Velocity', d: 'How many transactions occurred in a recent window. The strongest card-fraud signal.' },
    { t: 'Card-not-present', d: 'A transaction without the physical card, such as online. Far higher fraud risk.' },
    { t: 'Confusion matrix', d: 'The 2x2 table of true/false positives and negatives.' },
    { t: 'Precision', d: 'TP / (TP + FP). How often a flag is correct.' },
    { t: 'Recall', d: 'TP / (TP + FN). What share of fraud was caught.' },
    { t: 'F1', d: 'Harmonic mean of precision and recall; treats both errors as equally costly.' },
    { t: 'Threshold', d: 'The score above which you act. The main knob trading precision against recall.' },
    { t: 'False decline', d: 'Blocking a legitimate customer. Often costs more than the fraud prevented.' },
    { t: 'Leakage', d: 'Letting test information influence training or tuning, producing fake performance.' },
    { t: 'Stratified split', d: 'Splitting while preserving the class ratio in both halves.' },
    { t: 'class_weight balanced', d: 'Telling a model to weight the rare class up so it cannot ignore it.' },
    { t: 'AUC', d: 'Probability the model ranks a random fraud above a random legitimate transaction.' }
  ],

  quiz: [
    { q: "Fraud is 1.8% of transactions. A model that flags nothing achieves what accuracy?",
      options: [
        "50%",
        "1.8%",
        "98.2%",
        "It cannot be calculated"
      ],
      answer: 2,
      why: "It is right on every legitimate transaction. That is why accuracy is meaningless under imbalance: it measures the base rate, not the model." },

    { q: "What does precision measure?",
      options: [
        "How consistent the model is between runs",
        "The overall proportion of correct predictions",
        "The share of fraud that was caught",
        "How often a flagged transaction really is fraud"
      ],
      answer: 3,
      why: "Precision is TP / (TP + FP): the quality of your flags. Recall is the other question: what share of all fraud you caught." },

    { q: "At threshold 3 the rule engine catches 106 of 108 frauds but raises 1,454 false alarms. What is wrong with shipping it?",
      options: [
        "Precision is 6.8%: over 93% of flagged customers are innocent and would be blocked",
        "Recall is too low",
        "Nothing, catching fraud is the goal",
        "The model is overfitting"
      ],
      answer: 0,
      why: "A false decline is a real customer whose card fails in public. Issuers consistently find false declines cost more in lost business than the fraud they prevent." },

    { q: "Which pair of numbers describes the fundamental trade-off in a detector?",
      options: [
        "Base rate and sample size",
        "Accuracy and AUC",
        "Precision and recall",
        "Training time and model size"
      ],
      answer: 2,
      why: "Raising the threshold improves precision and lowers recall; lowering it does the reverse. No threshold is good at both, so the choice is a business decision." },

    { q: "The F1-optimal threshold here is 7, but the cheapest threshold is 4. Why do they disagree?",
      options: [
        "The cost model ignores recall",
        "A bug in the cost calculation",
        "F1 treats false positives and false negatives as equally costly, and this business does not",
        "F1 is only valid for balanced data"
      ],
      answer: 2,
      why: "F1 is symmetric by construction. Once a missed fraud costs the transaction amount and a review costs $4, the optimum moves. The cost assumptions are the real model." },

    { q: "Which feature is typically the strongest signal in card fraud?",
      options: [
        "The card issuer",
        "Transaction velocity: how many transactions occurred in the last hour",
        "The merchant name",
        "The day of the week"
      ],
      answer: 1,
      why: "Stolen cards get tested and drained quickly: a small probe, then rapid larger purchases. Velocity requires keeping state, which is why weaker implementations omit it." },

    { q: "What does `class_weight=\"balanced\"` do in scikit-learn?",
      options: [
        "Balances precision and recall automatically",
        "Weights the rare class up so the model cannot minimise error by ignoring it",
        "Normalises the feature scales",
        "Splits the data evenly into train and test"
      ],
      answer: 1,
      why: "With a 1.8% positive rate, predicting \"legit\" always is nearly optimal for plain error. Class weighting removes that shortcut." },

    { q: "Why use `stratify=y` in train_test_split?",
      options: [
        "To keep the same fraud rate in both halves so the test set is meaningful",
        "To shuffle the rows",
        "To remove duplicates",
        "To sort by target"
      ],
      answer: 0,
      why: "Without stratification a random split can leave very few frauds in the test set, making every metric computed on it pure noise." },

    { q: "What is data leakage?",
      options: [
        "Missing values in the training set",
        "Losing rows when merging tables",
        "A security breach of customer data",
        "Letting test information influence training or tuning, producing performance that will not hold up"
      ],
      answer: 3,
      why: "Tuning a threshold on data the model trained on reports fiction. Fit scalers on train only, and keep the test set untouched until the end." },

    { q: "`confusion_matrix(y_true, y_pred).ravel()` returns four numbers. In what order?",
      options: [
        "tn, fp, fn, tp",
        "fp, fn, tp, tn",
        "tp, tn, fp, fn",
        "tp, fp, fn, tn"
      ],
      answer: 0,
      why: "tn, fp, fn, tp: reading across the rows of the matrix. Assuming the wrong order silently inverts precision and recall." },

    { q: "Why is logistic regression the default first model in regulated financial services?",
      options: [
        "It is the most accurate model available",
        "It handles imbalance automatically",
        "It needs no training data",
        "Its coefficients are explainable, which regulators and customers both require"
      ],
      answer: 3,
      why: "Explainability is a legal requirement in credit and a practical one in fraud. A model you cannot explain is one you cannot defend when a customer disputes a decline." },

    { q: "Why standardise features before reading logistic regression coefficients?",
      options: [
        "To make training faster",
        "Because unscaled features give coefficients on wildly different scales that cannot be compared",
        "Because sklearn requires it",
        "To remove outliers"
      ],
      answer: 1,
      why: "With amount in the hundreds and is_night as 0/1, the amount coefficient looks tiny regardless of its importance. Standardising makes the magnitudes comparable." },

    { q: "A fraud model declines a far higher share of transactions from one nationality. What is the correct response?",
      options: [
        "Remove all country data and ship",
        "Investigate and fix it: disparate outcomes are a legal and ethical problem, and the data explanation is not a defence",
        "Raise the threshold for everyone",
        "Ship it: the model learned it from the data"
      ],
      answer: 1,
      why: "Fair-lending and consumer-protection law looks at outcomes. Check flag rates across groups before shipping, keep a human review route, and document the decision." },

    { q: "What does an AUC of 0.999 on this dataset tell you?",
      options: [
        "The data is synthetic and unusually separable. Real fraud models sit far lower",
        "AUC is being computed incorrectly",
        "The model is production-ready",
        "The model has memorised the test set"
      ],
      answer: 0,
      why: "Real card fraud models run around 0.85-0.95 against adversaries who adapt. Treat the workflow as realistic and the score as flattering, and say so in your report." },

    { q: "What is the most useful output of a fraud system for an operations team?",
      options: [
        "A binary label on every transaction",
        "The model coefficients",
        "A ranked review queue with the amount at stake and the reasons for each flag",
        "A single overall accuracy figure"
      ],
      answer: 2,
      why: "Humans work queues, not labels. Rank by risk, show the money involved, and attach the reasons so the reviewer can act in seconds rather than investigate from scratch." }
  ],

  project: {
    title: 'Fraud scoring engine',
    story: 'A partner fintech is losing money to card fraud, and blocking far too many real customers while trying ' +
           'to stop it. Build the scoring engine, show what each setting actually costs, and recommend a threshold ' +
           'you would be happy to defend in a meeting.',
    scope: 'Uses this level plus level 3 (pandas) and level 7 (evaluation thinking): feature engineering, a rule engine, ' +
           'sklearn LogisticRegression, train_test_split, StandardScaler, and the metrics shown in the tutorial.',
    dataset: '{{RAW}}/data/level-08-transactions.csv',
    requirements: [
      '`load_and_engineer(url)` producing hour, is_night, is_foreign, card_not_present, and high_risk_cat columns',
      'A printed baseline: base rate and the accuracy of flagging nothing, stated before any model is built',
      'A feature comparison table showing the mean of each feature for fraud vs legitimate rows',
      'A rule engine defined as data (a list of name / test / points) so rules can be added in one line',
      '`score_row(row)` returning both a score and the list of reasons that produced it',
      '`evaluate(y_true, y_pred)` returning TP, FP, FN, precision, recall, and F1',
      'A threshold sweep from 3 to 12 printed as a table of flagged, TP, FP, FN, precision, recall',
      'A cost model with stated assumptions: missed fraud costs the transaction amount, review costs $4',
      'A cost curve identifying the cheapest threshold, plus a sensitivity run at a $20 review cost showing how the answer moves',
      'A stratified train/test split with the scaler fitted on training data only',
      'A logistic regression with class_weight="balanced", reporting AUC on the test set',
      'Standardised coefficients printed in descending absolute order, each translated into one plain English sentence',
      'A comparison of rules vs model at matched recall, and a written recommendation of which to ship and why',
      'A ranked review queue of the top 20 cases with amount, probability, and reasons',
      'A fairness check: flag rate by country, with a sentence on what you would do if it were a protected attribute',
      'A conclusion naming your recommended threshold, its expected weekly cost, and the assumptions it depends on',
      'Saved to your portfolio repo as `level-08-fraud-engine.ipynb`'
    ],
    starter: {
      lang: 'python',
      code: '"""FinQuest level 8: Fraud scoring engine"""\n\nimport numpy as np\nimport pandas as pd\nfrom sklearn.model_selection import train_test_split\nfrom sklearn.linear_model import LogisticRegression\nfrom sklearn.preprocessing import StandardScaler\nfrom sklearn.metrics import confusion_matrix, precision_score, recall_score, f1_score, roc_auc_score\n\nURL = "{{RAW}}/data/level-08-transactions.csv"\nREVIEW_COST = 4.0\nHOME_COUNTRY = "VN"\n\nFEATURES = ["amount", "card_not_present", "is_foreign", "is_night",\n            "txns_last_1h", "high_risk_cat", "hours_since_prev_txn"]\n\nRULES = [\n    # (name, test, points): add rules here, one line each\n]\n\n\ndef load_and_engineer(url=URL):\n    """Load the CSV and build the model features."""\n    # TODO\n    pass\n\n\ndef baseline(df):\n    """Print base rate and do-nothing accuracy before any modelling."""\n    # TODO\n    pass\n\n\ndef feature_comparison(df):\n    """Mean of each feature for fraud vs legitimate."""\n    # TODO\n    pass\n\n\ndef score_row(row):\n    """Return (score, reasons)."""\n    # TODO\n    pass\n\n\ndef apply_rules(df):\n    """Add score and reasons columns."""\n    # TODO\n    pass\n\n\ndef evaluate(y_true, y_pred, label=""):\n    """Print and return tp/fp/fn/precision/recall/f1."""\n    # TODO\n    pass\n\n\ndef threshold_sweep(df, low=3, high=12):\n    # TODO\n    pass\n\n\ndef total_cost(df, threshold, review_cost=REVIEW_COST):\n    """(total, missed_fraud_value, review_spend)"""\n    # TODO\n    pass\n\n\ndef cost_curve(df, review_cost=REVIEW_COST):\n    """Print the cost at each threshold and return the cheapest."""\n    # TODO\n    pass\n\n\ndef train_model(df):\n    """Stratified split, scale on train only, fit, return everything needed."""\n    # TODO\n    pass\n\n\ndef explain_coefficients(model, features):\n    """One plain English sentence per feature, strongest first."""\n    # TODO\n    pass\n\n\ndef review_queue(df, probabilities, index, top=20):\n    """Ranked cases with amount, probability and reasons."""\n    # TODO\n    pass\n\n\ndef fairness_check(df, threshold):\n    """Flag rate by country."""\n    # TODO\n    pass\n\n\ndef report():\n    # TODO\n    pass\n\n\nif __name__ == "__main__":\n    report()\n'
    },
    tests: [
      'The dataset has 6,000 rows with 108 frauds: a base rate of 1.80%',
      'Do-nothing accuracy is 98.20% and appears in your output before any model',
      'Mean amount is about $31.85 for legitimate rows and $167.25 for fraud',
      'card_present is 61.1% of legitimate rows and 3.7% of fraud',
      'With the tutorial rule weights, threshold 6 gives 88 TP, 72 FP, precision 55.0%, recall 81.5%',
      'Threshold 7 gives 77 TP, 14 FP, precision 84.6%, recall 71.3%',
      'Threshold 9 gives precision 100% and recall 28.7%',
      'The cost curve at $4 review cost is cheapest at threshold 4 (about $2,068), with threshold 6 close at about $2,086',
      'Raising the review cost to $20 moves the cheapest threshold: report where it lands',
      'Test AUC is above 0.98 and your report notes why that is unrealistically high',
      'Every flagged row in the review queue carries a non-empty reasons string'
    ],
    rubric: [
      { pts: 20, t: 'Honest evaluation', d: 'Baseline stated first, confusion matrix correct, precision and recall never confused.' },
      { pts: 20, t: 'Threshold economics', d: 'Cost model with stated assumptions, a full sweep, and a sensitivity run that changes the answer.' },
      { pts: 15, t: 'Feature work', d: 'All five engineered features present and justified by the comparison table.' },
      { pts: 15, t: 'Model discipline', d: 'Stratified split, scaler fitted on train only, class weighting, no leakage anywhere.' },
      { pts: 15, t: 'Explainability', d: 'Reasons on every flag, coefficients translated into English, a usable ranked queue.' },
      { pts: 10, t: 'Ethics', d: 'Fairness check performed and its implications discussed rather than waved away.' },
      { pts: 5, t: 'Shipped', d: 'Runs top to bottom and is committed to your portfolio repo.' }
    ],
    stretch: [
      'Add a per-customer velocity feature computed from the timestamps rather than the supplied column',
      'Plot the precision-recall curve and mark your chosen operating point on it',
      'Add a second model (decision tree) and compare its explainability with logistic regression',
      'Simulate an adversary: shift fraud amounts down by 60% and measure how much recall your rules lose'
    ],
    solutionPath: 'solutions/level-08'
  },

  faq: [
    { q: 'My model has 98% accuracy. Is that good?',
      a: 'No. Flagging nothing at all scores 98.2% on this data. Judge it on precision and recall, and compare against that do-nothing baseline.' },
    { q: 'Precision is high but recall is terrible',
      a: 'Your threshold is too strict. Lower it to catch more fraud and accept more false alarms, then use the cost model to decide how far to go.' },
    { q: 'What threshold should I actually pick?',
      a: 'Whichever minimises your stated cost. At a $4 review cost the cheapest here is 4, with 6 almost identical; at $20 the optimum shifts. State the assumption alongside the number.' },
    { q: 'Should I use rules or the model?',
      a: 'Usually both. Rules cover known, explainable, legally required cases; the model ranks the rest; humans work the queue. Compare them at matched recall before deciding.' },
    { q: 'What exactly is leakage and how do I avoid it?',
      a: 'Any test information reaching training or tuning. Split first, fit scalers on the training set only, and do not touch the test set until the final evaluation.' },
    { q: 'My precision and recall look swapped',
      a: 'Check the order from confusion_matrix(...).ravel(): it is tn, fp, fn, tp. Getting that wrong inverts both metrics without any error appearing.' },
    { q: 'Why is my amount coefficient nearly zero?',
      a: 'Unscaled features. Amount ranges over hundreds while the flags are 0/1, so its coefficient is tiny per unit. Standardise before comparing coefficient magnitudes.' }
  ]
});
