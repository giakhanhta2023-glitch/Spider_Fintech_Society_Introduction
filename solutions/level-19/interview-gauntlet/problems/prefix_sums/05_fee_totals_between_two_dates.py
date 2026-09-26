"""Total fees between two dates, for many date ranges.

Pattern: prefix sums with binary search
Time:    O(n log n) to build, O(log n) per range
Space:   O(n)
First instinct: filter the list per range. Fine once, and a monthly report asks
  twelve times, a dashboard asks 365 times, and each one re-reads everything.
Outcome: solved directly.

The inclusive and exclusive question is the whole bug surface here. Both ends
inclusive, stated in the docstring and asserted in a test, because a fee report
that is off by one day at a month boundary is a finance conversation rather than a
rounding error.
"""

from bisect import bisect_left, bisect_right


class Fees:
    def __init__(self, entries: list[dict]) -> None:
        ordered = sorted(entries, key=lambda e: e["at"])
        self._dates = [e["at"][:10] for e in ordered]
        self._prefix = [0]
        for entry in ordered:
            self._prefix.append(self._prefix[-1] + entry["fee_minor"])

    def between(self, start: str, end: str) -> int:
        """Both ends inclusive, as a statement period is."""
        low = bisect_left(self._dates, start)
        high = bisect_right(self._dates, end)
        return self._prefix[high] - self._prefix[low]

    @property
    def total(self) -> int:
        return self._prefix[-1]


def test_a_range_in_the_middle():
    entries = [
        {"at": "2026-09-01", "fee_minor": 100},
        {"at": "2026-09-02", "fee_minor": 200},
        {"at": "2026-09-03", "fee_minor": 400},
    ]
    assert Fees(entries).between("2026-09-02", "2026-09-03") == 600


def test_both_ends_are_inclusive():
    entries = [{"at": "2026-09-01", "fee_minor": 100}]
    fees = Fees(entries)
    assert fees.between("2026-09-01", "2026-09-01") == 100
    assert fees.between("2026-09-02", "2026-09-30") == 0


def test_the_whole_period_matches_the_total():
    entries = [{"at": f"2026-09-{d:02d}", "fee_minor": d} for d in range(1, 31)]
    fees = Fees(entries)
    assert fees.between("2026-09-01", "2026-09-30") == fees.total
