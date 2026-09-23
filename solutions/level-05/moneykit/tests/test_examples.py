"""The examples from the level, as tests. Every one of these is a line that
appears in the brief, so a reader can check the library does what was claimed.
"""

from __future__ import annotations

from decimal import Decimal

import pytest

from moneykit import (
    HALF_EVEN,
    HALF_UP,
    CurrencyMismatch,
    InvalidAmount,
    Money,
    allocate,
    snapshot,
)


# ------------------------------------------------------------------ parsing
def test_parse_dollars() -> None:
    assert Money.parse("19.99", "USD").minor_units == 1999


def test_parse_yen_has_no_decimal_places() -> None:
    yen = Money.parse("1000", "JPY")
    assert yen.minor_units == 1000
    assert str(yen) == "1,000 JPY"
    assert "10.00" not in str(yen)


def test_parse_dinar_has_three() -> None:
    assert Money.parse("1.000", "BHD").minor_units == 1000
    assert Money.parse("1.234", "BHD").minor_units == 1234


def test_too_many_decimal_places_is_refused() -> None:
    with pytest.raises(InvalidAmount):
        Money.parse("19.999", "USD")


def test_a_decimal_place_the_currency_does_not_have_is_refused() -> None:
    with pytest.raises(InvalidAmount):
        Money.parse("1000.5", "JPY")


def test_parse_accepts_grouping_and_a_trailing_code() -> None:
    assert Money.parse("1,234.56 USD") == Money.from_minor(123456, "USD")


def test_parse_rejects_nonsense() -> None:
    for bad in ("", "abc", "1.2.3", "$19.99", "19.99USD"):
        with pytest.raises(InvalidAmount):
            Money.parse(bad, "USD")


# ------------------------------------------------------------- formatting
def test_format_respects_the_exponent() -> None:
    assert Money.parse("19.99", "USD").format() == "$19.99"
    assert Money.parse("1000", "JPY").format() == "¥1,000"
    assert Money.parse("1.000", "BHD").format() == "BD1.000"


def test_negative_amounts_print_with_the_sign_outside() -> None:
    assert (-Money.parse("19.99", "USD")).format() == "-$19.99"
    assert str(-Money.parse("19.99", "USD")) == "-19.99 USD"


# --------------------------------------------------------------- currency
def test_adding_different_currencies_raises() -> None:
    with pytest.raises(CurrencyMismatch):
        Money.parse("1.00", "USD") + Money.parse("1.00", "EUR")


def test_comparing_different_currencies_raises() -> None:
    with pytest.raises(CurrencyMismatch):
        _ = Money.parse("1.00", "USD") < Money.parse("1.00", "EUR")


def test_equality_across_currencies_is_false_rather_than_an_error() -> None:
    # == is allowed to answer, because "are these the same value" has an
    # answer, and it is no. Ordering does not, which is why < raises.
    assert Money.parse("1.00", "USD") != Money.parse("1.00", "EUR")


# ------------------------------------------------------------- allocation
def test_allocate_three_equal_ways() -> None:
    assert allocate(10000, [1, 1, 1]) == [3334, 3333, 3333]


def test_allocate_a_tiny_amount() -> None:
    assert allocate(5, [3, 7]) == [2, 3]


def test_allocate_by_uneven_weights() -> None:
    assert allocate(1999, [1, 2, 3]) == [333, 666, 1000]


def test_allocate_returns_money() -> None:
    parts = Money.parse("19.99", "USD").allocate([1, 2, 3])
    assert [p.minor_units for p in parts] == [333, 666, 1000]
    assert sum(p.minor_units for p in parts) == 1999


def test_allocate_a_negative_amount_still_sums() -> None:
    parts = allocate(-1999, [1, 2, 3])
    assert sum(parts) == -1999


def test_allocate_refuses_impossible_weights() -> None:
    for weights in ([], [0, 0], [1, -1]):
        with pytest.raises(ValueError):
            allocate(100, weights)


# ------------------------------------------------------------ percentages
def test_sales_tax_on_a_price() -> None:
    fee = Money.parse("19.99", "USD").percentage(Decimal("0.0825"), HALF_UP)
    assert fee.minor_units == 165
    assert fee.format() == "$1.65"


def test_the_rounding_rule_changes_the_answer_and_is_visible() -> None:
    half_a_cent = Money.from_minor(50, "USD")
    assert half_a_cent.percentage(Decimal("0.01"), HALF_UP).minor_units == 1
    assert half_a_cent.percentage(Decimal("0.01"), HALF_EVEN).minor_units == 0


def test_percentage_requires_a_rounding_rule() -> None:
    with pytest.raises(TypeError):
        Money.parse("19.99", "USD").percentage(Decimal("0.0825"))  # type: ignore[call-arg]


# ------------------------------------------------------------- conversion
def test_convert_dollars_to_dong() -> None:
    result = Money.parse("100.00", "USD").convert("VND", Decimal("25480"), HALF_UP)
    assert result.amount.minor_units == 2_548_000
    assert str(result.amount) == "2,548,000 VND"
    assert result.rate == Decimal("25480")


def test_convert_uses_the_shipped_snapshot() -> None:
    rate = snapshot().rate("VND")
    result = Money.parse("100.00", "USD").convert("VND", rate, HALF_UP)
    assert result.amount.minor_units == 2_548_000
    assert snapshot().as_of == "2025-01-02"


def test_conversion_carries_the_rate_used() -> None:
    result = Money.parse("10.00", "USD").convert("EUR", Decimal("0.9512"), HALF_UP)
    assert result.amount.format() == "€9.51"
    assert result.rate == Decimal("0.9512")
    assert result.source == Money.parse("10.00", "USD")


# ------------------------------------------------------------- arithmetic
def test_multiplication_is_whole_numbers_only() -> None:
    assert (Money.parse("1.11", "USD") * 3).minor_units == 333
    with pytest.raises(TypeError):
        Money.parse("1.11", "USD") * 1.5  # type: ignore[operator]
