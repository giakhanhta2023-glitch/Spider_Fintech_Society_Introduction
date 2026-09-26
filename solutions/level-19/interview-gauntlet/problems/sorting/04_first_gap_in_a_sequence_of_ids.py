"""The first missing id in a sequence that should be contiguous.

Pattern: sorting, or a set
Time:    O(n log n) sorted, O(n) with a set
Space:   O(1) sorted in place, O(n) with a set
First instinct: sort and scan for a neighbour more than one away. Correct. The set
  version is linear and uses memory, which is the trade to name out loud.
Outcome: solved directly.

The domain reason: acquirers number their settlement batches sequentially, so a
gap means a file never arrived. Finding it the next morning instead of at the end
of the month is the difference between a question and an investigation.
"""

from itertools import pairwise


def first_gap_sorted(ids: list[int]) -> int | None:
    """O(n log n), O(1) extra space. Returns the first absent id."""
    if not ids:
        return None
    ordered = sorted(ids)
    for left, right in pairwise(ordered):
        if right > left + 1:
            return left + 1
    return None


def first_gap_with_a_set(ids: list[int]) -> int | None:
    """O(n) time, O(n) space. Faster, and it holds every id in memory."""
    if not ids:
        return None
    present = set(ids)
    for candidate in range(min(present), max(present)):
        if candidate not in present:
            return candidate
    return None


def test_finds_the_gap():
    assert first_gap_sorted([3, 1, 2, 5]) == 4
    assert first_gap_with_a_set([3, 1, 2, 5]) == 4


def test_no_gap():
    assert first_gap_sorted([1, 2, 3]) is None
    assert first_gap_with_a_set([1, 2, 3]) is None


def test_duplicates_are_not_gaps():
    assert first_gap_sorted([1, 1, 2, 2, 3]) is None


def test_empty():
    assert first_gap_sorted([]) is None
    assert first_gap_with_a_set([]) is None
