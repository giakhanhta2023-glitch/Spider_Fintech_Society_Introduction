"""The payment path, end to end, in one function.

    tokenise the card        -> the vault
    post the money           -> the ledger, balanced
    write the event          -> the outbox, same transaction as the payment
    publish and pay out      -> the consumer and the bank, asynchronously

Every failure the capstone injects lands somewhere in this function, and the
behaviour under each is the thing being tested:

  the ledger is gone        -> 503, no token consumed, nothing half written
  the vault credential dies -> 503, and an explicit CredentialRevoked
  the publisher stops       -> payments keep succeeding, the backlog grows
  the bank times out        -> the payout is unknown, and the sweeper resolves it
"""

from __future__ import annotations

import itertools
import time
from dataclasses import dataclass, field

from .bank import Bank, BankRefused, BankTimeout
from .ledger import Ledger, LedgerUnavailable
from .queue import Consumer, Event, Outbox
from .vault import CredentialRevoked, Vault

MERCHANT_ACCOUNT = "merchant_payable"
SETTLEMENT_ACCOUNT = "settlement_receivable"
FEE_ACCOUNT = "fee_income"
BANK_CLEARING = "bank_clearing"
FEE_BASIS_POINTS = 290


@dataclass
class Payment:
    id: str
    merchant_id: str
    amount_minor: int
    fee_minor: int
    token: str
    status: str                       # captured, failed
    payout_state: str = "pending"     # pending, paid, unknown, compensated
    payout_reference: str = ""
    bank_reference: str = ""
    at: float = field(default_factory=time.time)


@dataclass
class Api:
    ledger: Ledger
    vault: Vault
    outbox: Outbox
    credential: str = "vault_live_capstone"
    payments: dict[str, Payment] = field(default_factory=dict)
    _ids: itertools.count = field(default_factory=lambda: itertools.count(1))

    # Counters the bench and the chaos runner read.
    accepted: int = 0
    refused: int = 0

    def take_payment(self, merchant_id: str, amount_minor: int, pan: str) -> dict:
        """One payment. Either everything happened or nothing did."""
        payment_id = f"pay_{next(self._ids):08d}"

        try:
            card = self.vault.tokenise(pan, self.credential)
        except CredentialRevoked as exc:
            self.refused += 1
            # 503 rather than 500: this is a dependency refusing, it is not the
            # caller's fault, and a retry after somebody fixes the credential is
            # the right behaviour.
            return {"status": 503, "error": str(exc), "id": payment_id}

        fee = (amount_minor * FEE_BASIS_POINTS + 5_000) // 10_000

        try:
            # The ledger write and the outbox write are one unit. In Postgres
            # they are one transaction; here the outbox write follows a
            # successful post and nothing else can fail in between.
            self.ledger.post(
                payment_id,
                {
                    SETTLEMENT_ACCOUNT: amount_minor,
                    MERCHANT_ACCOUNT: -(amount_minor - fee),
                    FEE_ACCOUNT: -fee,
                },
            )
        except LedgerUnavailable as exc:
            self.refused += 1
            return {"status": 503, "error": str(exc), "id": payment_id}

        self.outbox.write(
            Event(
                event_id=f"evt_{payment_id}",
                kind="payment.captured",
                payment_id=payment_id,
                amount_minor=amount_minor - fee,
            )
        )

        self.payments[payment_id] = Payment(
            id=payment_id,
            merchant_id=merchant_id,
            amount_minor=amount_minor,
            fee_minor=fee,
            token=card["token"],
            status="captured",
            payout_reference=f"po_{payment_id}",
        )
        self.accepted += 1
        return {
            "status": 201,
            "id": payment_id,
            "token": card["token"],
            "amount_minor": amount_minor,
            "fee_minor": fee,
        }


