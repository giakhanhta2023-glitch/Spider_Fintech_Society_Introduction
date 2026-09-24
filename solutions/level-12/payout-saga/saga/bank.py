"""The other side: a bank that rejects, times out, and remembers.

Three dials and one rule.

The rule is the one that makes recovery possible at all: **it is idempotent on
our reference.** A second submission carrying the same reference returns the
first answer and does not send a second payment. Every real bank API works this
way, and it is the reason the reference has to be generated once and stored
before the first attempt rather than per attempt.

The detail that makes the simulator worth having: a timeout **records the
payout before raising**. That is what a timeout actually is. The far side may
well have done the work and the answer was lost coming back. A simulator that
only times out on requests it did not process is a kinder world than the real
one, and code tested against it will pay somebody twice in production.
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field


class BankRejected(Exception):
    """A definite no. You know exactly what happened: nothing was sent."""


class BankTimeout(Exception):
    """No answer. You know nothing, and you must not guess."""


@dataclass
class Bank:
    rng: random.Random
    reject_rate: float = 0.06
    timeout_rate: float = 0.05

    submitted: dict[str, str] = field(default_factory=dict)
    submissions: int = 0

    def submit(self, our_ref: str, amount_minor: int) -> str:
        self.submissions += 1

        if our_ref in self.submitted:
            # Idempotent on our reference. This single line is why a retry is
            # safe and why the sweeper can find out what really happened.
            return self.submitted[our_ref]

        roll = self.rng.random()

        if roll < self.reject_rate:
            raise BankRejected("account closed")

        if roll < self.reject_rate + self.timeout_rate:
            self.submitted[our_ref] = self._new_ref()   # it DID land
            raise BankTimeout("no answer")              # you just do not know

        reference = self._new_ref()
        self.submitted[our_ref] = reference
        return reference

    def lookup(self, our_ref: str) -> str | None:
        """What the bank says actually happened. The sweeper's only tool.

        A real integration has either this or a daily settlement file. If it
        has neither, the file is level 10's reconciliation and the sweeper runs
        once a day instead of every two minutes.
        """
        return self.submitted.get(our_ref)

    def _new_ref(self) -> str:
        return f"BANK-{len(self.submitted):06d}"
