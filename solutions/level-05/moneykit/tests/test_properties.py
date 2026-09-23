"""Properties: statements that hold for every input, checked against many.

An example test says "this input gives this output". A property says "whatever
you put in, this stays true", and Hypothesis then spends its time looking for
the input that breaks it. For money the properties are the interesting part,
because the failures live at boundaries nobody thinks to write down: zero,
one, negative, and the amount where a remainder appears.
"""

from __future__ import annotations

from decimal import Decimal

from hypothesis import assume, given, settings
from hypothesis import strategies as st

from moneykit import HALF_EVEN, HALF_UP, Money, allocate, codes, get

amounts = st.integers(min_value=-10**12, max_value=10**12)
weights = st.lists(st.integers(min_value=0, max_value=10**6), min_size=1, max_size=12)
currencies = st.sampled_from(codes())


@given(total=amounts, ws=weights)
def test_allocation_conserves_the_total(total: int, ws: list[int]) -> None:
    """Nothing is lost and nothing is invented. The property the whole
    function exists for."""
    assume(sum(ws) > 0)
    assert sum(allocate(total, ws)) == total


@given(total=amounts, ws=weights)
def test_allocation_is_deterministic(total: int, ws: list[int]) -> None:
    """Same inputs, same answer, always. Without this, two systems splitting
    the same payment can disagree and neither is wrong."""
    assume(sum(ws) > 0)
    assert allocate(total, ws) == allocate(total, ws)


@given(total=st.integers(min_value=0, max_value=10**12), ws=weights)
def test_every_share_is_within_one_unit_of_its_exact_value(
    total: int, ws: list[int]
) -> None:
    """Conservation alone would be satisfied by giving everything to one party.
    This is the property that says the split is also fair."""
    assume(sum(ws) > 0)
    denominator = sum(ws)
    for share, w in zip(allocate(total, ws), ws, strict=True):
        exact = Decimal(total) * Decimal(w) / Decimal(denominator)
        assert abs(Decimal(share) - exact) < 1


@given(a=amounts, b=amounts, code=currencies)
def test_add_then_subtract_returns_the_original(a: int, b: int, code: str) -> None:
    x, y = Money.from_minor(a, code), Money.from_minor(b, code)
    assert (x + y) - y == x


@given(minor=amounts, code=currencies)
def test_format_then_parse_round_trips(minor: int, code: str) -> None:
    """str is the canonical form, so it has to survive a return trip through
    parse for every currency in the table, including the ones with zero and
    three decimal places."""
    original = Money.from_minor(minor, code)
    assert Money.parse(str(original)) == original


@given(minor=st.integers(min_value=0, max_value=10**10), code=currencies)
def test_a_percentage_never_exceeds_the_amount(minor: int, code: str) -> None:
    money = Money.from_minor(minor, code)
    for rounding in (HALF_UP, HALF_EVEN):
        assert money.percentage(Decimal("0.5"), rounding) <= money


@given(minor=amounts, code=currencies)
def test_negation_is_its_own_inverse(minor: int, code: str) -> None:
    money = Money.from_minor(minor, code)
    negated = -money
    assert -negated == money


@settings(max_examples=50)
@given(minor=st.integers(min_value=0, max_value=10**9), code=currencies)
def test_splitting_in_two_then_recombining_is_the_original(
    minor: int, code: str
) -> None:
    money = Money.from_minor(minor, code)
    left, right = money.allocate([1, 1])
    assert left + right == money


@given(code=currencies)
def test_every_currency_in_the_registry_round_trips_through_get(code: str) -> None:
    assert get(code.lower()).code == code
