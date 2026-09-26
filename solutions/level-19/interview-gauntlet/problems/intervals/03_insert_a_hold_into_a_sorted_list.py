"""Insert a new hold into a sorted, non overlapping list.

Pattern: intervals, insertion
Time:    O(n)
Space:   O(n)
First instinct: append and re-merge everything, O(n log n). It is correct and it
  throws away the sortedness that was the point of keeping the list sorted.
Outcome: solved directly.

Three phases, and writing them as three loops rather than one clever loop is
deliberate: everything before, everything overlapping, everything after. The clever
single loop version of this is where the off by one errors live.
"""


def insert_hold(
    holds: list[tuple[int, int]], new: tuple[int, int]
) -> list[tuple[int, int]]:
    start, end = new
    out: list[tuple[int, int]] = []
    index = 0

    while index < len(holds) and holds[index][1] < start:
        out.append(holds[index])
        index += 1

    while index < len(holds) and holds[index][0] <= end:
        start = min(start, holds[index][0])
        end = max(end, holds[index][1])
        index += 1
    out.append((start, end))

    out.extend(holds[index:])
    return out


def test_inserted_into_a_gap():
    assert insert_hold([(0, 50), (200, 250)], (100, 150)) == [(0, 50), (100, 150), (200, 250)]


def test_absorbs_the_intervals_it_overlaps():
    assert insert_hold([(0, 50), (60, 90), (200, 250)], (40, 80)) == [(0, 90), (200, 250)]


def test_before_everything_and_after_everything():
    assert insert_hold([(100, 200)], (0, 10)) == [(0, 10), (100, 200)]
    assert insert_hold([(100, 200)], (300, 400)) == [(100, 200), (300, 400)]


def test_into_an_empty_list():
    assert insert_hold([], (10, 20)) == [(10, 20)]
