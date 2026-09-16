"""
neobank.loaders: the ONLY module that touches a file or a network.

Everything above this layer receives DataFrames and dicts and never learns
where they came from. Paths are anchored to this file's own location rather
than the working directory, which is what stops "it works on my machine".
"""

import json
import os
from pathlib import Path

import pandas as pd

PACKAGE_ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = PACKAGE_ROOT.parent

# Look in this project first, then fall back to the shared course datasets,
# then honour an explicit override. All of it is synthetic data.
SEARCH_PATHS = [
    Path(os.environ.get("NEOBANK_DATA", "")) if os.environ.get("NEOBANK_DATA") else None,
    PROJECT_ROOT / "data",
    PROJECT_ROOT.parent.parent / "data",        # <repo>/data
]


class DataError(Exception):
    """Raised when a dataset is missing or does not have the expected shape."""


def _resolve(path, filename):
    """An explicit path must exist; otherwise fall back to the search paths."""
    if path is not None:
        path = Path(path)
        if not path.exists():
            raise DataError(f"no such data file: {path}")
        return path
    return _find(filename)


def _find(filename):
    for folder in SEARCH_PATHS:
        if folder and (folder / filename).exists():
            return folder / filename
    looked = ", ".join(str(f) for f in SEARCH_PATHS if f)
    raise DataError(f"missing data file '{filename}'. Looked in: {looked}. "
                    f"Run `python data/generate.py` to create it.")


def _require_columns(df, required, source):
    missing = set(required) - set(df.columns)
    if missing:
        raise DataError(f"{source} is missing columns: {sorted(missing)}")
    return df


def load_transactions(path=None):
    """Personal account history (Level 3)."""
    path = _resolve(path, "level-03-transactions.csv")
    df = pd.read_csv(path, parse_dates=["date"])
    _require_columns(df, {"date", "description", "category", "amount"}, path.name)
    df["abs_amount"] = df["amount"].abs()
    df["month"] = df["date"].dt.to_period("M")
    df["weekday"] = df["date"].dt.day_name()
    return df


def load_prices(path=None):
    """Daily prices for the investment club (Level 7)."""
    path = _resolve(path, "level-07-prices.csv")
    df = pd.read_csv(path, parse_dates=["date"]).set_index("date").sort_index()
    if df.empty:
        raise DataError(f"{path.name} has no rows")
    if df.isna().any().any():
        raise DataError(f"{path.name} contains gaps: fill or drop them before analysing")
    return df


def load_card_transactions(path=None):
    """Labelled card transactions for fraud scoring (Level 8)."""
    path = _resolve(path, "level-08-transactions.csv")
    df = pd.read_csv(path, parse_dates=["timestamp"])
    _require_columns(df, {"txn_id", "amount", "country", "card_present",
                          "txns_last_1h", "is_fraud"}, path.name)
    return df


def load_fx_snapshot(path=None):
    """Offline FX rates (Level 5)."""
    path = _resolve(path, "level-05-fx-snapshot.json")
    blob = json.loads(path.read_text(encoding="utf-8"))
    if "rates" not in blob or "base" not in blob:
        raise DataError(f"{path.name} is not a rates snapshot")
    return blob


def load_external_balances(path=None):
    """The statement the ledger is reconciled against (Level 10).

    Returns {account_id: balance_in_cents}.
    """
    path = _resolve(path, "external-balances.csv")
    df = pd.read_csv(path)
    _require_columns(df, {"account", "balance_cents"}, path.name)
    return dict(zip(df["account"], df["balance_cents"].astype(int)))
