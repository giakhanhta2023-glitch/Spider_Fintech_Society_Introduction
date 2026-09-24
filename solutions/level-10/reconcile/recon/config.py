"""Everything that is a policy decision rather than a fact, in one file.

The rule this follows: if somebody could reasonably disagree with a number, it
belongs here with a comment saying why it is what it is. A settlement window
buried inside an `if` is a policy nobody can find, nobody can change safely,
and nobody remembers choosing.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal


@dataclass(frozen=True, slots=True)
class FeeModel:
    """What we believe the processor should have charged.

    Rounding is HALF_UP and stated explicitly, because the processor rounds
    somewhere and a different rule produces a one cent difference on a large
    share of lines. That is the difference between a fee check that finds real
    errors and one that reports thousands of false ones.
    """

    rate: Decimal = Decimal("0.029")
    fixed_minor: int = 30

    def expected(self, gross_minor: int) -> int:
        from decimal import ROUND_HALF_UP

        exact = Decimal(gross_minor) * self.rate + Decimal(self.fixed_minor)
        return int(exact.quantize(Decimal(1), rounding=ROUND_HALF_UP))


@dataclass(frozen=True, slots=True)
class Config:
    # How long a capture may go unsettled before it is a break rather than
    # simply not having settled yet.
    #
    # Three days, chosen because the processor's own documentation says T+2 and
    # a day of slack costs nothing: a break raised too early is investigated by
    # a person and found to be nothing, which is more expensive than finding it
    # a day later. Card schemes settle on business days, so a Friday capture
    # legitimately has not settled by Monday morning.
    settlement_window_days: int = 3

    # Differences at or below this are recorded and not escalated.
    #
    # Zero, for amounts. A payments reconciliation with a tolerance is a
    # reconciliation that will one day hide a real problem inside the
    # tolerance, and "a cent here and there" is how people describe a bug
    # before they understand it. Currency conversion rounding is handled by
    # classifying those lines as their own break type rather than by widening
    # a tolerance until they disappear.
    amount_tolerance_minor: int = 0

    # Fee differences, though, do get a tolerance of one cent, because the
    # processor rounds a converted amount and we cannot reproduce their
    # intermediate value exactly. One cent is provable rounding; two is a
    # different fee schedule and somebody should look.
    fee_tolerance_minor: int = 1

    fees: FeeModel = field(default_factory=FeeModel)

    # Who gets the ticket. A break with no owner is a break nobody works.
    owners: dict[str, str] = field(
        default_factory=lambda: {
            "amount_mismatch": "payments engineering",
            "currency_rounding": "payments engineering",
            "duplicate_settlement": "processor operations",
            "missing_in_ledger": "payments engineering",
            "unsettled_capture": "processor operations",
            "fee_mismatch": "finance",
            "payout_mismatch": "finance",
            "pending_settlement": "nobody: this is not a break",
        }
    )


DEFAULT = Config()
