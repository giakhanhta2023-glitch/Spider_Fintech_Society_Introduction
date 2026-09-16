"""
neobank.fx — currency conversion (from Level 5).

The rates come from loaders; this module only does the arithmetic and is
honest about which currencies it can and cannot handle.
"""


class UnknownCurrency(KeyError):
    """Raised when neither source quotes the currency asked for."""


def convert(amount, frm, to, rates, base="USD"):
    """Convert through the base currency. Handles frm == to and the base itself."""
    if frm == to:
        return amount
    table = dict(rates)
    table[base] = 1.0                     # feeds omit the base; it is 1 of itself
    if frm not in table:
        raise UnknownCurrency(f"no rate for {frm}")
    if to not in table:
        raise UnknownCurrency(f"no rate for {to}")
    return amount / table[frm] * table[to]


def value_holdings(holdings, rates, base="USD"):
    """[{asset, currency, units}] -> rows with value in the base currency.

    A currency nobody quotes is reported with a note, never dropped and never
    silently valued at zero.
    """
    rows = []
    for h in holdings:
        try:
            unit = convert(1, h["currency"], base, rates)
            value, note = h["units"] * unit, ""
        except UnknownCurrency as err:
            unit, value, note = 0.0, 0.0, str(err)
        rows.append({**h, "unit_value": unit, "value": round(value, 2), "note": note})
    total = sum(r["value"] for r in rows)
    for r in rows:
        r["weight"] = r["value"] / total if total else 0.0
    return sorted(rows, key=lambda r: r["value"], reverse=True)
