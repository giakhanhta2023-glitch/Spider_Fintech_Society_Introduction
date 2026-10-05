/**
 * Writes solutions/level-XX/README.md for every level: the brief recap comes
 * from the curriculum files (so it cannot drift), the teaching notes below are
 * hand-written per level.
 *
 *   node tools/build_solution_readmes.js
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const levels = [];
/* Every level file in the folder, so a new level needs no edit here. */
const levelFiles = fs.readdirSync(path.join(root, 'content', 'levels'))
  .filter((f) => /^(?:level|fpa)-\d+(?:-\d+)?\.js$/.test(f))
  .sort();
for (const name of levelFiles) {
  const file = path.join(root, 'content', 'levels', name);
  new Function('FQ', fs.readFileSync(file, 'utf8'))({ registerLevel: (lv) => levels.push(lv) });
}
levels.sort((a, b) => a.id - b.id);

/* ------------------------------------------------------------------ notes */
const NOTES = {
  '10.2': {
    files: [
      ['`recon-scala/src/Money.scala`', 'an opaque type: compile time safety, no run time object'],
      ['`recon-scala/src/Model.scala`', 'Movement, Kind, and Break as a closed set'],
      ['`recon-scala/src/Load.scala`', 'bad rows as values, a changed header as an exception'],
      ['`recon-scala/src/Reconcile.scala`', 'the passes, the window, and the totals'],
      ['`recon-scala/test/ReconcileTest.scala`', '19 tests, six of them level 10\'s published figures']
    ],
    run: 'cd recon-scala && scala-cli test . --server=false --jvm 21',
    design: [
      'The verification is the point of this solution. It is not checked by reading it or by its own tests: it is checked by agreeing with level 10\'s Python engine on the real 16,639 line file. Both report 16,613 ledger movements, 16,639 settlement lines, 16,408 exact matches, 163 converted, 30 differing, and then amount_mismatch 30 at $14.19, currency_rounding 163 at $1,166.77, duplicate_settlement 1 at $104.12, missing_in_ledger 37 at $3,116.61 and unsettled_capture 12 at $1,690.07. Tests written by the same mind that wrote the bug agree with the bug; two independent implementations do not.',
      'Break is an enum rather than a string, and owner, value and label are three separate exhaustive matches over it. Adding a seventh kind of disagreement breaks all three at compile time, which is three reminders instead of one, and the one you would have forgotten is the routing.',
      'PendingSettlement is its own case because a capture that has not settled yet is not a break. Counting it as one is how a reconciliation report trains the people reading it to ignore the number at the bottom.',
      'Loaders return (Vector[Movement], Vector[BadRow]) so one unreadable row does not cost you the other 16,638, but a missing column raises. That is the line between the two kinds of failure: a bad row is expected and collected, a file whose columns moved is a different file and reading column 4 as column 5 silently is much worse than stopping.',
      'The two engines disagreed exactly once while this was written, and neither was obviously wrong. Python totalled break values as magnitudes and this one netted them, so a line $5.09 over and one $9.10 under came to $4.01 here and $14.19 there. Netting is the bug: it understates the work and lets two errors that happen to cancel look like one small one. There is a test with those two amounts in it now.',
      'The boundary test was also wrong before it was right. The window is three days and the check is `when.isAfter(cutoff)`, so a capture exactly three days old is already a break, in both engines. Off by one there raises a break a day early on every unsettled capture, every morning.'
    ],
    mistakes: [
      ['The compile server fails with an exit code and no message', 'scala-cli picked up an old Java from PATH. `--jvm 21 --server=false` makes it fetch its own and skip bloop. Slower per run, immune to whatever is installed.'],
      ['Thousands of missing settlements', 'Authorisations are in your ledger side. A hold settles nothing. Only capture, refund and chargeback move money.'],
      ['`"".toLong` throws two thirds of the way through the file', 'The settlement file leaves the fee column empty on some rows. Money.parse handles it in one line.'],
      ['A bare Long compiles as an amount', 'The opaque type only protects outside the file that declares it. Inside Money.scala, Cents and Long are the same type, which is the point and also the gap.']
    ]
  },
  '20.1': {
    files: [
      ['`refund-policy/lib/refunds/money.rb`', 'frozen, currency aware, and raising rather than guessing'],
      ['`refund-policy/lib/refunds/policy.rb`', 'the DSL, the context a rule runs against, and the engine'],
      ['`refund-policy/lib/refunds/rules.rb`', 'the policy itself: the file that is actually the deliverable'],
      ['`refund-policy/test/test_refunds.rb`', '30 tests, 87 assertions'],
      ['`refund-policy/demo.rb`', 'fifteen requests, every rule exercised at least once']
    ],
    run: 'cd refund-policy && ruby -Ilib -Itest test/test_refunds.rb && ruby -Ilib demo.rb',
    design: [
      'The DSL is two nested instance_eval calls and nothing more exotic. The outer one lets the policy block say `rule` with no receiver; the inner one lets each rule block say `because` and `refuse_when`. Every configuration block you have seen in Ruby, in Rails routes, in RSpec, in a Gemfile, is this.',
      '`valid!` runs when a rule is defined rather than when it is evaluated, so a rule with no reason stops the file loading instead of failing on a Tuesday with a customer waiting. A rule that cannot explain itself never reaches production.',
      'Every rule is evaluated on every decision rather than stopping at the first refusal. `pay_14` in the demo breaks six rules and reports six. The boolean version of this policy would have returned false. Support asking a customer to fix one thing at a time, three times, is how a two minute job becomes a week.',
      'A rule that raises becomes a refusal carrying the error, never a skip. Skipping is the dangerous one, because a check that was skipped looks exactly like a check that passed, and the money leaves. Fail closed is right here specifically because a wrong yes costs money and a wrong no costs an apology; on a card authorisation the trade runs the other way.',
      'Two bugs were found by running this rather than by reading it, and both are in the tests now. Evaluating every rule meant a currency mismatch still reached the amount comparison, and `Money#<=>` raises on mixed currencies, so the engine crashed instead of refusing. And the review thresholds were written as `money("500.00")` inside the rules, which parses in whatever currency the payment is in: `"500.00"` is not a yen amount, so an ordinary yen refund was held by a rule that could not run. The thresholds are a per currency table now, which is also the honest statement that 500 of one currency is not 500 of another.',
      'The demo prints the rules that never fired. A rule nothing can reach is dead policy nobody has checked, and a threshold from two years ago that no current payment can reach still looks like a working control in a review.'
    ],
    mistakes: [
      ['`if balance` lets a zero through', 'Only `nil` and `false` are falsey in Ruby. `0` is true, `""` is true, `[]` is true. This is the first thing that bites a Python programmer here.'],
      ['`undefined method` naming a class you did not write', 'You are inside an `instance_eval` block, so `self` is the builder rather than the enclosing object. That is the cost of the DSL, and it is why it is worth paying only for a file somebody else reads.'],
      ['A yen amount raises from a line nobody touched', 'A default like `refunded: "0.00"` is not a legal JPY amount. Use `Money.zero(currency)`, which knows how many decimal places the currency has.'],
      ['Two rules with the same name and only one ever reported', 'A copy and paste that survives review because both halves look right. The builder rejects duplicates for this reason.']
    ]
  },
  '10.1': {
    files: [
      ['`checkout-client/src/money.ts`', 'a branded Cents a plain number cannot pass for'],
      ['`checkout-client/src/api.ts`', 'zod schemas, parsed at the boundary, and the level 7 request id'],
      ['`checkout-client/src/idempotency.ts`', 'one key per attempt, surviving a reload'],
      ['`checkout-client/src/checkout.ts`', 'five states, an exhaustiveness check, and the backoff poller'],
      ['`checkout-client/tests/checkout.test.ts`', '20 tests, two of which are compile errors']
    ],
    run: 'cd checkout-client && npm install && npm run typecheck && npm test',
    design: [
      'The branded `Cents` costs nothing at run time. It compiles to a plain number, and the object in the type is never created. All it buys is the compiler refusing when an unchecked number tries to pass as money, which is the one mistake that is otherwise invisible until somebody is charged 1299 dollars instead of 12.99.',
      'The response body is taken as `unknown` rather than left as the `any` that `res.json()` returns, so the compiler forces a parse before anything touches it. `const p: Payment = await res.json()` compiles and promises nothing, which is the most common way a TypeScript codebase is typed and wrong at the same time.',
      'The `catch` in `pay()` returns `submitting`, not `failed`. A request that never came back does not mean the payment did not happen: it means you do not know, which is the level 9 timeout seen from the browser. Calling it failed invites a second charge, and keeping the key is what makes that second attempt harmless.',
      '`waitForOutcome` takes its clock as a parameter with a default. That is the cheapest way to make a timing dependent function testable: the test for all seven backoff steps runs in 53ms instead of 31 seconds, and the normal caller passes nothing.',
      "Two guarantees in this solution have no run time existence, so they were proven by breaking them rather than asserted. Changing `format(amount: Cents)` to `format(amount: number)` gives `tests/checkout.test.ts(55,5): error TS2578: Unused '@ts-expect-error' directive.` Adding a sixth member to the `Checkout` union without handling it gives `src/checkout.ts(45,13): error TS2322: Type '{ kind: \"disputed\"; disputeId: string; }' is not assignable to type 'never'.` Both of those are real output from running `tsc` on this code."
    ],
    mistakes: [
      ['`npm install` exits non-zero but the packages are there', 'A blocked postinstall script, usually esbuild. `tsc` does not need it and vitest usually still runs. Check with `npx vitest run` before assuming the install failed.'],
      ['The idempotency test passes alone and fails in the suite', '`sessionStorage` is shared between tests in one file. Clear the slot in `beforeEach`, which is what this suite does.'],
      ['`format(1299)` compiles in your copy', 'The brand was lost somewhere, usually by annotating a parameter `number` for convenience. The `@ts-expect-error` test is there to fail the build when that happens.'],
      ['Yen renders as 12.99', 'You divided by 100 regardless of currency. `decimalsFor` reads the real number of places from Intl: 0 for yen, 3 for dinars.']
    ]
  },
  1: {
    files: [['`check_setup.py`', 'paste into Colab to verify your lab in one cell']],
    run: 'Open Colab, paste `check_setup.py` into a cell, press Shift + Enter.',
    design: [
      'There is no project at level 1 on purpose. A first evening spent on installers is the most common reason people quit before they write anything that works.',
      'The checklist is the deliverable. `check_setup.py` only confirms it: it prints the Python version, imports the three libraries the course uses, formats a money value, and proves `0.1 + 0.2 != 0.3` so the float rule lands before level 2 needs it.'
    ],
    mistakes: [
      ['Nothing prints from a cell', 'Only the last expression is auto-displayed. Assigning a value shows nothing. Add `print(...)`.'],
      ['Colab will not save', 'You are not signed in to a Google account, or the notebook is a read-only copy. Use **File → Save a copy in Drive**.'],
      ['`Save a copy in GitHub` is greyed out', 'Authorise Colab against GitHub once, from the same menu. It needs permission before the repo list appears.']
    ]
  },
  2: {
    files: [['`compound_growth.py`', 'all eight functions, the report, and the self-checks']],
    run: 'python compound_growth.py',
    design: [
      'Every function is one formula. `plan_value` is the only one that composes others, which is what makes the rest trivially testable.',
      '`contributions_value` guards `i == 0` before dividing. That is not defensive padding: with no interest the answer genuinely is `payment × periods`, and the formula is undefined there.',
      '`years_to_target` is bounded by `max_years` and returns `None`. An unbounded search at a 0% rate never terminates, and returning `None` lets the caller say "not reachable" instead of crashing.',
      'Nothing rounds until an f-string. Rounding inside the loop compounds the error along with the interest.'
    ],
    mistakes: [
      ['Compound result far too small', 'You used `^` instead of `**`. With a float rate that raises a `TypeError`; with whole numbers it silently computes XOR.'],
      ['`ZeroDivisionError`', 'The annuity formula divides by `i`. Handle the zero-rate case before you divide.'],
      ['Percentages 100× too big', '`.2%` already multiplies by 100. Do not also multiply by hand.']
    ]
  },
  3: {
    files: [['`spending_analyzer.py`', 'load, aggregate, detect recurring charges, report, chart']],
    run: 'python spending_analyzer.py',
    design: [
      'Income is selected by **category**, never by sign. The dataset contains refunds (positive amounts that are not income) and filtering on `amount > 0` overstates income by exactly those.',
      'Savings transfers are excluded from spending. Moving money to your own account changes its location, not your net worth; counting it as an expense is a real bug in shipped budgeting apps.',
      '`find_recurring` groups by merchant **and** amount, then splits the result into cancellable subscriptions and fixed commitments. Rent is perfectly recurring too, and a report that tells you to cancel it is useless.',
      'The chart drops savings transfers and sorts before plotting, because an unsorted bar chart with a misleading biggest bar is worse than no chart.'
    ],
    mistakes: [
      ['`SettingWithCopyWarning`', 'Take `.copy()` when you filter: `spend = df[df["amount"] < 0].copy()`.'],
      ['Income looks too high', 'Refunds again. Filter `category == "income"`.'],
      ['Savings rate above 100% or negative', 'You counted the savings transfer as spending, or double-counted it.']
    ]
  },
  4: {
    files: [
      ['`ledger.py`', 'the ledger, the exceptions, eight test groups, and a worked demo'],
      ['`replay.py`', 'a day of real traffic driven through it: 77 instructions, 4 of them refused']
    ],
    run: 'python ledger.py && python replay.py',
    design: [
      '`_post` is the only method that appends, and it refuses anything that does not sum to zero. Every public method funnels through it, so the invariant cannot be bypassed by accident.',
      'Validation happens **before** any write. A refused transfer leaves `len(entries)` unchanged: the tests assert exactly that, because a half-written transaction is worse than a rejected one.',
      'The idempotency key is stored **after** a successful post. Storing it first would make a failed attempt permanently "already done".',
      'The level had no data to practise on, which was a gap: every other build level from 3 to 12 hands you a file and this one asked the reader to invent their own transactions. `data/level-04-instructions.csv` is a day at the society wallet, 77 instructions over 12 accounts, and `replay.py` drives it through the ledger one row at a time.',
      'Four of the seventy seven are there to be refused, one per failure the level teaches: an overdraft, an account nobody opened, an amount of zero, and a payment that arrives twice with the same key. The replay counts them by reason and carries on, because a batch that dies on the first bad row is a batch somebody has to babysit at six in the morning.',
      'The reversal instruction names the payment it cancels by its idempotency key rather than by a transaction id, because a file written the night before cannot know the id the ledger will hand out tomorrow. The replay keeps its own key to id map, which is the same map the idempotency check already needs.',
      'The expected answer is known before any code runs: the generator prints the closing balances it built, and the replay prints the ones the ledger arrived at, and they agree. 169 entries summing to zero, fee income of $8.75, and alice closing at $42.26.',
      '`reverse` writes the mirror image rather than deleting. The error and the correction both stay visible, which is what an audit needs.',
      '`split_payment` uses `divmod` and hands the leftover cents to the first recipients in order. Dropping the remainder would silently break the invariant.'
    ],
    mistakes: [
      ['Ledger does not sum to zero', 'Something wrote one leg without its partner, or wrote before validating.'],
      ['Retry creates a second transaction', 'Check the key at the very top of `transfer`, before any other work.'],
      ['Cents lost on a split', '`int()` truncates. Use `divmod` and allocate the remainder deterministically.']
    ]
  },
  5: {
    files: [
      ['`src/moneykit/currency.py`', 'Currency, the ISO 4217 exponents, and nothing else'],
      ['`src/moneykit/money.py`', 'the frozen Money type: parse, format, arithmetic, comparisons'],
      ['`src/moneykit/allocation.py`', 'allocate() by largest remainder'],
      ['`tests/test_properties.py`', 'the Hypothesis properties, including conservation of money'],
      ['`.github/workflows/ci.yml`', 'ruff, mypy --strict and pytest on a clean machine']
    ],
    run: 'pip install -e ".[dev]" && ruff check . && mypy src/moneykit --strict && pytest -q --cov=moneykit',
    design: [
      'Money and Currency are frozen dataclasses. Every operation returns a new value, so no two parts of a program can hold the same amount and disagree about it.',
      'Amounts are integer minor units everywhere they are stored or returned. Decimal appears only inside a calculation that has a fractional unit in the middle of it, and the result is quantized back to an integer before it leaves.',
      'The exponent lives on Currency, so nothing in the library divides by 100. That is what makes JPY and BHD work without a single special case.',
      '__add__ calls _same_currency first, so mixing currencies raises rather than producing a number. There is deliberately no __float__: an easy way out of the type would make every guarantee optional.',
      'allocate uses largest remainder: whole parts first, then the leftover units to whoever was cut by the most, ties broken by index so the result is deterministic. Refunds have to reverse the exact split that happened, which is impossible if the split is not repeatable.',
      'Rounding is an argument, never a default buried in the function. The caller states ROUND_HALF_UP or ROUND_HALF_EVEN, because the right answer depends on the tax rules, not on the library.',
      'Properties carry the weight: money is conserved under allocation, add and subtract undo each other, and format then parse round trips for every currency in the table. The example tests are there to document intent.'
    ],
    mistakes: [
      ['Shares do not add back to the total', 'Each share was rounded on its own. Take the whole parts with integer division and hand out the remainder afterwards.'],
      ['`Decimal(2.675)` is not 2.675', 'It was built from a float that was already wrong. Build from a string.'],
      ['JPY prints as 10.00 instead of 1,000', 'Something divided by 100 instead of by 10 ** exponent.'],
      ['mypy passes locally, fails in the pipeline', 'A dependency is installed on your machine and missing from pyproject.toml. The clean machine is right.'],
      ['Coverage is high and a bug shipped anyway', 'Coverage counts lines that ran, not assertions that checked. Add a property.']
    ]
  },
  6: {
    files: [
      ['`migrations/`', 'numbered, forward-only SQL: schema, trigger, indexes, cached balance'],
      ['`ledgerdb/migrate.py`', 'applies any file not already recorded in schema_migrations'],
      ['`ledgerdb/seed.py`', '2,000 accounts and 400,000 balanced entries, generated inside SQL'],
      ['`ledgerdb/transfer.py`', 'one transfer, one database transaction, idempotent by unique index'],
      ['`ledgerdb/bench.py`', 'EXPLAIN ANALYZE for the balance query, three ways'],
      ['`scripts/reconcile.sql`', 'cached balance against the entries: should return no rows']
    ],
    run: 'export DATABASE_URL=... && python -m ledgerdb.migrate && python -m ledgerdb.seed && python -m ledgerdb.bench && pytest -q',
    design: [
      'Constraints carry the rules that must never be broken: the amount check, both foreign keys, and the unique idempotency key. They hold for every writer, including the ones that skip the application entirely, which is the whole reason to duplicate a check the API already does.',
      'The balance rule is a deferred constraint trigger. Checked per row it would fail every transfer, because after the first entry the transaction is unbalanced on purpose. Checked at commit it refuses exactly the transactions that are wrong, and leaves nothing behind when it fires.',
      'There is no balance column until the last migration, and when it arrives it comes with the query that checks it. Two numbers for one fact is a decision, not an accident, and the reconciliation job is the price of making it.',
      'The benchmark prints plans rather than opinions. On the reference database the balance query ran at 30.917 ms with 3,334 buffers on a sequential scan, 0.375 ms with 206 buffers on a plain index, and 0.106 ms with 6 buffers on a covering index with Heap Fetches: 0.',
      'Index sizes are reported next to the timings, because the cost side is half the answer: 26 MB of table, 2,872 kB for the account index, 13 MB for the covering one.',
      'entries.transaction_id is indexed. Postgres indexes the primary key side of a foreign key and not the referencing side, and the balance trigger queries by transaction_id once per row: 41.697 ms without the index, 0.112 ms with it.',
      'Migrations are numbered, forward-only and safe to run twice. The runner records what it applied, so a retried deploy is a no-op rather than an error.'
    ],
    mistakes: [
      ['Every transfer fails the balance check', 'The trigger is not deferred. After the first entry the transaction is unbalanced on purpose.'],
      ['Inserts get slower as the table grows', 'Something runs per row against an unindexed column. Index the referencing side of the foreign key.'],
      ['EXPLAIN still says Seq Scan', 'Run analyze after creating the index, or the table is small enough that scanning really is cheaper.'],
      ['The second migration run fails', 'The runner is applying files it already applied. Record them, and use if not exists.'],
      ['Balances disagree with the entries', 'Something wrote an entry outside the trigger path, or a backfill ran while writes continued. The reconciliation query tells you which account and by how much.']
    ]
  },
  7: {
    files: [
      ['`app/main.py`', 'the routes, the middleware, and the app'],
      ['`app/models.py`', 'pydantic models: every numeric field bounded at both ends'],
      ['`app/errors.py`', 'problem() and the handlers that rewrite framework errors into it'],
      ['`app/auth.py`', 'bearer keys, stored as sha256 hashes, checked before any database work'],
      ['`app/transfers.py`', 'the write path: lookup, checks, both entries in one transaction, saved response'],
      ['`tests/`', 'TestClient tests, one per status code, plus the three idempotency cases']
    ],
    run: 'export DATABASE_URL=... && fastapi dev app/main.py   then   pytest -q',
    design: [
      'Three idempotency cases, not one. A new key does the work and returns 201. The same key with the same body replays the saved response with 200 and an Idempotent-Replay header. The same key with a different body returns 409, because that is a bug in the caller and telling them on the second request is kinder than telling them at month end.',
      'The response is saved, not rebuilt. A replay returns the original id and the original timestamp, because a retry that returns a slightly different answer is worse than one that fails.',
      'One error shape across the whole API. The framework produces its own errors in a different shape, so exception handlers rewrite them, and every error carries a stable code a program can branch on plus a request id a human can search for.',
      'Authentication runs before anything touches the database. Measured on the reference service, an unauthenticated request costs 6.1 ms while anything reaching the database costs 200 ms or more, so an unauthenticated flood is cheap to refuse.',
      'Pagination is keyset, with a capped limit and one extra row fetched to answer has_more without a count query. Measured on 400,000 rows: offset 300000 read 300,020 rows in 63.259 ms, the cursor read 20 rows in 1.365 ms.',
      'Every field has a maximum as well as a minimum. A cap on the amount is what refuses a test script with one extra zero.',
      'The latency measurement is in the README because it is the honest finding of the level: a new connection per request cost 202.7 ms median against 62.3 ms on a connection already open, with the SQL itself under a millisecond. The query was never the problem.'
    ],
    mistakes: [
      ['A retry creates a second transfer', 'The key is being stored after the write instead of checked before it, or the lookup and the insert are not in one transaction.'],
      ['The replay returns a different timestamp', 'The response is being rebuilt rather than returned from what was saved.'],
      ['Validation errors look different from your other errors', 'The framework handled them. Add exception handlers for RequestValidationError and HTTPException.'],
      ['A deep page is slow', 'Offset pagination. Switch to a cursor and prove it with two EXPLAIN plans.'],
      ['Everything is slow and the SQL is fast', 'A connection is being opened per request. Add a pool, and measure again before and after.']
    ]
  },
  8: {
    files: [
      ['`bench/race.py`', 'the workers, the barrier, and the three modes'],
      ['`bench/pool.py`', 'the same workload with no pool, a right sized pool and a small one'],
      ['`migrations/0005_balance_constraint.sql`', 'the check that makes an overdraft impossible'],
      ['`tests/test_concurrency.py`', 'the reproduction, as a test that fails without the fix']
    ],
    run: 'python -m bench.race naive && python -m bench.race for_update && python -m bench.race serializable && python -m bench.pool',
    design: [
      'Connections are opened before the barrier. Staggered handshakes are the reason a race test passes by accident, and this one has to fail every time or it proves nothing.',
      'The naive mode is kept in the repository on purpose. A fix nobody has seen fail is a claim, and the point of this project is evidence.',
      'Three fixes, three different costs. The row lock is correct with no retries and makes spending from one account single file: measured at 691 ms against 367 ms for the broken version. Serializable is faster here at 368 ms and moves the cost to every caller, who must retry, which is only safe because level 7 made writes idempotent.',
      'The constraint is the one that survives a new code path. A lock protects the code that takes it; a check on the balance column protects the account from code that has not been written yet.',
      'The isolation level is set per transaction, never as a session SET. Behind a transaction mode pooler a session setting is silently discarded, which was measured while writing this level: show transaction_isolation reported read committed immediately after setting serializable.',
      'The pool table is the argument for measuring rather than assuming: 31.4 requests a second with no pool, 127.1 with a pool of 8, and 30.8 with a pool of 2. A pool that is too small is a queue, and the wait does not appear in any query timing.',
      'Waiting for a connection is recorded as its own metric, separately from query time. That single number is how you tell a slow database from a starved pool.'
    ],
    mistakes: [
      ['The naive run does not overdraw', 'The workers are not concurrent. Open every connection before the barrier and check the barrier count matches the worker count.'],
      ['Serializable makes no difference', 'A pooler discarded the session setting. Set the isolation level per transaction and print show transaction_isolation to prove it applied.'],
      ['Everything deadlocks once two accounts are locked', 'Lock ids in a consistent order, lowest first, so a cycle cannot form.'],
      ['Throughput does not improve with a pool', 'The pool is smaller than the concurrency, so requests queue for a connection instead of using the database.'],
      ['The service hangs under load instead of failing', 'No acquire timeout on the pool. An exhausted pool should return 503 with Retry-After, not an unbounded queue.']
    ]
  },
  9: {
    files: [
      ['`cards/states.py`', 'the state machine as data, plus the one guard every change goes through'],
      ['`cards/network.py`', 'the simulator: declines, latency, timeouts, and references it remembers'],
      ['`cards/payments.py`', 'authorise, capture including partial, void, refund, chargeback'],
      ['`cards/expiry.py`', 'the job that releases holds nobody captured'],
      ['`cards/resolve.py`', 'settling every unknown against the network report'],
      ['`cards/report.py`', 'where the week of money went']
    ],
    run: 'python -m cards.analyse && pytest -q && python -m cards.report',
    design: [
      'Authorisation writes a hold and no ledger entries, because no money has moved. Capture writes the balanced transaction. That one rule is what keeps the ledger reconcilable, and it is the rule beginners break: 4.88% of approvals in the shipped week expired uncaptured, and posting entries at authorisation would have turned $74,230.57 of them into revenue that has to be unwound by hand.',
      'unknown is a state, not an error. A timed out request has not failed and has not succeeded, and a model that cannot say so will guess. In this week it would have guessed 159 times, with $11,477.03 at stake.',
      'Every message carries our own reference, so a retry after a timeout is recognisable to the network rather than a second hold on somebody card. The simulator remembers references on purpose, so the difference is visible in a test.',
      'Cancelling is one rule with two implementations: uncaptured is a void, captured is a refund. A system that refunds where it could have voided is costing its merchants the processing fee quietly, and nobody complains because nothing looks broken.',
      'Decline codes are stored on the payment and classified hard or soft. 74.2% of the declines in this week were soft, worth $167,410.94, and retrying the other 25.8% is how a merchant loses approval rate and collects fines.',
      'Partial capture is modelled with separate authorised and captured amounts, and the released remainder is reported back, because the customer sees that hold disappear and the merchant needs to know it is not coming.',
      'The report reconciles: authorised $1,387,793.78, captured $1,234,167.87, refunds $48,140.30, chargebacks $6,152.18, net $1,179,875.39, and the $153,625.91 gap explained entirely by expiries, voids and partial captures.'
    ],
    mistakes: [
      ['Reconciliation never balances', 'Entries were posted at authorisation. Only capture moves money.'],
      ['A timeout produced two holds', 'The retry generated a new reference. Send the same one, and a reversal before retrying.'],
      ['Approval rate falls over weeks', 'Hard declines are being retried. Classify the codes and stop on the hard ones.'],
      ['A capture succeeded after expiry', 'The state machine is not consulting the expiry, or the expiry job never ran.'],
      ['Refund amounts drift above the capture', 'Refunds are being summed against the authorised amount instead of the captured one.']
    ]
  },
  10: {
    files: [
      ['`recon/load.py`', 'both sides normalised into one shape, with signs agreed'],
      ['`recon/match.py`', 'the passes, most certain first, each recording why it matched'],
      ['`recon/classify.py`', 'break types with owners, and the pending state that is not a break'],
      ['`recon/payouts.py`', 'every payout tied to the lines that make it up'],
      ['`recon/fees.py`', 'the contract recomputed, and the effective rate by payment size'],
      ['`recon/queue.py`', 'stable break ids, first seen, last seen, owner, status'],
      ['`recon/report.py`', 'the daily report a finance team signs']
    ],
    run: 'python -m recon.report --settlement data/level-10-settlement.csv --ledger data/level-09-card-events.csv',
    design: [
      'Both sides are normalised before anything is compared. Signs are the first trap: the file writes a refund as negative gross and the ledger writes it as a positive refund event, and a single convention chosen at the boundary removes a whole class of confusion.',
      'Matching runs in passes from certain to probable, and every automatic match records the rule that made it. A match nobody can explain later is not evidence.',
      'pending_settlement is a classification, not a break. The settlement window is configuration, because the day a processor changes its timing every capture in the country looks broken at once.',
      'The five results on the shipped data: 16,408 matched exactly, 193 amount mismatches worth $1,180.96 of which 163 are currency rounding, one duplicated line, 37 movements in the file with no ledger record worth $3,116.61, and 12 captures the processor never settled worth $1,690.07.',
      'The 37 are resolved at the cause rather than by insertion. Every one is a level 9 authorisation that timed out and was approved anyway, so the fix is the resolver, and the break disappears because the entry now exists for a reason.',
      'Fees are recomputed from the contract rather than trusted. 2.9% plus 30 cents comes out at an effective 3.2851% across the file, and the fixed part is the whole story: 7.03% under $10 against 2.99% over $200.',
      'Breaks carry an id derived from what they are about, so the job is safe to run twice. A reconciliation that cannot be rerun will be run once, badly, by somebody in a hurry.'
    ],
    mistakes: [
      ['The match rate is far below 99%', 'Usually keys or signs. Print ten unmatched rows from each side side by side.'],
      ['Thousands of breaks on the most recent day', 'Timing counted as breaks. Anything inside the settlement window is pending.'],
      ['Rerunning the job doubles the queue', 'Break ids are generated from the run rather than from the break.'],
      ['The payout totals do not tie', 'A duplicated line counted once in one place and twice in another, or a date parsed in the wrong timezone.'],
      ['A break was closed to make the report clean', 'That is a plug. Leave it open, aged and owned, and write down what has been checked.']
    ]
  },
  11: {
    files: [
      ['`events/outbox.py`', 'the event written inside the business transaction'],
      ['`events/publisher.py`', 'batched, skip locked, safe to run twice over'],
      ['`events/consumer.py`', 'idempotent handling with a processed_event table'],
      ['`events/partition.py`', 'the one line that decides what stays in order'],
      ['`events/dlq.py`', 'retries, then a dead letter with the error and the offset'],
      ['`bench/dual_write.py`', 'the experiment that justifies the whole pattern']
    ],
    run: 'python -m bench.dual_write && python -m events.publisher && python -m events.consumer --replay',
    design: [
      'The dual write experiment stays in the repository, because the pattern is only convincing next to the thing it replaces. Measured: 400 payments, 380 events published, 20 lost forever at a 5% crash rate, with no error anywhere.',
      'The outbox row is written in the same transaction as the payment, so the two cannot disagree. The same experiment then loses nothing and delivers 3.50% of events twice, which is the trade the pattern is making on purpose.',
      'The publisher uses for update skip locked and a partial index on unpublished rows. The index matters the way the level 6 foreign key index mattered: without it every poll scans a table that only grows.',
      'Batch size is the performance story. 400 events took 30,473 ms one row at a time and 116 ms in batches of 500, a factor of 265 with no change to the query or the network. Round trips, not work.',
      'Consumers are idempotent two ways, deliberately: a processed_event table for work with side effects, and an upsert keyed by payment id where the projection can simply be written again. The README says which to use where.',
      'The partition key is chosen and then proved. Over the level 9 stream in 4 partitions: keyed by payment id, zero events out of order; keyed at random, 4,577 out of order affecting 4,534 of 17,216 multi event payments, which is 26.3%.',
      'Replay is the acceptance test. The projection is truncated, the offset reset, the stream replayed, and the result compared row for row against what was there before.'
    ],
    mistakes: [
      ['Events are missing downstream', 'Dual write. The publish is outside the transaction that wrote the business data.'],
      ['Totals are double counted after a redeploy', 'A consumer that increments rather than sets, with no processed_event marker.'],
      ['A capture arrives before its authorisation', 'Partitioned by something other than the payment. Ordering only holds within a partition.'],
      ['The publisher slows down as the table grows', 'No partial index on unpublished rows, so every poll scans everything.'],
      ['Replaying sent four months of emails again', 'Side effects and projections in the same consumer. Separate them before resetting any offset.']
    ]
  },
  12: {
    files: [
      ['`saga/bank.py`', 'the other side: rejects, times out, remembers references'],
      ['`saga/orchestrator.py`', 'the steps, with state committed before each external call'],
      ['`saga/compensate.py`', 'the undo for each step, idempotent by constraint'],
      ['`saga/sweeper.py`', 'the job that resolves everything left mid flight'],
      ['`saga/stuck.py`', 'the query that should always return nothing'],
      ['`bench/naive.py`', 'the version without any of this, for the numbers']
    ],
    run: 'python -m bench.naive && python -m saga.orchestrator --runs 200 && python -m saga.sweeper',
    design: [
      'The naive orchestrator stays in the repository, because the fix only means something next to the failure. Measured over 200 payouts: 26 ended with money debited and nobody paid, which is 13.0%.',
      'Three causes, two categories. Nine rejections are failure, where the outcome is known. Seven timeouts and ten crashes after submitting are uncertainty, where it is not, and the two need different mechanisms.',
      'Compensation covers the known case. A rejected payout credits the merchant back as a new balanced transaction, which takes the inconsistent count from 26 to 17. The debit and its reversal both stay in the ledger: a semantic rollback, not a database one.',
      'A timeout writes the state `unknown` and stops. No retry, because that risks paying twice; no compensation, because that risks cancelling a real payment. Recording that we do not know is the only correct action available.',
      'The sweeper covers the unknown case. It asks the bank about every unfinished payout and finishes it: 17 turned out to have been paid, and the inconsistent count went to zero. With the sweeper but no compensation, nine are still broken, which is the argument for having both.',
      'The bank is idempotent on the reference we generate, which is why the lookup works and why no payout was sent twice. The reference is created once, at creation, and stored before the first attempt.',
      'Stuck detection is the last net: anything in a non final state for more than fifteen minutes is alerted on, because it catches the failures neither mechanism predicted.'
    ],
    mistakes: [
      ['A payout went out twice', 'The reference was generated per attempt rather than once at creation, so the bank saw two different payouts.'],
      ['A real payment was cancelled', 'Compensating on timeout. A timeout is uncertainty, not failure, and only the sweeper can resolve it.'],
      ['After a crash, nobody knows what happened', 'State written after the external call instead of before it. Mark it submitting and commit, then call.'],
      ['Money missing with no alert', 'A compensation that failed and was logged. There is nothing further back to unwind to, so it is a page.'],
      ['Two sweepers processed the same payout', 'No for update skip locked on the query that picks up unfinished work.']
    ]
  },
  13: {
    files: [
      ['`bench/baseline.sql`', 'the plain table, measured before anything changed'],
      ['`partition/create.sql`', 'monthly partitions, and the job that makes next month'],
      ['`partition/compare.md`', 'pruning and the cost of pruning, with both plans'],
      ['`migrate/001_expand.sql`', 'the nullable column, instant at any size'],
      ['`migrate/backfill.py`', 'batched, key walking, resumable, with a sleep'],
      ['`migrate/verify.sql`', 'the disagreement count that has to be zero'],
      ['`load/generator.py`', 'the writer and reader that run through the whole migration']
    ],
    run: 'psql -f bench/baseline.sql && python -m load.generator & python -m migrate.backfill',
    design: [
      'Partitioning is presented with both halves. The monthly aggregate went from 4,729 pages touched to 396 and from 19.7 ms to 13.7 ms, because a month is physically one table rather than rows scattered across the heap.',
      'And the cost, measured on the same data: a lookup by merchant went from one index scan to ten, and planning time from 0.188 ms to 0.898 ms, which is more than the query takes to execute. The README says which queries got worse and why the trade still pays.',
      'Retention is the real argument. Deleting one month took 47.2 ms, produced 2,947 kB of write ahead log and returned no disk. Dropping the partition took 0.9 ms, produced 5,400 bytes and returned all 5,336 kB immediately.',
      'The five migrations are measured with the lock each one takes. Adding a column with a constant default took 0.6 ms; the same line with gen_random_uuid() took 1,526 ms and 70 MB of log, because a volatile default rewrites the table under ACCESS EXCLUSIVE.',
      'Every migration file starts with lock_timeout and statement_timeout. The repository reproduces the lock queue on purpose: a long reader, a blocked migration, and a third session that cannot run a plain select.',
      'The backfill compares one statement against batches of 10,000. Same log, same bloat, 6% slower, and the longest lock held drops from 5,622 ms to 280 ms. The predicate keeps `fee_minor is null` so the job is idempotent and survives being killed.',
      'Verification uses `is distinct from` rather than `<>`, because null comparisons are null, so a plain comparison skips exactly the rows the backfill missed.',
      'The store for each workload is chosen from its access pattern rather than its volume, and written down: the ledger relational because the balancing invariant must be enforced by the database, counters and limits in Redis because they are hot and losable, files in object storage, analytics in a column store fed by change data capture, and the token lookup as the one genuinely key value workload in the platform.',
      'The acceptance test is the load generator: the full migration runs under continuous traffic and the report states failures and p99 latency, before and during.'
    ],
    mistakes: [
      ['The endpoint got slower after partitioning', 'It does not filter on the partition key, so it scans every partition and pays the planning cost too.'],
      ['Inserts failed at midnight on the first', 'Nobody created next month partition. Automate it and alert when fewer than two future months exist.'],
      ['A one second migration took the site down for four minutes', 'It queued behind a long reader, and everything else queued behind it. lock_timeout prevents this.'],
      ['The backfill died at hour five and undid everything', 'One transaction instead of batches. Atomicity across the whole job is not the property you need.'],
      ['Each backfill batch was slower than the last', 'offset, which counts through every skipped row. Walk the primary key instead.'],
      ['A refund vanished after the page reloaded', 'The read went to a replica that had not caught up. Read your own writes goes to the primary.'],
      ['"We would put the ledger in DynamoDB for scale"', 'Nothing enforces that every transaction balances, and at a few terabytes a year the write throughput was never the constraint.']
    ]
  },
  14: {
    files: [
      ['`lab/generate.py`', 'open loop arrivals, Poisson, fire and forget'],
      ['`lab/report.py`', 'percentiles, goodput, status codes, median of three runs'],
      ['`svc/cache.py`', 'Redis, single flight, and the list of what is never cached'],
      ['`svc/limiter.py`', 'a token bucket in Lua, atomic, keyed per customer'],
      ['`svc/breaker.py`', 'closed, open, half open, with the thresholds explained'],
      ['`svc/shed.py`', 'a queue depth limit and a 503 with Retry-After'],
      ['`BUDGET.md`', 'the latency budget, with measured numbers beside each line']
    ],
    run: 'docker compose up -d redis && python -m lab.generate --rps 100 --seconds 15 && python -m lab.report',
    design: [
      'The load generator is open loop on purpose. A closed loop generator slows down when the service does, so it can never offer more than the service can take, and every overload number it produces is fiction.',
      'Capacity is computed before anything is measured: 8 workers over a 70 ms mean service time is 114 requests per second. Every other number in the report is quoted as a percentage of it.',
      'The sweep is the centrepiece. p50 58.0 ms and p99 265.6 ms at 35% of capacity, against p50 220.2 ms and p99 594.3 ms at 95%, with the work per request unchanged. Latency is flat and then it is a wall.',
      'Queue time and service time are recorded separately, which is what lets the README say that the tail at low load is the dependency and the tail at high load is the queue. They need different fixes.',
      'Caching is reported honestly. At an 80% hit ratio the median fell to 15.7 ms while the p99 stayed at 256.6 ms, because the one request in five that misses still pays the full price including the slow path.',
      'The limiter refuses in microseconds rather than queueing, which is why a fast no is worth building. Offered 250 requests per second against a limit of 100: 1,223 served at 101 a second with a p99 of 304.2 ms, and 2,043 refused with a 429 in microseconds, having taken no worker.',
      'Shedding is argued with goodput rather than throughput. At twice capacity, accepting everything gave a p99 of 2,972.1 ms for responses nobody was still waiting for; shedding at a queue depth of 20 gave 116 successful responses per second at a p99 of 461.3 ms.'
    ],
    mistakes: [
      ['The load test shows no overload at any rate', 'A closed loop generator. It waits for each response, so it cannot offer more than the service can serve.'],
      ['Mean latency is fine and users complain', 'A tail problem. A handful of very slow requests barely move an average, and a page making twenty calls hits p99 18% of the time.'],
      ['The cache did not help the p99', 'It is not supposed to directly. Misses still pay full price. The tail improves only when the cache takes enough load off the workers to stop the queue forming.'],
      ['An outage got worse after retries were added', 'Retries multiply load on the thing that is already failing. Backoff, jitter and a retry budget, or do not retry.'],
      ['One customer degraded everybody', 'A global rate limit instead of a per customer one.'],
      ['Requests succeeded but nobody was waiting', 'Throughput measured instead of goodput. A response after the caller gave up is not a success.']
    ]
  },
  15: {
    files: [
      ['`THREAT_MODEL.md`', 'assets, attackers, controls, and what is not defended'],
      ['`SCOPE.md`', 'who can see a card number, before and after the vault'],
      ['`vault/keys.py`', 'the key service simulator, 8 ms a call, master key unreachable'],
      ['`vault/envelope.py`', 'data keys, wrapping, AES-GCM with the record id bound in'],
      ['`vault/tokens.py`', 'random tokens, the stable index, rotation that rewrites no card row'],
      ['`vault/webhooks.py`', 'sign, verify, the rotation window, constant time compare'],
      ['`vault/logging_.py`', 'an allowlist, plus the redactor for free text'],
      ['`vault/bench.py`', 'the five measurements the README publishes'],
      ['`sql/001_audit_log.sql`', 'the append only audit log, two roles and two triggers'],
      ['`tests/test_vault.py`', 'fourteen of the sixteen required tests, twenty five in total'],
      ['`tests/integration/`', 'mutual TLS with real handshakes, and the database role']
    ],
    run: 'pytest -q && python -m vault.bench',
    design: [
      'The threat model is written first and everything else refers to it. The section that gets read is the one naming what is deliberately not defended, because it tells a reviewer where to look.',
      'Envelope encryption is justified with arithmetic rather than habit. Encrypting 20,000 card numbers with one key service call each is 20,000 calls and 172 seconds; with data keys it is 200 calls and 2.0 seconds, measured end to end rather than estimated.',
      'Local cryptography turns out not to be the cost at all. The AES-256-GCM primitive sealed a card number in 2.1 microseconds, and the shipped `seal()` took 7.0, because most of that function is building a cipher object rather than encrypting. Caching the cipher would recover the difference and would keep plaintext key material alive past the call, which is not worth three microseconds when the network call it avoids costs eight thousand.',
      'Rotation is the part that separates reading about envelopes from having done it. Rewrapping 200 data keys took 3 ms and rewrote no card row. Re-encrypting 20,000 records took 373 ms of cryptography plus a rewrite of every row, which is the level 13 backfill with all of its locks and log volume.',
      'Tokens are random and mean nothing. The scope table is the deliverable: seven systems that stored a card number became one. The document also says plainly that the API still handles one in flight, so the precise count is seven to one for storage and seven to two for handling, and that hosted fields are what close the gap.',
      'Token verification is costed because it sits on the hot path: HS256 97.0 us, RS256 260.0 us, ES256 463.6 us per verification, which is 10%, 26% and 46% of a core at a thousand requests per second. Verifying RSA is cheaper than verifying an elliptic curve, which surprises most people.',
      'Mutual TLS is proven with three real handshakes against a real listener, and the first version of that test was flaky one run in three. Under TLS 1.3 the client sends its certificate late, so `wrap_socket` can return successfully to a client that is about to be rejected. The test now asserts what the server recorded and that no application bytes came back, which is the property that actually matters.',
      'The audit log has two layers and two error codes, both verified on PostgreSQL 18.6: 42501 from the grant, which contains an attacker holding the application credentials, and 23001 from a statement level trigger, which catches the migration that means well. Truncate is tested beside delete, because revoking delete does not stop it.',
      'The timing attack on `==` could not be reproduced: 212.1 ns when the wrong secret differs at the first byte against 224.7 ns at the last, six per cent apart, with the sign moving between instruments. compare_digest costs 24 ns more and is used anyway, because it is nearly free and it removes a dependency on an implementation detail. The failed reproduction is reported rather than hidden.'
    ],
    mistakes: [
      ['A valid token let a caller do the wrong thing', 'Authentication checked, authorisation not. A signature proves who, never what they may do.'],
      ['A token from another service was accepted', 'No audience check. Every token says what it is for.'],
      ['An attacker signed their own token', 'The algorithm was read from the token. Pin it in the code, always.'],
      ['Rotation meant rewriting every card row', 'Data keys not used, so the master key is encrypting records directly.'],
      ['A ciphertext was moved between rows and still decrypted', 'No context bound into the additional authenticated data.'],
      ['A card number appeared in the logs', 'A denylist of fields to redact. Allowlist what may be logged, and test it.'],
      ['The mutual TLS test passes sometimes', 'TLS 1.3 sends the client certificate after the handshake looks finished. Assert on what the server recorded and on no application bytes arriving, not on which exception the client saw.'],
      ['The audit log had a gap', 'The application role could delete from it, or truncate it, so it was never an audit log.']
    ]
  },
  16: {
    files: [
      ['`obs/context.py`', 'the request id in a context variable, and the queue envelope'],
      ['`obs/logging_.py`', 'JSON events, a name registry, an allowlist, a sampling policy'],
      ['`obs/metrics.py`', 'RED metrics, declared label domains, and the series ceiling'],
      ['`obs/tracing.py`', 'W3C traceparent, and the context that travels inside the message'],
      ['`obs/sampling.py`', 'tail sampling, and what it actually retained'],
      ['`obs/experiments.py`', 'cardinality, percentiles, buckets and log volume'],
      ['`slo/OBJECTIVES.md`', 'four journeys, budgets in minutes, and the budget policy'],
      ['`slo/burn_rate.yml`', 'the multiwindow rules, with runbook and dashboard links'],
      ['`slo/replay.py`', 'a month of traffic, and the pages five rules would have produced'],
      ['`runbooks/`', 'one per alert, dated, and checked by a test'],
      ['`gameday/drills.py`', 'nine faults injected into a copy of the repository'],
      ['`GAMEDAY.md`', 'what was broken, what noticed, and two things it found'],
      ['`POSTMORTEM.md`', 'the day 19 incident, with the money and owned actions']
    ],
    run: 'pytest -q && python -m obs.experiments && python -m slo.replay && python -m gameday.drills',
    design: [
      'The three signals are used for what each is good at: metrics say something is wrong, traces say where, logs say why. The request id is generated at the edge and lives in a context variable, so a function four calls deep cannot forget it and no signature has to carry it.',
      'Cardinality is budgeted rather than hoped for. Measured on one counter: 100 series cost 0.1 MB and a 3.0 ms scrape; adding merchant_id with 500 values took it to 200,000 series, 203.8 MB and a 15,734 ms scrape against a 15 second scrape interval. The scrape no longer fits inside its own interval, so the monitoring becomes the outage.',
      'The budget is checked against the declaration rather than against the test traffic, and that correction came from the game day. The first version of the test asserted a budget over fifteen label combinations the test itself had created, so it would have passed with merchant_id added and five hundred merchants in production. `worst_case_series()` now refuses any label whose values cannot be enumerated, and the declared ceiling of this service is 151 series against a budget of 5,000.',
      'Percentiles are aggregated by summing histogram buckets, never by averaging quantiles. With ten instances and one of them three times slower, the true p99 was 393.4 ms, the average of the instance p99s was 361.6 ms, and the maximum across instances was 906.2 ms. The average sat close to a healthy instance, so the dashboard looked normal.',
      'Buckets come from the measured distribution. Prometheus defaults reported a p99 of 450.1 ms when the exact value was 301.5 ms, a 49.3% error produced entirely by the gap between the 250 ms and 500 ms edges. Tuned buckets brought it to 1.6%.',
      'Log volume is measured rather than estimated: the median rendered line is 152 bytes, which is 15.8 GB a day at 200 requests a second, and 1.1 GB under a policy that keeps every error, every slow request and one in twenty of the rest. The sampling decision is taken on the request id so a request is kept or dropped whole.',
      'Alerting is replayed rather than argued about. Over a simulated month with two incidents and two harmless blips: a threshold on error rate paged 4 times with 2 false pages; multiwindow burn rate paged twice with none, and detected the 35% incident in 2 minutes and the 8% one in 10, which is severity scaling nobody had to configure.',
      'The short confirming windows are measured, not assumed. Without them the rule keeps firing for 335 and 355 minutes after the two incidents end, against 28 and 30 with them, because a six hour window keeps averaging in an outage that is over. That is how an alert gets silenced before the next one.',
      'The uncomfortable number from the same month: the two incidents were only 42% of all errors. The other 58% came from a quiet 0.05% background rate that never crossed a threshold and never woke anybody, and it was spending most of the budget.',
      'The game day is a fault injection runner rather than a story. Nine plausible mistakes applied to a throwaway copy, nine caught, each by exactly the test you would want to see fail, in under two seconds of test time.'
    ],
    mistakes: [
      ['A scrape started timing out', 'A high cardinality label. Series count is the product across labels, and it never comes back down.'],
      ['The series budget test passed and production still broke', 'The test asserted a budget over traffic the test created. Compute the ceiling from the declared label values instead.'],
      ['The latency dashboard was wrong by half', 'Default histogram buckets. The p99 landed in a bucket 250 ms wide and the interpolation was a guess.'],
      ['One broken instance was invisible', 'Instance p99s were averaged. Sum the buckets, and also graph the maximum.'],
      ['The trace stopped at the queue', 'Context has to travel inside the message, not in a header.'],
      ['Sampling threw away the incident', 'Head sampling keeps 1% of errors at 1%. Tail sampling keeps all of them.'],
      ['The alert kept firing for hours after the incident', 'No short confirming window. The long window averages in an outage that is over.'],
      ['Nobody reacts to the pager any more', 'It has been paging for causes and for blips. Page for symptoms tied to an objective, and delete the rest.'],
      ['The postmortem blamed a person', 'Ask what made the wrong action look right. That question has a fix attached; blame does not.']
    ]
  },
  17: {
    files: [
      ['`Dockerfile`', 'multi stage, non root, pinned base, real health check'],
      ['`Dockerfile.naive`', 'kept, because the comparison is the lesson'],
      ['`.github/workflows/gate.yml`', 'fast checks, one build, integration against that image'],
      ['`app/config.py`', 'one validated object, and an error that never echoes a value'],
      ['`app/health.py`', 'liveness and readiness, which are different questions'],
      ['`app/flags.py`', 'read at request time, default off, kill switches, expiry dates'],
      ['`deploy/bluegreen.py`', 'the readiness gate and both rollback paths, runnable'],
      ['`deploy/rehearsal.py`', 'the measured deploy: broken version, two rollbacks, kill switch'],
      ['`infra/`', 'terraform, remote state, a private database, and NOT_APPLIED.md'],
      ['`k8s/`', 'one component, five objects, three probes, explained line by line'],
      ['`migrations/`', 'six deploys, and the step where the rollback window closes'],
      ['`ship/image.py`', 'what a single stage build would ship, measured'],
      ['`ship/gate.py`', 'the gate, timed step by step'],
      ['`ship/cost.py`', 'measured volumes, unverified prices, and the cost per payment'],
      ['`COST.md`', 'the table, what to halve, and what would not be cut'],
      ['`ARCHITECTURE.md`', 'every service, what it owns, and what happens when each dependency is gone']
    ],
    run: 'pytest -q && python -m deploy.rehearsal && python -m ship.gate && python -m ship.cost',
    design: [
      'The image contains what runs and nothing else. Measured on the dependency tree, because the machine had no Docker: 60.7 MB and 3,424 files to run the service, 149.3 MB and 6,701 files once the test framework, type checker and linter are added. That is 88.6 MB shipped for no reason, and none of it executes in production.',
      'Layers are ordered by how often they change. Installing the runtime dependencies took 26.7 seconds, and a Dockerfile that copies source before installing pays that on every one line change rather than when the lockfile moves.',
      'Configuration is one validated object read at import, so a missing variable stops the service at start rather than on the first payment. The first version of that module interpolated the parse error, so a bad PORT printed the value: harmless there, and a password for DATABASE_URL. The test caught it, the parsers now carry an expectation string, and the value never reaches the message.',
      'The gate was timed step by step rather than guessed at. The syntax check over seventeen files took 6.71 s as seventeen processes and 1.13 s as one, six times faster with nothing removed and nothing relaxed. Startup, not work, which is what the largest number in a slow pipeline usually is.',
      'Blue green is chosen for the rollback column. Measured over five runs: a good deploy became ready in 57.6 ms, a rollback by switching reached its first healthy response in 6.8 ms, and the deliberately broken version served zero requests because readiness never passed.',
      'Writing the rehearsal found the hazard nobody mentions: with two sides, deploying onto the idle side overwrites the rollback target, so a failed deploy has already destroyed it. The rollback is then a deploy again, at 636.2 ms rather than 6.8, and both numbers are published rather than the flattering one.',
      'Migrations and the code that needs them never deploy together. The six deploy sequence was run against PostgreSQL 18.6 on 25,700 rows: at step 4 both code versions read all 25,500 rows with zero disagreements, which is the rollback proof, and at step 5 they disagree on 200 rows, which is the rollback window closing. That step is the one nobody writes down.',
      'The cost model separates what is measured from what is not. Volumes come from levels 15 and 16: 152 bytes a log line, six lines a payment, 151 metric series an instance, four spans a trace, one data key per hundred records. All nineteen unit prices are marked unverified, with the command that replaces them, and the total is $2,968 a month or $0.000023 a payment against a $2.56 card fee.',
      'Access is by role rather than by key. The task role is scoped to one secret, one key, one bucket prefix and two queues, the one unavoidable wildcard is narrowed by a condition and commented, and a test in the gate scans the repository and the environment for key shaped strings.',
      'Kubernetes is present at the depth the interview asks for: one component, five objects, and the three probes with the reason each exists. Liveness must not check a dependency and readiness must, and getting that backwards turns a thirty second database blip into every Pod restarting at once.',
      'What was not verified is listed rather than implied. Terraform has never been applied and infra/NOT_APPLIED.md says so line by line, the manifests were parsed and never scheduled, and the image checks are static plus a step in the gate.'
    ],
    mistakes: [
      ['The image is enormous', 'The build toolchain is inside it. A later RUN that deletes files does not help: layers are forever.'],
      ['Every code change rebuilds everything', 'Source copied before dependencies are installed.'],
      ['It started fine and failed on the first payment', 'Configuration read lazily instead of validated at start.'],
      ['A password appeared in a startup error', 'The parse exception was interpolated into the message. Say what was expected, never what arrived.'],
      ['People bypass the pipeline', 'It is too slow. Time the steps; the answer is usually startup or a cold cache, not the tests.'],
      ['Rollback took twenty minutes', 'Rolling deploys. Blue green makes it the switch going back.'],
      ['The rollback button did nothing', 'A failed deploy had already overwritten the idle side, so there was no good version to switch to.'],
      ['Rollback was impossible', 'A migration shipped with the code that needed it, or steps 4 and 5 of the sequence went out together.'],
      ['A secret turned up in a bucket', 'It was in a terraform variable, so it is in the state file in plaintext.'],
      ['The first cloud bill was a surprise', 'A NAT gateway and an idle database charge by the hour whether or not anything uses them. The billing alarm goes in before the first resource.'],
      ['A wildcard policy shipped', '"Action": "*" added at 6pm to make an error go away. Start from nothing and add the one action that failed.'],
      ['A secret sat in a Kubernetes Secret', 'Base64 is not encryption. The object holds a reference; the value stays in the secret manager.']
    ]
  },
  18: {
    files: [
      ['`payments-api-java/money/Money.java`', 'long minor units, exact, overflow throws'],
      ['`payments-api-java/card/AuthResult.java`', 'sealed, so an unhandled outcome is a compile error'],
      ['`payments-api-java/api/PaymentApi.java`', 'the level 7 contract, on the JDK own server, tested over HTTP'],
      ['`payments-api-java/tx/`', 'both @Transactional traps, with a real dynamic proxy'],
      ['`payments-api-java/race/LostUpdateTest.java`', 'the level 8 race with real threads, and three fixes'],
      ['`payments-api-java/bench/VirtualThreads.java`', 'two executors, two handler shapes, five concurrencies'],
      ['`payments-api-java/bench/WarmUp.java`', 'the JIT curve, measured twice because the first try measured the socket'],
      ['`payments-api-java/docs/`', 'the compile failure and the lost update, with real output'],
      ['`payments-api-java/spring/`', 'the Spring layer, written and never built, with NOT_BUILT.md saying so'],
      ['`webhook-sender/`', 'the Go component: worker pool, timeouts, jitter, graceful shutdown'],
      ['`bench/python_baseline.py`', 'the same operation in Python, for the comparison']
    ],
    run: 'javac -d target/classes $(find src/main/java -name "*.java") && java -cp target/classes finquest.bench.WarmUp && cd ../webhook-sender && go test ./...',
    design: [
      'The port is of one service rather than of the whole course, because the second port teaches nothing the first did not. The payments API was chosen because it exercises HTTP, validation, idempotency, a state machine and tests at once.',
      'Money is long minor units with BigDecimal only where fractions of a cent are genuinely needed, and both classic traps are tests rather than warnings: BigDecimal from a double is 0.1000000000000000055511151231257827, and equals disagrees with compareTo about 1.0 and 1.00 so a HashSet holds one amount twice.',
      'The int limit is treated as a real constraint. 2,147,483,647 minor units is $21,474,836.47, an int wraps to negative past it with no error, and the test asserts the wrap so nobody has to take it on trust.',
      'The sealed interface is the reason to be on the JVM, and the repository proves it by breaking on purpose: adding a fourth outcome produces "the switch expression does not cover all possible input values" with two file and line references, and docs/compile-failure.md has the real javac output plus the three details that silently remove the check.',
      'Both @Transactional traps are demonstrated with a real JDK dynamic proxy rather than with Spring, because both come from the proxy: an internal call opens no transaction at all, and a checked exception commits under the default rollbackFor. The journal the test asserts on reads "begin, commit despite AccountClosed".',
      'The lost update reproduces with sixteen threads and loses 91% of deposits with no error anywhere, and the three fixes are measured side by side: optimistic locking needed 13,446 retries for 3,200 deposits, which is the price of being optimistic under contention. The SQL fixes are verified on PostgreSQL 18.6, where a stale version updates zero rows.',
      'Getting that reproduction reliable took two attempts. Thread.onSpinWait() is a hint the JIT may compile away, so the race failed to show up about one suite run in three, and a flaky test proving a real bug is worse than no test because it teaches people to re-run the suite.',
      'Virtual threads are measured rather than assumed, and the honest result is in two halves. For a CPU bound handler they are not a performance feature: a fixed pool of 200 was faster between 8 and 256 concurrent requests. With every request waiting 20 ms on a dependency and a thousand concurrent, they gave a p50 of 61.67 ms against 133.92 and zero failures against 4.9%.',
      'The warm up curve was measured twice because the first attempt measured the wrong thing: over loopback HTTP the p50 was 5 ms and the p99 sat near 39 ms with no trend, which is delayed acknowledgement meeting Nagle rather than the compiler. Measured in process, p50 improves 8.6 times and p99 34.6 times over a second and a half, and that is where a readiness delay and a canary window come from.',
      'The Java against Python comparison is the same operation in both rather than two HTTP servers, so it measures the runtimes. Warm, the JVM is 3.9 times faster at 0.80 us against 3.10 us; cold, its first bucket at 6.90 us is slower than Python steady state. And in a real service the database is 1 to 5 ms, so the runtime is under one percent of the request and the language is not why anything is slow.',
      'One component is written in Go rather than a second full port: the webhook sender, with a worker pool, a timeout on every call, retries with full jitter and a shutdown that releases what it has claimed. 222,226 deliveries a second at 256 workers against a null transport, and 9,707 concurrent deliveries in 15 MB of heap. The claim it supports is that an unfamiliar language can be picked up and shipped in, which is what a hiring manager probes.',
      'Writing the Go tests found two bugs in the Go code, which is the argument for the tests rather than the benchmarks: a batch of claimed events was dropped on shutdown, invisible because a claimed row is not a pending row, and the 5 ms claim ticker rather than the work was setting the throughput.',
      'What could not be built is listed rather than implied. There is no Maven here so Spring cannot be compiled, and no container runtime so Testcontainers cannot run; both are written, both say NOT_BUILT at the top, and the table in the README names the running code that covers the same behaviour.'
    ],
    mistakes: [
      ['Amounts went negative above twenty million dollars', 'int instead of long. It wraps silently, with no error.'],
      ['Rounding disagreed with the Python service by a cent', 'A double somewhere upstream of the BigDecimal.'],
      ['Two equal amounts compared unequal', 'equals compares scale. Use compareTo for money, or a long.'],
      ['A transaction did not roll back', 'A checked exception and no rollbackFor, or an internal call bypassing the proxy.'],
      ['The connection pool ran out under light load', 'open-in-view left on, holding a connection for the whole request including the response write.'],
      ['The benchmark flattered Java', 'No warm up. The JIT compiles as it runs, so a short run measures the interpreter.'],
      ['The benchmark flattered the network', 'A loopback p99 near 40 ms is delayed acknowledgement, not your code. Measure the handler as well as the request.'],
      ['Virtual threads made it slower', 'The handler does not block. They are for waiting, not for computing.'],
      ['The load test reported a 10,000 ms p99', 'Failures were recorded as a latency. Count them separately and name them.'],
      ['The container restarted with no log line', 'The heap was sized for the host rather than the container limit. MaxRAMPercentage reads the limit.'],
      ['Webhooks vanished on a deploy', 'Claimed work was not released on shutdown. A claimed row is not a pending row, so nothing ever retries it.']
    ]
  },
  19: {
    files: [
      ['`complexity/measure.py`', 'the five comparisons, at three sizes where it matters'],
      ['`problems/`', 'forty files, eight patterns, each with tests and a stated complexity'],
      ['`exercises/api_integration/`', 'timeouts, safe retries, jitter, and the test that counts charges'],
      ['`exercises/bug_hunt/`', 'a one line money bug in unfamiliar code, and how it was found'],
      ['`exercises/feature_addition/`', 'paging added in the conventions already there'],
      ['`exercises/pr_review/`', 'a 68 line diff with ten real problems, and the review of it'],
      ['`tools/check_problems.py`', 'the checker that fails the build when the discipline slips'],
      ['`log/LOG.md`', 'every attempt, and what the empty minutes column means'],
      ['`log/redo.md`', 'the eight that went wrong, grouped by what they have in common'],
      ['`stories/STAR.md`', 'five stories with numbers that can be re-run']
    ],
    run: 'pytest -q && python -m tools.check_problems && python -m complexity.measure',
    design: [
      'The complexity work is measured at three sizes rather than one, because one size cannot tell a constant factor from a change of class. Reconciling two files: 2,000 rows a side took 119.9 ms nested against 0.8 ms indexed, and 8,000 rows took 4,300.6 ms against 4.7 ms. Four times the rows made the nested version 36 times slower, which is worse than quadratic growth predicts, because at 8,000 the inner list no longer fits in cache.',
      'Extrapolation is what makes it land. At 8,000 rows a side the nested version takes 4.3 seconds, and a real settlement file has a million rows, so the quadratic version is around 36 hours while the indexed version stays under a second.',
      'The string concatenation comparison turned out to change kind as it grows: 1.8x at 25,000 lines, 2.5x at 50,000, 11.6x at 100,000 and 21.1x at 200,000. CPython extends a string in place while it holds the only reference, and once the buffer is a few megabytes the allocator cannot, so every append copies. The level text was corrected to match the measurement.',
      'Every problem file carries the same header: problem, pattern, time, space, first instinct and outcome. The first instinct line is the point of the repository, because anybody can paste forty correct solutions and the line saying what you reached for first is what makes it a record of learning.',
      'Eight of the forty went wrong the first time, and the redo list groups them rather than listing them: four were ties or boundaries, two were invariants held wrongly, one was a wrong model rather than a wrong implementation, and one was duplicate handling. The conclusion is to write the boundary test first, which is worth more than any individual fix.',
      'One problem is filed under the wrong pattern on purpose. The level lists grouping payments under sorting and the right answer is a hash map, and recognising that the obvious family is the wrong family is the skill being practised.',
      'The API integration exercise is scored on one test: the fake processor creates the charge and then times out, and the assertion is that the processor ends up with one charge. Asserting that the client retried would prove nothing about the money.',
      'The pull request review exercise has ten problems planted in 68 lines, every one of which would pass review at a company that had not read levels 4 through 17. The review is ordered by what would hurt: irreversible, then wrong money, then leaked data, then privileges, then speed.',
      'The repository checks itself, and the checker has its own lesson attached. Its first version counted any two dates in a redo row, which the "return by" column satisfied on its own, so it reported green while every second attempt was outstanding. A check with a loophole is worse than no check.',
      'What cannot honestly be provided is stated rather than faked. The log has no minutes because these were written rather than attempted under a clock, the second attempts are scheduled and outstanding, and the behavioural stories are drawn from building this course and say plainly that yours have to be yours.'
    ],
    mistakes: [
      ['Three hundred problems solved and still failing screens', 'Breadth without a record. Forty with a log beats three hundred skimmed, because the log is what makes the repetition targeted.'],
      ['The pattern arrives ten minutes in', 'Not enough repetition on the ones you got wrong. That is what the redo list is for, and why it has dates.'],
      ['A memorised solution collapsed on the follow up', 'Memorise the eight patterns and the shape of each, never the solutions.'],
      ['The complexity was recited rather than understood', 'Measure it at three sizes. One size cannot distinguish a constant factor from a class change.'],
      ['The practical exercise was a happy path', 'No timeout, no retry, no failure handling. In payments that is the wrong answer even when it works.'],
      ['The retry made a second payment', 'The idempotency key was generated inside the retry loop rather than once per payment.'],
      ['The behavioural answers had no numbers in them', 'A story with no number is an opinion about yourself. Every one needs a measurement and a change made afterwards.'],
      ['The log looks perfect', 'Then it is not a log. A record with no failures in it is a trophy cabinet and tells you nothing about what to practise.']
    ]
  },
  20: {
    files: [
      ['`platform_/`', 'six services in one process: ledger, vault, queue, bank, gateway, alerts'],
      ['`seed.py`', 'one payment end to end, as the smoke test'],
      ['`bench/load.py`', 'the hour, open loop, goodput, and the sweep that finds where each objective breaks'],
      ['`bench/budget.py`', 'the share of the monthly error budget the hour spent'],
      ['`chaos/scenarios.py`', 'four failures under load, with detection and recovery'],
      ['`migrate/under_load.py`', 'the six deploys from level 17, with traffic on them'],
      ['`recon/daily.py`', 'seven checks across every service that must return zero'],
      ['`recon/measure.py`', 'the reconciliation timed against the quadratic version it replaced'],
      ['`ARCHITECTURE.md`', 'ownership, dependencies, and what happens when each one is gone'],
      ['`decisions/`, `designs/`, `runbooks/`', 'three records, six designs, one runbook per alert'],
      ['`CV.md`, `video/SCRIPT.md`', 'the lines with numbers in them, and the shot list for the video']
    ],
    run: 'python seed.py && python -m bench.load --minutes 60 && python -m bench.budget && python -m chaos.scenarios && python -m migrate.under_load && python -m recon.daily',
    design: [
      'The capstone is assembly and evidence rather than new features, and the one thing it changes about every earlier level is honesty about how it is run: six services in one process, because there is no container runtime on this machine. What carries across is the logic, the ordering and the reconciliation. What does not is serialisation, connection pools and an orchestrator killing a process mid lock, and the decision record lists all of it rather than leaving a reader to find out.',
      'Capacity was estimated before anything was measured, so the measurements had something to disagree with: 50 payments a second is 130 million a month and about 2.3 TB a year, which fits on one Postgres, so nothing here is sharded and the architecture document says why.',
      'The hour is the headline and the budget arithmetic is what makes it mean anything: 180,001 payments offered at 50 a second, all accepted, a p99 of 6.4 ms against a 500 ms objective and not one request outside it, so the run spent 0.0000% of a monthly error budget it had every right to spend 0.139% of. The reconciliation afterwards checked 1,261,757 facts and returned zero breaks.',
      'The budget arithmetic is its own module over the report file rather than part of the bench, so the share of the monthly budget can be recomputed against a report that already exists instead of by spending another hour. The targets it divides by are the level 16 objectives, written before any of this ran, which is the order that makes the answer mean anything.',
      'The sweep is the result worth arguing with, because the objective that breaks is not the one a capacity plan usually quotes. From 500 to 8,000 payments a second offered, the p99 stayed inside the 500 ms objective at every rate, and the payout backlog grew from the very first one: 2,734 payouts still waiting at 500 a second, 69,865 at 8,000. A payments platform has two capacities and only one of them belongs to the API, which is why freshness is its own objective.',
      'That finding comes with an artefact worth separating out: the payout worker is a thread in the same process as the load generator, so it competes for one interpreter lock and its ceiling here is a few hundred payouts a second rather than a real worker thousands. The shape is right and the number is not transferable, and it is stated next to the number rather than in a footnote.',
      'The load test measures from the moment each request was due rather than from when it started, which is the fix for coordinated omission: timing from the start hides exactly the requests a struggling system has not reached yet, and the first version of this bench reported a healthy p99 during an overload for that reason. It also sets the Windows timer to 1 ms, because a default 15.6 ms sleep granularity means an open loop generator asking for 500 arrivals a second gets about 64 and measures its own clock.',
      'The chaos runner found a money bug in the capstone own payout worker, which is the argument for running the thing rather than reading it: the bank was called before the ledger entry could be written, so during the database outage one payout in four hundred was paid with nothing recorded and nothing that would ever resolve it. The rule now is to refuse to call the bank when the record cannot be written, and to mark the payout unknown rather than pending if the record fails after the money has moved, because unknown is the state the sweeper resolves.',
      'Each of the four failures records what fired, the time to detection and the time to recovery, and the assertion under each one is about the money rather than about the alert: 200 of 200 payments refused with zero recorded during the database loss, every timed out payout resolved by asking the bank about a reference that predates the first attempt, 700 events queued and none lost, 60 of 60 refused with the dependency named. Reconciliation returns zero after every one.',
      'The migration is the six deploys from level 17 with traffic on them, which that level could not do: 1,170 requests across the sequence, zero failed, and at step 4 both code versions read 500 sampled rows with zero disagreements, which is the evidence that a rollback there is a plain revert rather than a data recovery.',
      'The reconciliation was quadratic and the capstone own load test is what found it, by getting slower at every rate. One pass to index the ledger by reference replaced a scan per payment: 24,061.8 ms against 26.1 ms at 8,000 payments. The 923 times is not the interesting number, the ratio growing from 201 times at 2,000 payments is, because that is what quadratic looks like from outside. `recon/measure.py` re-runs the comparison at several sizes and asserts that both versions count the same transactions, so the ratio is reproducible rather than remembered.',
      'What could not be done is listed rather than implied: the compose file is written and has never been run, the video is a script rather than a recording, and this lives as a solution folder rather than as its own public repository. Each of those is one line in the README, in the place where somebody would otherwise assume the opposite.'
    ],
    mistakes: [
      ['Services would not run together', 'Hard coded ports, database names and paths. That is the exercise rather than an obstacle.'],
      ['The load test looked fine and production would not', 'Closed loop generation, or no warm up. Both measure something other than overload.'],
      ['The load test measured its own sleep', 'A 15.6 ms timer granularity against a 2 ms interval. Set the timer, then spin the last stretch.'],
      ['A healthy p99 during an obvious overload', 'Latency timed from when the request started rather than from when it was due.'],
      ['One payout in four hundred paid with no record of it', 'The bank was called before the ledger write, and the write failed. Refuse the call instead, and use unknown rather than pending when the money has already moved.'],
      ['The chaos report said zero unknown payouts', 'The peak was read after everything had settled. Sample it inside the loop.'],
      ['The worker reported a thousand attempts on one payment', 'A payout put back on the queue and popped again in the same pass. Break out when the ledger is unavailable.'],
      ['The reconciliation got slower at every rate', 'A ledger scan per payment. Index once, then look up.'],
      ['20,902 facts checked on four payments', 'A count summed with an amount in minor units. Keep counts and money in separate dictionaries.'],
      ['Chaos passed but reconciliation did not', 'The right outcome to find in a rehearsal. Money moving twice shows up here and nowhere else.'],
      ['The README opened with installation instructions', 'Ninety seconds. Diagram, sentence, five results.'],
      ['A number could not be reproduced when asked', 'One undefendable number undoes all the others. Delete it or make it runnable.']
    ]
  }
,
  101: {
    files: [['`check_setup.py`', 'five checks on the lab, with the fix printed next to anything missing']],
    run: 'python check_setup.py',
    design: [
      'There is no build at level 1 on purpose. An evening lost to installers is the most common reason somebody stops before writing anything that works, and a finance reader who has never opened a terminal has more ways to lose that evening than a computer science one.',
      'The checker reports rather than raises, and it keeps going after a failure. One run tells you everything that is wrong with the lab, which is the difference between one evening of setup and four.',
      'Each library is listed with what it is for in the words the track uses, so a missing one explains itself: matplotlib is "the charts in levels 3 and 5" rather than a name. The fix is printed underneath it.',
      'The data check reads the same URL every level reads, so it proves the thing that actually matters: not that pandas imports, but that this machine, on this network, can get the course data. A proxy that blocks raw.githubusercontent.com is a problem worth meeting now rather than in the middle of level 2.',
      'An --offline flag skips the download and checks everything else, because a blocked network should not stop somebody confirming their Python works.',
      'The exit code is 1 when anything failed, so the script is useful to a person and to anything that runs it for them.'
    ],
    mistakes: [
      ['python is not found on Windows', 'The installer\'s "Add python.exe to PATH" box was not ticked. Re-run it, choose Modify, tick it.'],
      ['python works but pip does not', 'On macOS and some Linux installs the commands are python3 and pip3.'],
      ['The course data will not load', 'A corporate proxy blocking raw.githubusercontent.com. Download the file and drag it into Colab, or use a personal machine.'],
      ['A variable that worked yesterday is undefined', 'A notebook keeps its text and not its memory. Run the cells again, in order.'],
      ['The first list item is missing', 'Python counts from zero: it is rows[0], not rows[1].'],
      ['An error wall of red stops everything', 'Read the last line first. It names the problem; the lines above it are only the path that reached it.']
    ]
  },
  102: {
    files: [
      ['`query-pack/load.py`', 'six CSVs into one SQLite file, keys checked, amounts repaired at the boundary'],
      ['`query-pack/queries.sql`', 'ten named queries, each with its question and the answer it gave'],
      ['`query-pack/run_queries.py`', 'runs them all, and --verify checks eight recorded answers']
    ],
    run: 'python load.py --check && python run_queries.py --verify',
    design: [
      'Every query carries the question it answers and the answer it gave at the September close, which turns the file into its own regression test. `--verify` checks eight of them mechanically and exits non zero if a closed month has moved, because a closed month moving is either a restatement nobody mentioned or a bug in the load.',
      'The verifier earned its place on the first run by failing twice. The tie out was 700,200 wrong in April, because one credit in the export is written in accounting brackets, SQLite stored it as text, and SUM treated it as zero with no error anywhere. The fix is in the loader rather than in the query, because a repair inside one query leaves the other nine wrong.',
      'The second failure was a rounding difference: four buckets each rounded to the dollar sum to a dollar more than the unrounded total. That one is a tolerance in the check with a comment saying so, and the tie out has no tolerance and never will, because a rounding allowance on a reconciliation is where the next real break hides.',
      'Keys are checked at load rather than assumed in ten queries. A duplicate in a lookup table multiplies revenue through every join with no error at all, so `load.py` refuses to finish if invoice_id or customer_id is not unique.',
      'Revenue is grouped on the revenue month rather than the invoice date. The company bills in arrears, so September usage is invoiced on 1 October, and grouping on issued_date returns 3,106,395 for September, which is August. Both queries are valid SQL and only one answers the question.',
      'The merchants with no invoice are found with a left join and kept, because five merchants signed in October and have not been billed yet. The difference between 235 merchants and 230 billed is the kind of number that ends up in a board pack, and an inner join would have hidden it.',
      'The database is SQLite because it needs nothing installed, which is what makes this runnable on the laptop a finance analyst already has. Every query is standard SQL apart from two date expressions, and the file carries the PostgreSQL form next to each.'
    ],
    mistakes: [
      ['Revenue by month is a month behind the ledger', 'Grouped on the invoice date rather than the revenue month. Nothing raises, and the annual total is nearly right.'],
      ['Revenue is exactly double', 'A join to a lookup table whose key is not unique. Count rows against count distinct before trusting any join.'],
      ['A WHERE on the right hand table turns a left join into an inner one', 'The unmatched rows have NULL there and fail the comparison. Put the condition in the ON clause.'],
      ['The average of the segment averages is 27% above the true mean', 'Averaging averages weights forty enterprise invoices the same as eighty seven small ones.'],
      ['Unpaid invoices are missing from the result', 'WHERE paid_date != something drops NULLs. Only IS NULL tests them.'],
      ['SUM returns a number that is far too low', 'A text value in a numeric column. SQLite treats it as zero rather than raising.']
    ]
  },
  103: {
    files: [
      ['`close-pack/closepack/load.py`', 'the three repairs, reported rather than silent, and the sign rule once'],
      ['`close-pack/closepack/checks.py`', 'the gates, split into fatal and worth saying'],
      ['`close-pack/closepack/pack.py`', 'the pack, the tie check, and the exit code'],
      ['`close-pack/closepack/bridge.py`', 'price and volume, with the rounding difference returned rather than hidden'],
      ['`close-pack/closepack/report.py`', 'the waterfall chart and the draft memo with its TODOs'],
      ['`close-pack/tests/test_pack.py`', '15 tests, including one that breaks the pack to prove the check works']
    ],
    run: 'python -m closepack.pack && python -m closepack.report && pytest -q',
    design: [
      'The argument for the script is not speed. The pack takes 39 ms here and about two seconds of the command is importing pandas, and once a month neither number matters. What matters is that the month is an argument, the checks run every time, and the thing can refuse: a spreadsheet cannot decline to show you a number.',
      'Everything ugly about the export is dealt with in the loader and reported: 317 rows after removing one duplicate journal, two text amounts repaired, one label trimmed. Silently cleaning an export means your pack disagrees with the file the accountant is looking at and neither of you knows why.',
      'The gates split into fatal and warning, and the split is a judgement about money. An unmapped account code means money in the ledger that appears nowhere in the pack, so the run stops. A cost centre budgeted with no actuals leaves the pack correct and needs a sentence. A gate that cries wolf is switched off within two months, and then the real one is off too.',
      'The check cell became an exit code, which is the part a spreadsheet cannot do. A scheduler or a colleague can act on a non zero exit without reading the output, and `test_the_check_catches_a_dropped_pack_line` removes a line from the layout on purpose and asserts the check complains.',
      'The generated memo leaves every cause as the word TODO. The script knows marketing is 210,000 over and cannot know that the campaign moved, and a tool that invents the reason is worse than no tool. What it does guarantee is that no material variance is ever missing from the list, which is what a person writing at 7pm gets wrong.',
      'A test caught a number in the output that was wrong by a factor of 159: the loader reported 318 text amounts repaired out of 318 rows, because one text value makes the whole pandas column an object and the count was measuring the dtype rather than the data. The fix measures what a plain conversion would have thrown away, which is two.',
      'The merge trap has its own test. A lookup table that gains one duplicate row raises revenue by a third with no error and no warning, and the habit that prevents it is one assertion or `validate="many_to_one"` on every merge against a lookup.'
    ],
    mistakes: [
      ['A sum silently skips rows', 'One text value makes the whole column an object dtype. Convert at the boundary and count what needed converting.'],
      ['Revenue is a third higher after a merge', 'A one to many join you thought was one to one. Use validate="many_to_one" and it raises instead.'],
      ['The pack is missing a line and still ties', 'The check compared the pack to itself. Build the two sides by different routes.'],
      ['The warnings scroll past unread', 'Too many things marked fatal, or too few. Decide the split on whether the pack would be wrong.'],
      ['An account code with a leading zero stops matching', 'pandas read it as an integer. Pass dtype={"account_code": str}.'],
      ['The generated memo says something untrue', 'A script that writes causes is guessing. Leave TODO and let the person fill it in.']
    ]
  },
  104: {
    files: [
      ['`three-statement/model/drivers.py`', 'every assumption with its source, and the judgements marked'],
      ['`three-statement/model/forecast.py`', 'fifteen months, three statements, the revolver and its circular reference'],
      ['`three-statement/model/sensitivity.py`', 'twenty models as one table, and when each case draws on the facility'],
      ['`three-statement/tests/test_model.py`', '14 tests, mostly identities rather than values']
    ],
    run: 'python -m model.forecast && python -m model.forecast --scenario stress && python -m model.sensitivity && pytest -q',
    design: [
      'Cash is an output. It is the closing line of the cash flow statement, and a test asserts that in every month of every scenario, which is the difference between a model and a spreadsheet of hopes. Sixty forecast months balance to the cent with no plug anywhere.',
      'Revenue is driven from volume, take rate, merchants and platform fee rather than grown as a percentage of a total. That decomposes, so a miss can be attributed to volume or to price, and it is arguable: a sales director can disagree with 2.15% monthly volume growth, which is a useful conversation, where disagreeing with "revenue grows 26% a year" is not.',
      'Costs are modelled by behaviour rather than as percentages of revenue: scheme fees vary with volume, hosting follows its own trend, payroll steps with hiring, marketing is a decision. That is what lets the base case show EBITDA margin rising from 7.9% to 19.3%, which a percentage of revenue model cannot produce, and what lets the stress case take it to 1.2% without a single dramatic event.',
      'Every driver carries the evidence it came from and three of them are marked as judgements rather than measurements. A test fails if any driver has a blank source. A model that cannot separate its facts from its opinions gets believed more than it deserves, and the first question in any review is where a number came from.',
      'Scenarios are multiples of one base case rather than four saved copies. Correct a measured driver and all four move together, and the only difference between them stays the thing being varied. Four files drift apart in the second month and then nobody can say whether a difference is the assumption or the drift.',
      'The revolver creates the circular reference every real model has: a draw costs interest, interest costs cash, less cash means a bigger draw. It is resolved by iteration with the pass count reported, five in the stress case, and two tests: that it converges rather than hitting the cap, and that it iterates at all, because a scenario that never draws proves nothing about the mechanism.',
      'The sensitivity table exists to settle an argument rather than to widen a range. Sixteen basis points of take rate moves FY2026 EBITDA more than three and a half points of monthly volume growth, and the company argues about volume in every sales meeting and about pricing almost never.'
    ],
    mistakes: [
      ['The balance sheet is out by a small amount', 'In order: a cash flow line missing from the balance sheet, depreciation on the closing balance, a working capital movement using the balance rather than the change, net income not reaching retained earnings.'],
      ['Cash was forecast directly', 'Then the balance sheet only balances by plug. Cash is the closing line of the cash flow.'],
      ['Depreciation is 2% out every month', 'It was calculated on the closing fixed assets, which depend on depreciation. Use the opening balance.'],
      ['A profitable forecast runs out of cash', 'Growth consumes working capital. Receivables grow with revenue, and the faster you grow the more you lend your customers.'],
      ['The model hit its iteration cap', 'The circular calculation did not converge, and any number it shows is meaningless. Excel shows a stale one instead.'],
      ['Every scenario looks the same', 'They were built by copying the file. Build them as multiples of one base so a corrected driver moves all of them.']
    ]
  },
  105: {
    files: [
      ['`monthly-close/close/stages.py`', 'the six stages, each timed, each with a verdict'],
      ['`monthly-close/close/run.py`', 'the plan, the stopping, and the exit code'],
      ['`monthly-close/close/document.py`', 'the pack in reading order, with the causes left to a person'],
      ['`monthly-close/close/_earlier.py`', 'levels 3 and 4 imported rather than copied, and honest about how'],
      ['`monthly-close/tests/test_close.py`', '9 tests, most of them about stopping rather than running']
    ],
    run: 'python -m close.run && pytest -q',
    design: [
      'Six stages, 258 ms, one document, and an exit code. The exit code is the point: a close that can say "do not send this" is a different thing from a spreadsheet that can only be wrong quietly. The whole command takes about 4.4 seconds, nearly all of it importing pandas and matplotlib.',
      'A stage has two booleans rather than one. `ok` is whether there is anything to say and `fatal` is whether the close can continue, and the design of the pipeline lives in the gap between them. The reconciliation break is not ok and not fatal, which is the state most pipelines leave out.',
      'That distinction is tested. The reconciliation finds one month out by 4,820, which is one credit note raised in billing and never posted, and the test asserts both that it reports the break and that it does not stop the close. Treat every difference as fatal and somebody adds a flag to skip the checks; treat none as fatal and a wrong pack goes out with a warning nobody read.',
      'The earlier levels are imported rather than copied, and `_earlier.py` says in its own docstring that putting sibling folders on sys.path is a compromise for a repository that would otherwise have them as one package. Two copies of the same logic drift apart from the first bug fix onwards, and then the monthly pack and the quarterly pack disagree.',
      'The database is deleted and rebuilt on every run, so nothing survives between closes. A reporting database that accumulates state is one where last month bad row lives forever, and a close has to be reproducible from the source files alone.',
      'The document is written in reading order rather than computation order: five numbers, what moved, the detail, what has not been collected, whether billing agrees, what it means for next year, and a footer naming the command and the tie. Writing it in the order the pipeline computed is the most common way a technically correct pack goes unread.',
      'The strongest test is the one about stopping. A forced failure in stage two is asserted to stop every later stage and to write nothing at all, because a pipeline that stops after writing half a pack has not stopped in any useful sense.'
    ],
    mistakes: [
      ['The close never finishes', 'Every difference was made fatal. A break with an owner belongs in the commentary, not in a refusal.'],
      ['A wrong pack went out with a warning', 'Nothing was fatal. The test is whether the output would be wrong, not how big the number is.'],
      ['The pipeline stopped and half a pack was written', 'Write outputs only after every stage has passed, and assert the absence of the file in the test.'],
      ['Two packs disagree', 'The logic was copied between folders and then fixed in one of them.'],
      ['Last month bad row is still in the database', 'The load appended instead of rebuilding. Delete and rebuild every run.'],
      ['The pack is questioned every month', 'No provenance. Name the command, the files and the tie difference in the footer.']
    ]
  }
};


