"""A token bucket, keyed per customer.

The bucket size is the burst you tolerate; the refill rate is the sustained
rate. Those are two different dials and conflating them is the commonest
mistake in rate limiting.

Keyed per customer rather than globally, because a global limit means one heavy
or misbehaving integration consumes everybody else's allowance. There is a test
asserting that an abusive customer gets 429s while a second customer sees no
change at all.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field

# The same algorithm as a Lua script in Redis, which is how it runs when there
# is more than one instance. It has to be one script rather than a read and a
# write, because two round trips are a race: both instances read 1 token, both
# decide they may proceed, and the limit is silently doubled.
#
#   -- KEYS[1] bucket   ARGV: now, rate, burst
#   local b = redis.call('HMGET', KEYS[1], 'tokens', 'ts')
#   local tokens = tonumber(b[1]) or tonumber(ARGV[3])
#   local ts     = tonumber(b[2]) or tonumber(ARGV[1])
#   tokens = math.min(tonumber(ARGV[3]), tokens + (ARGV[1] - ts) * ARGV[2])
#   if tokens < 1 then return 0 end
#   redis.call('HMSET', KEYS[1], 'tokens', tokens - 1, 'ts', ARGV[1])
#   redis.call('EXPIRE', KEYS[1], 3600)
#   return 1
LUA = "see the comment above: HMGET, refill by elapsed, take one, HMSET"


@dataclass
class Bucket:
    tokens: float
    last_refill: float


@dataclass
class TokenBucket:
    rate_per_second: float
    burst: float
    clock: callable = time.monotonic
    buckets: dict[str, Bucket] = field(default_factory=dict)

    refused: int = 0
    allowed: int = 0

    def allow(self, key: str = "global") -> bool:
        now = self.clock()
        bucket = self.buckets.get(key)
        if bucket is None:
            bucket = Bucket(tokens=self.burst, last_refill=now)
            self.buckets[key] = bucket

        # Refill by elapsed time rather than on a timer. No background job, no
        # drift, and a bucket nobody has touched for an hour is correct the
        # moment it is read.
        elapsed = now - bucket.last_refill
        bucket.tokens = min(self.burst, bucket.tokens + elapsed * self.rate_per_second)
        bucket.last_refill = now

        if bucket.tokens >= 1.0:
            bucket.tokens -= 1.0
            self.allowed += 1
            return True

        self.refused += 1
        return False

    def retry_after_seconds(self, key: str = "global") -> float:
        """What to put in the Retry-After header.

        A caller told exactly when to come back does not poll, and a 429 with
        no Retry-After is an invitation to retry immediately, which is the
        worst possible response to being rate limited.
        """
        bucket = self.buckets.get(key)
        if bucket is None or bucket.tokens >= 1.0:
            return 0.0
        return max(0.0, (1.0 - bucket.tokens) / self.rate_per_second)
