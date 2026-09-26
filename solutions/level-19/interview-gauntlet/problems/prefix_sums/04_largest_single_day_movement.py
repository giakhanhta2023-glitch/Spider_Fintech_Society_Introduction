"""The day with the largest net movement, in either direction.

Pattern: prefix sums, then a scan
Time:    O(n)
Space:   O(number of days)
First instinct: track the largest positive day, which answers half the question.
  The largest movement can be a refund day, and reading the question again is the
  cheapest fix available.
Outcome: solved directly, after reading the question twice on purpose.

Absolute value is the thing being asked for, and the sign is what somebody needs
next, so both are returned. A function that returns a magnitude and loses the
direction gets wrapped by the caller in `if` statements forever.
"""

from collections import defaultdict


def largest_movement(entries: list[dict]) -> tuple[str, int] | None:
    """The day and its signed net movement, largest by absolute value.

    Ties go to the earlier day, which is arbitrary and stated rather than
    accidental.
    """
    per_day: dict[str, int] = defaultdict(int)
    for entry in entries:
        per_day[entry["at"][:10]] += entry["amount_minor"]
    if not per_day:
        return None
    day = min(sorted(per_day), key=lambda d: -abs(per_day[d]))
    return day, per_day[day]


def test_a_large_refund_day_wins():
    entries = [
        {"at": "2026-09-01", "amount_minor": 5_000},
        {"at": "2026-09-02", "amount_minor": -9_000},
        {"at": "2026-09-03", "amount_minor": 1_000},
    ]
    assert largest_movement(entries) == ("2026-09-02", -9_000)


def test_entries_on_the_same_day_are_netted_first():
    entries = [
        {"at": "2026-09-01", "amount_minor": 5_000},
        {"at": "2026-09-01", "amount_minor": -4_900},
        {"at": "2026-09-02", "amount_minor": 1_000},
    ]
    assert largest_movement(entries) == ("2026-09-02", 1_000)


def test_ties_go_to_the_earlier_day():
    entries = [
        {"at": "2026-09-02", "amount_minor": 1_000},
        {"at": "2026-09-01", "amount_minor": -1_000},
    ]
    assert largest_movement(entries) == ("2026-09-01", -1_000)


def test_no_entries():
    assert largest_movement([]) is None
