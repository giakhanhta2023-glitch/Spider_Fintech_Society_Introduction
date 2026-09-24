"""The whole job.

    python -m recon --ledger data/level-09-card-events.csv \\
                    --settlement data/level-10-settlement.csv \\
                    --payouts data/level-10-payouts.csv

Exits non-zero when there is unexplained value, so it can sit in a schedule
and be noticed when it has something to say.
"""

from __future__ import annotations

import argparse
import sys
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

from .checks import check_fees, check_payouts, effective_rates
from .classify import classify
from .config import DEFAULT
from .load import load_ledger, load_settlement
from .match import reconcile
from .queue import ExceptionQueue


def money(minor: int) -> str:
    return f"${minor / 100:,.2f}"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="recon")
    parser.add_argument("--ledger", type=Path, default=Path("data/level-09-card-events.csv"))
    parser.add_argument("--settlement", type=Path, default=Path("data/level-10-settlement.csv"))
    parser.add_argument("--payouts", type=Path, default=Path("data/level-10-payouts.csv"))
    parser.add_argument("--queue", type=Path, default=Path("exceptions.json"))
    parser.add_argument("--as-of", type=date.fromisoformat, default=None)
    args = parser.parse_args(argv)

    ledger = load_ledger(args.ledger)
    settlement = load_settlement(args.settlement)
    as_of = args.as_of or max(m.when for m in settlement)

    result = reconcile(ledger, settlement)
    breaks = classify(result, as_of, DEFAULT)

    print(f"reconciliation as of {as_of}\n")
    print(f"  ledger movements      {len(ledger):>8,}")
    print(f"  settlement lines      {len(settlement):>8,}")

    passes = result.by_pass()
    print(f"\n  matched exactly       {passes['exact']:>8,}")
    print(f"  matched, converted    {passes['converted']:>8,}")
    print(f"  matched, amount off   {passes['amount_differs']:>8,}")
    matched_total = sum(passes.values())
    print(f"  match rate            {matched_total / len(ledger):>8.2%}")

    by_type: dict[str, list] = defaultdict(list)
    for b in breaks:
        by_type[b.type].append(b)

    print("\n  breaks by type")
    for break_type in sorted(by_type):
        items = by_type[break_type]
        value = sum(abs(b.value_minor) for b in items)
        marker = "      " if items[0].is_break else "  (ok)"
        print(
            f"   {marker} {break_type:22s} {len(items):>6,}  {money(value):>14}  "
            f"{items[0].owner}"
        )

    # The two checks that are not about matching.
    fee_differences = check_fees(settlement, DEFAULT)
    fee_value = sum(abs(f.difference_minor) for f in fee_differences)
    print(f"\n  fee lines that differ {len(fee_differences):>8,}  {money(fee_value):>14}")

    payouts = check_payouts(args.payouts, settlement)
    wrong = [p for p in payouts if not p.agrees]
    print(f"  payouts checked       {len(payouts):>8,}")
    print(f"  payouts that disagree {len(wrong):>8,}")
    for p in wrong[:5]:
        print(
            f"     {p.payout_id}  stated {money(p.stated_net_minor)} "
            f"against {money(p.actual_net_minor)} of lines  "
            f"({money(p.difference_minor)})"
        )

    print("\n  effective fee rate by payment size")
    for band in effective_rates(settlement):
        print(
            f"   {band.label:14s} {band.count:>6,} captures  "
            f"{money(band.gross_minor):>14}  fee {money(band.fee_minor):>11}  "
            f"{band.effective_rate:>7.2%}"
        )

    queue = ExceptionQueue(args.queue).load()
    counts = queue.apply(breaks, as_of)
    queue.save()

    print(
        f"\n  exception queue: {counts['new']} new, {counts['still_open']} still open, "
        f"{counts['auto_resolved']} resolved, {counts['reopened']} reopened"
    )
    for bucket, n in queue.aging(as_of).items():
        if n:
            print(f"     {bucket:14s} {n:>5,}")

    unexplained = sum(
        abs(b.value_minor) for b in breaks if b.is_break and b.type != "currency_rounding"
    )
    print(f"\n  unexplained value     {money(unexplained):>14}")

    # Non-zero when there is something to look at, so a schedule notices.
    return 1 if unexplained else 0


if __name__ == "__main__":
    sys.exit(main())
