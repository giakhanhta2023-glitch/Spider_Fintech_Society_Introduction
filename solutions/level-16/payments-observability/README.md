# payments-observability

A pager you would trust, and the measurements that decide what belongs on it.

```bash
pip install -r requirements.txt
pytest -q                     # 29 tests, about a second
python -m obs.experiments     # cardinality, percentiles, buckets, log volume
python -m slo.replay          # thirty days of alerting, five rules judged
python -m gameday.drills      # break nine things, see what notices
```

Nothing above needs Docker, Prometheus or a collector. That is deliberate: a
measurement that only runs on one machine is a measurement nobody repeats. The
compose stack in `docker/` is there for the part that cannot be simulated, and
its header says plainly that it was not exercised here.

The four documents are the deliverable. `slo/OBJECTIVES.md` is the one an
engineer outside the team reads, [POSTMORTEM.md](POSTMORTEM.md) is the one that
teaches the most, and [GAMEDAY.md](GAMEDAY.md) is the one that found two real
mistakes in work that already looked finished.

## 1. What one more label costs

One counter, one more label each time. Series count is the product, and it never
comes back down.

| Labels | Series | Memory | Scrape | Share of a 15 s interval |
|---|---|---|---|---|
| service, endpoint, status | 100 | 0.1 MB | 3.0 ms | 0.02% |
| the same labels, as a histogram | 1,700 | 0.2 MB | 32.1 ms | 0.2% |
| plus region | 400 | 0.0 MB | 14.8 ms | 0.1% |
| plus merchant_id, 50 merchants | 20,000 | 18.7 MB | 791.7 ms | 5.3% |
| plus merchant_id, 500 merchants | **200,000** | **203.8 MB** | **15,734 ms** | **105%** |

Read the last row against the last column. The scrape takes longer than the
interval it has to finish inside, so Prometheus falls behind, and the gaps appear
in the graphs during the incident that created the series. **Monitoring becomes
the outage**, and the pull request that does it is one line long and entirely
reasonable: somebody wanted to know which merchant was generating the errors.

The histogram row is the other thing worth knowing. The same three labels cost
seventeen times as much as a counter, because a histogram is one series per
bucket plus the sum and the count. Fourteen buckets is seventeen series per label
combination, measured rather than assumed.

## 2. Two controls, because they fail differently

```python
LABEL_DOMAINS = {"endpoint": ENDPOINTS, "status_class": STATUS_CLASSES, "queue": QUEUES}
```

**A guard at the call site.** Label values come from a fixed set. An unknown
route becomes `other`, and `/payments/pay_01H9ZQ` becomes `GET /payments/{id}`
before it ever reaches a label, because a path with an id in it is an unbounded
label value and one busy afternoon is a million series.

**A budget checked against the declaration, not against the test's own traffic.**
This is the correction the game day forced. The first version asserted a budget
against a registry the test had populated with fifteen label combinations: it
would have passed with `merchant_id` added and five hundred merchants in
production. `worst_case_series()` now computes the ceiling from the declared label
domains, so a label with no enumerable set of values raises `UnboundedLabel` and
the design is refused rather than measured. The declared ceiling here is 151
series against a budget of 5,000.

## 3. Percentiles, and the panel that catches one bad instance

Ten instances, one of them three times slower, 100,000 requests each:

| Reading | Value |
|---|---|
| True p99 over every request | 393.4 ms |
| Mean of the ten instance p99s | 361.6 ms |
| **Max of the ten instance p99s** | **906.2 ms** |
| A healthy instance alone | 301.1 ms |
| True p99 if all ten were healthy | 301.0 ms |

The average of ten p99s is not the p99 of anything, and it is not an
approximation either: a percentile cannot be averaged, because a mean of
quantiles has no distribution behind it. Here the average read 361.6 ms, which is
close enough to a healthy instance that the dashboard looks normal while one
instance in ten is three times slower than the rest.

Two fixes, both in `slo/burn_rate.yml`:

- **Sum the buckets across instances** and take the quantile of the sum. That is
  arithmetically the pooled distribution, and there is a test asserting exactly
  that: summed bucket counts equal the counts of the concatenated data.
