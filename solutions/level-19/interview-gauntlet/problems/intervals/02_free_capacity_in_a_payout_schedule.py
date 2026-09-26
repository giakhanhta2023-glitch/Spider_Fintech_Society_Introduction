"""The gaps in a payout schedule, which is where another batch could fit.

Pattern: intervals, the complement
Time:    O(n log n)
Space:   O(n)
First instinct: iterate over every minute of the day and mark it busy. Correct,
  O(minutes) rather than O(intervals), and it stops working the moment the unit is
  seconds.
Outcome: solved directly.

The complement of a set of intervals is the same sweep with the output inverted,
and the two ends are the part that gets forgotten: a gap before the first booking
and a gap after the last one.
"""


def free_windows(
    booked: list[tuple[int, int]], day_start: int = 0, day_end: int = 1440
) -> list[tuple[int, int]]:
    """Minutes free, given bookings in minutes from midnight."""
    merged: list[tuple[int, int]] = []
    for start, end in sorted(booked):
        if merged and start <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], end))
        else:
            merged.append((start, end))

    free: list[tuple[int, int]] = []
    cursor = day_start
    for start, end in merged:
        if start > cursor:
            free.append((cursor, start))
        cursor = max(cursor, end)
    if cursor < day_end:
        free.append((cursor, day_end))          # the tail, which gets forgotten
    return free


def test_gaps_between_bookings():
    booked = [(540, 600), (780, 840)]
    assert free_windows(booked) == [(0, 540), (600, 780), (840, 1440)]


def test_a_full_day():
    assert free_windows([(0, 1440)]) == []


def test_no_bookings():
    assert free_windows([]) == [(0, 1440)]


def test_overlapping_bookings_are_merged_first():
    assert free_windows([(0, 100), (50, 200)]) == [(200, 1440)]
