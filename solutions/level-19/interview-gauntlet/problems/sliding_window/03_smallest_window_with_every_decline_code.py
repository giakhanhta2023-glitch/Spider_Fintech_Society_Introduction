"""The shortest run of payments containing at least one of every decline code.

Pattern: sliding window with counts
Time:    O(n)
Space:   O(k) for k codes
First instinct: every start, extend until complete, O(n^2). The window version
  shrinks from the left whenever the window is already complete, which is the
  move that makes it linear.
Outcome: solved directly, with a wrong test. My first test asserted (2, 5) and the
  function returned (1, 4). Both are length three, and the function returns the
  earliest of equally short windows because it only replaces the best on a
  strictly smaller length. The code was right and my expectation was not, which
  is worth recording because it is the more common version of this mistake: an
  under specified question answered two defensible ways.

The operational question behind it: how close together did every failure mode
happen, which is the difference between one incident and five coincidences.
"""

from collections import Counter


def smallest_window_with_all_codes(payments: list[dict]) -> tuple[int, int] | None:
    """The half open range [start, end) of the shortest complete window."""
    needed = {p["decline_code"] for p in payments if p.get("decline_code")}
    if not needed:
        return None

    counts: Counter[str] = Counter()
    best: tuple[int, int] | None = None
    left = 0

    for right, payment in enumerate(payments):
        code = payment.get("decline_code")
        if code:
            counts[code] += 1

        while len(counts) == len(needed):
            # Record before shrinking. Shrinking first reports a window that is
            # one element too small, which was my first version.
            if best is None or (right + 1 - left) < (best[1] - best[0]):
                best = (left, right + 1)
            leaving = payments[left].get("decline_code")
            if leaving:
                counts[leaving] -= 1
                if counts[leaving] == 0:
                    del counts[leaving]
            left += 1

    return best


def test_finds_the_smallest_complete_window():
    codes = ["a", "b", "a", "c", "b", "c"]
    payments = [{"decline_code": c} for c in codes]
    # (1, 4) is ["b", "a", "c"] and (2, 5) is ["a", "c", "b"]. Both are length
    # three, and the earliest is returned, which is a decision the docstring
    # states rather than an accident.
    assert smallest_window_with_all_codes(payments) == (1, 4)


def test_ties_are_broken_by_the_earliest_window():
    codes = ["a", "b", "c", "a", "b", "c"]
    payments = [{"decline_code": c} for c in codes]
    assert smallest_window_with_all_codes(payments) == (0, 3)


def test_one_code_only():
    payments = [{"decline_code": "a"}, {"decline_code": "a"}]
    assert smallest_window_with_all_codes(payments) == (0, 1)


def test_no_declines():
    assert smallest_window_with_all_codes([{"decline_code": None}]) is None
