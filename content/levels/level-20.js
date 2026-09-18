/* =========================================================================
   LEVEL 20: shipping it, and keeping it up
   ========================================================================= */
FQ.registerLevel({
  id: 20,
  codename: 'shipped',
  title: 'The mean was 45 milliseconds and the service was down',
  tagline: 'The last level takes the payment service you built in level 12 and makes it something a team can run: a container, a pipeline, three signals, an objective, and a bill somebody has read.',
  difficulty: 9,
  minutes: 280,
  tags: ['Docker', 'CI', 'observability', 'SLO', 'cost'],
  summary: 'Nineteen levels built things. This one ships one. Container, pipeline, migrations, logs, metrics, traces, a ' +
           'load test of 60,000 requests with one bad minute hidden inside it, a service level objective with the ' +
           'arithmetic done, and a monthly cost where the logs turn out to be more expensive than the servers.',

  objectives: [
    'Build a container somebody else can run, small, pinned and not running as root',
    'Write a pipeline that gates a merge, and know what belongs in it',
    'Deploy a schema change without a maintenance window',
    'Instrument the three signals, and know which question each one answers',
    'Read a latency distribution instead of an average',
    'Set an objective, compute the error budget, and alert on burn rate',
    'Estimate the monthly bill, including the part nobody estimates'
  ],

  knowledge: [
    { h: 'Done means somebody else can run it' },
    { p: 'Every level so far ended with tests passing on your machine. That is the halfway point of shipping. The rest is ' +
         'the set of properties that let a second person operate the thing without asking you anything.' },
    { ol: [
      '**It starts from a clean clone**, with one documented command, on a machine that is not yours.',
      '**Its configuration comes from the environment**, so the same artefact runs in staging and in production.',
      '**Its schema changes apply themselves**, forwards, without a maintenance window.',
      '**It says what it is doing**, in a form a machine can aggregate.',
      '**It has a number it is supposed to hit**, and somebody knows what happens when it does not.',
      '**It costs a knowable amount**, and somebody has looked.'
    ]},
    { p: 'This level does all six to the payment service from level 12. The work is deliberately unglamorous, and it is the ' +
         'difference between a portfolio repository and one that shows you have run something.' },

    { h: 'The container' },
    { code: '# build stage: has the compiler and the dev dependencies\nFROM python:3.12-slim@sha256:<digest> AS build\nWORKDIR /app\nCOPY requirements.txt .\nRUN pip install --no-cache-dir --target /deps -r requirements.txt\n\n# run stage: has neither\nFROM python:3.12-slim@sha256:<digest>\nRUN useradd --uid 10001 --create-home app\nWORKDIR /app\nCOPY --from=build /deps /deps\nCOPY --chown=app:app . .\nENV PYTHONPATH=/deps PYTHONUNBUFFERED=1\nUSER app\nEXPOSE 8000\nHEALTHCHECK --interval=10s --timeout=2s CMD python -m app.healthcheck\nCMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]', lang: 'dockerfile' },
    { table: {
      head: ['Line', 'Why it is there'],
      rows: [
        ['Two stages', 'The compiler and the test dependencies never reach production. Smaller image, smaller attack surface'],
        ['`@sha256:`', 'A tag moves. A digest does not, so today\'s build is tomorrow\'s build'],
        ['`useradd` and `USER app`', 'A container escape as root is a different incident from one as uid 10001'],
        ['`--no-cache-dir`', 'Pip\'s cache is dead weight in a layer'],
        ['`HEALTHCHECK`', 'The orchestrator needs to know the difference between started and ready'],
        ['`PYTHONUNBUFFERED`', 'Otherwise your logs arrive in blocks, minutes after the thing you are debugging']
      ]
    }},
    { warn: 'Never `COPY .env` and never bake a key into a layer. Layers are cached, shared and pullable, and a secret in ' +
            'one is a secret published. Level 12\'s rule, now with a second way to break it.' },
    { check: {
      q: 'Your image is 1.2 GB and a colleague\'s equivalent service is 180 MB. Where has the weight gone, and why does it ' +
         'matter beyond disk space?',
      a: 'Almost always a single stage build: the compiler, the headers, the test dependencies and the pip cache are all ' +
         'still in the image. It matters because every one of those is code that ships to production and appears in a ' +
         'vulnerability scan, because a bigger image is slower to pull and so slower to scale out or roll back, and ' +
         'because a rollback that takes four minutes instead of twenty seconds is four minutes of an incident.'
    }},

    { h: 'The pipeline, and what it is allowed to stop' },
    { p: 'Continuous integration is a list of things that must be true before code merges. The list is short in a good ' +
         'repository, and every item on it has stopped something real.' },
    { table: {
      head: ['Stage', 'Typical time', 'What it catches'],
      rows: [
        ['Lint and format', 'seconds', 'Arguments nobody needs to have'],
        ['Type check', 'seconds', 'The None you did not consider'],
        ['Unit tests', 'under a minute', 'Logic'],
        ['Integration tests, real Postgres', 'a few minutes', 'The half of your bugs that live in the database'],
        ['Build the image', 'a minute', 'A Dockerfile that only worked on your laptop'],
        ['Dependency and image scan', 'under a minute', 'A known vulnerability in something you did not write'],
        ['Migration check, up then down', 'seconds', 'A migration that cannot be rolled back']
      ]
    }},
    { p: 'Two rules make the difference between a pipeline people trust and one they route around.' },
    { ul: [
      '**It has to be fast enough to wait for.** Ten minutes is tolerable, forty is not, and beyond that people merge without reading it.',
      '**A red build has to mean something is broken.** A test that fails one run in twenty teaches everybody to re-run rather than to look, and that habit is what lets the real failure through.'
    ]},

    { h: 'Deploying a schema change' },
    { p: 'The service runs on more than one machine, so during a deploy both the old code and the new code are live at ' +
         'once. A migration that assumes otherwise causes an outage in the two minutes nobody tested.' },
    { code: 'renaming a column, the only safe way\n\n  1. add the new column, nullable            old code fine, new code fine\n  2. write to both, read from the old        deploy\n  3. backfill the new one in batches         no lock held for long\n  4. read from the new one                   deploy\n  5. stop writing the old one                deploy\n  6. drop the old column                     days later, when nothing rolls back to it', lang: 'text' },
    { p: 'That is expand and contract, and the shape is the same for every destructive change: make the new thing exist, ' +
         'move the traffic, then remove the old thing in a separate release. Six deploys instead of one, and no window ' +
         'where a rollback loses data.' },
    { check: {
      q: 'A migration adds a `not null` column with a default to a table of forty million rows, and the deploy times out ' +
         'with the service unavailable. What happened?',
      a: 'The migration took a lock the whole table needed while it rewrote it, and every query queued behind it until ' +
         'connections ran out. Modern Postgres avoids the rewrite for a constant default, but the general habit is what ' +
         'matters: add the column nullable, backfill in batches with a pause between them, then add the constraint. Also ' +
         'set a `lock_timeout` on migrations so a blocked one fails in seconds instead of taking the service with it.'
    }},

    { h: 'Three signals, three questions' },
    { table: {
      head: ['Signal', 'Answers', 'Cardinality'],
      rows: [
        ['**Logs**', 'What happened to this one request?', 'Unlimited, and that is the cost problem'],
        ['**Metrics**', 'How is the system doing right now?', 'Low, so keep it low'],
        ['**Traces**', 'Where did the time go, across services?', 'Sampled']
      ]
    }},
    { p: 'For metrics the useful default is RED, one set per endpoint: **rate** (requests per second), **errors** (the ' +
         'share failing), and **duration** (a histogram, not an average). Level 12 already puts a request id on every log ' +
         'line; the trace id goes in the same place, and that one field is what turns three tools into one investigation.' },
    { code: '{"ts": "2026-07-02T14:06:03.412Z", "level": "error", "msg": "payment failed",\n "request_id": "01J2X...", "trace_id": "4bf92f...", "route": "POST /payments",\n "status": 503, "duration_ms": 41.2, "db_wait_ms": 38.9}', lang: 'json' },
    { warn: 'Never put a customer id, an account number or an amount in a metric label. Metrics are stored per unique ' +
            'combination of labels, so one high cardinality label turns a thousand time series into ten million and the ' +
            'bill arrives before the outage does.' },

    { h: 'Reading a load test' },
    { p: 'Here is one run against the level 12 service: ten minutes, a hundred requests a second, 60,000 requests, and the ' +
         'file ships with the level. One summary line describes it.' },
    { code: 'whole run   n=60000   mean 44.7 ms   errors 1.06%', lang: 'text' },
    { p: 'That line is true and it hides everything that matters. Split the same data by time.' },
    { table: {
      head: ['Window', 'Requests', 'p50', 'p95', 'p99', 'Errors'],
      rows: [
        ['Warm up, first 5 s', '500', '146.0 ms', '496.6 ms', '795.6 ms', '0%'],
        ['Steady state, 30 s to 360 s', '33,000', '26.4 ms', '75.6 ms', '111.0 ms', '0.08%'],
        ['**The bad minute, 360 s to 420 s**', '6,000', '120.5 ms', '398.8 ms', '590.9 ms', '**9.82%**'],
        ['After, 420 s onward', '18,000', '26.4 ms', '74.3 ms', '110.9 ms', '0.12%']
      ]
    }},
    { p: 'The mean of the whole run, 44.7 ms, describes no minute of it. The p99 of the whole run, 327.9 ms, is three times ' +
         'the steady state p99 of 111.0 ms, entirely because of sixty seconds. And the warm up is a separate phenomenon ' +
         'again: a cold process is slow, which is an argument for a readiness probe that waits rather than a deploy that ' +
         'sends traffic at a process still loading.' },
    { money: 'Split by endpoint too. In steady state `POST /payments` runs at a p99 of 121.5 ms and `GET /health` at ' +
             '10.9 ms, so an overall percentile mixed across endpoints is an average of two different services.' },
    { check: {
      q: 'Somebody proposes an alert on average latency above 100 ms. Using the numbers above, say why that alert would ' +
         'not have fired during the bad minute, and what to alert on instead.',
      a: 'It would have fired, but late and for the wrong reason: the mean in that window was 152.7 ms, so it crosses, ' +
         'while the mean over any five minute window containing the incident stays near 60 ms and might not. Averages are ' +
         'pulled towards the common case, and the common case stayed fast. Alert on the share of requests that failed and ' +
         'the share slower than your objective, which moved from 0.08% to 9.82% and from 0.00% to 11.38%. Those are ' +
         'unambiguous, and they are the things a customer noticed.'
    }},

    { h: 'An objective, and the budget under it' },
    { p: 'A service level objective is a promise with a number, chosen because somebody thought about what users need, ' +
         'not because 99.99% sounds impressive. Two for this service:' },
    { ul: [
      '**Availability**: 99.9% of requests succeed, measured over 30 days.',
      '**Latency**: 99% of `POST /payments` complete within 300 ms, measured over 30 days.'
    ]},
    { p: 'The budget follows from the objective by arithmetic. At 100 requests a second the service handles 259,200,000 ' +
         'requests in 30 days, so 99.9% allows 259,200 failures. Now price the incident.' },
    { table: {
      head: ['', 'Value'],
      rows: [
        ['Requests in 30 days at 100 rps', '259,200,000'],
        ['Failures allowed at 99.9%', '259,200'],
        ['Failures in the bad minute', '589'],
        ['Share of the monthly budget spent', '0.23%'],
        ['Same thing as time, 99.9% of 30 days', '43.2 minutes']
      ]
    }},
    { p: 'One minute at 9.82% errors costs about a quarter of one percent of the month. That is the number that stops two ' +
         'arguments at once: the one where a minute of errors is treated as a catastrophe, and the one where it is ' +
         'treated as nothing. It is 0.23%, and if it happens twice a day the budget is gone before the month ends.' },
    { p: 'Alert on **burn rate**, which is how fast the budget is being spent compared to level. A 9.82% error rate against ' +
         'a 0.1% allowance is a burn rate of about 98, and at that speed a month of budget is gone in roughly seven hours. ' +
         'The usual configuration is two windows: a fast one that catches a burn rate above 14 over an hour, and a slow ' +
         'one that catches a quieter leak over six. One page for something urgent, one ticket for something steady.' },
    { check: {
      q: 'Your service has been at 100% availability for four months. What should you do with the error budget?',
      a: 'Ask what it cost. An untouched budget usually means the objective is set well below what the system delivers, ' +
         'and the team has been paying for that margin in release caution, extra redundancy, or simply not shipping. ' +
         'Either raise the objective so the number means something, or spend the budget deliberately: ship faster, run a ' +
         'failure drill, test a rollback in production hours. A budget that is never spent is a number nobody uses.'
    }},

    { h: 'The bill, including the part nobody estimates' },
    { p: 'At 100 requests a second the service does 8,640,000 requests a day. Suppose each one writes a single structured ' +
         'log line of about 400 bytes, which is a modest line with a request id, a route, a status and a duration.' },
    { code: '259,200,000 requests x 400 bytes  =  103.68 GB of logs a month\n\n  at an assumed $0.50 per GB ingested   =  $51.84 a month\n  at an assumed $2.00 per GB ingested   = $207.36 a month', lang: 'text' },
    { p: 'Three small instances to serve that traffic cost less than the second figure. The log bill is not an exotic ' +
         'failure mode, it is the normal outcome of logging every request at full detail and never looking at the volume. ' +
         'The unit prices above are assumptions for the arithmetic; put your own provider\'s numbers in and the ratio ' +
         'usually survives.' },
    { ul: [
      '**Sample the boring ones.** Every error, every slow request, and one in a hundred successful ones is a different bill and almost the same information.',
      '**Move the counting into metrics.** A count of requests by route and status is a handful of time series, not a hundred gigabytes.',
      '**Set a retention that matches the question.** Debugging needs days. Audit needs years, and belongs in the append only tables from level 13, not in a log product.',
      '**Sample traces.** One percent, plus everything that errored.'
    ]},
    { p: 'Then write the estimate down: compute, database, logs, traces, egress, and the per transaction fees if the ' +
         'service touches a payment provider. Being able to say what your service costs per thousand transactions is rare ' +
         'in a junior engineer and noticed immediately.' },

    { h: 'The runbook' },
    { p: 'The last artefact, and the one most repositories lack. A page per alert, written before the incident, in the ' +
         'imperative.' },
    { ol: [
      '**What fired**, in the words of the alert.',
      '**What it means** for a customer, in one sentence.',
      '**The first three things to look at**, with the links already in the document.',
      '**The safe actions**: restart this, scale that, turn this feature off.',
      '**What not to do**, which is usually the interesting part.',
      '**Who to wake**, and when it is right to.'
    ]},
    { p: 'Write it the day you build the alert, while you still remember why. Then run one drill: break something in ' +
         'staging on purpose, follow your own runbook, and fix whatever you could not find. That drill is the difference ' +
         'between a document and a thing that works at four in the morning.' }
  ],

  tutorial: {
    intro: 'This level operates on the service from level 12. Work in that repository, or clone your own and branch. ' +
           'Docker, GitHub Actions, Postgres, Prometheus and OpenTelemetry, all free to run locally.',
    steps: [
      {
        t: 'Containerise, then measure the result',
        blocks: [
          { p: 'Write the two stage Dockerfile, then check the three things that make it good rather than merely working.' },
          { code: 'docker build -t payments:dev .\ndocker image ls payments:dev            # size: aim well under 300 MB\ndocker run --rm payments:dev id        # uid should not be 0\ndocker history payments:dev | head     # no layer should mention a secret', lang: 'bash' },
          { tip: 'Add a `.dockerignore` before you build. Without it your `.git`, your virtual environment and any local ' +
                 '`.env` go into the build context, which is both slow and the most common way a secret ends up in an image.' }
        ],
        check: 'The image builds, runs as a non root user, and is small enough to pull quickly.'
      },
      {
        t: 'Compose the whole thing locally',
        blocks: [
          { code: 'services:\n  db:\n    image: postgres:16\n    environment: { POSTGRES_PASSWORD: dev }\n    healthcheck:\n      test: ["CMD-SHELL", "pg_isready -U postgres"]\n      interval: 2s\n  api:\n    build: .\n    depends_on:\n      db: { condition: service_healthy }\n    environment:\n      DATABASE_URL: postgres://postgres:dev@db:5432/postgres\n    ports: ["8000:8000"]', lang: 'yaml' },
          { p: 'One command has to bring up the service and its database from nothing. That command goes at the top of the ' +
               'README, and somebody who has never seen the project runs it to check you are telling the truth.' }
        ],
        check: 'docker compose up brings up a working API against a fresh database, with no manual steps.'
      },
      {
        t: 'The pipeline',
        blocks: [
          { code: 'name: ci\non: [push, pull_request]\njobs:\n  test:\n    runs-on: ubuntu-latest\n    services:\n      postgres:\n        image: postgres:16\n        env: { POSTGRES_PASSWORD: ci }\n        options: >-\n          --health-cmd pg_isready --health-interval 2s --health-retries 15\n        ports: ["5432:5432"]\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-python@v5\n        with: { python-version: "3.12", cache: pip }\n      - run: pip install -r requirements.txt -r requirements-dev.txt\n      - run: ruff check . && ruff format --check .\n      - run: mypy app\n      - run: pytest -q --cov=app --cov-fail-under=80\n      - run: alembic upgrade head && alembic downgrade -1 && alembic upgrade head\n      - run: docker build -t payments:ci .', lang: 'yaml' },
          { p: 'The migration line is the one people leave out. It proves the migration applies forwards and rolls back, ' +
               'which is exactly what you need to be true at the moment you least want to find out.' },
          { tip: 'Time the pipeline and put the number in the README. If it is over ten minutes, find out which step owns ' +
                 'the time before adding anything to it.' }
        ],
        check: 'A pull request runs the pipeline, and a deliberately broken test blocks the merge.'
      },
      {
        t: 'Expand and contract, for real',
        blocks: [
          { p: 'Rename `amount_cents` to `amount_minor` across six migrations and three deploys. Nothing else in this level ' +
               'teaches as much per line of code.' },
          { code: '# 01_add.py        add amount_minor, nullable\n# 02_dual_write.py application writes both, reads amount_cents\n# 03_backfill.py   update in batches of 5000, sleep between them\n# 04_read_new.py   application reads amount_minor\n# 05_stop_write.py application stops writing amount_cents\n# 06_drop.py       drop amount_cents', lang: 'text' },
          { code: 'SET lock_timeout = \'3s\';       -- fail fast rather than queue the world\nSET statement_timeout = \'5min\';', lang: 'sql' },
          { p: 'Write a test that runs the old application code against the new schema. That is the state your service is in ' +
               'for two minutes during every deploy, and it is the only state nobody tests.' }
        ],
        check: 'The old code passes its tests against the new schema, and each migration rolls back cleanly.'
      },
      {
        t: 'Structured logs, with the ids that join things up',
        blocks: [
          { code: 'import structlog\n\nlog = structlog.get_logger()\n\n@app.middleware("http")\nasync def observe(request, call_next):\n    started = time.perf_counter()\n    request_id = request.headers.get("x-request-id") or str(ulid.new())\n    with structlog.contextvars.bound_contextvars(\n        request_id=request_id,\n        trace_id=current_trace_id(),\n        route=request.scope.get("route").path if request.scope.get("route") else request.url.path,\n    ):\n        response = await call_next(request)\n        log.info("request",\n                 status=response.status_code,\n                 duration_ms=round((time.perf_counter() - started) * 1000, 2))\n        return response', lang: 'python' },
          { warn: 'Log the route template, `/payments/{id}`, never the filled in path. A path with the id in it is a ' +
                  'different string every time, which ruins grouping and, if it reaches a metric label, your bill.' }
        ],
        check: 'Every log line carries a request id and a trace id, and no line contains a token, a card number or a full name.'
      },
      {
        t: 'RED metrics and a trace',
        blocks: [
          { code: 'from prometheus_client import Counter, Histogram\n\nREQUESTS = Counter("http_requests_total", "", ["route", "method", "status"])\nLATENCY  = Histogram("http_request_duration_seconds", "", ["route", "method"],\n                     buckets=(.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5))\n\n# labels: route template, method, status class. Nothing per customer, ever.', lang: 'python' },
          { p: 'Then add OpenTelemetry around the database calls, so a slow request shows where the time went rather than ' +
               'only that it was slow. In the bad minute of the shipped load test, the answer was the database wait.' },
          { code: 'POST /payments  412 ms\n  |- validate        0.4 ms\n  |- db: insert     38.9 ms\n  |- db: commit    371.2 ms   <- here\n  |- serialise       0.6 ms', lang: 'text' }
        ],
        check: 'A Prometheus scrape returns the three RED series, and a trace of one slow request shows the database span.'
      },
      {
        t: 'Run the load test, and read it properly',
        blocks: [
          { code: '# 100 requests a second for ten minutes\nk6 run --vus 50 --duration 10m load/payments.js', lang: 'bash' },
          { p: 'Then analyse the shipped run rather than trusting the tool\'s summary. Compute the percentiles yourself, ' +
               'split by window and by endpoint, and reproduce this table.' },
          { code: 'window                     n      p50      p95      p99   errors\nwhole run              60000   28.6ms  141.3ms  327.9ms    1.06%\nsteady state           33000   26.4ms   75.6ms  111.0ms    0.08%\nthe bad minute          6000  120.5ms  398.8ms  590.9ms    9.82%\n\nover 300 ms:  1.27% of the run, 0.00% in steady state, 11.38% in the bad minute', lang: 'text' },
          { tip: 'Percentiles do not average. You cannot take the p99 of each minute and average them to get the p99 of the ' +
                 'hour, which is why histograms are stored as buckets and not as numbers.' }
        ],
        check: 'Your analysis reproduces the table, including the 11.38% of the bad minute over 300 ms.'
      },
      {
        t: 'The objective, the alerts and the runbook',
        blocks: [
          { code: '# 99.9% availability over 30 days\n# budget: 259,200 failed requests, or 43.2 minutes\n\n- alert: ErrorBudgetBurningFast\n  expr: |\n    (sum(rate(http_requests_total{status=~"5.."}[1h]))\n     / sum(rate(http_requests_total[1h]))) > 14 * 0.001\n  for: 5m\n  labels: { severity: page }\n\n- alert: ErrorBudgetBurningSlowly\n  expr: |\n    (sum(rate(http_requests_total{status=~"5.."}[6h]))\n     / sum(rate(http_requests_total[6h]))) > 6 * 0.001\n  for: 30m\n  labels: { severity: ticket }', lang: 'yaml' },
          { p: 'Two windows, two severities, one budget. Then write the runbook page for each alert, and run one drill ' +
               'against staging with the runbook open. Whatever you could not find in three minutes is a missing line in ' +
               'the document.' }
        ],
        check: 'The alerts fire against a replayed incident, and somebody who did not build the service can follow the runbook.'
      }
    ]
  },

  glossary: [
    { t: 'Multi stage build', d: 'Compile in one image, copy the result into a smaller one. Keeps build tools out of production.' },
    { t: 'Image digest', d: 'The sha256 of an image. Pinning to it makes a build reproducible in a way a tag does not.' },
    { t: 'Readiness probe', d: 'The check that decides whether an instance should receive traffic yet. Different from liveness.' },
    { t: 'Expand and contract', d: 'Adding the new schema, moving traffic, then removing the old one, across separate deploys.' },
    { t: 'lock_timeout', d: 'A Postgres setting that makes a blocked migration fail quickly instead of queueing every query behind it.' },
    { t: 'RED metrics', d: 'Rate, errors and duration, per endpoint. The default dashboard for a request driven service.' },
    { t: 'Cardinality', d: 'The number of distinct label combinations in a metric. High cardinality is the usual cause of a surprise bill.' },
    { t: 'Trace and span', d: 'One request end to end, and one unit of work within it. Shows where the time went across services.' },
    { t: 'Percentile', d: 'The value below which that share of requests fall. p99 is the slowest one in a hundred.' },
    { t: 'SLI', d: 'Service level indicator: the measurement, such as the share of requests under 300 ms.' },
    { t: 'SLO', d: 'Service level objective: the target for an indicator, over a window.' },
    { t: 'Error budget', d: 'The failure the objective allows. 99.9% over 30 days is 43.2 minutes, or 259,200 requests at 100 rps.' },
    { t: 'Burn rate', d: 'How fast the budget is being spent compared to level. A rate of 14 exhausts a month in about two days.' },
    { t: 'Log sampling', d: 'Keeping every error and slow request, and a fraction of the successful ones. Most of the saving, little of the loss.' },
    { t: 'Runbook', d: 'One page per alert, written before the incident, saying what to look at and what not to do.' }
  ],

  quiz: [
    { q: "Why does a production image use a second build stage?",
      options: [
        "So compilers, headers and test dependencies never ship to production",
        "Because Docker requires it for health checks",
        "To make the build faster",
        "To allow multiple architectures"
      ],
      answer: 0,
      why: "Smaller image, smaller attack surface, fewer findings in a scan, and a faster pull when you need to roll back." },

    { q: "Pinning a base image by digest rather than by tag means:",
      options: [
        "The image downloads faster",
        "The image works on any architecture",
        "Today's build is tomorrow's build, because a digest cannot move",
        "Security patches apply automatically"
      ],
      answer: 2,
      why: "Tags get republished. A digest is the content, so reproducing a build a month later gives the same bytes." },

    { q: "What belongs in a CI pipeline that most repositories leave out?",
      options: [
        "Building the image",
        "Applying the migration and then rolling it back",
        "Unit tests",
        "A linter"
      ],
      answer: 1,
      why: "You find out whether a migration can be reversed at the moment you least want to be finding out." },

    { q: "A test fails one run in twenty. Why is that worse than a test that always fails?",
      options: [
        "It cannot be reproduced locally",
        "It uses more CI minutes",
        "It teaches everybody to re-run rather than to look, so the real failure gets through",
        "It inflates the coverage number"
      ],
      answer: 2,
      why: "A red build has to mean something is broken, or the signal is gone." },

    { q: "During a rolling deploy, what is true about the code running against your database?",
      options: [
        "Neither, because traffic is drained first",
        "Both versions at once, for a few minutes",
        "Only the new version, after a brief pause",
        "Only the old version, until the deploy completes"
      ],
      answer: 1,
      why: "That is why schema changes expand and contract, and why the old code against the new schema deserves a test." },

    { q: "What does setting lock_timeout on a migration achieve?",
      options: [
        "It prevents the migration from being rolled back",
        "It makes the migration run faster",
        "A blocked migration fails in seconds instead of queueing every query behind it",
        "It blocks other queries for a fixed period"
      ],
      answer: 2,
      why: "The outage is rarely the migration itself, it is the thousand queries waiting behind the lock it took." },

    { q: "Which signal answers \"what happened to this one request\"?",
      options: [
        "Traces",
        "Logs",
        "Alerts",
        "Metrics"
      ],
      answer: 1,
      why: "Metrics tell you how the system is doing, traces where the time went, logs what happened to a specific request." },

    { q: "Why must a customer id never be a metric label?",
      options: [
        "It is personal data under GDPR",
        "Labels must be numeric",
        "Prometheus rejects string labels",
        "Metrics are stored per unique label combination, so cardinality explodes and so does the bill"
      ],
      answer: 3,
      why: "One high cardinality label turns a thousand series into ten million. The customer id belongs in the log line." },

    { q: "The load test has a mean of 44.7 ms over the whole run. What does that number describe?",
      options: [
        "Typical performance under load",
        "The performance a customer experiences",
        "The p50, closely enough",
        "No actual minute of the run: steady state was 31.2 ms and the bad minute was 152.7 ms"
      ],
      answer: 3,
      why: "Averages are pulled towards the common case, and the common case stayed fast while a minute of requests failed." },

    { q: "In the shipped run, what share of requests in the bad minute exceeded 300 ms?",
      options: [
        "11.38%",
        "0.00%",
        "1.27%",
        "9.82%"
      ],
      answer: 0,
      why: "Against 0.00% in steady state and 1.27% across the whole run. The window you pick decides the story you tell." },

    { q: "Can you average the p99 of each minute to get the p99 of the hour?",
      options: [
        "Yes, that is what a histogram does",
        "Only for latencies under a second",
        "Yes, if the minutes have equal traffic",
        "No: percentiles do not average, which is why histograms store buckets"
      ],
      answer: 3,
      why: "Buckets can be summed and the percentile recomputed. Percentile values cannot be combined arithmetically." },

    { q: "At 100 requests a second, how many failures does a 99.9% availability objective allow over 30 days?",
      options: [
        "259,200",
        "25,920",
        "43,200",
        "2,592,000"
      ],
      answer: 0,
      why: "259,200,000 requests in the window, one thousandth of them. The same objective is 43.2 minutes as a time budget." },

    { q: "The bad minute produced 589 failures. What share of the monthly error budget is that?",
      options: [
        "9.82%",
        "0.23%",
        "2.3%",
        "23%"
      ],
      answer: 1,
      why: "Small, and the point of computing it: it stops both the panic and the shrug. Twice a day and the budget is gone." },

    { q: "Your service has used none of its error budget in four months. The healthy response is:",
      options: [
        "Raise the objective, or spend the budget deliberately on shipping faster and running drills",
        "Publish it as a reliability achievement",
        "Nothing: an unused budget is the goal",
        "Lower the objective to leave more room"
      ],
      answer: 0,
      why: "An untouched budget means the objective is below what the system delivers, and the margin was paid for somewhere." },

    { q: "At 100 rps with one 400 byte log line per request, roughly how much log volume does a month produce?",
      options: [
        "About 1 TB",
        "About 1 GB",
        "About 104 GB",
        "About 10 GB"
      ],
      answer: 2,
      why: "259,200,000 x 400 bytes. At common ingest prices that costs more than the servers, which is why sampling exists." }
  ],

  project: {
    title: 'Ship the payment service',
    story: 'Take the service you built in level 12 and make it something a team could run. Container, pipeline, ' +
           'migrations, the three signals, a load test, an objective with the arithmetic done, a cost estimate and a ' +
           'runbook. This is the repository you point at in an interview.',
    scope: 'Builds directly on level 12, with level 11 for the schema and level 13 for the audit trail. Everything runs ' +
           'locally: Docker, Postgres, Prometheus, an OpenTelemetry collector and k6. The shipped load test file lets you ' +
           'do the analysis even if your own run comes out differently.',
    dataset: '{{RAW}}/data/level-20-loadtest.csv',
    requirements: [
      'A two stage Dockerfile, pinned by digest, running as a non root user, with a health check and a .dockerignore',
      'docker compose up brings the API and a fresh database up from nothing, in one command',
      'A CI pipeline running lint, types, unit tests, integration tests against real Postgres, the image build, a dependency scan, and a migration up then down',
      'The pipeline time recorded in the README, and a deliberately broken test shown to block a merge',
      'A rename carried out as expand and contract across six migrations, with a test running the old code against the new schema',
      'lock_timeout and statement_timeout set on migrations',
      'Structured JSON logs with request id, trace id and route template, and a test that no secret or personal field is logged',
      'RED metrics on a /metrics endpoint, with no high cardinality label',
      'OpenTelemetry tracing with spans around the database calls',
      'A load test script, plus an analysis that reproduces the shipped run\'s table by window and by endpoint',
      'Two SLOs, the error budget computed from your own traffic assumption, and multiwindow burn rate alerts',
      'A cost estimate covering compute, database, logs, traces and egress, with the unit prices stated as assumptions',
      'A runbook page per alert, and a written record of one drill you ran against it',
      'The repository in your GitHub portfolio as finquest-payments, replacing the level 12 version'
    ],
    starter: {
      lang: 'bash',
      code: '# FinQuest level 20: ship the level 12 payment service.\n#\n# Start from your own level 12 repository. This is the layout to reach.\n#\n#   Dockerfile               two stages, pinned, non root\n#   .dockerignore            .git, .venv, .env, tests\n#   docker-compose.yml       api + postgres, one command\n#   .github/workflows/ci.yml lint, types, tests, migration up/down, build, scan\n#   migrations/              01_add .. 06_drop, the expand and contract\n#   app/observability.py     structlog setup, RED metrics, otel spans\n#   load/payments.js         the k6 script\n#   analysis/loadtest.py     percentiles by window and by endpoint\n#   slo/objectives.yml       the two objectives and the budget arithmetic\n#   slo/alerts.yml           multiwindow burn rate\n#   docs/runbook-*.md        one page per alert\n#   docs/cost.md             the estimate, with the assumptions named\n#\n# Reach them in this order, and commit each one separately so the history\n# shows the work rather than one drop of finished files.\n\ndocker build -t payments:dev .\ndocker run --rm payments:dev id          # must not be uid 0\ndocker compose up --build                 # must work from a clean clone\n'
    },
    tests: [
      'The image runs as a non root user and contains no .env, .git or test dependency',
      'docker compose up serves a request from a clean clone with no manual steps',
      'CI fails when a test is broken, and fails when a migration cannot be rolled back',
      'The old application code passes its tests against the post migration schema',
      'Every log line carries a request id, a trace id and a route template',
      'No log line contains a token, a card number, an email address or a full name',
      'No metric label has unbounded cardinality, asserted by counting series after a thousand distinct requests',
      'The analysis reproduces p50 26.4 ms, p95 75.6 ms and p99 111.0 ms for the steady state window',
      'The analysis reproduces 9.82% errors and 11.38% over 300 ms for the bad minute',
      'The error budget calculation returns 259,200 failures for 99.9% at 100 rps over 30 days',
      'The burn rate alert fires when the shipped incident is replayed and stays quiet in steady state',
      'The cost estimate reproduces 103.68 GB of logs a month from its stated assumptions'
    ],
    rubric: [
      { pts: 20, t: 'Runs anywhere', d: 'Clean clone to serving request in one command, image small, pinned and non root.' },
      { pts: 20, t: 'The pipeline earns its place', d: 'Every stage present, fast enough to wait for, and shown to block a bad merge.' },
      { pts: 15, t: 'Deployable schema changes', d: 'Expand and contract done properly, with the old code tested against the new schema.' },
      { pts: 20, t: 'Observable', d: 'Three signals, joined by one id, with cardinality under control and a trace that locates the slow span.' },
      { pts: 15, t: 'Measured, not asserted', d: 'The load test analysis by window and endpoint, the objectives, and the budget arithmetic.' },
      { pts: 10, t: 'Operable', d: 'A runbook per alert, a drill that was actually run, and a cost estimate with its assumptions named.' }
    ],
    stretch: [
      'Add a blue green or canary deploy and roll back automatically when the burn rate alert fires',
      'Add a chaos test: kill the database mid request and assert the idempotency from level 12 holds',
      'Add a second instance and prove the advisory lock from level 11 stops two workers doing the same work twice',
      'Publish a dashboard as code, and put the objective and its remaining budget at the top of it'
    ],
    solutionPath: 'solutions/level-20'
  },

  faq: [
    { q: 'Do I need a cloud account for this level?',
      a: 'No. Everything here runs locally with Docker, and the deploy concepts apply the same way whether the container ends up on a managed platform or a single machine you rent.' },
    { q: 'Is 80% coverage the right gate?',
      a: 'It is a reasonable default and a poor target. Coverage tells you what was executed, not what was checked. Use it to find untested files, and judge quality by whether a deliberate bug makes a test fail.' },
    { q: 'My load test numbers do not match the shipped file',
      a: 'They should not. Your machine, your database and your network are different. The shipped file exists so the analysis has a fixed reference, and your own run is the one that tells you about your service.' },
    { q: 'Why 99.9% rather than 99.99%?',
      a: 'Because every nine costs redundancy, caution and money, and the right number comes from what users need rather than from what sounds impressive. Four nines is 4.3 minutes a month, which is less than one bad deploy.' },
    { q: 'Should the SLO be measured from the server or from the client?',
      a: 'From as close to the user as you can get. A server that answers in 40 ms while a load balancer times out is meeting an objective nobody cares about.' },
    { q: 'How much of this would a junior role actually expect?',
      a: 'More of it than most candidates show. Very few portfolio repositories include a pipeline that blocks merges, a load test read by percentile, an objective with the arithmetic, or a cost estimate. Having them is what the rest of this course has been building towards.' },
    { q: 'What comes after level 20?',
      a: 'The twenty repositories you now have, a README on each that explains the decision rather than the feature, and the projects you build because you want them to exist. The course ends here; the habit of measuring before claiming is the part worth keeping.' }
  ]
});
