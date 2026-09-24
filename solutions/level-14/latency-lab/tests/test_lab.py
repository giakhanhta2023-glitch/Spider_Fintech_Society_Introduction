"""Tests for the pieces. The measurements live in lab/experiments.py.

Everything here runs in process and in milliseconds. The numbers in the README
come from the experiment runner, which takes minutes and is a separate thing:
a test suite that takes ten minutes is a test suite people stop running.
"""

from __future__ import annotations

import threading
import time

import pytest

from lab.breaker import BreakerOpen, CircuitBreaker, State
from lab.cache import CACHEABLE, NEVER_CACHE, Cache
from lab.limiter import TokenBucket


class FakeClock:
    """Time under test control, so nothing here sleeps."""

    def __init__(self) -> None:
        self.now = 1_000.0

    def __call__(self) -> float:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += seconds


# ------------------------------------------------------------- the limiter
def test_a_burst_of_exactly_the_bucket_size_is_allowed_then_the_rate() -> None:
    clock = FakeClock()
    limiter = TokenBucket(rate_per_second=10, burst=5, clock=clock)

    assert sum(limiter.allow("m1") for _ in range(5)) == 5   # the burst
    assert limiter.allow("m1") is False                       # and then no

    clock.advance(0.1)          # one token at 10 per second
    assert limiter.allow("m1") is True
    assert limiter.allow("m1") is False


def test_an_abusive_customer_does_not_affect_another_customer() -> None:
    """The reason the limiter is keyed per customer rather than globally."""
    clock = FakeClock()
    limiter = TokenBucket(rate_per_second=10, burst=5, clock=clock)

    for _ in range(200):
        limiter.allow("abusive")

    # The well behaved customer's bucket has not been touched.
    assert sum(limiter.allow("polite") for _ in range(5)) == 5


def test_retry_after_says_when_to_come_back() -> None:
    clock = FakeClock()
    limiter = TokenBucket(rate_per_second=2, burst=1, clock=clock)

    assert limiter.allow("m1") is True
    assert limiter.allow("m1") is False
    assert limiter.retry_after_seconds("m1") == pytest.approx(0.5, abs=0.01)


def test_a_bucket_nobody_touched_for_an_hour_is_correct_when_read() -> None:
    clock = FakeClock()
    limiter = TokenBucket(rate_per_second=1, burst=10, clock=clock)
    for _ in range(10):
        limiter.allow("m1")
    assert limiter.allow("m1") is False

    clock.advance(3600)
    assert sum(limiter.allow("m1") for _ in range(10)) == 10   # refilled, capped at burst
    assert limiter.allow("m1") is False


# --------------------------------------------------------------- the cache
def test_a_hit_does_not_touch_the_backend() -> None:
    clock = FakeClock()
    cache = Cache(ttl_seconds=30, clock=clock)
    calls = {"n": 0}

    def load() -> str:
        calls["n"] += 1
        return "config"

    for _ in range(50):
        assert cache.get_or_load("merchant:1", load) == "config"

    assert calls["n"] == 1
    assert cache.hits == 49
    assert cache.misses == 1
    assert cache.hit_ratio == pytest.approx(49 / 50)


def test_expiring_a_hot_key_under_load_does_the_work_exactly_once() -> None:
    """The stampede, and single flight stopping it.

    Twenty threads all miss the same key at the same moment. Without single
    flight the expensive function runs twenty times; with it, once.
    """
    cache = Cache(ttl_seconds=30)
    calls = {"n": 0}
    start = threading.Barrier(20)

    def load() -> str:
        calls["n"] += 1
        time.sleep(0.02)        # expensive enough for the others to pile up
        return "config"

    def worker() -> None:
        start.wait()
        cache.get_or_load("hot", load)

    threads = [threading.Thread(target=worker) for _ in range(20)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert calls["n"] == 1
    assert cache.work_done == 1


def test_the_never_cache_list_is_written_down_with_reasons() -> None:
    """Requirement 7. A list with no reasons is a list nobody can extend."""
    assert "account balances" in NEVER_CACHE
    assert "idempotency key lookups" in NEVER_CACHE
    assert all(reason for reason in NEVER_CACHE.values())
    assert set(NEVER_CACHE) & set(CACHEABLE) == set()


# ------------------------------------------------------------- the breaker
def test_the_breaker_opens_on_a_failure_rate_not_a_raw_count() -> None:
    """Five failures out of eight is a broken dependency. Five out of five
    thousand is Tuesday."""
    clock = FakeClock()
    breaker = CircuitBreaker(failure_rate=0.5, minimum_calls=20, clock=clock)

    for _ in range(19):
        breaker.record(failed=False)
    for _ in range(5):
        breaker.record(failed=False)
    for _ in range(5):
        breaker.record(failed=True)

    assert breaker.state is State.CLOSED     # 5 of 29 is not 50%


def test_the_breaker_opens_when_the_rate_is_bad_enough() -> None:
    clock = FakeClock()
    breaker = CircuitBreaker(failure_rate=0.5, minimum_calls=10, clock=clock)

    for _ in range(20):
        breaker.record(failed=True)

    assert breaker.state is State.OPEN
    with pytest.raises(BreakerOpen):
        breaker.before_call()


def test_all_three_states_in_order() -> None:
    clock = FakeClock()
    breaker = CircuitBreaker(
        failure_rate=0.5, minimum_calls=10, cool_off_seconds=5, clock=clock
    )

    assert breaker.state is State.CLOSED
    for _ in range(20):
        breaker.record(failed=True)
    assert breaker.state is State.OPEN

    clock.advance(5)
    assert breaker.state is State.HALF_OPEN

    breaker.before_call()
    breaker.record(failed=False)          # the probe succeeded
    assert breaker.state is State.CLOSED

    assert [t[1] for t in breaker.transitions] == ["open", "half_open", "closed"]


def test_only_one_probe_is_let_through_while_half_open() -> None:
    """Letting several through means a recovering dependency gets a burst the
    moment the cool off ends, which knocks it over again."""
    clock = FakeClock()
    breaker = CircuitBreaker(minimum_calls=10, cool_off_seconds=5, clock=clock)
    for _ in range(20):
        breaker.record(failed=True)
    clock.advance(5)

    breaker.before_call()                  # the one probe
    with pytest.raises(BreakerOpen):
        breaker.before_call()              # everybody else


def test_a_failed_probe_reopens_the_breaker() -> None:
    clock = FakeClock()
    breaker = CircuitBreaker(minimum_calls=10, cool_off_seconds=5, clock=clock)
    for _ in range(20):
        breaker.record(failed=True)
    clock.advance(5)

    breaker.before_call()
    breaker.record(failed=True)

    assert breaker._state is State.OPEN


def test_the_breaker_turns_a_slow_failure_into_a_fast_one() -> None:
    clock = FakeClock()
    breaker = CircuitBreaker(minimum_calls=5, clock=clock)

    def slow_and_broken() -> None:
        raise TimeoutError("two seconds of nothing")

    for _ in range(10):
        with pytest.raises((TimeoutError, BreakerOpen)):
            breaker.call(slow_and_broken)

    # Once open, the call does not happen at all: no worker slot occupied.
    assert breaker.state is State.OPEN
    with pytest.raises(BreakerOpen):
        breaker.call(slow_and_broken)
