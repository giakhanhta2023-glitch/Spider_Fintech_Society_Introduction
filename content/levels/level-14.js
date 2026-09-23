/* =========================================================================
   LEVEL 14: the p99 you promised
   ========================================================================= */
FQ.registerLevel({
  id: 14,
  codename: 'latency',
  title: 'The p99 you promised',
  tagline: 'Your service averages 70 ms and one request in a hundred takes half a second. This level is about that one, because it is the one the customer remembers and the one the contract is written about.',
  difficulty: 9,
  minutes: 420,
  tags: ['latency', 'percentiles', 'caching', 'rate limiting', 'load shedding'],
  summary: 'The first level of the production phase. "High volume, low latency" appears in every payments job ' +
           'description and almost nobody can say what they did about it. You will measure where latency comes from, ' +
           'watch a queue destroy a tail, add a cache and see what it does and does not fix, build a rate limiter, cause ' +
           'a retry storm, and shed load on purpose so that most requests still succeed.',

  objectives: [
    'Read a latency distribution and say what the tail is made of',
    'Explain why a service falls over well before 100% utilisation',
    'Size a cache by hit ratio, and name what must never be cached',
    'Implement a token bucket, and choose what to key it on',
    'Set a timeout and a retry policy that does not make an outage worse',
    'Shed load so that goodput stays high when demand does not',
    'Write a latency budget, and defend it with your own measurements'
  ],

  knowledge: [
    { h: 'Averages hide the thing that hurts' },
    { p: 'Every latency number in this level comes from a lab you will build: a service with eight worker slots, a ' +
         'handler that takes 50 ms nine times out of ten and 250 ms the other time, and a load generator whose requests ' +
         'arrive on a clock rather than waiting politely for the last one to finish. Small numbers on a laptop. The ' +
         'shapes are what carry over.' },
    { p: 'Start with the vocabulary, because it is used sloppily everywhere:' },
    { table: {
      head: ['Word', 'Means', 'Why you care'],
      rows: [
        ['Mean', 'The average', 'Moves when anything moves. Tells you almost nothing about a user'],
        ['p50 (median)', 'Half of requests are faster', 'The typical experience'],
        ['p99', '99 out of 100 are faster', 'The worst experience a normal user has, and what contracts specify'],
        ['p99.9', '999 out of 1,000', 'What your biggest customer sees, because they send the most requests'],
        ['Max', 'The slowest one', 'Usually one unlucky request. Interesting, rarely actionable']
      ]
    }},
    { p: 'The reason p99 matters more than it sounds: **users do not make one request.** A page that calls your API ' +
         'twenty times has a 18.2% chance of hitting at least one p99 request, because `1 - 0.99^20 = 0.182`. At fifty ' +
         'calls it is 39.5%. Your one-in-a-hundred event is a two-in-five page load.' },
    { money: 'This is also how service level agreements are written. Nobody promises an average. They promise "p99 under ' +
             '300 ms", and when you miss it there is money attached. Measuring the mean and reporting it as latency is ' +
             'the single most common mistake in this area.' },

    { h: 'Where latency actually comes from' },
    { p: 'Two parts, and only one of them is your code:' },
    { code: 'latency  =  service time      (how long the work takes)\n          +  queueing time     (how long it waited for a free worker)', lang: 'text' },
    { p: 'Service time is what you profile and optimise. Queueing time is what actually ruins your tail, and it is ' +
         'governed by arithmetic you do not get to argue with. **Little\'s law** says that for any stable system:' },
    { code: 'L = arrival rate x time in system\n\n100 requests per second, each taking 0.07 seconds\n-> 7 requests are in the system at any moment, on average', lang: 'text' },
    { p: 'So a service with eight worker slots and a 70 ms mean service time can handle `8 / 0.070 = 114` requests per ' +
         'second, and not one more. That is its **capacity**, and it is arithmetic, not opinion. What is not obvious is ' +
         'what happens on the way there.' },

    { h: 'The measurement that changes how you think' },
    { p: 'The same service, the same handler, only the arrival rate changing:' },
    { table: {
      head: ['Offered load', 'Utilisation', 'p50', 'p99'],
      rows: [
        ['40 rps', '35%', '58.0 ms', '265.6 ms'],
        ['70 rps', '61%', '60.7 ms', '274.0 ms'],
        ['90 rps', '79%', '64.3 ms', '299.7 ms'],
        ['100 rps', '88%', '98.2 ms', '386.5 ms'],
        ['108 rps', '94%', '**220.2 ms**', '**594.3 ms**']
      ]
    }},
    { p: 'The work per request never changed. Only the number of requests changed, and **latency is not linear in load**: ' +
         'it is flat and then it is a wall. This is why a service that looks comfortable at 70% falls over at 94%, and ' +
         'why capacity planning is done with headroom rather than efficiency. A machine run at 94% utilisation is not ' +
         'thrifty, it is one traffic spike from a queue nobody can drain.' },
    { p: 'There is a second lesson hiding in that table. At 35% load the p99 is about 265.6 ms, which is almost ' +
         'exactly the 250 ms slow path in the handler. **At low load the tail is your dependency\'s tail.** At 94% load ' +
         'the p99 is 594.3 ms, and most of that is waiting. The tail changed character, so the fix changes too: at low ' +
         'load you go and fix the slow dependency, at high load you add capacity or shed work. Treating them the same is ' +
         'how teams spend a quarter optimising a query that was never the problem.' },
    { check: {
      q: 'Your dashboard shows mean latency of 80 ms and it has not moved in a month. Support says the app "feels slow ' +
         'sometimes". Where do you look first, and what do you expect to find?',
      a: 'At the distribution, not the average, and specifically at p99 and p99.9 broken down by endpoint and by ' +
         'customer. A stable mean is perfectly compatible with a tail that has doubled, because a handful of very slow ' +
         'requests move the mean by almost nothing. "Sometimes" is the word that tells you this is a tail problem: the ' +
         'same user, on the same endpoint, is getting one bad request in fifty. Then ask which kind of tail it is, using ' +
         'the distinction above. If the tail is flat with load, something downstream is slow for a subset of requests, ' +
         'perhaps a cache miss path or one customer with far more data. If the tail grows with traffic, you are queueing ' +
         'and the answer is capacity, concurrency limits or shedding.'
    }},

    { h: 'Caching, and what it does not fix' },
    { p: 'A cache answers from memory instead of doing the work. The number that describes it is the **hit ratio**, and ' +
         'the arithmetic is simple: mean latency becomes `h x cache time + (1 - h) x real time`, and the load reaching ' +
         'your backend becomes `(1 - h) x offered load`. Here it is measured, at 100 requests per second, which is 88% ' +
         'of this service\'s capacity:' },
    { table: {
      head: ['Hit ratio', 'Load reaching the workers', 'p50', 'p99'],
      rows: [
        ['0%', '100 rps', '121.4 ms', '473.7 ms'],
        ['50%', '50 rps', '42.5 ms', '264.7 ms'],
        ['80%', '20 rps', '15.7 ms', '256.6 ms'],
        ['95%', '5 rps', '13.9 ms', '68.0 ms']
      ]
    }},
    { p: 'Read the p99 column twice, because it moves in two steps for two different reasons. From no cache to 50% ' +
         'it falls from 473.7 ms to 264.7 ms, and that is queueing disappearing: the workers went from ' +
         '100 requests a second to 50. From 50% to 80% it hardly moves at all, because it has hit a floor made of ' +
         'misses. One request in five still misses, and one miss in ten takes the 250 ms slow path, so 2% of all ' +
         'requests are slow and the 99th percentile sits among them.' },
    { p: 'Then at a 95% hit ratio the floor gives way and p99 drops to 68.0 ms, because only 0.5% of requests now ' +
         'take the slow path, which is rarer than one in a hundred. That gives you the rule, and you can solve it ' +
         'before building anything: **a cache improves your tail only until the tail is made of misses, and then not ' +
         'again until `(1 - hit ratio) x slow share` is smaller than the percentile you are quoting.** The median is ' +
         'a different story and improves the whole way down, which is why a cache flatters an average far more ' +
         'than it helps the customer who is waiting.' },
    { p: 'What you may cache, and what you may not, is a money question rather than a performance one:' },
    { table: {
      head: ['Cacheable', 'Never'],
      rows: [
        ['Merchant configuration and fee schedules', 'Account balances'],
        ['Currency and country reference data', 'Limit and velocity checks'],
        ['Card network routing tables', 'Idempotency key lookups'],
        ['A rendered receipt, keyed by payment id', 'Anything that decides whether money moves']
      ]
    }},
    { p: 'The rule is the same one from level 13\'s replicas: **a stale read that only shows something is a performance ' +
         'decision, and a stale read that authorises something is a double spend.**' },
    { warn: 'The **cache stampede**. A popular key expires, and the thousand requests that wanted it all miss at the same ' +
            'instant and all do the same expensive work. The fix is **single flight**: the first miss takes a short lock, ' +
            'does the work and fills the cache, and everybody else waits for it. Add a little randomness to your expiry ' +
            'times so that keys written together do not expire together.' },

    { h: 'Redis, in one section' },
    { p: '**Redis** is an in-memory key value store that you talk to over the network. It is what almost every payments ' +
         'company uses for caches, rate limiters and short-lived shared state. The parts you actually need:' },
    { table: {
      head: ['Thing', 'Use it for'],
      rows: [
        ['`get` and `set` with `ex`', 'A cached value with a time to live. Ninety percent of all Redis use'],
        ['`incr`', 'A counter that is atomic without you thinking about it'],
        ['Hashes', 'A small object stored as fields, updated one field at a time'],
        ['Sorted sets', 'Leaderboards, sliding windows, anything ordered by a score'],
        ['A Lua script', 'Several commands that must happen together, atomically'],
        ['`setnx` with a time to live', 'A short lock, such as the one that prevents a stampede']
      ]
    }},
    { p: 'Two rules that keep people out of trouble. **Everything in Redis must be losable**, because it is memory, and a ' +
         'restart or an eviction takes it. If losing a key costs money, it belongs in Postgres. And **every key gets a ' +
         'time to live**, because a cache without expiry is a memory leak with good marketing.' },

    { h: 'Rate limiting' },
    { p: 'A rate limiter decides who gets served when more work arrives than you want to do. The standard algorithm is ' +
         'the **token bucket**: a bucket holds tokens, tokens refill at a fixed rate, each request takes one, and a ' +
         'request that finds the bucket empty is refused. The bucket size is the burst you tolerate.' },
    { code: 'def allow(key, rate, burst):\n    now = time.monotonic()\n    tokens, last = bucket(key)\n    tokens = min(burst, tokens + (now - last) * rate)   # refill by elapsed time\n    if tokens >= 1:\n        save(key, tokens - 1, now)\n        return True\n    return False', lang: 'python' },
    { p: 'Offering this service 250 requests per second with a limiter set to 100:' },
    { code: 'offered   272 rps\nserved    1,223 requests, 101 per second, p50 80.5 ms, p99 304.2 ms\nrefused   2,043 with 429, in microseconds, having taken no worker', lang: 'text', label: 'measured' },
    { p: 'The refused requests are refused in microseconds, which is the whole point: **a fast no is a kindness.** The ' +
         'caller learns immediately, can back off, and never occupies a worker slot. Compare that with the alternative in ' +
         'the next section.' },
    { ul: [
      '**Key it per customer,** not globally, or your biggest merchant starves everybody else and one bad integration takes down the platform.',
      '**Return `429` with a `Retry-After` header,** so a well-behaved client knows exactly when to come back rather than guessing.',
      '**Alternatives worth knowing:** a fixed window is simplest and lets through double the rate at a window boundary; a sliding window log is exact and expensive; the token bucket is what almost everybody ships.',
      '**Put it in front of the work,** at the edge or the start of the handler, before a database connection has been taken.'
    ]},

    { h: 'Timeouts, retries, and the storm' },
    { p: 'A request with no timeout is a promise to wait forever, and forever is longer than your worker slot can afford. ' +
         'Every network call gets a timeout, and every timeout should be shorter than the one your caller gave you. Then ' +
         'comes the instinct that causes outages: if it timed out, try again.' },
    { p: 'Here is what retries do when the service is already at its limit. Same offered load of 100 requests per second, ' +
         'same 250 ms client timeout, with and without two retries:' },
    { table: {
      head: ['', 'No retries', 'Two retries'],
      rows: [
        ['Requests the service saw', '1,589', '**4,242**'],
        ['Successful responses per second', '92', '**18**'],
        ['p99 of the successes', '222.7 ms', '477.9 ms'],
        ['Timed out', '165', '1,318']
      ]
    }},
    { p: 'Read the attempts row first. The clients sent almost the same number of requests both times, but the service received 4,242 attempts instead of 1,589, because every timeout became two more. The service was already near its limit, so the extra attempts went straight onto the queue, pushed more requests past the deadline, and produced more retries still. Successes fell from 1,398 to 269. **The retries did not rescue the failures. They caused them.** And notice the shape of it: nothing crashed, nothing was logged as an error, and the service answered every request. It simply answered almost all of them too late to be any use, which is the hardest kind of outage to see from the inside.' },
    { p: 'The rules that keep retries useful:' },
    { ul: [
      '**Exponential backoff with jitter.** Doubling the wait each time stops the hammering; random jitter stops every client retrying in the same instant and rebuilding the spike you just survived.',
      '**A retry budget.** Cap retries at a small share of total traffic, for example 10%. When the budget is exhausted, fail fast. This is the single most effective protection against a retry storm.',
      '**Only retry what is safe.** A timeout means you do not know whether the work happened, which is exactly level 12 again. Retrying without an idempotency key is how you pay twice.',
      '**A circuit breaker.** After enough consecutive failures, stop calling the dependency at all for a few seconds and fail immediately, then let one request through to test the water. It converts a slow failure into a fast one and gives the dependency room to recover.'
    ]},
    { check: {
      q: 'Your service calls a fraud checker with a 2 second timeout, and your own caller gives you 1 second. The fraud ' +
         'checker starts taking 1.5 seconds. Describe what your callers see, and fix it in two ways.',
      a: 'Your callers see their own timeout fire at one second, every time, while your worker is still sitting there ' +
         'waiting for a fraud check it will never get to use. You have converted a slow dependency into a full outage, ' +
         'and worse, you are burning a worker slot per request for 2 seconds instead of one, so your effective capacity ' +
         'collapses at exactly the moment you need it. The first fix is the timeout hierarchy: your timeout to a ' +
         'dependency must be shorter than the timeout your caller gave you, leaving room for your own work, so perhaps ' +
         '700 ms here. The second is deciding what a fraud check timeout means for the business: if the safe answer is ' +
         'to decline, decline fast; if the safe answer is to accept and review afterwards, do that and record it. Either ' +
         'is better than holding a worker until somebody else gives up.'
    }},

    { h: 'Load shedding: choosing who to disappoint' },
    { p: 'When demand exceeds capacity, you have two options. Accept everything and serve it all slowly, or refuse some ' +
         'of it immediately and serve the rest properly. The measurement makes the choice obvious. Offered 250 requests ' +
         'per second at a service whose capacity is 114:' },
    { table: {
      head: ['', 'Accept everything', 'Shed when the queue passes 20'],
      rows: [
        ['Successful responses per second', '54', '**116**'],
        ['p50 of the successes', '1452.6 ms', '**227.8 ms**'],
        ['p99 of the successes', '2972.1 ms', '**461.3 ms**'],
        ['Refused immediately', '0', '1,823']
      ]
    }},
    { p: 'The service cannot do more than 114 requests a second either way, so the question was never how many to serve. It was which ones, and when to say no. Accepting everything built a queue that every request had to sit in, so 2,492 of them arrived after the caller had given up and the work spent on them was wasted, which is why goodput fell to 54 a second, well under capacity. Shedding past a queue of twenty gave 1,823 callers an immediate no, and spent the whole machine on the rest: 116 successful responses a second at a p99 of 461.3 ms, and nobody left hanging for three seconds to be told nothing.' },
    { p: 'The word for what matters here is **goodput**: not requests per second, but *useful* responses per second. A ' +
         'service delivering 240 responses that all arrived after the caller gave up has a throughput of 240 and a ' +
         'goodput of zero.' },
    { ul: [
      '**Shed on queue depth or latency,** not on a fixed request rate, because your real capacity changes with what the requests are doing.',
      '**Shed the cheap things first.** Batch jobs, exports and reports before interactive traffic; a retry before a first attempt.',
      '**Say so honestly:** `503` with `Retry-After`, never a silent hang and never a `200` with an empty body.',
      '**Never shed the health check,** or your orchestrator will conclude the service is dead and take away the capacity you are short of.'
    ]},

    { h: 'The pool, one more time' },
    { p: 'Level 8 measured what an exhausted connection pool does to latency. The same arithmetic appears here because it ' +
         'is the same phenomenon: a pool is a queue, and its size is the number of worker slots for the database. If ' +
         'twenty application processes each hold a pool of twenty connections, your database is being asked for four ' +
         'hundred, and a Postgres tuned for a hundred will spend its time context switching.' },
    { p: 'The arithmetic to do before you tune anything: `pool size x processes` must be less than the database\'s ' +
         'connection limit, and `pool size / query time` is the requests per second that pool can support. If those two ' +
         'numbers disagree with your traffic, no amount of application optimisation will help.' },

    { h: 'Writing a latency budget' },
    { p: 'The artefact that turns all of this into engineering. For each endpoint that matters, state the load, the ' +
         'target, and where the time is allowed to go:' },
    { code: 'POST /payments   at 200 rps,  p99 <= 250 ms\n\n  authentication          5 ms\n  validation              2 ms\n  idempotency lookup     10 ms\n  fraud check           120 ms   (their p99, and our timeout is 150 ms)\n  ledger write           40 ms\n  event write             8 ms\n  everything else        20 ms\n  ------------------------------\n  budgeted              205 ms   leaving 45 ms of headroom', lang: 'text' },
    { p: 'A budget does three things at once. It tells you which dependency to argue with, because the fraud check is ' +
         'half your budget. It tells you what timeout to set, because a dependency that is allowed 120 ms should not be ' +
         'given 2 seconds. And it turns "the API feels slow" into a number that either is or is not being met, which is ' +
         'the difference between an opinion and an engineering problem.' },
    { tip: 'When you blow the budget, the order of moves is: measure where it actually went, then remove work, then cache ' +
           'it, then parallelise the independent parts, then add capacity. Adding capacity first is the expensive answer ' +
           'and it hides the real one.' }
  ],

  tutorial: {
    intro: 'Build the lab first and the service second. The point of this level is the measuring, so the load generator ' +
           'and the report are the deliverable, not an afterthought. Work in a repository called `latency-lab`.',
    steps: [
      {
        t: 'A load generator whose arrivals do not wait',
        blocks: [
          { p: 'This is the step people get wrong, and it invalidates everything afterwards. A **closed loop** generator ' +
               'sends the next request when the last one finishes, so when your service slows down the generator ' +
               'politely slows down too and you never see a queue. An **open loop** generator sends on a clock, the way ' +
               'real users do.' },
          { code: 'async def generator(rate, seconds):\n    while time.perf_counter() < deadline:\n        await asyncio.sleep(random.expovariate(rate))   # Poisson arrivals\n        asyncio.create_task(one_request())               # do not await it', lang: 'python' },
          { warn: 'If your tool waits for each response before sending the next, it cannot measure overload, because it ' +
                  'is incapable of offering more than the service can take. Check this before trusting any number.' }
        ],
        check: 'Offering more than capacity makes latency climb without bound, rather than settling.'
      },
      {
        t: 'Record the distribution, not the average',
        blocks: [
          { p: 'Keep every latency, then report p50, p90, p99 and max, plus the count of each status code. Report ' +
               'goodput separately from throughput: only responses that arrived before the caller would have given up.' },
          { tip: 'Run each configuration three times and report the median of the three. Single runs on a laptop vary ' +
                 'by twenty percent, and publishing one run as a result is the measurement equivalent of a lucky test.' }
        ],
        check: 'Your report prints p50, p99, max, goodput and the status code breakdown for every run.'
      },
      {
        t: 'Find the wall',
        blocks: [
          { p: 'Compute capacity from the arithmetic, then sweep the offered load from a third of it to just under it, ' +
               'and plot p99. You are looking for the point where the line stops being flat.' },
          { code: '40 rps  (35%)   p50   58.0   p99   265.6\n90 rps  (79%)   p50   64.3   p99   299.7\n108 rps (94%)   p50  220.2   p99   594.3', lang: 'text' },
          { p: 'Write down the utilisation where your p99 target is first missed. That number, not the theoretical ' +
               'capacity, is what you plan around.' }
        ],
        check: 'You can state the load at which your service stops meeting its target, and it is well below capacity.'
      },
      {
        t: 'Split the tail',
        blocks: [
          { p: 'Prove the two kinds of tail. Run at low load and confirm that the p99 is roughly your slow path\'s ' +
               'service time. Then run near capacity and confirm that the p99 is mostly waiting. Instrument the handler ' +
               'to record queue time and service time separately: it is two timestamps and it will save you weeks.' }
        ],
        check: 'For any run you can say how much of the p99 was work and how much was waiting.'
      },
      {
        t: 'Add a cache and measure honestly',
        blocks: [
          { p: 'Put Redis in front of something genuinely cacheable, such as merchant configuration. Then run the sweep ' +
               'at several hit ratios and report what moved.' },
          { code: 'hit ratio 80%:  p50 15.7 ms   p99 256.6 ms', lang: 'text' },
          { p: 'Then write the paragraph explaining why the median improved so much more than the tail. If you can write ' +
               'that paragraph, you understand caching better than most people who have shipped one.' },
          { p: 'Add single flight for the stampede, and prove it: expire a hot key under load and count how many times ' +
               'the expensive work ran.' }
        ],
        check: 'Expiring a hot key under load runs the expensive work once, not a thousand times.'
      },
      {
        t: 'Build the limiter',
        blocks: [
          { p: 'A token bucket in Redis, atomic, keyed per customer. Use a Lua script so the refill and the take happen ' +
               'together, because two round trips are a race.' },
          { code: '-- KEYS[1] bucket   ARGV: now, rate, burst\nlocal b = redis.call(\'HMGET\', KEYS[1], \'tokens\', \'ts\')\nlocal tokens = tonumber(b[1]) or tonumber(ARGV[3])\nlocal ts = tonumber(b[2]) or tonumber(ARGV[1])\ntokens = math.min(tonumber(ARGV[3]), tokens + (ARGV[1] - ts) * ARGV[2])\nif tokens < 1 then return 0 end\nredis.call(\'HMSET\', KEYS[1], \'tokens\', tokens - 1, \'ts\', ARGV[1])\nreturn 1', lang: 'lua' },
          { p: 'Prove three things: the steady rate is enforced, a burst up to the bucket size is allowed through, and ' +
               'one noisy customer cannot consume another customer\'s allowance.' }
        ],
        check: 'Two customers, one of them abusive, and the well-behaved one sees no change in latency or success rate.'
      },
      {
        t: 'Cause a retry storm, then stop it',
        blocks: [
          { p: 'Set a timeout tight enough that a few percent of requests miss it, turn on retries with no backoff, and ' +
               'watch the load the service actually receives. Then add backoff with jitter and a retry budget, and ' +
               'measure again.' },
          { p: 'Add a circuit breaker around a dependency you can slow down on demand, and show the three states: closed ' +
               'while healthy, open after repeated failures, and half open when it lets one request through to test.' }
        ],
        check: 'With the dependency broken, your service fails fast instead of holding workers, and recovers on its own when the dependency returns.'
      },
      {
        t: 'Shed, and report goodput',
        blocks: [
          { p: 'Add a queue depth limit that returns `503` with `Retry-After` immediately. Run at twice capacity with and ' +
               'without it.' },
          { code: 'accept everything   good  54/s   p50  1452.6   p99  2972.1\nshed past 20        good 116/s   p50   227.8   p99   461.3', lang: 'text' },
          { p: 'Finish with the latency budget for your main endpoint, the measured numbers next to each line of it, and ' +
               'an honest statement of the load at which you meet it.' }
        ],
        check: 'At twice capacity, the shedding version serves more than twice as many requests successfully, at a sixth of the p99.'
      }
    ]
  },

  glossary: [
    { t: 'p99', d: 'The latency 99 out of 100 requests beat. What contracts are written about.' },
    { t: 'Service time', d: 'How long the work itself takes, with no waiting.' },
    { t: 'Queueing time', d: 'How long a request waited for a free worker. The source of most bad tails.' },
    { t: 'Little\'s law', d: 'Items in the system equals arrival rate times time in system. Capacity arithmetic.' },
    { t: 'Utilisation', d: 'Offered load divided by capacity. Latency explodes as it approaches one.' },
    { t: 'Open loop load', d: 'Requests sent on a clock, regardless of whether the last one finished.' },
    { t: 'Closed loop load', d: 'Requests sent only after the last one returned. Cannot measure overload.' },
    { t: 'Hit ratio', d: 'The share of requests a cache answers. The number that describes a cache.' },
    { t: 'Cache stampede', d: 'A hot key expires and every waiting request does the same expensive work at once.' },
    { t: 'Single flight', d: 'Letting one request do the work on a miss while the rest wait for its answer.' },
    { t: 'Token bucket', d: 'Tokens refill at a fixed rate, each request takes one, empty means refused.' },
    { t: 'Retry storm', d: 'Retries multiplying load on a service that is already struggling.' },
    { t: 'Jitter', d: 'Randomness added to backoff so clients do not all retry in the same instant.' },
    { t: 'Retry budget', d: 'A cap on retries as a share of traffic. The best protection against a storm.' },
    { t: 'Circuit breaker', d: 'Stop calling a failing dependency for a while, then test it with one request.' },
    { t: 'Load shedding', d: 'Refusing work immediately so the work you accept can be done properly.' },
    { t: 'Goodput', d: 'Useful responses per second, as opposed to responses nobody is still waiting for.' },
    { t: 'Latency budget', d: 'A written allocation of a target latency across the steps of a request.' }
  ],

  quiz: [
    { q: "A page makes twenty API calls. Roughly how often does it hit at least one p99 request?",
      options: [
        "About 50% of the time",
        "About 5% of the time",
        "About 1% of the time",
        "About 18% of the time"
      ],
      answer: 3,
      why: "1 - 0.99^20 = 0.182. A one-in-a-hundred event becomes one page load in five." },

    { q: "Latency is made of two things. Which pair?",
      options: [
        "Network time and database time",
        "Service time and queueing time",
        "CPU time and input output time",
        "Client time and server time"
      ],
      answer: 1,
      why: "You profile the first and your tail is usually made of the second." },

    { q: "Eight worker slots, 70 ms mean service time. What is the capacity?",
      options: [
        "8 requests per second",
        "560 requests per second",
        "114 requests per second",
        "70 requests per second"
      ],
      answer: 2,
      why: "8 / 0.070 = 114. Little's law, and it is arithmetic rather than opinion." },

    { q: "Why does p99 explode near 95% utilisation when the work per request has not changed?",
      options: [
        "The garbage collector runs more often",
        "The network saturates",
        "The code gets slower under load",
        "Because queueing time grows without bound as utilisation approaches one, so requests spend most of their life waiting"
      ],
      answer: 3,
      why: "Which is why capacity planning leaves headroom instead of chasing efficiency." },

    { q: "At 35% utilisation the p99 was roughly the handler's slow path. What does that tell you?",
      options: [
        "That at low load the tail is your dependency's tail, not queueing, so the fix is to make the slow path faster rather than add capacity",
        "That you need a bigger cache",
        "The measurement is wrong",
        "That the load generator is closed loop"
      ],
      answer: 0,
      why: "Two kinds of tail, two different fixes. Telling them apart saves a quarter of wasted work." },

    { q: "An 80% cache hit ratio collapsed the median but barely moved the p99. Why?",
      options: [
        "Because the hit ratio was measured wrong",
        "Because the one request in five that misses still pays the full price, including the slow path",
        "The cache was too small",
        "Because Redis was slow"
      ],
      answer: 1,
      why: "A cache is a median and throughput instrument. It helps the tail only by removing load from the workers." },

    { q: "Which of these must never be cached?",
      options: [
        "Merchant fee schedules",
        "Currency reference data",
        "An idempotency key lookup",
        "Card network routing tables"
      ],
      answer: 2,
      why: "A stale read that authorises something is a double spend. The same rule as reading from a replica." },

    { q: "What is a cache stampede, and what stops it?",
      options: [
        "Too many keys, fixed by a bigger cache",
        "A hot key expires and every waiting request does the same expensive work at once, fixed by single flight and jittered expiry",
        "A slow network, fixed by pipelining",
        "Eviction, fixed by removing the time to live"
      ],
      answer: 1,
      why: "One request takes a short lock and fills the cache. Everybody else waits for it rather than repeating it." },

    { q: "In a token bucket, what does the bucket size control?",
      options: [
        "How long a request waits",
        "The size of the burst you tolerate",
        "The number of customers",
        "The sustained rate"
      ],
      answer: 1,
      why: "The refill rate sets the sustained rate; the bucket size sets how much can arrive at once." },

    { q: "Why key a rate limiter per customer rather than globally?",
      options: [
        "It is faster",
        "It uses less memory",
        "Because a global limit lets one heavy or misbehaving customer consume everybody else's allowance",
        "Because the standard requires it"
      ],
      answer: 2,
      why: "One bad integration should degrade one customer, not the platform." },

    { q: "Retrying on timeout at a service that is already at its limit does what?",
      options: [
        "Reduces the load",
        "Improves the success rate at no cost",
        "Adds load to the thing that is failing, which is why retries need backoff, jitter and a budget",
        "Has no effect"
      ],
      answer: 2,
      why: "And a retry without an idempotency key can also pay twice, which is level 12 again." },

    { q: "Your caller allows you 1 second. What timeout should you give a dependency?",
      options: [
        "Comfortably less than 1 second, leaving room for your own work",
        "Longer than 1 second, so you do not give up too early",
        "Exactly 1 second",
        "No timeout, and rely on the caller's"
      ],
      answer: 0,
      why: "Otherwise you hold a worker for a result nobody is waiting for any more." },

    { q: "What does a circuit breaker do when it is open?",
      options: [
        "Routes to a replica",
        "Queues requests until the dependency recovers",
        "Retries faster",
        "Fails immediately without calling the dependency, then lets one request through after a while to test it"
      ],
      answer: 3,
      why: "It converts a slow failure into a fast one and gives the dependency room to recover." },

    { q: "What is goodput?",
      options: [
        "Successful responses per second that arrived before the caller gave up",
        "Requests per second",
        "The p50 of successful requests",
        "Bytes per second"
      ],
      answer: 0,
      why: "A service returning 240 responses that everybody has stopped waiting for has a goodput of zero." },

    { q: "At twice capacity, shedding on queue depth more than doubled the successes and cut p99 from 2,972 ms to 461 ms. Why did refusing work produce more of it?",
      options: [
        "Because without shedding the machine spends most of its capacity finishing requests whose callers have already given up, and refusing those early leaves the whole machine for requests somebody is still waiting for",
        "Because the cache warmed up",
        "The workers went faster",
        "Because fewer requests arrived"
      ],
      answer: 0,
      why: "Measured: 2,492 responses arrived after the caller had gone. That work was capacity spent on nobody." }
  ],

  project: {
    title: 'latency-lab: the p99 you can defend',
    story: 'Take a payments endpoint, put it under honest load, and find out what it actually does. Then make it meet a ' +
           'latency target you write down in advance, using caching, a rate limiter, timeouts, a circuit breaker and ' +
           'load shedding, and prove each one with a before and after.',
    scope: 'Build on the level 7 API and the level 8 load work. Redis runs in Docker with one command. The deliverable is ' +
           'a latency report with measurements for every claim, and a stated load at which you meet your budget.',
    requirements: [
      'An open loop load generator with Poisson arrivals, which does not wait for responses before sending',
      'A report printing p50, p90, p99, max, goodput and status code counts, as the median of three runs',
      'Capacity computed from Little\'s law, and a load sweep that finds where p99 first misses the target',
      'Queue time and service time recorded separately in the handler, so any tail can be attributed',
      'A Redis cache on something genuinely cacheable, measured at several hit ratios',
      'Single flight on cache misses, proven by expiring a hot key under load and counting the work',
      'A written list of what this service must never cache, with the reason for each',
      'A token bucket rate limiter in Redis, atomic via Lua, keyed per customer, returning 429 with Retry-After',
      'A test proving one abusive customer does not affect another customer\'s latency or success rate',
      'Timeouts on every outbound call, with a hierarchy that respects the caller\'s timeout',
      'A reproduced retry storm, then backoff with jitter and a retry budget, with the load the service saw in each case',
      'A circuit breaker with all three states demonstrated against a dependency you can slow down on demand',
      'Load shedding on queue depth, with goodput and p99 at twice capacity, with and without it',
      'A latency budget for your main endpoint, with measured numbers beside each line',
      'The repository public on GitHub as `latency-lab`'
    ],
    starter: {
      lang: 'python',
      code: '"""FinQuest level 14: the latency lab.\n\nLayout:\n  lab/generate.py    open loop arrivals, Poisson, fire and forget\n  lab/report.py      percentiles, goodput, status codes, median of three runs\n  svc/cache.py       Redis, single flight, and the list of what is never cached\n  svc/limiter.py     token bucket, Lua, keyed per customer\n  svc/breaker.py     closed, open, half open\n  svc/shed.py        queue depth limit, 503 with Retry-After\n  BUDGET.md          the latency budget, with measurements beside it\n"""\n\n\ndef percentile(values: list[float], p: float) -> float:\n    """p50, p90, p99. Sort once, index once. No averages anywhere."""\n    # TODO\n    raise NotImplementedError\n\n\ndef capacity(workers: int, mean_service_seconds: float) -> float:\n    """Little\'s law. This is the number every other number is compared to."""\n    return workers / mean_service_seconds\n\n\nasync def one_request(client) -> tuple[int, float]:\n    """Return (status, milliseconds). Never awaited by the generator."""\n    # TODO\n    raise NotImplementedError\n'
    },
    tests: [
      'The generator maintains its target rate even when the service slows down',
      'p99 is flat at a third of capacity and has clearly departed from flat near capacity',
      'Queue time and service time sum to the measured latency for every request',
      'Cache hits are served without touching the backend, and the hit ratio is reported',
      'Expiring a hot key under load triggers the expensive work exactly once',
      'The limiter allows a burst of exactly the bucket size, then enforces the steady rate',
      'An abusive customer receives 429s while a second customer is unaffected',
      'Every outbound call has a timeout shorter than the inbound deadline',
      'With retries and no budget, the service receives measurably more requests than were offered',
      'With a retry budget, retries stay under the configured share of traffic',
      'The breaker opens after the configured failures and closes again once the dependency recovers',
      'At twice capacity, shedding keeps p99 of successes within the target',
      'Every number in the README can be reproduced by a command in the README'
    ],
    rubric: [
      { pts: 20, t: 'Honest measurement', d: 'Open loop, percentiles, goodput, medians of repeated runs, reproducible commands.' },
      { pts: 20, t: 'Understanding the tail', d: 'Capacity arithmetic, the sweep, queue time separated from service time, both kinds of tail named.' },
      { pts: 20, t: 'Cache', d: 'Hit ratios measured, single flight proven, and a written rule for what is never cached.' },
      { pts: 20, t: 'Protection', d: 'Limiter, timeouts, backoff with jitter, retry budget, circuit breaker, all demonstrated.' },
      { pts: 20, t: 'Shedding and the budget', d: 'Goodput at twice capacity, and a latency budget with measured numbers beside it.' }
    ],
    stretch: [
      'Add a second worker process and measure whether the p99 halves, then explain the difference',
      'Implement priority shedding: refuse batch and report traffic before interactive traffic, and measure both',
      'Compare the token bucket with a fixed window and a sliding window log, including the boundary burst',
      'Add adaptive concurrency that raises and lowers the worker limit based on measured latency',
      'Run the lab against a real Postgres and find out which of your assumptions about service time were wrong'
    ],
    solutionPath: 'solutions/level-14'
  },

  faq: [
    { q: 'Why is my p99 worse than the slowest thing my handler does?',
      a: 'Because it includes waiting. A request that queues for 400 ms and runs for 50 ms is a 450 ms request, and none of that 400 ms appears in any profile of your code. Record queue time separately and the mystery usually evaporates in an afternoon.' },
    { q: 'How much headroom should I leave?',
      a: 'Enough that your p99 target still holds at your peak, which is a measurement rather than a rule. Many teams plan for 50 to 60 percent of capacity at peak, because the curve is flat there and steep above it, and because instances fail and traffic is not smooth.' },
    { q: 'Is a cache hit ratio of 80% good?',
      a: 'It depends entirely on what a miss costs. Eighty percent on a 5 ms lookup is barely worth the complexity; eighty percent on a 300 ms aggregation changes what the service can do. Always quote a hit ratio next to the cost of a miss.' },
    { q: 'Should the rate limiter live in the service or at the edge?',
      a: 'Both, for different reasons. The edge stops obvious abuse before it costs you anything. The service protects a specific expensive resource with limits only it knows about, such as per merchant writes to one table. The edge cannot know that, and the service cannot cheaply stop a flood.' },
    { q: 'My circuit breaker keeps opening during normal spikes',
      a: 'Its thresholds are counting failures without regard for volume. Use a failure rate over a rolling window with a minimum request count, so five failures out of eight does not look the same as five out of five thousand.' },
    { q: 'Shedding feels like giving up',
      a: 'It is the opposite. Accepting work you cannot do means everybody waits and nobody is served, which is the worst outcome available. Shedding is choosing, deliberately and in advance, who gets a fast no so that the rest get a real answer.' },
    { q: 'What do I say about this project in an interview?',
      a: 'Say that you measured the utilisation curve on your own service and found where p99 left the target, that you separated queue time from service time so you could name which kind of tail you had, and that at twice capacity shedding took goodput from 54 to 116 responses a second while cutting p99 from 2,972 ms to 461 ms. Then the retry number, because it is the one that surprises people: adding two retries tripled the load the service received and dropped successes from 1,398 to 269.' }
  ]
});
