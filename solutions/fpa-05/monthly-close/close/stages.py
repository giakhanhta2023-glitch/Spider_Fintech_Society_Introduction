"""The six stages of a close, each one able to stop the run.

    python -m close.run --month 2025-09

This is the assembly level: the spreadsheet from level 1, the queries from level
2, the script from level 3 and the model from level 4, joined into one command
that goes from raw files to a document somebody can read.

The parts that were separate are now dependent on each other, and that is the
whole exercise. The pack cannot be built if the ledger will not load. The
reconciliation cannot run without both the ledger and the billing detail. The
reforecast needs the closed month before it can start forecasting the next one.
So the pipeline is a list of stages, each with a name, a timing and a verdict,
and the first fatal verdict stops the rest.

The earlier levels are imported rather than copied. In a real repository they
would be one package, or three installed dependencies; here they are three
folders next door and `_earlier.py` puts them on the path, which is honest about
what it is doing rather than pretending the code appeared from nowhere.
"""

from __future__ import annotations

import sqlite3
import time
from dataclasses import dataclass, field
from pathlib import Path

import pandas as pd

from ._earlier import closepack_load, closepack_pack, model_drivers, model_forecast

DATA = Path(__file__).resolve().parents[4] / "data"
OUT = Path(__file__).resolve().parent.parent / "out"

TABLES = ["actuals", "budget", "invoices", "customers", "history", "plan-drivers"]


@dataclass
class Stage:
    name: str
    ok: bool = True
    fatal: bool = False
    milliseconds: float = 0.0
    lines: list[str] = field(default_factory=list)
    data: dict = field(default_factory=dict)

    def say(self, text: str) -> None:
        self.lines.append(text)

    def fail(self, text: str, fatal: bool = True) -> None:
        self.ok = False
        self.fatal = self.fatal or fatal
        self.lines.append(text)


def timed(function):
    """Every stage reports how long it took, because a close is a deadline."""
    def wrapper(*args, **kwargs) -> Stage:
        started = time.perf_counter()
        stage = function(*args, **kwargs)
        stage.milliseconds = (time.perf_counter() - started) * 1000
        return stage
    return wrapper


# --------------------------------------------------------------- stage one
@timed
def load_database(path: Path) -> Stage:
    """Every file into one SQLite database, rebuilt from scratch each run."""
    stage = Stage("load the data")
    path.unlink(missing_ok=True)
    connection = sqlite3.connect(path)
    for name in TABLES:
        frame = pd.read_csv(DATA / f"fpa-{name}.csv", dtype={"account_code": str})
        frame.to_sql(name.replace("-", "_"), connection, index=False, if_exists="replace")
        stage.say(f"{name:<14} {len(frame):>6,} rows")
    connection.commit()
    connection.close()
    stage.data["database"] = str(path)
    return stage


# --------------------------------------------------------------- stage two
@timed
def quality_gates(month: str) -> Stage:
    """What the loader had to repair, and whether anything is unrecoverable."""
    stage = Stage("check the data")
    frame, report = closepack_load.load_actuals(DATA / "fpa-actuals.csv")
    budget = closepack_load.load_budget(DATA / "fpa-budget.csv")
    stage.say(str(report))

    from closepack import checks as closepack_checks
    findings = closepack_checks.run(frame, budget, month, report.duplicates_removed)
    for finding in findings:
        stage.say(str(finding))
    if closepack_checks.fatal(findings):
        stage.fail(f"{len(closepack_checks.fatal(findings))} fatal finding(s): the close stops here")
    stage.data["repairs"] = report
    stage.data["findings"] = findings
    return stage


# ------------------------------------------------------------- stage three
@timed
def variance_pack(month: str) -> Stage:
    """The pack from level 3, with its own tie to the ledger."""
    stage = Stage("build the pack")
    pack = closepack_pack.build(month)
    if not pack.ties:
        stage.fail(f"the pack does not tie to the ledger: {pack.tie_difference:+,.2f}")
        return stage

    totals = pack.totals
    stage.say(f"revenue      {totals['revenue_actual']:>14,.0f} against "
              f"{totals['revenue_budget']:>14,.0f}")
    stage.say(f"gross profit {totals['gross_actual']:>14,.0f} against "
              f"{totals['gross_budget']:>14,.0f}")
    stage.say(f"EBITDA       {totals['ebitda_actual']:>14,.0f} against "
              f"{totals['ebitda_budget']:>14,.0f}")
    stage.say(f"tie to the ledger {pack.tie_difference:+,.2f}")
    stage.data["pack"] = pack
    return stage


