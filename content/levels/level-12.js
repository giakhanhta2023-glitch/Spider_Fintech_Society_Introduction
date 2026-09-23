/* =========================================================================
   LEVEL 12: sagas, compensation, and the payout that half happened
   ========================================================================= */
FQ.registerLevel({
  id: 12,
  codename: 'saga',
  title: 'The payout that half happened',
  tagline: 'Debit the ledger, then tell the bank. There is no transaction that covers both, so 13% of your payouts end with the money gone and nobody paid. This level fixes that, and measures the fix.',
  difficulty: 9,
  minutes: 450,
  tags: ['sagas', 'compensation', 'distributed transactions', 'recovery'],
  summary: 'Level 8 made one database behave under concurrency. This level is the harder version: a payout touches your ' +
           'ledger and somebody else\'s bank, and no transaction spans both. You build the orchestrator that survives it: ' +
           'a saga with compensating actions, an unknown state that means unknown, and a sweeper that goes and finds out ' +
           'what really happened. Every number here came from running it against a real database.',

  objectives: [
    'Explain why you cannot put a transaction around two systems',
    'Model a multi step operation as a saga with explicit compensation',
    'Write compensating actions that are safe to run twice',
    'Distinguish failure from uncertainty, and design for the second',
    'Build a sweeper that resolves everything left mid flight',
    'Choose between orchestration and choreography, and say why',
    'Measure how many operations end inconsistent, before and after'
  ],

  knowledge: [
    { h: 'Three steps, two systems, no transaction' },
    { p: 'A payout is simple to describe. Take the money out of the merchant\'s balance in your ledger, tell the bank to ' +
         'send it, record what the bank called it. Three steps:' },
    { code: '1. debit the merchant balance          (your database)\n2. submit the payout to the bank       (their API, over the network)\n3. record the bank reference           (your database)', lang: 'text' },
    { p: 'Step 1 and step 3 can share a database transaction. Step 2 cannot join it, because it happens on a computer you do ' +
         'not own. That is the whole problem, and no amount of careful coding removes it: **there is no transaction that ' +
         'spans your database and somebody else\'s bank.**' },
    { p: 'You might have heard of **two-phase commit**, a protocol where a coordinator asks every participant to prepare, ' +
         'then tells them all to commit. It exists, and you will not be using it here. Banks and payment networks do not ' +
         'offer it, it holds locks across the network while everybody waits, and one slow participant blocks the rest. In ' +
         'practice, across company boundaries, it is not available.' },

    { h: 'What actually goes wrong, measured' },
    { p: 'Here is the naive version: do the three steps in order, and if something throws, mark the payout failed. Run 200 ' +
         'payouts against a real database and a bank that misbehaves at realistic rates: 6% rejected, 5% timing out, and a ' +
         '4% chance our own process dies after submitting.' },
    { code: '--- naive ---\n   paid                                174\n   rejected, money still debited         9\n   timeout, state unknown                7\n   crashed after submitting             10\n\n   money debited with no payout         26   (13.0% of 200)', lang: 'text', label: 'measured' },
    { p: 'Twenty six payouts, **13% of everything**, ended with money taken out of a merchant\'s balance and no payment to ' +
         'show for it. The merchant is short and your ledger says they were paid. Three different causes produced it, and ' +
         'they are not the same problem:' },
    { table: {
      head: ['Cause', 'Count', 'What you know'],
      rows: [
        ['The bank rejected it', '9', 'Exactly what happened. Nothing was sent'],
        ['The bank never answered', '7', '**Nothing.** It may or may not have gone'],
        ['Our process died after submitting', '10', '**Nothing**, and we have no record of trying']
      ]
    }},
    { p: 'The first is a **failure**: you know the outcome and can act on it. The other two are **uncertainty**, which is a ' +
         'different thing and needs a different mechanism. Most systems get the first right and forget the second exists.' },

    { h: 'The saga: every step has an undo' },
    { p: 'A **saga** is a sequence of local transactions where each step has a matching **compensating action** that undoes ' +
         'it. Instead of rolling back, which you cannot do across systems, you roll forward by doing the opposite:' },
    { table: {
      head: ['Step', 'Compensation'],
      rows: [
        ['Debit the merchant balance', 'Credit it back, with a reason'],
        ['Submit the payout to the bank', 'Cancel it if it has not left, or accept it and record it'],
        ['Record the bank reference', 'Nothing: it is only a record']
      ]
    }},
    { p: 'When a step fails, you run the compensations for every step that already succeeded, in reverse order. That is not ' +
         'a rollback: the debit really happened, and so did the credit that reversed it, and both are in the ledger forever, ' +
         'exactly as level 4 required. Accountants call this a **semantic rollback**: the effect is undone, the history is ' +
         'not.' },
    { p: 'The same 200 payouts, same bank, same failure rates, with compensation added:' },
    { code: '--- saga ---\n   paid                                174\n   rejected, money returned              9      <- compensated\n   timeout, state unknown                7\n   crashed after submitting             10\n\n   money debited with no payout         17   (8.5% of 200)', lang: 'text', label: 'measured' },
    { p: 'The nine rejections are fixed: the money went back automatically, and no human will ever see them. But **17 are ' +
         'still wrong**, and they are precisely the ones where you do not know what happened. Compensation cannot help, ' +
         'because compensating a payout that actually went out would send the money twice.' },
    { check: {
      q: 'Your compensation for "submit to the bank" is "cancel the payout". The bank timed out. Why is running that ' +
         'compensation immediately the wrong move?',
      a: 'Because you do not know whether there is anything to cancel. If the payout never reached the bank, cancelling is a ' +
         'harmless no-op. If it did reach them and the answer was lost, you have now cancelled a real payment, which may ' +
         'succeed, fail, or arrive after the money has already gone: three outcomes, and you cannot tell which. Uncertainty ' +
         'is not failure. The correct move is to record the attempt with your reference, leave the payout in an explicit ' +
         'unknown state, and let something that can establish the truth decide. That something is the sweeper, and it is the ' +
         'next section.'
    }},

    { h: 'The sweeper: the job that goes and finds out' },
    { p: 'Every saga needs a second mechanism for the cases where nobody knows the answer. A **sweeper** runs on a schedule, ' +
         'picks up everything stuck mid flight, asks the other side what really happened, and finishes the job:' },
    { code: 'for payout in payouts_in_state("debited", "unknown") older_than(2 minutes):\n    truth = bank.lookup(our_ref=payout.our_ref)     # what does the bank say?\n    if truth and truth.status == "sent":\n        mark_paid(payout, truth.reference)          # it went: finish the saga\n    else:\n        compensate(payout)                          # it never went: give the money back', lang: 'python' },
    { p: 'That single job resolved every remaining case:' },
    { table: {
      head: ['', 'Naive', 'Saga'],
      rows: [
        ['Inconsistent before the sweeper', '26 (13.0%)', '17 (8.5%)'],
        ['Found to have actually been paid', '17', '17'],
        ['**Still inconsistent afterwards**', '**9**', '**0**']
      ]
    }},
    { p: 'Read the bottom row, because it is the argument for doing both. The sweeper alone is not enough: without ' +
         'compensation, the nine rejected payouts still have the money missing, because a sweeper that only asks "did it go ' +
         'out" finds that it did not, and has nothing to do about it. Compensation alone is not enough either, because it ' +
         'cannot touch the 17 uncertain ones. **You need the two together, and then nothing is left.**' },
    { money: 'That table is the interview answer to "how do you handle distributed transactions". Not the word saga, and not ' +
             'a diagram: two mechanisms, what each one covers, and the measured number of broken records left when you have ' +
             'both. Very few candidates get past the word.' },

    { h: 'Why the bank answering twice did not pay twice' },
    { p: 'Look again at the middle row: 17 payouts turned out to have been paid after all. That worked because of one line ' +
         'in the bank simulator, and the same line is in every real bank API:' },
    { code: 'def submit(self, our_ref, amount):\n    if our_ref in self.submitted:        # seen this reference before\n        return self.submitted[our_ref]   # same answer, no second payout\n    ...', lang: 'python' },
    { p: 'Your reference, sent with the request, is what makes a retry safe and a lookup possible. It is level 4\'s ' +
         'idempotency key, level 9\'s network reference and this level\'s recovery mechanism, all the same idea: **the ' +
         'sender names the operation, so both sides can talk about it afterwards.**' },
    { warn: 'Generate that reference once, when the payout is created, and store it before the first attempt. A reference ' +
            'generated at send time changes on every retry, which turns one payout into several and makes recovery ' +
            'impossible. This is the single most common way payout systems pay twice.' },

    { h: 'Compensations must survive being run twice' },
    { p: 'A compensation is code that runs when things are already going wrong, which is exactly when it will be retried, ' +
         'interrupted and run again. So every compensating action has to be idempotent, in the level 11 sense:' },
    { code: '-- not safe: run twice and you have credited the merchant twice\nupdate balances set amount = amount + 5000 where merchant_id = 42;\n\n-- safe: the unique constraint means the second attempt does nothing\ninsert into compensations (payout_id, kind) values (%s, \'refund_debit\')\non conflict (payout_id, kind) do nothing\nreturning id;\n-- then post the ledger entries only if a row was actually inserted', lang: 'sql' },
    { p: 'And a harder rule: **a compensation is not allowed to fail permanently.** If crediting the merchant back is ' +
         'impossible, the money is simply missing, and there is nobody further back to unwind to. So compensations are ' +
         'written to be as simple as possible, to touch only systems you control, and to be retried forever rather than ' +
         'given up on. If a compensation genuinely cannot complete, that is a page, not a log line.' },
    { check: {
      q: 'A saga has four steps. Step 3 fails, so you compensate steps 2 and 1. While compensating step 2, the process ' +
         'crashes. What must be true for the system to recover, and what would make recovery impossible?',
      a: 'Two things must be true. The saga\'s progress must be recorded durably as it goes, so that after the restart ' +
         'something can see it was mid compensation at step 2 rather than guessing from scratch: the state belongs in the ' +
         'database after every step, not in a variable in memory. And each compensation must be idempotent, so re-running ' +
         'step 2\'s compensation, which may or may not have completed, does nothing the second time. Recovery becomes ' +
         'impossible if the saga\'s state lives only in the running process, because after the crash nobody knows which ' +
         'steps happened, and inspecting four external systems to reconstruct it is exactly the situation the recorded ' +
         'state exists to avoid.'
    }},

    { h: 'Orchestration or choreography' },
    { p: 'There are two ways to make a saga run, and interviewers ask which you would choose:' },
    { table: {
      head: ['', 'Orchestration', 'Choreography'],
      rows: [
        ['How it works', 'One service runs the steps and knows the plan', 'Each service reacts to events from the last one'],
        ['Where the logic lives', 'In one place you can read', 'Spread across every participant'],
        ['Seeing what is happening', 'Query the orchestrator: it knows', 'Reconstruct it from several event streams'],
        ['Adding a step', 'Change the orchestrator', 'Change whichever services are affected'],
        ['Risk', 'The orchestrator becomes a bottleneck and knows too much', 'Nobody knows the whole flow, and cycles creep in']
      ]
    }},
    { p: 'For money, orchestration is usually the right answer, and that is what this level builds. When a payout is stuck, ' +
         'somebody has to be able to ask one question, "what state is payout P-1042 in", and get an answer in one place. ' +
         'With choreography that question turns into an investigation across four services, at the exact moment when ' +
         'somebody is waiting for their money.' },

    { h: 'The state machine, and why it lives in the database' },
    { p: 'The orchestrator is a state machine, exactly as in level 9, with one extra requirement: **every state change is ' +
         'committed before the next step starts.** The state in the database is what lets any process, at any time, pick up ' +
         'where a dead one left off.' },
    { code: 'requested ──▶ debited ──▶ submitted ──▶ paid          (the happy path)\n     │            │             │\n     │            │             └──▶ unknown ──▶ (sweeper decides)\n     │            │\n     │            └──▶ compensating ──▶ compensated\n     │\n     └──▶ rejected', lang: 'text' },
    { p: 'Two design rules make it work in practice:' },
    { ul: [
      '**Write the state before doing the thing, not after.** Mark a payout `submitting` and commit, then call the bank. If you crash, the state says you were about to call them, which is the state that tells the sweeper to go and check. Marking it afterwards loses exactly the cases you needed to record.',
      '**Store a timestamp with every state.** A payout in `submitting` for 30 seconds is normal; one that has been there for an hour is stuck, and the only way to tell them apart is when it got there.'
    ]},

    { h: 'Stuck is a state, and somebody must be told' },
    { p: 'The sweeper handles the known-unknown cases. The last category is the one nobody plans for: a payout that is in a ' +
         'normal state, but has been there far too long. A queue that stopped, a bug that never advances a particular kind ' +
         'of payout, a bank that accepts submissions and never settles them.' },
    { code: 'select state, count(*), min(updated_at) as oldest\n  from payouts\n where state not in (\'paid\', \'compensated\', \'rejected\')\n   and updated_at < now() - interval \'15 minutes\'\n group by state;', lang: 'sql', label: 'the query that should return nothing' },
    { p: 'Run it every few minutes, alert when it returns rows, and put the oldest age on a dashboard. This is the cheapest ' +
         'safety net in the whole system, and it catches the failures nobody predicted, which by definition are the ones ' +
         'your careful design did not cover.' },
    { check: {
      q: 'Your sweeper has run happily for six months and never found anything to fix. Two colleagues disagree: one says ' +
         'delete it as dead code, the other says it proves the design is correct. Who is right?',
      a: 'Neither, and the disagreement is worth having properly. A sweeper that finds nothing is doing its job, the same way ' +
         'the level 6 reconciliation query that returns no rows is: it is continuous evidence that the invariant holds, and ' +
         'the day it finds something will be a day when something genuinely broke. But "it never found anything" is also ' +
         'suspicious on its own, because the experiment in this level produced 17 uncertain payouts out of 200. If your ' +
         'production sweeper has truly never fired in six months, the likely explanations are that it is not actually ' +
         'running, that it queries the wrong states, or that something else is silently resolving those payouts first. The ' +
         'correct response is neither to delete it nor to trust it, but to test it: break a payout deliberately in staging ' +
         'and confirm the sweeper picks it up.'
    }},

    { h: 'Never pay twice' },
    { p: 'One asymmetry runs through all of this. In a payout system, paying somebody twice is far worse than paying them ' +
         'late. Late is a support ticket. Twice is money gone, often to a party with no reason to return it, and it is the ' +
         'failure that ends careers in payments.' },
    { p: 'So every decision in this level leans the same way:' },
    { table: {
      head: ['When you are unsure', 'Do this', 'Not this'],
      rows: [
        ['The bank timed out', 'Record unknown, ask later', 'Retry blindly'],
        ['A retry might duplicate', 'Send the same reference and let the bank deduplicate', 'Generate a new reference'],
        ['A compensation might have run', 'Make it idempotent and run it again', 'Guess that it did'],
        ['A payout is stuck', 'Alert a human', 'Time it out and retry automatically']
      ]
    }},
    { p: 'And the corresponding rule for the money itself: the debit happens **before** the submission, never after. If your ' +
         'process dies, the merchant\'s balance is temporarily too low and the sweeper puts it back. Do it the other way ' +
         'round and a crash leaves a payout sent with nothing deducted, which is the same money leaving twice.' }
  ],

  tutorial: {
    intro: 'Build the orchestrator on top of the level 6 database and the level 9 habits. The bank is a simulator you write, ' +
           'because a real one will not reject 6% of your requests on demand. Work in a repository called `payout-saga`.',
    steps: [
      {
        t: 'A bank that misbehaves on purpose',
        blocks: [
          { p: 'Three dials: rejection rate, timeout rate, and latency. One rule: it remembers references, so a retry with ' +
               'the same reference returns the same answer rather than paying twice.' },
          { code: 'class Bank:\n    def submit(self, our_ref: str, amount_minor: int) -> str:\n        if our_ref in self.submitted:\n            return self.submitted[our_ref]      # idempotent by our reference\n        roll = self.rng.random()\n        if roll < self.reject_rate:\n            raise BankRejected("account closed")\n        if roll < self.reject_rate + self.timeout_rate:\n            self.submitted[our_ref] = self._new_ref()   # it DID land\n            raise BankTimeout("no answer")\n        ...\n\n    def lookup(self, our_ref: str) -> str | None:\n        return self.submitted.get(our_ref)      # what the sweeper asks', lang: 'python' },
          { warn: 'Notice the timeout branch records the payout before raising. That is the whole point: a timeout must ' +
                  'sometimes mean "it worked and you did not hear", or your recovery code is being tested against a world ' +
                  'that is kinder than the real one.' }
        ],
        check: 'Submitting the same reference twice returns one payout, and lookup finds the ones that timed out.'
      },
      {
        t: 'Measure the naive version',
        blocks: [
          { p: 'Write the three steps with no compensation and no sweeper, run 200 payouts, and count how many end with ' +
               'money debited and nothing paid. Do this before building anything else: the number is the reason for the ' +
               'rest of the level.' },
          { code: 'select count(*) from payouts where debited and state <> \'paid\';', lang: 'sql' },
          { code: 'money debited with no payout   26   (13.0% of 200)', lang: 'text' }
        ],
        check: 'You have a reproducible percentage of payouts that are inconsistent, and can name the three causes.'
      },
      {
        t: 'Persist the state machine',
        blocks: [
          { p: 'Add the states and the rule that every transition is committed before the next step begins. The timestamp on ' +
               'each change is what makes stuck detection possible later.' },
          { code: 'create table payouts (\n  id           bigserial primary key,\n  our_ref      text unique not null,          -- generated once, at creation\n  merchant_id  bigint not null,\n  amount_minor bigint not null,\n  state        text not null default \'requested\',\n  bank_ref     text,\n  attempts     int not null default 0,\n  updated_at   timestamptz not null default now()\n);\ncreate index payouts_unfinished on payouts (state, updated_at)\n  where state not in (\'paid\', \'compensated\', \'rejected\');', lang: 'sql' },
          { tip: 'That partial index is the same trick as the level 11 outbox: the sweeper queries only unfinished payouts, ' +
                 'and there should never be many, however large the table grows.' }
        ],
        check: 'Killing the process between any two steps leaves a state in the database that says what was happening.'
      },
      {
        t: 'Add compensation',
        blocks: [
          { p: 'For the case you understand: the bank rejected it. Credit the merchant back, as a new balanced transaction, ' +
               'and move the payout to `compensated`. Make it idempotent with a unique key on the compensation itself.' },
          { code: 'insert into compensations (payout_id, kind) values (%s, \'refund_debit\')\non conflict (payout_id, kind) do nothing\nreturning id;\n-- ledger entries are posted only when a row came back', lang: 'sql' },
          { p: 'Rerun the 200. The rejections should disappear from the inconsistent count, and the uncertain ones should ' +
               'remain, which is the point.' },
          { code: 'money debited with no payout   17   (8.5% of 200)      -- was 26', lang: 'text' }
        ],
        check: 'Every rejected payout returns the money exactly once, even if you run the compensation three times.'
      },
      {
        t: 'Make unknown a real state',
        blocks: [
          { p: 'Catch the timeout separately from the rejection. Do not compensate, do not retry, do not mark it failed: ' +
               'write `unknown` and stop. This is four lines of code and the difference between a system that can recover ' +
               'and one that cannot.' },
          { code: 'except BankTimeout:\n    set_state(payout, "unknown")     # we genuinely do not know\n    return', lang: 'python' },
          { warn: 'Resist every instinct to be helpful here. Retrying looks right and risks paying twice; compensating looks ' +
                  'safe and risks cancelling a real payment. Recording the truth, which is that you do not know, is the ' +
                  'only correct action available.' }
        ],
        check: 'Timeouts land in unknown with the reference stored, and nothing else is attempted.'
      },
      {
        t: 'Write the sweeper',
        blocks: [
          { p: 'On a schedule: every payout not in a final state, older than a threshold, gets looked up at the bank and ' +
               'finished one way or the other.' },
          { code: 'select id, our_ref, state from payouts\n where state not in (\'paid\', \'compensated\', \'rejected\')\n   and updated_at < now() - interval \'2 minutes\'\n order by updated_at\n   for update skip locked\n limit 100;', lang: 'sql' },
          { code: 'sweeper: was actually paid                17\nsweeper: never reached the bank, returned  0\nafter the sweeper, inconsistent            0', lang: 'text' },
          { p: 'Then run the naive version plus the sweeper, and see that it still leaves nine broken. Put both results in ' +
               'your README: it is the clearest way to show that the two mechanisms cover different things.' }
        ],
        check: 'After the sweeper, no payout is left with money debited and no payment, and the naive version still has nine.'
      },
      {
        t: 'Detect stuck, and alert',
        blocks: [
          { p: 'The last safety net catches what neither mechanism predicted: something in a normal state for far too long.' },
          { code: 'select state, count(*), min(updated_at) as oldest\n  from payouts\n where state not in (\'paid\', \'compensated\', \'rejected\')\n   and updated_at < now() - interval \'15 minutes\'\n group by state;', lang: 'sql' },
          { p: 'Expose the oldest age as a number your monitoring can read, and write the alert: "a payout has been ' +
               'unfinished for more than fifteen minutes". Level 16 builds the rest of the alerting around this.' }
        ],
        check: 'Pausing the sweeper for twenty minutes makes the query return rows, and restarting it clears them.'
      },
      {
        t: 'Prove it under chaos',
        blocks: [
          { p: 'The acceptance test for the whole level: run a thousand payouts with the failure rates turned up, kill the ' +
               'orchestrator at random points, restart it, let the sweeper run, and then assert two things.' },
          { code: 'assert every_payout_is_in_a_final_state()\nassert ledger_balances_match_bank_payments()\nassert no_reference_was_paid_twice()', lang: 'python' },
          { p: 'The third assertion is the one that matters most. Late is a support ticket; twice is money gone.' }
        ],
        check: 'A thousand payouts with injected crashes end with every payout final, balances correct, and no duplicate payments.'
      }
    ]
  },

  glossary: [
    { t: 'Saga', d: 'A sequence of local transactions, each with a compensating action, used where no shared transaction exists.' },
    { t: 'Compensating action', d: 'The operation that undoes the effect of a completed step, by doing the opposite.' },
    { t: 'Semantic rollback', d: 'Undoing the effect while keeping both the original and the reversal in the history.' },
    { t: 'Two-phase commit', d: 'A protocol for committing across systems. Rarely available across company boundaries.' },
    { t: 'Orchestration', d: 'One service runs the steps and holds the plan.' },
    { t: 'Choreography', d: 'Each service reacts to events, with no central plan.' },
    { t: 'Unknown state', d: 'The honest state after a timeout: not failed, not succeeded, to be resolved by a sweeper.' },
    { t: 'Sweeper', d: 'A scheduled job that finds unfinished work, asks the other side what happened, and finishes it.' },
    { t: 'Stuck detection', d: 'Alerting on anything in a non-final state for longer than it should be.' },
    { t: 'Our reference', d: 'An identifier you generate once and send with every attempt, so both sides can discuss it later.' },
    { t: 'Forward recovery', d: 'Finishing a half done operation rather than undoing it, when the work really happened.' },
    { t: 'Backward recovery', d: 'Compensating completed steps because the operation cannot be finished.' },
    { t: 'Final state', d: 'A state nothing follows: paid, compensated, rejected. Everything else is work in progress.' },
    { t: 'skip locked', d: 'How several sweeper instances take different rows without treading on each other.' }
  ],

  quiz: [
    { q: "Why can a payout not be wrapped in one transaction?",
      options: [
        "Because the bank is slower than the database",
        "One step happens in a system you do not own, and no transaction spans both",
        "The ledger uses a different isolation level",
        "Transactions cannot contain network calls"
      ],
      answer: 1,
      why: "Two-phase commit exists in theory and is essentially never offered across company boundaries." },

    { q: "In the measured naive run, 13.0% of payouts ended with money debited and nobody paid. The three causes were:",
      options: [
        "Duplicate references",
        "Network errors only",
        "Rejections, timeouts, and the process dying after submitting",
        "Database deadlocks"
      ],
      answer: 2,
      why: "And only the first of the three is a failure you know about. The other two are uncertainty." },

    { q: "What is a compensating action?",
      options: [
        "An operation that undoes a completed step by doing the opposite, leaving both in the history",
        "A retry with backoff",
        "A refund to the customer",
        "A database rollback"
      ],
      answer: 0,
      why: "You cannot roll back across systems, so you roll forward by doing the inverse. Accountants call it a semantic rollback." },

    { q: "Adding compensation took the inconsistent payouts from 26 to 17. Why did it not fix the rest?",
      options: [
        "Because the bank rejected the compensations",
        "Because the remaining 17 are cases where nobody knows whether the payout went out, and compensating might cancel a real payment",
        "The compensations failed",
        "Because 17 had already been paid"
      ],
      answer: 1,
      why: "Compensation handles known failure. Uncertainty needs a mechanism that can establish the truth." },

    { q: "What does the sweeper do?",
      options: [
        "Finds everything left mid flight, asks the other side what really happened, and finishes it",
        "Reconciles the bank statement",
        "Deletes stuck records",
        "Retries failed payouts on a schedule"
      ],
      answer: 0,
      why: "In the measurement it resolved all 17 uncertain payouts, 17 of which turned out to have been paid." },

    { q: "With the sweeper but no compensation, nine payouts remained broken. Why?",
      options: [
        "The sweeper ran too rarely",
        "The bank lost them",
        "They were duplicates",
        "Because a sweeper that only asks \"did it go out\" finds that the rejected ones did not, and has nothing to do about it"
      ],
      answer: 3,
      why: "Compensation and sweeping cover different failures. With both, zero were left." },

    { q: "Why did looking up 17 timed out payouts not cause double payments?",
      options: [
        "Because timeouts always mean failure",
        "Because the amounts were small",
        "Because the bank recognises the reference we generated and returns the original result instead of paying again",
        "Because the sweeper waited long enough"
      ],
      answer: 2,
      why: "The sender names the operation. That is what makes both retry and recovery safe." },

    { q: "When should the reference be generated?",
      options: [
        "At the end, when recording the result",
        "By the bank, in its response",
        "On each attempt, so retries are distinguishable",
        "Once, when the payout is created, and stored before the first attempt"
      ],
      answer: 3,
      why: "A reference generated per attempt turns one payout into several and makes recovery impossible." },

    { q: "Compensating actions must be idempotent because:",
      options: [
        "They run inside a transaction",
        "They run when things are already failing, so they will be retried, interrupted and run again",
        "They are slower than normal operations",
        "The database requires it"
      ],
      answer: 1,
      why: "And a compensation that credits twice is the same bug as a payout that pays twice." },

    { q: "What is special about a compensation that fails permanently?",
      options: [
        "There is nobody further back to unwind to, so the money is simply missing: it is a page, not a log line",
        "It is retried by the database",
        "It rolls back the whole saga",
        "It can be ignored"
      ],
      answer: 0,
      why: "Which is why compensations touch only systems you control and are kept as simple as possible." },

    { q: "Orchestration is usually preferred over choreography for money because:",
      options: [
        "It uses fewer services",
        "It is faster",
        "Choreography cannot be made idempotent",
        "When a payout is stuck, one service can answer \"what state is it in\" instead of an investigation across four"
      ],
      answer: 3,
      why: "That question gets asked at the exact moment somebody is waiting for their money." },

    { q: "Why write the state before calling the bank rather than after?",
      options: [
        "To reduce lock contention",
        "It is faster",
        "Because a crash after the call leaves no record that you tried, which is exactly the case you needed to recover",
        "Because the database requires ordering"
      ],
      answer: 2,
      why: "Mark it submitting and commit, then call. The state tells the sweeper where to look." },

    { q: "Why does every state change carry a timestamp?",
      options: [
        "To sort the queue",
        "Because a payout submitting for 30 seconds is normal and one submitting for an hour is stuck, and only the time tells them apart",
        "Because the sweeper sorts by id",
        "For the audit log only"
      ],
      answer: 1,
      why: "Stuck detection is the safety net that catches the failures nobody predicted." },

    { q: "In a payout system, which is worse?",
      options: [
        "They are equally bad",
        "It depends on the amount",
        "Paying twice",
        "Paying late"
      ],
      answer: 2,
      why: "Late is a support ticket. Twice is money gone, often to somebody with no reason to return it." },

    { q: "Should the ledger debit happen before or after submitting to the bank?",
      options: [
        "Before, so a crash leaves the balance temporarily low and the sweeper restores it",
        "It makes no difference",
        "Simultaneously, in one transaction",
        "After, so nothing is debited unless the payment succeeds"
      ],
      answer: 0,
      why: "Debiting afterwards means a crash leaves a payment sent with nothing deducted, which is money leaving twice." }
  ],

  project: {
    title: 'payout-saga: the orchestrator that finishes what it started',
    story: 'Build the service that pays merchants. It touches your ledger and a bank that rejects, times out and loses ' +
           'answers, and your own process dies in the middle. Measure how bad the naive version is, then add compensation, ' +
           'an unknown state and a sweeper, and prove that nothing is left broken.',
    scope: 'Uses levels 4, 6, 8, 9 and 11. The bank is a simulator you write. The orchestrator can be a plain Python ' +
           'process with a scheduler: no workflow framework, because the point is understanding what one does for you.',
    dataset: '{{RAW}}/data/level-09-card-events.csv',
    requirements: [
      'A bank simulator with configurable rejection, timeout and latency, idempotent on your reference, and a lookup for the sweeper',
      'A payouts table holding the reference, the state, the attempt count and the time of the last change, with a partial index on unfinished payouts',
      'The reference generated once at creation and stored before the first attempt',
      'A naive orchestrator, kept in the repository, with a measured inconsistency rate over at least 200 payouts',
      'A saga orchestrator where every step has a compensating action, run in reverse order on failure',
      'Compensations that are idempotent, enforced by a unique constraint rather than by care',
      'An explicit `unknown` state entered on timeout, with no retry and no compensation',
      'Every state change committed before the next step starts',
      'A sweeper that resolves unfinished payouts by asking the bank, using skip locked so several can run',
      'A stuck detection query and the alert threshold you chose, with a reason',
      'A comparison table in the README: inconsistent payouts before and after the sweeper, for both the naive and the saga version',
      'A chaos test: a thousand payouts, injected crashes, then assertions that every payout is final, the balances match, and no reference was paid twice',
      'The repository public on GitHub as `payout-saga`'
    ],
    starter: {
      lang: 'python',
      code: '"""FinQuest level 12: the payout saga.\n\nLayout:\n  saga/bank.py          the simulator: rejects, times out, remembers references\n  saga/orchestrator.py  the steps, in order, with state committed between them\n  saga/compensate.py    the undo for each step, idempotent\n  saga/sweeper.py       resolve everything left mid flight\n  saga/stuck.py         the query that should return nothing\n  bench/naive.py        the version without any of this, for the numbers\n"""\n\nSTATES = {\n    "requested":    {"debited", "rejected"},\n    "debited":      {"submitting", "compensating"},\n    "submitting":   {"paid", "unknown", "compensating"},\n    "unknown":      {"paid", "compensating"},      # only the sweeper moves these\n    "compensating": {"compensated"},\n    "paid": set(), "compensated": set(), "rejected": set(),\n}\n\n\nclass BankRejected(Exception):\n    """A definite no. You know what happened."""\n\n\nclass BankTimeout(Exception):\n    """No answer. You know nothing, and must not guess."""\n\n\ndef run_payout(conn, bank, payout_id: int) -> None:\n    """Debit, submit, record. State is committed before each external call."""\n    # TODO\n    raise NotImplementedError\n\n\ndef compensate(conn, payout_id: int, reason: str) -> None:\n    """Undo the debit. Must be safe to run twice, and must not fail quietly."""\n    # TODO\n    raise NotImplementedError\n\n\ndef sweep(conn, bank, older_than_seconds: int = 120) -> dict:\n    """Finish everything left mid flight. Returns a count by outcome."""\n    # TODO\n    raise NotImplementedError\n'
    },
    tests: [
      'The naive orchestrator leaves a measurable percentage of payouts debited and unpaid',
      'A rejected payout returns the money exactly once, even when the compensation runs three times',
      'A timed out payout lands in unknown, with no retry and no compensation attempted',
      'The sweeper marks as paid every payout the bank actually sent',
      'The sweeper compensates every payout the bank never received',
      'After compensation plus sweeping, no payout is left debited and unpaid',
      'With the sweeper but no compensation, the rejected payouts remain broken',
      'Two sweepers running at once never process the same payout',
      'Killing the process between any two steps leaves a state the sweeper can act on',
      'The stuck query returns rows when the sweeper is paused and none when it runs',
      'A thousand payouts with injected crashes end with every payout in a final state',
      'No bank reference is ever used for two payouts, and no payout is paid twice'
    ],
    rubric: [
      { pts: 25, t: 'The problem measured', d: 'A naive version kept in the repository with its inconsistency rate, and the three causes named.' },
      { pts: 25, t: 'Saga done properly', d: 'Compensation per step, idempotent by constraint, run in reverse, with the measured improvement.' },
      { pts: 20, t: 'Uncertainty handled', d: 'An explicit unknown state, no guessing, and a sweeper that resolves every one of them.' },
      { pts: 15, t: 'Operable', d: 'State committed before each call, stuck detection with a threshold and a reason, skip locked sweepers.' },
      { pts: 15, t: 'Proven', d: 'The chaos test with its three assertions, and the before and after table in the README.' }
    ],
    stretch: [
      'Add a second step to the saga, such as a fraud check that can also fail, and see how much the compensation logic grows',
      'Run the same saga with choreography instead, using the level 11 events, and write down which was easier to debug',
      'Add exponential backoff with jitter to the sweeper, and measure what happens when the bank is down for ten minutes',
      'Add a manual review queue for payouts the sweeper cannot resolve after N attempts',
      'Replace your orchestrator with a workflow engine such as Temporal, and list what it gave you and what it cost'
    ],
    solutionPath: 'solutions/level-12'
  },

  faq: [
    { q: 'Is a saga not just a fancy name for try and except?',
      a: 'The difference is that the undo is designed, named and durable. An except block runs in the process that failed; a saga\'s compensation has to work after that process is gone, which is why the state lives in the database and the compensation is idempotent.' },
    { q: 'Why not use a workflow engine like Temporal?',
      a: 'In a job you probably would, and knowing why is the point of building it once. When you have written the state table, the compensation and the sweeper yourself, you can say exactly which parts a workflow engine replaces, which is a much stronger interview answer than naming the tool.' },
    { q: 'How long should the sweeper wait before touching a payout?',
      a: 'Longer than the slowest normal completion, so it never races a request that is simply slow. Two minutes works in this level because the simulated bank answers in milliseconds; against a real bank it might be an hour, and it belongs in configuration either way.' },
    { q: 'What if the bank has no lookup endpoint?',
      a: 'Then the daily settlement file is your lookup, and the sweeper becomes the level 10 reconciliation. Slower, and the same idea: something that knows the truth eventually tells you, and your state machine has to hold the uncertainty until then.' },
    { q: 'Should the sweeper retry the payout if the bank never received it?',
      a: 'Compensate first, then let the normal flow create a fresh attempt if the merchant still wants paying. Retrying inside the sweeper mixes recovery with new work, and the two need different rate limits and different alerting.' },
    { q: 'My chaos test sometimes pays twice',
      a: 'Almost always the reference. Check that it is generated at creation, stored before the first attempt, and reused on every retry, including inside the sweeper.' },
    { q: 'What do I say about this project in an interview?',
      a: 'The table: 13.0% of payouts inconsistent in the naive version, 8.5% with compensation, zero after the sweeper, and nine still broken if you have the sweeper without compensation. Then explain why the last number matters, because it shows you know the two mechanisms cover different failures.' }
  ]
});
