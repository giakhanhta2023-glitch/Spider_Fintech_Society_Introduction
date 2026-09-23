"""An amount of money, held as an exact integer count of minor units.

There is no float anywhere in this file, and the one place Decimal appears is
percentage and conversion, where a fraction genuinely has to be multiplied and
then rounded by a rule the caller chose. Everything else is integers.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from decimal import ROUND_HALF_EVEN, ROUND_HALF_UP, Decimal, localcontext
from typing import Final

from . import currency as _currency
from .allocate import allocate
from .currency import Currency
from .errors import CurrencyMismatch, InvalidAmount

HALF_UP: Final = ROUND_HALF_UP
HALF_EVEN: Final = ROUND_HALF_EVEN

_AMOUNT = re.compile(r"^(?P<sign>[-+]?)(?P<whole>\d[\d,]*)(?:\.(?P<frac>\d+))?$")


def _group(digits: str) -> str:
    """1234567 -> 1,234,567. Written out because locale formatting is not
    deterministic across machines, and these strings end up in tests."""
    out = []
    for i, ch in enumerate(reversed(digits)):
        if i and i % 3 == 0:
            out.append(",")
        out.append(ch)
    return "".join(reversed(out))


@dataclass(frozen=True, slots=True, order=False)
class Money:
    """An exact amount in one currency.

    >>> Money.parse("19.99", "USD")
    Money.from_minor(1999, 'USD')
    >>> str(Money.parse("1000", "JPY"))
    '1,000 JPY'
    """

    minor_units: int
    currency: Currency

    # ------------------------------------------------------------ building
    @classmethod
    def from_minor(cls, minor_units: int, code: str | Currency) -> Money:
        """The amount in the smallest unit: cents, yen, fils."""
        cur = code if isinstance(code, Currency) else _currency.get(code)
        return cls(int(minor_units), cur)

    @classmethod
    def parse(cls, text: str, code: str | Currency | None = None) -> Money:
        """Read an amount written the way a human writes it.

        Accepts "19.99" with a currency argument, or "19.99 USD" on its own,
        with optional thousands separators. Rejects more decimal places than
        the currency has, because "19.999 USD" is not an amount of money and
        silently rounding it is how a cent goes missing.
        """
        raw = text.strip()
        if code is None:
            parts = raw.rsplit(" ", 1)
            if len(parts) != 2:
                raise InvalidAmount(f"no currency in {text!r}")
            raw, code = parts[0].strip(), parts[1].strip()

        cur = code if isinstance(code, Currency) else _currency.get(code)
        match = _AMOUNT.match(raw)
        if match is None:
            raise InvalidAmount(f"cannot read {text!r} as an amount")

        frac = match.group("frac") or ""
        if len(frac) > cur.exponent:
            raise InvalidAmount(
                f"{cur.code} has {cur.exponent} decimal places, {text!r} has {len(frac)}"
            )

        whole = match.group("whole").replace(",", "")
        minor = int(whole) * cur.scale + int(frac.ljust(cur.exponent, "0") or 0)
        return cls(-minor if match.group("sign") == "-" else minor, cur)

    # ------------------------------------------------------------- showing
    def _digits(self) -> tuple[str, str, str]:
        sign = "-" if self.minor_units < 0 else ""
        units = abs(self.minor_units)
        whole, frac = divmod(units, self.currency.scale)
        return sign, _group(str(whole)), str(frac).rjust(self.currency.exponent, "0")

    def __str__(self) -> str:
        """Canonical, and round trips through parse. '19.99 USD', '1,000 JPY'."""
        sign, whole, frac = self._digits()
        body = f"{whole}.{frac}" if self.currency.exponent else whole
        return f"{sign}{body} {self.currency.code}"

    def __repr__(self) -> str:
        return f"Money.from_minor({self.minor_units}, {self.currency.code!r})"

    def format(self) -> str:
        """For a person to read: '$19.99', '¥1,000', 'BD1.000'."""
        sign, whole, frac = self._digits()
        body = f"{whole}.{frac}" if self.currency.exponent else whole
        return f"{sign}{self.currency.symbol}{body}"

    # ---------------------------------------------------------- arithmetic
    def _same(self, other: Money) -> None:
        if self.currency != other.currency:
            raise CurrencyMismatch(self.currency.code, other.currency.code)

    def __add__(self, other: Money) -> Money:
        self._same(other)
        return Money(self.minor_units + other.minor_units, self.currency)

    def __sub__(self, other: Money) -> Money:
        self._same(other)
        return Money(self.minor_units - other.minor_units, self.currency)

    def __mul__(self, factor: int) -> Money:
        """Whole multiples only. A fractional multiplier needs a rounding rule,
        which is what percentage is for."""
        if not isinstance(factor, int) or isinstance(factor, bool):
            raise TypeError("multiply Money by a whole number, or use percentage")
        return Money(self.minor_units * factor, self.currency)

    __rmul__ = __mul__

    def __neg__(self) -> Money:
        return Money(-self.minor_units, self.currency)

    def __abs__(self) -> Money:
        return Money(abs(self.minor_units), self.currency)

    def __bool__(self) -> bool:
        return self.minor_units != 0

    # ---------------------------------------------------------- comparison
    def __lt__(self, other: Money) -> bool:
        self._same(other)
        return self.minor_units < other.minor_units

    def __le__(self, other: Money) -> bool:
        self._same(other)
        return self.minor_units <= other.minor_units

    def __gt__(self, other: Money) -> bool:
        self._same(other)
        return self.minor_units > other.minor_units

    def __ge__(self, other: Money) -> bool:
        self._same(other)
        return self.minor_units >= other.minor_units

    # -------------------------------------------------------------- splits
    def allocate(self, weights: list[int]) -> list[Money]:
        """Split this amount by weight, losing nothing.

        >>> [str(m) for m in Money.parse("19.99", "USD").allocate([1, 2, 3])]
        ['3.33 USD', '6.66 USD', '10.00 USD']
        """
        return [Money(part, self.currency) for part in allocate(self.minor_units, weights)]

    def percentage(self, rate: Decimal | str, rounding: str) -> Money:
        """A fraction of this amount, rounded by a rule you pass in.

        ``rate`` is a fraction, so 8.25% is Decimal("0.0825"). ``rounding`` is
        required on purpose: a hidden default is how two systems that agree on
        the arithmetic still disagree on the answer.

        >>> fee = Money.parse("19.99", "USD").percentage(Decimal("0.0825"), HALF_UP)
        >>> fee.format()
        '$1.65'
        """
        with localcontext() as ctx:
            ctx.prec = 34
            exact = Decimal(self.minor_units) * Decimal(rate)
            return Money(int(exact.quantize(Decimal(1), rounding=rounding)), self.currency)

    def convert(self, to: str | Currency, rate: Decimal | str, rounding: str) -> Converted:
        """Convert at a given rate, and keep the rate on the result.

        The rate is part of the answer rather than something the caller is
        trusted to remember: a converted amount with no rate attached cannot be
        checked, explained to a customer, or reconciled six months later.

        >>> c = Money.parse("100.00", "USD").convert("VND", Decimal("25480"), HALF_UP)
        >>> str(c.amount)
        '2,548,000 VND'
        """
        target = to if isinstance(to, Currency) else _currency.get(to)
        with localcontext() as ctx:
            ctx.prec = 34
            major = Decimal(self.minor_units) / Decimal(self.currency.scale)
            converted = major * Decimal(rate) * Decimal(target.scale)
            amount = Money(
                int(converted.quantize(Decimal(1), rounding=rounding)), target
            )
        return Converted(amount=amount, source=self, rate=Decimal(rate))


@dataclass(frozen=True, slots=True)
class Converted:
    """The result of a conversion: the amount, and how it was arrived at."""

    amount: Money
    source: Money
    rate: Decimal

    def __str__(self) -> str:
        return f"{self.source} -> {self.amount} at {self.rate}"
