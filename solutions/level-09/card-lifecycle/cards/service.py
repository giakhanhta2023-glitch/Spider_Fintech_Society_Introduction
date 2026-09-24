"""The service: authorise, capture, void, refund, chargeback, expire, resolve.

Two rules run through every method here.

**Authorising moves no money.** A hold is a promise by the issuer, not a
payment, and posting ledger entries at authorisation is the single most common
way a card ledger ends up disagreeing with the processor. Money moves at
capture.

**Every event is idempotent, not only the first one.** A capture retried
because a response was lost must not capture twice, and that is as true of
refunds and chargebacks as it is of authorisations.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta

from .declines import RetryPolicy, classify
from .ledger import Ledger
from .network import Authorisation, CardNetwork, NetworkTimeout, Outcome
from .states import Event, Guard, IllegalTransition, State, next_state

AUTHORISATION_VALID_FOR = timedelta(days=7)

# What a processor keeps, applied at capture.
FEE_RATE_BASIS_POINTS = 290   # 2.90%
FEE_FIXED_MINOR = 30          # plus 30 cents
DISPUTE_FEE_MINOR = 1500      # what a chargeback costs us, win or lose


@dataclass
class Payment:
    id: str
    merchant_id: str
    amount_minor: int
    currency: str
    reference: str                      # ours, generated once, sent every time
    state: State = State.REQUESTED
    authorized_minor: int = 0
    captured_minor: int = 0
    refunded_minor: int = 0
    released_minor: int = 0
    decline_code: str | None = None
    network_ref: str | None = None
    attempts: int = 0
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    authorized_at: datetime | None = None
    history: list[tuple[str, State, State]] = field(default_factory=list)

    @property
    def guard(self) -> Guard:
        return Guard(
            authorized_minor=self.authorized_minor,
            captured_minor=self.captured_minor,
            refunded_minor=self.refunded_minor,
        )

    def net_minor(self) -> int:
        return self.captured_minor - self.refunded_minor


@dataclass
class CardService:
    network: CardNetwork
    ledger: Ledger = field(default_factory=Ledger)
    retry_policy: RetryPolicy = field(default_factory=RetryPolicy)
    payments: dict[str, Payment] = field(default_factory=dict)
    # event key -> the payment it already applied to. This is what makes every
    # event idempotent rather than only authorisation.
    _applied: dict[str, str] = field(default_factory=dict)
    _sequence: int = 0

    # ------------------------------------------------------------- helpers
    def _move(self, payment: Payment, event: Event, at: datetime | None = None) -> None:
        was = payment.state
        payment.state = next_state(payment.state, event, payment.id)
        payment.history.append((event, was, payment.state))

    def _once(self, event_key: str | None) -> bool:
        """True when this event has already been applied.

        Returning the original outcome rather than raising, because a retry is
        not an error: the caller is asking for the same thing twice and should
        get the same answer twice.
        """
        return event_key is not None and event_key in self._applied

    def _remember(self, event_key: str | None, payment_id: str) -> None:
        if event_key is not None:
            self._applied[event_key] = payment_id

    # ----------------------------------------------------------- authorise
    def authorize(
        self,
        payment_id: str,
        merchant_id: str,
        amount_minor: int,
        currency: str = "USD",
        event_key: str | None = None,
    ) -> Payment:
        if self._once(event_key):
            return self.payments[self._applied[event_key]]  # type: ignore[index]

        payment = self.payments.get(payment_id)
        if payment is None:
            self._sequence += 1
            payment = Payment(
                id=payment_id,
                merchant_id=merchant_id,
                amount_minor=amount_minor,
                currency=currency,
                # Generated once, here, and stored before the first attempt.
                # A reference generated per attempt turns one payment into
                # several and makes the resolver impossible.
                reference=f"REF{self._sequence:08d}",
            )
            self.payments[payment_id] = payment

        # Already answered. A caller retrying an authorisation that we know
        # the outcome of must get that outcome back, not a second trip to the
        # network. UNKNOWN is the exception: there the whole point is to ask
        # again, and asking with the same reference is safe because the network
        # returns the hold it already recorded.
        if payment.state not in (State.REQUESTED, State.UNKNOWN):
            self._remember(event_key, payment_id)
            return payment

        payment.attempts += 1
        try:
            result: Authorisation = self.network.authorize(
                payment.reference, amount_minor
            )
        except NetworkTimeout:
            # We know nothing. Not failed, not succeeded.
            self._move(payment, Event.TIMEOUT)
            self._remember(event_key, payment_id)
            return payment

        if result.outcome is Outcome.APPROVED:
            self._move(payment, Event.AUTHORIZE)
            payment.authorized_minor = result.amount_minor
            payment.network_ref = result.network_ref
            payment.authorized_at = datetime.now(UTC)
        else:
            self._move(payment, Event.DECLINE)
            payment.decline_code = result.decline_code

        # No ledger entries. An authorisation is a hold, not a movement.
        self._remember(event_key, payment_id)
        return payment

    def should_retry(self, payment: Payment) -> bool:
        return self.retry_policy.should_retry(payment.decline_code, payment.attempts)

    # ------------------------------------------------------------- capture
    def capture(
        self,
        payment_id: str,
        amount_minor: int | None = None,
        event_key: str | None = None,
    ) -> Payment:
        """Take the money, in full or in part, and post the ledger entries.

        A partial capture releases the rest of the hold. The released amount is
        reported rather than left implicit, because the merchant's available
        balance depends on it and support will be asked about it.
        """
        if self._once(event_key):
            return self.payments[self._applied[event_key]]  # type: ignore[index]

        payment = self._get(payment_id)
        amount = payment.authorized_minor if amount_minor is None else amount_minor
        payment.guard.check(Event.CAPTURE, amount)

        self._move(payment, Event.CAPTURE)
        payment.captured_minor = amount
        payment.released_minor = payment.authorized_minor - amount

        fee = amount * FEE_RATE_BASIS_POINTS // 10_000 + FEE_FIXED_MINOR
        self.ledger.post(
            f"capture {payment.id}",
            {
                "card_receivable": amount,
                "merchant_payable": -(amount - fee),
                "fees_income": -fee,
            },
        )
        self._remember(event_key, payment_id)
        return payment

    # ---------------------------------------------------------------- void
    def void(self, payment_id: str, event_key: str | None = None) -> Payment:
        """Release an authorisation that was never captured. No money moved, so
        no ledger entries: there is nothing to reverse."""
        if self._once(event_key):
            return self.payments[self._applied[event_key]]  # type: ignore[index]

        payment = self._get(payment_id)
        self._move(payment, Event.VOID)
        payment.released_minor = payment.authorized_minor
        self._remember(event_key, payment_id)
        return payment

    def cancel(
        self, payment_id: str, amount_minor: int | None = None, event_key: str | None = None
    ) -> Payment:
        """One rule for the caller: cancel this.

        Uncaptured is a void, captured is a refund. Making the caller choose is
        how a void gets attempted on a captured payment at the exact moment
        somebody is trying to give money back.
        """
        payment = self._get(payment_id)
        if payment.state is State.CAPTURED:
            return self.refund(payment_id, amount_minor, event_key=event_key)
        return self.void(payment_id, event_key=event_key)

    # -------------------------------------------------------------- refund
    def refund(
        self,
        payment_id: str,
        amount_minor: int | None = None,
        event_key: str | None = None,
    ) -> Payment:
        if self._once(event_key):
            return self.payments[self._applied[event_key]]  # type: ignore[index]

        payment = self._get(payment_id)
        amount = payment.captured_minor if amount_minor is None else amount_minor
        payment.guard.check(Event.REFUND, amount)

        self._move(payment, Event.REFUND)
        payment.refunded_minor += amount

        # The fee is not returned, which is the industry norm and the thing
        # merchants are most often surprised by.
        self.ledger.post(
            f"refund {payment.id}",
            {"card_receivable": -amount, "merchant_payable": amount},
        )
        self._remember(event_key, payment_id)
        return payment

    # ---------------------------------------------------------- chargeback
    def chargeback(self, payment_id: str, event_key: str | None = None) -> Payment:
        """The cardholder disputed it. The money goes back and we pay a fee.

        Two movements, not one, and separating them matters: the reversal is
        the customer's money and the dispute fee is our cost, and a report that
        adds them together cannot tell you what disputes are costing.
        """
        if self._once(event_key):
            return self.payments[self._applied[event_key]]  # type: ignore[index]

        payment = self._get(payment_id)
        disputed = payment.net_minor()
        self._move(payment, Event.CHARGEBACK)

        movements = {"card_receivable": -disputed, "merchant_payable": disputed}
        if disputed == 0:
            movements = {}
        if movements:
            self.ledger.post(f"chargeback {payment.id}", movements)
        self.ledger.post(
            f"dispute fee {payment.id}",
            {"dispute_expense": DISPUTE_FEE_MINOR, "merchant_payable": -DISPUTE_FEE_MINOR},
        )
        self._remember(event_key, payment_id)
        return payment

    # ------------------------------------------------------------- expiry
    def expire_stale(self, now: datetime | None = None) -> dict[str, int]:
        """Release authorisations older than seven days.

        Safe to run twice: the second run finds nothing, because the first one
        moved them out of AUTHORIZED. That property is what lets this be a cron
        job rather than a thing somebody runs carefully.
        """
        now = now or datetime.now(UTC)
        expired = 0
        released = 0
        for payment in self.payments.values():
            if payment.state is not State.AUTHORIZED or payment.authorized_at is None:
                continue
            if now - payment.authorized_at < AUTHORISATION_VALID_FOR:
                continue
            self._move(payment, Event.EXPIRE)
            payment.released_minor = payment.authorized_minor
            expired += 1
            released += payment.authorized_minor
        return {"expired": expired, "released_minor": released}

    # ------------------------------------------------------------ resolver
    def resolve_unknown(self) -> dict[str, int]:
        """Ask the network what really happened to everything in `unknown`.

        This is the job that makes `unknown` safe to have. Without it, an
        unknown payment sits there forever and somebody eventually decides to
        retry it, which is how a cardholder gets charged twice.
        """
        approved = declined = 0
        for payment in self.payments.values():
            if payment.state is not State.UNKNOWN:
                continue
            truth = self.network.lookup(payment.reference)
            if truth is not None and truth.outcome is Outcome.APPROVED:
                self._move(payment, Event.RESOLVE_APPROVED)
                payment.authorized_minor = truth.amount_minor
                payment.network_ref = truth.network_ref
                payment.authorized_at = datetime.now(UTC)
                approved += 1
            else:
                self._move(payment, Event.RESOLVE_DECLINED)
                payment.decline_code = (
                    truth.decline_code if truth else "no_record_at_network"
                )
                declined += 1
        return {"resolved": approved + declined, "approved": approved, "declined": declined}

    # -------------------------------------------------------------- lookup
    def _get(self, payment_id: str) -> Payment:
        try:
            return self.payments[payment_id]
        except KeyError:
            raise IllegalTransition(State.REQUESTED, Event.CAPTURE, payment_id) from None