/* Where a level's solution lives. The curriculum says so itself, in the brief's
   solutionPath, because a second track does not number its folders level-NN. */
function solutionDir(lv) {
  const brief = lv.project || lv.setup || {};
  if (brief.solutionPath) return brief.solutionPath;
  return `solutions/level-${String(lv.id).padStart(2, '0')}`;
}

/* The number and the track a reader sees, rather than the global id. */
function levelLabel(lv, all) {
  const inTrack = all.filter((l) => (l.track || 'eng') === (lv.track || 'eng'));
  /* An aside is numbered 10.1 and is not one of the twenty, so it must not
     make every other footer say "of 21". */
  const spine = inTrack.filter((l) => !l.aside);
  const position = lv.position || spine.indexOf(lv) + 1;
  /* The numbered ladder: a whole number position. Level 18 is on it and
     optional at the same time, so it is counted here and still described as an
     aside below. */
  const onLadder = (l) => {
    const n = Number(l.position ?? 0);
    return !Number.isNaN(n) && Number.isInteger(n);
  };
  const count = inTrack.filter((l) => l.position === undefined || onLadder(l)).length;
  return {
    position, count,
    track: lv.track || 'eng',
    aside: !!lv.aside,
    onLadder: lv.position === undefined || onLadder(lv),
  };
}

