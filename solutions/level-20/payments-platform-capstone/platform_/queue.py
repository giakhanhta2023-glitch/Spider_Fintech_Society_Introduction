"""The outbox and its consumer.

Levels 11 and 12, reduced. The event is written in the same transaction as the
business row, so a crash cannot lose it, and the consumer deduplicates on the
event id, so a redelivery cannot double count.

The capstone uses this for chaos scenario three: stop the publisher for ten
minutes and prove that nothing is lost and the consumer catches up.
"""

from __future__ import annotations

import threading
from dataclasses import dataclass, field


@dataclass(frozen=True, slots=True)
class Event:
    event_id: str
    kind: str
    payment_id: str
    amount_minor: int


@dataclass
class Outbox:
    """Rows written with the payment, drained by the publisher."""

    pending: list[Event] = field(default_factory=list)
    published: list[Event] = field(default_factory=list)
    _lock: threading.Lock = field(default_factory=threading.Lock)

    def write(self, event: Event) -> None:
        with self._lock:
            self.pending.append(event)

    def drain(self, limit: int = 100) -> list[Event]:
        with self._lock:
            batch = self.pending[:limit]
            self.pending = self.pending[limit:]
            self.published.extend(batch)
        return batch

    @property
    def backlog(self) -> int:
        return len(self.pending)


@dataclass
class Consumer:
    """Idempotent by construction: the event id is the deduplication key."""

    seen: set[str] = field(default_factory=set)
    payouts: dict[str, int] = field(default_factory=dict)
    duplicates_refused: int = 0
    # What arrived since the last time anybody asked. The worker reads this
    # instead of scanning every payout it has ever seen.
    _new: list[str] = field(default_factory=list)

    def handle(self, event: Event) -> bool:
        if event.event_id in self.seen:
            self.duplicates_refused += 1
            return False
        self.seen.add(event.event_id)
        if event.kind == "payment.captured":
            self.payouts[event.payment_id] = event.amount_minor
            self._new.append(event.payment_id)
        return True

    def take_new(self) -> list[str]:
        new, self._new = self._new, []
        return new


@dataclass
class Publisher:
    """Moves events from the outbox to the consumer. Can be stopped."""

    outbox: Outbox
    consumer: Consumer
    running: bool = True
    rounds: int = 0
    delivered: int = 0

    def tick(self, limit: int = 100) -> int:
        if not self.running:
            return 0
        batch = self.outbox.drain(limit)
        self.rounds += 1
        for event in batch:
            if self.consumer.handle(event):
                self.delivered += 1
        return len(batch)

    def drain_fully(self, limit: int = 100) -> int:
        moved = 0
        while self.outbox.backlog:
            moved += self.tick(limit)
        return moved

    # --------------------------------------------------------------- chaos
    def stop(self) -> None:
        self.running = False

    def start(self) -> None:
        self.running = True
