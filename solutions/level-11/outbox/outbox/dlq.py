"""Retries, dead letters, and replay.

The rule that shapes this file: **a poison event must not block the
partition.** A consumer that retries forever on one bad message stops
delivering every message behind it, and in a partitioned log that is a quarter
of your traffic stopped by one row. So: retry a few times with growing delays,
then move it aside, record enough to fix it, and carry on.

What "enough to fix it" means, concretely: the payload, the error, and the
offset. The payload so it can be replayed, the error so somebody knows what
broke, and the offset so you can find its neighbours when the cause turns out
to be the message before it.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field

from .core import Event


@dataclass(frozen=True, slots=True)
class DeadLetter:
    event: Event
    partition: int
    offset: int
    attempts: int
    error: str


@dataclass
class RetryingConsumer:
    """Wraps a handler with retries and a dead letter table."""

    handle: Callable[[Event], None]
    max_attempts: int = 3
    # Growing delays. Recorded rather than slept, so tests stay fast and the
    # schedule is still visible and assertable.
    delays_ms: tuple[int, ...] = (100, 500, 2_000)

    dead_letters: list[DeadLetter] = field(default_factory=list)
    delivered: int = 0
    retried: int = 0

    def consume(self, events: list[Event], partition: int = 0, start: int = 0) -> int:
        """Consume a partition in order. Returns the offset reached.

        The offset advances past a dead lettered event on purpose. That is the
        decision this class exists to make: the alternative is stopping, and
        stopping means everything behind it stops too.
        """
        offset = start
        for i, event in enumerate(events, start=start):
            for attempt in range(1, self.max_attempts + 1):
                try:
                    self.handle(event)
                    self.delivered += 1
                    break
                except Exception as exc:  # noqa: BLE001 - the handler owns its errors
                    if attempt < self.max_attempts:
                        self.retried += 1
                        continue
                    self.dead_letters.append(
                        DeadLetter(
                            event=event,
                            partition=partition,
                            offset=i,
                            attempts=attempt,
                            error=f"{type(exc).__name__}: {exc}",
                        )
                    )
            offset = i + 1
        return offset

    def replay_dead_letters(self) -> dict[str, int]:
        """After the bug is fixed. Replays through the same handler, so an
        idempotent consumer cannot double count and a non-idempotent one will
        show you immediately that it is not safe to replay."""
        still_dead: list[DeadLetter] = []
        replayed = 0
        for letter in self.dead_letters:
            try:
                self.handle(letter.event)
                replayed += 1
            except Exception as exc:  # noqa: BLE001
                still_dead.append(
                    DeadLetter(
                        letter.event, letter.partition, letter.offset,
                        letter.attempts + 1, f"{type(exc).__name__}: {exc}",
                    )
                )
        self.dead_letters = still_dead
        return {"replayed": replayed, "still_dead": len(still_dead)}
