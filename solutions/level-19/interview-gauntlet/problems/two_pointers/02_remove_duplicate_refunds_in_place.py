"""Collapse consecutive duplicate refunds in a sorted list, in place.

Pattern: two pointers
Time:    O(n)
Space:   O(1)
First instinct: build a new list with a set of seen references. That is correct
  and O(n) space, and the question asked for in place, which is the whole point
  of the slow and fast pointer pair.
Outcome: solved directly.

In place matters when the list is large enough that a second copy is the problem,
which in payments means a settlement file loaded into memory once.
"""


def remove_duplicate_refunds(refunds: list[str]) -> int:
    """Rewrites the front of the list and returns how many survived.

    The convention is the interview one: the caller uses `refunds[:kept]`. The
    tail is left as whatever it was, which is why returning the count matters.
    """
    if not refunds:
        return 0
    slow = 0
    for fast in range(1, len(refunds)):
        if refunds[fast] != refunds[slow]:
            slow += 1
            refunds[slow] = refunds[fast]
    return slow + 1


def test_collapses_consecutive_duplicates():
    refunds = ["R1", "R1", "R2", "R3", "R3", "R3"]
    kept = remove_duplicate_refunds(refunds)
    assert refunds[:kept] == ["R1", "R2", "R3"]


def test_no_duplicates_keeps_everything():
    refunds = ["R1", "R2"]
    assert remove_duplicate_refunds(refunds) == 2
    assert refunds == ["R1", "R2"]


def test_empty_and_single():
    assert remove_duplicate_refunds([]) == 0
    assert remove_duplicate_refunds(["R1"]) == 1
