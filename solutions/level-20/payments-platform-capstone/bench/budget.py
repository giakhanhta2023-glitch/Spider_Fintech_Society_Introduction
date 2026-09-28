"""What the hour cost, against the objectives written before it ran.

    python -m bench.budget                    # reads bench/report.json
    python -m bench.budget path/to/report.json

The level asks for the share of the monthly error budget the load test spends, and
this is the arithmetic, kept out of the bench itself so that it can be re-run
against a report that already exists rather than only by spending another hour.

The targets are level 16's, from `slo/OBJECTIVES.md`, which were written before any
of this was measured. That order matters: a budget calculated against a target
chosen after seeing the result is a description of the result.

    availability   99.9% of POST /payments return 2xx or 4xx, 30 days
    latency        99% of POST /payments inside 500 ms, 30 days
    freshness      99.5% of payouts reach a final state within 15 minutes

Two of the three can be computed from the report. The third cannot, and this file
says so rather than reporting a number that would flatter it.
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from pathlib import Path

WINDOW_DAYS = 30
WINDOW_SECONDS = WINDOW_DAYS * 24 * 60 * 60

# Level 16's multiwindow rules, quoted so the verdict is against a written
# threshold rather than against a feeling about the number.
FAST_BURN = 14.4
SLOW_BURN = 6.0


@dataclass(frozen=True, slots=True)
class Objective:
    name: str
    target: float          # 0.99 means 99% of events must be good
    bad_key: str           # the counter in the report that is a budget spend
    total_key: str

    @property
    def allowed(self) -> float:
        return 1.0 - self.target


OBJECTIVES = (
    Objective("availability: a payment request answered", 0.999, "refused", "offered"),
    Objective("latency: a payment inside 500 ms", 0.99, "slower_than_objective",
              "accepted"),
)


def assess(sustained: dict, objective: Objective) -> dict:
    """One objective's share of one window's budget.

    The share is the honest form of this number. A burn rate alone says how fast
    the budget is going; the share says how much of it this hour actually used,
    and the two together are what decides whether an hour of load testing was
    affordable.
    """
    bad = sustained[objective.bad_key]
    total = sustained[objective.total_key]
    seconds = sustained["seconds"]

    observed = bad / total if total else 0.0
    burn = observed / objective.allowed
    # The window holds this many events at the rate the run actually offered, so
    # the budget is in the same units as the thing being measured.
    events_in_window = (total / seconds) * WINDOW_SECONDS
    allowed_in_window = objective.allowed * events_in_window

    return {
        "objective": objective.name,
        "bad": bad,
        "total": total,
        "observed_fraction": observed,
        "allowed_fraction": objective.allowed,
        "burn_rate": burn,
        "budget_events_in_window": allowed_in_window,
        "budget_share_spent": bad / allowed_in_window if allowed_in_window else 0.0,
        "days_until_exhausted": WINDOW_DAYS / burn if burn else float("inf"),
        "alert": ("page, fast burn" if burn >= FAST_BURN else
                  "page, slow burn" if burn >= SLOW_BURN else
                  "no alert"),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("report", nargs="?", default="bench/report.json")
    args = parser.parse_args()

    path = Path(args.report)
    if not path.exists():
        raise SystemExit(f"no report at {path}. Run python -m bench.load first.")
    report = json.loads(path.read_text(encoding="utf-8"))
    sustained = report["sustained"]
    seconds = sustained["seconds"]
    share_of_window = seconds / WINDOW_SECONDS

    print(f"{path}: {seconds / 60:,.0f} minutes at "
          f"{sustained['offered_rps']:,.0f} payments a second offered, "
          f"against a {WINDOW_DAYS} day window\n")
    print(f"{'objective':<38}  {'bad':>7}  {'of':>9}  {'observed':>9}  "
          f"{'allowed':>8}  {'burn':>7}  {'budget':>8}")

    rows = [assess(sustained, objective) for objective in OBJECTIVES]
    for row in rows:
        print(f"{row['objective']:<38}  {row['bad']:>7,}  {row['total']:>9,}  "
              f"{row['observed_fraction'] * 100:>8.4f}%  "
              f"{row['allowed_fraction'] * 100:>7.3f}%  "
              f"{row['burn_rate']:>6.2f}x  "
              f"{row['budget_share_spent'] * 100:>7.4f}%")

    print(f"\n   the run is {share_of_window * 100:.3f}% of the window, so a burn "
          f"rate of 1.00x spends {share_of_window * 100:.3f}% of the budget.")
    for row in rows:
        if row["burn_rate"] == 0:
            print(f"   {row['objective']}: nothing spent.")
            continue
        print(f"   {row['objective']}: {row['alert']}, and at this rate the "
              f"{WINDOW_DAYS} day budget lasts "
              f"{row['days_until_exhausted']:,.0f} days.")

    # The third objective, and why there is no number for it.
    checks = report.get("reconciliation", {}).get("checks", {})
    not_final = (checks.get("payouts_unknown", 0) + checks.get("payouts_submitted", 0))
    print(f"\n   freshness (99.5% of payouts final within 15 minutes) is not "
          f"computed here: this run records no per payout age, only that "
          f"{not_final} payouts were not in a final state when it ended and the "
          f"outbox backlog was {checks.get('outbox_backlog', 0)}. The rate at "
          f"which the payout path falls behind is measured by "
          f"python -m bench.load --sweep instead.")

    return None


if __name__ == "__main__":
    sys.exit(main())
