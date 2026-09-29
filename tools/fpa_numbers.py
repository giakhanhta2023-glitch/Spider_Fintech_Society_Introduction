"""
Every number the analyst track quotes, recomputed from the data files.

    python tools/fpa_numbers.py

The analyst levels are full of figures: a variance pack, a price and volume
bridge, receivables ageing, cohort revenue. Each one is a claim, and a claim in
a curriculum has to survive the dataset being regenerated. This script prints
all of them from `data/fpa-*.csv`, so checking a level is reading two columns
side by side rather than trusting a memory of what the number used to be.

It prints rather than asserts, because the levels are prose: the job of
comparing is a person's. What it does assert is the internal consistency that
must hold whatever the data says, for example that the price and volume effects
add back to the variance they decompose.
"""

from __future__ import annotations

import csv
import sqlite3
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"
MONTH = "2025-09"
YTD = [f"2025-{m:02d}" for m in range(1, 10)]
AS_AT = "2025-10-05"          # the day the close pack is produced


def money(x: float) -> str:
    return f"{x:>14,.0f}"


def amount(text: str) -> float:
    """The ledger's own formatting: brackets for a credit, commas in the middle."""
    text = text.strip()
    if text.startswith("(") and text.endswith(")"):
        return -float(text[1:-1].replace(",", ""))
    return float(text.replace(",", ""))


def read(name: str) -> list[dict]:
    with (DATA / f"fpa-{name}.csv").open(encoding="utf-8") as fh:
        return list(csv.DictReader(fh))


