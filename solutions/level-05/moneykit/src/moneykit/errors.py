"""Every way this library refuses to do something.

One base class, so a caller can catch everything from moneykit without
catching ValueError from unrelated code.
"""

from __future__ import annotations


class MoneyError(Exception):
    """Base class for every error this package raises."""


class CurrencyMismatch(MoneyError):
    """Two amounts in different currencies were combined or compared."""

    def __init__(self, left: str, right: str) -> None:
        super().__init__(f"cannot combine {left} and {right}")
        self.left = left
        self.right = right


class InvalidAmount(MoneyError):
    """A string could not be read as an amount in the given currency."""


class UnknownCurrency(MoneyError):
    """A currency code is not in the registry."""
