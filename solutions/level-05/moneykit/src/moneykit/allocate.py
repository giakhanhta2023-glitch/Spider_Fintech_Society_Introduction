"""Splitting an integer amount without losing or inventing a unit.

The rule is largest remainder. Give everybody the whole part of their share,
count how many units are left over, and hand them out one at a time to the
shares with the largest fractional part. Ties go to the earlier position, so
the answer is deterministic and a test can assert an exact list.

It is worth seeing why the obvious alternatives are wrong:

    round each share      1999 split 1:2:3 gives 333 + 666 + 1000 = 1999 here,
                          but rounding each share independently can produce a
                          total one or two units away from what you started
                          with, and the error is silent.

    give the remainder    all of the loss lands on one party, every time, which
    to the last share     is fine once and indefensible across a million
                          payouts.
"""

from __future__ import annotations

from collections.abc import Sequence


def allocate(total: int, weights: Sequence[int]) -> list[int]:
    """Split ``total`` into len(weights) parts in proportion to ``weights``.

    The parts always sum exactly to ``total``, including when ``total`` is
    negative. Works in integers throughout: no float, no Decimal, nothing that
    could round behind your back.

    >>> allocate(10000, [1, 1, 1])
    [3334, 3333, 3333]
    >>> allocate(5, [3, 7])
    [2, 3]
    >>> allocate(1999, [1, 2, 3])
    [333, 666, 1000]
    """
    if not weights:
        raise ValueError("allocate needs at least one weight")
    if any(w < 0 for w in weights):
        raise ValueError("weights cannot be negative")

    denominator = sum(weights)
    if denominator == 0:
        raise ValueError("weights cannot all be zero")

    # Whole part of each share, and the numerator of what is left over.
    # Python's // and % floor towards negative infinity, which is what makes
    # the negative case work without a special branch.
    shares = [total * w // denominator for w in weights]
    remainders = [total * w % denominator for w in weights]

    left_over = total - sum(shares)

    # Hand out the leftover units, largest fractional part first. The index is
    # in the sort key so that equal remainders break towards position 0, which
    # is what makes the function deterministic.
    order = sorted(range(len(weights)), key=lambda i: (-remainders[i], i))
    for i in order[:left_over]:
        shares[i] += 1

    return shares
