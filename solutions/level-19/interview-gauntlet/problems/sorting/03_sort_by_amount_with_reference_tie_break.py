"""Sort payments by amount descending, references breaking ties ascending.

Pattern: sorting with a mixed direction key
Time:    O(n log n)
Space:   O(n)
First instinct: sort twice, once per field, relying on stability. That works and
  is two passes and needs the order of the passes reasoned about backwards.
Outcome: solved directly.

The mixed direction is the whole question. Negating a number is the standard trick
and there is no negating a string, so either sort twice in the right order or use
`reverse` with a key that already accounts for it. Both are here.
"""


def by_amount_then_reference(payments: list[dict]) -> list[dict]:
    """One pass. The amount is negated to sort it descending inside an ascending
    sort, which leaves the reference ascending as written."""
    return sorted(payments, key=lambda p: (-p["amount_minor"], p["reference"]))


def by_amount_then_reference_stable(payments: list[dict]) -> list[dict]:
    """Two passes, least significant first, relying on Python's stable sort.

    Worth knowing because it is the only option when a key cannot be negated,
    for example sorting by two strings in opposite directions.
    """
    once = sorted(payments, key=lambda p: p["reference"])
    return sorted(once, key=lambda p: p["amount_minor"], reverse=True)


def test_ties_break_by_reference():
    payments = [
        {"reference": "B", "amount_minor": 500},
        {"reference": "A", "amount_minor": 500},
        {"reference": "C", "amount_minor": 900},
    ]
    assert [p["reference"] for p in by_amount_then_reference(payments)] == ["C", "A", "B"]


def test_both_versions_agree():
    payments = [
        {"reference": f"R{i}", "amount_minor": amount}
        for i, amount in enumerate([500, 900, 500, 100, 900])
    ]
    assert by_amount_then_reference(payments) == by_amount_then_reference_stable(payments)


def test_empty():
    assert by_amount_then_reference([]) == []
