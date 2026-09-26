"""Do two settlement files contain the same references, in any order?

Pattern: hash map
Time:    O(n + m)
Space:   O(n)
First instinct: sort both reference lists and compare, O(n log n). Fine, and
  counting is linear and also reports what differs, which is what an operator
  actually wants at 7am.
Outcome: solved directly.

The interview version of this is "are two strings anagrams". The payments version
is the useful one: the answer alone is not actionable, so this returns the
difference as well.
"""

from collections import Counter


def same_references(ours: list[dict], theirs: list[dict]) -> bool:
    return Counter(r["reference"] for r in ours) == Counter(r["reference"] for r in theirs)


def reference_difference(ours: list[dict], theirs: list[dict]) -> dict[str, list[str]]:
    """What is on each side and not the other, which is the reconciliation break.

    Counter subtraction drops zero and negative counts, so each direction has to
    be computed separately. Forgetting that is a real bug: `a - b` looks
    symmetric and is not.
    """
    mine = Counter(r["reference"] for r in ours)
    yours = Counter(r["reference"] for r in theirs)
    return {
        "missing_on_their_side": sorted((mine - yours).elements()),
        "missing_on_our_side": sorted((yours - mine).elements()),
    }


def test_same_references_in_a_different_order():
    ours = [{"reference": "A"}, {"reference": "B"}]
    theirs = [{"reference": "B"}, {"reference": "A"}]
    assert same_references(ours, theirs) is True


def test_a_duplicate_on_one_side_is_not_the_same():
    ours = [{"reference": "A"}, {"reference": "A"}]
    theirs = [{"reference": "A"}]
    assert same_references(ours, theirs) is False


def test_the_difference_is_reported_in_both_directions():
    ours = [{"reference": "A"}, {"reference": "B"}]
    theirs = [{"reference": "B"}, {"reference": "C"}]
    assert reference_difference(ours, theirs) == {
        "missing_on_their_side": ["A"],
        "missing_on_our_side": ["C"],
    }
