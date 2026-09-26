"""Exercise 1: integrate against a payment processor from its documentation.

Ninety minutes, and the happy path is about fifteen of them. The other
seventy five are what the exercise is actually scored on, which is why this file
is mostly failure handling.

Five things a reviewer looks for, in the order they matter:

1. **A timeout on every call.** A request with no timeout waits forever, and one
   hung request holds a worker slot. Level 14 measured what that does to a pool
   of eight: at 94% of capacity the p99 went from 265 ms to 594 ms with no change
   in the work.
2. **A retry that is safe.** Retrying a POST that creates a payment is how one
   payment becomes two. The idempotency key is what makes the retry safe, and it
   is generated once per logical payment rather than once per attempt, which is
   the mistake that looks identical and is not.
3. **Backoff with jitter.** Fixed interval retries from many clients synchronise
   into a thundering herd against a service that is already struggling.
4. **Retrying the right things.** 5xx, 429 and a timeout are worth retrying. A
   400 is not: the request is wrong and it will be wrong the second time.
5. **A budget.** Unbounded retries turn a partial outage into a total one.
   Retries are capped, and the cap is a constant somebody can find.

Written against the standard library so the exercise runs anywhere. In a real
integration this is `httpx` with the same arguments, and the transport is injected
so the tests need no network.
"""

from __future__ import annotations

import random
import time
import uuid
from dataclasses import dataclass, field
from typing import Protocol

# Read from the documentation, not invented. Every processor publishes these and
# they are the numbers to copy rather than to guess.
CONNECT_TIMEOUT_SECONDS = 2.0
READ_TIMEOUT_SECONDS = 10.0
MAX_ATTEMPTS = 4                  # the original plus three retries
BASE_BACKOFF_SECONDS = 0.2
MAX_BACKOFF_SECONDS = 8.0

RETRYABLE_STATUS = frozenset({408, 425, 429, 500, 502, 503, 504})


class ProcessorError(Exception):
    """The call failed and retrying will not help. The caller decides what to do."""


class ProcessorUnavailable(Exception):
    """Every attempt failed. The payment did not happen, or is unknown."""


@dataclass(frozen=True, slots=True)
class Response:
    status: int
    body: dict
    headers: dict[str, str] = field(default_factory=dict)


class Transport(Protocol):
    """Injected, so the tests are fast and do not need a network.

    Both timeouts are in the signature rather than in the transport's
    configuration, because a reviewer should be able to see that they are set at
    the call site.
    """

    def post(
        self,
        path: str,
        body: dict,
        headers: dict[str, str],
        connect_timeout: float,
        read_timeout: float,
    ) -> Response: ...


@dataclass
class ProcessorClient:
    transport: Transport
    api_key: str = "sk_test_only_never_real"
    max_attempts: int = MAX_ATTEMPTS
    sleep = staticmethod(time.sleep)
    rng: random.Random = field(default_factory=random.Random)

    # Observability, because "it retried" is not a thing anybody can see
    # otherwise. Level 16's rule: the counter costs nothing and answers the
    # question during the incident.
    attempts_made: int = 0
    retries_made: int = 0
    backoffs: list[float] = field(default_factory=list)

    # ------------------------------------------------------------- the call
    def charge(
        self,
        amount_minor: int,
        currency: str,
        token: str,
        idempotency_key: str | None = None,
    ) -> dict:
        """Take a payment. Safe to retry, safe to call twice with the same key.

        `idempotency_key` is a parameter rather than a local, so a caller
        retrying at a higher level reuses it. Generating it inside the function
        would make every caller level retry a second payment, which is the exact
        bug the key exists to prevent.
        """
        key = idempotency_key or f"idem_{uuid.uuid4().hex}"
        body = {"amount_minor": amount_minor, "currency": currency, "card_token": token}

        last_error: str = "no attempt was made"
        for attempt in range(1, self.max_attempts + 1):
            self.attempts_made += 1
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Idempotency-Key": key,          # the same key on every attempt
                "Idempotency-Attempt": str(attempt),
            }
            try:
                response = self.transport.post(
                    "/v1/charges",
                    body,
                    headers,
                    connect_timeout=CONNECT_TIMEOUT_SECONDS,
                    read_timeout=READ_TIMEOUT_SECONDS,
                )
            except TimeoutError as exc:
                # A timeout is the dangerous case: the charge may have happened.
                # It is retryable only because the idempotency key makes it safe,
                # and without the key the correct behaviour here is to stop and
                # reconcile. Level 9's "unknown is a state" in one comment.
                last_error = f"timeout: {exc}"
                if not self._wait_before_retrying(attempt, None):
                    break
                continue

            if 200 <= response.status < 300:
                return response.body

            if response.status in RETRYABLE_STATUS:
                last_error = f"{response.status}: {response.body.get('error', '')}"
                retry_after = response.headers.get("Retry-After")
                if not self._wait_before_retrying(attempt, retry_after):
                    break
                continue

            # 4xx other than 408, 425 and 429. The request is wrong, so retrying
            # it is just a slower failure.
            raise ProcessorError(
                f"{response.status}: {response.body.get('error', 'refused')}"
            )

        raise ProcessorUnavailable(
            f"{self.max_attempts} attempts failed, last was {last_error}. "
            f"The payment is unknown: resolve it with the processor rather than "
            f"assuming it did not happen."
        )

    # ---------------------------------------------------------- the backoff
    def _wait_before_retrying(self, attempt: int, retry_after: str | None) -> bool:
        if attempt >= self.max_attempts:
            return False                      # the budget, checked before sleeping
        self.retries_made += 1
        delay = self._delay(attempt, retry_after)
        self.backoffs.append(delay)
        self.sleep(delay)
        return True

    def _delay(self, attempt: int, retry_after: str | None) -> float:
        """Exponential backoff with full jitter, and Retry-After when given.

        Full jitter, meaning a uniform draw from zero to the ceiling, rather than
        "the ceiling plus a little noise". The difference matters when a thousand
        clients retry at once: with equal jitter they arrive in a narrow band, and
        with full jitter they spread across the whole window.

        `Retry-After` overrides the calculation, because the server has said how
        long it wants and arguing with that is how a rate limit becomes a ban.
        """
        if retry_after:
            try:
                return min(float(retry_after), MAX_BACKOFF_SECONDS)
            except ValueError:
                pass                          # a date format, which is rarer
        ceiling = min(BASE_BACKOFF_SECONDS * (2 ** (attempt - 1)), MAX_BACKOFF_SECONDS)
        return self.rng.uniform(0, ceiling)
