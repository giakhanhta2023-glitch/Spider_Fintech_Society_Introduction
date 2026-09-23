"""What the API needs from storage, stated as two small protocols.

The reason for the seam is testability with a straight face. The HTTP contract
(status codes, idempotency, validation, pagination, the error shape) is about
HTTP, and testing it should not require a database. The rules that are really
about the database (a transaction balancing, a race between two captures) are
level 6 and level 8, and those are tested against a real Postgres where they
mean something.

So: an in-memory implementation for the contract tests, and a psycopg one for
production and the integration tests. Both satisfy the same protocol, and the
protocol is written down here rather than being whatever the Postgres class
happens to do.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Protocol


@dataclass(frozen=True, slots=True)
class StoredLeg:
    account_id: int
    amount_minor: int


@dataclass(frozen=True, slots=True)
class StoredTransfer:
    id: int
    currency: str
    description: str
    reference: str | None
    legs: tuple[StoredLeg, ...]
    created_at: datetime


@dataclass(frozen=True, slots=True)
class StoredEntry:
    id: int
    transfer_id: int
    account_id: int
    amount_minor: int
    created_at: datetime


class AccountMissing(Exception):
    def __init__(self, account_id: int) -> None:
        super().__init__(f"no account {account_id}")
        self.account_id = account_id


class InsufficientFunds(Exception):
    def __init__(self, account_id: int, available: int, requested: int) -> None:
        super().__init__(f"account {account_id} holds {available}, needs {requested}")
        self.account_id = account_id
        self.available = available
        self.requested = requested


class Ledger(Protocol):
    """Everything the API does to money."""

    def create_transfer(
        self,
        currency: str,
        description: str,
        reference: str | None,
        legs: list[StoredLeg],
    ) -> StoredTransfer:
        """Write one balanced transfer atomically.

        Raises AccountMissing or InsufficientFunds, and writes nothing when it
        does. That "writes nothing" is the part a test has to assert.
        """

    def get_transfer(self, transfer_id: int) -> StoredTransfer | None: ...

    def balance(self, account_id: int) -> tuple[int, str, datetime]:
        """Returns (minor units, currency, as of). Raises AccountMissing."""

    def entries(
        self,
        account_id: int,
        after: tuple[datetime, int] | None,
        limit: int,
    ) -> list[StoredEntry]:
        """One page, plus one extra row so the caller can tell if more exist.

        The extra row is the whole trick: asking for limit + 1 and discarding
        the last one answers "is there another page" without a count(*) over
        the table.
        """


class IdempotencyStore(Protocol):
    """Remembers what a key did, so a retry can be answered rather than redone."""

    def get(self, key: str) -> tuple[str, int, dict[str, Any]] | None:
        """Returns (request fingerprint, status, response body) or None."""

    def put(
        self, key: str, fingerprint: str, status: int, body: dict[str, Any]
    ) -> None: ...
