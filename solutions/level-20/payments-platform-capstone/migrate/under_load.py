"""An expand and contract migration, performed while payments are arriving.

    python -m migrate.under_load

The level asks for zero failed requests during a schema change, and the only
honest way to report that number is to have traffic running while the change
happens. A migration timed on an idle database is a migration nobody has tested.

The six deploys from level 17, against the capstone's ledger:

    1. expand      add the new column, nullable. Old code unaffected
    2. write both  the application writes the old and the new representation
    3. backfill    in batches, resumable, while traffic continues
    4. read new    the application reads the new column
    5. stop old    the application stops writing the old one
    6. contract    drop the old column, days later

What is asserted here is what the level asks for: **zero failed requests across
all six**, and both code versions returning the same answer at step 4, which is
the step whose rollback has to be safe.

The store is a dictionary rather than Postgres, so this proves the *sequence* is
safe rather than that any particular `ALTER TABLE` is. Level 17 ran the same six
deploys against PostgreSQL 18.6 on 25,700 rows and recorded the locks and the
timings; this one runs them with traffic on top, which that one could not.
"""

from __future__ import annotations

import json
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path

from platform_.platform import Platform
from recon.daily import reconcile

FEE_BASIS_POINTS = 290


@dataclass
class Rows:
    """The table being migrated: fee as basis points, moving to fee as money.

    `columns` is the schema, so a read of a column that does not exist yet fails
    the way it would in a database rather than returning None quietly.
    """

    columns: set[str] = field(default_factory=lambda: {"amount_minor", "fee_bps"})
    rows: dict[str, dict] = field(default_factory=dict)
    lock: threading.Lock = field(default_factory=threading.Lock)

    def insert(self, payment_id: str, amount_minor: int, writes: dict) -> None:
        with self.lock:
            row = {"amount_minor": amount_minor}
            for column, value in writes.items():
                if column not in self.columns:
                    raise KeyError(f"no such column: {column}")
                row[column] = value
            self.rows[payment_id] = row

    def read(self, payment_id: str, column: str) -> int:
        if column not in self.columns:
            raise KeyError(f"no such column: {column}")
        return self.rows[payment_id][column]

    def add_column(self, column: str) -> None:
        with self.lock:
            self.columns.add(column)

    def drop_column(self, column: str) -> None:
        with self.lock:
            self.columns.discard(column)
            for row in self.rows.values():
                row.pop(column, None)

    def needing_backfill(self, column: str, limit: int) -> list[str]:
        with self.lock:
            return [
                payment_id for payment_id, row in self.rows.items()
                if row.get(column) is None
            ][:limit]


@dataclass
class Application:
    """The deployed code, one version at a time."""

    table: Rows
    writes_old: bool = True
    writes_new: bool = False
    reads_new: bool = False

    def record(self, payment_id: str, amount_minor: int) -> None:
        writes: dict[str, int] = {}
        if self.writes_old:
            writes["fee_bps"] = FEE_BASIS_POINTS
        if self.writes_new:
            writes["fee_minor"] = (amount_minor * FEE_BASIS_POINTS + 5_000) // 10_000
        self.table.insert(payment_id, amount_minor, writes)

    def fee(self, payment_id: str) -> int:
        if self.reads_new:
            return self.table.read(payment_id, "fee_minor")
        amount = self.table.read(payment_id, "amount_minor")
        return (amount * self.table.read(payment_id, "fee_bps") + 5_000) // 10_000


@dataclass
class Traffic:
    """Payments arriving throughout, in their own thread."""

    platform: Platform
    application: Application
    running: bool = True
    offered: int = 0
    failed: int = 0
    failures: list[str] = field(default_factory=list)
    _thread: threading.Thread | None = None

    def start(self, rps: float = 200.0) -> None:
        interval = 1.0 / rps

        def loop() -> None:
            while self.running:
                started = time.perf_counter()
                try:
                    response = self.platform.payment(1999 + self.offered % 700)
                    if response["status"] != 201:
                        self.failed += 1
                        self.failures.append(f"api {response['status']}")
                    else:
                        self.application.record(response["id"], response["amount_minor"])
                        # Read it straight back, because a migration that breaks
                        # reads is a migration that passed a write only test.
                        self.application.fee(response["id"])
                except Exception as exc:
                    self.failed += 1
                    self.failures.append(f"{type(exc).__name__}: {exc}")
                self.offered += 1
                elapsed = time.perf_counter() - started
                if elapsed < interval:
                    time.sleep(interval - elapsed)

        self._thread = threading.Thread(target=loop, daemon=True, name="traffic")
        self._thread.start()

    def stop(self) -> None:
        self.running = False
        if self._thread:
            self._thread.join(timeout=5)


