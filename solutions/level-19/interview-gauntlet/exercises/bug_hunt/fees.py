"""Exercise 2: a failing test and unfamiliar code. Find the bug.

Ninety minutes, and the first five are spent running the tests rather than reading
the file, because a working baseline tells you more than an hour of reading.

The scenario: this module computes merchant fees. One test fails. The code looks
reasonable, the maths looks reasonable, and the failure is one line.

**The bug is fixed below and the original is in the comment**, because the value
of the exercise is the diagnosis rather than the patch.
"""

from decimal import ROUND_HALF_UP, Decimal

# 2.9% plus 30 cents, the published small business rate shape.
PERCENT = Decimal("2.9")
FIXED_MINOR = 30


def fee_minor(amount_minor: int) -> int:
    """The fee on one payment, in minor units, rounded to the cent.

    The bug was here:

        return int(amount_minor * PERCENT / 100) + FIXED_MINOR

    `int()` truncates towards zero. On an amount of 1999 the percentage part is
    57.971, which truncates to 57 and should round to 58. One cent per payment,
    always in the same direction, on every payment the company takes.

    At the level 16 volume of 131 million payments a month that is $1.31 million a
    month of fees not charged, and it would never appear in a test that used round
    numbers. The test that catches it uses 1999, which is what a real amount looks
    like.

    Level 2 and level 4, arriving together: never float money, and never let a
    language's default rounding decide what the money is.
    """
    percentage = (Decimal(amount_minor) * PERCENT / Decimal(100)).quantize(
        Decimal("1"), rounding=ROUND_HALF_UP
    )
    return int(percentage) + FIXED_MINOR


def net_minor(amount_minor: int) -> int:
    """What the merchant receives."""
    return amount_minor - fee_minor(amount_minor)


def test_a_round_amount_would_not_have_caught_it():
    """1000 * 2.9% is exactly 29, so truncation and rounding agree. This is the
    test that was already in the repository, and it passed."""
    assert fee_minor(1000) == 29 + 30


def test_the_failing_test():
    """1999 * 2.9% is 57.971. Truncation gives 57, rounding gives 58."""
    assert fee_minor(1999) == 58 + 30


def test_half_a_cent_rounds_up_consistently():
    # 1724 * 2.9% = 49.996, and 1725 * 2.9% = 50.025.
    assert fee_minor(1724) == 50 + 30
    assert fee_minor(1725) == 50 + 30


def test_the_net_and_the_fee_always_sum_to_the_amount():
    for amount in (1, 99, 1999, 250_000, 999_999):
        assert net_minor(amount) + fee_minor(amount) == amount


def test_a_zero_payment_still_carries_the_fixed_fee():
    """Whether that is correct is a product question rather than a code one, and
    the answer belongs in the submission note rather than in a silent change."""
    assert fee_minor(0) == 30
