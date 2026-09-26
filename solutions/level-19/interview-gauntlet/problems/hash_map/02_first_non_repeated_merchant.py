"""The first merchant in the file with exactly one payment.

Pattern: hash map
Time:    O(n), two passes
Space:   O(k) for k distinct merchants
First instinct: a single pass holding "candidates seen once" and removing on the
  second sighting. That works with an ordered structure and is harder to read
  than counting first and scanning second, for the same complexity.
Outcome: solved directly.

Two passes is not worse than one here. Both are O(n), and the two pass version
is obviously correct, which matters more when somebody is watching.
"""

from collections import Counter


def first_non_repeated_merchant(rows: list[dict]) -> str | None:
    counts = Counter(row["merchant_id"] for row in rows)
    for row in rows:
        if counts[row["merchant_id"]] == 1:
            return row["merchant_id"]
    return None


def test_returns_the_first_merchant_seen_only_once():
    rows = [{"merchant_id": "M1"}, {"merchant_id": "M2"}, {"merchant_id": "M1"},
            {"merchant_id": "M3"}]
    assert first_non_repeated_merchant(rows) == "M2"


def test_returns_none_when_every_merchant_repeats():
    rows = [{"merchant_id": "M1"}, {"merchant_id": "M1"}]
    assert first_non_repeated_merchant(rows) is None


def test_empty():
    assert first_non_repeated_merchant([]) is None
