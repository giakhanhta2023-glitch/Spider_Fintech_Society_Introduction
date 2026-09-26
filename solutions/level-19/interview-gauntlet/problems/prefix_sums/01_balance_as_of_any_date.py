"""The account balance as of any date, answered in constant time.

Pattern: prefix sums
Time:    O(n log n) to build, O(log n) per query
Space:   O(n)
First instinct: sum every entry up to the date, per query. O(n) per query, which
  is fine for one question and hopeless for a chart with 365 points.
Outcome: solved directly.

This is the level 4 ledger question. A running total plus a binary search answers
"what was the balance on the 3rd" without re-reading the ledger, and the ledger is
append only, so the prefix array only ever grows at the end.
"""

from bisect import bisect_right


class Balances:
    """Built once from an append only ledger, queried many times."""

    def __init__(self, entries: list[dict]) -> None:
        # Sorted by date, because a ledger is written in commit order and a
        # backdated correction is normal. Level 10's timing breaks came from
        # exactly this.
        ordered = sorted(entries, key=lambda e: e["at"])
        self._dates = [e["at"] for e in ordered]
        self._totals: list[int] = []
        running = 0
        for entry in ordered:
            running += entry["amount_minor"]
            self._totals.append(running)

    def as_of(self, date: str) -> int:
        """Inclusive of the date given, which is the convention a statement uses."""
        index = bisect_right(self._dates, date)
        return 0 if index == 0 else self._totals[index - 1]


def test_balance_at_several_dates():
    entries = [
        {"at": "2026-09-01", "amount_minor": 10_000},
        {"at": "2026-09-03", "amount_minor": -2_500},
        {"at": "2026-09-05", "amount_minor": 1_000},
    ]
    balances = Balances(entries)
    assert balances.as_of("2026-08-31") == 0
    assert balances.as_of("2026-09-01") == 10_000
    assert balances.as_of("2026-09-04") == 7_500
    assert balances.as_of("2026-09-30") == 8_500


def test_entries_out_of_order_are_sorted():
    entries = [
        {"at": "2026-09-05", "amount_minor": 1},
        {"at": "2026-09-01", "amount_minor": 10},
    ]
    assert Balances(entries).as_of("2026-09-01") == 10


def test_an_empty_ledger_is_zero_everywhere():
    assert Balances([]).as_of("2026-09-01") == 0
