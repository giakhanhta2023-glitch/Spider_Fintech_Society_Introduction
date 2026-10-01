"""The close, end to end.

    python -m close.run                    # September 2025
    python -m close.run --month 2025-08
    python -m close.run --quiet            # just the verdict and the timings

Raw files in, a pack somebody can read out, and a non zero exit code if any of
it is wrong. The six stages run in order, each is timed, and the first fatal
stage stops the rest: there is no point querying the revenue detail if the
ledger would not load.

What it writes into `out/`:

    close-2025-09.md     the pack: five numbers, what moved, the detail,
                         receivables, the reconciliation and the reforecast
    waterfall-2025-09.png  budget EBITDA to actual EBITDA, one bar per cause

The document has the numbers and leaves the causes as TODO, for the same reason
level 3 does: the explanation is the part a person is accountable for.
"""

from __future__ import annotations

import argparse
import time
from pathlib import Path

from . import stages
from .document import write_document

OUT = Path(__file__).resolve().parent.parent / "out"


def run(month: str = "2025-09", quiet: bool = False) -> tuple[int, list[stages.Stage]]:
    OUT.mkdir(exist_ok=True)
    database = OUT / "meridian.db"
    done: list[stages.Stage] = []
    started = time.perf_counter()

    plan = [
        ("load the data", lambda: stages.load_database(database)),
        ("check the data", lambda: stages.quality_gates(month)),
        ("build the pack", lambda: stages.variance_pack(month)),
        ("query the detail", lambda: stages.revenue_detail(database, month)),
        ("reconcile billing to the ledger", lambda: stages.reconcile(database)),
        ("reforecast", lambda: stages.reforecast()),
    ]

    stopped = False
    for name, call in plan:
        if stopped:
            skipped = stages.Stage(name)
            skipped.say("not run, because an earlier stage stopped the close")
            skipped.ok = False
            done.append(skipped)
            continue
        stage = call()
        done.append(stage)
        if stage.fatal:
            stopped = True

    elapsed = (time.perf_counter() - started) * 1000

    print(f"Meridian Pay, close for {month}\n")
    for stage in done:
        mark = "ok  " if stage.ok else ("STOP" if stage.fatal else "note")
        print(f"   [{mark}] {stage.name:<34}{stage.milliseconds:>8,.0f} ms")
        if not quiet:
            for line in stage.lines:
                print(f"           {line}")
    print(f"\n   {len(done)} stages, {elapsed:,.0f} ms")

    if stopped:
        print("   the close did not complete. Nothing was written.")
        return 1, done

    document = write_document(month, done, OUT)
    chart = stages.chart(done, OUT, month)
    print(f"   written: {document.name} and {chart.name}")
    notes = sum(1 for s in done if not s.ok and not s.fatal)
    if notes:
        print(f"   {notes} stage(s) need a sentence in the commentary before this goes out")
    return 0, done


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--month", default="2025-09")
    parser.add_argument("--quiet", action="store_true")
    args = parser.parse_args()
    code, _ = run(args.month, args.quiet)
    return code


if __name__ == "__main__":
    raise SystemExit(main())
