"""Hard declines and soft ones, and why retrying the wrong kind is expensive.

A **hard** decline is the issuer saying no permanently: the card is expired,
the account is closed, the transaction looks fraudulent. Retrying it cannot
succeed. Networks charge for the attempt, issuers count your retry rate, and a
merchant who retries hard declines gets a worse approval rate on everything
else.

A **soft** decline is the issuer saying not now: insufficient funds this
morning, an issuer that was briefly unreachable. Retrying later can work, and
this is where recovered revenue actually comes from.

Getting this backwards is one of the more expensive mistakes in card
processing, and it is four lines of code.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum


class Kind(StrEnum):
    HARD = "hard"
    SOFT = "soft"


HARD_CODES = frozenset(
    {
        "expired_card",
        "invalid_account",
        "stolen_card",
        "lost_card",
        "pickup_card",
        "suspected_fraud",
        "revocation_of_authorisation",
    }
)

SOFT_CODES = frozenset(
    {
        "insufficient_funds",
        "do_not_honour",
        "issuer_unavailable",
        "try_again_later",
        "velocity_exceeded",
    }
)


def classify(decline_code: str | None) -> Kind:
    """Unknown codes are treated as hard.

    Deliberately the cautious direction. Treating an unrecognised code as soft
    means retrying something the issuer may consider abusive; treating it as
    hard costs one recoverable payment and produces a line in the report that
    says a code needs classifying.
    """
    if decline_code in SOFT_CODES:
        return Kind.SOFT
    return Kind.HARD


@dataclass(frozen=True, slots=True)
class RetryPolicy:
    """When to try again, and when to stop.

    The delays grow, and the last one is a day, because "insufficient funds"
    on a Tuesday morning is a different answer from "insufficient funds" on
    Friday afternoon when the salary has landed.
    """

    max_attempts: int = 3
    delays_seconds: tuple[int, ...] = (60 * 60, 6 * 60 * 60, 24 * 60 * 60)

    def should_retry(self, decline_code: str | None, attempts_so_far: int) -> bool:
        if classify(decline_code) is Kind.HARD:
            return False
        return attempts_so_far < self.max_attempts

    def delay_for(self, attempts_so_far: int) -> int:
        index = min(attempts_so_far, len(self.delays_seconds) - 1)
        return self.delays_seconds[index]