/* ------------------------------------------------------------------ build */
const skipped = [];
for (const lv of levels) {
  const at = levelLabel(lv, levels);
  const id = String(at.position).padStart(2, '0');
  /* The engineering levels have been numbered 1 to 20 in print since the
     course had ten, so they keep their unpadded id. A second track counts
     from one within itself. */
  const shown = at.track === 'eng' ? String(lv.id) : id;
  const dir = path.join(root, solutionDir(lv));
  fs.mkdirSync(dir, { recursive: true });
  const note = NOTES[lv.id];
  /* A level whose solution has not been written yet is named rather than
     crashed on, so the rest of the course still builds while a track is in
     progress. The count at the bottom says how many are missing. */
  if (!note) {
    skipped.push(lv.id);
    continue;
  }
  const brief = lv.project || lv.setup;
  const requirements = lv.project ? lv.project.requirements : lv.setup.checklist;

  const L = [];
  L.push(`# Level ${shown}: ${lv.title}`);
  L.push('');
  L.push(`> **${brief.title}** · ${lv.project ? 'build project' : 'setup mission'} · difficulty ${lv.difficulty}/10`);
  L.push('');
  L.push('## Read this second');
  L.push('');
  L.push('Attempt the build yourself first, then ask the FinQuest tutor for a hint, and only then open this folder.');
  L.push('Read the part you are stuck on, close the file, and retype the fix from memory. Copying the solution into');
  L.push('your own project skips the only step that actually teaches you anything.');
  L.push('');
  L.push('## The brief');
  L.push('');
  L.push(brief.story.replace(/\*\*/g, '**'));
  if (lv.project) {
    L.push('');
    L.push(`**Scope:** ${lv.project.scope}`);
  }
  L.push('');
  L.push('## Files here');
  L.push('');
  L.push('| File | What it is |');
  L.push('|------|------------|');
  for (const [file, desc] of note.files) L.push(`| ${file} | ${desc} |`);
  L.push('| `quiz-key.md` | all 15 drill answers with explanations |');
  L.push('');
  L.push('## Run it');
  L.push('');
  L.push('```bash');
  L.push(note.run);
  L.push('```');
  L.push('');
  L.push('## Why the solution is shaped this way');
  L.push('');
  for (const point of note.design) L.push(`- ${point}`);
  L.push('');
  L.push('## Where people get stuck');
  L.push('');
  L.push('| Symptom | Cause |');
  L.push('|---------|-------|');
  for (const [symptom, cause] of note.mistakes) L.push(`| ${symptom} | ${cause} |`);
  L.push('');
  if (lv.project) {
    L.push('## Self-checks the solution satisfies');
    L.push('');
    for (const t of lv.project.tests) L.push(`- ${t.replace(/\{\{RAW\}\}/g, '<repo>/data')}`);
    L.push('');
    L.push('## How it is marked');
    L.push('');
    L.push('| Points | Criterion | Meaning |');
    L.push('|--------|-----------|---------|');
    for (const r of lv.project.rubric) L.push(`| ${r.pts} | ${r.t} | ${r.d} |`);
  } else {
    L.push('## The checklist');
    L.push('');
    for (const item of requirements) L.push(`- [ ] ${item}`);
  }
  L.push('');
  L.push('---');
  L.push('');
  const where = at.track === 'eng' ? '' : 'Analyst track, ';
  L.push(at.onLadder
    ? `Part of [FinQuest](../../README.md) · ${where}Level ${shown} of ${at.count}`
    : `Part of [FinQuest](../../README.md) · ${where}Level ${shown}`);
  L.push('');

  fs.writeFileSync(path.join(dir, 'README.md'), L.join('\n'), 'utf8');
  console.log(`${solutionDir(lv)}/README.md`);
}
if (skipped.length) {
  console.log(`
no teaching notes yet for level(s) ${skipped.join(', ')}, so their README was not written`);
}
console.log('\ndone');
