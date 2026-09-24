"""The merchant report, and the gap nobody asks about until they do.

The line that earns its place is `authorised_never_captured`: money that was
held against a cardholder's card and then released without ever being taken.
It is invisible in a revenue report and it is the number that explains why a
merchant's customers complain about a pending charge for a purchase that never
happened.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass

from .service import CardService
from .states import State


@dataclass(frozen=True, slots=True)
class MerchantReport:
    merchant_id: str
    authorised: int
    authorised_minor: int
    captured: int
    captured_minor: int
    refunded: int
    refunded_minor: int
    charged_back: int
    charged_back_minor: int
    voided: int
    expired: int
    declined: int
    unknown: int
    authorised_never_captured: int
    authorised_never_captured_minor: int
    net_minor: int

    def adds_up(self) -> bool:
        """captured minus refunds minus chargebacks equals net."""
        return (
            self.captured_minor - self.refunded_minor - self.charged_back_minor
            == self.net_minor
        )

    def as_dict(self) -> dict[str, object]:
        return asdict(self)


def merchant_report(service: CardService, merchant_id: str) -> MerchantReport:
    mine = [p for p in service.payments.values() if p.merchant_id == merchant_id]

    def count(*states: State) -> int:
        return sum(1 for p in mine if p.state in states)

    captured_minor = sum(p.captured_minor for p in mine)
    refunded_minor = sum(p.refunded_minor for p in mine)
    charged_back_minor = sum(
        p.captured_minor - p.refunded_minor for p in mine if p.state is State.CHARGED_BACK
    )
    never_captured = [
        p for p in mine if p.state in (State.VOIDED, State.EXPIRED) and p.authorized_minor
    ]

    return MerchantReport(
        merchant_id=merchant_id,
        authorised=sum(1 for p in mine if p.authorized_minor),
        authorised_minor=sum(p.authorized_minor for p in mine),
        captured=count(State.CAPTURED, State.REFUNDED, State.CHARGED_BACK),
        captured_minor=captured_minor,
        refunded=sum(1 for p in mine if p.refunded_minor),
        refunded_minor=refunded_minor,
        charged_back=count(State.CHARGED_BACK),
        charged_back_minor=charged_back_minor,
        voided=count(State.VOIDED),
        expired=count(State.EXPIRED),
        declined=count(State.DECLINED),
        unknown=count(State.UNKNOWN),
        authorised_never_captured=len(never_captured),
        authorised_never_captured_minor=sum(p.authorized_minor for p in never_captured),
        net_minor=captured_minor - refunded_minor - charged_back_minor,
    )
