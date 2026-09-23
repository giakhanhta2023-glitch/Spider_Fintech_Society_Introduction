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
      ['`main.py`', 'the app, the routes and the request id middleware'],
      ['`api/idempotency.py`', 'the key store, the body fingerprint, and the three cases'],
      ['`api/state.py`', 'the transition table and the one function that moves a transfer'],
      ['`api/webhooks.py`', 'sign, deliver with backoff, dead letter, verify'],
      ['`tests/`', 'every status code, a tampered webhook and a replayed one']
    ],
    run: 'pip install -r requirements.txt && pytest -q && fastapi dev main.py',
    design: [
      'The idempotency store keeps the key, a sha256 of the request body and the response that was sent. Without the fingerprint a key reused by mistake looks exactly like a retry, and the client believes forty payments went through when one did.',
      'Legal transitions live in one dictionary and one function. Every write path goes through it, so an illegal transition is a 409 rather than a second refund that still balances.',
      'Errors are a code, a message and a request id. The code is what a client branches on, the message is for a person, and the id is what a partner quotes when they report something.',
      'Webhook signatures cover a timestamp and the raw bytes. Verification reads the body before anything parses it, refuses a timestamp older than five minutes, and compares with `hmac.compare_digest`.',
      'Delivery is at least once by design: retry with backoff, dead letter after the last attempt, and document that the receiver must be idempotent on the event id.'
    ],
    mistakes: [
      ['The signature verifies in tests and fails in production', 'You are verifying re-serialised JSON. Read the raw body once, verify those bytes, parse afterwards.'],
      ['Insufficient funds returns 500', 'It is 422 with a code. 500 tells a well behaved client to retry forever against an account that will never have the money.'],
      ['The second identical request creates a second transfer', 'The key is being read after the write, or not at all. Look it up before touching the ledger.']
    ]
  },

  13: {
    files: [
      ['`schema.sql`', 'events, snapshots, balances, and the revoked permissions'],
      ['`es/log.py`', 'append with an expected sequence, read, ConcurrencyError'],
      ['`es/projections.py`', 'apply and project, pure and testable without a database'],
      ['`es/commands.py`', 'the handlers that validate, append, and re-decide on a collision'],
      ['`tests/test_replay.py`', 'the rebuilt read model against the live one']
    ],
    run: 'docker run --name fq-es -e POSTGRES_PASSWORD=es -e POSTGRES_DB=es -p 5432:5432 -d postgres:16 && pip install -r requirements.txt && pytest -q',
    design: [
      '`append` does not validate anything. Events are facts, so the only thing that can refuse them is the command handler that decides whether the fact should happen, and keeping the two apart is what lets a reader trust the log.',
      'Concurrency is the unique constraint on (stream, seq). A collision sends the handler back to the top to read and decide again, never straight back to the append, because the second version would be a decision made against a state that no longer exists.',
      '`apply` and `project` take plain dictionaries and return plain dictionaries. Most of the test suite needs no database at all, which is the practical benefit of a pure fold.',
      'Old event versions are upcast on read. Nothing rewrites a stored event, because the point of the log is being able to prove what the system was told at the time.',
      'The snapshot test deletes every snapshot and asserts no answer changed. A snapshot that is load bearing is a stored state that can drift, which is the thing this design exists to avoid.'
    ],
    mistakes: [
      ['The retry loop double spends', 'It is retrying the append rather than the decision. Go back to reading the stream.'],
      ['Replay does not match the live model', 'Trust the log and rebuild. Then find the write path that changed the projection without an event.'],
      ['A version 1 event crashes the projection', 'The upcast is missing or runs after the apply. Upcast on read, before anything folds it.']
    ]
  },

  14: {
    files: [
      ['`scorecard/binning.py`', 'woe_table, fit_binning, transform, and the unseen value counter'],
      ['`scorecard/model.py`', 'fit, evaluate, scale_to_points, build_card'],
      ['`scorecard/reasons.py`', 'reason codes in words, ranked by points lost'],
      ['`scorecard/fairness.py`', 'approval rate and bad rate of the approved, by group'],
      ['`MODEL.md`', 'the document a validator reads before the code']
    ],
    run: 'pip install -r requirements.txt && python -m scorecard.build && pytest -q',
    design: [
      'Everything is learned on the training half: the bin edges, the WOE maps, the coefficients and the cut off. The test half is read once, at the end, which is the only way the reported Gini means anything.',
      'Thin bins are merged before fitting. A bin holding ninety of eight thousand applications gives a WOE that will swing at the next refit, and coarse classing exists to trade separation for stability.',
      'Age and region are dropped whatever their information value. One is protected in most jurisdictions and the other reconstructs it, and the fairness test is on outcomes rather than on which columns were fed in.',
      'The card is additive by construction, so a reason code is arithmetic: compare each variable against the best achievable bin and rank the gaps. That is what makes an adverse action notice possible at all.',
      'MODEL.md is a deliverable, not documentation of a deliverable. Definitions, the card, both Ginis, the fairness numbers and the PSI thresholds, because the model has to be defensible when its author has left.'
    ],
    mistakes: [
      ['Gini above 0.9 on an application model', 'Something in the features was not knowable at decision time. Look for a variable that only exists because the account already went bad.'],
      ['A coefficient with the wrong sign', 'Two correlated variables fighting. Drop one rather than shipping a card that says more income raises risk.'],
      ['Infinite WOE', 'A bin with no bads or no goods. Merge it with a neighbour rather than adding a constant to hide it.']
    ]
  },

  15: {
    files: [
      ['`fraud/features.py`', 'one definition per feature, called by training and by serving'],
      ['`fraud/train.py`', 'the only file that imports sklearn; writes model.json'],
      ['`fraud/score.py`', 'dot product and sigmoid, no dependencies'],
      ['`fraud/policy.py`', 'the three bands, the hard rules, and the queue capacity rule'],
      ['`bench.py`', 'p50, p95, p99 and max over two thousand decisions']
    ],
    run: 'pip install -r requirements.txt && python -m fraud.train && pytest -q && python bench.py',
    design: [
      'Training and serving call the same feature function. The equality test between the two vectors is the most valuable test in the suite, because skew produces a model that is fine, data that is fine, and predictions that are quietly wrong.',
      'The model ships as JSON coefficients with a version. A pickle executes whatever is inside it, cannot be diffed in review, and drags scikit-learn into the request path for about thirty times the scoring cost.',
      'Velocity is an interface. Tests run over a dictionary with no container, production swaps in Redis with one constructor argument, and the service never knows which it has.',
      'The policy names review capacity out loud. A threshold that sends more cases to the queue than the team can clear is a threshold that auto approves the backlog, and that decision should be made by a person rather than by a Tuesday.',
      'Every decision logs the feature vector, the score and the model version, because the question three weeks later is why this transaction was declined, and the honest answer without those three is that nobody knows.'
    ],
    mistakes: [
      ['p50 fast, p99 terrible', 'It is waiting, not computing. Look for a pool, a cache miss falling through to a full scan, or a call without a timeout.'],
      ['Great offline, useless live', 'Recompute the features offline for transactions already decided live and compare field by field. Skew names itself.'],
      ['Velocity counts the current transaction', 'The window must end strictly before the event being scored, or the signal inflates in training and vanishes in production.']
    ]
  },

  16: {
    files: [
      ['`engine/core.py`', 'run, metrics and break_even_cost'],
      ['`engine/strategies.py`', 'buy and hold, crossover, momentum, all behind one interface'],
      ['`engine/search.py`', 'the parameter grid and walk_forward'],
      ['`engine/report.py`', 'the same nine lines for every result'],
      ['`tests/test_lookahead.py`', 'the shifted and unshifted comparison, asserted']
    ],
    run: 'pip install -r requirements.txt && pytest -q && python -m engine.report',
    design: [
      'The shift lives in `run` rather than in each strategy, so no strategy can forget it. The test that proves it asserts that a signal of 1 on day t produces a position of 1 on day t+1 and nothing on day t.',
      'Costs are applied to turnover rather than to returns, which is what makes the fast and slow strategies react so differently to the same rate: 248 turns a year against 5.5.',
      '`break_even_cost` is reported instead of defending an assumed cost. One number a reader can compare with reality beats a paragraph of justification.',
      'The grid search reports the out of sample result and the correlation across the grid, not the winner. On this data the correlation is negative, which is the whole lesson in one figure.',
      'Walk forward returns the joined test windows and the parameters chosen per fold. Unstable choices between folds are reported as a finding rather than smoothed over.'
    ],
    mistakes: [
      ['Sharpe above 3', 'Look for the future: a rolling window including the current bar, a backward fill, or a merge that aligned the wrong rows.'],
      ['Costs barely matter', 'Check the turnover calculation. A position that never changes pays nothing, and a diff on a constant series is zero everywhere.'],
      ['Walk forward beats the single split', 'Suspect leakage between folds: the fit window and the test window must not overlap, including any rolling feature that spans the boundary.']
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
