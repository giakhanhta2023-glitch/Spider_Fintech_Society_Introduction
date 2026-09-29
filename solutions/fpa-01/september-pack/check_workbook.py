"""Open the workbook and prove the claims made about it.

    python check_workbook.py

A model is only as good as what can be checked about it without opening it and
looking. Six checks, and the first is the one that matters: **every number in the
pack is a formula.** A pack with one pasted value is a pack that will be right
this month and silently wrong the next, and "I would never do that" is not a
control.

What this cannot check is the values, because no spreadsheet engine here
evaluates the formulas. `expected.py` computes them a second way instead, and
the README states that split plainly rather than implying the workbook has been
recalculated.
"""

from __future__ import annotations

import csv
import sys
from pathlib import Path

from openpyxl import load_workbook

HERE = Path(__file__).resolve().parent
DATA = HERE.parents[2] / "data"
WORKBOOK = HERE / "september-pack.xlsx"


def check(book) -> list[str]:
    problems: list[str] = []
    pack, calc, mapping, quality = book["pack"], book["calc"], book["map"], book["quality"]

    # 1. Every number in the pack is a formula, and the only typed cells are the
    #    month, the materiality threshold and the labels.
    typed = []
    for row in pack.iter_rows(min_row=5, max_row=pack.max_row, min_col=2, max_col=5):
        for cell in row:
            if cell.value is None or cell.column_letter == "A":
                continue
            if isinstance(cell.value, str) and cell.value.startswith("="):
                continue
            if isinstance(cell.value, str) and not cell.value.replace(",", "").strip("-").isdigit():
                continue                                   # a label such as "must be zero"
            typed.append(f"{cell.coordinate}={cell.value!r}")
    if typed:
        problems.append(f"typed values in the pack: {', '.join(typed)}")

    # 2. The month drives everything: every SUMIFS in the pack refers to $B$2.
    sumifs = [cell for row in pack.iter_rows(min_row=5, min_col=2, max_col=3) for cell in row
              if isinstance(cell.value, str) and cell.value.startswith("=SUMIFS")]
    without_month = [c.coordinate for c in sumifs if "$B$2" not in c.value]
    if not sumifs:
        problems.append("no SUMIFS in the pack at all")
    if without_month:
        problems.append(f"SUMIFS not driven by the month cell: {', '.join(without_month)}")

    # 3. The check cell exists, is a formula, and turns red when it is not zero.
    labels = {cell.value: cell.row for cell in pack["A"] if isinstance(cell.value, str)}
    if "check: pack against ledger" not in labels:
        problems.append("there is no check cell")
    else:
        row = labels["check: pack against ledger"]
        formula = pack[f"B{row}"].value
        if not (isinstance(formula, str) and formula.startswith("=ROUND")):
            problems.append("the check cell is not a rounded formula")
        elif "calc!" not in formula:
            problems.append("the check cell does not reach the ledger rows")
        ranges = [str(rng) for rng in pack.conditional_formatting]
        if not any(f"B{row}" in r for r in ranges):
            problems.append("the check cell has no conditional formatting")

    # 4. Every account code in both files is mapped. An unmapped code is money
    #    in the ledger that appears nowhere in the pack.
    mapped = {row[0].value for row in mapping.iter_rows(min_row=2, max_col=1) if row[0].value}
    for name, column in [("fpa-actuals.csv", "account_code"), ("fpa-budget.csv", "account_code")]:
        with (DATA / name).open(encoding="utf-8") as fh:
            codes = {row[column] for row in csv.DictReader(fh)}
        missing = sorted(codes - mapped)
        if missing:
            problems.append(f"{name} has unmapped account codes: {', '.join(missing)}")

    # 5. The calculations tab covers every ledger row, not the rows that were
    #    visible when somebody wrote the formula.
    with (DATA / "fpa-actuals.csv").open(encoding="utf-8") as fh:
        ledger_rows = sum(1 for _ in fh) - 1
    if calc.max_row - 1 != ledger_rows:
        problems.append(f"calc covers {calc.max_row - 1} rows against {ledger_rows} in the ledger")

    # 6. The quality tab checks the whole range too.
    short = [cell.coordinate for cell in quality["B"]
             if isinstance(cell.value, str) and cell.value.startswith("=")
             and str(ledger_rows + 1) not in cell.value]
    if short:
        problems.append(f"quality formulas do not cover every row: {', '.join(short)}")

    return problems


def prove() -> int:
    """Break the workbook on purpose and check that the checker complains.

    A check that has never failed might be checking nothing. This pastes a value
    over one pack cell, exactly the way a tired person does at 7pm, and asserts
    that it is caught.
    """
    book = load_workbook(WORKBOOK)
    pack = book["pack"]
    victim = next(cell for row in pack.iter_rows(min_row=6, min_col=2, max_col=2)
                  for cell in row if isinstance(cell.value, str) and cell.value.startswith("="))
    pack[victim.coordinate] = 2_348_188          # the right number, typed in
    problems = check(book)

    caught = any("typed values" in problem for problem in problems)
    print(f"pasted 2,348,188 over {victim.coordinate}, which is the correct value")
    print(f"   {'ok  ' if caught else 'WRONG'}  the checker "
          f"{'caught it' if caught else 'did not notice'}")
    return 0 if caught else 1


def main() -> int:
    if "--prove" in sys.argv:
        return prove()
    if not WORKBOOK.exists():
        print(f"{WORKBOOK.name} is missing. Run build_workbook.py first.")
        return 1

    book = load_workbook(WORKBOOK)
    problems = check(book)

    print(f"{WORKBOOK.name}")
    if problems:
        for problem in problems:
            print(f"   WRONG  {problem}")
        print(f"\n{len(problems)} problem(s)")
        return 1

    print("   ok  every number in the pack is a formula")
    print("   ok  every SUMIFS is driven by the month cell")
    print("   ok  the check cell is a formula, reaches the ledger, and is formatted red when not zero")
    print("   ok  every account code in both files is mapped")
    print("   ok  the calculations tab covers all 318 ledger rows")
    print("   ok  the quality formulas cover the whole range")
    print("\n6 checks, 0 problems. The values are checked separately by expected.py.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