def migrate(seconds_per_step: float = 1.0) -> dict:
    platform = Platform()
    platform.start()
    table = Rows()
    application = Application(table)
    traffic = Traffic(platform, application)
    traffic.start(rps=200)

    steps: list[dict] = []

    def step(name: str, action) -> None:
        started = time.perf_counter()
        failed_before = traffic.failed
        offered_before = traffic.offered
        action()
        time.sleep(seconds_per_step)       # traffic continues through the step
        steps.append({
            "step": name,
            "seconds": round(time.perf_counter() - started, 3),
            "requests_during": traffic.offered - offered_before,
            "failed_during": traffic.failed - failed_before,
        })

    time.sleep(seconds_per_step)           # traffic before anything changes

    step("1 expand: add fee_minor, nullable", lambda: table.add_column("fee_minor"))

    def write_both() -> None:
        application.writes_new = True
    step("2 code writes both columns", write_both)

    def backfill() -> None:
        # In batches, resumable, exactly as in level 17. The predicate is what
        # makes it restartable: rows where the new column is still missing.
        while True:
            batch = table.needing_backfill("fee_minor", limit=200)
            if not batch:
                break
            with table.lock:
                for payment_id in batch:
                    row = table.rows[payment_id]
                    row["fee_minor"] = (
                        row["amount_minor"] * row["fee_bps"] + 5_000
                    ) // 10_000
            time.sleep(0.01)               # between batches, so traffic gets the lock
    step("3 backfill in batches of 200", backfill)

    # The rollback proof: both code versions read the same rows and agree.
    with table.lock:
        sample = list(table.rows.items())[:500]
    disagreements = sum(
        1 for _, row in sample
        if (row["amount_minor"] * row["fee_bps"] + 5_000) // 10_000 != row["fee_minor"]
    )

    def read_new() -> None:
        application.reads_new = True
    step("4 code reads fee_minor", read_new)

    def stop_old() -> None:
        application.writes_old = False
    step("5 code stops writing fee_bps", stop_old)

    step("6 contract: drop fee_bps", lambda: table.drop_column("fee_bps"))

    traffic.stop()
    platform.stop()
    result = reconcile(platform)

    return {
        "steps": steps,
        "requests": traffic.offered,
        "failed": traffic.failed,
        "failures": traffic.failures[:5],
        "rows_migrated": len(table.rows),
        "disagreements_at_step_4": disagreements,
        "sampled_at_step_4": len(sample),
        "reconciliation_breaks": [str(b) for b in result.breaks],
    }


def main() -> None:
    outcome = migrate()

    print("expand and contract, under load\n")
    print(f"   {'step':38} {'seconds':>8} {'requests':>9} {'failed':>7}")
    for step in outcome["steps"]:
        print(f"   {step['step']:38} {step['seconds']:>8.2f} "
              f"{step['requests_during']:>9,} {step['failed_during']:>7}")

    print(f"\n   {outcome['requests']:,} requests during the migration, "
          f"{outcome['failed']} failed")
    print(f"   {outcome['rows_migrated']:,} rows migrated")
    print(f"   at step 4, both code versions agreed on "
          f"{outcome['sampled_at_step_4']} sampled rows "
          f"({outcome['disagreements_at_step_4']} disagreements)")
    print(f"   reconciliation: {len(outcome['reconciliation_breaks'])} break(s)")

    Path("migrate/report.json").write_text(json.dumps(outcome, indent=2), encoding="utf-8")
    print("\nwritten to migrate/report.json")

    if outcome["failed"] or outcome["disagreements_at_step_4"]:
        for failure in outcome["failures"]:
            print(f"   failure: {failure}")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
