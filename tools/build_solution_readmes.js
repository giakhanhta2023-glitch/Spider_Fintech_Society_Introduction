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
    files: [['`fx_portfolio.py`', 'retrying client, disk cache, snapshot fallback, valuation report']],
    run: 'python fx_portfolio.py    (add --offline to force the snapshot path)',
    design: [
      'Three layers, tried in order: fresh cache, live call with backoff, bundled snapshot. The function never raises. There is always an answer, and it always says where the answer came from.',
      'Every `requests.get` passes `timeout=`. Without one, a server that accepts a connection and never replies blocks forever.',
      '`convert` adds `table[base] = 1.0` before looking anything up, so one code path handles base→x, x→base, x→y and x→x.',
      'The live ECB feed quotes 29 currencies and **VND is not one of them**. Rather than dropping that holding, the solution falls back to the snapshot for that single currency and labels the row. Mixed provenance, stated openly, is how real treasury reports work.',
      'Weights are stored at full precision and rounded only for display, rounding each one first makes the column sum to 1.000001.'
    ],
    mistakes: [
      ['The script hangs', 'A missing `timeout=`.'],
      ['`KeyError: "USD"`', 'The API omits the base currency from its rates map. Add it as 1.0.'],
      ['Converted amounts wildly wrong', 'Multiplied where you should divide. Sanity-check against a pair you know.']
    ]
  },
  6: {
    files: [['`loan_simulator.py`', 'payment, schedule, APR by bisection, comparisons, two charts']],
    run: 'python loan_simulator.py',
    design: [
      'Interest is charged on the **current** balance every month. Using the original amount is the classic bug, and it shows up as a final balance that never reaches zero.',
      'The final payment is capped at the remaining balance, so the schedule ends at exactly `0.00` instead of a few stray cents.',
      'The loop is bounded and raises a readable error when the payment cannot cover the interest: otherwise the balance grows every month and the `while` never ends.',
      '`true_apr` uses bisection because the rate has no closed-form solution. Eighty iterations is far more precision than money needs and costs nothing.',
      'The invest-instead comparison deliberately refuses to give a one-word answer: overpaying returns a guaranteed rate, investing is uncertain and illiquid, and a tool that hides that is selling something.'
    ],
    mistakes: [
      ['Balance never reaches zero', 'Interest computed on the original principal, or no cap on the final payment.'],
      ['Payment about 12× too big', 'You passed the annual rate as `i`, or years as `n`. Both must be per period.'],
      ['Crossover month looks wrong', 'It is the first month `principal > interest`, not the month the balance halves.']
    ]
  },
  7: {
    files: [['`risk_dashboard.py`', 'returns, volatility, Sharpe, drawdown, correlation, VaR, charts']],
    run: 'python risk_dashboard.py',
    design: [
      'Volatility is annualized with `sqrt(252)`, not 252. Variance adds over time; standard deviation is its square root. Using 252 overstates risk roughly sixteenfold.',
      'The table reports the arithmetic mean **and** the CAGR side by side, with the gap in its own column. On `CRYPTOZ` that gap is 32 points: the clearest possible demonstration of volatility drag.',
      '`portfolio_returns` asserts the weights sum to 1. Weights summing to 0.9 produce no error and scale every number in the report down by 10%.',
      'VaR is always reported next to expected shortfall. VaR gives the threshold and is silent about how bad the tail gets; reporting it alone is how institutions got surprised in 2008.',
      'The conclusion recommends the mix with the tolerable drawdown rather than the best Sharpe, and says what the analysis cannot tell you. That paragraph is the point of the level.'
    ],
    mistakes: [
      ['Volatility enormous', 'Multiplied by 252 instead of `sqrt(252)`.'],
      ['Everything is `NaN`', 'You skipped `.dropna()` after `pct_change()`.'],
      ['Portfolio numbers ~10% off', 'Weights do not sum to 1.']
    ]
  },
  8: {
    files: [['`fraud_engine.py`', 'features, rule engine, cost curve, model, queue, fairness check']],
    run: 'python fraud_engine.py',
    design: [
      'The do-nothing baseline (98.20% accuracy, zero fraud caught) prints **before** any model. Every later number is judged against it.',
      'Rules are a list of `(name, test, points)`. Adding one is a single line and the whole rulebook prints for an auditor.',
      '`score_row` returns the score **and** the reasons. A flag nobody can explain is a flag nobody can defend to a declined customer.',
      'The cost curve is the part that decides what ships. F1 picks threshold 7; at a $4 review cost the cheapest is 4, and at $20 it moves again. The cost assumptions *are* the model, which is why they are printed.',
      'The split is stratified and the scaler is fitted on training data only. Tuning a threshold on data the model trained on reports fiction.',
      'The fairness check is run, not mentioned. The foreign flag rate is far above the home rate, and the write-up says what would have to happen before that went near production.'
    ],
    mistakes: [
      ['"My model is 98% accurate"', 'So is flagging nothing. Report precision and recall.'],
      ['Precision and recall look swapped', '`confusion_matrix(...).ravel()` returns `tn, fp, fn, tp`: in that order.'],
      ['`amount` coefficient is ~0', 'Unscaled features. Standardise before comparing coefficient magnitudes.']
    ]
  },
  9: {
    files: [
      ['`finance.py`', 'pure loan maths: imports no UI, prints nothing'],
      ['`app.py`', 'the Streamlit interface: contains no formulas'],
      ['`test_finance.py`', '22 tests, no browser required'],
      ['`requirements.txt`', 'pinned dependencies for deployment']
    ],
    run: 'pip install -r requirements.txt && pytest -q && streamlit run app.py',
    design: [
      'The separation is the lesson. `finance.py` imports no UI library, so it can be tested in milliseconds, reused behind an API, and read by someone who has never seen Streamlit.',
      'Every public function raises `ValueError` with a sentence a user could read. `app.py` catches those and turns them into `st.error(...)` followed by `st.stop()`: no traceback ever reaches the page.',
      'Validation lives in the functions, not only in the widget limits. `min_value` is a property of one interface; the engine has to defend itself wherever it is called from.',
      '`@st.cache_data` wraps the schedule builder because Streamlit re-runs the entire script on every slider move, and a 40-year schedule is 480 rows each time.',
      'Nine of the 22 tests assert refusals. Testing that validation fires matters as much as testing the happy path.'
    ],
    mistakes: [
      ['`streamlit: command not found`', 'The virtual environment is not active. The prompt should show `(.venv)`.'],
      ['Works locally, fails when deployed', 'Almost always `requirements.txt`. Read the build log: it names the package.'],
      ['The app is slow', 'Uncached work re-running on every interaction.']
    ]
  },
  10: {
    files: [
      ['`neobank/`', 'seven service modules, one per domain'],
      ['`neobank/loaders.py`', 'the only module that touches a file'],
      ['`app.py`', 'six-section Streamlit dashboard, no business logic'],
      ['`tests/test_capstone.py`', '38 tests across seven modules'],
      ['`data/generate.py`', 'regenerates every synthetic dataset']
    ],
    run: 'pip install -r requirements.txt && python data/generate.py && pytest -q && streamlit run app.py',
    design: [
      'Dependencies run one way only: `app.py` calls services, services call `loaders`, and nothing calls upward. Two greppable rules enforce it: no `streamlit` anywhere in `neobank/`, and no `read_csv` outside `loaders.py`. Both are asserted.',
      '`ledger.statement()` returns rows instead of printing them. That single change is the layer boundary made concrete: the service produces data, the interface decides how it looks.',
      '`loaders.py` anchors paths to its own file location and validates the schema on load, so a malformed CSV fails immediately with a clear message rather than producing a wrong number ten functions later.',
      'Reconciliation compares the ledger against an external statement and reports breaks without auto-adjusting anything. A break is a bug, a timing difference, or fraud, and silently "fixing" it destroys the evidence.',
      'The test suite leads with invariants and refusals, because those are the properties that make a money system trustworthy.'
    ],
    mistakes: [
      ['`ModuleNotFoundError: neobank`', 'Run from the project root, the folder containing `app.py`.'],
      ['Data file not found', '`python data/generate.py` first.'],
      ['A service needs a DataFrame it cannot get', 'It is asking for data. Add a loader and pass the result in; do not read the file from the service.']
    ]
  },

  11: {
    files: [
      ['`schema.sql`', 'tables, constraints, the deferred balancing trigger, the balance trigger'],
      ['`ledger/db.py`', 'connection and schema loading, nothing else'],
      ['`ledger/core.py`', 'open_account, post, transfer, reverse, balance, statement'],
      ['`ledger/audit.py`', 'reconcile, and the global sum that must be zero'],
      ['`tests/test_concurrency.py`', 'two threads spending the same money, which fails without the lock']
    ],
    run: 'docker run --name fq-ledger -e POSTGRES_PASSWORD=ledger -e POSTGRES_DB=ledger -p 5432:5432 -d postgres:16 && pip install -r requirements.txt && pytest -q',
    design: [
      'The balancing rule lives in a deferred constraint trigger rather than in `post`. Python still checks, for a better error, but the guarantee is the one that holds for psql, a migration and the second service somebody writes next year.',
      'Idempotency is a unique index and a caught `UniqueViolation`, not a select followed by an insert. The select version passes every test that runs one request at a time and double charges the first time two arrive together.',
      '`transfer` locks the accounts it touches in account id order before it reads a balance. Consistent ordering is what stops two transfers deadlocking on each other.',
      'Every public function takes a connection rather than making one, so the tests can run a whole scenario inside a transaction and roll it back, and so level 12 can hand it a pooled connection.',
      'Nothing updates or deletes an entry. A wrong transfer is reversed, and the grants in `schema.sql` make that a property of the role rather than a habit of the author.'
    ],
    mistakes: [
      ['Every transfer fails with "does not balance"', 'The trigger is not deferred. It needs `deferrable initially deferred`, so it runs at commit rather than after the first leg.'],
      ['The concurrency test passes without the lock', 'The threads are not overlapping. Sleep between reading the balance and writing, and give each thread its own connection.'],
      ['`current transaction is aborted`', 'An earlier statement in the same transaction failed. Use `conn.transaction()` blocks so the rollback happens for you.']
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
