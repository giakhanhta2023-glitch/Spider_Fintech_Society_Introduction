"""The highest volume any 24 hour window contains, for one merchant.

Pattern: sliding window, variable size
Time:    O(n) over events already sorted by time
Space:   O(1)
First instinct: for every event, sum the next 24 hours, O(n^2). Then: as the right
  edge moves forward, the left edge only ever moves forward too, so each event
  enters and leaves the window once.
Outcome: solved directly.

This is a real fraud and risk query: a card or a merchant crossing a rolling limit
is checked this way, and "rolling" is why it is a window rather than a group by
calendar day. Calendar days are the wrong answer and they are what most first
implementations do.
"""

WINDOW_SECONDS = 24 * 60 * 60


def highest_rolling_volume(events: list[dict], window_seconds: int = WINDOW_SECONDS) -> int:
    """Events must be sorted by `at`, which is a precondition worth stating."""
    best = total = 0
    left = 0
    for event in events:
        total += event["amount_minor"]
        # Everything older than the window leaves. `<=` on the boundary is a
        # decision: an event exactly 24 hours old is outside the window.
        while events[left]["at"] <= event["at"] - window_seconds:
            total -= events[left]["amount_minor"]
            left += 1
        best = max(best, total)
    return best


def test_finds_the_busiest_window():
    events = [
        {"at": 0, "amount_minor": 1000},
        {"at": 3600, "amount_minor": 2000},
        {"at": 90_000, "amount_minor": 5000},      # a day later
        {"at": 91_000, "amount_minor": 1000},
    ]
    assert highest_rolling_volume(events) == 6000


def test_all_events_inside_one_window():
    events = [{"at": t, "amount_minor": 100} for t in (0, 10, 20)]
    assert highest_rolling_volume(events) == 300


def test_no_events():
    assert highest_rolling_volume([]) == 0
