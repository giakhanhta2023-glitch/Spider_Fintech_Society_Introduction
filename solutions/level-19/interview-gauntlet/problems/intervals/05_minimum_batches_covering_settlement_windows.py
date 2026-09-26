"""The fewest batch runs that cover every settlement window.

Pattern: intervals, greedy
Time:    O(n log n)
Space:   O(1) beyond the sort
First instinct: one run per window, which is correct and needlessly expensive. The
  greedy answer is the classic "minimum number of arrows" problem: sort by end,
  take the earliest end, and skip everything it already covers.
Outcome: solved directly.

The proof is the part an interviewer wants: choosing the earliest end is never
worse, because any batch that covers the window ending soonest must run at or
before that end, and running exactly at it covers the most.
"""


def minimum_batches(windows: list[tuple[int, int]]) -> list[int]:
    """The times to run a batch so that every window contains one.

    One sort, one pass. The first version of this re-derived the start inside the
    loop with a second sort, which was O(n^2 log n) while the docstring claimed
    O(n log n): the kind of gap between the stated complexity and the code that a
    reviewer notices immediately.
    """
    times: list[int] = []
    last: int | None = None
    for start, end in sorted(windows, key=lambda window: window[1]):
        if last is None or start > last:
            times.append(end)
            last = end
    return times


def test_one_run_covers_overlapping_windows():
    assert minimum_batches([(0, 100), (50, 150), (90, 200)]) == [100]


def test_disjoint_windows_need_a_run_each():
    assert minimum_batches([(0, 10), (20, 30)]) == [10, 30]


def test_a_window_inside_another():
    assert minimum_batches([(0, 100), (10, 20)]) == [20]


def test_no_windows():
    assert minimum_batches([]) == []
