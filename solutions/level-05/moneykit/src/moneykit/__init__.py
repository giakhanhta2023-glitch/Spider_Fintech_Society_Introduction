"""moneykit: exact money arithmetic, with the rounding rule always visible.

    >>> from moneykit import Money
    >>> Money.parse("19.99", "USD").allocate([1, 2, 3])
    [Money.from_minor(333, 'USD'), Money.from_minor(666, 'USD'), Money.from_minor(1000, 'USD')]
"""

from __future__ import annotations

from .allocate import allocate
from .currency import BHD, EUR, GBP, JPY, USD, VND, Currency, codes, get
from .errors import CurrencyMismatch, InvalidAmount, MoneyError, UnknownCurrency
from .fx import Snapshot, snapshot
from .money import HALF_EVEN, HALF_UP, Converted, Money

__version__ = "0.1.0"

__all__ = [
    "BHD",
    "EUR",
    "GBP",
    "HALF_EVEN",
    "HALF_UP",
    "JPY",
    "USD",
    "VND",
    "Converted",
    "Currency",
    "CurrencyMismatch",
    "InvalidAmount",
    "Money",
    "MoneyError",
    "Snapshot",
    "UnknownCurrency",
    "__version__",
    "allocate",
    "codes",
    "get",
    "snapshot",
]
