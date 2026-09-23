"""Currencies, and the one number that matters about them.

The ISO 4217 exponent is how many decimal places a currency has. It is 2 for
most of the world, 0 for the yen and the dong, and 3 for the Bahraini dinar.
Every piece of formatting and parsing in this library reads it, which is why
it lives on the currency rather than being assumed to be 2 somewhere.
"""

from __future__ import annotations

from dataclasses import dataclass

from .errors import UnknownCurrency


@dataclass(frozen=True, slots=True)
class Currency:
    """An ISO 4217 currency. Frozen, so it can be shared and hashed."""

    code: str
    exponent: int
    symbol: str
    name: str

    @property
    def scale(self) -> int:
        """Minor units in one major unit. 100 for dollars, 1 for yen."""
        return int(10**self.exponent)

    def __str__(self) -> str:
        return self.code


_CURRENCIES: dict[str, Currency] = {
    c.code: c
    for c in (
        Currency("USD", 2, "$", "US dollar"),
        Currency("EUR", 2, "€", "euro"),
        Currency("GBP", 2, "£", "pound sterling"),
        Currency("JPY", 0, "¥", "yen"),
        Currency("VND", 0, "₫", "dong"),
        Currency("BHD", 3, "BD", "Bahraini dinar"),
    )
}


def get(code: str) -> Currency:
    """Look a currency up by its three letter code, case insensitively."""
    try:
        return _CURRENCIES[code.upper()]
    except KeyError:
        raise UnknownCurrency(f"unknown currency {code!r}") from None


def codes() -> tuple[str, ...]:
    """Every code in the registry, sorted. Used by the property tests."""
    return tuple(sorted(_CURRENCIES))


USD = get("USD")
EUR = get("EUR")
GBP = get("GBP")
JPY = get("JPY")
VND = get("VND")
BHD = get("BHD")
