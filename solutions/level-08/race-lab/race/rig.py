"""N workers that genuinely start together.

The detail that makes or breaks this file: every worker opens its connection
BEFORE the barrier. If they connect after it, the first worker is already
committing while the eighth is still doing a TLS handshake, the window never
overlaps, and the naive mode passes. A test rig that cannot reproduce the bug
is worse than no test rig, because it produces confidence.
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field

import psycopg
from psycopg.rows import dict_row

from .modes import MODES, Outcome


@dataclass
class RunResult:
    mode: str
    workers: int
    outcomes: list[Outcome] = field(default_factory=list)
    wall_ms: float = 0.0
    starting_balance: int = 0
    final_balance: int = 0
    spend_each: int = 0

    @property
    def succeeded(self) -> int:
        return sum(1 for o in self.outcomes if o.succeeded)

    @property
    def retries(self) -> int:
        return sum(o.retries for o in self.outcomes)

    @property
    def expected_balance(self) -> int:
        return self.starting_balance - self.succeeded * self.spend_each

    @property
    def correct(self) -> bool:
        return self.final_balance == self.expected_balance and self.final_balance >= 0

    def report(self) -> str:
        verdict = "correct" if self.correct else "WRONG"
        return (
            f"{self.mode:14s} {self.workers} workers x {self.spend_each:,} "
            f"from {self.starting_balance:,}\n"
            f"  succeeded      {self.succeeded}\n"
            f"  retries        {self.retries}\n"
            f"  final balance  {self.final_balance:,}   "
            f"(expected {self.expected_balance:,})  {verdict}\n"
            f"  wall clock     {self.wall_ms:.0f} ms"
        )


def run(
    conninfo: str,
    mode: str,
    workers: int = 8,
    account_id: int = 1,
    spend_each: int = 1000,
    starting_balance: int = 10000,
) -> RunResult:
    from .setup import reset_account

    reset_account(conninfo, account_id, starting_balance)

    work = MODES[mode]
    barrier = threading.Barrier(workers)
    outcomes: list[Outcome] = []
    lock = threading.Lock()

    def worker() -> None:
        # Connect first. Then wait. Then go.
        with psycopg.connect(conninfo, row_factory=dict_row) as conn:
            barrier.wait()
            outcome = work(conn, account_id, spend_each)
        with lock:
            outcomes.append(outcome)

    threads = [threading.Thread(target=worker) for _ in range(workers)]
    started = time.perf_counter()
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    wall_ms = (time.perf_counter() - started) * 1000

    with psycopg.connect(conninfo, row_factory=dict_row) as conn, conn.cursor() as cur:
        cur.execute("select balance_minor from accounts where id = %s", (account_id,))
        row = cur.fetchone()
        assert row is not None
        final = int(row["balance_minor"])

    return RunResult(
        mode=mode,
        workers=workers,
        outcomes=outcomes,
        wall_ms=wall_ms,
        starting_balance=starting_balance,
        final_balance=final,
        spend_each=spend_each,
    )
