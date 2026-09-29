"""Reading the files, and refusing to read them badly.

The whole level turns on one idea: **the data is cleaned once, here, and every
number downstream is computed from the cleaned frame.** The spreadsheet version
of this pack had the sign rule in one column and the text-amount fix in another,
and that was already the most fragile part of it. In a script the same rules are
functions with tests, which is the only real argument for doing this in Python.

Three rules, applied in this order:

1. **Amounts become numbers.** The export writes one cost as `180,000.00` and one
   credit as `(700,200.00)`: brackets are a minus sign, commas are decoration.
   pandas reads both as text, and a text column in a `sum()` is silently skipped
   rather than raising, which is the dangerous half.
2. **Labels are trimmed.** One account name carries a trailing space, so grouping
   by name produces two accounts with the same name, one of which has a single
   row in it.
3. **Duplicate journals are removed, and counted.** The export contains one
   journal twice, worth 590,000. Dropping it quietly would be its own kind of
   dishonest, so the count is returned and the pack prints it.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import pandas as pd

DATA = Path(__file__).resolve().parents[4] / "data"

# Which account codes roll into which line of the pack, and which side of the
# profit and loss they sit on. One table, the same idea as the mapping tab in
# the spreadsheet, and the only place the shape of the pack is written down.
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

PACK_ORDER = ["Transaction fees", "Subscription fees", "FX markup",
              "Scheme and interchange", "Cloud hosting",
              "Salaries", "Marketing programmes", "Facilities and admin"]


@dataclass(frozen=True, slots=True)
class LoadReport:
    """What had to be fixed on the way in, so the pack can say so."""
    rows: int
    duplicates_removed: int
    text_amounts_repaired: int
    labels_trimmed: int

    def __str__(self) -> str:
        plural = lambda n, word: f"{n} {word}" + ("" if n == 1 else "s")
        return (f"{self.rows:,} ledger rows, "
                f"{plural(self.duplicates_removed, 'duplicate journal')} removed, "
                f"{plural(self.text_amounts_repaired, 'text amount')} repaired, "
                f"{plural(self.labels_trimmed, 'label')} trimmed")


def to_number(value) -> float:
    """`(700,200.00)` is negative seven hundred thousand two hundred.

    Accounting brackets, thousands separators, and the occasional stray space.
    Written as a function rather than inline because it is the one piece of this
    file that is genuinely easy to get subtly wrong, and therefore the one piece
    that most needs a test.
    """
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip().replace(",", "")
    if text.startswith("(") and text.endswith(")"):
        return -float(text[1:-1])
    return float(text)


def load_actuals(path: Path | str | None = None) -> tuple[pd.DataFrame, LoadReport]:
    """The general ledger, cleaned once, with a report of what was cleaned."""
    frame = pd.read_csv(path or DATA / "fpa-actuals.csv", dtype={"account_code": str})

    # One text value anywhere makes the whole column an object, so counting
    # "values that are not numbers" would count all 318 rows. What matters is
    # how many a plain conversion would have thrown away, which is what
    # `to_numeric(errors="coerce")` measures: those are the rows a naive sum
    # would silently skip.
    text_amounts = int(pd.to_numeric(frame["amount"], errors="coerce").isna().sum())
    frame["amount"] = frame["amount"].map(to_number)

    trimmed = int((frame["account_name"] != frame["account_name"].str.strip()).sum())
    for column in ["account_name", "cost_centre", "cost_centre_name", "line_type"]:
        frame[column] = frame[column].str.strip()

    before = len(frame)
    frame = frame.drop_duplicates(subset="journal_id", keep="first").reset_index(drop=True)
    duplicates = before - len(frame)

    # The sign rule, applied exactly once: revenue is a credit in the export and
    # a positive number in every report a human reads.
    frame["value"] = frame["amount"].where(frame["line_type"] != "revenue", -frame["amount"])
    frame["pack_line"] = frame["account_code"].map(lambda c: MAPPING[c][0])
    frame["group"] = frame["account_code"].map(lambda c: MAPPING[c][1])

    return frame, LoadReport(len(frame), duplicates, text_amounts, trimmed)


def load_budget(path: Path | str | None = None) -> pd.DataFrame:
    """The plan. Positive everywhere, whole dollars, and its own account names.

    The names are dropped on purpose. The plan calls 5100 `Hosting` and the
    ledger calls it `Cloud hosting`, so the join is on `account_code` and the
    label comes from the mapping table rather than from either file.
    """
    frame = pd.read_csv(path or DATA / "fpa-budget.csv", dtype={"account_code": str})
    frame["budget_amount"] = frame["budget_amount"].map(to_number)
    frame["pack_line"] = frame["account_code"].map(lambda c: MAPPING[c][0])
    frame["group"] = frame["account_code"].map(lambda c: MAPPING[c][1])
    return frame


def load_history(path: Path | str | None = None) -> pd.DataFrame:
    return pd.read_csv(path or DATA / "fpa-history.csv")


def load_plan_drivers(path: Path | str | None = None) -> pd.DataFrame:
    return pd.read_csv(path or DATA / "fpa-plan-drivers.csv")