- **Also graph the maximum across instances.** 906.2 ms against an aggregate of
  393.4 ms is the whole value of that panel.

## 4. Buckets, and a dashboard that was wrong by half

The same 500,000 requests, read through two sets of histogram buckets:

| Buckets | Reported p99 | Exact p99 | Error |
|---|---|---|---|
| Prometheus defaults | 450.1 ms | 301.5 ms | **+49.3%** |
| Tuned to this service | 306.3 ms | 301.5 ms | +1.6% |

Nothing was wrong with the code, the query or the library. The p99 landed between
the default 0.25 and 0.5 second edges, a bucket 250 ms wide, and
`histogram_quantile` interpolates linearly inside the bucket it lands in. A
straight line drawn through a range where the distribution is nothing like
straight is a guess, and the guess was 49% high.

Buckets come from the measured distribution, which for this service is bimodal at
roughly 50 ms and 250 ms. `histogram_quantile` is reimplemented in eight lines in
`obs/experiments.py`, and reading it once explains every wrong latency dashboard
you will ever meet.

## 5. What the logs cost

Measured rather than estimated: render the lines this service actually emits,
take the median size, multiply.

| | Volume | At $0.50 a gigabyte |
|---|---|---|
| Everything, 6 lines a request at 200 requests a second | 15.8 GB a day | $2,886 a year |
| The sampling policy, 7.0% of lines kept | 1.1 GB a day | $202 a year |

The median line is 152 bytes. The price is the number to replace with your own:
hosted platforms charge anywhere from a few cents to several dollars a gigabyte,
so at $2.50 the unsampled figure is $14,400 and the argument changes shape.

The policy is a rule rather than a percentage:

```
keep every failed request                        100%
keep every request slower than the objective     100%
keep one in twenty of the ordinary fast ones     deterministic on the request id
```

Deterministic on the request id, so every line of one request is kept or dropped
together. Sampling per line gives you three lines out of nine and a story with
holes in it, which is worse than either extreme.

## 6. One trace, across the queue

The request id is generated once at the edge and lives in a context variable, so
a function four calls deep cannot forget it and no signature carries it. The same
applies to the span context.

The queue is where tracing usually breaks, and it breaks invisibly:

```python
message = api.carry_into_message({"payment_id": "pay_1"})   # traceparent in the body
...
with worker.span("capture", parent=Tracer.continue_from_message(message)):
```

HTTP headers do not survive a queue. The consumer runs minutes later in another
process, and there are no headers left to read, so the context travels inside the
message body and is versioned like any other part of the payload. A broken trace
still renders: the viewer shows two traces, both look plausible, and the half of
the payment that happened after the queue is missing from the one anybody opens.
There is a test for the broken case as well as the whole one, because the broken
case is the one that ships.

Tail sampling keeps 100% of failed traces and 100% of traces over the objective,
asserted rather than promised. Head sampling at 1% keeps 1% of the failures,
which is the same as having no traces during an incident.

## 7. Thirty days of alerting, five rules judged

518.4 million requests, a 0.05% background error rate, two real incidents
(90 minutes at 8% on day 5, 25 minutes at 35% on day 19) and two blips of two and
three minutes that nobody should be woken for. Availability 99.9129%, which meets
a 99.9% target with 87% of the budget spent.

| Rule | Pages | Caught | False | Detection | Stops firing after |
|---|---|---|---|---|---|
| Error rate above 1% for 5 minutes | 4 | 2 of 2 | **2** | instant, instant | 5m, 5m |
| **Multiwindow burn rate** | **2** | **2 of 2** | **0** | 10m, 2m | 28m, 30m |
| Fast burn alone, 14.4x over 1h | 2 | 2 of 2 | 0 | 10m, 2m | 4m, 5m |
| Slow burn alone, 6x over 6h | 2 | 2 of 2 | 0 | 25m, 5m | 28m, 30m |
| Multiwindow with no short windows | 2 | 2 of 2 | 0 | 10m, 2m | **335m, 355m** |

