"""A small double entry ledger, so the money side can be asserted.

The same rules as level 6, in memory: every transaction's entries sum to zero,
entries are append only, and a balance is the sum of entries rather than a
number somebody set.

The accounts a card processor actually needs, and what each one means:

    card_receivable   money the network owes us for captured payments
    merchant_payable  money we owe the merchant
    fees_income       what we keep
    dispute_expense   what a chargeback costs us
"""

from __future__ import annotations

from dataclasses import dataclass, field


class Unbalanced(Exception):
    """A transaction whose entries do not sum to zero. Never written."""


@dataclass(frozen=True, slots=True)
class Entry:
    account: str
    amount_minor: int
    transaction_id: int
    reason: str


@dataclass
class Ledger:
    entries: list[Entry] = field(default_factory=list)
    _next_id: int = 1

    def post(self, reason: str, movements: dict[str, int]) -> int:
        """Write one balanced transaction, or write nothing.

        The check is before the append rather than after, so a failure leaves
        no partial transaction behind. Level 6 does the same thing with a
        deferred constraint trigger; this is the in-memory version of the same
        promise.
        """
        total = sum(movements.values())
        if total != 0:
            raise Unbalanced(f"{reason}: entries sum to {total}, not 0")
        if any(amount == 0 for amount in movements.values()):
            raise Unbalanced(f"{reason}: an entry of zero moves nothing")

        transaction_id = self._next_id
        self._next_id += 1
        for account, amount in movements.items():
            self.entries.append(Entry(account, amount, transaction_id, reason))
        return transaction_id

    def balance(self, account: str) -> int:
        return sum(e.amount_minor for e in self.entries if e.account == account)

    def total(self) -> int:
        """Always zero. The single check worth running after anything."""
        return sum(e.amount_minor for e in self.entries)

    def transactions(self) -> int:
        return self._next_id - 1
