"""The same pack, computed a second way, so the workbook has something to agree with.

    python expected.py
    python expected.py --month 2025-08

No spreadsheet engine on the machine this was written on evaluates the
workbook's formulas: openpyxl writes them and Excel or Sheets computes them when
somebody opens the file. So the formulas are checked for shape by
`check_workbook.py`, and the values are checked here, by computing the same pack
from the same two files with nothing but the standard library.

That is a weaker proof than opening the workbook and reading the cells, and it is
stated as such in the README. It is also the more useful habit: a number worth
publishing is a number you have arrived at twice, by two routes, and this is the
second route.
"""

from __future__ import annotations

import argparse
import csv
from pathlib import Path

DATA = Path(__file__).resolve().parents[3] / "data"

MAPPING = {
    "4000": ("Transaction fees", "revenue"),
    "4100": ("Subscription fees", "revenue"),
    "4200": ("FX markup", "revenue"),
    "5000": ("Scheme and interchange", "cogs"),
    "5100": ("Cloud hosting", "cogs"),
    "6000": ("Salaries", "opex"),
    "6100": ("Marketing programmes", "opex"),
    "6200": ("Facilities and admin", "opex"),
    "7000": ("Depreciation", "below"),
    "8000": ("Interest", "below"),
    "9000": ("Tax", "below"),
}

ORDER = [name for name, group in MAPPING.values() if group != "below"]


def to_number(text: str) -> float:
    """Accounting brackets are a minus sign, and commas are decoration."""
    text = text.strip().replace(",", "")
    if text.startswith("(") and text.endswith(")"):
        return -float(text[1:-1])
    return float(text)


def pack(month: str = "2025-09") -> dict:
    actual: dict[str, float] = {name: 0.0 for name in ORDER}
    budget: dict[str, float] = {name: 0.0 for name in ORDER}
    seen: set[str] = set()
    duplicates = 0

    with (DATA / "fpa-actuals.csv").open(encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            if row["journal_id"] in seen:
                duplicates += 1
                continue                      # count it once, and say so
            seen.add(row["journal_id"])
            if row["month"] != month:
                continue
            name, group = MAPPING[row["account_code"]]
            if group == "below":
                continue
            value = to_number(row["amount"])
            actual[name] += -value if row["line_type"] == "revenue" else value

    with (DATA / "fpa-budget.csv").open(encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            if row["month"] != month:
                continue
            name, group = MAPPING[row["account_code"]]
            if group == "below":
                continue
            budget[name] += to_number(row["budget_amount"])

    total = lambda source, group: sum(
        value for name, value in source.items() if MAPPING_BY_NAME[name] == group)

    revenue = total(actual, "revenue"), total(budget, "revenue")
    cogs = total(actual, "cogs"), total(budget, "cogs")
    opex = total(actual, "opex"), total(budget, "opex")
    gross = revenue[0] - cogs[0], revenue[1] - cogs[1]
    ebitda = gross[0] - opex[0], gross[1] - opex[1]

    return {
        "month": month, "lines": (actual, budget), "duplicates": duplicates,
        "revenue": revenue, "cogs": cogs, "opex": opex, "gross": gross, "ebitda": ebitda,
        "gross_margin": (gross[0] / revenue[0], gross[1] / revenue[1]),
    }


MAPPING_BY_NAME = {name: group for name, group in MAPPING.values()}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--month", default="2025-09")
    args = parser.parse_args()
    result = pack(args.month)
    actual, budget = result["lines"]

    print(f"Meridian Pay, {result['month']}, computed from the files\n")
    print(f"   {'line':<24}{'actual':>14}{'budget':>14}{'variance':>14}")
    for name in ORDER:
        sense = 1 if MAPPING_BY_NAME[name] == "revenue" else -1
        variance = sense * (actual[name] - budget[name])
        print(f"   {name:<24}{actual[name]:>14,.0f}{budget[name]:>14,.0f}{variance:>+14,.0f}")
    print()
    for label, key, sense in [("Revenue", "revenue", 1), ("Cost of sales", "cogs", -1),
                              ("Gross profit", "gross", 1), ("Operating expenses", "opex", -1),
                              ("EBITDA", "ebitda", 1)]:
        a, b = result[key]
        print(f"   {label:<24}{a:>14,.0f}{b:>14,.0f}{sense * (a - b):>+14,.0f}")
    print(f"   {'Gross margin':<24}{result['gross_margin'][0]:>13.1%}"
          f"{result['gross_margin'][1]:>14.1%}")
    print(f"\n   {result['duplicates']} duplicate journal excluded before totalling")


if __name__ == "__main__":
    main()
