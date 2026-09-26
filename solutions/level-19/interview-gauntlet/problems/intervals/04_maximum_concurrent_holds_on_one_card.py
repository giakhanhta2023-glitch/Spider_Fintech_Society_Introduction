"""The most holds active at the same moment on one card.

Pattern: intervals, the sweep line
Time:    O(n log n)
Space:   O(n)
First instinct: for every hold, count how many others overlap it, O(n^2). The
  sweep is the standard answer: sort the starts and the ends separately and walk
  both, adding one at a start and subtracting one at an end.
Outcome: wrong first, fixed. My first sweep processed a start before an end at the
  same instant, so a hold ending exactly as another began counted as two. The
  third test is the one that failed.

This is the number a card issuer limits, and the reason a card with available
credit can still refuse a payment.
"""


def max_concurrent(holds: list[tuple[int, int]]) -> int:
    starts = sorted(start for start, _ in holds)
    ends = sorted(end for _, end in holds)

    best = active = 0
    i = j = 0
    while i < len(starts):
        # Ends are processed first on a tie, so a hold ending at the moment
        # another begins does not count as concurrent.
        if starts[i] < ends[j]:
            active += 1
            best = max(best, active)
            i += 1
        else:
            active -= 1
            j += 1
    return best


def test_three_overlapping_holds():
    assert max_concurrent([(0, 100), (50, 150), (60, 70)]) == 3


def test_holds_that_do_not_overlap():
    assert max_concurrent([(0, 10), (20, 30), (40, 50)]) == 1


def test_a_hold_ending_as_another_begins_is_not_concurrent():
    assert max_concurrent([(0, 100), (100, 200)]) == 1


def test_no_holds():
    assert max_concurrent([]) == 0
