# moneykit

Exact money arithmetic for Python, with the rounding rule always visible at the
call site.

```python
from decimal import Decimal
from moneykit import Money, HALF_UP

price = Money.parse("19.99", "USD")
tax   = price.percentage(Decimal("0.0825"), HALF_UP)   # $1.65

price.allocate([1, 2, 3])          # 3.33, 6.66, 10.00 USD, summing to 19.99
Money.parse("1000", "JPY")         # 1,000 JPY, because the yen has no cents
Money.parse("19.999", "USD")       # InvalidAmount: USD has 2 decimal places
```

## Why it exists

Floating point cannot represent `0.1`, so `0.1 + 0.2` is `0.30000000000000004`
and a total built from prices is wrong by an amount nobody can predict. This
package holds every amount as an integer count of minor units (cents, yen,
fils) and never converts to a float anywhere.

Three decisions are worth knowing about before you use it:

- **The exponent lives on the currency.** Formatting, parsing and conversion all
  read it, so the yen has no decimal places and the Bahraini dinar has three,
  without any caller special-casing them.
- **Rounding is an argument, never a default.** `percentage` and `convert` both
  require a rounding mode. A hidden default is how two systems that agree on
  the arithmetic still disagree on the answer.
- **Splitting uses largest remainder.** `allocate` gives out the whole part of
  each share, then hands the leftover units to the largest fractional parts,
  breaking ties towards the earlier position. The parts always sum exactly to
  the total, including when the total is negative.

## Install

```bash
pip install -e ".[dev]"
```

## Test

```bash
pytest                 # 56 tests, doctests, and coverage gated at 95%
mypy --strict src tests
ruff check .
```

## Limitations

Read these before depending on it.

- **Six currencies**, in a hard-coded registry: USD, EUR, GBP, JPY, VND, BHD.
  Adding one is a line in `currency.py`, not a configuration file.
- **The FX snapshot is synthetic and frozen** at 2025-01-02. It exists so that
  conversion tests are reproducible. It is not pricing, and nothing in this
  package fetches a live rate.
- **No historical currency changes.** A currency's exponent is treated as fixed
  for all time, which is not true of every currency that has ever existed.
- **Multiplication is by whole numbers only.** Anything else needs a rounding
  rule, which is what `percentage` is for.
- **Not thread-safe by design, because it does not need to be.** Every value is
  frozen, so there is no shared mutable state to protect.

## Version

0.1.0. See CHANGELOG.md.
