/* =========================================================================
   LEVEL 16: the pager, and what it should be allowed to say
   ========================================================================= */
FQ.registerLevel({
  id: 16,
  codename: 'observe',
  title: 'The pager, and what it is allowed to wake you for',
  tagline: 'A dashboard that is wrong by half, a p99 you cannot average, a metric that costs 244 MB because somebody added one label, and an alert that woke four people to tell them nothing. Then the version that works.',
  difficulty: 9,
  minutes: 420,
  tags: ['observability', 'SLOs', 'alerting', 'incident response', 'on-call'],
  summary: 'Every payments job description says ownership and on-call, and almost every candidate answers with the names ' +
           'of tools. This level is the engineering underneath: structured logs, metrics that do not bankrupt you, ' +
           'percentiles aggregated correctly, traces, service level objectives with an error budget, alerts that page ' +
           'for symptoms, a game day, and a postmortem worth reading. Every claim here was measured.',

  objectives: [
    'Choose between a log, a metric and a trace for a given question',
    'Predict what a new label costs before you add it',
    'Aggregate percentiles across instances without producing a fiction',
    'Set histogram buckets for your own latencies rather than the defaults',
    'Write an SLI and an SLO, and spend an error budget deliberately',
    'Alert on burn rate so the pager means something',
    'Run an incident and write a postmortem people will read'
  ],

  knowledge: [
    { h: 'Three kinds of telemetry, three different jobs' },
    { p: 'People say "observability" and mean a vendor. Underneath there are three signals, and picking the wrong one is ' +
         'most of what makes monitoring expensive and useless at the same time:' },
    { table: {
      head: ['Signal', 'Answers', 'Cost grows with', 'Bad at'],
      rows: [
        ['**Log**', '"What exactly happened in this one request?"', 'Traffic, directly', 'Counting anything, and trend over time'],
        ['**Metric**', '"How many, how fast, how often, right now?"', 'Distinct label combinations', 'Telling you about one specific request'],
        ['**Trace**', '"Where did those 400 ms actually go?"', 'Traffic, unless sampled', 'Being cheap enough to keep all of']
      ]
    }},
    { p: 'The rule that follows: **metrics tell you something is wrong, traces tell you where, logs tell you why.** An ' +
         'alert fires on a metric. You open a trace to find the slow span. You read the logs of that one request to find ' +
         'the reason. A team that tries to do all three with logs pays for the privilege and still cannot draw a graph.' },

    { h: 'Structured logs, and the correlation id' },
    { p: 'A log line written for a human is unreadable by a machine, and by the time you need it, a machine is what is ' +
         'reading. So logs are events with fields, not sentences:' },
    { code: '# no\nlog.info(f"payment {pid} for merchant {m} failed after {ms}ms: {err}")\n\n# yes\nlog.info("payment_failed", payment_id=pid, merchant_id=m,\n         duration_ms=ms, error_code=err.code, request_id=ctx.request_id)', lang: 'python' },
    { p: 'The second one can be filtered, counted, grouped and alerted on. The first can be grepped, badly, by somebody ' +
         'who guesses the wording. Three rules make the difference:' },
    { ul: [
      '**One event per line, as JSON,** with a stable event name. `payment_failed` is a name you can query for a year; a sentence is not.',
      '**A request id on everything,** generated at the edge, passed through every service and into every log line and span. Without it you cannot reconstruct one request, which is the only thing logs are good at.',
      '**Allowlist the fields,** exactly as in level 15. Logging is where card numbers go to be leaked.'
    ]},
    { p: 'Then the part nobody plans: **volume**. At 200 requests a second with five log lines each and 250 bytes a line, ' +
         'you are generating 250 kB a second, which is 21.6 GB a day and 7.9 TB a year, before anybody has a bad ' +
         'day. At a typical fifty cents a gigabyte to ingest, that is about $3,900 a year to store logs nobody ' +
         'reads, and ten times that if your traffic is ten times larger.' },
    { tip: 'Sample the boring ones and keep all of the interesting ones. Every error, every slow request and every ' +
           'request from a customer you are investigating; one in a hundred of the successful fast ones. That is usually ' +
           'a ninety percent cut with no loss of debugging power, and it is ten lines of code in your logger.' },

    { h: 'Metrics, and the one label that cost 244 MB' },
    { p: 'A metric is a number with labels. Each distinct combination of label values is a **series**, and the series ' +
         'count is the product of every label\'s cardinality. That multiplication is where the accidents happen. The same ' +
         'counter, measured with more labels each time:' },
    { table: {
      head: ['Labels', 'Series', 'Memory', 'One scrape'],
      rows: [
        ['service, endpoint, status', '100', '0.2 MB', '15 kB in 3.1 ms'],
        ['+ region', '400', '0.8 MB', '71 kB in 13.1 ms'],
        ['+ merchant_id, 50 merchants', '20,000', '25.5 MB', '4,166 kB in 777.8 ms'],
        ['+ merchant_id, 500 merchants', '**200,000**', '**243.6 MB**', '**42 MB in 8,025.9 ms**']
      ]
    }},
    { p: 'Read the last column rather than the memory. Prometheus scrapes every fifteen seconds by default, and that ' +
         'scrape now takes **eight seconds**, of your service\'s own CPU, inside your own process, on the request path. ' +
         'Monitoring has become the outage. And nothing warned anybody: the pull request added one label to one counter ' +
         'and looked entirely reasonable.' },
    { warn: 'Never put an unbounded value in a label. `payment_id`, `user_id`, `email`, a URL with an id in it, an error ' +
            'message, a trace id. Each of those creates a series per value, forever, and the series do not go away when ' +
            'the traffic does. That question belongs to logs or traces, which are built for it.' },
    { p: 'What to measure is a solved problem, and both answers fit on a line. For anything serving requests, the **RED** ' +
         'method: **R**ate, **E**rrors, **D**uration. For anything with a resource, the **USE** method: **U**tilisation, ' +
         '**S**aturation, **E**rrors. Between them they cover almost every dashboard worth having.' },
    { check: {
      q: 'A colleague wants `merchant_id` on the request counter so support can see one merchant\'s traffic. You know ' +
         'what it costs. Refusing is easy and unhelpful, so what do you offer?',
      a: 'Start by agreeing the need is real and separating it from the mechanism. Per merchant traffic is a question ' +
         'about specific requests, which is what logs and traces are for: the request id and merchant id are already on ' +
         'every log line, so support can filter there today at no cost to the metrics system. If a graph is genuinely ' +
         'wanted, offer a bounded version: a label for the merchant *tier*, or the top twenty merchants by volume with ' +
         'everything else bucketed as "other", which keeps the series count fixed while the merchant list changes. And ' +
         'if per merchant time series are a real product requirement rather than a debugging convenience, that is a ' +
         'different system, with an aggregation job and its own storage, sized on purpose rather than by accident.'
    }},

    { h: 'You cannot average percentiles' },
    { p: 'Ten instances behind a load balancer. Each reports its own p99. The dashboard averages them, because that is ' +
         'what dashboards do. One instance is unhealthy and three times slower than the rest. Measured:' },
    { table: {
      head: ['', 'p99'],
      rows: [
        ['True p99 over all ten instances\' requests', '**393.4 ms**'],
        ['The average of the ten instance p99s', '361.6 ms'],
        ['The maximum of the ten instance p99s', '906.2 ms'],
        ['The unhealthy instance on its own', '906.2 ms'],
        ['A healthy instance', '301.1 ms']
      ]
    }},
    { p: 'The average reports 361.6 ms, which is lower than the truth and only 20% above a healthy instance, so it looks ' +
         'like ordinary variation. Meanwhile one in ten of your customers is being served at 906 ms. **The average of ' +
         'percentiles is not a percentile of anything**, and it reliably hides exactly the situation you built the ' +
         'dashboard for.' },
    { p: 'Two fixes, and you want both:' },
    { ul: [
      '**Aggregate the histograms, not the quantiles.** Sum the bucket counts across instances first and take the quantile of the sum, which is what `histogram_quantile(0.99, sum(rate(...)) by (le))` does in Prometheus. That gives the true 393.4 ms.',
      '**Also graph the maximum across instances,** and alert on it. The maximum found the sick instance immediately, at 906.2 ms, and that one line turns a mystery into a machine you can restart.'
    ]},

    { h: 'And your histogram is probably lying' },
    { p: 'A histogram does not store latencies. It stores counts per bucket, and the quantile is interpolated inside ' +
         'whichever bucket the target falls in. So the buckets decide the accuracy, and the defaults were chosen for ' +
         'nobody in particular. The same 500,000 latencies, two sets of buckets:' },
    { table: {
      head: ['Buckets', 'p99 reported', 'p99 actual', 'Error'],
      rows: [
        ['Prometheus defaults', '450.1 ms', '301.5 ms', '**+49.3%**'],
        ['Tuned to this service', '306.3 ms', '301.5 ms', '+1.6%']
      ]
    }},
    { p: 'Half of the reported p99 was an artefact of the bucket edges. With the defaults, the 99th percentile landed in ' +
         'the bucket between 250 ms and 500 ms, and the interpolation across a gap that wide is a guess. A team watching ' +
         'that dashboard would chase a latency problem that does not exist, or miss the moment a real one begins, ' +
         'because a 50% error swamps the change they were looking for.' },
    { tip: 'Pick buckets from your own measured distribution, tight around the region you care about and around your ' +
           'target. If your p99 target is 300 ms, you want several edges between 200 ms and 400 ms. Doing this once, ' +
           'with a histogram of your actual latencies in front of you, takes twenty minutes and fixes every graph you ' +
           'will draw afterwards.' },

    { h: 'Traces: where the time went' },
    { p: 'A **trace** follows one request across every service it touches. Each unit of work is a **span**, with a start, ' +
         'a duration, a parent, and attributes. Traces answer the question metrics cannot: the p99 is 400 ms, and the ' +
         'trace says 310 ms of it was one fraud check that nobody suspected.' },
    { code: 'trace 8f2c...  POST /payments                              412 ms\n  ├─ auth.verify_token                                 1 ms\n  ├─ db.select idempotency_keys                        4 ms\n  ├─ fraud.check                                     310 ms   <- there it is\n  │    └─ http POST fraud-svc/score                  308 ms\n  ├─ db.insert payments                                9 ms\n  ├─ ledger.post_entries                              71 ms\n  └─ outbox.write                                      6 ms', lang: 'text' },
    { p: 'The mechanism you have to understand is **context propagation**: a trace id and the current span id travel with ' +
         'the request, usually in a `traceparent` header, and every service passes them on. Miss one hop and the trace ' +
         'breaks in half, which is the single most common problem with a new tracing setup. The same context carries the ' +
         'request id into your logs, so a span and its log lines can be put side by side.' },
    { p: 'Traces cost the same as logs, so they get sampled, and there are two ways:' },
    { ul: [
      '**Head sampling** decides at the start, before anything has happened. Cheap, and it throws away errors at exactly the same rate as successes, so at 1% sampling you keep 1% of your incidents.',
      '**Tail sampling** buffers the spans and decides once the request is finished, so you can keep everything slow, everything that errored, and one in a hundred of the rest. More infrastructure, and it is the one you want.'
    ]},

    { h: 'Service level objectives, and what a budget is for' },
    { p: 'Three words that get used interchangeably and are not:' },
    { table: {
      head: ['Term', 'Is', 'Example'],
      rows: [
        ['**SLI**', 'The measurement', 'Share of requests answered in under 300 ms with a 2xx'],
        ['**SLO**', 'The target for that measurement', '99.9% over 30 days'],
        ['**SLA**', 'The contract, with money attached', '99.5%, or the customer gets a refund']
      ]
    }},
    { p: 'The SLO is chosen, and the thing it buys you is the **error budget**: the failure the target permits. Over ' +
         'thirty days:' },
    { table: {
      head: ['Target', 'Budget', 'Which is'],
      rows: [
        ['99%', '1% of requests', '7 hours 12 minutes'],
        ['99.9%', '0.1%', '43 minutes 12 seconds'],
        ['99.95%', '0.05%', '21 minutes 36 seconds'],
        ['99.99%', '0.01%', '4 minutes 19 seconds']
      ]
    }},
    { p: 'Look at the last row before you promise it. Four minutes a month is less time than a deploy takes, less than a ' +
         'failover, and less than one bad database migration. **Every nine costs roughly ten times more than the one ' +
         'before**, and a target you cannot meet teaches everybody to ignore the dashboard.' },
    { money: 'The budget is a decision rule, which is the part people miss. Budget remaining means ship: take the risk, ' +
             'do the migration, run the experiment. Budget exhausted means stop feature work and spend the time on ' +
             'stability. Written down in advance, it ends the argument between the people who want to ship and the ' +
             'people who want it to stay up, because both sides already agreed the number.' },

    { h: 'Alerting: the measurement that should change your mind' },
    { p: 'Thirty days simulated minute by minute: 518.4 million requests, a quiet background error rate of about 0.05%, ' +
         'two real incidents (90 minutes at 8% on day 5, 25 minutes at 35% on day 19) and two brief blips of two or ' +
         'three minutes that nobody should be woken for. Availability came out at 99.9129%, which meets a 99.9% target ' +
         'with 87% of the error budget spent.' },
    { p: 'Two alerting strategies over exactly that month. One is the obvious threshold. The other is a **burn rate** ' +
         'alert, which asks how fast the error budget is being consumed rather than what the error rate is:' },
    { table: {
      head: ['', 'Error rate above 1% for 5 minutes', 'Multiwindow burn rate'],
      rows: [
        ['Pages in the month', '4', '**2**'],
        ['Real incidents caught', '2 of 2', '2 of 2'],
        ['**False pages**', '**2**', '**0**'],
        ['Detected the 8% incident after', '0 minutes', '10 minutes'],
        ['Detected the 35% incident after', '0 minutes', '2 minutes']
      ]
    }},
    { p: 'The threshold alert is faster and pages for things that do not matter. Two of its four pages were three minute ' +
         'blips that had recovered before anybody opened a laptop, and a pager that is wrong half the time is a pager ' +
         'people learn to ignore, which is how a real incident gets missed.' },
    { p: 'The burn rate alert fired twice, both times for a real incident, and never otherwise. Its detection time is the ' +
         'elegant part: **it found the 35% outage in 2 minutes and the 8% one in 10, without anybody configuring two ' +
         'severities.** The worse the incident, the faster the budget burns, so the alert arrives sooner. Severity ' +
         'scaling comes free.' },
    { code: '# fast burn: 14.4x the budget rate over an hour, confirmed by a 5 minute window\n#   at 14.4x you would spend a 30 day budget in about 2 days -> page now\n# slow burn:  6x over six hours, confirmed by a 30 minute window\n#   slower, but still headed for an empty budget -> page, less urgently\n#\n# the short window is there so the alert stops when the incident does', lang: 'text' },
    { p: 'The last comment matters more than it looks. Without a short confirming window, a one hour window keeps the ' +
         'alert firing for an hour after the incident is over, and somebody eventually turns it off during the next one.' },
    { check: {
      q: 'In the same month, the two incidents produced only 42% of all errors. The other 58% came from the ordinary ' +
         'background rate of 0.05%, on days when nothing was wrong. What does that tell you, and what would you do?',
      a: 'That most of the budget was spent by something nobody has ever investigated, because it never crossed any ' +
         'threshold and never woke anybody. The two incidents are memorable and were 42%; the quiet constant failure was ' +
         'the majority, and if the background rate doubled tomorrow it would still never page, it would simply halve ' +
         'the budget available for real incidents. What to do is look at it: group those errors by endpoint, status and ' +
         'customer, and they are usually a small number of causes, such as one client sending malformed requests, one ' +
         'timeout set too tight, or a retry path that fails the first time by design. Fixing two of them is often worth ' +
         'more budget than any amount of incident response, and it is work nobody is currently assigned because the ' +
         'alerting is silent about it. This is also the argument for reviewing budget spend monthly rather than only ' +
         'reacting to pages.'
    }},

    { h: 'Symptoms page, causes do not' },
    { p: 'The rule that keeps the pager honest: **page for what the customer experiences, not for what a machine is ' +
         'doing.** A disk at 91% is not an outage; it is a ticket. Payments failing is an outage.' },
    { table: {
      head: ['Page for this', 'Do not page for this'],
      rows: [
        ['Payment success rate below the objective', 'CPU above 80%'],
        ['p99 latency above the objective', 'A single instance restarting'],
        ['The payout queue growing without draining', 'Disk at 85%'],
        ['Anything in a non final state for too long (level 12)', 'A deploy happening'],
        ['Reconciliation breaks above the threshold (level 10)', 'A cache hit ratio falling']
      ]
    }},
    { p: 'Everything in the right column becomes a dashboard panel or a ticket. They are useful during an incident and ' +
         'they are not reasons to wake somebody, because none of them means a customer is affected and several of them ' +
         'are normal. Every alert also needs one more thing before it may page: **a runbook** saying what the alert ' +
         'means, what to check first, what to do, and who to escalate to. An alert with no runbook is a question mark ' +
         'delivered at three in the morning.' },

    { h: 'The incident, and the hour after it' },
    { p: 'When it goes wrong, the failure mode is six people investigating the same thing and nobody talking to the ' +
         'customer. So incidents have roles, even small ones:' },
    { table: {
      head: ['Role', 'Does', 'Does not'],
      rows: [
        ['Incident commander', 'Decides, assigns, keeps the timeline', 'Debug. The moment they debug, nobody is running it'],
        ['Operations', 'Investigates and makes the changes', 'Talk to customers'],
        ['Communications', 'Updates the status page and the internal channel', 'Wait for certainty before saying anything'],
        ['Scribe', 'Writes down what happened and when, as it happens', 'Reconstruct it afterwards from memory']
      ]
    }},
    { p: 'Two habits are worth more than any tooling. **Mitigate before diagnosing**: roll back, fail over, turn the ' +
         'feature off, and find out why afterwards, because the customer is paying for every minute of your curiosity. ' +
         'And **write the timeline while it happens**, because memory rearranges itself within hours and the timeline is ' +
         'the entire value of the postmortem.' },
    { p: 'The postmortem itself is blameless, and blameless has a technical meaning rather than a polite one: **you ' +
         'assume everybody acted reasonably given what they knew at the time**, and you ask what made the wrong action ' +
         'look right. "Engineer ran the wrong migration" is not a finding. "The migration tool defaults to production ' +
         'and the confirmation prompt shows the database name in the same colour as everything else" is a finding, and ' +
         'it produces a fix.' },
    { ul: [
      '**What happened,** as a timeline with timestamps, including when you noticed and how.',
      '**Impact,** in customer terms and in numbers: how many payments, how much money, how long.',
      '**Why,** several layers deep. The first answer is never the cause, it is the last thing that happened.',
      '**What made it worse,** which is usually where the real lessons are: a missing alert, a stale runbook, an ambiguous dashboard.',
      '**Actions,** each with one named owner and a date. Actions with no owner are a wish list.'
    ]},

    { h: 'The game day' },
    { p: 'You do not know whether any of this works until something breaks, and choosing when it breaks is better than ' +
         'being told. A **game day** is a scheduled, announced exercise where you break something on purpose and practise ' +
         'the response.' },
    { ul: [
      'Stop the database. Does an alert fire, does the runbook match, does the service fail in the way you expected?',
      'Add 500 ms of latency to a dependency. Do your timeouts hold, does the circuit breaker open (level 14), does the pager stay quiet if the customer is unaffected?',
      'Fill the payout queue. Does the stuck detection from level 12 fire before a customer notices?',
      'Revoke a credential. Does the service fail clearly, and is the runbook for rotating it correct?'
    ]},
    { p: 'The result to write down is not whether the system survived. It is **which alert did not fire, which runbook ' +
         'was wrong, and how long it took to work out who to call.** Those are the three things that are always wrong the ' +
         'first time, and finding them at two in the afternoon costs nothing.' }
  ],

  tutorial: {
    intro: 'Instrument the service you already have from levels 7 and 14, then break it deliberately. The deliverables ' +
           'that matter are the SLO document, the alert rules and the postmortem, because those are what an interviewer ' +
           'has never seen from a candidate. Work in a repository called `payments-observability`.',
    steps: [
      {
        t: 'Structured logs with a request id',
        blocks: [
          { p: 'JSON, one event per line, a stable event name, and a request id generated at the edge and attached to ' +
               'every line for the life of the request. Use a context variable so you are not passing it through every ' +
               'function signature.' },
          { code: 'log.info("payment_failed", payment_id=pid, merchant_id=m,\n         duration_ms=ms, error_code=err.code, request_id=ctx.request_id)', lang: 'python' },
          { p: 'Then measure your own volume: bytes per line times lines per request times your request rate, in ' +
               'gigabytes a day and dollars a year. Put the number in the README and add sampling until you are happy ' +
               'with it.' }
        ],
        check: 'Every log line from one request shares a request id, and you can state your log bill in dollars a year.'
      },
      {
        t: 'RED metrics, and a cardinality budget',
        blocks: [
          { p: 'Rate, errors and duration for every endpoint. Then write down the series count your labels produce, and ' +
               'reproduce what happens when somebody adds a high cardinality one.' },
          { code: 'service, endpoint, status          100 series    0.2 MB   scrape  3.1 ms\n+ merchant_id (500 merchants)  200,000 series  243.6 MB   scrape  8,025.9 ms', lang: 'text' },
          { p: 'An eight second scrape with a fifteen second interval is the moment monitoring becomes the outage. Add a ' +
               'test that fails if the total series count goes above a number you choose.' }
        ],
        check: 'A pull request adding an unbounded label fails a test instead of reaching production.'
      },
      {
        t: 'Fix the two lies in your latency graph',
        blocks: [
          { p: 'First, aggregate histograms rather than averaging quantiles, and prove the difference by making one ' +
               'instance slow on purpose.' },
          { code: 'true p99 across ten instances     393.4 ms\naverage of the ten instance p99s  361.6 ms   <- hides it\nmax of the ten instance p99s      906.2 ms   <- finds it', lang: 'text' },
          { p: 'Second, set your buckets from your own measured distribution, and show what the defaults were reporting.' },
          { code: 'Prometheus defaults   p99 reported 450.1 ms   actual 301.5 ms   +49.3%\ntuned buckets         p99 reported 306.3 ms   actual 301.5 ms    +1.6%', lang: 'text' }
        ],
        check: 'Your dashboard p99 matches a p99 computed directly from raw timings, within a few percent.'
      },
      {
        t: 'Trace one request end to end',
        blocks: [
          { p: 'OpenTelemetry, spans around every outbound call and every database query, and context propagated across ' +
               'services through the `traceparent` header. The acceptance test is a single trace showing the whole ' +
               'payment across every service, with no break.' },
          { p: 'Then add tail sampling: keep everything that errored, everything over your target, and one in a hundred ' +
               'of the rest. Report what share of spans you kept.' },
          { warn: 'Check the trace crosses your message queue too. A trace that stops at the outbox from level 11 is the ' +
                  'usual outcome, because the context has to travel in the message rather than in a header.' }
        ],
        check: 'One trace shows the full path of a payment including the part that happens after the queue.'
      },
      {
        t: 'Write the SLO document',
        blocks: [
          { p: 'One page. For each of two or three user journeys: the SLI in precise words, the target, the window, the ' +
               'budget in minutes, and what happens when it runs out.' },
          { code: 'SLI     share of POST /payments answered in under 300 ms with a 2xx or 4xx\nSLO     99.9% over a rolling 30 days\nbudget  0.1%, which is 43 minutes 12 seconds\npolicy  budget under 25%: feature work pauses, reliability work only', lang: 'text' },
          { tip: 'Counting 4xx as success is deliberate and worth a sentence in your document. A client sending ' +
                 'malformed requests is not your service failing, and an SLI that counts it will send you chasing ' +
                 'somebody else\'s bug.' }
        ],
        check: 'Somebody outside your team can read the document and say whether you met the objective last month.'
      },
      {
        t: 'Burn rate alerts, replayed against a month',
        blocks: [
          { p: 'Implement the multiwindow rule, then replay a month of synthetic traffic containing two real incidents ' +
               'and a couple of harmless blips, and count pages.' },
          { code: 'threshold, error rate > 1% for 5 min   4 pages   2 false   detects at 0 and 0 min\nmultiwindow burn rate                  2 pages   0 false   detects at 10 and 2 min', lang: 'text' },
          { p: 'Note that the burn rate alert found the worse incident faster without anybody configuring severities. ' +
               'Write that sentence in your README: it is the whole argument.' }
        ],
        check: 'Replaying the month produces no false pages and catches both incidents.'
      },
      {
        t: 'A runbook per alert',
        blocks: [
          { p: 'No alert pages without one. Four sections: what this means in customer terms, the first three things to ' +
               'check, the safe mitigations in order, and who to escalate to.' },
          { p: 'Then the test that keeps them honest: a check that fails if any alert rule has no runbook link, and a ' +
               'date on each runbook so a stale one is visible.' }
        ],
        check: 'Every alert links to a runbook, enforced by a test rather than by a convention.'
      },
      {
        t: 'Run a game day and write the postmortem',
        blocks: [
          { p: 'Announce it, break something real, and time yourselves: how long until an alert fired, until somebody ' +
               'understood it, until it was mitigated.' },
          { code: 'broke          the ledger database, at 14:02\nalert fired    14:03:40   (payment success rate)\nunderstood     14:09      (runbook pointed at the wrong dashboard)\nmitigated      14:12      (failed over)\n\nfound: no alert on replication lag; runbook stale since March', lang: 'text' },
          { p: 'Write the postmortem properly: timeline, impact in money and payments, several layers of why, what made ' +
               'it worse, and actions with a named owner and a date. This document is the deliverable an interviewer ' +
               'will actually read, because almost no candidate has one.' }
        ],
        check: 'The postmortem names at least two things that were wrong before the incident started.'
      }
    ]
  },

  glossary: [
    { t: 'Observability', d: 'Being able to answer new questions about a running system without shipping code.' },
    { t: 'Structured log', d: 'An event with fields, as JSON, with a stable name you can query for years.' },
    { t: 'Request id', d: 'An identifier attached at the edge and carried through every service, log and span.' },
    { t: 'Series', d: 'One distinct combination of metric label values. The unit of cost in a metrics system.' },
    { t: 'Cardinality', d: 'How many distinct values a label takes. Series count is the product across labels.' },
    { t: 'RED', d: 'Rate, errors, duration. What to measure for anything serving requests.' },
    { t: 'USE', d: 'Utilisation, saturation, errors. What to measure for a resource.' },
    { t: 'Histogram bucket', d: 'A latency range with a count. Quantiles are interpolated inside them, so edges matter.' },
    { t: 'Span', d: 'One unit of work in a trace, with a start, a duration, a parent and attributes.' },
    { t: 'Context propagation', d: 'Carrying the trace and request ids across every hop, including queues.' },
    { t: 'Head sampling', d: 'Deciding to keep a trace before the request runs. Cheap, and it discards errors equally.' },
    { t: 'Tail sampling', d: 'Deciding after the request finishes, so you can keep everything slow or failed.' },
    { t: 'SLI', d: 'The measurement: the share of requests that were good, by your definition of good.' },
    { t: 'SLO', d: 'The target for an SLI over a window, such as 99.9% over 30 days.' },
    { t: 'SLA', d: 'A contract with money attached, always looser than the SLO you run to.' },
    { t: 'Error budget', d: 'The failure the objective permits. 99.9% over 30 days is 43 minutes 12 seconds.' },
    { t: 'Burn rate', d: 'How fast the budget is being spent, as a multiple of the steady rate.' },
    { t: 'Runbook', d: 'What an alert means, what to check, what to do, who to escalate to.' },
    { t: 'Incident commander', d: 'The person who decides and assigns during an incident, and does not debug.' },
    { t: 'Blameless postmortem', d: 'Assuming everyone acted reasonably, and asking what made the wrong action look right.' },
    { t: 'Game day', d: 'A scheduled exercise where you break something on purpose and practise the response.' }
  ],

  quiz: [
    { q: "Which signal answers \"how many payments failed in the last hour\"?",
      options: [
        "A profile",
        "A metric",
        "A trace",
        "A log"
      ],
      answer: 1,
      why: "Metrics tell you something is wrong, traces tell you where, logs tell you why." },

    { q: "Adding merchant_id with 500 values took a counter from 400 series to 200,000. What broke first?",
      options: [
        "Disk on the metrics server",
        "The dashboard",
        "The scrape, which went from 13.1 ms to 8,025.9 ms while Prometheus polls every 15 seconds",
        "Memory, at 243.6 MB"
      ],
      answer: 2,
      why: "Eight seconds of your own CPU, in your own process, every fifteen seconds. Monitoring became the outage." },

    { q: "Which of these must never be a metric label?",
      options: [
        "payment_id",
        "Endpoint",
        "HTTP status",
        "Region"
      ],
      answer: 0,
      why: "An unbounded value creates a series per value, forever, and the series outlive the traffic." },

    { q: "Ten instances, one unhealthy. True p99 393.4 ms, average of instance p99s 361.6 ms, max 906.2 ms. What is wrong with the average?",
      options: [
        "It is too high",
        "It should be a median instead",
        "Nothing, it is a reasonable approximation",
        "It is not a percentile of anything, and it hides the sick instance that is serving one customer in ten at 906 ms"
      ],
      answer: 3,
      why: "Aggregate the histogram buckets first, and also graph the maximum across instances." },

    { q: "How do you compute a correct p99 across instances in Prometheus?",
      options: [
        "avg of each instance's p99",
        "max of each instance's p99",
        "The p99 of the p99s",
        "histogram_quantile over the summed bucket rates"
      ],
      answer: 3,
      why: "Sum the buckets across instances, then take the quantile of the sum. That produced the true 393.4 ms." },

    { q: "With default buckets the dashboard reported a p99 of 450.1 ms when the real value was 301.5 ms. Why?",
      options: [
        "The metric was scraped too rarely",
        "The 99th percentile fell in a bucket spanning 250 ms to 500 ms, so the interpolation across that gap was a guess",
        "The histogram lost data",
        "The clock was wrong"
      ],
      answer: 1,
      why: "A 49.3% error, entirely from the bucket edges. Tuned buckets brought it to 1.6%." },

    { q: "What is the most common failure when adding tracing to an existing system?",
      options: [
        "Clock skew",
        "Sampling too little",
        "Missed context propagation on one hop, usually a queue, which breaks the trace in half",
        "Too many spans"
      ],
      answer: 2,
      why: "Across a queue, the context has to travel in the message rather than in a header." },

    { q: "Why is head sampling a poor choice for a payments service?",
      options: [
        "It is more expensive",
        "It breaks context propagation",
        "It decides before the request runs, so at 1% sampling you keep 1% of your incidents",
        "It requires more infrastructure"
      ],
      answer: 2,
      why: "Tail sampling keeps everything slow or failed and one in a hundred of the rest." },

    { q: "A 99.9% objective over thirty days is how much failure?",
      options: [
        "43 minutes 12 seconds",
        "21 minutes 36 seconds",
        "4 minutes 19 seconds",
        "7 hours 12 minutes"
      ],
      answer: 0,
      why: "And 99.99% is 4 minutes 19 seconds, which is shorter than one bad deploy." },

    { q: "What is an error budget actually for?",
      options: [
        "Calculating SLA refunds",
        "A rule agreed in advance: budget remaining means ship, budget exhausted means stop feature work and fix stability",
        "Reporting to management",
        "Deciding when to page"
      ],
      answer: 1,
      why: "It ends the argument between shipping and stability, because both sides already agreed the number." },

    { q: "Over a simulated month, the threshold alert paged 4 times and the burn rate alert paged twice. What was the real difference?",
      options: [
        "The burn rate alert was slower on everything",
        "The burn rate alert missed an incident",
        "Both caught both incidents, but two of the threshold pages were harmless blips and the burn rate alert had none",
        "The threshold alert used less CPU"
      ],
      answer: 2,
      why: "A pager that is wrong half the time is a pager people learn to ignore." },

    { q: "The burn rate alert detected the 35% incident in 2 minutes and the 8% one in 10. Why is that useful?",
      options: [
        "Because it uses a shorter window",
        "It is a coincidence of the simulation",
        "Because 35% is above the threshold",
        "Because severity scaling comes free: the worse the incident, the faster the budget burns, so the alert arrives sooner with no extra configuration"
      ],
      answer: 3,
      why: "One rule, and it behaves like two severities you never had to write." },

    { q: "Why does a burn rate alert need a short confirming window as well as a long one?",
      options: [
        "So the alert stops firing when the incident ends, rather than an hour later",
        "To detect faster",
        "To smooth the data",
        "To reduce false positives at the start"
      ],
      answer: 0,
      why: "Otherwise somebody turns it off during the next incident, having learned it lies." },

    { q: "Which of these should page somebody at three in the morning?",
      options: [
        "Payment success rate below the objective",
        "CPU above 80%",
        "An instance restarting",
        "Disk at 85%"
      ],
      answer: 0,
      why: "Page for symptoms the customer feels. Causes become dashboard panels and tickets." },

    { q: "What makes a postmortem blameless in a technical sense?",
      options: [
        "Only writing about the system",
        "Assuming everyone acted reasonably given what they knew, and asking what made the wrong action look right",
        "Having a manager approve it",
        "Not naming anybody"
      ],
      answer: 1,
      why: "\"Ran the wrong migration\" is not a finding. \"The tool defaults to production\" is, and it has a fix." }
  ],

  project: {
    title: 'payments-observability: a pager you would trust',
    story: 'Take the service you built in levels 7 and 14 and make it operable. Structured logs with a request id, RED ' +
           'metrics with a cardinality budget, correct percentiles, traces that survive the queue, an SLO document, ' +
           'burn rate alerts replayed against a month of traffic, a runbook per alert, and a game day with a real ' +
           'postmortem at the end.',
    scope: 'Prometheus, Grafana and an OpenTelemetry collector in Docker Compose. The measurements and the documents are ' +
           'the deliverable. A dashboard nobody can interpret scores nothing.',
    requirements: [
      'JSON structured logging with stable event names and a request id attached at the edge and carried everywhere',
      'A measured log volume in gigabytes a day and dollars a year, and a sampling policy that keeps all errors and slow requests',
      'RED metrics on every endpoint, with a written cardinality budget and the series count each label set produces',
      'A test that fails when the total series count exceeds your budget',
      'A reproduction of the cardinality accident: series count, memory and scrape time before and after a high cardinality label',
      'Correct cross instance percentiles by aggregating histogram buckets, demonstrated against one deliberately slow instance',
      'A maximum-across-instances panel, and the explanation of what it catches that the average hides',
      'Histogram buckets chosen from your own measured distribution, with the reported p99 compared against an exact p99 from raw timings',
      'Distributed tracing with context propagated across services and across the queue, shown as one unbroken trace',
      'Tail sampling that keeps everything failed or slow, with the retained share reported',
      'An SLO document for at least two journeys: SLI in precise words, target, window, budget in minutes, and the policy when it runs out',
      'Multiwindow burn rate alert rules, replayed against a month of synthetic traffic with two incidents and some harmless blips',
      'The page count, false page count and detection time for your rules against a naive threshold, in a table',
      'A runbook for every alert, and a test that fails if an alert has no runbook',
      'A game day: what you broke, the timings, and at least two things it found that were wrong beforehand',
      'A postmortem with a timeline, impact in money, layered causes, what made it worse, and actions with owners and dates',
      'The repository public on GitHub as `payments-observability`'
    ],
    starter: {
      lang: 'python',
      code: '"""FinQuest level 16: making the service operable.\n\nLayout:\n  obs/logging.py      JSON events, stable names, request id from context\n  obs/metrics.py      RED metrics, and the cardinality budget test\n  obs/tracing.py      OpenTelemetry, propagation including across the queue\n  slo/OBJECTIVES.md   SLI, SLO, window, budget, and the policy\n  slo/burn_rate.yml   the multiwindow rules\n  slo/replay.py       a month of traffic, and the page count it produces\n  runbooks/           one per alert, each with a date\n  POSTMORTEM.md       written after the game day\n"""\n\nSECONDS_IN_30_DAYS = 30 * 24 * 60 * 60\n\n\ndef error_budget(objective: float, window_seconds: int = SECONDS_IN_30_DAYS) -> float:\n    """99.9% over 30 days is 2,592 seconds: 43 minutes 12 seconds."""\n    return (1 - objective) * window_seconds\n\n\ndef burn_rate(error_ratio: float, objective: float) -> float:\n    """How many times faster than the budget allows. 14.4x empties a 30 day\n    budget in about two days, which is why it is the fast page threshold."""\n    return error_ratio / (1 - objective)\n\n\nMAX_SERIES = 5_000          # chosen, written down, and enforced by a test\n\n\ndef series_count(registry) -> int:\n    """Fails the build when somebody adds an unbounded label."""\n    # TODO\n    raise NotImplementedError\n'
    },
    tests: [
      'Every log line emitted during one request carries the same request id',
      'No log line contains a value outside the allowlist',
      'The metrics registry stays under the series budget, and the test fails when a high cardinality label is added',
      'The p99 from aggregated histogram buckets matches an exact p99 from raw timings within a few percent',
      'Averaging instance p99s is demonstrably wrong when one instance is slow, and the max panel catches it',
      'A single trace covers the whole payment including the part after the queue',
      'Tail sampling retains 100% of failed requests and 100% of requests over the target',
      'Every alert rule has a runbook link',
      'Replaying the synthetic month produces zero false pages and catches both incidents',
      'The burn rate rule stops firing within minutes of an incident ending',
      'The error budget calculation matches the published minutes for 99%, 99.9%, 99.95% and 99.99%'
    ],
    rubric: [
      { pts: 20, t: 'Signals used properly', d: 'Structured logs with a request id, RED metrics, traces that cross the queue, each answering what it is for.' },
      { pts: 20, t: 'Cardinality understood', d: 'A written budget, an enforcing test, and a reproduction of the accident with series, memory and scrape time.' },
      { pts: 20, t: 'Correct numbers', d: 'Cross instance percentiles aggregated properly, buckets tuned, and both compared against exact values.' },
      { pts: 20, t: 'SLOs and alerting', d: 'An SLO document with a budget policy, multiwindow burn rate rules, and the replay table against a naive threshold.' },
      { pts: 20, t: 'Operability', d: 'A runbook per alert enforced by a test, a game day with timings, and a postmortem with owned actions.' }
    ],
    stretch: [
      'Add exemplars so a point on the latency graph links to a trace of one slow request',
      'Implement adaptive log sampling that keeps a fixed volume per second regardless of traffic',
      'Add a second SLO on data correctness rather than availability, such as the reconciliation break rate from level 10',
      'Build the burn rate replay as a continuous test, so changing an alert rule shows the page count change in the pull request',
      'Run a game day with somebody who did not build the system and record how long the runbooks take them'
    ],
    solutionPath: 'solutions/level-16'
  },

  faq: [
    { q: 'Do I need Prometheus and Grafana specifically?',
      a: 'No, and the concepts move between tools unchanged: series and cardinality, histogram buckets, quantile aggregation, burn rate. Use whatever you can run locally in Docker. The interview question is never which tool, it is what you measured and why.' },
    { q: 'How do I pick an SLO number?',
      a: 'From what users already tolerate, not from ambition. Look at your current performance over the last few months and set the objective a little tighter than your typical month. A target you have never met teaches everybody to ignore the dashboard, and every extra nine costs about ten times more than the one before.' },
    { q: 'Should 4xx responses count against the objective?',
      a: 'Usually not, because a client sending malformed requests is that client failing rather than your service. Write the decision into the SLI in words, because it changes the number a great deal and somebody will ask.' },
    { q: 'What if an incident is caused by a dependency I do not control?',
      a: 'It still spends your budget, because your users experienced it. That is the point of measuring from the user in: it puts the conversation about that dependency on a factual basis, with minutes attached, which is far more persuasive than an opinion about their reliability.' },
    { q: 'Our logging bill is enormous. Where do I start?',
      a: 'Count first: bytes per line times lines per request times requests per second. Then the two cheapest cuts, in order, are removing lines that are logged on the success path and never read, and sampling the remaining successful requests while keeping every error and every slow one. Ninety percent reductions are common and nobody misses the data.' },
    { q: 'How many alerts should a service have?',
      a: 'Few enough that every page is investigated. A handful of symptom alerts tied to objectives, plus the specific invariants from earlier levels: stuck payouts, reconciliation breaks, unfinished states. If a page has been ignored twice, either delete it or fix what makes it noisy.' },
    { q: 'What do I say about this project in an interview?',
      a: 'The alerting replay, because it is a number almost nobody has: over a simulated month, a threshold alert paged four times with two false pages, while multiwindow burn rate paged twice with none, and found the worse incident in two minutes against ten for the milder one without anybody configuring severities. Then the histogram result, because it is uncomfortable and true: default buckets reported a p99 of 450 ms when the real value was 301 ms.' }
  ]
});
