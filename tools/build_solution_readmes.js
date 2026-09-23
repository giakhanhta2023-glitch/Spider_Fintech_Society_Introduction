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
  .filter((f) => /^level-\d+\.js$/.test(f))
  .sort();
for (const name of levelFiles) {
  const file = path.join(root, 'content', 'levels', name);
  new Function('FQ', fs.readFileSync(file, 'utf8'))({ registerLevel: (lv) => levels.push(lv) });
}
levels.sort((a, b) => a.id - b.id);

/* ------------------------------------------------------------------ notes */
const NOTES = {
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
    files: [['`ledger.py`', 'the ledger, the exceptions, eight test groups, and a worked demo']],
    run: 'python ledger.py',
    design: [
      '`_post` is the only method that appends, and it refuses anything that does not sum to zero. Every public method funnels through it, so the invariant cannot be bypassed by accident.',
      'Validation happens **before** any write. A refused transfer leaves `len(entries)` unchanged: the tests assert exactly that, because a half-written transaction is worse than a rejected one.',
      'The idempotency key is stored **after** a successful post. Storing it first would make a failed attempt permanently "already done".',
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
      'The acceptance test is the load generator: the full migration runs under continuous traffic and the report states failures and p99 latency, before and during.'
    ],
    mistakes: [
      ['The endpoint got slower after partitioning', 'It does not filter on the partition key, so it scans every partition and pays the planning cost too.'],
      ['Inserts failed at midnight on the first', 'Nobody created next month partition. Automate it and alert when fewer than two future months exist.'],
      ['A one second migration took the site down for four minutes', 'It queued behind a long reader, and everything else queued behind it. lock_timeout prevents this.'],
      ['The backfill died at hour five and undid everything', 'One transaction instead of batches. Atomicity across the whole job is not the property you need.'],
      ['Each backfill batch was slower than the last', 'offset, which counts through every skipped row. Walk the primary key instead.'],
      ['A refund vanished after the page reloaded', 'The read went to a replica that had not caught up. Read your own writes goes to the primary.']
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
      ['`vault/tokens.py`', 'random tokens, the mapping, BIN and last four as separate fields'],
      ['`vault/rotate.py`', 'rewrap data keys, two versions live, retire the old one'],
      ['`api/auth.py`', 'OAuth2 client credentials, and verification done fully'],
      ['`api/webhooks.py`', 'sign, verify, rotate the secret, reject replays'],
      ['`obs/logging.py`', 'an allowlist, plus the test that fails when a PAN leaks']
    ],
    run: 'python -m vault.bench && pytest -q tests/test_no_pan_in_logs.py tests/test_forgery.py',
    design: [
      'The threat model is written first and everything else refers to it. The section that gets read is the one naming what is deliberately not defended, because it tells a reviewer where to look.',
      'Envelope encryption is justified with arithmetic rather than habit. Encrypting 20,000 card numbers with one key service call each is 20,000 calls and 160 seconds; with data keys it is 200 calls and 1.7 seconds.',
      'Local cryptography turns out not to be the cost at all: AES-256-GCM encrypted a card number in 2.8 microseconds, which is 358,539 a second on one core. The 8 ms network call is a thousand times more expensive, and the design exists to make fewer of them.',
      'Rotation is the part that separates reading about envelopes from having done it. Rewrapping 200 data keys took 1 ms. Re-encrypting 20,000 records took 127 ms of cryptography plus a rewrite of every row, which is the level 13 backfill with all of its locks and log volume.',
      'Tokens are random and mean nothing. The scope table is the deliverable: seven components that could see a card number became one, and every audit of the other six stops being necessary.',
      'Token verification is costed because it sits on the hot path: HS256 79.9 us, RS256 141.5 us, ES256 239.7 us per verification, which is 8%, 14% and 24% of a core at a thousand requests per second. Verifying RSA is cheaper than verifying an elliptic curve, which surprises most people.',
      'The timing attack on `==` could not be reproduced: 112.7 ns when the secret differed at the first byte against 98.5 ns at the last, with the sign the wrong way round. compare_digest costs 60 ns more and is used anyway, because it is free and it removes a dependency on an implementation detail. The failed reproduction is reported rather than hidden.'
    ],
    mistakes: [
      ['A valid token let a caller do the wrong thing', 'Authentication checked, authorisation not. A signature proves who, never what they may do.'],
      ['A token from another service was accepted', 'No audience check. Every token says what it is for.'],
      ['An attacker signed their own token', 'The algorithm was read from the token. Pin it in the code, always.'],
      ['Rotation meant rewriting every card row', 'Data keys not used, so the master key is encrypting records directly.'],
      ['A ciphertext was moved between rows and still decrypted', 'No context bound into the additional authenticated data.'],
      ['A card number appeared in the logs', 'A denylist of fields to redact. Allowlist what may be logged, and test it.'],
      ['The audit log had a gap', 'The application role could delete from it, so it was never an audit log.']
    ]
  },
  16: {
    files: [
      ['`obs/logging.py`', 'JSON events, stable names, a request id from context'],
      ['`obs/metrics.py`', 'RED metrics, and the test that enforces the series budget'],
      ['`obs/tracing.py`', 'propagation across services and across the queue'],
      ['`slo/OBJECTIVES.md`', 'SLI, target, window, budget in minutes, and the policy'],
      ['`slo/burn_rate.yml`', 'the multiwindow rules'],
      ['`slo/replay.py`', 'a month of traffic, and the pages each rule would have produced'],
      ['`runbooks/`', 'one per alert, dated, and checked by a test'],
      ['`POSTMORTEM.md`', 'written after the game day, with owned actions']
    ],
    run: 'docker compose up -d && python -m slo.replay && pytest -q tests/test_cardinality.py',
    design: [
      'The three signals are used for what each is good at: metrics say something is wrong, traces say where, logs say why. The request id is generated at the edge and reaches every log line and every span, because reconstructing one request is the only thing logs do better than anything else.',
      'Cardinality is budgeted rather than hoped for. Measured on one counter: 100 series cost 0.2 MB and a 3.1 ms scrape; adding merchant_id with 500 values took it to 200,000 series, 243.6 MB and an 8,025.9 ms scrape, against a 15 second scrape interval. Monitoring becomes the outage, and the pull request that does it looks reasonable.',
      'Percentiles are aggregated by summing histogram buckets, never by averaging quantiles. With ten instances and one of them three times slower, the true p99 was 393.4 ms, the average of the instance p99s was 361.6 ms, and the maximum across instances was 906.2 ms. The average hid exactly the thing the dashboard exists to show.',
      'Buckets come from the measured distribution. Prometheus defaults reported a p99 of 450.1 ms when the exact value was 301.5 ms, a 49.3% error produced entirely by the gap between the 250 ms and 500 ms edges. Tuned buckets brought it to 1.6%.',
      'The SLO document is a page and the budget is a decision rule: 99.9% over 30 days is 43 minutes 12 seconds, and below a quarter of it remaining, feature work pauses. 4xx responses are excluded from the SLI on purpose, and the sentence saying why is in the document.',
      'Alerting is replayed rather than argued about. Over a simulated month with two incidents and two harmless blips: a threshold on error rate paged 4 times with 2 false pages; multiwindow burn rate paged twice with none, and detected the 35% incident in 2 minutes and the 8% one in 10, which is severity scaling nobody had to configure.',
      'The uncomfortable number from the same month: the two incidents were only 42% of all errors. The other 58% came from a quiet 0.05% background rate that never crossed a threshold and never woke anybody, and it was spending most of the budget.'
    ],
    mistakes: [
      ['A scrape started timing out', 'A high cardinality label. Series count is the product across labels, and it never comes back down.'],
      ['The latency dashboard was wrong by half', 'Default histogram buckets. The p99 landed in a bucket 250 ms wide and the interpolation was a guess.'],
      ['One broken instance was invisible', 'Instance p99s were averaged. Sum the buckets, and also graph the maximum.'],
      ['The trace stopped at the queue', 'Context has to travel inside the message, not in a header.'],
      ['Sampling threw away the incident', 'Head sampling keeps 1% of errors at 1%. Tail sampling keeps all of them.'],
      ['Nobody reacts to the pager any more', 'It has been paging for causes and for blips. Page for symptoms tied to an objective, and delete the rest.'],
      ['The postmortem blamed a person', 'Ask what made the wrong action look right. That question has a fix attached; blame does not.']
    ]
  },
  17: {
    files: [
      ['`engine/optimise.py`', 'max_sharpe, min_variance and risk_parity, all with bounds'],
      ['`engine/decompose.py`', 'marginal and total risk contributions'],
      ['`engine/var.py`', 'historical, parametric, monte carlo and expected shortfall'],
      ['`engine/backtest.py`', 'exception counting, with the dates so clustering shows'],
      ['`engine/rebalance.py`', 'the no trade band and the turnover it produces']
    ],
    run: 'pip install -r requirements.txt && pytest -q && python -m engine.report',
    design: [
      'The unconstrained solution is printed rather than hidden. A weight of -92.5% for five hundredths of Sharpe is the most persuasive argument for constraints anybody will ever see, and it disappears if only the summary statistics are shown.',
      'Risk contributions are reported next to the weights in the same table. Equal money giving one asset 62.7% of the risk is a fact a committee can act on, and it is invisible in a weights column.',
      'Three VaR methods rather than one, with the excess kurtosis printed beside them. On this synthetic data the three agree because the returns are nearly normal, and saying so is the honest version of a result that would not hold on real returns.',
      'The exception backtest lists the dates of the breaches. The count says whether the model is wrong; the pattern says whether it is the distribution or the volatility estimate.',
      'Rebalancing uses a no trade band and reports turnover, so the allocation is costed through the level 16 engine rather than assumed to be free.'
    ],
    mistakes: [
      ['Weights do not sum to one', 'The equality constraint is missing or the solver failed. Check the status, and assert the sum in a test.'],
      ['Risk parity will not converge', 'Bound the weights away from zero. A contribution divided by a weight of zero is undefined and the optimiser wanders.'],
      ['VaR looks too good', 'Check the sign convention and the tail. A 95% VaR is a loss, so it should be negative, and it should be breached about once a fortnight.']
    ]
  },

  18: {
    files: [
      ['`fakebank/`', 'a tiny authorization server plus a transactions endpoint, so the flow is real code'],
      ['`aggregator/oauth.py`', 'pkce, state, the code exchange, and a refresh that takes a lock'],
      ['`aggregator/normalise.py`', 'from_bank_a, from_bank_b, from_bank_c, and the one Txn type they all produce'],
      ['`aggregator/ingest.py`', 'fingerprinting, the pending to booked collapse, and the sync cursor'],
      ['`aggregator/categorise.py`', 'the cleaner, the rules table, and the correction chain']
    ],
    run: 'pip install -r requirements.txt && pytest -q && uvicorn main:app --reload',
    design: [
      'The verifier and the pending state live server side, keyed by the state value, and the callback consumes them. A state that is unknown or already used is a fatal error rather than a warning, because both cases mean somebody sent the user a link you did not generate.',
      'The refresh path reads the connection twice: once outside the lock to skip the common case, once inside it because another worker may have already refreshed. A hundred workers cost one refresh.',
      'invalid_grant is handled as a product event. The connection is marked as needing consent, the sync stops, and the app shows which bank to reconnect. Nothing retries, because nothing can succeed.',
      'One normaliser per bank, and nothing outside those three functions sees a bank specific field. Each has a test holding a real row from the shipped file and the exact Txn it must become, so a format change fails in one place with a readable diff.',
      'The raw record is stored beside the normalised one. Every parse is a guess, and keeping the original is the difference between fixing a bug and asking every customer to reconnect.',
      'Fingerprints carry a counter within account, date, amount and description, so a re-sync deduplicates and two identical coffees on one day both survive. 157 raw rows become 140 transactions, and running it again still produces 140.',
      'The sync window overlaps by two days on purpose. Deduplication makes the overlap free, and without it a backdated transaction is never seen again.',
      'Categorisation cleans first, matches rules second, and only then reaches a model. The fallback chain ends in uncategorised, which is a better answer than a confident wrong one.'
    ],
    mistakes: [
      ['Every sync inserts everything again', 'The fingerprint includes something that changes between exports, usually a row number or an ingestion timestamp. Hash only what the bank actually sends.'],
      ['Real transactions disappear', 'The fingerprint has no counter, so two identical purchases on one day collapse into one. Number them in order of appearance.'],
      ['Spending is positive for one bank', 'The sign convention differs per bank: a negative amount, an indicator field, and a column position. Normalise all three to negative for money out and test it.'],
      ['A refresh token shows up in a log line', 'Something logged the whole connection row or the whole exception. Log the connection id, and add the test that captures log output during a full flow.']
    ]
  },

  19: {
    files: [
      ['`monitor/names.py`', 'normalise, jaro and jaro_winkler, written by hand and checked against a library'],
      ['`monitor/screen.py`', 'alias expansion, scoring on distinct names, the threshold sweep'],
      ['`monitor/identify.py`', 'secondary identifiers, discounting on disagreement only'],
      ['`monitor/rules.py`', 'structuring, pass through, and the corridor rule that finds nothing'],
      ['`monitor/queue.py`', 'the alert table, the append only event table, and the triage CLI']
    ],
    run: 'pip install -r requirements.txt && pytest -q && python -m monitor.report',
    design: [
      'Aliases are expanded before anything else. Sixty entities are ninety five searchable strings, and screening the primary name alone loses hits without ever saying so.',
      'Normalisation is four separate rules with a test each: case folding, punctuation, titles and token order. Together they recover five of the seven planted hits, which is the cheapest part of the whole system.',
      'Jaro-Winkler is implemented rather than imported, then checked against rapidfuzz on a hundred pairs. Choosing between 0.95 and 0.97 is a judgement about the algorithm, and it is not a judgement you can make about a black box.',
      'The threshold sweep is printed by the code and pasted nowhere. At 0.95 the queue is 182 payments and all seven hits are found; at 0.85 it is 7,081 and still seven; at 1.00 it is five alerts and two designated parties were paid.',
      'Secondary identifiers discount on disagreement and never on absence, and every discount is stored with its reason rather than dropped. A missing date of birth is not evidence of innocence.',
      'The structuring rule is reported at two deposits and at three, 16 alerts against 4, so the tuning decision appears in the output rather than in a conversation nobody wrote down.',
      'The corridor rule ships even though it finds nothing: 514 alerts, no real cases. A negative result that costs an analyst a year is worth writing down.',
      'Alerts store the rule version in force when they fired, and closing one appends an event. An alert from March has to stay explainable after April changed the thresholds.'
    ],
    mistakes: [
      ['The sweep numbers are slightly off', 'Check the normaliser first, since token sorting and title stripping both move scores, then check that aliases were expanded into their own rows.'],
      ['Jaro-Winkler disagrees with the library', 'The transposition count is the part everybody gets wrong. Halve it, and compare against a pair you worked out on paper.'],
      ['Screening takes minutes', 'Score distinct names, not payments: 887 against 12,067. Then read the note on blocking before assuming this scales.'],
      ['A real hit got discounted', 'A secondary identifier rule is firing on absence rather than disagreement. Assert in a test that none of the seven is ever discounted.']
    ]
  },

  20: {
    files: [
      ['`Dockerfile`', 'two stages, pinned by digest, non root, with a health check'],
      ['`.github/workflows/ci.yml`', 'lint, types, tests against real Postgres, migration up then down, build, scan'],
      ['`migrations/`', 'the six step expand and contract, with lock_timeout set'],
      ['`app/observability.py`', 'structlog, the RED metrics, and the OpenTelemetry spans'],
      ['`analysis/loadtest.py`', 'percentiles by window and by endpoint, from the shipped run'],
      ['`slo/`', 'the two objectives, the budget arithmetic and the multiwindow burn rate alerts'],
      ['`docs/`', 'a runbook page per alert, the drill record, and the cost estimate']
    ],
    run: 'docker compose up --build   then   pytest -q && python -m analysis.loadtest',
    design: [
      'The Dockerfile is two stages and pinned by digest, so the compiler and the test dependencies never reach production and a build from a month ago reproduces byte for byte. It runs as uid 10001, because a container escape as root is a different incident.',
      'The pipeline applies every migration and then rolls it back. That is the step most repositories skip, and it is the one that answers the question you will ask during an incident.',
      'The rename is six migrations and three deploys rather than one. There is a test that runs the old application code against the new schema, which is the state the service is actually in during every rolling deploy.',
      'One id joins the three signals. The request id from level 12 and the trace id sit on the same log line, so a metric leads to a log line and a log line leads to a trace.',
      'Metric labels are the route template, the method and the status class, and nothing else. A customer id in a label turns a thousand series into ten million, and the bill arrives before the outage does.',
      'The load test analysis splits by window before it reports anything. The whole run averages 44.7 ms and 1.06% errors; steady state is 31.2 ms and 0.08%, and one minute is 152.7 ms and 9.82%. The summary line describes no minute of the run.',
      'The error budget is computed rather than quoted: 259,200 failures allowed a month at 100 rps, of which the bad minute spent 589, which is 0.23%. That number ends two arguments at once.',
      'The cost estimate includes the logs. 259.2 million requests at 400 bytes each is 103.68 GB a month, which at ordinary ingest prices costs more than the compute it describes.'
    ],
    mistakes: [
      ['The image is over a gigabyte', 'A single stage build, or no .dockerignore. Check docker history and look for the layer that carries the build tooling.'],
      ['Compose works for you and nobody else', 'Something is still on your machine: a local database, a file outside the repository, or an environment variable set in your shell months ago.'],
      ['The deploy broke for two minutes', 'A migration that assumed only one version of the code was running. Expand and contract, and test the old code against the new schema.'],
      ['Prometheus fell over', 'A high cardinality label. Count the series after a thousand distinct requests and find the label that grew with them.'],
      ['The percentiles do not reproduce', 'Check the window boundaries first, then whether the percentile is interpolated. A p99 over a different window is a different number, and that is the lesson rather than a bug.']
    ]
  }
};

/* ------------------------------------------------------------------ build */
for (const lv of levels) {
  const id = String(lv.id).padStart(2, '0');
  const dir = path.join(root, 'solutions', `level-${id}`);
  fs.mkdirSync(dir, { recursive: true });
  const note = NOTES[lv.id];
  const brief = lv.project || lv.setup;
  const requirements = lv.project ? lv.project.requirements : lv.setup.checklist;

  const L = [];
  L.push(`# Level ${lv.id}: ${lv.title}`);
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
  L.push(`Part of [FinQuest](../../README.md) · Level ${lv.id} of 10`);
  L.push('');

  fs.writeFileSync(path.join(dir, 'README.md'), L.join('\n'), 'utf8');
  console.log(`solutions/level-${id}/README.md`);
}
console.log('\ndone');
