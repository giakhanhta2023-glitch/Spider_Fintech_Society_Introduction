"""The outbox, the publisher, and the consumers, over a store you can swap.

The level says every pattern here is yours to implement rather than the
broker's, and that is what this file is. A broker gives you delivery. It does
not give you: writing the event in the same transaction as the business change,
claiming rows without two publishers colliding, deduplicating on the consumer
side, or choosing a partition key. All four are yours, and all four are here.

The store is a protocol with an in-memory implementation that models
transactions honestly (a rollback discards everything, including the outbox
row) and a Postgres one carrying the real SQL. The patterns are identical; only
the storage differs.
"""

from __future__ import annotations

import random
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any, Protocol


class Crash(Exception):
    """An injected failure. Raised where a process would really die."""


@dataclass(frozen=True, slots=True)
class Event:
    aggregate_id: str          # the payment. Also the partition key
    event_type: str
    payload: dict[str, Any]
    event_id: str = ""         # unique, so a consumer can deduplicate


@dataclass
class OutboxRow:
    id: int
    event: Event
    published: bool = False
    attempts: int = 0


# --------------------------------------------------------------- the store
class Store(Protocol):
    def begin(self) -> None: ...
    def commit(self) -> None: ...
    def rollback(self) -> None: ...
    def write_business_row(self, key: str, value: Any) -> None: ...
    def write_outbox(self, event: Event) -> None: ...
    def claim(self, limit: int, worker: str) -> list[OutboxRow]: ...
    def mark_published(self, ids: list[int]) -> None: ...
    def release(self, ids: list[int]) -> None: ...


class MemoryStore:
    """Transactions modelled properly, because the whole point is what happens
    when one rolls back."""

    def __init__(self) -> None:
        self.business: dict[str, Any] = {}
        self.outbox: list[OutboxRow] = []
        self._next_id = 1
        self._pending_business: dict[str, Any] = {}
        self._pending_outbox: list[Event] = []
        self._in_transaction = False
        self._claimed: dict[int, str] = {}

    # ------------------------------------------------------ transactions
    def begin(self) -> None:
        self._in_transaction = True
        self._pending_business = {}
        self._pending_outbox = []

    def commit(self) -> None:
        self.business.update(self._pending_business)
        for event in self._pending_outbox:
            self.outbox.append(OutboxRow(id=self._next_id, event=event))
            self._next_id += 1
        self._in_transaction = False
        self._pending_business = {}
        self._pending_outbox = []

    def rollback(self) -> None:
        # Both halves go, which is the entire property the outbox buys you.
        self._in_transaction = False
        self._pending_business = {}
        self._pending_outbox = []

    def write_business_row(self, key: str, value: Any) -> None:
        target = self._pending_business if self._in_transaction else self.business
        target[key] = value

    def write_outbox(self, event: Event) -> None:
        if self._in_transaction:
            self._pending_outbox.append(event)
        else:
            self.outbox.append(OutboxRow(id=self._next_id, event=event))
            self._next_id += 1

    # ---------------------------------------------------------- claiming
    def claim(self, limit: int, worker: str) -> list[OutboxRow]:
        """`for update skip locked`, in memory.

        A row already claimed by another worker is skipped rather than waited
        for, which is what lets two publishers run without either colliding or
        blocking.
        """
        out = []
        for row in self.outbox:
            if len(out) >= limit:
                break
            if row.published or row.id in self._claimed:
                continue
            self._claimed[row.id] = worker
            out.append(row)
        return out

    def mark_published(self, ids: list[int]) -> None:
        for row in self.outbox:
            if row.id in ids:
                row.published = True
                self._claimed.pop(row.id, None)

    def release(self, ids: list[int]) -> None:
        for row_id in ids:
            self._claimed.pop(row_id, None)

    def unpublished(self) -> list[OutboxRow]:
        return [r for r in self.outbox if not r.published]


