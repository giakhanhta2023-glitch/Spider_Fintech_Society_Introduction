"""Write the September pack as a real workbook, with live formulas.

    python build_workbook.py            # writes september-pack.xlsx
    python build_workbook.py --month 2025-08

Level 1 is a spreadsheet level, so the deliverable is a spreadsheet. This script
builds it the way it should have been built by hand: raw imports untouched, one
calculations tab where the sign is normalised exactly once, a mapping tab, and a
pack whose every number is a `SUMIFS` rather than a pasted value.

**Nothing in the pack tab is typed.** The month lives in one cell, the
materiality threshold in another, and everything else is a formula referring to
them. `check_workbook.py` opens the file afterwards and asserts that, because a
claim that a model is formula driven is worth exactly as much as the thing that
checks it.

One honest limitation, which `README.md` repeats: no spreadsheet engine on this
machine evaluates the formulas. openpyxl writes them and Excel or Sheets computes
them on open. So the values are proved a second way, in Python, by
`expected.py`, and the two are compared by eye at the top of the README rather
than by a machine.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from openpyxl import Workbook
from openpyxl.formatting.rule import CellIsRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

import csv

HERE = Path(__file__).resolve().parent
DATA = HERE.parents[2] / "data"

MAPPING = [
    ("4000", "Transaction fees", "revenue"),
    ("4100", "Subscription fees", "revenue"),
    ("4200", "FX markup", "revenue"),
    ("5000", "Scheme and interchange", "cogs"),
    ("5100", "Cloud hosting", "cogs"),
    ("6000", "Salaries", "opex"),
    ("6100", "Marketing programmes", "opex"),
    ("6200", "Facilities and admin", "opex"),
    ("7000", "Depreciation", "below"),
    ("8000", "Interest", "below"),
    ("9000", "Tax", "below"),
]

HEADING = Font(bold=True)
MONEY = "#,##0"
PERCENT = "0.0%"
RULE = Border(top=Side(style="thin"))


def read_csv(name: str) -> list[list[str]]:
    with (DATA / name).open(encoding="utf-8") as fh:
        return list(csv.reader(fh))


def raw_sheet(book: Workbook, title: str, rows: list[list[str]]):
    """A raw import, written exactly as the file has it and never edited."""
    sheet = book.create_sheet(title)
    for row in rows:
        sheet.append(row)
    for cell in sheet[1]:
        cell.font = HEADING
    sheet.freeze_panes = "A2"
    return sheet


def build(month: str = "2025-09", path: Path | None = None) -> Path:
    actuals = read_csv("fpa-actuals.csv")
    budget = read_csv("fpa-budget.csv")

    book = Workbook()
    book.remove(book.active)

    ledger = raw_sheet(book, "actuals", actuals)
    plan = raw_sheet(book, "budget", budget)
    last_ledger = len(actuals)
    last_plan = len(budget)

    # ------------------------------------------------------------- quality
    quality = book.create_sheet("quality")
    quality["A1"] = "What is wrong with the export, before any analysis"
    quality["A1"].font = HEADING
    checks = [
        ("rows", f"=COUNTA(actuals!A2:A{last_ledger})", 318),
        ("distinct journal ids", f"=SUMPRODUCT(1/COUNTIF(actuals!A2:A{last_ledger},"
                                f"actuals!A2:A{last_ledger}))", 317),
        ("amounts that are not numbers",
         f"=SUMPRODUCT(--NOT(ISNUMBER(actuals!H2:H{last_ledger})))", 2),
        ("labels with untrimmed spaces",
         f"=SUMPRODUCT(--(TRIM(actuals!F2:F{last_ledger})<>actuals!F2:F{last_ledger}))", 1),
    ]
    for index, (label, formula, expected) in enumerate(checks, start=3):
        quality[f"A{index}"] = label
        quality[f"B{index}"] = formula
        quality[f"C{index}"] = f"expected {expected}"
    quality["A8"] = ("The duplicate is JE000261, 590,000 of engineering payroll in 2025-06. "
                     "It is excluded from the pack by the SUMIFS below, which counts each "
                     "journal once, and it has been reported to the accountant.")
    quality["A8"].alignment = Alignment(wrap_text=True, vertical="top")
    quality.column_dimensions["A"].width = 46
    quality.column_dimensions["B"].width = 16

    # --------------------------------------------------------------- map
    mapping = book.create_sheet("map")
    mapping.append(["account_code", "pack_line", "group"])
    for row in MAPPING:
        mapping.append(list(row))
    for cell in mapping[1]:
        cell.font = HEADING
    mapping.column_dimensions["B"].width = 24

    # -------------------------------------------------------------- calc
    # One row per ledger row: the amount as a number, the sign normalised, and
    # the pack line it belongs to. This is the only place any of that happens.
    calc = book.create_sheet("calc")
    calc.append(["journal_id", "month", "account_code", "value", "pack_line", "first_time",
                 "group"])
    for cell in calc[1]:
        cell.font = HEADING
    for row in range(2, last_ledger + 1):
        calc.append([
            f"=actuals!A{row}",
            f"=actuals!B{row}",
            f"=actuals!E{row}",
            # The sign rule and the text repair, together, once.
            f'=IF(actuals!G{row}="revenue",-1,1)*IFERROR(actuals!H{row},'
            f'VALUE(SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(actuals!H{row},"(","-"),")",""),",","")))',
            f"=INDEX(map!$B$2:$B${len(MAPPING) + 1},MATCH(actuals!E{row},"
            f"map!$A$2:$A${len(MAPPING) + 1},0))",
            # 1 for the first appearance of a journal id, 0 for a repeat, so the
            # duplicate is excluded without deleting anything.
            f"=IF(COUNTIF($A$2:$A{row},actuals!A{row})=1,1,0)",
            f"=INDEX(map!$C$2:$C${len(MAPPING) + 1},MATCH(actuals!E{row},"
            f"map!$A$2:$A${len(MAPPING) + 1},0))",
        ])
    calc.column_dimensions["E"].width = 24

    # -------------------------------------------------------------- pack
    pack = book.create_sheet("pack", 0)
    pack["A1"] = "Meridian Pay, management pack"
    pack["A1"].font = Font(bold=True, size=14)
    pack["A2"] = "month"
    pack["B2"] = month
    pack["B2"].font = HEADING
    pack["A3"] = "materiality"
    pack["B3"] = 25000
    pack["B3"].number_format = MONEY

    header = ["line", "actual", "budget", "variance", "variance %"]
    pack.append([])
    pack.append(header)
    header_row = pack.max_row
    for cell in pack[header_row]:
        cell.font = HEADING

    first = header_row + 1
    lines = [(code, name, group) for code, name, group in MAPPING if group != "below"]
    for offset, (code, name, group) in enumerate(lines):
        row = first + offset
        pack[f"A{row}"] = name
        pack[f"B{row}"] = (f"=SUMIFS(calc!$D:$D,calc!$B:$B,$B$2,calc!$E:$E,$A{row},"
                           f"calc!$F:$F,1)")
        pack[f"C{row}"] = (f"=SUMIFS(budget!$F:$F,budget!$A:$A,$B$2,budget!$D:$D,"
                           f"INDEX(map!$A$2:$A${len(MAPPING) + 1},MATCH($A{row},"
                           f"map!$B$2:$B${len(MAPPING) + 1},0)))")
        # Positive is favourable to profit: revenue up, cost down.
        pack[f"D{row}"] = (f'=IF(INDEX(map!$C$2:$C${len(MAPPING) + 1},MATCH($A{row},'
                           f'map!$B$2:$B${len(MAPPING) + 1},0))="revenue",B{row}-C{row},'
                           f'C{row}-B{row})')
        pack[f"E{row}"] = f"=IFERROR((B{row}-C{row})/C{row},\"\")"
    last = first + len(lines) - 1

    revenue_rows = [first + i for i, (_, _, g) in enumerate(lines) if g == "revenue"]
    cogs_rows = [first + i for i, (_, _, g) in enumerate(lines) if g == "cogs"]
    opex_rows = [first + i for i, (_, _, g) in enumerate(lines) if g == "opex"]
    span = lambda column, rows: "+".join(f"{column}{r}" for r in rows)

    totals = [
        ("Revenue", span("B", revenue_rows), span("C", revenue_rows), "revenue"),
        ("Cost of sales", span("B", cogs_rows), span("C", cogs_rows), "cost"),
        ("Gross profit", None, None, "revenue"),
        ("Operating expenses", span("B", opex_rows), span("C", opex_rows), "cost"),
        ("EBITDA", None, None, "revenue"),
    ]
    row = last + 2
    total_rows: dict[str, int] = {}
    for label, actual, plan_formula, sense in totals:
        pack[f"A{row}"] = label
        if label == "Gross profit":
            pack[f"B{row}"] = f"=B{total_rows['Revenue']}-B{total_rows['Cost of sales']}"
            pack[f"C{row}"] = f"=C{total_rows['Revenue']}-C{total_rows['Cost of sales']}"
        elif label == "EBITDA":
            pack[f"B{row}"] = f"=B{total_rows['Gross profit']}-B{total_rows['Operating expenses']}"
            pack[f"C{row}"] = f"=C{total_rows['Gross profit']}-C{total_rows['Operating expenses']}"
        else:
            pack[f"B{row}"] = f"={actual}"
            pack[f"C{row}"] = f"={plan_formula}"
        pack[f"D{row}"] = (f"=B{row}-C{row}" if sense == "revenue" else f"=C{row}-B{row}")
        pack[f"E{row}"] = f"=IFERROR((B{row}-C{row})/C{row},\"\")"
        for column in "ABCDE":
            pack[f"{column}{row}"].border = RULE
            pack[f"{column}{row}"].font = HEADING
        total_rows[label] = row
        row += 1

    pack[f"A{row}"] = "Gross margin"
    pack[f"B{row}"] = f"=B{total_rows['Gross profit']}/B{total_rows['Revenue']}"
    pack[f"C{row}"] = f"=C{total_rows['Gross profit']}/C{total_rows['Revenue']}"
    pack[f"B{row}"].number_format = PERCENT
    pack[f"C{row}"].number_format = PERCENT
    margin_row = row

    # The check cell: the pack against every ledger row for the month, built two
    # different ways so that a line missing from the layout shows up here.
    row += 2
    pack[f"A{row}"] = "check: pack against ledger"
    # The pack side adds up the lines in the layout. The ledger side adds up
    # every row in the month by its group, whatever the layout contains. So a
    # line that exists in the mapping and is missing from the pack, which is how
    # a report starts drifting, turns this cell red.
    by_group = (lambda name: f'SUMIFS(calc!$D:$D,calc!$B:$B,$B$2,calc!$F:$F,1,'
                             f'calc!$G:$G,"{name}")')
    pack[f"B{row}"] = (f"=ROUND((B{total_rows['Revenue']}-B{total_rows['Cost of sales']}"
                       f"-B{total_rows['Operating expenses']})"
                       f"-({by_group('revenue')}-{by_group('cogs')}-{by_group('opex')}),2)")
    pack[f"C{row}"] = "must be zero"
    pack.conditional_formatting.add(
        f"B{row}",
        CellIsRule(operator="notEqual", formula=["0"],
                   fill=PatternFill(start_color="FFC7CE", end_color="FFC7CE", fill_type="solid")))
    check_row = row

    for r in range(first, margin_row):
        for column in "BC":
            pack[f"{column}{r}"].number_format = MONEY
        pack[f"D{r}"].number_format = MONEY
        pack[f"E{r}"].number_format = PERCENT
    pack.column_dimensions["A"].width = 26
    for column in "BCDE":
        pack.column_dimensions[column].width = 14

    out = path or HERE / f"september-pack.xlsx"
    book.save(out)
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--month", default="2025-09")
    args = parser.parse_args()
    path = build(args.month)
    print(f"{path.name} written: pack, calc, map, quality, actuals, budget")
    print("   every number in the pack tab is a formula. check_workbook.py proves it.")


if __name__ == "__main__":
    main()
