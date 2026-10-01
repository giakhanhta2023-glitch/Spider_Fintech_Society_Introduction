"""Build the database from the CSV files.

    python load.py            # writes meridian.db next to this file
    python load.py --check    # and prints what it loaded

Safe to run twice: the file is deleted and rebuilt, so nothing survives from a
previous run. A reporting database that accumulates state between loads is a
database where last month's bad row lives forever.

SQLite because it needs nothing installed. Every query in `queries.sql` runs
unchanged on PostgreSQL except the two that use `julianday`, which the file
marks with the PostgreSQL version next to them.
"""

from __future__ import annotations

import argparse
import sqlite3
from pathlib import Path

import pandas as pd

HERE = Path(__file__).resolve().parent
DATA = HERE.parents[2] / "data"
DATABASE = HERE / "meridian.db"

# account_code is text on purpose: read as a number, a code with a leading zero
# loses it and stops matching the other file.
TABLES = {
    "invoices": {},
    "customers": {},
    "actuals": {"account_code": str},
    "budget": {"account_code": str},
    "history": {},
    "plan_drivers": {},
}


def to_number(value):
    """`(700,200.00)` is negative seven hundred thousand two hundred.

    The ledger export writes one cost with a thousands comma and one credit in
    accounting brackets. Loaded as they are, SQLite stores them as text and
    `SUM` silently treats them as zero: the tie out query then reports April as
    700,200 out and there is no error anywhere to explain it. That is worth
    seeing once, and then fixing here at the boundary rather than in every
    query that touches the column.
    """
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip().replace(",", "")
    if text.startswith("(") and text.endswith(")"):
        return -float(text[1:-1])
    return float(text)


def build(database: Path = DATABASE) -> dict[str, int]:
    database.unlink(missing_ok=True)
    loaded: dict[str, int] = {}
    with sqlite3.connect(database) as connection:
        for table, dtypes in TABLES.items():
            frame = pd.read_csv(DATA / f"fpa-{table.replace('_', '-')}.csv", dtype=dtypes)
            if "amount" in frame.columns:
                frame["amount"] = frame["amount"].map(to_number)
            for column in ["account_name", "cost_centre_name"]:
                if column in frame.columns:
                    frame[column] = frame[column].str.strip()
            frame.to_sql(table, connection, index=False, if_exists="replace")
            loaded[table] = len(frame)

        # The two keys every join in the pack depends on. Checked here, once,
        # rather than assumed in ten queries.
        for table, key in [("invoices", "invoice_id"), ("customers", "customer_id")]:
            rows, distinct = connection.execute(
                f"SELECT COUNT(*), COUNT(DISTINCT {key}) FROM {table}").fetchone()
            if rows != distinct:
                raise ValueError(
                    f"{table}.{key} is not unique: {rows} rows, {distinct} distinct. "
                    f"Every join on it would multiply rows.")
    return loaded


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()

    loaded = build()
    print(f"{DATABASE.name} rebuilt")
    if args.check:
        for table, rows in loaded.items():
            print(f"   {table:<14}{rows:>7,} rows")
        print("   invoice_id and customer_id are both unique, so no join can multiply rows")


if __name__ == "__main__":
    main()
