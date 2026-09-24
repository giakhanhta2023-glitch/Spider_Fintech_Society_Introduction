"""A cache with single flight, and the list of what must never be in it.

The stampede is the failure worth designing against. A popular key expires and
the thousand requests that wanted it all miss at the same instant and all do the
same expensive work. Single flight means the first miss does the work while
everybody else waits for its answer, so a hot key expiring costs one call
rather than a thousand.
"""

from __future__ import annotations

import random
import threading
import time
from dataclasses import dataclass, field

# What this service must never cache, and why. Not a style preference: the rule
# is that a stale read which only SHOWS something is a performance decision,
# and a stale read which AUTHORISES something is a double spend.
NEVER_CACHE = {
    "account balances": "a stale balance authorises a payment the customer cannot afford",
    "limit and velocity checks": "the whole point is the current count, and a cached one is a bypass",
    "idempotency key lookups": "a stale miss creates a second payment for the same request",
    "fraud decisions": "the inputs change per request; a cached verdict is a verdict about a different request",
    "anything that decides whether money moves": "the general form of all of the above",
}

CACHEABLE = {
    "merchant configuration": "changes rarely, read constantly, and a few seconds stale is invisible",
    "fee schedules": "same, and versioned anyway",
    "currency and country reference data": "effectively immutable",
    "card network routing tables": "changes on a schedule you control",
}


@dataclass
class Entry:
    value: object
    expires_at: float


@dataclass
class Cache:
    ttl_seconds: float = 30.0
    # Jitter, so keys written together do not expire together. Without it a
    # deploy that warms a thousand keys creates a thousand simultaneous misses
    # exactly ttl seconds later.
    jitter: float = 0.1
    clock: callable = time.monotonic

    _data: dict[str, Entry] = field(default_factory=dict)
    _locks: dict[str, threading.Lock] = field(default_factory=dict)
    _guard: threading.Lock = field(default_factory=threading.Lock)
    _rng: random.Random = field(default_factory=lambda: random.Random(14))

    hits: int = 0
    misses: int = 0
    work_done: int = 0        # how many times the expensive function actually ran

    @property
    def hit_ratio(self) -> float:
        total = self.hits + self.misses
        return self.hits / total if total else 0.0

    def get_or_load(self, key: str, load):
        """Single flight: one caller does the work, the rest wait for it.

        The second check inside the lock is the part people leave out. Without
        it, every waiter that queued on the lock goes on to do the work anyway
        after the first one has already filled the cache.
        """
        entry = self._data.get(key)
        now = self.clock()
        if entry is not None and entry.expires_at > now:
            self.hits += 1
            return entry.value

        self.misses += 1

        with self._guard:
            lock = self._locks.setdefault(key, threading.Lock())

        with lock:
            entry = self._data.get(key)
            now = self.clock()
            if entry is not None and entry.expires_at > now:
                return entry.value      # somebody else filled it while we waited

            value = load()
            self.work_done += 1
            ttl = self.ttl_seconds * (1 + self._rng.uniform(-self.jitter, self.jitter))
            self._data[key] = Entry(value=value, expires_at=now + ttl)
            return value

    def expire(self, key: str) -> None:
        self._data.pop(key, None)

    def reset_counters(self) -> None:
        self.hits = self.misses = self.work_done = 0
