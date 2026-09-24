"""The state machine, as data.

Written as a table rather than as if statements scattered through the service,
for one reason: when it is data you can print it, test every cell of it, and
see the whole thing at once. When it is conditionals you find out what the
rules are by reading six functions and hoping you found them all.

    requested ─auth──▶ authorized ─capture─▶ captured ─refund──────▶ refunded
        │                  │                    │
        │                  ├─void──▶ voided     └─chargeback─▶ charged_back
        │                  └─expire▶ expired
        ├─decline─▶ declined
        └─timeout─▶ unknown ──▶ (the resolver decides: authorized or declined)

`unknown` is a state rather than an error. A network call that times out has
told you nothing, and pretending it failed is how a payment gets authorised
twice: once by the request that timed out and once by the retry.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum


class State(StrEnum):
    REQUESTED = "requested"
    AUTHORIZED = "authorized"
    CAPTURED = "captured"
    VOIDED = "voided"
    REFUNDED = "refunded"
    CHARGED_BACK = "charged_back"
    EXPIRED = "expired"
    DECLINED = "declined"
    UNKNOWN = "unknown"


class Event(StrEnum):
    AUTHORIZE = "authorize"
    DECLINE = "decline"
    TIMEOUT = "timeout"
    RESOLVE_APPROVED = "resolve_approved"
    RESOLVE_DECLINED = "resolve_declined"
    CAPTURE = "capture"
    VOID = "void"
    EXPIRE = "expire"
    REFUND = "refund"
    CHARGEBACK = "chargeback"


# (from state, event) -> to state. Everything not in here is illegal, which is
# the useful direction: a transition nobody wrote down cannot happen by
# accident.
TRANSITIONS: dict[tuple[State, Event], State] = {
    (State.REQUESTED, Event.AUTHORIZE): State.AUTHORIZED,
    (State.REQUESTED, Event.DECLINE): State.DECLINED,
    (State.REQUESTED, Event.TIMEOUT): State.UNKNOWN,
    (State.UNKNOWN, Event.RESOLVE_APPROVED): State.AUTHORIZED,
    (State.UNKNOWN, Event.RESOLVE_DECLINED): State.DECLINED,
    (State.AUTHORIZED, Event.CAPTURE): State.CAPTURED,
    (State.AUTHORIZED, Event.VOID): State.VOIDED,
    (State.AUTHORIZED, Event.EXPIRE): State.EXPIRED,
    (State.CAPTURED, Event.REFUND): State.REFUNDED,
    (State.CAPTURED, Event.CHARGEBACK): State.CHARGED_BACK,
    # A refunded payment can still be disputed. The money has gone back and
    # the cardholder disputes it anyway, which happens and has to be possible.
    (State.REFUNDED, Event.CHARGEBACK): State.CHARGED_BACK,
}

FINAL = frozenset(
    {State.VOIDED, State.EXPIRED, State.DECLINED, State.CHARGED_BACK}
)


class IllegalTransition(Exception):
    """A transition the table does not contain.

    Carries all three parts, because "illegal transition" on its own in a log
    at 3am is not enough to find anything.
    """

    def __init__(self, state: State, event: Event, payment_id: str | None = None) -> None:
        where = f" on {payment_id}" if payment_id else ""
        super().__init__(f"cannot {event} a payment that is {state}{where}")
        self.state = state
        self.event = event
        self.payment_id = payment_id


@dataclass(frozen=True, slots=True)
class Guard:
    """Everything the amounts have to satisfy, in one place.

    Separate from the transition table on purpose. The table answers "is this
    event allowed from this state", and the guard answers "is this particular
    amount allowed". Mixing them produces a table with conditions in it, which
    stops being readable at about the fourth rule.
    """

    authorized_minor: int = 0
    captured_minor: int = 0
    refunded_minor: int = 0

    def check(self, event: Event, amount_minor: int) -> None:
        if event in (Event.CAPTURE, Event.REFUND) and amount_minor <= 0:
            raise ValueError(f"{event} needs a positive amount")

        if event is Event.CAPTURE and amount_minor > self.authorized_minor:
            raise ValueError(
                f"cannot capture {amount_minor} against an authorisation of "
                f"{self.authorized_minor}"
            )

        if event is Event.REFUND:
            available = self.captured_minor - self.refunded_minor
            if amount_minor > available:
                raise ValueError(
                    f"cannot refund {amount_minor}: only {available} is refundable"
                )


def next_state(state: State, event: Event, payment_id: str | None = None) -> State:
    """The only way state changes in this codebase."""
    try:
        return TRANSITIONS[(state, event)]
    except KeyError:
        raise IllegalTransition(state, event, payment_id) from None


def allowed(state: State) -> list[Event]:
    """What can happen next. Used by the API to tell a caller what it could do
    instead of what it just tried."""
    return [event for (s, event) in TRANSITIONS if s == state]
