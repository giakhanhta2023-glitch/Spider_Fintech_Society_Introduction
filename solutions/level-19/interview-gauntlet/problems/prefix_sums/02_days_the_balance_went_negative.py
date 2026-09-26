"""Which days the running balance was negative.

Pattern: prefix sums
Time:    O(n)
Space:   O(n)
First instinct: recompute the balance per day, O(n^2) over a year of entries. The
  running total already visits every day once.
Outcome: solved directly.

A negative balance in a ledger is an overdraft rather than an error, and which
days it happened on is a question a finance team asks monthly. Answering it from a
prefix sum is the difference between a query and a spreadsheet.
"""

from collections import defaultdict


def days_negative(entries: list[dict]) -> list[str]:
    """Days whose closing balance was below zero, in date order.

    Closing balance rather than any moment during the day, because that is what a
    statement shows and it is the number somebody will reconcile against.
    """
    per_day: dict[str, int] = defaultdict(int)
    for entry in entries:
        per_day[entry["at"][:10]] += entry["amount_minor"]

    running = 0
    negative: list[str] = []
    for day in sorted(per_day):
        running += per_day[day]
        if running < 0:
            negative.append(day)
    return negative


def test_finds_the_negative_days():
    entries = [
        {"at": "2026-09-01", "amount_minor": 1_000},
        {"at": "2026-09-02", "amount_minor": -3_000},
        {"at": "2026-09-03", "amount_minor": 500},
        {"at": "2026-09-04", "amount_minor": 5_000},
    ]
    assert days_negative(entries) == ["2026-09-02", "2026-09-03"]


def test_several_entries_on_one_day_net_off():
    entries = [
        {"at": "2026-09-01", "amount_minor": -1_000},
        {"at": "2026-09-01", "amount_minor": 1_000},
    ]
    assert days_negative(entries) == []


def test_no_entries():
    assert days_negative([]) == []
