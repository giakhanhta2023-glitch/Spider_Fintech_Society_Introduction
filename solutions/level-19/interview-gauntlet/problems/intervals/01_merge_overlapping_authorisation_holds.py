"""Merge overlapping authorisation holds on one card.

Pattern: intervals, sort then sweep
Time:    O(n log n)
Space:   O(n)
First instinct: compare every pair, O(n^2). Sorting by start is what makes one
  pass sufficient, because once sorted, an interval can only overlap the one
  currently being built.
Outcome: solved directly.

The touching case is the decision to make explicitly: a hold ending at 100 and one
starting at 100 either merge or do not. Here they merge, because for available
credit two back to back holds are one continuous period of reduced credit, and the
test says so.
"""


def merge_holds(holds: list[tuple[int, int]]) -> list[tuple[int, int]]:
    if not holds:
        return []
    merged: list[tuple[int, int]] = []
    for start, end in sorted(holds):
        if merged and start <= merged[-1][1]:
            # <= rather than <, so touching intervals merge.
            merged[-1] = (merged[-1][0], max(merged[-1][1], end))
        else:
            merged.append((start, end))
    return merged


def test_overlapping_holds_merge():
    assert merge_holds([(0, 50), (40, 90), (200, 250)]) == [(0, 90), (200, 250)]


def test_touching_holds_merge():
    assert merge_holds([(0, 100), (100, 150)]) == [(0, 150)]


def test_a_hold_contained_in_another():
    assert merge_holds([(0, 100), (20, 30)]) == [(0, 100)]


def test_unsorted_input():
    assert merge_holds([(200, 250), (0, 50)]) == [(0, 50), (200, 250)]


def test_no_holds():
    assert merge_holds([]) == []
