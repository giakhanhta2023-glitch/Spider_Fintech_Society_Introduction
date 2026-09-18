/* =========================================================================
   LEVEL 15: fraud detection in production
   ========================================================================= */
FQ.registerLevel({
  id: 15,
  codename: 'decision service',
  title: 'Fraud detection with a stopwatch running',
  tagline: 'Level 8 trained a model on a file. This one answers in under a hundred milliseconds, with features it has to compute while the card is still in the terminal, and tells you when it has started to go wrong.',
  difficulty: 9,
  minutes: 270,
  tags: ['serving', 'latency', 'feature stores', 'drift'],
  summary: 'Training a fraud model is the tenth of the job that fits in a notebook. The rest is a service with a latency ' +
           'budget, features computed the same way at training and at decision time, a policy that turns a score into an ' +
           'action, and monitoring that notices before your customers do.',

  objectives: [
    'Budget a hundred millisecond decision across the work it has to do',
    'Compute velocity features online without reading the whole history',
    'Name and prevent training and serving skew',
    'Turn a score into approve, review or decline using costs rather than a threshold you liked',
    'Run a model in shadow mode and read the comparison honestly',
    'Detect input drift and prediction drift before the labels arrive',
    'Design a kill switch and say what the system does when the model is gone'
  ],

  knowledge: [
    { h: 'The clock is the requirement' },
    { p: 'A card authorisation has a budget. The network, the issuer and the terminal all take their share, and what is ' +
         'left for your decision is usually a hundred milliseconds or less, at the ninety ninth percentile rather than on ' +
         'average. A model that answers in eighty milliseconds for most people and two seconds for one in a hundred has ' +
         'failed, because that one is standing at a till.' },
    { table: {
      head: ['Step', 'Budget', 'Where it goes'],
      rows: [
        ['Parse and validate the request', '2 ms', 'Level 12 already taught this'],
        ['Fetch the customer profile', '10 ms', 'One key lookup, cached'],
        ['Compute velocity features', '15 ms', 'Counters, not queries over history'],
        ['Score the model', '5 ms', 'One vector, no data frame'],
        ['Apply the policy and the rules', '3 ms', 'Arithmetic and a few comparisons'],
        ['Write the decision log', '5 ms', 'Fire and forget, never blocking'],
        ['**Left over**', '**60 ms**', 'Network, queueing, and the day something is slow']
      ]
    }},
    { p: 'Scoring is the cheapest line in that table, which surprises people. Here is the measurement on the level 8 model, ' +
         'taken on a laptop: `predict_proba` on one row takes about **0.10 ms**, and the same arithmetic written as a dot ' +
         'product and a sigmoid takes about **0.003 ms**, thirty times faster.' },
    { code: 'z = dot(features, coefficients) + intercept\np = 1 / (1 + exp(-z))', lang: 'python', label: 'the whole model, at serving time' },
    { p: 'The lesson is not to hand roll every model. It is that scikit-learn objects carry a data frame shaped overhead that ' +
         'does not belong in a request path, and that a logistic regression is a dot product you can ship anywhere.' },
    { check: {
      q: 'Your p50 latency is 30 ms and your p99 is 900 ms. Somebody suggests optimising the model. What do you tell them?',
      a: 'That the model is not the problem. A gap that shape is almost never computation, because computation is steady: it ' +
         'is waiting for something. A connection pool exhausted at peak, a cache miss falling through to a query over the ' +
         'whole transaction history, a garbage collection pause, or one slow dependency without a timeout. Measure the ' +
         'phases separately and the long tail will be in one of them. And whatever it turns out to be, every outbound call ' +
         'in a request path needs a timeout shorter than your budget, because a call with no timeout is a promise to wait ' +
         'forever on somebody else\'s bad day.'
    }},

    { h: 'Features you can compute in fifteen milliseconds' },
    { p: 'Level 8 computed `txns_last_1h` with a groupby over six thousand rows. At decision time you cannot read the ' +
         'history: you need the answer for one customer, now, in a few milliseconds. The answer is to keep counters and ' +
         'update them as transactions arrive.' },
    { code: '# on every authorisation, in the write path\nkey = f"velocity:{customer_id}:{hour_bucket}"\nredis.incr(key)\nredis.expire(key, 3600)\n\n# at decision time, in the read path\nlast_hour = sum(redis.mget(bucket_keys(customer_id, hours=1)) or [0])', lang: 'python' },
    { p: 'Counters in buckets, each expiring on its own, so a one hour window is the sum of the last few buckets and no ' +
         'cleanup job is needed. The same shape gives you amount in the last day, distinct countries in the last week, and ' +
         'first seen device, each one a small write on the way in rather than a large read on the way out.' },
    { money: 'This is what a **feature store** is, under the product names: one place that computes a feature, serves it fast ' +
             'online, and produces the same value offline for training. Building a small one is worth more on a resume than ' +
             'naming three vendors, because it makes the next paragraph obvious.' },

    { h: 'Training and serving skew' },
    { p: 'The failure that ruins fraud systems quietly: the feature means one thing when you train and another when you ' +
         'serve. The model is fine, the data is fine, and every prediction is subtly wrong.' },
    { table: {
      head: ['How it happens', 'Example'],
      rows: [
        ['Two implementations', 'Training uses pandas `groupby`, serving uses a Redis counter, and they disagree on whether the current transaction is counted'],
        ['Different windows', 'Training counts a calendar hour, serving counts the last sixty minutes'],
        ['Different defaults', 'Training fills a missing value with the mean, serving sends zero'],
        ['Time travel', 'The training feature was computed from data that only existed after the transaction'],
        ['Rounding', 'Training keeps cents as float, serving sends integers, and the bins land differently']
      ]
    }},
    { p: 'The fix is structural: one function computes the feature, and both paths call it. Training reads history and ' +
         'replays it through the same code that serving uses live, which also means a bug fix reaches both at once.' },
    { code: 'def velocity_1h(events, now):\n    """One definition. Training replays history through it; serving calls it live."""\n    cutoff = now - timedelta(hours=1)\n    return sum(1 for e in events if cutoff <= e.at < now)      # strictly before now', lang: 'python' },
    { warn: 'Note `e.at < now`. Including the transaction being scored in its own velocity count is the most common ' +
            'point in time bug in fraud features, and it inflates the training signal in a way that vanishes in production.' },
    { check: {
      q: 'Your model scores AUC 0.97 offline and catches almost nothing in the first week live. Name the two most likely ' +
         'causes and how you would tell them apart in an afternoon.',
      a: 'Skew or leakage, and they are close cousins. Take a thousand transactions that have already been decided live, ' +
         'recompute their features offline exactly as training does, and compare the two vectors field by field. If they ' +
         'differ, it is skew, and the differing field names itself. If they match, recompute the offline score from the ' +
         'stored live features and compare to the live score: a match there means the features were honest and something ' +
         'in training knew the future, which sends you back to the point in time question from level 8.'
    }},

    { h: 'From a score to a decision' },
    { p: 'A probability is not an action. Level 8 tuned one threshold against a cost model; production usually has two, ' +
         'because a review queue exists between approve and decline.' },
    { code: 'p < 0.02             approve\n0.02 <= p < 0.35     send to review\np >= 0.35            decline', lang: 'text' },
    { p: 'The two numbers come from the same arithmetic as level 8, with one extra input: the reviewers. A queue has a ' +
         'capacity, and a threshold that sends four thousand cases a day to a team of six is a threshold that declines ' +
         'nothing and reviews nothing, because the queue is a day behind by Tuesday.' },
    { ul: [
      '**Expected loss** of an approval: p x amount, plus the chargeback fee.',
      '**Cost of a review**: the analyst minute, and the fact that a held payment annoys a real customer.',
      '**Cost of a decline**: the margin on the sale, and the customer who now uses another card and does not come back.',
      '**Capacity**: reviews per day the team can clear. A threshold is a promise about volume.'
    ]},
    { p: 'And rules still sit on top of the model, because some decisions are not statistical: a card reported stolen is ' +
         'declined whatever the score says, and a sanctioned counterparty is blocked whatever anyone thinks. The model ' +
         'orders the uncertain middle; rules handle the certain ends.' },
    { check: {
      q: 'Your review threshold sends 1.2% of traffic to a queue. Volume doubles after a marketing campaign and the queue ' +
         'goes from four hours behind to two days. What are your options, and which is the honest one?',
      a: 'Three: raise the review threshold so fewer cases queue, add reviewers, or auto approve the backlog. The last one ' +
         'is what happens by accident when nobody decides, and it is the worst, because the cases being auto approved are ' +
         'the ones the model was least sure about. Raising the threshold is the honest short term move, and it needs to be ' +
         'recorded as a decision with the expected extra loss attached, not quietly edited in a config file. Then either ' +
         'the capacity grows or the threshold stays up, and the business knows which it chose.'
    }},

    { h: 'Shadow mode: the only safe way to launch' },
    { p: 'A new model does not replace the old one on a Tuesday. It runs beside it, scoring every transaction, taking no ' +
         'action, and logging what it would have done. After a week you have a comparison on real traffic that no offline ' +
         'test can give you.' },
    { code: 'decision = current.decide(features)          # this one acts\nshadow = candidate.decide(features)         # this one only writes a line\nlog_decision(txn_id, decision, shadow, features, model_versions)\nreturn decision', lang: 'python' },
    { ol: [
      '**Agreement rate**: how often the two agree at all. A candidate that agrees 99.9% of the time is not worth the risk of shipping; one that agrees 60% needs explaining before anything else.',
      '**Where they differ**: pull a hundred of the disagreements and have a fraud analyst read them. This is the step people skip and the one that finds the embarrassing cases.',
      '**Volume**: how many more reviews and declines the candidate would create, against capacity.',
      '**Latency**: the candidate has to fit the budget too, and a shadow run measures that for free.'
    ]},
    { warn: 'Shadow mode cannot tell you whether the candidate would have caught fraud the current model let through, ' +
            'because you approved those transactions and may never learn they were bad. That gap is why shadow is a safety ' +
            'check rather than an evaluation.' },

    { h: 'You find out you were wrong, slowly' },
    { p: 'The label arrives late. A cardholder notices a fraudulent transaction and disputes it days or weeks later, and ' +
         'the chargeback lands after that. So your ground truth for today is incomplete for a month or more, which changes ' +
         'what you are allowed to measure and when.' },
    { table: {
      head: ['Signal', 'Available', 'What it tells you'],
      rows: [
        ['Input drift, per feature', 'Immediately', 'The traffic has changed'],
        ['Prediction drift', 'Immediately', 'The score distribution has moved'],
        ['Decision mix', 'Immediately', 'Approve, review and decline shares have shifted'],
        ['Review outcomes', 'Hours', 'Analysts agreeing or disagreeing with the model'],
        ['Chargebacks', 'Weeks', 'The only real label, and always late']
      ]
    }},
    { p: 'The first three are the reason PSI from level 14 turns up again here. You cannot wait a month to discover that a ' +
         'feature started arriving as null at nine this morning, so you watch the inputs and the outputs, and you treat a ' +
         'sudden change as an incident even though nobody can prove harm yet.' },
    { code: 'PSI = sum over bins of (today% - baseline%) x ln(today% / baseline%)\n\n< 0.10   stable\n0.10 to 0.25   watch it\n> 0.25   the traffic is not what the model was built on', lang: 'text' },
    { check: {
      q: 'At 09:12 the share of transactions marked card present drops from 61% to 4% and stays there. The fraud rate looks ' +
         'unchanged. What do you do first?',
      a: 'Treat it as a data incident, not a fraud one. A feature that moves like that at a precise minute is an upstream ' +
         'change: a payment terminal upgrade, a partner sending a new format, a field renamed. The model is now scoring ' +
         'almost every transaction as card not present, which level 8 showed is the strongest single signal, so approvals ' +
         'are about to fall off a cliff even though nothing about the fraud has changed. Page the owner of that feed, and ' +
         'while you wait, consider the kill switch: falling back to rules and approving more is often better than declining ' +
         'thousands of honest customers on a bad feature.'
    }},

    { h: 'The switch you hope never to use' },
    { p: 'Every model in a request path needs a way to be taken out of it without a deploy. One configuration value, ' +
         'readable at request time, with three positions.' },
    { code: 'MODEL_MODE = "live"     # score and act\n           = "shadow"   # score, log, do not act\n           = "off"      # do not score; rules only', lang: 'text' },
    { p: 'And the question that makes it real: when the model is off, what happens? Approving everything is a fraud ' +
         'decision; declining everything is a business decision. The usual answer is the rule engine alone, with a ' +
         'conservative amount limit, and the important part is that somebody decided it in advance rather than at two in ' +
         'the morning.' },
    { warn: 'Write the fallback behaviour in the runbook and test it in a drill. A kill switch nobody has pulled is a ' +
            'configuration value with a hopeful name.' }
  ],

  tutorial: {
    intro: 'A small decision service you can run and time. FastAPI from level 12, the level 8 dataset for the model, and ' +
           'either Redis in Docker or a dictionary behind the same interface if Docker will not run. Everything here is ' +
           'measurable, and the point of the level is that you measure it.',
    steps: [
      {
        t: 'One feature definition, two callers',
        blocks: [
          { p: 'Start here, before any service. One module computes features from a list of events and nothing else can.' },
          { code: 'from datetime import timedelta\n\ndef features(txn, history, now):\n    """txn: the transaction being decided. history: this customer\'s past events.\n    Every value here must be computable at decision time.\n    """\n    hour_ago = now - timedelta(hours=1)\n    recent = [e for e in history if hour_ago <= e["at"] < now]     # strictly before\n    return {\n        "amount": txn["amount"],\n        "card_present": int(txn["card_present"]),\n        "is_foreign": int(txn["country"] != HOME),\n        "is_night": int(now.hour < 6),\n        "txns_last_1h": len(recent),\n        "high_risk_cat": int(txn["category"] in HIGH_RISK),\n        "hours_since_prev": hours_since(history, now),\n    }', lang: 'python' },
          { p: 'Training calls this by replaying history; the service calls it with the counters. Same function, same ' +
               'answer, and a bug fixed once.' }
        ],
        check: 'The same function produces the training matrix and the live feature vector, and a test asserts they agree on a sample of rows.'
      },
      {
        t: 'Train, then throw the object away',
        blocks: [
          { code: 'import json\nimport numpy as np\nfrom sklearn.linear_model import LogisticRegression\n\nmodel = LogisticRegression(max_iter=2000, class_weight="balanced").fit(X, y)\n\n# ship the arithmetic, not the object\nartifact = {\n    "version": "2026-09-17-a",\n    "features": FEATURE_ORDER,\n    "coefficients": model.coef_[0].tolist(),\n    "intercept": float(model.intercept_[0]),\n}\nwith open("model.json", "w", encoding="utf-8") as fh:\n    json.dump(artifact, fh, indent=2)', lang: 'python' },
          { code: 'import math\n\ndef score(vector, artifact):\n    z = sum(v * c for v, c in zip(vector, artifact["coefficients"])) + artifact["intercept"]\n    return 1 / (1 + math.exp(-z))', lang: 'python' },
          { p: 'A JSON file with a version in it is auditable, diffable, loads instantly, and cannot execute anything. A ' +
               'pickle is none of those, and unpickling a file is running whatever is inside it.' }
        ],
        check: 'The JSON model scores a row within 1e-9 of predict_proba, and the file has a version string.'
      },
      {
        t: 'Counters instead of history',
        blocks: [
          { code: 'class Velocity:\n    """Bucketed counters. Redis in production, a dict in tests, same interface."""\n\n    def record(self, customer, at):\n        key = f"{customer}:{at:%Y%m%d%H%M}"          # one bucket a minute\n        self.store.incr(key, ttl=7200)\n\n    def last_hour(self, customer, now):\n        keys = [f"{customer}:{(now - timedelta(minutes=m)):%Y%m%d%H%M}" for m in range(60)]\n        return sum(int(v or 0) for v in self.store.mget(keys))', lang: 'python' },
          { tip: 'Hide it behind an interface from the first line. Tests then run with a dictionary and no container, and ' +
                 'the service swaps in Redis with one constructor argument.' }
        ],
        check: 'last_hour matches a brute force count over a replayed history, and an entry older than an hour has expired.'
      },
      {
        t: 'The decide endpoint, with a budget',
        blocks: [
          { code: 'import time\nfrom fastapi import FastAPI\n\napp = FastAPI()\n\n@app.post("/v1/decide")\ndef decide(txn: TransactionIn):\n    started = time.perf_counter()\n    now = txn.at\n\n    vector = build_vector(txn, velocity, profiles, now)\n    p = score(vector, ARTIFACT)\n    action, reason = policy(p, txn, rules)\n\n    took_ms = (time.perf_counter() - started) * 1000\n    log_decision(txn.id, action, p, vector, ARTIFACT["version"], took_ms)\n    return {"action": action, "score": round(p, 4), "reason": reason,\n            "model_version": ARTIFACT["version"], "took_ms": round(took_ms, 2)}', lang: 'python' },
          { p: 'Return the score and the version in the response. When somebody asks in three weeks why a transaction was ' +
               'declined, the answer has to be reconstructable, and that means the inputs, the score and the model that ' +
               'produced it were all written down at the time.' }
        ],
        check: 'A decision returns an action, a score, a reason and a model version, and logs the feature vector.'
      },
      {
        t: 'Policy, then rules on top',
        blocks: [
          { code: 'def policy(p, txn, rules):\n    hard = rules.check(txn)                 # stolen card, sanctioned party, blocked country\n    if hard:\n        return "decline", hard\n\n    if p >= DECLINE_AT:\n        return "decline", f"score {p:.3f}"\n    if p >= REVIEW_AT:\n        if queue_depth() > QUEUE_LIMIT:     # capacity is part of the policy\n            return "approve", f"score {p:.3f}, queue full"\n        return "review", f"score {p:.3f}"\n    return "approve", f"score {p:.3f}"', lang: 'python' },
          { warn: 'That queue check is a real design decision with a cost, and it belongs in the open rather than buried in a ' +
                  'monitoring dashboard. Whatever you choose, somebody should have chosen it.' }
        ],
        check: 'A rule hit declines regardless of score, and a full queue changes what a mid range score does.'
      },
      {
        t: 'Measure the percentiles, not the average',
        blocks: [
          { code: 'import statistics\n\ndef bench(n=2000):\n    times = []\n    for txn in sample(n):\n        t0 = time.perf_counter()\n        decide(txn)\n        times.append((time.perf_counter() - t0) * 1000)\n    times.sort()\n    p = lambda q: times[int(len(times) * q)]\n    print(f"p50 {p(0.50):.1f} ms  p95 {p(0.95):.1f} ms  p99 {p(0.99):.1f} ms  max {times[-1]:.1f} ms")', lang: 'python' },
          { p: 'Then make it a test that fails: assert the p99 is under your budget. A latency requirement nobody asserts is ' +
               'a latency requirement that quietly stops being true.' }
        ],
        check: 'The benchmark prints four numbers and a test fails if p99 exceeds the budget you wrote down.'
      },
      {
        t: 'Shadow the next model',
        blocks: [
          { code: 'def decide_with_shadow(txn):\n    vector = build_vector(txn, ...)\n    live = policy(score(vector, LIVE), txn, rules)\n    shadow = policy(score(vector, CANDIDATE), txn, rules)\n    log_shadow(txn.id, live, shadow, LIVE["version"], CANDIDATE["version"])\n    return live                     # only the live one acts', lang: 'python' },
          { code: 'agreement          97.3%\ndisagreements      54 of 2,000\n  live approve, shadow review     41\n  live review, shadow approve      9\n  live approve, shadow decline     4\nextra reviews per day (est.)    +180\ncandidate p99                   41 ms', lang: 'text', label: 'what a week of shadow gives you' },
          { p: 'Then read fifty of the disagreements with somebody who knows fraud. That hour is the most valuable part of ' +
               'the whole exercise and it is the part that gets skipped.' }
        ],
        check: 'A shadow run produces an agreement rate, a breakdown of disagreements, and an estimate of extra review volume.'
      },
      {
        t: 'Watch the inputs',
        blocks: [
          { code: 'def psi(baseline, current, bins=10):\n    edges = np.quantile(baseline, np.linspace(0, 1, bins + 1))\n    edges[0], edges[-1] = -np.inf, np.inf\n    b = np.histogram(baseline, edges)[0] / len(baseline)\n    c = np.histogram(current, edges)[0] / len(current)\n    b, c = np.clip(b, 1e-6, None), np.clip(c, 1e-6, None)\n    return float(((c - b) * np.log(c / b)).sum())', lang: 'python' },
          { p: 'Run it nightly on each feature and on the score itself, store the numbers, and alert over 0.25. Then prove ' +
               'it works: take the level 8 data, shift one feature on purpose, and watch the number move.' }
        ],
        check: 'PSI is near zero against itself, and rises above 0.25 when a feature is deliberately shifted.'
      }
    ]
  },

  glossary: [
    { t: 'Latency budget', d: 'The time a decision is allowed to take, measured at a percentile rather than as an average.' },
    { t: 'p99', d: 'The value only one request in a hundred exceeds. The number your worst served customers actually experience.' },
    { t: 'Online feature', d: 'A value computed fast enough to use inside a request, usually from counters kept as events arrive.' },
    { t: 'Feature store', d: 'One place that defines a feature, serves it online and reproduces it offline for training.' },
    { t: 'Training and serving skew', d: 'The same feature meaning different things in training and in production. Fixed by one implementation.' },
    { t: 'Point in time correctness', d: 'A feature computed only from what was knowable before the event being scored.' },
    { t: 'Shadow mode', d: 'Running a candidate model on live traffic, logging what it would do, taking no action.' },
    { t: 'Decision policy', d: 'The rules turning a score into approve, review or decline, including review capacity.' },
    { t: 'Review queue', d: 'Where uncertain cases go. It has a capacity, and a threshold is a promise about volume.' },
    { t: 'Chargeback', d: 'The cardholder\'s dispute working back through the system. The real fraud label, weeks late.' },
    { t: 'Label delay', d: 'The gap between a decision and knowing whether it was right. Why input monitoring exists.' },
    { t: 'Input drift', d: 'The distribution of a feature changing. Measured with PSI and visible immediately.' },
    { t: 'Prediction drift', d: 'The distribution of scores changing, with or without the inputs changing.' },
    { t: 'Kill switch', d: 'A configuration value that takes the model out of the path without a deploy, with a defined fallback.' },
    { t: 'Model artifact', d: 'The shipped model: coefficients, feature order and a version, in a format that cannot execute code.' }
  ],

  quiz: [
    { q: "Why is p99 latency the number that matters rather than the average?",
      options: [
        "Because p99 is always lower than the mean",
        "Because averages are hard to compute in production",
        "Because the one customer in a hundred waiting two seconds is standing at a till",
        "Because regulators require percentile reporting"
      ],
      answer: 2,
      why: "An average hides the tail, and the tail is the experience people complain about and abandon carts over." },

    { q: "Scoring a logistic regression at serving time is best done by:",
      options: [
        "Calling predict_proba on a one row data frame",
        "Querying a model server over HTTP",
        "A dot product and a sigmoid over a plain vector",
        "Re-fitting on recent data per request"
      ],
      answer: 2,
      why: "Measured on this course's model: about 0.10 ms through scikit-learn against about 0.003 ms as arithmetic. The overhead is data frame shaped and does not belong in a request path." },

    { q: "How is a one hour transaction count computed at decision time?",
      options: [
        "A full table scan with an index hint",
        "From counters kept in expiring buckets as transactions arrive",
        "By re-reading the training data",
        "A query over the transaction table filtered by customer"
      ],
      answer: 1,
      why: "Small writes on the way in beat a large read on the way out, and bucket expiry means no cleanup job." },

    { q: "What is training and serving skew?",
      options: [
        "A feature meaning something different in training than it does in production",
        "Latency differences between environments",
        "The gap between train and test accuracy",
        "The model drifting as the population changes"
      ],
      answer: 0,
      why: "The model is fine and every prediction is subtly wrong. One implementation of each feature, called by both paths, is the structural fix." },

    { q: "Why must a velocity feature exclude the transaction being scored?",
      options: [
        "Because including it uses information from the moment being predicted and inflates the training signal",
        "Because Redis cannot increment and read atomically",
        "Because the counter has not been written yet",
        "To save a millisecond"
      ],
      answer: 0,
      why: "Point in time correctness. The signal looks strong offline and vanishes live, which is the same trap as level 8 leakage." },

    { q: "Offline AUC is 0.97 and the live model catches almost nothing. What do you check first?",
      options: [
        "Whether the database is slow",
        "Whether the threshold is too high",
        "Whether the features computed live match the features computed in training",
        "Whether to add more trees"
      ],
      answer: 2,
      why: "Recompute the features offline for transactions already decided live and compare field by field. A difference names itself." },

    { q: "What does shadow mode tell you that an offline test cannot?",
      options: [
        "The true fraud rate",
        "Whether the candidate would have caught fraud you approved",
        "The optimal threshold",
        "How the candidate behaves on live traffic, including its latency and how much review volume it would create"
      ],
      answer: 3,
      why: "What it cannot tell you is the second option, because you approved those transactions and may never learn they were bad." },

    { q: "A review threshold sends 1.2% of traffic to a queue, and volume doubles. Which response is the one that happens by accident?",
      options: [
        "Pausing the campaign",
        "The backlog being auto approved because nobody decided",
        "Raising the threshold deliberately",
        "Hiring more reviewers"
      ],
      answer: 1,
      why: "And it is the worst, because the cases auto approved are the ones the model was least sure about. Raising the threshold on purpose, with the expected loss written down, is the honest move." },

    { q: "Why do rules sit on top of the model rather than being replaced by it?",
      options: [
        "Because some decisions are not statistical: a stolen card is declined whatever the score says",
        "Because regulators ban model only decisions",
        "Because models cannot read card status",
        "Because rules are more accurate"
      ],
      answer: 0,
      why: "The model orders the uncertain middle. Rules handle the certain ends, and the split is what makes both explainable." },

    { q: "Which monitoring signal is available immediately after a decision?",
      options: [
        "Confirmed fraud losses",
        "Recall",
        "Input drift on each feature",
        "Chargebacks"
      ],
      answer: 2,
      why: "The real label arrives weeks later through disputes, which is exactly why input and prediction drift are watched from the first minute." },

    { q: "Card present drops from 61% to 4% at 09:12 and holds. The first move is:",
      options: [
        "Retrain on the new distribution",
        "Treat it as a data incident and page the owner of that feed",
        "Lower the decline threshold",
        "Ignore it until chargebacks confirm harm"
      ],
      answer: 1,
      why: "A step change at a precise minute is upstream, not behavioural. Meanwhile the model is scoring nearly everything as card not present, and approvals are about to collapse." },

    { q: "What does a PSI of 0.31 on a feature mean?",
      options: [
        "The feature has become more predictive",
        "The distribution has moved far enough that the model was built on different traffic",
        "Thirty one percent of values are missing",
        "The model has a bug"
      ],
      answer: 1,
      why: "Under 0.10 stable, 0.10 to 0.25 watch, above 0.25 act. Same statistic as the scorecard monitoring in level 14." },

    { q: "Why ship a model as JSON coefficients rather than a pickled object?",
      options: [
        "Because scikit-learn cannot be installed in production",
        "Because pickles cannot hold floats",
        "JSON is faster to parse",
        "Because it is auditable, diffable, version stamped and cannot execute code"
      ],
      answer: 3,
      why: "Unpickling a file runs whatever is inside it, and a coefficient you cannot read in a diff is a coefficient nobody reviews." },

    { q: "What has to be defined before a kill switch is real?",
      options: [
        "The name of the configuration key",
        "Who is allowed to flip it",
        "How fast it propagates",
        "What the system does when the model is off"
      ],
      answer: 3,
      why: "Approving everything is a fraud decision and declining everything is a business decision. Decide in advance, write it in the runbook, and drill it." },

    { q: "Why log the feature vector, the score and the model version with every decision?",
      options: [
        "So a decision from three weeks ago can be reconstructed and explained",
        "To retrain on it later",
        "Because the regulator requires all logs to be kept",
        "For the metrics dashboard"
      ],
      answer: 0,
      why: "Somebody will ask why a transaction was declined. Without the inputs and the version, the honest answer is that you do not know." }
  ],

  project: {
    title: 'The fraud decision service',
    story: 'The payments service from level 12 is going live with real members, and it needs a fraud decision on every ' +
           'transfer in under a hundred milliseconds. Build the service: features from counters, a model shipped as data, ' +
           'a policy that knows what a review costs, and the monitoring that tells you when it has stopped working.',
    scope: 'Uses this level plus level 8 (the model and the cost thinking), level 12 (FastAPI, errors, request ids) and ' +
           'level 14 (PSI). scikit-learn for training only: the request path must not import it.',
    dataset: '{{RAW}}/data/level-08-transactions.csv',
    requirements: [
      'One features module computing every feature, called by both the training script and the service',
      'A point in time test proving no feature uses the transaction being scored or anything after it',
      'A training script producing model.json with coefficients, feature order and a version string, and a test that the JSON scores within 1e-9 of the fitted model',
      'A Velocity class with an interface that works over a dictionary in tests and Redis in production',
      'POST /v1/decide returning action, score, reason, model version and elapsed milliseconds',
      'A decision policy with an approve, review and decline band, a hard rules layer above it, and an explicit behaviour when the review queue is over capacity',
      'A benchmark printing p50, p95, p99 and max, and a test that fails when p99 exceeds the budget you wrote down',
      'Shadow mode: a candidate model scored on every request, never acting, with an agreement rate and a breakdown of disagreements',
      'A drift job computing PSI per feature and on the score, against a stored baseline, with thresholds',
      'A kill switch with three modes and a documented fallback, plus a test that the service still decides with the model off',
      'A decision log holding the feature vector, the score, the action, the model version and the request id',
      'A README with the latency budget table, the thresholds and what they cost, and the runbook for the kill switch',
      'The repository in your GitHub portfolio as finquest-fraud-service'
    ],
    starter: {
      lang: 'python',
      code: '"""FinQuest level 15: the fraud decision service.\n\nLayout:\n  fraud/features.py   one definition per feature, used by training and serving\n  fraud/train.py      fits and writes model.json. The only file importing sklearn\n  fraud/score.py      dot product and sigmoid, no dependencies\n  fraud/velocity.py   bucketed counters behind an interface\n  fraud/policy.py     bands, rules, queue capacity\n  fraud/drift.py      psi against a stored baseline\n  main.py             POST /v1/decide\n  bench.py            p50, p95, p99, max\n"""\n\nimport math\n\n\ndef features(txn, history, now):\n    """Every value computable at decision time, and nothing from the future."""\n    # TODO\n    pass\n\n\ndef score(vector, artifact):\n    """Dot product and sigmoid. No sklearn, no data frame."""\n    # TODO\n    pass\n\n\nclass Velocity:\n    """Bucketed counters. Dict in tests, Redis in production."""\n\n    def record(self, customer, at):\n        # TODO\n        pass\n\n    def last_hour(self, customer, now):\n        # TODO\n        pass\n\n\ndef policy(p, txn, rules, queue_depth):\n    """approve, review or decline, with rules above the model."""\n    # TODO\n    pass\n\n\ndef psi(baseline, current, bins=10):\n    # TODO\n    pass\n'
    },
    tests: [
      'features() gives identical vectors when called from the training replay and from the live path, on a sample of 1,000 transactions',
      'No feature changes if a transaction dated after the one being scored is added to the history',
      'model.json scores a row within 1e-9 of the fitted scikit-learn model',
      'The request path imports neither sklearn nor pandas, asserted by inspecting sys.modules after a decision',
      'last_hour() matches a brute force count over replayed history, and buckets older than the window are gone',
      'A hard rule declines regardless of a low score',
      'A review band score is approved instead when the queue is over capacity, and the reason says so',
      'p99 over 2,000 decisions is under the budget in the README',
      'Shadow mode logs both decisions and never lets the candidate change the response',
      'PSI is under 0.01 against the baseline itself and over 0.25 when a feature is shifted deliberately',
      'With MODEL_MODE off the service still returns a decision, from rules alone'
    ],
    rubric: [
      { pts: 25, t: 'Fast enough, and proved', d: 'A stated budget, a benchmark, and a test that fails when p99 exceeds it.' },
      { pts: 20, t: 'No skew', d: 'One feature implementation, a point in time test, and an equality test between the training and serving vectors.' },
      { pts: 20, t: 'A policy, not a threshold', d: 'Three bands with costs behind them, rules above the model, and queue capacity handled explicitly.' },
      { pts: 20, t: 'Operable', d: 'Shadow mode, drift monitoring, a kill switch with a tested fallback, and a decision log that can reconstruct any decision.' },
      { pts: 15, t: 'Shipped', d: 'Runs from a clean clone, tests pass, README has the budget table and the runbook.' }
    ],
    stretch: [
      'Add a second model type as the candidate, compare in shadow, and write the note on why you would or would not promote it',
      'Add per customer rate limiting to the decide endpoint and measure what it does to p99 under load',
      'Simulate the label delay: hold the outcomes back thirty days and rebuild your monitoring to work without them',
      'Add a feature that is deliberately leaky, watch it top the importance list, and write the paragraph explaining how you caught it'
    ],
    solutionPath: 'solutions/level-15'
  },

  faq: [
    { q: 'Do I need Redis?',
      a: 'No. Put the counters behind an interface and a dictionary is enough for this level. The interface is the point: it means the service does not care, and your tests need no container.' },
    { q: 'Why not use a real feature store product?',
      a: 'Because building the small version teaches you what the product does, and the interview question is about the problem rather than the vendor. Use one in a job, after you can say what it solves.' },
    { q: 'My p99 is dominated by one slow call',
      a: 'Good, that is the finding. Give it a timeout shorter than your budget and decide what the service does when it fires, because a call with no timeout is a promise to wait forever on somebody else\'s bad day.' },
    { q: 'How do I choose the two thresholds?',
      a: 'Same arithmetic as level 8, plus capacity. Expected loss of an approval, cost of a review, cost of a decline, and how many reviews the team can clear in a day.' },
    { q: 'Is shadow mode not just A/B testing?',
      a: 'No. An A/B test lets both models act on different traffic, so you learn outcomes for both and take real risk with the candidate. Shadow takes no risk and learns less, which is why it comes first.' },
    { q: 'How long should shadow run?',
      a: 'Long enough to see a weekend and a payday, so at least a full week. Fraud patterns are strongly weekly and a Tuesday sample will mislead you.' },
    { q: 'What if I cannot get chargeback labels at all?',
      a: 'Then you monitor inputs, predictions, the decision mix and review outcomes, and you are honest in the README that the model has no confirmed performance measure yet. Pretending otherwise is worse than saying it.' }
  ]
});
