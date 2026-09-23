# Changelog

This file follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
the version numbers follow [semantic versioning](https://semver.org/).

Because other people's code imports this package, the rule that matters here is
the one about breaking changes: anything that changes the answer a caller
already gets is a major version, even when it is a bug fix. A rounding change
is a breaking change.

## [Unreleased]

Nothing yet.

## [0.1.0] - 2025-01-02

First release.

### Added

- `Currency`, with the ISO 4217 exponent, for USD, EUR, GBP, JPY, VND and BHD.
- `Money`, holding integer minor units, with add, subtract, multiply by a whole
  number, negate, absolute value, the full set of comparisons, and two string
  forms: `str` for round-tripping and `format` for a person to read.
- `Money.parse`, which refuses more decimal places than the currency allows
  rather than rounding them away silently.
- `allocate`, by largest remainder, and `Money.allocate` returning `Money`.
- `Money.percentage` and `Money.convert`, both requiring an explicit rounding
  mode.
- `Converted`, which carries the rate a conversion used alongside its result.
- A frozen FX snapshot shipped inside the package, so conversion tests are
  reproducible.
- `CurrencyMismatch`, `InvalidAmount` and `UnknownCurrency`, all under one
  `MoneyError` base.
