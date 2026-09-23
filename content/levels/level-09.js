/* =========================================================================
   LEVEL 9: the life of a card payment
   ========================================================================= */
FQ.registerLevel({
  id: 9,
  codename: 'card-lifecycle',
  title: 'The life of a card payment',
  tagline: 'Authorise, capture, void, refund, chargeback, expire. Six words that decide whether a merchant gets paid, and the domain knowledge that separates a generic backend candidate from one a payments company wants.',
  difficulty: 8,
  minutes: 420,
  tags: ['payments', 'state machines', 'declines', 'chargebacks'],
  summary: 'A card payment is not one event. It is a hold, then a capture, then money actually moving days later, with a ' +
           'dozen ways to fall off the path. This level builds the service that tracks it, against a week of real shaped ' +
           'card traffic: 20,000 authorisations, 37,987 events, and the 159 requests where the network never answered and ' +
           'nobody knows whether the customer was charged.',

  objectives: [
    'Name every party in a card payment and say what each one does',
    'Separate authorisation, capture and settlement, and say when money actually moves',
    'Decide what your ledger writes at each stage, and what it must not write',
    'Read a decline code and know which ones may be retried',
    'Handle the request that timed out, where the state is genuinely unknown',
    'Model the whole lifecycle as a state machine that refuses impossible moves',
    'Explain a chargeback, and what engineering owes the dispute process'
  ],

  knowledge: [
    { h: 'Who is actually in the room' },
    { p: 'Somebody taps a card in a shop. Five parties are involved, and a backend engineer at a payments company works for ' +
         'one of them while talking to the other four:' },
    { table: {
      head: ['Party', 'Who they are', 'What they do'],
      rows: [
        ['**Cardholder**', 'The person paying', 'Presents the card'],
        ['**Merchant**', 'The shop', 'Asks for the money'],
        ['**Acquirer**', 'The merchant\'s payment company: Stripe, Adyen, Checkout', 'Takes the request and gets an answer. **This is usually you**'],
        ['**Card network**', 'Visa, Mastercard, Amex', 'Routes the message to the right bank and sets the rules'],
        ['**Issuer**', 'The bank that gave the cardholder the card', 'Decides yes or no, and holds the money']
      ]
    }},
    { p: 'The message goes merchant, acquirer, network, issuer, and the answer comes back the same way, in under a second. ' +
         'Your service sits in the middle, and everything in this level is about what you record while that happens.' },

    { h: 'Two steps that people think are one' },
    { p: 'The most common misunderstanding in payments: a card payment has **two** separate steps, and they can be hours or ' +
         'days apart.' },
    { table: {
      head: ['Step', 'What it means', 'Has money moved?'],
      rows: [
        ['**Authorisation**', 'The issuer sets the amount aside and promises it is there', 'No. The customer sees it as pending'],
        ['**Capture**', 'The merchant says "take it": now it is a real charge', 'In your books, yes'],
        ['**Settlement**', 'The banks actually move funds between themselves, usually a day or two later', 'Yes, for real']
      ]
    }},
    { p: 'This level ships a week of a merchant\'s card traffic: 20,000 authorisation attempts and 37,987 events in all. ' +
         'Here is what happened to them:' },
    { table: {
      head: ['Outcome', 'Count', 'Share'],
      rows: [
        ['Approved', '17,216', '86.08% of attempts'],
        ['Declined', '2,625', '13.12% of attempts'],
        ['**Timed out**', '**159**', '**0.80% of attempts**'],
        ['Of the approved: captured', '15,842', '92.02%'],
        ['Of the approved: voided', '533', '3.10%'],
        ['Of the approved: hold expired, never captured', '841', '4.88%']
      ]
    }},
    { p: 'Read the last row. **841 authorisations, worth $74,230.57, were approved and then nothing happened.** The customer ' +
         'saw money held against their card for a week for a sale the merchant never completed. That is a real and common ' +
         'failure, and it is your service\'s job to make it visible.' },
    { p: 'And the timing of capture matters more than people expect:' },
    { code: 'capture delay, from authorisation to capture\n  median  8.6 hours\n  p90    30.8 hours\n  max   141.0 hours   (just under six days)\n  82.0% captured within 24 hours', lang: 'text', label: 'measured over 15,842 captures' },
    { check: {
      q: 'A customer calls, furious: your merchant charged them twice, once on Monday and once on Tuesday, for one order. ' +
         'The merchant swears there was only one sale. Before looking at anything, what are the two most likely ' +
         'explanations?',
      a: 'First, and most likely, there is one charge and one hold. The Monday item is the authorisation the customer sees ' +
         'as pending, and the Tuesday item is the capture that became the real charge, so the same money appears twice on ' +
         'their app until the hold falls off. Nothing is wrong, and the explanation is needed anyway. Second, there really ' +
         'were two authorisations: a first attempt that timed out and a retry, where the network approved both. That is the ' +
         'case the rest of this level is about, and it is why an idempotency key has to travel all the way to the network ' +
         'rather than stopping at your own database.'
    }},

    { h: 'What your ledger writes, and when' },
    { p: 'This is where level 4 and level 6 meet the real world. The rule is simple and gets broken constantly:' },
    { ul: [
      '**Authorisation writes no ledger entries.** No money has moved. What you write is a record of the hold: an amount, an expiry, and a reference from the network.',
      '**Capture writes the entries.** Customer out, merchant in, fee to your revenue account, summing to zero, exactly as in level 4.',
      '**Void writes nothing** except a status change, because the hold never became money.',
      '**Refund writes a new balanced transaction** in the opposite direction, never a deletion, exactly as in level 4.',
      '**Chargeback writes a balanced transaction too**, and usually a second one for the dispute fee, which the merchant pays whether they win or lose.'
    ]},
    { warn: 'Writing entries at authorisation is the classic beginner mistake, and it is expensive: your ledger says the ' +
            'merchant has money they will not receive, your reconciliation against the bank never matches, and the 4.88% of ' +
            'holds that expire become fake revenue that somebody has to unwind by hand.' },

    { h: 'Partial capture, and money you never take' },
    { p: 'A capture does not have to be for the authorised amount. In this week, **1,273 captures, 8.04% of them, were for ' +
         'less than was authorised**, leaving **$38,580.89** authorised and never taken.' },
    { p: 'That is normal, and it is why the feature exists:' },
    { table: {
      head: ['Situation', 'Why the capture is smaller'],
      rows: [
        ['An order ships in two parcels', 'You capture each part as it ships, because you may only charge for what you sent'],
        ['An item is out of stock', 'The customer paid for three, you send two'],
        ['A restaurant or taxi', 'The authorisation includes room for a tip; the capture is the real total'],
        ['Fuel', 'The pump authorises a large round amount before knowing how much you take']
      ]
    }},
    { p: 'So your data model needs an authorised amount and a captured amount as separate fields, and your rules need to ' +
         'refuse a capture larger than the authorisation, which networks also refuse beyond a small percentage.' },

    { h: 'Void or refund: the same money, different words' },
    { p: 'Both give the customer their money back, and they are not interchangeable:' },
    { table: {
      head: ['', 'Void', 'Refund'],
      rows: [
        ['When', 'Before capture', 'After capture'],
        ['What happens', 'The hold is released', 'A new payment in the opposite direction'],
        ['The customer sees', 'The pending line disappears, often within days', 'A separate credit, often several days later'],
        ['Your fees', 'Usually none', 'The original processing fee is usually not returned'],
        ['In this week', '533 voids, $40,814.45', '692 refunds, $48,140.30']
      ]
    }},
    { p: 'The rule to put in code: **if it has not been captured, void it.** It is faster for the customer and cheaper for ' +
         'the merchant. A system that refunds where it could have voided is quietly costing its merchants money, and ' +
         'nobody will tell you.' },

    { h: 'Declines are not all the same' },
    { p: 'Of 20,000 attempts, 2,625 were declined. The code the issuer sends back is the most useful field in the whole ' +
         'response, and most systems ignore it:' },
    { table: {
      head: ['Decline code', 'Count', 'Share of declines', 'Retry later?'],
      rows: [
        ['`insufficient_funds`', '1,121', '42.7%', 'Yes, carefully: the money may arrive on payday'],
        ['`do_not_honor`', '630', '24.0%', 'Yes, carefully: the issuer refused without saying why'],
        ['`incorrect_cvc`', '292', '11.1%', 'No: the details are wrong, ask the customer'],
        ['`expired_card`', '211', '8.0%', 'No: ask for a new card'],
        ['`velocity_exceeded`', '196', '7.5%', 'Yes, later: too many attempts too fast'],
        ['`lost_or_stolen`', '95', '3.6%', '**Never**'],
        ['`pickup_card`', '80', '3.0%', '**Never**: the issuer is asking for the card to be taken']
      ]
    }},
    { p: 'The split that matters is **hard** against **soft**. A hard decline will never succeed with the same card and ' +
         'details: retrying it wastes money, annoys the customer, and counts against you with the networks. A soft decline ' +
         'might succeed later.' },
    { money: 'In this week, 1,947 declines (74.2%) were soft, worth **$167,410.94** of attempted sales. A sensible retry ' +
             'policy on those is the single highest value feature in most subscription businesses, which is why "recovering ' +
             'failed payments" is a product every payments company sells. This is also why the decline code has to be stored ' +
             'on the payment, not logged and forgotten.' },
    { warn: 'Retry rules are set by the card networks, not by you: there are limits on how many times and how often you may ' +
            'retry the same declined payment, and exceeding them carries fines. Any retry you build needs a maximum attempt ' +
            'count, a growing delay, and a permanent stop on hard declines.' },
    { check: {
      q: 'Your subscription service retries every failed charge nightly until it works. Three months in, your approval rate ' +
         'is falling and the network has been in touch. What did you build wrong?',
      a: 'You retried hard declines. A card reported lost or stolen, or an expired card, will never approve, so every night ' +
         'you send the network a request you already know the answer to, and both the issuer and the network score you on ' +
         'the share of your traffic that is refused. Falling approval rates across your whole book is the punishment, and ' +
         'fines are the next one. The fix has three parts: classify every decline code as hard or soft, never retry a hard ' +
         'one, and on soft ones use a small number of attempts with growing gaps, ideally timed for when money tends to ' +
         'arrive rather than at midnight with everybody else.'
    }},

    { h: 'The 159 requests where nobody knows what happened' },
    { p: 'This is the part that separates people who have worked on payments from people who have read about them. In this ' +
         'week, **159 authorisation attempts, 0.80%, timed out**: your service sent the request, waited about 30 seconds, ' +
         'and got nothing back.' },
    { code: 'authorize  P010423  $71.40   timeout after 29,572 ms\n\n# and now: did the issuer approve it or not?', lang: 'text' },
    { p: 'You genuinely do not know. The request may never have arrived. It may have been approved and the answer lost on ' +
         'the way back, in which case the customer has a hold on their card and your system has no record of it. The money ' +
         'at risk here is **$11,477.03**, and the wrong move in either direction is bad:' },
    { table: {
      head: ['If you assume it failed and retry', 'If you assume it succeeded'],
      rows: [
        ['The customer may be authorised twice, and see two holds', 'You may never take money for a real sale'],
        ['They ring the merchant, who rings you', 'The merchant is short, and finds out at month end'],
        ['Your ledger has a hold nobody is tracking', 'Your ledger has a payment the network never approved']
      ]
    }},
    { p: 'There are three real defences, and a serious system has all three:' },
    { ol: [
      '**Send your own reference with every request.** Every network message carries an identifier you choose, so a retry of the same payment carries the same one and the issuer can recognise it. This is level 4\'s idempotency key, extended past your own database to the party you are calling.',
      '**Send a reversal.** If you timed out and intend to retry, first tell the network to cancel anything it may have approved under that reference. It is a cheap message and it releases a hold that may not exist.',
      '**Reconcile the next day.** The network sends a file of everything it thinks happened. Anything in that file you have no record of, or anything you have that is not in the file, is a break to investigate. That file, and that job, is level 10.'
    ]},
    { check: {
      q: 'Your authorisation request times out. Your code catches the timeout, marks the payment as failed, and tells the ' +
         'customer to try again. What has your system quietly done, and what should it have recorded instead?',
      a: 'It has thrown away the only evidence that the attempt happened. If the issuer did approve it, there is now a hold ' +
         'against the customer\'s card that nothing in your system knows about, and when tomorrow\'s file from the network ' +
         'lists it, nobody can match it to anything. The state after a timeout is **unknown** rather than failed, and it ' +
         'needs to be a state your model can hold. Record the attempt with the reference you sent, mark it unknown, send a ' +
         'reversal if you are about to retry, and let the reconciliation job resolve it against the network\'s own record. ' +
         '"Unknown" is an uncomfortable state to design for and it is the honest one.'
    }},

    { h: 'Chargebacks: the customer\'s bank overrules everybody' },
    { p: 'A **chargeback** is not a refund. A refund is the merchant agreeing. A chargeback is the cardholder telling their ' +
         'own bank the charge was wrong, and that bank taking the money back from the merchant, whether or not the merchant ' +
         'agrees.' },
    { code: 'the customer disputes  ->  the issuer takes the money back  ->  the merchant may\n                                                              contest it with evidence\n                                                              (a "representment")\n                                                                     |\n                                                    the issuer decides, then\n                                                    either side may escalate', lang: 'text' },
    { p: 'In this week there were **79 chargebacks, 0.499% of captured payments, worth $6,152.18**. That rate matters more ' +
         'than the amount: the card networks run monitoring programmes, and a merchant whose chargeback rate goes above ' +
         'roughly 0.9% to 1% of transactions enters a programme with fines attached, and can eventually lose the ability to ' +
         'accept cards at all.' },
    { p: 'What engineering owes the dispute process is evidence, gathered at the time and retrievable months later: the ' +
         'authorisation response, the delivery confirmation, the IP address and device, the terms the customer accepted, and ' +
         'the exact timestamps. None of that can be collected after the dispute arrives, which is why it is an engineering ' +
         'problem rather than a support one.' },

    { h: 'Where the week\'s money went' },
    { p: 'Every number below comes from the shipped file, and a good service can produce this table on demand. It is also ' +
         'the report a merchant actually wants:' },
    { table: {
      head: ['', 'Amount', 'Note'],
      rows: [
        ['Authorised', '$1,387,793.78', '17,216 approved authorisations'],
        ['Captured', '$1,234,167.87', '88.9% of what was authorised'],
        ['Refunded', '-$48,140.30', '692 refunds'],
        ['Charged back', '-$6,152.18', '79 disputes'],
        ['**Net to the merchant**', '**$1,179,875.39**', 'Before your fees'],
        ['Expired, never captured', '$74,230.57', '841 holds that were simply abandoned'],
        ['Voided', '$40,814.45', '533 cancelled before capture'],
        ['Authorised above what was captured', '$38,580.89', 'On the 1,273 partial captures']
      ]
    }},
    { p: 'The gap between the first two lines is the one to understand: **$153,625.91 was authorised and never captured**, ' +
         'which is money the customers saw held against their cards and the merchant never received. Expiries, voids and ' +
         'partial captures account for all of it, and a service that cannot explain that gap will be asked to.' },

    { h: 'The whole thing as a state machine' },
    { p: 'Level 7 introduced state machines. This is the one that matters in payments, and writing it down is what stops ' +
         'the impossible moves that cause real incidents:' },
    { code: '                  +--> declined (final)\n                  |\ncreated --> authorizing --> authorized --+--> captured --+--> refunded (final)\n                  |             |         |               |\n                  |             |         +--> expired    +--> charged_back (final)\n                  |             |              (final)\n                  |             +--> voided (final)\n                  |\n                  +--> unknown --> (reconciliation decides)', lang: 'text' },
    { p: 'The transitions this refuses are all real bugs that have cost real money:' },
    { table: {
      head: ['Attempted move', 'Why it must be refused'],
      rows: [
        ['Capture an expired authorisation', 'The hold is gone. The network will refuse, and your ledger would have recorded money you cannot collect'],
        ['Capture twice', 'The customer is charged twice for one sale'],
        ['Void after capture', 'The money has moved. What you want is a refund'],
        ['Refund more than was captured', 'You are sending the customer money they never paid'],
        ['Anything at all after a chargeback', 'The dispute process owns it now']
      ]
    }},
    { p: 'And every one of those events needs its own idempotency key, because each of them is a network call that can time ' +
         'out and be retried. A capture that runs twice because your retry had no key is the same bug as level 4\'s double ' +
         'charge, with a slower feedback loop.' },
    { check: {
      q: 'A partial capture of $30 happens on a $50 authorisation. Two days later the merchant asks to capture the other ' +
         '$20. What should your service do, and what does that tell you about the data model?',
      a: 'Usually refuse it, and the reason is the data model. Most networks and acquirers allow a single capture per ' +
         'authorisation, so once you capture $30 the remaining $20 of the hold is released rather than saved for later, and ' +
         'the honest answer is that the merchant needs a new authorisation for the second amount, which the customer may now ' +
         'fail. Some acquirers do support multiple partial captures against one authorisation, which is exactly why this has ' +
         'to be an explicit rule in your service rather than an assumption: the payment needs an authorised amount, a ' +
         'captured amount, a remaining amount and a flag for whether more than one capture is allowed, and the state machine ' +
         'has to read all four.'
    }},

    { h: 'What you store, and what you must not' },
    { p: 'Your service stores the payment, its events and the references the network gave you. It does **not** store the ' +
         'card number. The full number, called the **PAN**, drags your entire system into a security standard called PCI ' +
         'DSS, as level 10 warned. What you keep instead is a **token**, an opaque id that stands in for the card, plus the ' +
         'last four digits and the expiry for display.' },
    { code: 'payment_id      P010423\ntoken           tok_9c1df0a4b2       <- stands in for the card\nlast4           4471\nauth_amount     7140\ncaptured        7140\nstate           captured\nnetwork_ref     8829174002          <- what the network calls it\nour_ref         idem_5f3a91         <- what we called it, sent with every message', lang: 'text' },
    { p: 'Those last two fields are what make reconciliation possible. Level 15 builds the vault that issues the token.' }
  ],

  tutorial: {
    intro: 'You will build two things: a service that tracks payments through their lifecycle, and a fake card network to ' +
           'talk to, because you cannot learn timeout handling against something that never times out. Python, the level 7 ' +
           'API, the level 6 database. The week of card events ships with this level.',
    steps: [
      {
        t: 'Read the week and reproduce the headline numbers',
        blocks: [
          { p: 'Before writing any service, load the event file and reproduce the figures from the knowledge section. If your ' +
               'numbers do not match, your understanding of the data is wrong, and everything after this would be built on ' +
               'it.' },
          { code: 'import pandas as pd\n\nev = pd.read_csv("data/level-09-card-events.csv", parse_dates=["at"])\nauths = ev[ev.event == "authorize"]\nprint(auths.result.value_counts())\nprint(len(ev), "events across", ev.payment_id.nunique(), "payments")', lang: 'python' },
          { code: 'approved    17216\ndeclined     2625\ntimeout       159\n37987 events across 20000 payments', lang: 'text' }
        ],
        check: 'You reproduce 86.08% approved, 92.02% of approved captured, and 0.499% chargebacks on captured.'
      },
      {
        t: 'The state machine, with its tests',
        blocks: [
          { p: 'Write the states and the legal transitions as data, then the one function that guards every change, exactly ' +
               'as in level 7. Write the tests first: every illegal move in the knowledge table should raise.' },
          { code: 'LEGAL = {\n    "created":     {"authorizing"},\n    "authorizing": {"authorized", "declined", "unknown"},\n    "authorized":  {"captured", "voided", "expired"},\n    "captured":    {"refunded", "charged_back"},\n    "unknown":     {"authorized", "declined"},      # reconciliation decides\n    "declined":    set(), "voided": set(), "expired": set(),\n    "refunded":    set(), "charged_back": set(),\n}', lang: 'python' },
          { warn: 'Note that `unknown` is a state, not an error. If your model cannot hold "we do not know", your code will ' +
                  'guess, and it will guess wrong 159 times a week.' }
        ],
        check: 'Capturing an expired authorisation, voiding after capture and refunding twice all raise, with tests to prove it.'
      },
      {
        t: 'Build a network that misbehaves',
        blocks: [
          { p: 'A fake network with three dials: how often it declines, how slow it is, and how often it never answers. This ' +
               'is the most valuable piece of test equipment in the whole course, because every interesting failure in ' +
               'payments comes from the third dial.' },
          { code: 'class FakeNetwork:\n    def __init__(self, decline_rate=0.13, timeout_rate=0.008, seed=9):\n        ...\n\n    def authorize(self, our_ref: str, amount_minor: int, token: str) -> dict:\n        """Returns {"result": "approved"|"declined", "network_ref": ..., "code": ...}\n        or raises NetworkTimeout. Remembers our_ref, so a retry with the same\n        reference returns the same answer rather than authorising twice."""', lang: 'python' },
          { tip: 'Make the simulator remember references from the start. The whole point of the exercise is that a retry with ' +
                 'the same reference is safe and a retry with a new one is a second hold on somebody\'s card.' }
        ],
        check: 'Calling authorize twice with the same reference returns one approval and creates one hold in the simulator.'
      },
      {
        t: 'Authorise, and write nothing to the ledger',
        blocks: [
          { p: 'The endpoint: validate, create the payment, call the network with your own reference, store the result and ' +
               'the network reference. On approval, record a hold with an expiry seven days out. Post **no** ledger entries.' },
          { code: 'POST /v1/payments\n{"token": "tok_9c1df0a4b2", "amount_minor": 7140, "currency": "USD"}\n\n201 {"id": "P010423", "state": "authorized", "amount_minor": 7140,\n     "captured_minor": 0, "expires_at": "2026-05-11T19:04:12Z"}', lang: 'text' },
          { p: 'Then prove it: after a hundred authorisations, the ledger has no entries and the sum of open holds equals what ' +
               'the simulator thinks it is holding.' }
        ],
        check: 'A hundred approvals produce a hundred holds and zero ledger entries.'
      },
      {
        t: 'Capture, including partial',
        blocks: [
          { p: 'Capture takes an optional amount. Refuse more than the authorised amount, refuse a second capture, and on ' +
               'success post the balanced transaction from level 4: customer out, merchant in, fee to revenue.' },
          { code: 'POST /v1/payments/P010423/capture\nIdempotency-Key: cap_7f10\n{"amount_minor": 5000}          # partial: $50 of a $71.40 hold\n\n200 {"state": "captured", "captured_minor": 5000, "released_minor": 2140}', lang: 'text' },
          { p: 'Report `released_minor`, because the customer\'s bank will release that part of the hold and the merchant ' +
               'should know they are not getting it. Across this week that figure totals $38,580.89.' }
        ],
        check: 'A partial capture posts entries for the captured amount only, and a second capture attempt returns 409.'
      },
      {
        t: 'Void, refund, chargeback',
        blocks: [
          { p: 'One endpoint each, and the rule from the knowledge section in code: if it is not captured, a cancellation is ' +
               'a void; if it is captured, it is a refund.' },
          { code: 'def cancel(payment):\n    if payment.state == "authorized":\n        return void(payment)         # free, and faster for the customer\n    if payment.state == "captured":\n        return refund(payment)       # a new balanced transaction\n    raise IllegalTransition(payment.state)', lang: 'python' },
          { p: 'Chargebacks arrive from outside rather than from the merchant, so model them as an inbound event: the money ' +
               'goes back, a dispute fee is posted, and the payment reaches a final state.' }
        ],
        check: 'Cancelling an uncaptured payment voids it, cancelling a captured one refunds it, and both are visible in the ledger.'
      },
      {
        t: 'Expire the abandoned holds',
        blocks: [
          { p: 'A scheduled job moves authorisations older than seven days to `expired`. In this week it would have moved 841 ' +
               'payments worth $74,230.57.' },
          { code: 'update payments\n   set state = \'expired\'\n where state = \'authorized\'\n   and expires_at < now()\nreturning id, amount_minor;', lang: 'sql' },
          { tip: 'Report what it did every day. A merchant whose expired holds are rising has a broken checkout, and you can ' +
                 'see it before they can.' }
        ],
        check: 'Running the job twice expires each payment once, and the second run reports zero.'
      },
      {
        t: 'Resolve the unknowns',
        blocks: [
          { p: 'Make the simulator time out, and handle it properly: record the attempt with your reference, set the state to ' +
               '`unknown`, and stop. Then write the resolver that asks the network what it thinks happened, which in this ' +
               'level is the shipped event file standing in for tomorrow\'s report.' },
          { code: 'for payment in payments_in_state("unknown"):\n    truth = network_report.get(payment.our_ref)\n    if truth is None:\n        mark(payment, "declined")            # the network never saw it\n    elif truth["result"] == "approved":\n        mark(payment, "authorized", network_ref=truth["network_ref"])\n    else:\n        mark(payment, "declined", code=truth["code"])', lang: 'python' },
          { p: 'Then the number that matters: how many unknowns were actually approved. Those are holds against real ' +
               'customers that your system would never have known about.' }
        ],
        check: 'Every unknown reaches a final state, and the count that turned out to be approved is reported.'
      }
    ]
  },

  glossary: [
    { t: 'Cardholder', d: 'The person paying with the card.' },
    { t: 'Merchant', d: 'The business taking the payment.' },
    { t: 'Acquirer', d: 'The merchant\'s payment company. Stripe, Adyen and Checkout are acquirers or work with one.' },
    { t: 'Issuer', d: 'The bank that gave the cardholder their card, and decides whether to approve.' },
    { t: 'Card network', d: 'Visa, Mastercard or Amex: routes messages between acquirer and issuer, and writes the rules.' },
    { t: 'Authorisation', d: 'The issuer setting money aside and promising it is there. No money has moved.' },
    { t: 'Hold', d: 'What the customer sees while an authorisation is outstanding: pending, not charged.' },
    { t: 'Capture', d: 'The merchant claiming the authorised money. This is when your ledger writes entries.' },
    { t: 'Settlement', d: 'Banks actually moving funds between themselves, usually a day or two after capture.' },
    { t: 'Partial capture', d: 'Capturing less than was authorised. The rest of the hold is released.' },
    { t: 'Void', d: 'Cancelling before capture. The hold is released and no money ever moved.' },
    { t: 'Refund', d: 'Returning money after capture, as a new balanced transaction in the opposite direction.' },
    { t: 'Chargeback', d: 'The cardholder\'s bank forcibly reversing a payment after a dispute.' },
    { t: 'Representment', d: 'The merchant contesting a chargeback with evidence.' },
    { t: 'Hard decline', d: 'A refusal that will never succeed with the same card. Never retry it.' },
    { t: 'Soft decline', d: 'A refusal that might succeed later, such as insufficient funds.' },
    { t: 'Decline code', d: 'The reason the issuer gave. The most useful field in the response and the most often ignored.' },
    { t: 'Reversal', d: 'A message telling the network to cancel an authorisation it may have approved.' },
    { t: 'Unknown state', d: 'What a timed out request leaves you in. Not failed, not approved: unknown, until reconciliation.' },
    { t: 'PAN', d: 'The full card number. Storing it puts your system under PCI DSS, so you store a token instead.' },
    { t: 'Token', d: 'An opaque id that stands in for a card, so your service never holds the number.' }
  ],

  quiz: [
    { q: "At the moment an authorisation is approved, how much money has moved?",
      options: [
        "The full amount, from the customer to the merchant",
        "Half, with the rest at settlement",
        "None. The issuer has set it aside and promised it is there",
        "The amount minus fees"
      ],
      answer: 2,
      why: "Which is exactly why your ledger writes no entries at authorisation. It writes them at capture." },

    { q: "In the shipped week, 841 approved authorisations worth $74,230.57 ended in `expired`. What does that mean happened?",
      options: [
        "The issuer reversed them",
        "The merchant never captured them, so the holds fell off after seven days",
        "They were charged back",
        "The customers cancelled"
      ],
      answer: 1,
      why: "The customer saw money held for a week for a sale that never completed. A rising expiry count means a broken checkout." },

    { q: "Your ledger writes entries at authorisation instead of capture. What breaks?",
      options: [
        "Only the customer's statement",
        "Nothing, as long as you reverse them later",
        "Authorisations start being declined",
        "The ledger claims money the merchant may never receive, so reconciliation never matches and expired holds become fake revenue"
      ],
      answer: 3,
      why: "4.88% of approvals in this week expired. That would be fake revenue somebody has to unwind by hand." },

    { q: "A capture for less than the authorised amount happens because:",
      options: [
        "The issuer reduced the approval",
        "It is always an error",
        "The customer paid partly in cash",
        "The order shipped in parts, an item was out of stock, or the authorisation included room for a tip"
      ],
      answer: 3,
      why: "8.04% of captures here were partial, leaving $38,580.89 authorised and never taken." },

    { q: "A customer cancels an order that has been authorised but not captured. You should:",
      options: [
        "Void it",
        "Let the hold expire",
        "Capture then refund",
        "Refund it"
      ],
      answer: 0,
      why: "Faster for the customer and cheaper for the merchant, since refunds usually do not return the processing fee." },

    { q: "Which decline code must never be retried?",
      options: [
        "do_not_honor",
        "lost_or_stolen",
        "insufficient_funds",
        "velocity_exceeded"
      ],
      answer: 1,
      why: "It is a hard decline. Retrying it wastes money, annoys the customer and counts against you with the networks." },

    { q: "In this week, 74.2% of declines were soft, worth $167,410.94. What does that number justify building?",
      options: [
        "A manual review queue for declines",
        "A nightly retry of every failed payment",
        "A retry policy limited to soft declines, with a capped attempt count and growing delays",
        "Nothing: declined is declined"
      ],
      answer: 2,
      why: "Recovering soft declines is a product every payments company sells. Retrying hard declines is how you get fined." },

    { q: "An authorisation request times out after 30 seconds. What is the correct state?",
      options: [
        "unknown, until something tells you which it was",
        "authorized, optimistically",
        "failed",
        "declined"
      ],
      answer: 0,
      why: "If your model cannot hold \"we do not know\", your code will guess, and it guessed wrong 159 times in this week alone." },

    { q: "What makes a retry after a timeout safe?",
      options: [
        "Waiting at least 60 seconds",
        "Using a different card",
        "Sending your own reference with the original request, so the network can recognise the retry, plus a reversal before retrying",
        "Checking the customer's balance first"
      ],
      answer: 2,
      why: "Level 4's idempotency key, extended past your own database to the party you are calling." },

    { q: "The difference between a refund and a chargeback is:",
      options: [
        "The speed",
        "Refunds are for cards, chargebacks for bank transfers",
        "A refund is the merchant agreeing; a chargeback is the cardholder's bank taking the money back whether the merchant agrees or not",
        "The amount"
      ],
      answer: 2,
      why: "And the merchant pays a dispute fee either way, win or lose." },

    { q: "This merchant's chargeback rate was 0.499% of captured payments. Why is the rate watched more closely than the amount?",
      options: [
        "Because card networks run monitoring programmes, with fines and eventual loss of card acceptance above roughly 1%",
        "Because the amount is always small",
        "Because issuers set prices from it",
        "Because rates are easier to compute"
      ],
      answer: 0,
      why: "$6,152.18 is survivable. Losing the ability to accept cards is not." },

    { q: "What does engineering owe the dispute process?",
      options: [
        "A support phone number",
        "Evidence gathered at the time and retrievable months later: authorisation response, delivery, device, terms accepted, timestamps",
        "A lower decline rate",
        "Faster refunds"
      ],
      answer: 1,
      why: "None of it can be collected after the dispute arrives, which is what makes it an engineering problem." },

    { q: "Which transition must the state machine refuse?",
      options: [
        "authorizing to declined",
        "captured to refunded",
        "authorized to voided",
        "captured to voided"
      ],
      answer: 3,
      why: "The money has already moved. What the caller wants is a refund, and letting a void through would lie to the ledger." },

    { q: "Why does every lifecycle event need its own idempotency key?",
      options: [
        "Because each one is a network call that can time out and be retried, and a capture that runs twice charges the customer twice",
        "Because the network rejects requests without one",
        "Because the database requires unique keys",
        "To make the events sortable"
      ],
      answer: 0,
      why: "Same bug as level 4, with a slower feedback loop and a customer in the middle." },

    { q: "Why does your service store a token rather than the card number?",
      options: [
        "To support multiple currencies",
        "Because the full number drags the whole system under PCI DSS, with the audits and breach exposure that follow",
        "Tokens are shorter",
        "Because the network rejects card numbers"
      ],
      answer: 1,
      why: "Keep a token, the last four digits and the expiry for display. Level 15 builds the vault that issues the token." }
  ],

  project: {
    title: 'card-lifecycle: the service that knows what state every payment is in',
    story: 'Build the service a payments company runs: authorise through a network that sometimes lies to you, capture in ' +
           'full or in part, void, refund, take chargebacks, expire abandoned holds, and resolve the requests that timed ' +
           'out. Then produce the report that explains where a week of money went.',
    scope: 'Uses levels 4 to 8: the ledger, the money library, the API and what you learned about retries. The card network ' +
           'is a simulator you write, because no real one will time out on demand.',
    dataset: '{{RAW}}/data/level-09-card-events.csv',
    requirements: [
      'An analysis that reproduces the headline figures from the shipped week: 86.08% approved, 92.02% of approvals captured, 0.499% chargebacks on captured, and the money table',
      'A state machine as data, with one guard function, and a test for every illegal transition in the level',
      '`unknown` as a first class state that a timed out request lands in',
      'A card network simulator with configurable decline rate, latency and timeout rate, that remembers references so a retry with the same reference does not authorise twice',
      'POST /v1/payments to authorise, writing a hold and no ledger entries',
      'POST /v1/payments/{id}/capture supporting a partial amount, posting a balanced ledger transaction, and reporting the released amount',
      'Void and refund behind one cancel rule: uncaptured is a void, captured is a refund',
      'An inbound chargeback handler that reverses the money and posts the dispute fee',
      'A scheduled job that expires authorisations older than seven days and reports what it did',
      'Decline handling that stores the code, classifies hard against soft, and refuses to retry a hard decline',
      'A retry policy for soft declines with a capped attempt count and growing delays',
      'A resolver that settles every unknown payment against the network report, and counts how many were actually approved',
      'Idempotency on every event, not only authorisation',
      'A merchant report: authorised, captured, refunded, charged back, net, expired, voided, and the authorised-but-never-captured gap',
      'The repository public on GitHub as `card-lifecycle`'
    ],
    starter: {
      lang: 'python',
      code: '"""FinQuest level 9: the life of a card payment.\n\nLayout:\n  cards/states.py      the state machine and its one guard\n  cards/network.py     the simulator: declines, latency, timeouts, references\n  cards/payments.py    authorise, capture, void, refund, chargeback\n  cards/expiry.py      the job that releases abandoned holds\n  cards/resolve.py     settle every unknown against the network report\n  cards/report.py      where the week\'s money went\n"""\n\nclass IllegalTransition(Exception):\n    pass\n\n\nclass NetworkTimeout(Exception):\n    """The network did not answer. The state is unknown, not failed."""\n\n\nLEGAL = {\n    "created":     {"authorizing"},\n    "authorizing": {"authorized", "declined", "unknown"},\n    "authorized":  {"captured", "voided", "expired"},\n    "captured":    {"refunded", "charged_back"},\n    "unknown":     {"authorized", "declined"},\n    "declined": set(), "voided": set(), "expired": set(),\n    "refunded": set(), "charged_back": set(),\n}\n\nHARD_DECLINES = {"incorrect_cvc", "expired_card", "lost_or_stolen", "pickup_card"}\n\n\ndef move(payment, to_state: str) -> None:\n    """The only place a payment\'s state changes."""\n    # TODO\n    raise NotImplementedError\n\n\ndef authorize(payment, network, our_ref: str):\n    """Call the network. On timeout, land in unknown with the reference recorded."""\n    # TODO\n    raise NotImplementedError\n\n\ndef capture(payment, amount_minor: int | None = None):\n    """Full or partial. Posts the ledger entries. Reports what was released."""\n    # TODO\n    raise NotImplementedError\n'
    },
    tests: [
      'The analysis reproduces 17,216 approvals, 15,842 captures, 841 expiries and 79 chargebacks',
      'Capturing an expired authorisation raises IllegalTransition',
      'Capturing twice raises, and the second attempt returns 409 through the API',
      'Voiding a captured payment raises, and cancelling it refunds instead',
      'Refunding more than was captured raises',
      'Authorising posts no ledger entries, and capturing posts a transaction that sums to zero',
      'A partial capture of 5000 on a 7140 authorisation reports 2140 released',
      'A retry to the simulator with the same reference produces one hold, not two',
      'A timed out authorisation leaves the payment in unknown with the reference stored',
      'The resolver moves every unknown to a final state and reports how many were approved',
      'A hard decline is never retried, and a soft decline is retried at most the configured number of times',
      'The expiry job is safe to run twice and reports zero the second time',
      'The money report adds up: captured minus refunds minus chargebacks equals the net figure'
    ],
    rubric: [
      { pts: 25, t: 'The lifecycle is real', d: 'Every state, every legal move, every illegal move refused with a test, and unknown modelled properly.' },
      { pts: 20, t: 'The ledger is right', d: 'Nothing at authorisation, balanced entries at capture, refunds as new transactions, partial captures handled.' },
      { pts: 20, t: 'Failure handled', d: 'A simulator that times out, references that make retries safe, and a resolver that settles the unknowns.' },
      { pts: 20, t: 'Declines understood', d: 'Codes stored, hard and soft separated, a retry policy with limits, and the recoverable value reported.' },
      { pts: 15, t: 'Explained to a merchant', d: 'The money report, the authorised-but-never-captured gap, and a README that reads like a product.' }
    ],
    stretch: [
      'Add multiple partial captures against one authorisation, behind a flag, and write down which acquirers allow it',
      'Add a representment flow: attach evidence to a chargeback and model the outcome',
      'Add 3-D Secure as a step before authorisation and measure how it changes approvals and liability',
      'Add incremental authorisation, where a hotel raises a hold as a stay lengthens',
      'Model a network outage: 40% timeouts for ten minutes, and show your service recovers with no double charges'
    ],
    solutionPath: 'solutions/level-09'
  },

  faq: [
    { q: 'Why build a fake network instead of using a real sandbox?',
      a: 'Because no sandbox will time out 0.8% of the time on demand, and the timeout is the interesting case. Build the simulator, then point the same code at a real test environment afterwards if you want.' },
    { q: 'Should the authorisation hold be in the ledger at all?',
      a: 'Not as entries, because no money has moved. Holds belong in their own table, and some systems mirror them in a memo-only ledger that is never summed into a balance. What breaks everything is posting them as real entries.' },
    { q: 'How long is an authorisation good for?',
      a: 'It depends on the card scheme and the merchant type, commonly around seven days and sometimes as little as one. This level uses seven. In a real system it is a field, not a constant.' },
    { q: 'Do I need to handle 3-D Secure?',
      a: 'Not in this level. Know what it is: an extra check with the cardholder\'s bank before authorisation, which typically raises approval rates and moves liability for fraud to the issuer. It is in the stretch list.' },
    { q: 'What is the difference between an acquirer and a processor?',
      a: 'The acquirer holds the relationship with the card networks and the merchant\'s funds; the processor moves the messages. Many companies do both, which is why the words get used interchangeably. In an interview, say which one you mean.' },
    { q: 'My resolver leaves some unknowns unresolved',
      a: 'Then the network report has no record of your reference, which is the case where the request never arrived. Mark it declined, and make sure your reference was sent on the first attempt rather than generated on the retry.' },
    { q: 'What do I say about this project in an interview?',
      a: 'Two things. That you built the unknown state on purpose, because a timeout is not a failure, and how you resolve it the next day. And the decline numbers: 74.2% of declines were soft, worth $167,410.94, which is the difference between a system that refuses payments and one that recovers them.' }
  ]
});
