"""The bank, which is the dependency that misbehaves.

Two failure modes, because they are different and are usually conflated:

**Slow.** Every call takes seconds. Nothing errors, and the service drowns
holding worker slots for callers who have given up. Level 14's goodput lesson.

**Failing.** Calls return an error quickly, which is much easier to handle and is
what the circuit breaker turns the slow case into.

`timeout_rate` is the third state and the one level 9 insisted on: the call times
out and the bank may or may not have acted, so the payout is **unknown** rather
than failed. The sweeper resolves those, and the capstone asserts that it
resolves all of them.
"""

from __future__ import annotations

import random
import time
from dataclasses import dataclass, field


class BankTimeout(Exception):
    """No answer. The payout may or may not have happened."""


class BankRefused(Exception):
    """A clear no. The payout definitely did not happen."""


@dataclass
class Bank:
    latency_seconds: float = 0.001
    failure_rate: float = 0.0
    timeout_rate: float = 0.0
    rng: random.Random = field(default_factory=lambda: random.Random(20))

    # What the bank actually did, which is the only source of truth for the
    # sweeper and for reconciliation.
    paid: dict[str, int] = field(default_factory=dict)
    calls: int = 0

    def pay(self, reference: str, amount_minor: int) -> str:
        self.calls += 1
        time.sleep(self.latency_seconds)

        if self.rng.random() < self.timeout_rate:
            # The dangerous case: record it, then fail to answer. A client that
            # assumes a timeout means failure pays this merchant twice.
            self.paid.setdefault(reference, amount_minor)
            raise BankTimeout(f"no answer for {reference}")

        if self.rng.random() < self.failure_rate:
            raise BankRefused(f"refused {reference}")

        self.paid.setdefault(reference, amount_minor)
        return f"bank_{len(self.paid):08d}"

    def status(self, reference: str) -> str:
        """What the sweeper asks. The reference was generated before the first
        attempt, which is what makes this question answerable at all."""
        return "paid" if reference in self.paid else "not_found"