@dataclass
class PayoutWorker:
    """Consumes captured payments and pays merchants.

    Level 12's saga, with the state machine reduced to what the capstone asserts:
    a payout ends paid, compensated, or unknown, and unknown is resolved by the
    sweeper rather than guessed at.
    """

    api: Api
    bank: Bank
    consumer: Consumer
    ledger: Ledger
    paid: int = 0
    unknown: int = 0
    compensated: int = 0

    # Work queues rather than scans. The first version of this re-read every
    # payout and every payment on each pass, so one run of the load test spent
    # O(n^2) in the worker and reported a p50 of 2.2 seconds at 1,000 payments a
    # second: the platform was not slow, the sweeper was quadratic. Level 19's
    # "filter once per group" mistake, in the capstone's own code.
    _pending: list[str] = field(default_factory=list)
    _unknown: set[str] = field(default_factory=set)

    def enqueue(self, payment_id: str) -> None:
        self._pending.append(payment_id)

    def run_once(self, limit: int = 1_000) -> int:
        """One pass over the queue. Returns how many payouts were attempted.

        The ledger check is at the top of the loop rather than inside `_attempt`
        alone, because `_attempt` puts the payout back when it cannot record it:
        without the break, the pass pops and re-queues the same payment a thousand
        times and reports a thousand attempts. That was a real spin, found by the
        test below it.
        """
        handled = 0
        while self._pending and handled < limit:
            if not self.ledger.available:
                break              # nothing can be recorded. Wait for the database
            payment_id = self._pending.pop()
            payment = self.api.payments.get(payment_id)
            if payment is None or payment.payout_state != "pending":
                continue
            amount = self.consumer.payouts.get(payment_id)
            if amount is None:
                continue
            if not self._attempt(payment, amount):
                break              # the ledger went away mid pass
            handled += 1
        return handled

    def _attempt(self, payment: Payment, amount: int) -> bool:
        """Submit one payout. The order of these four steps is the whole design.

        The first version called the bank and then posted to the ledger, and the
        chaos runner found what that costs: with the ledger unavailable the post
        raised, the exception escaped, and the payout stayed `pending` while the
        bank had already paid. One payout in four hundred, money out of the
        building with no record of it and nothing that would ever resolve it.
        Reconciliation found it the next morning, which is the good outcome of a
        bad design.

        So: refuse to call the bank at all when the record cannot be written, and
        if the record fails after the money has moved, the payout is **unknown**
        rather than pending, because unknown is the state the sweeper resolves.
        """
        if not self.ledger.available:
            # Nothing is attempted that cannot be recorded. The payout goes back
            # on the queue and waits for the database.
            self._pending.append(payment.id)
            return False

        payment.payout_state = "submitted"      # written before the external call
        try:
            payment.bank_reference = self.bank.pay(payment.payout_reference, amount)
        except BankTimeout:
            # Not failed. Unknown, which is a state rather than an error, and the
            # sweeper is what turns it into a final one.
            payment.payout_state = "unknown"
            self._unknown.add(payment.id)
            self.unknown += 1
            return True
        except BankRefused:
            payment.payout_state = "compensated"
            self.compensated += 1
            return True

        try:
            self._record_payout(payment, amount)
        except LedgerUnavailable:
            # The money moved and the ledger is gone. This is exactly the case
            # `unknown` exists for: the sweeper asks the bank what happened and
            # posts the entry once the database is back.
            payment.payout_state = "unknown"
            self._unknown.add(payment.id)
            self.unknown += 1
            return True
        self.paid += 1
        return True

    def _record_payout(self, payment: Payment, amount: int) -> None:
        """The money leaving, posted as its own balanced transaction.

        The payout is a second transaction rather than part of the capture,
        because it happens at a different time and can fail on its own. That
        separation is what lets the reconciliation in recon/ compare the ledger
        against the bank rather than against itself.
        """
        self.ledger.post(
            f"{payment.id}:payout",
            {MERCHANT_ACCOUNT: amount, BANK_CLEARING: -amount},
        )
        payment.payout_state = "paid"

    def sweep(self) -> dict:
        """Resolve every unknown payout by asking the bank what it did.

        This is the function that decides whether the capstone's reconciliation
        can return zero. Guessing here, in either direction, produces either a
        double payment or a merchant who was never paid.
        """
        resolved = {"paid": 0, "compensated": 0, "still_unknown": 0}
        for payment_id in list(self._unknown):
            payment = self.api.payments[payment_id]
            if payment.payout_state != "unknown":
                self._unknown.discard(payment_id)
                continue
            state = self.bank.status(payment.payout_reference)
            if state == "paid":
                payment.bank_reference = f"bank_resolved_{payment.id}"
                try:
                    self._record_payout(payment, self.consumer.payouts[payment.id])
                except LedgerUnavailable:
                    # Still unknown, and it stays on the list. The sweeper is
                    # idempotent, so the next pass will finish the job.
                    resolved["still_unknown"] += 1
                    continue
                self._unknown.discard(payment_id)
                self.paid += 1
                resolved["paid"] += 1
            elif state == "not_found":
                payment.payout_state = "compensated"
                self._unknown.discard(payment_id)
                self.compensated += 1
                resolved["compensated"] += 1
            else:
                resolved["still_unknown"] += 1
        self.unknown = len(self._unknown)
        return resolved
