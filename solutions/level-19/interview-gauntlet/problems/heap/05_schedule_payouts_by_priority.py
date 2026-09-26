"""Release payouts in priority order, with a deterministic tie break.

Pattern: heap as a priority queue
Time:    O(n log n) overall, O(log n) per operation
Space:   O(n)
First instinct: sort the list of pending payouts. That works for a batch and not
  for a queue, because new payouts arrive while the old ones are being released.
Outcome: solved directly.

The sequence number is the important detail. Without it, two payouts of the same
priority compare by their next tuple element, and if that is a dict it raises. It
also makes the order stable, which for money is not a nicety: a merchant asking
"why was theirs paid before mine" needs an answer that is the same every time.
"""

import heapq
from itertools import count


class PayoutQueue:
    def __init__(self) -> None:
        self._heap: list[tuple[int, int, dict]] = []
        self._sequence = count()

    def add(self, payout: dict, priority: int) -> None:
        """Lower priority number is released first."""
        heapq.heappush(self._heap, (priority, next(self._sequence), payout))

    def release(self) -> dict | None:
        if not self._heap:
            return None
        return heapq.heappop(self._heap)[2]

    def __len__(self) -> int:
        return len(self._heap)


def release_order(payouts: list[tuple[dict, int]]) -> list[str]:
    queue = PayoutQueue()
    for payout, priority in payouts:
        queue.add(payout, priority)
    order = []
    while len(queue):
        released = queue.release()
        assert released is not None
        order.append(released["id"])
    return order


def test_priority_order():
    payouts = [({"id": "P1"}, 5), ({"id": "P2"}, 1), ({"id": "P3"}, 3)]
    assert release_order(payouts) == ["P2", "P3", "P1"]


def test_ties_keep_arrival_order():
    payouts = [({"id": "P1"}, 1), ({"id": "P2"}, 1), ({"id": "P3"}, 1)]
    assert release_order(payouts) == ["P1", "P2", "P3"]


def test_an_empty_queue_releases_nothing():
    assert PayoutQueue().release() is None


def test_adding_while_releasing():
    queue = PayoutQueue()
    queue.add({"id": "P1"}, 5)
    assert queue.release() == {"id": "P1"}
    queue.add({"id": "P2"}, 9)
    queue.add({"id": "P3"}, 2)
    assert queue.release() == {"id": "P3"}
