"""A card network that misbehaves on demand.

No real network will decline 14% of your traffic and time out on 3% of it
because you asked, so the simulator is the only way to test the paths that
matter. It has three dials and one rule.

The rule is the important part: it remembers references. A retry carrying the
same reference gets the same answer and does not authorise a second time.
That is the property every real network has, and the reason your reference has
to be generated once and stored before the first attempt rather than per
attempt.
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field
from enum import StrEnum


class Outcome(StrEnum):
    APPROVED = "approved"
    DECLINED = "declined"


class NetworkTimeout(Exception):
    """No answer. This tells you nothing about whether it worked."""


@dataclass(frozen=True, slots=True)
class Authorisation:
    reference: str
    outcome: Outcome
    amount_minor: int
    decline_code: str | None = None
    network_ref: str | None = None


# Roughly the mix in the shipped week: the hard ones are a small share, and
# almost all of the volume that declines is do_not_honour.
DECLINE_CODES = (
    ("do_not_honour", 0.46),
    ("insufficient_funds", 0.27),
    ("expired_card", 0.09),
    ("invalid_account", 0.07),
    ("suspected_fraud", 0.06),
    ("issuer_unavailable", 0.05),
)


@dataclass
class CardNetwork:
    decline_rate: float = 0.1392
    timeout_rate: float = 0.03
    seed: int = 9

    _rng: random.Random = field(init=False)
    _seen: dict[str, Authorisation] = field(default_factory=dict, init=False)
    calls: int = field(default=0, init=False)

    def __post_init__(self) -> None:
        self._rng = random.Random(self.seed)

    def authorize(self, reference: str, amount_minor: int) -> Authorisation:
        """Ask for a hold. Idempotent on the reference.

        A timeout still records the authorisation before raising, because that
        is what a real timeout is: the far side may well have done the work and
        the answer was lost on the way back. A simulator that only times out on
        requests it did not process is a kinder world than the real one, and
        testing against it proves nothing.
        """
        self.calls += 1

        if reference in self._seen:
            return self._seen[reference]

        roll = self._rng.random()

        if roll < self.timeout_rate:
            held = Authorisation(
                reference=reference,
                outcome=Outcome.APPROVED,
                amount_minor=amount_minor,
                network_ref=f"NET{len(self._seen):06d}",
            )
            self._seen[reference] = held      # it happened
            raise NetworkTimeout(reference)   # you just do not know it

        if roll < self.timeout_rate + self.decline_rate:
            result = Authorisation(
                reference=reference,
                outcome=Outcome.DECLINED,
                amount_minor=amount_minor,
                decline_code=self._decline_code(),
            )
        else:
            result = Authorisation(
                reference=reference,
                outcome=Outcome.APPROVED,
                amount_minor=amount_minor,
                network_ref=f"NET{len(self._seen):06d}",
            )

        self._seen[reference] = result
        return result

    def lookup(self, reference: str) -> Authorisation | None:
        """What the network says actually happened. The resolver's only tool.

        In a real integration this is either a lookup endpoint or the daily
        report, and the daily report version is level 10.
        """
        return self._seen.get(reference)

    def _decline_code(self) -> str:
        roll = self._rng.random()
        running = 0.0
        for code, share in DECLINE_CODES:
            running += share
            if roll <= running:
                return code
        return DECLINE_CODES[0][0]
