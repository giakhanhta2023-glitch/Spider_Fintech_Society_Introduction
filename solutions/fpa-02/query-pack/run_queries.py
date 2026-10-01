"""Run every query in queries.sql, and optionally check the recorded answers.

    python run_queries.py
    python run_queries.py --verify
    python run_queries.py --only ageing --month 2025-08

`--verify` is the part worth having. Each query in the file records the answer it
gave at the September close; this checks the ones that can be checked mechanically
and exits non zero if a closed month has moved. A closed month moving is either a
restatement somebody forgot to mention or a bug in the load, and both are things
to find before the meeting rather than in it.
"""

from __future__ import annotations

import argparse
import re
import sqlite3
import sys
from pathlib import Path

import pandas as pd

from load import DATABASE, build

HERE = Path(__file__).resolve().parent
QUERIES = HERE / "queries.sql"

# What the pack said at the September 2025 close. Only the facts that should
# never move: a closed month's revenue, a count, a reconciliation difference.
EXPECTED = {
    "revenue_by_month": lambda f: (round(float(f.loc[f["month"] == "2025-09", "revenue"].iloc[0])) == 3_361_050,
                                   "September revenue is 3,361,050"),
    "revenue_by_segment": lambda f: (round(float(f.loc[f["segment"] == "enterprise", "revenue"].iloc[0])) == 1_565_293,
                                     "enterprise September revenue is 1,565,293"),
    "top_merchants": lambda f: (f["name"].iloc[0] == "Pennant Logistics"
                                and round(float(f["revenue_2025"].iloc[0])) == 609_752,
                                "the largest merchant is Pennant Logistics at 609,752"),
    "cohorts": lambda f: (round(float(f.loc[f["cohort"] == "2023", "revenue"].iloc[0])) == 1_936_813,
                          "the 2023 cohort is 1,936,813 of September revenue"),
    "never_billed": lambda f: (len(f) == 5, "five merchants have never been billed"),
    # The buckets are each rounded to the dollar, so their sum can be a dollar
    # away from the unrounded total. A tolerance here, and never on the tie out.
    "ageing": lambda f: (abs(float(f["owed"].sum()) - 6_329_912) <= 2 and int(f["invoices"].sum()) == 415,
                         "receivables are 6,329,912 across 415 open invoices"),
    "keys": lambda f: ((f["rows"] == f["ids"]).all(), "both keys are unique"),
    "tie_out": lambda f: (list(f.loc[f["difference"].abs() > 0.005, "month"]) == ["2025-06"]
                          and round(float(f.loc[f["month"] == "2025-06", "difference"].iloc[0]), 2) == -4820.00,
                          "only June 2025 differs, by -4,820.00"),
}


def parse(path: Path = QUERIES) -> dict[str, str]:
    """Split the file on `-- name:` markers, keeping the comments with each query."""
    text = path.read_text(encoding="utf-8")
    parts = re.split(r"^-- name:\s*(\w+)\s*$", text, flags=re.M)[1:]
    return {name: body.strip() for name, body in zip(parts[::2], parts[1::2])}


def run(connection, sql: str, month: str, as_at: str) -> pd.DataFrame:
    params = {}
    if ":month" in sql:
        params["month"] = month
    if ":as_at" in sql:
        params["as_at"] = as_at
    return pd.read_sql_query(sql, connection, params=params or None)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--verify", action="store_true")
    parser.add_argument("--only")
    parser.add_argument("--month", default="2025-09")
    parser.add_argument("--as-at", default="2025-10-05")
    args = parser.parse_args()

    if not DATABASE.exists():
        build()

    queries = parse()
    if args.only:
        if args.only not in queries:
            print(f"no query called {args.only}. There are: {', '.join(queries)}")
            return 1
        queries = {args.only: queries[args.only]}

    failures = 0
    with sqlite3.connect(DATABASE) as connection:
        for name, sql in queries.items():
            frame = run(connection, sql, args.month, args.as_at)
            print(f"\n{name}")
            print(frame.to_string(index=False, max_rows=12))

            if args.verify and name in EXPECTED:
                ok, description = EXPECTED[name](frame)
                print(f"   {'ok  ' if ok else 'WRONG'}  {description}")
                failures += 0 if ok else 1

    if args.verify:
        print(f"\n{len(EXPECTED)} recorded answers checked, {failures} wrong")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
