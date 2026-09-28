# 6. A rate limiter

## Requirements

**Functional.** Limit each merchant to an agreed number of requests a second.
Refuse excess traffic with 429 and `Retry-After`. Allow short bursts. Never let one
merchant degrade another.

**Non functional.** Under 1 ms of added latency. Works across every instance.
Fails open rather than closed: a limiter outage must not become a platform outage.

## Estimation

| Input | Value | Where it comes from |
|---|---|---|
| Merchants | 500 | Level 16 |
| Requests a second | 200 at peak | The capstone's load |
| State per merchant | about 64 bytes | Tokens and a timestamp |
| Total state | about 32 KB | Which fits anywhere, including memory |
| Redis round trip | about 0.3 ms | Within the 1 ms budget |
| Refusal cost | microseconds | Level 14: 2,043 requests refused with a 429, having taken no worker |

The last row is the argument for the whole design. A fast no is cheap; a slow no
costs the same as a yes.

## Data model

```
Redis: limit:{merchant_id} -> { tokens, last_refill_micros }
Config: merchant_id -> { rate_per_second, burst }
```

A token bucket rather than a fixed window, because a fixed window allows twice the
limit across a boundary: 100 requests at 12:00:59 and 100 more at 12:01:00 is 200
in a second under a "100 a minute" rule.

The refill and the take are one Lua script, so they are atomic. Read, decide,
write from the application is a race that shows up as merchants exceeding their
limit under exactly the load the limit exists for.

## Diagram

```
  request -> [ edge ] -> [ token bucket in Redis ] --refused--> 429 + Retry-After
                                 |
                              allowed
                                 |
                            [ gateway ]
```

## Failure modes

| What fails | Consequence | Design response |
|---|---|---|
| Redis unavailable | No limiting | Fail open, with a local per instance limiter as a floor. A limiter that fails closed turns a cache outage into a full outage |
| Clock skew between instances | Wrong refill | The timestamp comes from Redis, which is one clock |
| One merchant floods | Everybody degrades | Per merchant keys, never a global limit. This is the whole requirement |
| Limits too tight | Legitimate traffic refused | Limits come from measured traffic plus headroom, and a merchant near their limit is a conversation rather than a 429 |
| The limiter itself is slow | It becomes the bottleneck | One round trip, one script, and a budget of 1 ms that is monitored |

## What to monitor

The refusal rate per merchant, which is the signal for both abuse and a limit set
too low. The limiter's own latency p99 against its 1 ms budget. Whether it is
failing open, which should be visible rather than inferred. And the count of
merchants within 10% of their limit, which is the list somebody should be talking
to before they hit it.