# ----------------------------------------------------------------- the log
@dataclass
class Log:
    """A partitioned append only log. Order holds within a partition, never
    across them, which is the property the whole partitioning experiment is
    about."""

    partitions: int = 4
    _data: dict[int, list[Event]] = field(default_factory=lambda: defaultdict(list))

    def append(self, event: Event, partition_key: str | None = None) -> int:
        key = partition_key if partition_key is not None else event.aggregate_id
        partition = self._partition_for(key)
        self._data[partition].append(event)
        return partition

    def _partition_for(self, key: str) -> int:
        # Deterministic across runs and processes, unlike hash(), which is
        # randomised per interpreter and would make partitioning
        # non-reproducible between a producer and a consumer.
        return sum(key.encode()) % self.partitions

    def read(self, partition: int, offset: int = 0) -> list[Event]:
        return self._data[partition][offset:]

    def total(self) -> int:
        return sum(len(v) for v in self._data.values())


# ------------------------------------------------------------- publishing
@dataclass
class Publisher:
    store: MemoryStore
    log: Log
    batch_size: int = 500
    crash_between_send_and_mark: float = 0.0
    worker: str = "publisher-1"
    _rng: random.Random = field(default_factory=lambda: random.Random(11))

    def run_once(self) -> dict[str, int]:
        """Claim, send, mark. In that order, and the order is the design.

        Sending before marking means a crash in between produces a duplicate.
        Marking before sending means the same crash produces a loss. Between a
        message delivered twice and a message never delivered, at-least-once is
        the one you can fix on the consumer side, so the order is deliberate.
        """
        rows = self.store.claim(self.batch_size, self.worker)
        if not rows:
            return {"claimed": 0, "sent": 0, "marked": 0}

        sent = 0
        for row in rows:
            self.log.append(row.event)
            sent += 1

        if self._rng.random() < self.crash_between_send_and_mark:
            self.store.release([r.id for r in rows])
            raise Crash(f"died after sending {sent}, before marking them")

        self.store.mark_published([r.id for r in rows])
        return {"claimed": len(rows), "sent": sent, "marked": len(rows)}

    def drain(self, max_rounds: int = 10_000) -> dict[str, int]:
        totals = {"claimed": 0, "sent": 0, "marked": 0, "crashes": 0}
        for _ in range(max_rounds):
            try:
                result = self.run_once()
            except Crash:
                totals["crashes"] += 1
                continue
            if result["claimed"] == 0:
                break
            for k, v in result.items():
                totals[k] += v
        return totals


# -------------------------------------------------------------- consuming
@dataclass
class MerchantTotals:
    """The projection: what each merchant is owed, built only from events."""

    totals: dict[str, int] = field(default_factory=dict)

    def snapshot(self) -> dict[str, int]:
        return dict(sorted(self.totals.items()))


@dataclass
class IdempotentConsumer:
    """Deduplicates with a processed-event table.

    The right shape when the handler has a side effect that is not naturally
    repeatable: incrementing a counter, sending an email, calling a bank.
    """

    projection: MerchantTotals = field(default_factory=MerchantTotals)
    processed: set[str] = field(default_factory=set)
    applied: int = 0
    skipped: int = 0

    def handle(self, event: Event) -> None:
        if event.event_id in self.processed:
            self.skipped += 1
            return
        self.processed.add(event.event_id)
        merchant = event.payload["merchant_id"]
        self.projection.totals[merchant] = (
            self.projection.totals.get(merchant, 0) + event.payload["amount_minor"]
        )
        self.applied += 1


@dataclass
class UpsertConsumer:
    """Naturally idempotent: it sets rather than increments.

    No processed-event table, no state to keep, and replaying the same event a
    hundred times leaves the same answer. Where the work can be expressed this
    way, it is strictly better, because there is nothing to get wrong.
    """

    latest: dict[str, dict[str, Any]] = field(default_factory=dict)

    def handle(self, event: Event) -> None:
        self.latest[event.aggregate_id] = {
            "state": event.event_type,
            "amount_minor": event.payload["amount_minor"],
        }

    def snapshot(self) -> dict[str, dict[str, Any]]:
        return {k: dict(v) for k, v in sorted(self.latest.items())}
