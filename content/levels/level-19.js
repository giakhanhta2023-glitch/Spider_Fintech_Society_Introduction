/* =========================================================================
   LEVEL 19: AML, sanctions screening and the false positive budget
   ========================================================================= */
FQ.registerLevel({
  id: 19,
  codename: 'watchlist',
  title: 'Ninety eight percent of your alerts are wrong',
  tagline: 'Every payments company runs a monitoring system, and almost every alert it raises is innocent. Building one teaches you why, and what a good one does about it.',
  difficulty: 9,
  minutes: 260,
  tags: ['AML', 'sanctions', 'fuzzy matching', 'rule tuning'],
  summary: 'Sanctions screening and transaction monitoring, built against 12,067 synthetic payments and a fictional ' +
           'watchlist. Exact name matching finds five of the seven real hits. Fuzzy matching finds all seven and ' +
           '175 innocent people alongside them. Choosing where to sit between those two is the job.',

  objectives: [
    'Separate sanctions screening from transaction monitoring, because they are different obligations',
    'Normalise a name, then match it with Jaro-Winkler, and see what each step buys',
    'Measure recall and precision across thresholds instead of picking one by instinct',
    'Cut false positives with secondary identifiers rather than by lowering recall',
    'Write structuring and pass-through rules, and tune them against a stated budget',
    'Build an alert queue with dispositions, case files and an audit trail',
    'Say what the system cannot do, and what a person has to decide'
  ],

  knowledge: [
    { h: 'Two obligations that get confused' },
    { p: 'Anti money laundering rules put several duties on a regulated firm. Two of them turn into software, and treating ' +
         'them as one system is the most common design mistake in this area.' },
    { table: {
      head: ['', 'Sanctions screening', 'Transaction monitoring'],
      rows: [
        ['**Question**', 'Is this party on a list?', 'Does this behaviour look like laundering?'],
        ['**Standard**', 'Prohibition. No threshold, no judgement', 'Suspicion. Judgement, documented'],
        ['**Timing**', 'Before the payment moves', 'After, in batches or near real time'],
        ['**Getting it wrong**', 'A payment to a designated party', 'A pattern nobody reported'],
        ['**Output**', 'Block, or release with a reason', 'An alert, then a case, then possibly a report']
      ]
    }},
    { p: 'Screening is a lookup with a matching problem. Monitoring is a set of rules over behaviour. They share an alert ' +
         'queue and nothing else, and building them as one pipeline produces a system that can neither block reliably nor ' +
         'explain a pattern.' },
    { check: {
      q: 'A payment scores 0.93 against a designated entity. Your system blocks it automatically and emails the customer ' +
         'that their payment was rejected for compliance reasons. Name two problems.',
      a: 'First, 0.93 is a similarity score, not an identification. Somewhere around that score sit hundreds of people who ' +
         'share part of a name with somebody on a list, and blocking them automatically means freezing innocent people\'s ' +
         'money without a person ever looking. A score that high should hold the payment and raise an alert; a person ' +
         'releases or blocks it. Second, telling the customer why can be tipping off, which is an offence in many ' +
         'jurisdictions when a report has been or may be made. What the customer is told is a legal question with a ' +
         'jurisdiction specific answer, and it does not belong in a template somebody wrote in a hurry.'
    }},

    { h: 'A name is not an identifier' },
    { p: 'Screening compares a string on a payment against a list of strings. Everything hard about it comes from the fact ' +
         'that the same person is written many ways, and different people are written the same way. This level plants ' +
         'seven payments to entities that really are on its watchlist, each written differently.' },
    { table: {
      head: ['How it was written', 'Found by exact match?'],
      rows: [
        ['Exactly as listed', 'Yes'],
        ['In upper case', 'Yes, after case folding'],
        ['Using the listed alias, family name first', 'Yes, after sorting the tokens'],
        ['With a title, `MR` in front', 'Yes, after stripping titles'],
        ['With the word order swapped', 'Yes, after sorting the tokens'],
        ['Transliterated, `k` written as `c`', '**No**'],
        ['With one letter dropped', '**No**']
      ]
    }},
    { p: 'So normalisation, which is upper casing, removing punctuation, dropping titles and sorting the tokens, recovers ' +
         'five of the seven. It is cheap and it is most of the win. The last two need a similarity measure.' },
    { money: 'Exact matching on these files: **5 alerts, all 5 correct, and 2 designated parties paid**. A perfect ' +
             'precision score and a failure, which is the shape of every argument about screening thresholds.' },

    { h: 'Jaro-Winkler, and what the number means' },
    { p: 'Jaro similarity counts characters that appear in both strings close to the same position, penalises ones that ' +
         'appear in the wrong order, and returns a number between 0 and 1. Winkler adds a bonus when the strings share a ' +
         'prefix, which suits names because people get the start of a name right more often than the end.' },
    { code: 'jaro_winkler("BRANREN BOSKOUL", "BRANREN BOSCOUL")  = 0.9689   # the transliteration\njaro_winkler("IVASKITZ SEVREN",  "IVASKITZ SEVRN")   = 0.9867   # the dropped letter\njaro_winkler("NISLO DAVRESKI",   "NISLO DAVRESKI")   = 1.0000   # exact', lang: 'text' },
    { p: 'Now sweep the threshold across all 12,067 payments. Seven of them are the real hits. Everything else is ' +
         'somebody with an ordinary name.' },
    { table: {
      head: ['Threshold', 'Payments alerted', 'Real hits found', 'Innocent', 'Recall', 'Precision'],
      rows: [
        ['1.00, exact', '5', '5', '0', '71.4%', '100%'],
        ['0.95', '182', '7', '175', '100%', '3.85%'],
        ['0.92', '889', '7', '882', '100%', '0.79%'],
        ['0.90', '1,961', '7', '1,954', '100%', '0.36%'],
        ['0.85', '7,081', '7', '7,074', '100%', '0.10%'],
        ['0.80', '9,360', '7', '9,353', '100%', '0.07%']
      ]
    }},
    { p: 'Read the middle of that table rather than the ends. Moving from 0.95 to 0.85 finds nothing new and multiplies ' +
         'the queue by thirty nine. Moving from 0.95 up to 0.97 cuts the queue to six distinct names and loses the ' +
         'transliteration, which scored 0.9689. The whole decision lives in a narrow band, and outside it you are either ' +
         'drowning analysts or missing designated parties.' },
    { warn: 'A precision of 3.85% is not a broken system. Published figures for sanctions and AML alerting sit in that ' +
            'region across the industry, because the cost of a miss is a prohibition breach and the cost of a false ' +
            'positive is an analyst\'s afternoon. What matters is that somebody chose the number and can say why.' },
    { check: {
      q: 'Your compliance lead asks for a threshold that gives both high recall and high precision. What do you tell them?',
      a: 'That on name similarity alone it does not exist, and show them the sweep. There is no threshold in this data ' +
         'where recall is 100% and precision is above about 4%, because innocent names genuinely resemble listed names. ' +
         'A better threshold will not get you there. More information will: secondary identifiers, so a high scoring name ' +
         'with the wrong country and the wrong date of birth is discounted automatically. That moves both numbers at once, ' +
         'and a threshold only trades one for the other.'
    }},

    { h: 'Secondary identifiers, the only way out' },
    { p: 'The watchlist carries more than a name. In this level it carries a country, an entity type, and a date of birth ' +
         'for most individuals. A payment carries a counterparty country. Every field they share is a chance to discount ' +
         'a match without lowering the name threshold.' },
    { ol: [
      '**Score the name.** Keep the threshold low enough that no real hit is lost.',
      '**Then score the rest.** Country agrees, disagrees, or is missing. Date of birth agrees, disagrees, or is missing.',
      '**Combine them into a decision**, not into one number. A high name score with a definite country mismatch is a different thing from a high name score with a missing country, and flattening both into 0.86 throws away the distinction.',
      '**Auto discount only on disagreement, never on absence.** A missing date of birth is not evidence of innocence, and a system that treats it as such will miss the entities that are hardest to identify.'
    ]},
    { code: 'name 0.96, country XA == XA, dob missing      -> alert, high priority\nname 0.96, country GB != XA, dob 1971 != 1984 -> auto discount, logged with the reason\nname 0.96, country missing, dob missing       -> alert, normal priority', lang: 'text' },

    { h: 'Monitoring rules, and the budget that tunes them' },
    { p: 'Monitoring looks for behaviour. Three rules cover most of what a small payments firm would run, and this level\'s ' +
         'data contains planted examples of the first two and none of the third.' },
    { table: {
      head: ['Rule', 'What it looks for', 'On this data'],
      rows: [
        ['**Structuring**', 'Cash deposits kept under a reporting threshold, repeatedly', '4 real cases, 6 deposits each'],
        ['**Pass through**', 'Money in, almost all of it out within a day', '3 real cases, 92% to 93% out'],
        ['**Corridor**', 'Anything touching a higher risk jurisdiction', '514 payments, 0 real cases']
      ]
    }},
    { p: 'The corridor rule is in the table as a warning. It alerts on 4.26% of the book, finds nothing here, and is the ' +
         'rule most likely to be written first because it takes one line. A rule that fires on geography alone is a rule ' +
         'that spends an analyst\'s year confirming that people send money to places.' },
    { p: 'Structuring shows the tuning problem cleanly. The rule is: cash deposits between 80% and 100% of the 10,000 ' +
         'reporting threshold, at least N of them, within seven days, summing to more than the threshold.' },
    { table: {
      head: ['N', 'Alerts', 'Real', 'Innocent', 'Precision'],
      rows: [
        ['2', '16', '4', '12', '25%'],
        ['3', '4', '4', '0', '100%']
      ]
    }},
    { p: 'Twelve customers in this data made two large cash deposits within a few days for ordinary reasons. Setting N to ' +
         'two catches them all and finds nothing extra. Setting N to three is right **on this data**, which is the ' +
         'sentence that matters: somebody who knows the threshold can now deposit twice a week forever, and the only ' +
         'defence is that a tuning decision is written down, dated, and revisited.' },
    { check: {
      q: 'You raise the structuring threshold from two deposits to three, the queue drops from 16 alerts to 4, and you ' +
         'ship it. What did you skip?',
      a: 'The record, and the check that goes with it. Raising a threshold is a change to how much the firm looks, so it ' +
         'needs the reason, the data it was measured on, the date, and who approved it. It also needs below the line ' +
         'testing: sample what the new threshold no longer alerts on and confirm those cases really are innocent, because ' +
         'the alerts you stopped generating are invisible by construction. A tuning change that shrinks the queue is ' +
         'indistinguishable from a bug that shrinks the queue, unless somebody looked underneath it.'
    }},

    { h: 'The alert is the start, not the answer' },
    { p: 'An alert is a question. What a monitoring system produces for the business is a queue of them, and what the ' +
         'regulator eventually reads is the record of how each one was answered.' },
    { ol: [
      '**Alert**: a rule or a score fired, with the payments that caused it attached.',
      '**Triage**: an analyst looks. Most are closed here, with a disposition code and a sentence.',
      '**Case**: the ones that survive get a file, with the customer history, the pattern and what was asked.',
      '**Report**: if suspicion stands, the firm files a suspicious activity report. That decision is a person\'s, in a role, and your software records it rather than making it.'
    ]},
    { p: 'Two properties make the difference between a system a compliance team can use and one they work around.' },
    { ul: [
      '**Every alert carries its evidence.** The payments, the scores, the rule version and the thresholds in force when it fired. An analyst who has to go and find the data will be slower than the queue.',
      '**Nothing is ever deleted.** Dispositions, reopenings and comments are appended. This is level 13\'s rule, and here it is a legal requirement rather than a preference.'
    ]},
    { warn: 'This system decides whether real people can move their own money. A false positive is somebody\'s rent held ' +
            'for three days. Build the queue so that discounting a match is as easy as escalating one, measure how long ' +
            'people wait, and put that number on the same dashboard as the alert count.' }
  ],

  tutorial: {
    intro: 'Python, pandas, and a queue in Postgres. The watchlist, the customers and the payments ship with the level, ' +
           'and every name in all three is invented. Implement Jaro-Winkler yourself once, then use a library.',
    steps: [
      {
        t: 'Load, and look at the shapes',
        blocks: [
          { code: 'import pandas as pd\n\nwatch = pd.read_csv("data/level-19-watchlist.csv").fillna("")\ncust  = pd.read_csv("data/level-19-customers.csv")\npays  = pd.read_csv("data/level-19-payments.csv", parse_dates=["booked_at"])\n\nprint(len(watch), "entities", len(cust), "customers", len(pays), "payments")\nprint(pays.booked_at.min().date(), "to", pays.booked_at.max().date())', lang: 'python' },
          { code: '60 entities 400 customers 12067 payments\n2026-04-01 to 2026-06-29', lang: 'text' },
          { p: 'Expand the aliases into their own rows first. A list of 60 entities is 95 searchable strings, and screening ' +
               'against the primary name alone silently loses every alias hit.' }
        ],
        check: 'The watchlist expands from 60 rows to 95 searchable strings.'
      },
      {
        t: 'Normalise, and count what it recovers',
        blocks: [
          { code: 'import re\n\nTITLES = {"MR", "MRS", "MS", "DR", "MISS", "PROF"}\n\ndef normalise(name: str) -> str:\n    s = re.sub(r"[^A-Z0-9 ]", " ", name.upper())\n    return " ".join(sorted(t for t in s.split() if t not in TITLES))', lang: 'python' },
          { p: 'Four decisions in four lines: case folding, punctuation removal, title stripping and token sorting. Test ' +
               'each one against a name it is supposed to fix, and write down why sorting the tokens is safe here. It is ' +
               'safe because a two token name reversed is common and a false pairing of unrelated names is rare, and both ' +
               'of those are assumptions worth stating.' },
          { code: 'exact matches after normalisation:  5 of the 7 planted hits', lang: 'text' }
        ],
        check: 'Normalised exact matching finds 5 of the 7, and the other 2 are the transliteration and the dropped letter.'
      },
      {
        t: 'Jaro-Winkler, written once by hand',
        blocks: [
          { p: 'Write it yourself before importing it. It takes thirty lines and it is the difference between choosing a ' +
               'threshold and guessing one.' },
          { code: 'def jaro(s, t):\n    if s == t:\n        return 1.0\n    window = max(len(s), len(t)) // 2 - 1\n    s_hit = [False] * len(s)\n    t_hit = [False] * len(t)\n    matches = 0\n    for i, ch in enumerate(s):\n        for j in range(max(0, i - window), min(i + window + 1, len(t))):\n            if not t_hit[j] and t[j] == ch:\n                s_hit[i] = t_hit[j] = True\n                matches += 1\n                break\n    if not matches:\n        return 0.0\n    k = transpositions = 0\n    for i, hit in enumerate(s_hit):\n        if hit:\n            while not t_hit[k]:\n                k += 1\n            transpositions += s[i] != t[k]\n            k += 1\n    transpositions //= 2\n    return (matches / len(s) + matches / len(t)\n            + (matches - transpositions) / matches) / 3\n\n\ndef jaro_winkler(s, t, p=0.1):\n    j = jaro(s, t)\n    if j < 0.7:\n        return j\n    prefix = 0\n    for a, b in zip(s[:4], t[:4]):\n        if a != b:\n            break\n        prefix += 1\n    return j + prefix * p * (1 - j)', lang: 'python' },
          { tip: 'Then check it against `rapidfuzz.distance.JaroWinkler.similarity` on a hundred pairs. If they disagree, ' +
                 'your transposition count is wrong, which is the part everybody gets wrong.' }
        ],
        check: 'Your implementation agrees with the library to six decimal places, and the transliteration pair scores 0.9689.'
      },
      {
        t: 'Screen once, on distinct names',
        blocks: [
          { p: 'There are 12,067 payments and 887 distinct counterparty names. Score the names, then join back to the ' +
               'payments. That is a 93% saving before any optimisation, and it makes the sweep fast enough to run in a test.' },
          { code: 'names = pays.counterparty_name.drop_duplicates()\nscored = {\n    n: max((jaro_winkler(normalise(n), t), eid) for eid, t in targets)\n    for n in names\n}\npays["score"] = pays.counterparty_name.map(lambda n: scored[n][0])\npays["matched_entity"] = pays.counterparty_name.map(lambda n: scored[n][1])', lang: 'python' },
          { warn: 'This is 887 by 95 comparisons, which is fine. A real book is millions of names by tens of thousands of ' +
                  'list entries, and that needs blocking: compare only names that share a first letter, a phonetic key or ' +
                  'a token, then score inside each block. Write the slow version first and know what it costs.' }
        ],
        check: 'Scoring runs over distinct names, and 12,067 payments each carry a score and a matched entity.'
      },
      {
        t: 'Sweep the threshold, and print the table',
        blocks: [
          { code: 'for thr in (1.00, 0.95, 0.92, 0.90, 0.85, 0.80):\n    hit = pays[pays.score >= thr]\n    true = hit.payment_id.isin(KNOWN_HITS).sum()\n    print(f"{thr:.2f}  {len(hit):6d} alerts  {true} real  "\n          f"recall {true/7:.0%}  precision {true/max(len(hit),1):.2%}")', lang: 'python' },
          { code: '1.00       5 alerts  5 real  recall  71%  precision 100.00%\n0.95     182 alerts  7 real  recall 100%  precision   3.85%\n0.92     889 alerts  7 real  recall 100%  precision   0.79%\n0.90    1961 alerts  7 real  recall 100%  precision   0.36%\n0.85    7081 alerts  7 real  recall 100%  precision   0.10%\n0.80    9360 alerts  7 real  recall 100%  precision   0.07%', lang: 'text' },
          { p: 'This table is the deliverable of the whole level. Put it in the README, and put the chosen threshold next ' +
               'to it with the sentence explaining the choice.' }
        ],
        check: 'Your sweep reproduces these six rows exactly.'
      },
      {
        t: 'Discount on secondary identifiers',
        blocks: [
          { code: 'def decide(row, entity):\n    if row.score < THRESHOLD:\n        return None\n    reasons = []\n    if entity.country and row.counterparty_country:\n        if entity.country != row.counterparty_country:\n            reasons.append("country mismatch")\n    if not reasons:\n        return Alert(row, entity, priority="high" if row.score >= 0.98 else "normal")\n    return Discount(row, entity, reasons=reasons)          # logged, not deleted', lang: 'python' },
          { p: 'Then measure it: how many alerts the discount removes, and whether any of the seven real hits were among ' +
               'them. If one was, the discount rule is wrong and no amount of queue reduction makes it right.' },
          { tip: 'Keep discounts in the same table as alerts with a status, so a later question about what the system did ' +
                 'with a name has an answer.' }
        ],
        check: 'Discounted matches are stored with their reasons, and none of the seven real hits is discounted.'
      },
      {
        t: 'Two behaviour rules, tuned against a number',
        blocks: [
          { code: 'def structuring(pays, threshold=10_000, floor=0.8, min_deposits=3, window_days=7):\n    cash = pays[(pays.channel == "cash") & (pays.direction == "in")]\n    near = cash[(cash.amount_usd >= floor * threshold)\n                & (cash.amount_usd < threshold)]\n    for cust, rows in near.groupby("customer_id"):\n        rows = rows.sort_values("booked_at")\n        for i in range(len(rows)):\n            w = rows[rows.booked_at - rows.booked_at.iloc[i]\n                     <= pd.Timedelta(days=window_days)]\n            if len(w) >= min_deposits and w.amount_usd.sum() >= threshold:\n                yield Alert("structuring", cust, w)\n                break', lang: 'python' },
          { p: 'Run it at `min_deposits=2` and at `3`, and record both. Then the pass-through rule: an incoming payment ' +
               'above 10,000 followed by outgoing payments totalling at least 90% of it within 24 hours.' },
          { code: 'structuring, min_deposits=2   16 alerts,  4 real   precision  25%\nstructuring, min_deposits=3    4 alerts,  4 real   precision 100%\npass through                   3 alerts,  3 real   precision 100%\ncorridor, XA/XB/XC           514 alerts,  0 real   precision   0%', lang: 'text' }
        ],
        check: 'All four rule results match, including the corridor rule finding nothing.'
      },
      {
        t: 'The queue, the case and the trail',
        blocks: [
          { code: 'create table alert (\n  id            bigserial primary key,\n  kind          text not null,              -- screening | structuring | pass_through\n  customer_id   text not null,\n  score         numeric,\n  rule_version  text not null,              -- which thresholds were in force\n  evidence      jsonb not null,             -- the payments, with their scores\n  status        text not null default \'open\',\n  created_at    timestamptz not null default now()\n);\n\ncreate table alert_event (                   -- append only, as in level 13\n  id         bigserial primary key,\n  alert_id   bigint not null references alert(id),\n  actor      text not null,\n  action     text not null,                 -- triaged | discounted | escalated | reopened\n  reason     text not null,\n  at         timestamptz not null default now()\n);', lang: 'sql' },
          { p: '`rule_version` is the field people leave out. Without it, an alert from March cannot be explained after ' +
               'April\'s tuning change, and explaining old alerts is most of what an examination consists of.' }
        ],
        check: 'Closing an alert writes an event rather than updating a row in place, and reopening one is possible.'
      }
    ]
  },

  glossary: [
    { t: 'AML', d: 'Anti money laundering: the obligations on a regulated firm to know its customers, monitor behaviour and report suspicion.' },
    { t: 'Sanctions screening', d: 'Checking parties against designation lists. A prohibition, so there is no acceptable miss rate.' },
    { t: 'Transaction monitoring', d: 'Rules or models over behaviour, producing alerts for human judgement.' },
    { t: 'KYC and CDD', d: 'Know your customer and customer due diligence: identifying who you are dealing with, before and during the relationship.' },
    { t: 'PEP', d: 'Politically exposed person. Not a wrongdoer, a category that calls for extra diligence.' },
    { t: 'Jaro-Winkler', d: 'A string similarity measure with a bonus for a shared prefix, widely used for names.' },
    { t: 'Normalisation', d: 'Case folding, punctuation removal, title stripping and token sorting, before any similarity is computed.' },
    { t: 'Recall', d: 'Of the real hits, the share the system found. On a prohibition, the number that has to be 100%.' },
    { t: 'Precision', d: 'Of the alerts raised, the share that are real. Low by design in this domain.' },
    { t: 'False positive budget', d: 'How many innocent alerts the team can actually work. The real constraint on every threshold.' },
    { t: 'Structuring', d: 'Splitting money into amounts below a reporting threshold, repeatedly.' },
    { t: 'Pass through', d: 'Money arriving and leaving almost immediately, leaving little behind.' },
    { t: 'Blocking', d: 'Comparing only names that share a key, so screening scales past a full cross product.' },
    { t: 'Below the line testing', d: 'Sampling what a threshold no longer alerts on, to check the misses are really innocent.' },
    { t: 'Tipping off', d: 'Telling a customer that they are under suspicion or reported. An offence in many jurisdictions.' },
    { t: 'SAR or STR', d: 'The report a firm files when suspicion stands. A person decides; the software records.' }
  ],

  quiz: [
    { q: "What is the standard for sanctions screening, as opposed to transaction monitoring?",
      options: [
        "Prohibition: there is no acceptable threshold for a miss",
        "Suspicion, documented",
        "Materiality above a monetary limit",
        "Best effort within the alert budget"
      ],
      answer: 0,
      why: "A payment to a designated party is a breach regardless of size or intent, which is why recall dominates the threshold choice." },

    { q: "Normalising names before matching recovers which of the level's seven planted hits?",
      options: [
        "Five of the seven",
        "Two of the seven",
        "None: normalisation only affects speed",
        "All seven"
      ],
      answer: 0,
      why: "Case, titles and word order are all fixed by normalisation. The transliteration and the dropped letter need a similarity measure." },

    { q: "Exact matching on this data produces 5 alerts, all correct. Why is that not good enough?",
      options: [
        "Exact matching is too slow at scale",
        "The queue is too small to justify the system",
        "Precision of 100% is statistically implausible",
        "Two designated parties were paid"
      ],
      answer: 3,
      why: "Perfect precision and 71.4% recall is a failure on a prohibition. The two it missed are the two that matter." },

    { q: "Moving the fuzzy threshold from 0.95 down to 0.85 on this data:",
      options: [
        "Halves the false positive rate",
        "Finds two more real hits",
        "Finds no more real hits and raises the queue from 182 to 7,081",
        "Has no effect because the scores cluster near 1.0"
      ],
      answer: 2,
      why: "Thirty nine times the work for nothing. The useful band is narrow, and the sweep is what shows you where it is." },

    { q: "Raising the threshold from 0.95 to 0.97 on this data:",
      options: [
        "Keeps all seven hits and cuts the queue",
        "Loses the transliteration, which scored 0.9689",
        "Loses the dropped letter, which scored 0.9867",
        "Makes no difference to recall"
      ],
      answer: 1,
      why: "One of the seven sits just below 0.97. That single number is the argument against picking a threshold by instinct." },

    { q: "Your compliance lead wants high recall and high precision from name matching alone. The honest answer is:",
      options: [
        "Train a model on past dispositions",
        "Lower the threshold and add a second pass",
        "On name similarity alone that point does not exist: you need secondary identifiers",
        "Use a better algorithm"
      ],
      answer: 2,
      why: "Innocent names genuinely resemble listed names. More information moves both numbers; a threshold only trades one for the other." },

    { q: "A match scores 0.96 and the date of birth is missing on the watchlist. What should the system do?",
      options: [
        "Block the payment automatically",
        "Discount it, since the identifier cannot be confirmed",
        "Lower the score by a fixed penalty",
        "Alert, because absence of an identifier is not evidence of innocence"
      ],
      answer: 3,
      why: "Auto discount on disagreement, never on absence. The entities hardest to identify are the ones with the least data." },

    { q: "Why score distinct counterparty names rather than every payment?",
      options: [
        "To avoid double counting alerts",
        "887 distinct names against 12,067 payments is a 93% saving, and the scores are identical",
        "Because payments can be duplicated",
        "Because pandas cannot join on strings"
      ],
      answer: 1,
      why: "Score once, join back. It also makes the threshold sweep fast enough to live in a test." },

    { q: "What is blocking, in the screening sense?",
      options: [
        "Preventing an analyst from reopening a closed alert",
        "Refusing a payment",
        "Comparing only names that share a key, so screening scales past a full cross product",
        "Freezing a customer account"
      ],
      answer: 2,
      why: "A shared first letter, phonetic key or token. The word is unfortunate, and it means something different from blocking a payment." },

    { q: "The structuring rule at two deposits gives 16 alerts and 4 real ones. At three deposits it gives 4 and 4. What should you record?",
      options: [
        "Nothing: tuning is an operational detail",
        "The alert count, since precision is implied",
        "Both settings, the date, the reason, who approved it, and a below the line sample of what three no longer catches",
        "Only the chosen setting, to keep the documentation short"
      ],
      answer: 2,
      why: "The alerts you stopped generating are invisible by construction, so a tuning change without a sample is indistinguishable from a bug." },

    { q: "The corridor rule alerts on 514 payments and finds nothing real. What does that tell you?",
      options: [
        "The data is missing real cases",
        "Geography alone is a poor rule, and it is the one most likely to be written first",
        "The jurisdiction list needs expanding",
        "The rule should run on a shorter window"
      ],
      answer: 1,
      why: "It costs an analyst a year of confirming that people send money to places. Geography belongs as a risk factor, not as a standalone rule." },

    { q: "Why does an alert need to store the rule version that produced it?",
      options: [
        "Because rule versions are personal data",
        "To allow replaying the rule",
        "For database partitioning",
        "So an alert from March can still be explained after April's tuning change"
      ],
      answer: 3,
      why: "Explaining old alerts under the thresholds in force at the time is most of what an examination consists of." },

    { q: "How should closing an alert be recorded?",
      options: [
        "Move it to an archive table",
        "Append an event with the actor, the action and the reason, leaving the history intact",
        "Update the alert row with the new status",
        "Delete the alert once it is dispositioned"
      ],
      answer: 1,
      why: "Level 13's rule, here as a legal requirement. Reopening has to be possible, and nothing is ever overwritten." },

    { q: "What is tipping off?",
      options: [
        "Telling a customer they are under suspicion or have been reported, which is an offence in many jurisdictions",
        "Filing a report without evidence",
        "Sharing a watchlist with another firm",
        "Escalating an alert to a senior analyst"
      ],
      answer: 0,
      why: "What a customer is told about a held payment is a legal question with a jurisdiction specific answer, not a template decision." },

    { q: "Which number belongs on the dashboard beside the alert count?",
      options: [
        "How long customers wait while their payments are held",
        "The size of the watchlist",
        "The number of rules in production",
        "The average similarity score"
      ],
      answer: 0,
      why: "A false positive is somebody's rent held for three days. If nobody measures the wait, nobody optimises it." }
  ],

  project: {
    title: 'The monitoring system',
    story: 'A small payments firm has 400 customers and a quarter of traffic to review. Build the screening engine, the ' +
           'monitoring rules, the alert queue and the tuning report, and defend the thresholds you chose.',
    scope: 'Uses this level plus level 11 (Postgres, append only tables), level 13 (the event log), level 3 (pandas) and ' +
           'level 15\'s habit of measuring before claiming. All three data files are synthetic and every name in them is ' +
           'invented, including the watchlist.',
    dataset: '{{RAW}}/data/level-19-payments.csv',
    requirements: [
      'Alias expansion: the 60 entity watchlist becomes 95 searchable strings',
      'A normaliser covering case, punctuation, titles and token order, with a test per rule',
      'Jaro-Winkler implemented by hand and checked against rapidfuzz on a hundred pairs',
      'Screening that scores distinct names once and joins back to the payments',
      'A threshold sweep reproducing the six row table, printed by the code rather than typed into the README',
      'A secondary identifier stage that discounts on disagreement only, storing the reason',
      'A structuring rule, reported at both two and three deposits',
      'A pass through rule catching the three real cases',
      'The corridor rule, included and shown to find nothing, because a negative result is a result',
      'An alert table and an append only event table, with rule_version stored on every alert',
      'A triage CLI that lists open alerts with their evidence and records a disposition with a reason',
      'A tuning report: the thresholds chosen, the sweep they came from, the date, and a below the line sample',
      'A README stating plainly what the system does not do and what a person has to decide',
      'The repository in your GitHub portfolio as finquest-monitoring'
    ],
    starter: {
      lang: 'python',
      code: '"""FinQuest level 19: sanctions screening and transaction monitoring.\n\nEvery name in the three data files is invented. The watchlist is fictional\nand corresponds to no real designation, programme or person.\n\nLayout:\n  monitor/names.py      normalise, jaro, jaro_winkler\n  monitor/screen.py     alias expansion, scoring, the threshold sweep\n  monitor/identify.py   secondary identifiers, discount with reasons\n  monitor/rules.py      structuring, pass_through, corridor\n  monitor/queue.py      alert + alert_event, dispositions\n  report.py             the sweep table and the tuning record\n"""\n\nimport re\n\nTITLES = {"MR", "MRS", "MS", "DR", "MISS", "PROF"}\n\n\ndef normalise(name: str) -> str:\n    """Upper case, strip punctuation and titles, sort the tokens."""\n    # TODO\n    pass\n\n\ndef jaro(s: str, t: str) -> float:\n    # TODO\n    pass\n\n\ndef jaro_winkler(s: str, t: str, p: float = 0.1) -> float:\n    # TODO\n    pass\n\n\ndef expand_watchlist(rows):\n    """60 entities -> 95 (entity_id, searchable_name) pairs."""\n    # TODO\n    pass\n\n\ndef sweep(pays, thresholds=(1.00, 0.95, 0.92, 0.90, 0.85, 0.80)):\n    """Print alerts, real hits, recall and precision at each threshold."""\n    # TODO\n    pass\n\n\ndef structuring(pays, threshold=10_000, floor=0.8, min_deposits=3, window_days=7):\n    # TODO\n    pass\n\n\ndef pass_through(pays, minimum=10_000, share=0.9, hours=24):\n    # TODO\n    pass\n'
    },
    tests: [
      'The watchlist expands from 60 rows to 95 searchable strings',
      'normalise() fixes case, punctuation, titles and word order, one test each',
      'jaro_winkler agrees with rapidfuzz to six decimal places on a hundred pairs',
      'The transliteration pair scores 0.9689 and the dropped letter pair scores 0.9867',
      'Normalised exact matching finds 5 of the 7 planted hits and nothing else',
      'The sweep produces 182 alerts at 0.95 and 7,081 at 0.85, with all seven hits at both',
      'A threshold of 0.97 loses exactly one of the seven',
      'No secondary identifier discount removes any of the seven real hits',
      'structuring() gives 16 alerts at two deposits and 4 at three, with 4 real in both',
      'pass_through() gives exactly 3 alerts, all real',
      'The corridor rule gives 514 alerts and none of them are real',
      'Closing an alert appends an event and leaves the alert history readable',
      'Every alert stores the rule_version in force when it fired'
    ],
    rubric: [
      { pts: 25, t: 'Matching done properly', d: 'Aliases expanded, normalisation tested rule by rule, Jaro-Winkler implemented and verified against a library.' },
      { pts: 25, t: 'Measurement', d: 'The sweep is computed by the code, both structuring settings are reported, and the corridor rule is shown to find nothing.' },
      { pts: 20, t: 'Thresholds defended', d: 'A chosen threshold with the reason, the date, the data it was measured on, and a below the line sample.' },
      { pts: 15, t: 'The queue', d: 'Alerts carry their evidence and rule version, dispositions append rather than overwrite, and reopening works.' },
      { pts: 15, t: 'Honesty', d: 'The README says what the system does not do, who decides, and how long a held payment makes somebody wait.' }
    ],
    stretch: [
      'Add blocking by first letter and by a phonetic key, and measure the speed up and whether any of the seven is lost',
      'Add a second watchlist with an overlapping entity, and deduplicate designations across sources',
      'Score how long each alert sat in the queue, and put the customer waiting time on the report',
      'Train a simple classifier on the dispositions to rank the queue, and show with level 14\'s reason codes why ranking is acceptable where auto closing is not'
    ],
    solutionPath: 'solutions/level-19'
  },

  faq: [
    { q: 'Is the watchlist real?',
      a: 'No. Every name in all three files is built from invented syllables, and the jurisdictions use ISO 3166 user assigned codes, XA, XB and XC, precisely so the exercise labels no real country and names no real person. A real system screens against published official lists.' },
    { q: 'Is a precision of 3.85% really normal?',
      a: 'In this area, yes. Published industry figures for AML and sanctions alerting sit in that region. The level asks you to choose the number deliberately and be able to defend it, rather than to fix the rate.' },
    { q: 'Should the system ever block a payment automatically?',
      a: 'An exact match against a designated party, with identifiers agreeing, is the case firms usually automate, and even then a person reviews before release. A similarity score alone should hold and alert, never block.' },
    { q: 'Why implement Jaro-Winkler rather than import it?',
      a: 'Because you are about to choose a threshold based on its output. Writing it once means the difference between 0.95 and 0.97 is a fact you understand rather than a dial you turned.' },
    { q: 'My sweep numbers are slightly different',
      a: 'Check the normaliser first: token sorting and title stripping both move scores. Then check that aliases were expanded, since screening the primary name alone loses hits and changes the counts.' },
    { q: 'Can I use a machine learning model instead of rules?',
      a: 'For ranking the queue, yes, and level 14 covers how to keep it explainable. For deciding that an alert needs no human, no, because a model that closes alerts silently is a model whose errors nobody can see.' },
    { q: 'Does this make me qualified to run compliance?',
      a: 'It makes you able to build the system a compliance team uses, which is the engineering job. The obligations, the reporting and the decision to file are theirs, and knowing where that line sits is part of what this level is teaching.' }
  ]
});
