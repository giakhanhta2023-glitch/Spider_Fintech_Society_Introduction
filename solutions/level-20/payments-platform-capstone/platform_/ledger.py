"""The ledger: double entry, append only, and the invariant nothing may bypass.

Level 4, reduced to what the capstone needs and with nothing softened. Every
transaction sums to zero or it is not written, and the only way to write is
`post()`, so the rule cannot be avoided by a caller in a hurry.

The capstone's reconciliation depends on this being true rather than mostly true:
if the ledger can hold an unbalanced transaction, "zero breaks" means only that
nobody looked.
"""

from __future__ import annotations

import threading
from dataclasses import dataclass, field


class Unbalanced(Exception):
    """A transaction that does not sum to zero. Never written."""


class LedgerUnavailable(Exception):
    """The database is gone. Chaos scenario one, and the API must not pretend
    otherwise: a payment that cannot be recorded has not happened."""


@dataclass(frozen=True, slots=True)
class Entry:
    transaction_id: str
    account: str
    amount_minor: int
    reference: str


@dataclass
class Ledger:
    entries: list[Entry] = field(default_factory=list)
    available: bool = True
    _lock: threading.Lock = field(default_factory=threading.Lock)
    _sequence: int = 0

    # ------------------------------------------------------------- writing
    def post(self, reference: str, movements: dict[str, int]) -> str:
        """One balanced transaction. Returns its id.

        The check happens before anything is appended, so a refused transaction
        leaves the ledger byte for byte as it was. A half written transaction is
        worse than a rejected one, and it is the thing reconciliation cannot
        untangle afterwards.
        """
        if not self.available:
            raise LedgerUnavailable("the ledger database is not reachable")

        total = sum(movements.values())
        if total != 0:
            raise Unbalanced(
                f"{reference} sums to {total} rather than zero: {movements}"
            )

        with self._lock:
            self._sequence += 1
            transaction_id = f"txn_{self._sequence:08d}"
            for account, amount in movements.items():
                self.entries.append(
                    Entry(transaction_id, account, amount, reference)
                )
        return transaction_id

    # ------------------------------------------------------------- reading
    def balance(self, account: str) -> int:
        return sum(e.amount_minor for e in self.entries if e.account == account)

    def total(self) -> int:
        """Every entry in the ledger, summed. Always zero, by construction."""
        return sum(e.amount_minor for e in self.entries)

    def transactions(self) -> int:
        return len({e.transaction_id for e in self.entries})

    def references(self) -> set[str]:
        return {e.reference for e in self.entries}

    def by_reference(self, reference: str) -> list[Entry]:
        return [e for e in self.entries if e.reference == reference]

    # --------------------------------------------------------------- chaos
    def stop(self) -> None:
        """Lose the database. Used by the chaos runner, and by nothing else."""
        self.available = False

    def start(self) -> None:
        self.available = True
