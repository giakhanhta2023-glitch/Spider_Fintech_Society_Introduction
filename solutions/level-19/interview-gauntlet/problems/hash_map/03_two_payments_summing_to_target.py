"""Two payments that together equal a refund amount.

Pattern: hash map
Time:    O(n)
Space:   O(n)
First instinct: nested loops, O(n^2). It is the right first answer to say out
  loud, and then to improve: "for each amount I need to know whether the
  complement exists, and that is a lookup rather than a scan".
Outcome: solved directly.

The complement trick is the whole pattern: one pass, and for each value ask
whether target minus value has already been seen. Note the order of the check
and the insert, which is what stops one payment matching itself.
"""


def two_payments_summing_to(rows: list[dict], target_minor: int) -> tuple[str, str] | None:
    """The references of two distinct payments summing to the target."""
    seen: dict[int, str] = {}
    for row in rows:
        complement = target_minor - row["amount_minor"]
        if complement in seen:
            return seen[complement], row["reference"]
        # Inserted after the lookup, so a single payment of half the target does
        # not match itself. With the insert first, target 2000 and one payment of
        # 1000 returns a pair that does not exist.
        seen[row["amount_minor"]] = row["reference"]
    return None


def test_finds_a_pair():
    rows = [
        {"reference": "A", "amount_minor": 700},
        {"reference": "B", "amount_minor": 1300},
        {"reference": "C", "amount_minor": 500},
    ]
    assert two_payments_summing_to(rows, 2000) == ("A", "B")


def test_a_single_payment_of_half_the_target_is_not_a_pair():
    rows = [{"reference": "A", "amount_minor": 1000}]
    assert two_payments_summing_to(rows, 2000) is None


def test_two_payments_of_half_the_target_are_a_pair():
    rows = [{"reference": "A", "amount_minor": 1000}, {"reference": "B", "amount_minor": 1000}]
    assert two_payments_summing_to(rows, 2000) == ("A", "B")


def test_no_pair():
    rows = [{"reference": "A", "amount_minor": 1}, {"reference": "B", "amount_minor": 2}]
    assert two_payments_summing_to(rows, 100) is None
