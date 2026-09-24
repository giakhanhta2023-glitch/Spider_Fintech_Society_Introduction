# latency-lab

A service with eight worker slots, an open loop generator, and the numbers that
come out when you stop guessing.

```bash
pip install -r requirements.txt
pytest                       # 13 tests, milliseconds
python -m lab.experiments    # every number below, a few minutes
```

Capacity is computed before anything is measured, so the measurements have
something to disagree with:

```
8 worker slots / 0.070 s mean service time = 114 requests per second
```

Little's law. Arithmetic, not opinion. Every load below is a share of it.

## 1. What load does to the tail

| Offered | Utilisation | p50 | p99 |
|---|---|---|---|
| 40 rps | 35% | 58.0 ms | 265.6 ms |
| 70 rps | 61% | 60.7 ms | 274.0 ms |
| 90 rps | 79% | 64.3 ms | 299.7 ms |
| 100 rps | 88% | 98.2 ms | 386.5 ms |
| 108 rps | 94% | **220.2 ms** | **594.3 ms** |

The work per request never changed. Only the arrival rate did. **Latency is not
linear in load: it is flat and then it is a wall**, which is why capacity
planning leaves headroom rather than chasing efficiency. A machine run at 94%
is not thrifty, it is one spike from a queue nobody can drain.

There is a second lesson in that table. At 35% the p99 is 265.6 ms, which is
almost exactly the handler's 250 ms slow path: **at low load the tail is your
dependency's tail.** At 94% it is 594.3 ms and most of that is waiting. Two
different tails, two different fixes, and treating them the same is how a team
spends a quarter optimising a query that was never the problem.

## 2. The cache, and what it does not fix

Offered 100 rps, which is 88% of capacity:

| Hit ratio | Load reaching the workers | p50 | p99 |
|---|---|---|---|
| 0% | 100 rps | 121.4 ms | 473.7 ms |
| 50% | 50 rps | 42.5 ms | 264.7 ms |
| 80% | 20 rps | 15.7 ms | 256.6 ms |
| 95% | 5 rps | 13.9 ms | **68.0 ms** |

Read the p99 column twice, because it moves in two steps for two different
reasons.

From 0% to 50% it falls from 473.7 ms to 264.7 ms: that is **queueing
disappearing**, because the workers went from 100 requests a second to 50.

From 50% to 80% it barely moves, because it has hit **a floor made of misses**.
One request in five still misses, and one miss in ten takes the 250 ms slow
path, so 2% of all requests are slow and the 99th percentile sits among them.

Then at 95% the floor gives way to 68.0 ms, because only 0.5% now take the slow
path, which is rarer than one in a hundred.

That gives the rule, and you can solve it before building anything:

> A cache improves your tail only until the tail is made of misses, and then
> not again until `(1 - hit ratio) × slow share` is smaller than the percentile
> you are quoting.

The median improves the whole way down, which is why a cache flatters an
average far more than it helps the customer who is waiting.

## 3. Retries, and the storm

Offered 100 rps, client timeout 250 ms:

| | No retries | Two retries |
|---|---|---|
| Requests the clients sent | 1,589 | 1,587 |
| **Attempts the service received** | **1,589** | **4,242** |
| Succeeded | 1,398 | **269** |
| Goodput | 92/s | **18/s** |
| p99 of successes | 222.7 ms | 477.9 ms |

The clients sent the same number of requests. The service received **2.7 times
as many attempts**, and successes fell from 1,398 to 269.

The retries did not rescue the failures. They caused them. The service was
already near its limit, the extra attempts went onto the queue, more requests
crossed the deadline, and those produced more retries.

Notice the shape of the failure: nothing crashed, nothing was logged as an
error, and the service answered every request. It simply answered almost all of
them too late to be any use, which is the hardest kind of outage to see from
inside.

The fixes, in order of how much they help: a **retry budget** capping retries at
a small share of traffic, **exponential backoff with jitter**, and **only
retrying what is safe**, which is level 12 again: a timeout means you do not
know whether the work happened.

## 4. Load shedding

Offered 250 rps against a capacity of 114:

| | Accept everything | Shed past a queue of 20 |
|---|---|---|
| Goodput | 54/s | **116/s** |
| p50 of successes | 1,452.6 ms | **227.8 ms** |
| p99 of successes | 2,972.1 ms | **461.3 ms** |
| Refused immediately | 0 | 1,823 |

Refusing work more than doubled the amount of work completed. That is not a
paradox: the machine cannot do more than 114 a second either way, and the
question was never how many to serve but **which ones, and when to say no**.

Accepting everything built a queue that every request sat in, so 2,492 responses
arrived after the caller had given up. That work was capacity spent on nobody.

The word for what matters is **goodput**: useful responses per second, not
responses per second. A service returning 240 responses nobody is still waiting
for has a throughput of 240 and a goodput of zero.

## 5. The rate limiter

Offered 250 rps with a limit of 100:

```
served    1,223 requests at 101/s, p50 80.5 ms, p99 304.2 ms
refused   2,043 with 429, in microseconds, having taken no worker
```

**A fast no is a kindness.** The caller learns immediately, can back off, and
never occupies a worker slot. Compare that with the shedding table above, where
the alternative was a queue nobody could drain.

Keyed per customer, not globally, and there is a test asserting that an abusive
customer gets 429s while a second customer sees no change at all. A global limit
means one bad integration consumes everybody else's allowance.

## What the pieces do

- **`lab/load.py`** is open loop. This is the file that decides whether any
  number here means anything: a closed loop generator slows down when the
  service does, so it can never show you overload. Check this property before
  trusting any load testing tool, including ones you pay for.
- **`lab/cache.py`** has single flight, so a hot key expiring under twenty
  concurrent requests does the expensive work **once**, not twenty times. It
  also carries the written list of what must never be cached, with a reason for
  each, because a list without reasons is one nobody can extend.
- **`lab/limiter.py`** is a token bucket with the Lua script in a comment. It
  has to be one script rather than a read and a write: two round trips are a
  race, and the limit gets silently doubled.
- **`lab/breaker.py`** opens on a failure **rate** over a rolling window with a
  minimum volume, not a raw count. Five failures out of eight is a broken
  dependency; five out of five thousand is Tuesday. Half open lets exactly one
  probe through, because a burst at the end of the cool off knocks a recovering
  service straight over again.
- **`BUDGET.md`** is the latency budget with measured numbers beside each line.

## Tests

```
13 passed in 3.15s
```

Fast on purpose. The measurements take minutes and live in
`lab/experiments.py`, because a test suite that takes ten minutes is one people
stop running.

## Limitations

- The cache and limiter are in process. `redis.py` bindings are the same
  interface and the Lua script is in the comments; running Redis adds a
  network hop this repository does not need to make its point.
- Measured on a laptop, against a simulated dependency. The absolute numbers
  are small. The shapes are what transfer.
- Windows timer resolution is 15.6 ms by default, which would destroy every
  number here. `service.py` and `load.py` both call `timeBeginPeriod(1)` at
  import. On Linux this is unnecessary and harmless.
- The experiment runner takes the median of three 15 second runs. A single run
  varies by about twenty percent, and publishing one as a result is the
  measurement equivalent of a lucky test.
