"""The two payment amounts closest together.

Pattern: two pointers, after a sort
Time:    O(n log n), dominated by the sort
Space:   O(n) for the sorted copy
First instinct: compare every pair, O(n^2). Then: the closest pair in one
  dimension must be adjacent once sorted, which turns it into one pass.
Outcome: solved directly.

The sort is the cost and it cannot be removed here: the claim "adjacent when
sorted" is what makes one pass sufficient, so the order is load bearing. Saying
that out loud is the difference between guessing and knowing.
"""

from itertools import pairwise


def nearest_pair(amounts: list[int]) -> tuple[int, int] | None:
    if len(amounts) < 2:
        return None
    ordered = sorted(amounts)
    best = (ordered[0], ordered[1])
    smallest = ordered[1] - ordered[0]
    for left, right in pairwise(ordered):
        if right - left < smallest:
            smallest, best = right - left, (left, right)
    return best


def test_finds_the_closest_pair():
    assert nearest_pair([1000, 5000, 1050, 9000]) == (1000, 1050)


def test_duplicates_are_distance_zero():
    assert nearest_pair([700, 2000, 700]) == (700, 700)


def test_fewer_than_two_amounts():
    assert nearest_pair([100]) is None
    assert nearest_pair([]) is None
