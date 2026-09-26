"""The kth largest chargeback.

Pattern: heap, or quickselect
Time:    O(n log k) with a heap, O(n) expected with quickselect
Space:   O(k)
First instinct: sort and index, O(n log n), and it is a perfectly good answer to
  give first. The follow up question is always whether you can do better without
  sorting everything.
Outcome: solved directly.

Both are here because the comparison is the interesting part: quickselect is
faster in expectation and O(n^2) in the worst case, and the heap is predictable.
In production, predictable usually wins, and saying that is a better answer than
reciting the average case.
"""

import heapq
import random


def kth_largest_with_heap(amounts: list[int], k: int) -> int | None:
    if k <= 0 or k > len(amounts):
        return None
    keepers: list[int] = []
    for amount in amounts:
        if len(keepers) < k:
            heapq.heappush(keepers, amount)
        elif amount > keepers[0]:
            heapq.heapreplace(keepers, amount)
    return keepers[0]


def kth_largest_quickselect(amounts: list[int], k: int) -> int | None:
    """O(n) expected. The random pivot is not decoration: a fixed pivot on sorted
    input is the O(n^2) case, and payment amounts arrive sorted more often than
    anybody expects."""
    if k <= 0 or k > len(amounts):
        return None
    values = list(amounts)
    target = len(values) - k          # the index in ascending order

    low, high = 0, len(values) - 1
    while low < high:
        pivot = values[random.randint(low, high)]
        left, right = low, high
        while left <= right:
            while values[left] < pivot:
                left += 1
            while values[right] > pivot:
                right -= 1
            if left <= right:
                values[left], values[right] = values[right], values[left]
                left, right = left + 1, right - 1
        if target <= right:
            high = right
        elif target >= left:
            low = left
        else:
            break
    return values[target]


def test_both_versions_agree():
    amounts = [500, 12000, 300, 7000, 900]
    for k in range(1, 6):
        assert kth_largest_with_heap(amounts, k) == kth_largest_quickselect(amounts, k)


def test_the_largest_and_the_smallest():
    amounts = [1, 2, 3]
    assert kth_largest_with_heap(amounts, 1) == 3
    assert kth_largest_with_heap(amounts, 3) == 1


def test_k_out_of_range():
    assert kth_largest_with_heap([1], 2) is None
    assert kth_largest_quickselect([1], 0) is None
