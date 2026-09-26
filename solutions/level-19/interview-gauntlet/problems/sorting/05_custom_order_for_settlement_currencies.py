"""Sort settlement rows by a currency order somebody chose, not alphabetically.

Pattern: sorting with a lookup key
Time:    O(n log n)
Space:   O(n)
First instinct: a comparison function, which Python 3 removed in favour of keys.
  `functools.cmp_to_key` exists and is slower and harder to read than a dict
  lookup.
Outcome: solved directly.

Unknown currencies are the case to decide rather than to crash on. They go last,
in alphabetical order, because a new currency appearing in a settlement file is a
normal Tuesday and a KeyError in a nightly job is not.
"""

PREFERRED = ["USD", "EUR", "GBP", "JPY"]
ORDER = {currency: index for index, currency in enumerate(PREFERRED)}


def by_currency(rows: list[dict]) -> list[dict]:
    def key(row: dict) -> tuple[int, str, int]:
        currency = row["currency"]
        # Unknown currencies get a rank past the end of the list rather than an
        # exception, then sort alphabetically among themselves.
        rank = ORDER.get(currency, len(PREFERRED))
        return (rank, currency, -row["amount_minor"])

    return sorted(rows, key=key)


def test_preferred_order_is_respected():
    rows = [{"currency": c, "amount_minor": 1} for c in ["GBP", "USD", "JPY", "EUR"]]
    assert [r["currency"] for r in by_currency(rows)] == ["USD", "EUR", "GBP", "JPY"]


def test_unknown_currencies_go_last_alphabetically():
    rows = [{"currency": c, "amount_minor": 1} for c in ["ZAR", "USD", "AUD"]]
    assert [r["currency"] for r in by_currency(rows)] == ["USD", "AUD", "ZAR"]


def test_within_one_currency_the_largest_amount_is_first():
    rows = [{"currency": "USD", "amount_minor": a} for a in [100, 900, 500]]
    assert [r["amount_minor"] for r in by_currency(rows)] == [900, 500, 100]