Three things in that table are worth more than the rest of this document.

**The threshold rule is faster and pages for things that do not matter.** Two of
its four pages were blips that had recovered before anybody opened a laptop. A
pager that is wrong half the time is a pager people learn to ignore, which is how
a real incident gets missed.

**Severity scaling comes free.** The burn rate rule found the 35% incident in
2 minutes and the 8% one in 10, with nobody configuring two severities. The worse
the incident, the faster the budget burns, so the alert arrives sooner.

**The short confirming windows are not optional.** Without them the alert keeps
firing for 335 and 355 minutes after the incidents end, because the six hour
window keeps averaging in an outage that is over. Nearly six hours of a firing
alert is how an alert gets silenced, and silenced is how it is configured during
the next incident. The level's own text says "for an hour": measuring it gave five
and a half, and the measurement is the stronger argument.

## 8. The uncomfortable number

In that same month, **the two incidents accounted for 42% of all errors. The
other 58% came from the quiet background rate**, on days when nothing was wrong,
and it never crossed a threshold or woke anybody.

It was spending most of the budget. If it doubled tomorrow it would still never
page, it would simply halve the budget available for real incidents. There is an
assertion on that split in the test suite so it cannot quietly stop being true,
and action 6 of the postmortem is somebody's name against investigating it.

That is the argument for reviewing budget spend monthly rather than only reacting
to pages, and it is the least glamorous finding in this level.

## 9. The error budget, and the float that got in

| Target | May fail | Budget over 30 days | Fast burn above | Slow burn above |
|---|---|---|---|---|
| 99% | 1% | 7 hours 12 minutes | 14.40% | 6.00% |
| 99.9% | 0.1% | 43 minutes 12 seconds | 1.44% | 0.60% |
| 99.95% | 0.05% | 21 minutes 36 seconds | 0.72% | 0.30% |
| 99.99% | 0.01% | 4 minutes 19 seconds | 0.14% | 0.06% |

Every nine costs about ten times the one before it. Four minutes a month is less
time than a deploy takes, less than a failover, and less than one bad migration,
which is worth saying out loud before promising it to anybody.

The third row had a bug. `1 - 0.9995` is 0.0004999999999999449 in binary floating
point, so the budget computed as 1,295.99999 seconds and truncating printed
**21 minutes 35 seconds** for a number that is exactly 21 minutes 36. Level 2's
lesson, turning up in an SLO document eleven levels later. It is rounded now, and
there is a test on the published strings.

## 10. The game day

Nine faults injected into a throwaway copy of this repository, each followed by
the full suite. Nine of nine caught, each by exactly the test you would want to
see fail, in under two seconds of test time.

```bash
python -m gameday.drills
```

It found two real mistakes in finished work: the series budget test that was
measuring itself, and a published claim about alert duration that was understated
by a factor of five. Both are written up in [GAMEDAY.md](GAMEDAY.md), along with
the seven drills this runner cannot do and a running system can.

## What is not here

- **A game day against live infrastructure.** Killing a pod and blackholing a
  database need the compose stack. The drill list is in GAMEDAY.md.
- **Numbers from Prometheus itself.** Every measurement here is from Python, for
  repeatability. The scrape times are real scrapes of real registries through
  `generate_latest`, which is what Prometheus pulls, and the 15 second interval
  they are compared against is a configuration value rather than an observation.
- **A production postmortem.** The one in this folder is written against the
  simulated incident, with every reconstructed sentence marked as one.

## About these numbers

`python -m obs.experiments` and `python -m slo.replay` produce all of them.
Everything seeded is identical on every machine: the percentiles, the bucket
errors, the page counts, the detection times and the 42% split. The timings and
the memory readings are from one Windows laptop, median of three runs, and they
move with whatever else the machine is doing. The level quotes an 8,026 ms scrape
for 200,000 series where this run measured 15,734 ms, on the same laptop on a
different afternoon. Either figure is at or over half the scrape interval, which
is the conclusion.

---

Part of [FinQuest](../../../README.md) level 16.
