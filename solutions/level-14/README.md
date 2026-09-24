# Level 14: The p99 you promised

> **latency-lab: the p99 you can defend** · build project · difficulty 9/10

## Read this second

Attempt the build yourself first, then ask the FinQuest tutor for a hint, and only then open this folder.
Read the part you are stuck on, close the file, and retype the fix from memory. Copying the solution into
your own project skips the only step that actually teaches you anything.

## The brief

Take a payments endpoint, put it under honest load, and find out what it actually does. Then make it meet a latency target you write down in advance, using caching, a rate limiter, timeouts, a circuit breaker and load shedding, and prove each one with a before and after.

**Scope:** Build on the level 7 API and the level 8 load work. Redis runs in Docker with one command. The deliverable is a latency report with measurements for every claim, and a stated load at which you meet your budget.

## Files here

| File | What it is |
|------|------------|
| `lab/generate.py` | open loop arrivals, Poisson, fire and forget |
| `lab/report.py` | percentiles, goodput, status codes, median of three runs |
| `svc/cache.py` | Redis, single flight, and the list of what is never cached |
| `svc/limiter.py` | a token bucket in Lua, atomic, keyed per customer |
| `svc/breaker.py` | closed, open, half open, with the thresholds explained |
| `svc/shed.py` | a queue depth limit and a 503 with Retry-After |
| `BUDGET.md` | the latency budget, with measured numbers beside each line |
| `quiz-key.md` | all 15 drill answers with explanations |

## Run it

```bash
docker compose up -d redis && python -m lab.generate --rps 100 --seconds 15 && python -m lab.report
```

## Why the solution is shaped this way

- The load generator is open loop on purpose. A closed loop generator slows down when the service does, so it can never offer more than the service can take, and every overload number it produces is fiction.
- Capacity is computed before anything is measured: 8 workers over a 70 ms mean service time is 114 requests per second. Every other number in the report is quoted as a percentage of it.
- The sweep is the centrepiece. p50 58.0 ms and p99 265.6 ms at 35% of capacity, against p50 220.2 ms and p99 594.3 ms at 95%, with the work per request unchanged. Latency is flat and then it is a wall.
- Queue time and service time are recorded separately, which is what lets the README say that the tail at low load is the dependency and the tail at high load is the queue. They need different fixes.
- Caching is reported honestly. At an 80% hit ratio the median fell to 15.7 ms while the p99 stayed at 256.6 ms, because the one request in five that misses still pays the full price including the slow path.
- The limiter refuses in microseconds rather than queueing, which is why a fast no is worth building. Offered 250 requests per second against a limit of 100: 1,223 served at 101 a second with a p99 of 304.2 ms, and 2,043 refused with a 429 in microseconds, having taken no worker.
- Shedding is argued with goodput rather than throughput. At twice capacity, accepting everything gave a p99 of 2,972.1 ms for responses nobody was still waiting for; shedding at a queue depth of 20 gave 116 successful responses per second at a p99 of 461.3 ms.

## Where people get stuck

| Symptom | Cause |
|---------|-------|
| The load test shows no overload at any rate | A closed loop generator. It waits for each response, so it cannot offer more than the service can serve. |
| Mean latency is fine and users complain | A tail problem. A handful of very slow requests barely move an average, and a page making twenty calls hits p99 18% of the time. |
| The cache did not help the p99 | It is not supposed to directly. Misses still pay full price. The tail improves only when the cache takes enough load off the workers to stop the queue forming. |
| An outage got worse after retries were added | Retries multiply load on the thing that is already failing. Backoff, jitter and a retry budget, or do not retry. |
| One customer degraded everybody | A global rate limit instead of a per customer one. |
| Requests succeeded but nobody was waiting | Throughput measured instead of goodput. A response after the caller gave up is not a success. |

## Self-checks the solution satisfies

- The generator maintains its target rate even when the service slows down
- p99 is flat at a third of capacity and has clearly departed from flat near capacity
- Queue time and service time sum to the measured latency for every request
- Cache hits are served without touching the backend, and the hit ratio is reported
- Expiring a hot key under load triggers the expensive work exactly once
- The limiter allows a burst of exactly the bucket size, then enforces the steady rate
- An abusive customer receives 429s while a second customer is unaffected
- Every outbound call has a timeout shorter than the inbound deadline
- With retries and no budget, the service receives measurably more requests than were offered
- With a retry budget, retries stay under the configured share of traffic
- The breaker opens after the configured failures and closes again once the dependency recovers
- At twice capacity, shedding keeps p99 of successes within the target
- Every number in the README can be reproduced by a command in the README

## How it is marked

| Points | Criterion | Meaning |
|--------|-----------|---------|
| 20 | Honest measurement | Open loop, percentiles, goodput, medians of repeated runs, reproducible commands. |
| 20 | Understanding the tail | Capacity arithmetic, the sweep, queue time separated from service time, both kinds of tail named. |
| 20 | Cache | Hit ratios measured, single flight proven, and a written rule for what is never cached. |
| 20 | Protection | Limiter, timeouts, backoff with jitter, retry budget, circuit breaker, all demonstrated. |
| 20 | Shedding and the budget | Goodput at twice capacity, and a latency budget with measured numbers beside it. |

---

Part of [FinQuest](../../README.md) · Level 14 of 20
