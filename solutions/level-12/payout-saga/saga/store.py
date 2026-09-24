"""Payouts, the ledger, and compensations that cannot run twice.

Two things here are load bearing.

**Every state change is committed before the next step starts.** The state in
the store is what lets any process, at any time, pick up where a dead one left
off. A state written after the external call loses exactly the cases you needed
to record.

**A compensation is idempotent by constraint, not by care.** `compensate()`
inserts into a table with a unique key on (payout_id, kind) and only posts the
ledger entries if that insert actually created a row. Running it three times
credits the merchant once, and that is enforced by the store rather than by the
caller remembering.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta

# States nothing follows. Everything else is work in progress, and the sweeper
# picks up everything that is not in here.
#
# "failed" is in this set on purpose, and it is the naive orchestrator's whole
# mistake. That code submits, gets a rejection, writes "failed" and walks away
# while the merchant is still debited. The payout is now final as far as the
# system is concerned, so nothing ever revisits it: not the sweeper, not a
# retry, not a person. The money is simply gone, and no query will ever say so.
#
# The saga version never reaches "failed": it compensates and ends at
# "compensated", which is final AND has the money back.
FINAL = frozenset({"paid", "compensated", "rejected", "failed"})


@dataclass
class Payout:
    id: int
    our_ref: str                 # generated once, at creation, before any attempt
    merchant_id: str
    amount_minor: int
    state: str = "requested"
    bank_ref: str | None = None
    debited: bool = False
    attempts: int = 0
    updated_at: datetime = field(default_factory=lambda: datetime.now(UTC))

    @property
    def is_final(self) -> bool:
        return self.state in FINAL

    @property
    def inconsistent(self) -> bool:
        """Money taken from the merchant with no payment to show for it.

        The one number this whole level is about.
        """
        return self.debited and self.state != "paid"


@dataclass
class Store:
    payouts: dict[int, Payout] = field(default_factory=dict)
    ledger: list[tuple[str, int, str]] = field(default_factory=list)
    # (payout_id, kind) -> already done. The unique constraint, in memory.
    compensations: set[tuple[int, str]] = field(default_factory=set)
    _next_id: int = 1
    _claimed: set[int] = field(default_factory=set)
    now: datetime = field(default_factory=lambda: datetime.now(UTC))

    # ------------------------------------------------------------- writing
    def create(self, merchant_id: str, amount_minor: int, our_ref: str) -> Payout:
        payout = Payout(
            id=self._next_id,
            our_ref=our_ref,
            merchant_id=merchant_id,
            amount_minor=amount_minor,
            updated_at=self.now,
        )
        self.payouts[payout.id] = payout
        self._next_id += 1
        return payout

    def set_state(self, payout: Payout, state: str, **fields) -> None:
        """One state change, committed. Nothing else happens until it is."""
        payout.state = state
        payout.updated_at = self.now
        for key, value in fields.items():
            setattr(payout, key, value)

    def debit(self, payout: Payout) -> None:
        """Take the money BEFORE submitting to the bank.

        Deliberately this way round. If the process dies here, the merchant's
        balance is temporarily short and the sweeper puts it back. The other
        order leaves a payment sent with nothing deducted, which is the same
        money leaving twice.
        """
        self.ledger.append((payout.merchant_id, -payout.amount_minor, f"payout {payout.id}"))
        payout.debited = True
        self.set_state(payout, "debited")

    def compensate(self, payout: Payout, kind: str = "refund_debit") -> bool:
        """Undo the debit. Safe to run any number of times.

        Returns True when it actually did something, which is what a caller
        needs to know to log honestly. The unique key is the mechanism: the
        second attempt inserts nothing and posts nothing.
        """
        key = (payout.id, kind)
        if key in self.compensations:
            return False
        self.compensations.add(key)
        self.ledger.append((payout.merchant_id, payout.amount_minor, f"compensate {payout.id}"))
        payout.debited = False
        self.set_state(payout, "compensated")
        return True

    # ------------------------------------------------------------- reading
    def balance(self, merchant_id: str) -> int:
        return sum(a for m, a, _ in self.ledger if m == merchant_id)

    def unfinished(self, older_than_seconds: int = 0) -> list[Payout]:
        cutoff = self.now - timedelta(seconds=older_than_seconds)
        return [
            p
            for p in self.payouts.values()
            if not p.is_final and p.updated_at <= cutoff
        ]

    def claim(self, worker: str, limit: int = 100, older_than_seconds: int = 0) -> list[Payout]:
        """`for update skip locked`, so several sweepers can run.

        A payout another sweeper holds is skipped rather than waited for. Two
        sweepers resolving the same payout is how a compensation and a
        completion race each other.
        """
        out = []
        for payout in self.unfinished(older_than_seconds):
            if len(out) >= limit:
                break
            if payout.id in self._claimed:
                continue
            self._claimed.add(payout.id)
            out.append(payout)
        return out

    def release(self, payouts: list[Payout]) -> None:
        for payout in payouts:
            self._claimed.discard(payout.id)

    def inconsistent(self) -> list[Payout]:
        return [p for p in self.payouts.values() if p.inconsistent]
