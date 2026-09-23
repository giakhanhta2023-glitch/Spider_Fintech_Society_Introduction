"""A shipped snapshot of rates, so conversion tests are reproducible.

Rates change every second in the real world, which makes them useless in a
test. This file is a frozen snapshot with a date on it, and the date is part
of the data so that nobody mistakes it for live pricing.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from decimal import Decimal
from functools import lru_cache
from importlib import resources

from .errors import UnknownCurrency


@dataclass(frozen=True, slots=True)
class Snapshot:
    """Rates against one base currency, as of one moment."""

    base: str
    as_of: str
    rates: dict[str, Decimal]

    def rate(self, code: str) -> Decimal:
        """Units of ``code`` per one unit of the base currency."""
        try:
            return self.rates[code.upper()]
        except KeyError:
            raise UnknownCurrency(
                f"no rate for {code!r} in the {self.as_of} snapshot"
            ) from None


@lru_cache(maxsize=1)
def snapshot() -> Snapshot:
    """The snapshot shipped inside the package."""
    text = resources.files("moneykit").joinpath("data/fx-snapshot.json").read_text("utf-8")
    raw = json.loads(text)
    return Snapshot(
        base=raw["base"],
        as_of=raw["as_of"],
        rates={k: Decimal(v) for k, v in raw["rates"].items()},
    )
