"""Order card events so an authorisation always precedes its own capture.

Pattern: sorting with a composite key
Time:    O(n log n)
Space:   O(n)
First instinct: sort by timestamp. That is the bug: two events can share a
  timestamp to the second, and a capture sorted before its authorisation makes a
  replay produce an illegal transition.
Outcome: wrong first, fixed. My first version sorted by `at` alone and the test
  with equal timestamps failed, which is the test level 9 taught me to write.

The fix is a rank per event type, used as the second element of the sort key.
Within one payment the causal order is fixed: authorise, then capture or void or
expire, then refund or chargeback.
"""

RANK = {
    "authorize": 0,
    "capture": 1,
    "void": 1,
    "expire": 1,
    "refund": 2,
    "chargeback": 2,
}


def order_events(events: list[dict]) -> list[dict]:
    """Sorted by time, then by causal rank, then by payment id for stability."""
    return sorted(events, key=lambda e: (e["at"], RANK[e["event"]], e["payment_id"]))


def test_equal_timestamps_keep_the_causal_order():
    events = [
        {"payment_id": "P1", "event": "capture", "at": 100},
        {"payment_id": "P1", "event": "authorize", "at": 100},
    ]
    assert [e["event"] for e in order_events(events)] == ["authorize", "capture"]


def test_time_wins_over_rank():
    events = [
        {"payment_id": "P1", "event": "refund", "at": 50},
        {"payment_id": "P2", "event": "authorize", "at": 90},
    ]
    assert [e["event"] for e in order_events(events)] == ["refund", "authorize"]


def test_a_full_lifecycle_round_trips():
    events = [
        {"payment_id": "P1", "event": "chargeback", "at": 4},
        {"payment_id": "P1", "event": "capture", "at": 2},
        {"payment_id": "P1", "event": "authorize", "at": 1},
        {"payment_id": "P1", "event": "refund", "at": 3},
    ]
    assert [e["event"] for e in order_events(events)] == [
        "authorize", "capture", "refund", "chargeback"
    ]
