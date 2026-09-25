# PaymentsLatencyObjectiveBreached

**Severity** page · **Objective** payments latency, 99% under 500 ms
**Owner** payments team · **Last reviewed** 2026-09-24

## What this means

The aggregated p99 for `POST /payments` has been over 500 ms for ten minutes.
Nothing is failing. Everything is slow, and a checkout page that takes a second
loses customers who never appear in an error metric.

## Read the two panels in this order

1. **The worst instance panel** (`payments:latency:p99_worst_instance_5m`). If
   one instance is much worse than the aggregate, it is that instance. Take it
   out of the load balancer first and look at it afterwards. This panel exists
   because the aggregate hid exactly this: one instance at 906.2 ms inside a
   fleet whose true p99 was 393.4 ms.
2. **The aggregate p99** (`payments:latency:p99_5m`), which is computed by
   summing histogram buckets across instances. If it moved and the worst
   instance panel did not, the slowness is everywhere, which points at a shared
   dependency or at load.

## What to check, with the level 14 numbers in mind

Level 14 measured this service's own behaviour, so there is a reference:

| Symptom | What it was, when measured |
|---|---|
| p99 around 265 ms at low load | The dependency's slow path. Normal. Not this alert. |
| p99 rising with no change in traffic | A dependency got slower. Check its own latency panel. |
| p99 rising with traffic above 80% of capacity | Queueing. At 94% of capacity the p99 was 594.3 ms with the work per request unchanged. |
| p99 fine, p50 also up | Not a tail problem. Something is slower for everybody, usually a query plan or a cache that stopped working. |

Capacity is 8 workers over a 70 ms mean service time, which is 114 requests a
second. If the offered rate is near that, the fix is capacity or shedding, not
optimisation.

## What to do

- One bad instance: remove it.
- Saturation: add capacity if it is available, and shed load if it is not. A
  deliberate 503 at a queue depth of 20 gave 116 successful responses a second
  at a p99 of 461.3 ms, against a p99 of 2,972.1 ms for responses nobody was
  still waiting for.
- A slow dependency: the circuit breaker should already be doing something. If it
  has not opened, its threshold is wrong and that is a postmortem action.
- A cache that stopped working: check the hit ratio. At 80% hits the median was
  15.7 ms; at 0% it was 121.4 ms with a p99 of 473.7 ms, which is this alert.

## What not to do

- Do not compare this p99 against an average of per instance p99s from another
  dashboard. They disagree by design and the average is the wrong one.
- Do not chase the tail by optimising the median path. At low load the tail is
  the dependency, at high load it is the queue, and they need different fixes.

## Escalation

Thirty minutes with no improvement, or a p99 above one second: treat it as an
availability incident. Slow enough is indistinguishable from down, and callers
with their own timeouts are already counting it as failure.
