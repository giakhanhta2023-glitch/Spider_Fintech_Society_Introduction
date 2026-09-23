"""The rest of the public surface.

Split out from the example tests because these are not lines from the brief,
they are the parts a library has to have anyway: the comparisons, the unary
operators, the string forms, and every error path. A public function with no
test is a public function nobody has checked.
"""

from __future__ import annotations

from dataclasses import FrozenInstanceError
from decimal import Decimal

import pytest

from moneykit import (
    HALF_UP,
    Currency,
    InvalidAmount,
    Money,
    UnknownCurrency,
    codes,
    get,
    snapshot,
)


# ------------------------------------------------------------- currencies
def test_currency_prints_as_its_code() -> None:
    assert str(get("USD")) == "USD"


def test_currency_knows_its_scale() -> None:
    assert get("USD").scale == 100
    assert get("JPY").scale == 1
    assert get("BHD").scale == 1000


def test_unknown_currency_raises() -> None:
    with pytest.raises(UnknownCurrency):
        get("XYZ")


def test_the_registry_lists_the_six_currencies() -> None:
    assert codes() == ("BHD", "EUR", "GBP", "JPY", "USD", "VND")


def test_a_currency_is_frozen() -> None:
    with pytest.raises(FrozenInstanceError):
        get("USD").exponent = 3  # type: ignore[misc]


# ----------------------------------------------------------------- parsing
def test_parse_without_a_currency_anywhere_raises() -> None:
    with pytest.raises(InvalidAmount):
        Money.parse("19.99")


def test_parse_accepts_a_currency_object() -> None:
    assert Money.parse("1.00", get("GBP")).currency == get("GBP")


# ------------------------------------------------------------- comparison
def test_the_full_set_of_comparisons() -> None:
    small, large = Money.from_minor(1, "USD"), Money.from_minor(2, "USD")
    assert small < large
    assert small <= large
    assert large > small
    assert large >= small
    assert small <= small
    assert small >= small


# ----------------------------------------------------------- unary and bool
def test_absolute_value() -> None:
    assert abs(Money.from_minor(-500, "USD")) == Money.from_minor(500, "USD")


def test_zero_is_falsey_and_anything_else_is_not() -> None:
    assert not Money.from_minor(0, "USD")
    assert Money.from_minor(1, "USD")
    assert Money.from_minor(-1, "USD")


def test_money_is_hashable_so_it_can_be_a_dictionary_key() -> None:
    counts = {Money.from_minor(100, "USD"): "a dollar"}
    assert counts[Money.parse("1.00", "USD")] == "a dollar"


def test_repr_round_trips_through_eval() -> None:
    original = Money.from_minor(-1999, "USD")
    assert eval(repr(original), {"Money": Money}) == original


# ------------------------------------------------------------- conversion
def test_a_conversion_prints_its_working() -> None:
    result = Money.parse("100.00", "USD").convert("VND", Decimal("25480"), HALF_UP)
    assert str(result) == "100.00 USD -> 2,548,000 VND at 25480"


def test_converting_to_a_currency_object_works_too() -> None:
    target: Currency = get("JPY")
    result = Money.parse("1.00", "USD").convert(target, Decimal("157.21"), HALF_UP)
    assert result.amount == Money.from_minor(157, "JPY")


# --------------------------------------------------------------- snapshot
def test_the_snapshot_has_no_rate_for_a_currency_it_does_not_carry() -> None:
    with pytest.raises(UnknownCurrency):
        snapshot().rate("CHF")


def test_the_snapshot_is_loaded_once() -> None:
    assert snapshot() is snapshot()
