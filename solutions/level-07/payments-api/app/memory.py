"""An in-memory ledger, for the contract tests.

It enforces the same rules the database enforces, so a contract test that
passes here is testing the API rather than the storage. What it deliberately
does NOT do is behave like Postgres under concurrency, which is why the
concurrency work lives in level 8 against a real database instead of here.
"""

from __future__ import annotations

import itertools
from datetime import UTC, datetime, timedelta
from typing import Any

from .ports import (
    AccountMissing,
    InsufficientFunds,
    StoredEntry,
    StoredLeg,
    StoredTransfer,
)


class MemoryLedger:
    def __init__(self, accounts: dict[int, str] | None = None) -> None:
        # account id -> currency
        self.accounts = dict(accounts or {1: "USD", 2: "USD", 3: "USD", 4: "EUR"})
        self.balances: dict[int, int] = dict.fromkeys(self.accounts, 0)
        self.transfers: dict[int, StoredTransfer] = {}
        self._entries: list[StoredEntry] = []
        self._transfer_ids = itertools.count(1)
        self._entry_ids = itertools.count(1)
        self._clock = itertools.count()

    def _now(self) -> datetime:
        # A deterministic clock, one second apart, so pagination tests have a
        # stable order and do not depend on how fast the machine is.
        return datetime(2025, 1, 1, tzinfo=UTC) + timedelta(seconds=next(self._clock))

    def credit(self, account_id: int, amount_minor: int) -> None:
        """Test helper: put money somewhere without going through a transfer."""
        self.balances[account_id] = self.balances.get(account_id, 0) + amount_minor

    def create_transfer(
        self,
        currency: str,
        description: str,
        reference: str | None,
        legs: list[StoredLeg],
    ) -> StoredTransfer:
        for leg in legs:
            if leg.account_id not in self.accounts:
                raise AccountMissing(leg.account_id)

        # Checked before anything is written, so a failure leaves no trace.
        for leg in legs:
            if leg.amount_minor < 0:
                available = self.balances.get(leg.account_id, 0)
                if available + leg.amount_minor < 0:
                    raise InsufficientFunds(
                        leg.account_id, available, -leg.amount_minor
                    )

        created_at = self._now()
        transfer = StoredTransfer(
            id=next(self._transfer_ids),
            currency=currency,
            description=description,
            reference=reference,
            legs=tuple(legs),
            created_at=created_at,
        )
        self.transfers[transfer.id] = transfer
        for leg in legs:
            self.balances[leg.account_id] += leg.amount_minor
            self._entries.append(
                StoredEntry(
                    id=next(self._entry_ids),
                    transfer_id=transfer.id,
                    account_id=leg.account_id,
                    amount_minor=leg.amount_minor,
                    created_at=created_at,
                )
            )
        return transfer

    def get_transfer(self, transfer_id: int) -> StoredTransfer | None:
        return self.transfers.get(transfer_id)

    def balance(self, account_id: int) -> tuple[int, str, datetime]:
        if account_id not in self.accounts:
            raise AccountMissing(account_id)
        return self.balances[account_id], self.accounts[account_id], self._now()

    def entries(
        self,
        account_id: int,
        after: tuple[datetime, int] | None,
        limit: int,
    ) -> list[StoredEntry]:
        if account_id not in self.accounts:
            raise AccountMissing(account_id)
        rows = sorted(
            (e for e in self._entries if e.account_id == account_id),
            key=lambda e: (e.created_at, e.id),
        )
        if after is not None:
            rows = [e for e in rows if (e.created_at, e.id) > after]
        return rows[: limit + 1]  # the one extra row, same as the SQL version


class MemoryIdempotencyStore:
    def __init__(self) -> None:
        self._seen: dict[str, tuple[str, int, dict[str, Any]]] = {}

    def get(self, key: str) -> tuple[str, int, dict[str, Any]] | None:
        return self._seen.get(key)

    def put(self, key: str, fingerprint: str, status: int, body: dict[str, Any]) -> None:
        self._seen[key] = (fingerprint, status, body)
