"""How many rolling windows exceeded a velocity limit.

Pattern: sliding window with a predicate
Time:    O(n)
Space:   O(1)
First instinct: count events over the limit rather than windows, which answers a
  different question. Reading the question twice is the lesson, and it is the most
  common way to fail an interview problem you could otherwise solve.
Outcome: solved directly.

A velocity limit is a real control: more than N payments or more than X amount on
one card within an hour. This counts the distinct windows that crossed it, which
is what a risk team reviews, rather than the events, which double counts.
"""

WINDOW_SECONDS = 60 * 60


def windows_over_limit(
    events: list[dict],
    limit_minor: int,
    window_seconds: int = WINDOW_SECONDS,
) -> int:
    """Windows ending at each event, counted once when they cross the limit.

    The window is defined by its right edge, so this counts the number of events
    at which the trailing hour was over the limit. That is a choice, and the
    docstring says so because the alternative definition gives a different number
    and both are defensible.
    """
    count = total = 0
    left = 0
    for event in events:
        total += event["amount_minor"]
        while events[left]["at"] <= event["at"] - window_seconds:
            total -= events[left]["amount_minor"]
            left += 1
        if total > limit_minor:
            count += 1
    return count


def test_counts_the_windows_that_crossed():
    events = [
        {"at": 0, "amount_minor": 400},
        {"at": 100, "amount_minor": 400},
        {"at": 200, "amount_minor": 400},        # trailing hour is now 1200
        {"at": 10_000, "amount_minor": 100},     # an hour later, nothing large
    ]
    assert windows_over_limit(events, limit_minor=1000) == 1


def test_nothing_crosses():
    events = [{"at": 0, "amount_minor": 10}]
    assert windows_over_limit(events, limit_minor=1000) == 0


def test_every_window_crosses():
    events = [{"at": t, "amount_minor": 2000} for t in (0, 10, 20)]
    assert windows_over_limit(events, limit_minor=1000) == 3