# -------------------------------------------------------------- stage four
@timed
def revenue_detail(path: Path, month: str) -> Stage:
    """The questions the ledger cannot answer, from level 2's queries."""
    stage = Stage("query the detail")
    connection = sqlite3.connect(path)
    ask = lambda sql: pd.read_sql_query(sql, connection, params=[month])

    by_segment = ask("""
        SELECT c.segment, COUNT(*) AS invoices, SUM(i.amount) AS revenue
        FROM invoices i JOIN customers c ON c.customer_id = i.customer_id
        WHERE i.month = ? GROUP BY c.segment ORDER BY revenue DESC""")
    top = ask("""
        SELECT c.name, SUM(i.amount) AS revenue
        FROM invoices i JOIN customers c ON c.customer_id = i.customer_id
        WHERE i.month <= ? AND i.month LIKE '2025%'
        GROUP BY c.customer_id, c.name ORDER BY revenue DESC LIMIT 5""")
    # Named parameters, because this one needs the same date three times and
    # positional placeholders in a CASE expression are how a query starts
    # returning something nobody can explain.
    ageing = pd.read_sql_query("""
        SELECT CASE
                 WHEN julianday(:asat) - julianday(due_date) <= 0  THEN '1 not yet due'
                 WHEN julianday(:asat) - julianday(due_date) <= 30 THEN '2 up to 30 days'
                 WHEN julianday(:asat) - julianday(due_date) <= 60 THEN '3 31 to 60 days'
                 ELSE '4 over 60 days' END AS bucket,
               COUNT(*) AS invoices, SUM(amount) AS owed
        FROM invoices WHERE paid_date IS NULL GROUP BY bucket ORDER BY bucket""",
        connection, params={"asat": f"{month}-05"})

    connection.close()
    for _, row in by_segment.iterrows():
        stage.say(f"{row['segment']:<11} {int(row['invoices']):>4} invoices {row['revenue']:>14,.0f}")
    stage.say(f"largest merchant year to date: {top.iloc[0]['name']} at {top.iloc[0]['revenue']:,.0f}")
    stage.say(f"receivables {ageing['owed'].sum():>14,.0f} across "
              f"{int(ageing['invoices'].sum())} open invoices")
    stage.data.update(by_segment=by_segment, top=top, ageing=ageing)
    return stage


# -------------------------------------------------------------- stage five
@timed
def reconcile(path: Path) -> Stage:
    """The billing detail against the ledger, month by month.

    This is the check that needs two systems to agree, and the only one in the
    close that cannot be done inside either of them.
    """
    stage = Stage("reconcile billing to the ledger")
    connection = sqlite3.connect(path)
    billed = pd.read_sql_query(
        "SELECT month, ROUND(SUM(amount), 2) AS billed FROM invoices GROUP BY month", connection)
    connection.close()

    frame, _ = closepack_load.load_actuals(DATA / "fpa-actuals.csv")
    ledger = (frame[frame["group"] == "revenue"].groupby("month")["value"].sum()
              .round(2).rename("ledger").reset_index())

    joined = billed.merge(ledger, on="month", how="outer").fillna(0.0)
    joined["difference"] = (joined["billed"] - joined["ledger"]).round(2)
    breaks = joined[joined["difference"].abs() > 0.005]

    stage.say(f"{len(joined)} months compared")
    for _, row in breaks.iterrows():
        stage.say(f"{row['month']}: billing {row['billed']:,.2f} against ledger "
                  f"{row['ledger']:,.2f}, difference {row['difference']:+,.2f}")
    if breaks.empty:
        stage.say("no differences")
    else:
        # A break is not fatal to the close: it is a thing somebody has to own.
        stage.fail(f"{len(breaks)} month(s) do not agree, which goes in the commentary",
                   fatal=False)
    stage.data["breaks"] = breaks
    return stage


# --------------------------------------------------------------- stage six
@timed
def reforecast() -> Stage:
    """The model from level 4, run from the month that just closed."""
    stage = Stage("reforecast")
    cases = {}
    for assumptions in model_drivers.scenarios():
        forecast = model_forecast.run(assumptions)
        if not forecast.balances:
            stage.fail(f"the {assumptions.name} case does not balance")
            return stage
        year = [m for m in forecast.months if m.month.startswith("2026")]
        cases[assumptions.name] = {
            "revenue": sum(m.revenue for m in year),
            "ebitda": sum(m.ebitda for m in year),
            "peak_revolver": forecast.peak_revolver,
            "first_draw": next((m.month for m in forecast.months if m.revolver > 0), "never"),
            "passes": forecast.worst_pass_count,
        }
        stage.say(f"{assumptions.name:<9} FY2026 revenue {cases[assumptions.name]['revenue']/1e6:>5.1f}m, "
                  f"EBITDA {cases[assumptions.name]['ebitda']/1e6:>5.1f}m, "
                  f"revolver {cases[assumptions.name]['first_draw']}")
    stage.say("every scenario balances in every month")
    stage.data["cases"] = cases
    return stage


# ------------------------------------------------------------ the picture
def chart(done: list[Stage], out: Path, month: str) -> Path:
    """Level 3's waterfall, from the pack this run produced.

    Imported rather than rebuilt, for the same reason as everything else here:
    one implementation, one place to fix it.
    """
    from closepack.report import waterfall

    pack = next(s for s in done if s.name == "build the pack").data["pack"]
    return waterfall(pack, out / f"waterfall-{month}.png")
