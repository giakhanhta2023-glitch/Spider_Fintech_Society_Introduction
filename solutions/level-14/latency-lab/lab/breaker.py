"""A circuit breaker, and the thing that makes most of them wrong.

Three states:

    closed     everything normal, calls go through
    open       stop calling entirely, fail immediately
    half_open  let ONE call through to see whether it has recovered

It converts a slow failure into a fast one, which matters more than it sounds:
a dependency that hangs for two seconds occupies a worker slot for two seconds,
and at any real request rate that is how one broken dependency takes out a
service that did not need it.

**The thing most breakers get wrong** is counting raw failures. Five failures
out of eight is a broken dependency; five out of five thousand is Tuesday. This
one uses a failure RATE over a rolling window with a minimum volume, so it does
not open during a normal spike and does not stay closed through a real outage.
"""

from __future__ import annotations

import time
from collections import deque
from dataclasses import dataclass, field
from enum import StrEnum


class State(StrEnum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


class BreakerOpen(Exception):
    """The breaker refused the call. Fail fast, do not queue."""


@dataclass
class CircuitBreaker:
    failure_rate: float = 0.5        # open above this share of failures
    minimum_calls: int = 20          # ...but only once there are enough to judge
    window_seconds: float = 10.0
    cool_off_seconds: float = 5.0
    clock: callable = time.monotonic

    _events: deque = field(default_factory=deque)     # (when, failed)
    _state: State = State.CLOSED
    _opened_at: float = 0.0
    _half_open_in_flight: bool = False

    transitions: list[tuple[str, str]] = field(default_factory=list)

    @property
    def state(self) -> State:
        if self._state is State.OPEN:
            if self.clock() - self._opened_at >= self.cool_off_seconds:
                self._to(State.HALF_OPEN)
        return self._state

    def _to(self, state: State) -> None:
        if state is not self._state:
            self.transitions.append((str(self._state), str(state)))
            self._state = state
            if state is State.OPEN:
                self._opened_at = self.clock()
                self._events.clear()
            if state is State.HALF_OPEN:
                self._half_open_in_flight = False

    def _trim(self) -> None:
        cutoff = self.clock() - self.window_seconds
        while self._events and self._events[0][0] < cutoff:
            self._events.popleft()

    def before_call(self) -> None:
        """Raises BreakerOpen when the call must not be made."""
        state = self.state
        if state is State.OPEN:
            raise BreakerOpen("the breaker is open")
        if state is State.HALF_OPEN:
            if self._half_open_in_flight:
                # Exactly one probe at a time. Letting several through means a
                # still-broken dependency gets a burst the moment the cool off
                # ends, which is how a recovering service is knocked over again.
                raise BreakerOpen("a probe is already in flight")
            self._half_open_in_flight = True

    def record(self, failed: bool) -> None:
        state = self._state
        if state is State.HALF_OPEN:
            self._half_open_in_flight = False
            self._to(State.OPEN if failed else State.CLOSED)
            return

        self._events.append((self.clock(), failed))
        self._trim()

        if len(self._events) < self.minimum_calls:
            return
        failures = sum(1 for _, f in self._events if f)
        if failures / len(self._events) >= self.failure_rate:
            self._to(State.OPEN)

    def call(self, fn, *args, **kwargs):
        self.before_call()
        try:
            result = fn(*args, **kwargs)
        except Exception:
            self.record(failed=True)
            raise
        self.record(failed=False)
        return result