def main() -> None:
    gl, budget = read("actuals"), read("budget")
    history = {r["month"]: r for r in read("history")}
    plan = {r["month"]: r for r in read("plan-drivers")}

    # ---------------------------------------------------------------- files
    seen, deduped = set(), []
    for row in gl:
        if row["journal_id"] in seen:
            continue
        seen.add(row["journal_id"])
        deduped.append(row)

    print("FILES")
    for name in ["actuals", "budget", "customers", "invoices", "headcount",
                 "plan-drivers", "history"]:
        print(f"   fpa-{name + '.csv':<22} {len(read(name)):>6} rows")
    print(f"   ledger rows after removing duplicates: {len(deduped)}")

    print("\nPLANTED, for the data quality tab")
    for row in gl:
        dirty = (row["account_name"] != row["account_name"].strip()
                 or "," in row["amount"] or "(" in row["amount"])
        if dirty or row["journal_id"] in (r["journal_id"] for r in gl[gl.index(row) + 1:]):
            print(f"   {row['journal_id']} {row['month']} {row['account_code']} "
                  f"'{row['account_name']}' {row['amount']}")

    # ------------------------------------------------------------- the pack
    def actual(month=MONTH, code=None, prefix=None, cc=None) -> float:
        total = 0.0
        for row in deduped:
            if row["month"] != month:
                continue
            if code and row["account_code"] != code:
                continue
            if prefix and not row["account_code"].startswith(prefix):
                continue
            if cc and row["cost_centre"] != cc:
                continue
            value = amount(row["amount"])
            total += -value if row["line_type"] == "revenue" else value
        return total

    def planned(month=MONTH, code=None, prefix=None, cc=None) -> float:
        total = 0.0
        for row in budget:
            if row["month"] != month:
                continue
            if code and row["account_code"] != code:
                continue
            if prefix and not row["account_code"].startswith(prefix):
                continue
            if cc and row["cost_centre"] != cc:
                continue
            total += float(row["budget_amount"])
        return total

    lines = [
        ("Transaction fees", dict(code="4000")), ("Subscription fees", dict(code="4100")),
        ("FX markup", dict(code="4200")), ("Revenue", dict(prefix="4")),
        ("Scheme and interchange", dict(code="5000")), ("Cloud hosting", dict(code="5100")),
        ("Cost of sales", dict(prefix="5")), ("Salaries", dict(code="6000")),
        ("Marketing programmes", dict(code="6100")), ("Facilities and admin", dict(code="6200")),
        ("Operating expenses", dict(prefix="6")),
    ]
    print(f"\nTHE PACK, {MONTH}")
    print(f"   {'line':<24}{'actual':>14}{'budget':>14}{'variance':>14}{'pct':>9}")
    for name, kw in lines:
        a, b = actual(**kw), planned(**kw)
        pct = f"{a / b - 1:+.1%}" if b else ""
        print(f"   {name:<24}{money(a)}{money(b)}{a - b:>+14,.0f}{pct:>9}")

    gross_a = actual(prefix="4") - actual(prefix="5")
    gross_b = planned(prefix="4") - planned(prefix="5")
    ebitda_a = gross_a - actual(prefix="6")
    ebitda_b = gross_b - planned(prefix="6")
    print(f"   {'Gross profit':<24}{money(gross_a)}{money(gross_b)}{gross_a - gross_b:>+14,.0f}")
    print(f"   {'Gross margin':<24}{gross_a / actual(prefix='4'):>13.1%}"
          f"{gross_b / planned(prefix='4'):>14.1%}")
    print(f"   {'EBITDA':<24}{money(ebitda_a)}{money(ebitda_b)}{ebitda_a - ebitda_b:>+14,.0f}"
          f"{ebitda_a / ebitda_b - 1:>+9.1%}")
    print(f"   support payroll  {actual(code='6000', cc='CC400'):,.0f} against "
          f"{planned(code='6000', cc='CC400'):,.0f}")
    print(f"   cost centre CC600  {actual(code='6000', cc='CC600'):,.0f} against "
          f"{planned(code='6000', cc='CC600'):,.0f}")
    print(f"   year to date revenue  {sum(actual(month=m, prefix='4') for m in YTD):,.0f} "
          f"against {sum(planned(month=m, prefix='4') for m in YTD):,.0f}")
    print(f"   August gross margin   "
          f"{float(history['2025-08']['gross_profit']) / float(history['2025-08']['revenue_total']):.1%}")

    # ------------------------------------------------------------ the bridge
    volume_a = float(history[MONTH]["payment_volume"])
    volume_p = float(plan[MONTH]["payment_volume"])
    rate_a = float(history[MONTH]["revenue_transaction"]) / volume_a
    rate_p = float(plan[MONTH]["take_rate"])
    volume_effect = (volume_a - volume_p) * rate_p
    rate_effect = (rate_a - rate_p) * volume_a
    reported = actual(code="4000") - planned(code="4000")

    print(f"\nPRICE AND VOLUME, {MONTH}")
    print(f"   volume    {volume_a:>16,.0f} against {volume_p:>16,.0f}  {volume_a / volume_p - 1:+.1%}")
    print(f"   take rate {rate_a * 100:>15.4f}% against {rate_p * 100:>15.4f}%  {rate_a / rate_p - 1:+.1%}")
    print(f"   volume effect {volume_effect:>+14,.0f}")
    print(f"   rate effect   {rate_effect:>+14,.0f}")
    print(f"   sum           {volume_effect + rate_effect:>+14,.0f}   reported {reported:>+14,.0f}")
    assert abs((volume_effect + rate_effect) - reported) < 2, (
        "the decomposition does not add back to the variance it decomposes")

    # -------------------------------------------------------------- the SQL
    con = sqlite3.connect(":memory:")
    con.execute("create table invoices (invoice_id text, customer_id text, month text, "
                "issued_date text, due_date text, paid_date text, status text, "
                "platform_fee real, transaction_fee real, fx_fee real, amount real)")
    con.execute("create table customers (customer_id text, name text, country text, "
                "currency text, segment text, signed_month text, churned_month text)")
    con.executemany("insert into invoices values (?,?,?,?,?,?,?,?,?,?,?)", [
        (r["invoice_id"], r["customer_id"], r["month"], r["issued_date"], r["due_date"],
         r["paid_date"] or None, r["status"], float(r["platform_fee"]),
         float(r["transaction_fee"]), float(r["fx_fee"]), float(r["amount"]))
        for r in read("invoices")])
    con.executemany("insert into customers values (?,?,?,?,?,?,?)", [
        (r["customer_id"], r["name"], r["country"], r["currency"], r["segment"],
         r["signed_month"], r["churned_month"] or None) for r in read("customers")])
    ask = lambda sql: con.execute(sql).fetchall()

    print("\nTHE QUERIES")
    print("   invoices, unique ids:", ask("select count(*), count(distinct invoice_id) from invoices")[0])
    print("   customers, billed, never billed:", ask(
        "select (select count(*) from customers), count(distinct customer_id), "
        "(select count(*) from customers) - count(distinct customer_id) from invoices")[0])
    print(f"   {MONTH} by revenue month:",
          ask(f"select round(sum(amount),0) from invoices where month='{MONTH}'")[0][0])
    print(f"   {MONTH} by issued_date:  ",
          ask(f"select round(sum(amount),0) from invoices where issued_date like '2025-09%'")[0][0])
    print("   by segment:")
    for row in ask(f"""select c.segment, count(*), round(sum(i.amount),0),
                       round(100.0*sum(i.amount)/(select sum(amount) from invoices
                       where month='{MONTH}'),1)
                       from invoices i join customers c using (customer_id)
                       where i.month='{MONTH}' group by 1 order by 3 desc"""):
        print(f"      {row[0]:<11}{row[1]:>5} invoices {row[2]:>12,.0f}  {row[3]:>5}%")
    print("   top merchants year to date:")
    for row in ask("""select c.name, round(sum(i.amount),0),
                      round(100.0*sum(i.amount)/(select sum(amount) from invoices
                      where month like '2025%'),1)
                      from invoices i join customers c using (customer_id)
                      where i.month like '2025%' group by c.customer_id, c.name
                      order by 2 desc limit 3"""):
        print(f"      {row[0]:<24}{row[1]:>12,.0f}  {row[2]}%")
    print("   cohorts in September:")
    for row in ask(f"""select substr(c.signed_month,1,4), count(*), round(sum(i.amount),0)
                       from invoices i join customers c using (customer_id)
                       where i.month='{MONTH}' group by 1 order by 1"""):
        print(f"      signed {row[0]}  {row[1]:>4} merchants {row[2]:>12,.0f}")
    print(f"   ageing at {AS_AT}:")
    for row in ask(f"""select case
                         when julianday('{AS_AT}') - julianday(due_date) <= 0  then '1 not yet due'
                         when julianday('{AS_AT}') - julianday(due_date) <= 30 then '2 up to 30 days'
                         when julianday('{AS_AT}') - julianday(due_date) <= 60 then '3 31 to 60 days'
                         else '4 over 60 days' end,
                       count(*), round(sum(amount),0)
                       from invoices where paid_date is null group by 1 order by 1"""):
        print(f"      {row[0]:<17}{row[1]:>5} invoices {row[2]:>12,.0f}")
    open_total = ask("select count(*), round(sum(amount),0) from invoices where paid_date is null")[0]
    print(f"      total            {open_total[0]:>5} invoices {open_total[1]:>12,.0f}")
    print(f"   paid invoices: {ask('select count(paid_date) from invoices')[0][0]}")
    print(f"   DSO at {MONTH}: {open_total[1] / ask(f'select sum(amount) from invoices where month=' + chr(39) + MONTH + chr(39))[0][0] * 30:.1f} days")
    print("   monthly revenue, year to date and month on month:")
    for row in ask("""select month, round(sum(amount),0),
                      round(sum(sum(amount)) over (order by month),0),
                      round(100.0*(sum(amount)-lag(sum(amount)) over (order by month))
                            / lag(sum(amount)) over (order by month),1)
                      from invoices where month like '2025%' group by month order by month"""):
        print(f"      {row[0]}  {row[1]:>12,.0f}  {row[2]:>13,.0f}  {str(row[3]) + '%':>7}")
    print("   average of averages against the true mean:",
          ask(f"""select round((select avg(a) from (select avg(i.amount) a from invoices i
              join customers c using (customer_id) where i.month='{MONTH}' group by c.segment)),0),
              round((select avg(amount) from invoices where month='{MONTH}'),0)""")[0])
    print("   the tie out, invoices against the ledger:")
    ledger_revenue: dict[str, float] = {}
    for row in deduped:
        if row["line_type"] == "revenue":
            ledger_revenue[row["month"]] = ledger_revenue.get(row["month"], 0) - amount(row["amount"])
    for month, total in sorted(ledger_revenue.items()):
        billed = ask(f"select coalesce(sum(amount),0) from invoices where month='{month}'")[0][0]
        if abs(billed - total) > 0.005:
            print(f"      {month}: invoices {billed:,.2f} against ledger {total:,.2f}, "
                  f"difference {billed - total:+,.2f}")

    print("\nevery figure above is computed from data/fpa-*.csv at this moment")


if __name__ == "__main__":
    main()
