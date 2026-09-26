"""Duplicate references in a settlement file.

Pattern: hash map
Time:    O(n)
Space:   O(n)
First instinct: sort the references and scan for equal neighbours. Correct, and
  O(n log n) for no benefit, because counting does not need order.
Outcome: solved directly.

The domain reason this matters: a duplicate reference in a settlement file is
either the processor sending a file twice or the same payment settling twice, and
the second one is money moving twice. Level 10 found exactly that.
"""

from collections import Counter


def duplicate_references(rows: list[dict]) -> list[str]:
    """References appearing more than once, in the order they were first seen.

    First seen order rather than sorted, because the caller is going to read the
    file at those positions and an arbitrary order makes that harder for no gain.
    """
    counts = Counter(row["reference"] for row in rows)
    seen: set[str] = set()
    out: list[str] = []
    for row in rows:
        reference = row["reference"]
        if counts[reference] > 1 and reference not in seen:
            seen.add(reference)
            out.append(reference)
    return out


def test_finds_a_duplicate_in_first_seen_order():
    rows = [{"reference": "B"}, {"reference": "A"}, {"reference": "B"}, {"reference": "A"}]
    assert duplicate_references(rows) == ["B", "A"]


def test_no_duplicates():
    assert duplicate_references([{"reference": "A"}, {"reference": "B"}]) == []


def test_empty():
    assert duplicate_references([]) == []


def test_three_of_the_same_reference_is_reported_once():
    rows = [{"reference": "A"}] * 3
    assert duplicate_references(rows) == ["A"]
