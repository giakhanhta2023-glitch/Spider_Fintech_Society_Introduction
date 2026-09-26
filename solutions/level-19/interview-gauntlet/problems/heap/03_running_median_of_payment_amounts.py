"""The running median of payment amounts, updated per payment.

Pattern: heap, two of them
Time:    O(log n) per payment
Space:   O(n)
First instinct: keep a sorted list and insert into it, O(n) per insert because of
  the shifting. Then: the median only needs the middle, so hold the lower half in
  a max heap and the upper half in a min heap and keep them balanced.
Outcome: wrong first, fixed. My first version pushed to whichever heap was
  smaller, which puts values on the wrong side and reports a median that is not
  in the data. Compare against the value first, then rebalance.

Why the median rather than the mean: one $40,000 payment moves a mean and does
not move a median, which is the entire reason risk teams quote medians.
"""

import heapq


class RunningMedian:
    def __init__(self) -> None:
        self._lower: list[int] = []      # max heap, negated
        self._upper: list[int] = []      # min heap

    def add(self, amount: int) -> None:
        # Decide the side by value, never by size. Size is what the rebalance is
        # for, and swapping the two steps is the bug in the note above.
        if not self._lower or amount <= -self._lower[0]:
            heapq.heappush(self._lower, -amount)
        else:
            heapq.heappush(self._upper, amount)

        if len(self._lower) > len(self._upper) + 1:
            heapq.heappush(self._upper, -heapq.heappop(self._lower))
        elif len(self._upper) > len(self._lower):
            heapq.heappush(self._lower, -heapq.heappop(self._upper))

    @property
    def median(self) -> float | None:
        if not self._lower:
            return None
        if len(self._lower) > len(self._upper):
            return float(-self._lower[0])
        return (-self._lower[0] + self._upper[0]) / 2


def running_medians(amounts: list[int]) -> list[float]:
    tracker = RunningMedian()
    out = []
    for amount in amounts:
        tracker.add(amount)
        out.append(tracker.median)
    return out


def test_odd_and_even_counts():
    assert running_medians([5, 15, 1, 3]) == [5.0, 10.0, 5.0, 4.0]


def test_one_huge_payment_barely_moves_the_median():
    amounts = [100] * 9 + [4_000_000]
    assert running_medians(amounts)[-1] == 100.0


def test_no_payments_yet():
    assert RunningMedian().median is None
