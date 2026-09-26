"""Group payments by merchant, then by day, with totals.

Pattern: sorting, answered with a hash map instead
Time:    O(n)
Space:   O(number of groups)
First instinct: sort by merchant and day and then walk the runs, O(n log n). It
  works and it is what itertools.groupby wants, and a dictionary is linear and
  needs no sort at all.
Outcome: solved directly, and filed under the wrong pattern on purpose. The level
  lists this one under sorting, and the right answer is a hash map. Recognising
  that the obvious family is the wrong family is the skill being practised, and it
  is why the header says sorting and the code does not sort.

Measured in complexity/measure.py on 200,000 payments and 500 merchants: filtering
once per merchant took 12,723.1 ms and one pass into a dictionary took 122.6 ms,
a factor of 104. This is the class change, and it is the most common real world
version of the mistake: a loop over groups with a filter inside it.
"""

from collections import defaultdict


def group_by_merchant_and_day(payments: list[dict]) -> dict[str, dict[str, int]]:
    totals: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for payment in payments:
        day = payment["at"][:10]                  # ISO 8601, so a slice is the date
        totals[payment["merchant_id"]][day] += payment["amount_minor"]
    return {merchant: dict(days) for merchant, days in totals.items()}


def test_groups_and_totals():
    payments = [
        {"merchant_id": "M1", "at": "2026-09-01T10:00:00", "amount_minor": 1000},
        {"merchant_id": "M1", "at": "2026-09-01T23:59:59", "amount_minor": 500},
        {"merchant_id": "M1", "at": "2026-09-02T00:00:01", "amount_minor": 700},
        {"merchant_id": "M2", "at": "2026-09-01T12:00:00", "amount_minor": 300},
    ]
    assert group_by_merchant_and_day(payments) == {
        "M1": {"2026-09-01": 1500, "2026-09-02": 700},
        "M2": {"2026-09-01": 300},
    }


def test_no_payments():
    assert group_by_merchant_and_day([]) == {}


def test_a_single_payment():
    payments = [{"merchant_id": "M1", "at": "2026-09-01T00:00:00", "amount_minor": 1}]
    assert group_by_merchant_and_day(payments) == {"M1": {"2026-09-01": 1}}
