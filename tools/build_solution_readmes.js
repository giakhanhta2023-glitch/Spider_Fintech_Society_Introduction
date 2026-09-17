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
