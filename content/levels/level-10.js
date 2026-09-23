/* =========================================================================
   LEVEL 10: reconciliation
   ========================================================================= */
FQ.registerLevel({
  id: 10,
  codename: 'reconcile',
  title: 'The processor says one thing, your ledger says another',
  tagline: 'Every payments company runs this job before anybody arrives in the morning. 16,639 settlement lines against your own books, and the 49 that do not match are the entire job.',
  difficulty: 8,
  minutes: 420,
  tags: ['reconciliation', 'settlement', 'fees', 'payouts'],
  summary: 'Money you think you have and money that actually arrived are different numbers, and the difference has to be ' +
           'explained to the cent every single day. This level builds the engine: load the processor\'s settlement file, ' +
           'match it against the level 9 ledger, classify every break, and produce the report a finance team signs off. ' +
           'The shipped file has real breaks planted in it, including 37 payments the processor paid you for that your ' +
           'system has never heard of.',

  objectives: [
    'Explain what reconciliation is and why it runs every day',
    'Read a settlement file: gross, fee, net, and what the merchant actually receives',
    'Work out an effective fee rate, and why small payments cost so much more',
    'Match two sets of records and handle the ones that do not match',
    'Classify a break by cause and owner, rather than calling it a difference',
    'Recognise a timing difference and stop it becoming an investigation',
    'Refuse to make the numbers agree by force, and know why that matters'
  ],

  knowledge: [
    { h: 'Two records of the same money' },
    { p: 'Level 9 built a service that knows every payment it processed. That service is confident, detailed and wrong at ' +
         'the edges, because it only knows what it was told. Somebody else also knows: the processor that actually moved ' +
         'the money, and the bank that received it.' },
    { table: {
      head: ['Source', 'What it knows', 'What it does not'],
      rows: [
        ['**Your ledger**', 'Every payment you tried and what you recorded', 'Anything that happened when your request timed out'],
        ['**The processor\'s settlement file**', 'Every payment they actually processed, and what they charged you', 'Why you thought something should have happened'],
        ['**Your bank statement**', 'Money that truly arrived in your account', 'Anything about individual payments']
      ]
    }},
    { p: '**Reconciliation** is comparing these and explaining every difference. Not resolving, not adjusting: explaining. ' +
         'It runs daily in every company that touches money, and it is the job that catches bugs, fraud and processor ' +
         'errors before anybody else does.' },
    { money: 'This is also the work most engineering candidates have never seen, which is why it is worth having. Every ' +
             'payments company has a reconciliation team and most of them are short of engineers who understand it. Saying ' +
             '"I built a reconciliation engine and here are the five break types it found" is unusual and specific.' },

    { h: 'What a settlement file looks like' },
    { p: 'The shipped file covers the level 9 week and the two months of refunds and disputes that followed: **16,639 ' +
         'lines**, 15,868 captures, 692 refunds and 79 chargebacks. Each line is one movement of money, from the ' +
         'processor\'s point of view:' },
    { code: 'settlement_id,settled_at,payment_id,type,gross_minor,fee_minor,net_minor,currency,note\nS000412,2026-05-06,P000817,capture,7140,237,6903,USD,\nS001904,2026-05-09,P004412,refund,-4500,0,-4500,USD,\nS009233,2026-06-14,P002187,chargeback,-8800,1500,-10300,USD,', lang: 'text' },
    { ul: [
      '**gross** is the amount of the payment.',
      '**fee** is what the processor charged you for handling it.',
      '**net** is what you actually receive: gross minus fee. This is the number that reaches your bank.',
      'A **negative gross** is money going the other way: a refund or a chargeback.'
    ]},
    { p: 'Note the chargeback line. The payment comes back, **and** a $15.00 dispute fee is charged, so a disputed $88.00 ' +
         'sale costs the merchant $103.00. Across the file, disputes cost $1,185.00 in fees alone.' },

    { h: 'The fee is not the rate you were quoted' },
    { p: 'This processor charges **2.9% plus 30 cents** per capture, which is roughly the public price of every card ' +
         'processor you have heard of. Across the whole file the fees come to **$41,817.30** on **$1,182,568.81** of gross, ' +
         'an effective rate of **3.2851%**. The 30 cents is why. Split the captures by size:' },
    { table: {
      head: ['Payment size', 'Count', 'Gross', 'Effective fee rate'],
      rows: [
        ['Under $10', '568', '$4,122.57', '**7.03%**'],
        ['$10 to $50', '7,021', '$205,204.76', '3.93%'],
        ['$50 to $200', '7,221', '$688,114.54', '3.21%'],
        ['Over $200', '1,058', '$339,419.42', '2.99%']
      ]
    }},
    { p: 'A $5.89 payment pays 47 cents in fees: **8.0%**. The same percentage rate costs a small merchant more than twice ' +
         'what it costs a large one, entirely because of a fixed 30 cents. This is why micropayments are hard, why ' +
         'businesses batch small charges into one monthly bill, and why "2.9% plus 30 cents" is a more interesting sentence ' +
         'than it looks.' },
    { p: 'In the ledger the fee is its own entry, exactly as in level 4: customer out, merchant in, fee to the processor\'s ' +
         'revenue account, and the whole transaction sums to zero. If your ledger only records the net, you have lost the ' +
         'fee, and your merchant cannot see what they are paying.' },
    { check: {
      q: 'A merchant complains that your reported revenue is higher than the money in their bank account, and accuses your ' +
         'system of inventing sales. Explain the gap without looking at any data.',
      a: 'You are almost certainly reporting gross and they are looking at net. On this file the gap is $41,817.30 of fees ' +
         'on $1,182,568.81 of sales, so around 3.3% of everything. Two other things widen it: refunds and chargebacks are ' +
         'deducted from later payouts rather than from the sale they relate to, and money settles a day or two after the ' +
         'capture, so the last day or two of sales has not arrived yet. The fix is a report that shows gross, fees, refunds ' +
         'and net as separate lines rather than one number, which is exactly the report this level ends with.'
    }},

    { h: 'Payouts, and the day the merchant owes you money' },
    { p: 'The processor does not send money per payment. It batches everything that settled on a day and sends one ' +
         '**payout**. The shipped file has **59 payouts**, one per settlement date:' },
    { code: '2026-05-05  lines   662  net $   51,709.53\n2026-05-06  lines  1563  net $  120,348.14\n...\n2026-05-18  lines    47  net $   -1,394.92\n2026-05-19  lines    39  net $   -2,953.72', lang: 'text' },
    { p: 'Read the last two lines. **46 of the 59 payout days are negative**, totalling **-$36,883.51**. This merchant sold ' +
         'for one week and then spent two months refunding and losing disputes, so on those days the refunds going out are ' +
         'larger than the sales coming in.' },
    { p: 'A negative payout means the processor takes money **from** the merchant\'s bank account rather than sending it. ' +
         'If that fails, the merchant now owes the processor money, and this is one of the main ways a payments company ' +
         'loses money: a merchant collects payments, the customers dispute them months later, and by then the merchant has ' +
         'gone. That risk is why onboarding asks so many questions, and why processors hold reserves.' },

    { h: 'Matching: the part that is harder than it sounds' },
    { p: 'Reconciliation is a matching problem. For each line in the file, find the thing in your ledger that it refers ' +
         'to, and check they agree. Three things make it hard:' },
    { ol: [
      '**The two sides use different identifiers.** You call it `P000817`, they call it `S000412`, and the only link is a ' +
      'reference somebody remembered to send. This is exactly why level 9 insisted on sending your own reference with every ' +
      'network message.',
      '**One is not always one.** A payment can settle in parts, several payments can arrive in one line, and a refund ' +
      'relates to a capture that settled weeks earlier.',
      '**Both sides are moving.** The file is a snapshot of a period, your ledger is live, and the last few hours of ' +
      'activity are in one and not the other.'
    ]},
    { p: 'So a matching engine works in passes, from the most certain to the least, and anything still unmatched at the end ' +
         'becomes a **break** for a human:' },
    { table: {
      head: ['Pass', 'Rule', 'Confidence'],
      rows: [
        ['1', 'Exact reference and exact amount', 'Certain, match automatically'],
        ['2', 'Exact reference, amount differs', 'Matched, and flagged as an amount break'],
        ['3', 'No reference: same amount, same day, same last four digits', 'Probable. Match, and record why'],
        ['4', 'Anything left', 'A break. A person looks at it']
      ]
    }},

    { h: 'What the engine found' },
    { p: 'Run against the level 9 ledger, the reconciliation comes out like this. These are the real results, and every one ' +
         'of the five break types is a different problem with a different owner:' },
    { table: {
      head: ['Result', 'Count', 'Value', 'What it means'],
      rows: [
        ['Matched exactly', '**16,408**', '', 'Nothing to do'],
        ['Amount mismatch', '193', '$1,180.96', 'Mostly currency rounding, a few real differences'],
        ['Duplicate line in the file', '1', '', 'The processor sent the same line twice'],
        ['**In the file, not in your ledger**', '**37**', '**$3,116.61**', 'They processed payments you have no record of'],
        ['**In your ledger, not in the file**', '**12**', '**$1,690.07**', 'You captured money they never paid you']
      ]
    }},
    { p: 'The last two rows are the ones that matter, and they fail in opposite directions.' },
    { p: '**The 37.** Every one of them is a level 9 payment where the authorisation request timed out. Your service never ' +
         'knew whether the issuer approved it, the issuer did, and the processor duly took the money and paid it to the ' +
         'merchant. Without this job, $3,116.61 sits in a merchant\'s account with nothing in your system to explain it, and ' +
         'no way to answer a customer asking what the charge was.' },
    { p: '**The 12.** You captured $1,690.07 and the processor has not settled it. Sometimes that is timing. Sometimes the ' +
         'capture never actually reached them. Occasionally it is money you are simply owed and nobody noticed. This is the ' +
         'break type that pays for the whole job.' },
    { check: {
      q: 'Your reconciliation finds 37 payments in the processor\'s file that your ledger has never seen, all from last ' +
         'Tuesday. A colleague suggests inserting them into the ledger so the report balances. What do you do instead?',
      a: 'Find out what they are first, because inserting them would destroy the evidence. Here the cause is knowable: ' +
         'every one is a payment whose authorisation timed out, so the ledger holds an unknown and the processor holds a ' +
         'completed payment. The right sequence is to resolve each unknown through the level 9 resolver, which moves it to ' +
         'authorised with the processor\'s reference, then let the normal capture flow post the entries, and then rerun the ' +
         'reconciliation and watch the break disappear on its own. The rule, worth saying out loud in an interview: you ' +
         'never write an entry to make a reconciliation balance. You write an entry because something happened, and the ' +
         'reconciliation balances as a consequence.'
    }},

    { h: 'Timing differences are not breaks' },
    { p: 'The most common false alarm: a capture from this afternoon that settles tomorrow is in your ledger and not in ' +
         'today\'s file. Nothing is wrong. Treating those as breaks buries the real ones, and a queue full of noise is a ' +
         'queue nobody reads.' },
    { p: 'The engine needs a rule, written down: an unmatched capture younger than the processor\'s settlement window is ' +
         '**pending**, not a break. It only becomes a break when it is older than the window plus a margin you chose. The ' +
         'shipped file settles one to three days after capture, so anything unmatched after four days is worth a person\'s ' +
         'attention.' },
    { warn: 'Make the window a configured number, not a magic constant in an `if`. Processors change their settlement ' +
            'timing, and the day yours does, every capture in the country looks like a break at once.' },

    { h: 'Tolerance, and the difference between explaining and hiding' },
    { p: 'Of the 193 amount mismatches, 163 are foreign currency lines: payments priced in euros and settled in dollars, ' +
         'where the conversion leaves a cent or two of difference. The whole 193 are worth $1,180.96, against a file of ' +
         '$1.18 million.' },
    { p: 'It is tempting to add a rule that ignores differences under, say, five cents. That is acceptable **only** if all ' +
         'three of these are true:' },
    { ol: [
      '**The tolerance is written down**, with the reason, and approved by whoever owns the money.',
      '**Every tolerated difference is still recorded**, counted and totalled, so a systematic drift is visible even while ' +
      'no single case is investigated.',
      '**The total is watched.** A thousand one-cent differences all in the same direction is a bug rather than rounding, and a ' +
      'tolerance that hides it is worse than no reconciliation at all.'
    ]},
    { p: 'The general rule: a tolerance may stop you **investigating** a difference. It must never stop you **seeing** it.' },

    { h: 'Never plug the gap' },
    { p: 'A **plug** is an adjusting entry posted for no reason except to make two numbers agree. It is the single most ' +
         'dangerous thing in this level, and it is always tempting at 6pm on a Friday.' },
    { table: {
      head: ['Situation', 'The plug', 'What to do instead'],
      rows: [
        ['A fee is higher than expected', 'Adjust the fee entry to match', 'Post the fee the processor actually charged, and raise a query with them'],
        ['A payment is in the file and not the ledger', 'Insert it', 'Find out why it is missing, fix the cause, let the entry follow'],
        ['A small difference persists', 'Write it off silently', 'Record it as a tolerated difference, with a total somebody watches'],
        ['You cannot work it out today', 'Force it to balance', 'Leave the break open, aged, with an owner. Unexplained is a valid state']
      ]
    }},
    { p: 'The reason is not tidiness. A plug removes the evidence that something is wrong, so the next occurrence of the ' +
         'same bug has nothing to attach to, and a pattern that would have been obvious across a month becomes invisible. ' +
         'Fraud investigators look for plugs first, because that is where people hide things.' },
    { check: {
      q: 'A break has been open for eleven days: $412.00 that the processor settled and your ledger does not have. Nobody ' +
         'has worked out why. What is the right state for it to be in, and what should be true about it?',
      a: 'Open, aged eleven days, assigned to somebody by name, with a value and a written record of what has been checked ' +
         'so far. Unexplained is a legitimate state for a break to be in; unowned and unaged is not. What must also be true ' +
         'is that it is visible: an aging report that shows breaks by age and value, reviewed at a set time each week, so ' +
         'that one at eleven days is a conversation rather than a discovery. The instinct to make it disappear is exactly ' +
         'the instinct to resist, because in a year that same break type will have happened two hundred times and the ' +
         'record of it is the only way anybody will see the pattern.'
    }},

    { h: 'The numbers that tell you the job is working' },
    { p: 'A reconciliation engine is measured on four things, and a finance team will ask for all four:' },
    { table: {
      head: ['Metric', 'On this file', 'What a bad number means'],
      rows: [
        ['**Match rate**', '16,408 of 16,639 automatically: 98.6%', 'Below about 99%, your matching rules need work, not more people'],
        ['**Break count by type**', '5 types, 243 items', 'One type dominating is a bug with a known address'],
        ['**Value at risk**', '$4,806.68 unexplained in both directions', 'Rising week on week means something is broken upstream'],
        ['**Age of the oldest open break**', 'Should be days, not months', 'An old break is either impossible or forgotten, and both need saying']
      ]
    }},
    { p: 'And the job itself has to be repeatable: running it twice on the same file must produce the same result and ' +
         'create no duplicate breaks, which means every break carries a stable identifier derived from what it is about, ' +
         'not from when it was found.' },

    { h: 'The third leg: does the bank agree?' },
    { p: 'Matching your ledger to the processor\'s file proves you agree with the processor. It does not prove either of ' +
         'you is right about what arrived. The third comparison closes that:' },
    { code: 'your ledger      <-->   processor settlement file     (payments)\nsettlement file  <-->   your bank statement           (payouts)', lang: 'text' },
    { p: 'Each payout in the file should appear on the bank statement as one credit for the same amount, a day or so later. ' +
         'That check catches the failure the first comparison cannot: a processor that reports a payout and does not send ' +
         'it, a payment that goes to the wrong account, or a bank fee nobody expected. It is the same matching code with ' +
         'different inputs, which is why the engine is written to take two sources and a key rather than being hard wired ' +
         'to one file format.' }
  ],

  tutorial: {
    intro: 'Two files ship with this level: the settlement lines and the payouts. Your ledger is the level 9 event file, or ' +
           'your own database if you built it. Python and pandas are enough; the hard part is classification rather than ' +
           'code.',
    steps: [
      {
        t: 'Load both sides and agree on shape',
        blocks: [
          { p: 'The first real task in any reconciliation is making two different formats comparable. Normalise both into ' +
               'the same columns: a key, a type, a signed amount in minor units, a date, and where it came from.' },
          { code: 'import pandas as pd\n\nsettle = pd.read_csv("data/level-10-settlement.csv", parse_dates=["settled_at"])\nevents = pd.read_csv("data/level-09-card-events.csv", parse_dates=["at"])\n\nledger = events[events.event.isin(["capture", "refund", "chargeback"])].copy()\nprint(len(settle), "settlement lines,", len(ledger), "ledger movements")', lang: 'python' },
          { code: '16639 settlement lines, 16613 ledger movements', lang: 'text' },
          { warn: 'Signs are the first trap. The file records a refund as a negative gross; your ledger may record it as a ' +
                  'positive refund event. Decide one convention, convert at the boundary, and write a test with one refund ' +
                  'in it.' }
        ],
        check: 'Both sides are in one shape, with amounts in minor units and refunds negative on both.'
      },
      {
        t: 'Match what is easy',
        blocks: [
          { p: 'Pass one: join on payment id and type, and compare amounts. Everything that agrees exactly is done, and ' +
               'should be the overwhelming majority.' },
          { code: 'merged = settle.merge(ledger, left_on=["payment_id", "type"],\n                      right_on=["payment_id", "event"], how="outer", indicator=True)\n\nprint(merged._merge.value_counts())', lang: 'python' },
          { p: 'The `indicator=True` column is doing the work: `both` is a candidate match, `left_only` is in the file and ' +
               'not your ledger, `right_only` is in your ledger and not the file. Those three groups are the whole job.' }
        ],
        check: 'You can state how many lines are in both, and how many are only on one side.'
      },
      {
        t: 'Classify, do not just count',
        blocks: [
          { p: 'A difference with no cause attached is useless. Write a classifier that turns every unmatched or mismatched ' +
               'row into a named break type with an owner:' },
          { code: 'def classify(row, window_days=4):\n    if row.side == "both" and row.amount_file != row.amount_ledger:\n        if row.currency != "USD":\n            return "fx_rounding", "engineering"\n        return "amount_mismatch", "processor query"\n    if row.side == "file_only":\n        return "missing_in_ledger", "engineering"\n    if row.side == "ledger_only":\n        if row.age_days <= window_days:\n            return "pending_settlement", None        # not a break at all\n        return "unsettled_capture", "processor query"\n    return "matched", None', lang: 'python' },
          { code: 'matched              16408\namount mismatches      193   $1,180.96\nduplicate lines          1\nin file, not ledger     37   $3,116.61\nin ledger, not file     12   $1,690.07', lang: 'text', label: 'the target output' }
        ],
        check: 'Your counts match those five lines, and every break has a type and an owner.'
      },
      {
        t: 'Find the duplicate',
        blocks: [
          { p: 'One line in the file is sent twice. Find it with a group by, and be careful about what makes a line unique: ' +
               'the settlement id is different, everything else is identical.' },
          { code: 'dupes = settle.groupby(["payment_id", "type", "gross_minor", "settled_at"]).size()\nprint(dupes[dupes > 1])', lang: 'python' },
          { tip: 'Then ask the harder question: if the processor really did pay you twice, is it a duplicate line or a ' +
                 'duplicate payment? The answer changes who owes whom, and the only way to know is to check whether the ' +
                 'payout total includes it.' }
        ],
        check: 'You find exactly one duplicated line and can say whether the payout included it once or twice.'
      },
      {
        t: 'Tie the payouts to the lines',
        blocks: [
          { p: 'Each payout should equal the sum of the lines that settled that day. This is the check that catches a ' +
               'processor error and a parsing bug at the same time.' },
          { code: 'by_day = settle.groupby(settle.settled_at.dt.date).net_minor.sum()\npayouts = pd.read_csv("data/level-10-payouts.csv", parse_dates=["paid_at"])\ncheck = payouts.set_index(payouts.paid_at.dt.date).net_minor.sub(by_day)\nprint(check[check != 0])       # should be empty', lang: 'python' },
          { p: 'Then look at the negative payout days: 46 of the 59. Print them, and write one sentence in your README ' +
               'explaining what a negative payout means for the merchant\'s bank account.' }
        ],
        check: 'Every payout equals the sum of its lines, and you can list the negative days and their total.'
      },
      {
        t: 'Work out the fees for yourself',
        blocks: [
          { p: 'Recompute what the fee should have been, at 2.9% plus 30 cents, and compare with what was charged. Then ' +
               'produce the effective rate by payment size.' },
          { code: 'expected = (settle.gross_minor * 0.029).round().astype(int) + 30\ndiff = settle.fee_minor - expected\nprint(diff[diff != 0].describe())', lang: 'python' },
          { code: 'under $10     568 payments   $  4,122.57   fee 7.03%\n$10 to $50   7021 payments   $205,204.76   fee 3.93%\n$50 to $200  7221 payments   $688,114.54   fee 3.21%\nover $200    1058 payments   $339,419.42   fee 2.99%', lang: 'text' },
          { p: 'That table belongs in your README. It is a finding about the business, produced by an engineer, from data ' +
               'nobody asked you to look at.' }
        ],
        check: 'You can name the payments whose fee differs from the contract, and show the effective rate by size.'
      },
      {
        t: 'The exception queue',
        blocks: [
          { p: 'Breaks go somewhere a person works through them. Give each one a stable id derived from what it is about, so ' +
               'rerunning the job does not create it again:' },
          { code: 'break_id = sha256(f"{source}|{payment_id}|{break_type}|{period}".encode()).hexdigest()[:16]', lang: 'python' },
          { code: 'create table recon_break (\n  id            text primary key,\n  first_seen    timestamptz not null default now(),\n  last_seen     timestamptz not null default now(),\n  break_type    text not null,\n  owner         text,\n  payment_id    text,\n  value_minor   bigint not null,\n  status        text not null default \'open\',\n  resolution    text\n);', lang: 'sql' },
          { p: 'Then run the whole job twice and prove it: the same breaks, updated `last_seen`, no duplicates, nothing ' +
               'reopened.' }
        ],
        check: 'Running the reconciliation twice leaves the same number of open breaks.'
      },
      {
        t: 'The report somebody signs',
        blocks: [
          { p: 'Finish with the daily report: the totals, the match rate, the breaks by type with values, the aging, and the ' +
               'one line that matters most.' },
          { code: 'Reconciliation 2026-05-05 to 2026-07-10\n  settlement lines           16,639\n  matched automatically      16,408   98.6%\n  gross                  $1,182,568.81\n  fees                      $41,817.30   3.2851% effective\n  net                    $1,140,751.51\n\n  breaks                        243\n    amount mismatch             193   $1,180.96   (163 currency rounding)\n    missing in ledger            37   $3,116.61   engineering\n    unsettled capture            12   $1,690.07   processor query\n    duplicate line                1               processor query\n\n  unexplained value          $4,806.68\n  oldest open break             0 days', lang: 'text' },
          { tip: 'Add one sentence under it saying what changed since yesterday. A report nobody compares to yesterday is a ' +
                 'report nobody reads.' }
        ],
        check: 'The report runs from one command, and a reader with no context can tell whether today was normal.'
      }
    ]
  },

  glossary: [
    { t: 'Reconciliation', d: 'Comparing two records of the same money and explaining every difference.' },
    { t: 'Settlement file', d: 'The processor\'s record of what they actually processed and charged, usually daily.' },
    { t: 'Gross', d: 'The full amount of a payment, before fees.' },
    { t: 'Fee', d: 'What the processor charged for handling it. Its own entry in your ledger.' },
    { t: 'Net', d: 'Gross minus fee: what actually reaches the bank account.' },
    { t: 'Effective fee rate', d: 'Fees divided by gross, which is higher than the quoted rate because of the fixed part.' },
    { t: 'Payout', d: 'One transfer covering everything that settled in a period, rather than one per payment.' },
    { t: 'Negative payout', d: 'A day where refunds and disputes exceed sales, so the processor takes money back.' },
    { t: 'Break', d: 'A difference between two sources that has not been explained yet.' },
    { t: 'Timing difference', d: 'A difference caused only by the two sides being as of different moments. Not a break.' },
    { t: 'Match rate', d: 'The share of lines matched automatically. Below about 99% means the rules need work.' },
    { t: 'Tolerance', d: 'A threshold below which a difference is not investigated. It must still be recorded and totalled.' },
    { t: 'Plug', d: 'An adjusting entry posted only to make numbers agree. Never do this.' },
    { t: 'Aging', d: 'How long each open break has been open. The number that stops breaks being forgotten.' },
    { t: 'Exception queue', d: 'Where unmatched items go for a person to work through, with owners and status.' },
    { t: 'Three-way reconciliation', d: 'Ledger against processor, and processor against bank. The second catches what the first cannot.' },
    { t: 'Dispute fee', d: 'A fixed charge for each chargeback, payable by the merchant win or lose. $15.00 in this file.' }
  ],

  quiz: [
    { q: "What is the goal of a reconciliation run?",
      options: [
        "To explain every difference between them",
        "To correct the processor's file",
        "To make the two sets of numbers agree",
        "To calculate the fees"
      ],
      answer: 0,
      why: "Adjusting until things agree destroys the evidence. Explaining is the job; agreement is the consequence." },

    { q: "A settlement line shows gross 7140, fee 237, net 6903. What reaches the merchant's bank?",
      options: [
        "7140",
        "7377",
        "237",
        "6903"
      ],
      answer: 3,
      why: "Net is what arrives. Reporting gross as revenue and comparing it to the bank is the most common merchant complaint there is." },

    { q: "The processor charges 2.9% plus 30 cents. Across the file the effective rate is 3.2851%. Why is it higher?",
      options: [
        "Hidden fees",
        "Chargeback fees",
        "The fixed 30 cents is a large share of a small payment: under $10 the effective rate is 7.03%",
        "Currency conversion"
      ],
      answer: 2,
      why: "Which is why small payments are batched, and why the sentence \"2.9% plus 30 cents\" is more interesting than it looks." },

    { q: "A chargeback on an $88.00 sale costs the merchant:",
      options: [
        "$88.00 plus a $15.00 dispute fee, whether they win or lose",
        "The fee only",
        "Nothing if they win",
        "$88.00"
      ],
      answer: 0,
      why: "In this file disputes cost $1,185.00 in fees on top of the money returned." },

    { q: "46 of the 59 payout days in the file are negative. What does a negative payout mean?",
      options: [
        "The fees exceeded the rate card",
        "The payout was cancelled",
        "The merchant owes money, so the processor debits their bank account instead of paying them",
        "The processor made an error"
      ],
      answer: 2,
      why: "And if that debit fails, the processor is exposed, which is why onboarding and reserves exist." },

    { q: "The reconciliation finds 37 payments in the file that your ledger has never seen. In this data, what are they?",
      options: [
        "Payments whose authorisation timed out in level 9, which the issuer actually approved",
        "Duplicate lines",
        "Test transactions",
        "Chargebacks"
      ],
      answer: 0,
      why: "Worth $3,116.61. Without this job they are money in a merchant account with nothing to explain it." },

    { q: "The right response to those 37 is:",
      options: [
        "Tolerate them, since the value is small",
        "Insert them into the ledger so the report balances",
        "Ask the processor to remove them",
        "Resolve the underlying unknown payments, let the normal flow post the entries, and rerun"
      ],
      answer: 3,
      why: "You never write an entry to make a reconciliation balance. You write it because something happened." },

    { q: "12 captures are in your ledger and not in the file, worth $1,690.07. Why does this break type matter most?",
      options: [
        "It affects the fee calculation",
        "It is money you captured that the processor has not paid you",
        "It is the largest by value",
        "It is always a parsing error"
      ],
      answer: 1,
      why: "Sometimes timing, sometimes a capture that never arrived, sometimes money simply owed. This break type pays for the job." },

    { q: "A capture from this afternoon is not in today's file. What is it?",
      options: [
        "A failed capture",
        "A timing difference, pending until the settlement window has passed",
        "A break to investigate",
        "A duplicate"
      ],
      answer: 1,
      why: "Treating timing as breaks fills the queue with noise, and a queue full of noise is a queue nobody reads." },

    { q: "Your matching rules ignore differences under five cents. What must still be true?",
      options: [
        "The tolerance is written down and approved, every tolerated difference is still recorded and totalled, and somebody watches the total",
        "Nothing: that is what a tolerance means",
        "The tolerance must be under one cent",
        "It must apply only to foreign currency"
      ],
      answer: 0,
      why: "A tolerance may stop you investigating a difference. It must never stop you seeing it." },

    { q: "What is a plug?",
      options: [
        "A rule that matches two records",
        "An adjusting entry posted only to make two numbers agree",
        "A tolerance threshold",
        "A processor fee"
      ],
      answer: 1,
      why: "It removes the evidence that something is wrong, which is why fraud investigators look for them first." },

    { q: "A break has been open eleven days with no explanation. The correct state is:",
      options: [
        "Written off",
        "Open, aged, owned by a named person, with what has been checked recorded",
        "Closed, since nobody could explain it",
        "Reclassified as a timing difference"
      ],
      answer: 1,
      why: "Unexplained is a legitimate state. Unowned and unaged is not." },

    { q: "An automatic match rate of 98.6% suggests:",
      options: [
        "The engine is broken",
        "The tolerance is too wide",
        "A reasonable result, with the remaining items genuinely needing a person or better rules",
        "The processor is unreliable"
      ],
      answer: 2,
      why: "Below about 99% the answer is usually better matching rules rather than more people." },

    { q: "Why must every break carry an id derived from what it is about?",
      options: [
        "To sort the queue",
        "To link it to the payout",
        "So that rerunning the job updates the same break rather than creating a duplicate",
        "Because the database requires it"
      ],
      answer: 2,
      why: "A reconciliation that cannot be run twice safely will be run once, badly, by somebody in a hurry." },

    { q: "What does comparing the settlement file to the bank statement catch that comparing it to your ledger cannot?",
      options: [
        "Fee errors",
        "Chargebacks",
        "Duplicate payments",
        "A payout that was reported but never actually sent, or money that went to the wrong account"
      ],
      answer: 3,
      why: "Agreeing with the processor does not prove either of you is right about what arrived." }
  ],

  project: {
    title: 'reconcile: the job that runs before anybody arrives',
    story: 'Build the reconciliation engine: load the processor\'s settlement file, match it against your ledger, classify ' +
           'every difference by cause and owner, tie the payouts to the lines, and produce the report a finance team signs ' +
           'off. Then find the 37 payments the processor paid you for that your system has never heard of, and fix the ' +
           'cause rather than the symptom.',
    scope: 'Uses levels 4, 6 and 9. Python and pandas, or SQL if you prefer, with the breaks stored in the level 6 ' +
           'database. The settlement and payout files ship with the level.',
    dataset: '{{RAW}}/data/level-10-settlement.csv',
    requirements: [
      'A loader that normalises both sides into one shape: key, type, signed minor units, date, source',
      'A matching engine with named passes, from exact reference and amount down to probable matches, each recording why it matched',
      'A classifier producing named break types with an owner, including a `pending_settlement` type that is explicitly not a break',
      'The settlement window as configuration, not a constant buried in a condition',
      'Reproduction of the five headline results: 16,408 matched, 193 amount mismatches worth $1,180.96, 1 duplicate, 37 missing in ledger worth $3,116.61, 12 unsettled captures worth $1,690.07',
      'Detection of the duplicated settlement line, and a statement of whether the payout included it',
      'A payout check proving every payout equals the sum of the lines that settled that day',
      'A fee check recomputing 2.9% plus 30 cents per capture and listing every line that differs',
      'An effective fee rate table by payment size, reproducing 7.03% under $10 and 2.99% over $200',
      'An exception queue with stable break ids, first seen, last seen, owner, status and resolution',
      'Proof that running the job twice changes nothing: same breaks, no duplicates, nothing reopened',
      'A daily report with totals, match rate, breaks by type and value, aging, and unexplained value',
      'A written resolution of the 37: what they are, and the change that stops them recurring',
      'A README stating the tolerance you chose, why, and what you do with tolerated differences',
      'The repository public on GitHub as `reconcile`'
    ],
    starter: {
      lang: 'python',
      code: '"""FinQuest level 10: reconciliation.\n\nLayout:\n  recon/load.py       read both sides into one normalised shape\n  recon/match.py      the passes, most certain first\n  recon/classify.py   break types, owners, and what is merely pending\n  recon/payouts.py    payouts against the lines that make them up\n  recon/fees.py       recompute the contract and find differences\n  recon/queue.py      stable break ids, first seen, last seen, status\n  recon/report.py     the daily report somebody signs\n"""\n\nfrom dataclasses import dataclass\nfrom datetime import date\n\nSETTLEMENT_WINDOW_DAYS = 4      # configuration, not a magic number\nFEE_PERCENT, FEE_FIXED = 0.029, 30\n\n\n@dataclass(frozen=True)\nclass Movement:\n    """One movement of money, from either side, in one shape."""\n    key: str\n    kind: str              # capture | refund | chargeback\n    amount_minor: int      # signed: refunds and chargebacks negative\n    at: date\n    source: str            # "ledger" or "settlement"\n\n\ndef load_settlement(path: str) -> list[Movement]:\n    # TODO\n    raise NotImplementedError\n\n\ndef load_ledger(path: str) -> list[Movement]:\n    # TODO\n    raise NotImplementedError\n\n\ndef reconcile(ledger: list[Movement], settlement: list[Movement], as_of: date):\n    """Return (matched, breaks). A break has a type, an owner and a value."""\n    # TODO\n    raise NotImplementedError\n'
    },
    tests: [
      'Loading both files produces movements with refunds negative on both sides',
      'The reconciliation reports 16,408 exact matches',
      'It reports 193 amount mismatches totalling $1,180.96, with the currency ones separated',
      'It finds exactly one duplicated settlement line',
      'It reports 37 movements in the file with no ledger record, totalling $3,116.61',
      'It reports 12 captures in the ledger that never settled, totalling $1,690.07',
      'A capture two days old with no settlement line is classified pending, not a break',
      'The same capture five days old is classified as a break',
      'Every payout equals the sum of the lines that settled that day',
      'The fee check recomputes 2.9% plus 30 cents and finds the lines that differ',
      'The effective rate table reproduces 7.03% under $10 and 2.99% over $200',
      'Running the whole job twice produces the same open breaks with no duplicates',
      'Every break has a type, a value and an owner, and none is silently dropped'
    ],
    rubric: [
      { pts: 25, t: 'Matching that works', d: 'Named passes, a match rate above 98%, and every automatic match recording the rule that made it.' },
      { pts: 25, t: 'Classification, not counting', d: 'Five break types with owners, timing separated from breaks, and the window configurable.' },
      { pts: 20, t: 'Repeatable and operable', d: 'Stable break ids, a queue with aging, and a second run that changes nothing.' },
      { pts: 15, t: 'The money checks', d: 'Payouts tied to lines, fees recomputed from the contract, effective rate by size.' },
      { pts: 15, t: 'Judgement', d: 'The 37 resolved at the cause, a stated tolerance with its reasoning, and a report a finance team could sign.' }
    ],
    stretch: [
      'Add the third leg: a synthetic bank statement, and reconcile payouts against credits',
      'Add a second processor with a different file format, and see whether your engine needed rewriting or just configuring',
      'Add multi currency properly: settle euros in euros, hold a separate balance per currency, and reconcile each',
      'Produce a break aging report by week, and a chart of unexplained value over time',
      'Make the job resumable: if it dies halfway through 16,639 lines, restarting must not double count'
    ],
    solutionPath: 'solutions/level-10'
  },

  faq: [
    { q: 'Why not just trust the processor?',
      a: 'Because they are reconciling too, against you. Processors make mistakes, files get truncated, and duplicate lines happen, all of which are in the shipped file. This is not suspicion. Two independent records are the only way either side can be sure.' },
    { q: 'Should reconciliation run in the database or in Python?',
      a: 'Either. SQL is excellent at the matching and terrible at expressing "why". Most real engines do the joins in SQL and the classification in code. What matters more is that the output is a queue with owners rather than a printed list.' },
    { q: 'My match rate is 82% and I cannot see why',
      a: 'Almost always keys or signs. Check that you are matching on the same identifier both sides use, and that refunds have the same sign in both. Print ten unmatched rows from each side next to each other: the answer is usually visible in the first three.' },
    { q: 'How big should a tolerance be?',
      a: 'Small enough that a real error cannot hide inside it, and always paired with a total. On this file the currency rounding differences are one or two cents each; a five cent tolerance is defensible, a five dollar one is not.' },
    { q: 'What happens to a break that is never explained?',
      a: 'After an agreed period it is written off, deliberately, by somebody with the authority to do that, with the reason recorded. That is a business decision, not an engineering one, and the engineering job is to make sure it is a decision rather than a disappearance.' },
    { q: 'Is this not just an accounting job?',
      a: 'The investigation is. The engine, the matching rules, the classification, the queue and the daily report are engineering, and they are what decide whether the accountants spend their day on ten items or two thousand.' },
    { q: 'What do I say about this project in an interview?',
      a: 'The 37. Explain that your reconciliation found 37 payments the processor had settled that your system had no record of, that every one traced back to an authorisation timeout, and that you fixed the cause rather than inserting the rows. That answers the reconciliation question, the idempotency question and the judgement question in one story.' }
  ]
});
