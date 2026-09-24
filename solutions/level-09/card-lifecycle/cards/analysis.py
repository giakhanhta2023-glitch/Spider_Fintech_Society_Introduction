"""Reproduce the headline figures from the shipped week.

    python -m cards.analysis data/level-09-card-events.csv

The point of this file is that the numbers in the level are checkable. Run it
against the shipped CSV and it should print the same figures, to the digit. If
it does not, one of us is wrong, and finding out which is the exercise.
"""

from __future__ import annotations

import csv
import sys
from collections import Counter
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True, slots=True)
class WeekSummary:
    authorisations: int
    approved: int
    declined: int
    captured: int
    voided: int
    expired: int
    refunded: int
    charged_back: int

    authorised_minor: int
    captured_minor: int
    refunded_minor: int
    charged_back_minor: int

    @property
    def approval_rate(self) -> float:
        return self.approved / self.authorisations

    @property
    def capture_rate(self) -> float:
        return self.captured / self.approved

    @property
    def chargeback_rate(self) -> float:
        return self.charged_back / self.captured

    @property
    def net_minor(self) -> int:
        return self.captured_minor - self.refunded_minor - self.charged_back_minor

    @property
    def authorised_never_captured_minor(self) -> int:
        """Held against somebody's card and then released. Invisible in a
        revenue report, and the reason for the "pending charge" support
        tickets."""
        return self.authorised_minor - self.captured_minor


def summarise(path: Path) -> WeekSummary:
    events = Counter()
    results = Counter()
    money = Counter()

    with path.open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            event = row["event"]
            amount = int(row["amount_minor"] or 0)
            events[event] += 1
            results[(event, row["result"])] += 1
            if event == "authorize" and row["result"] == "approved":
                money["authorised"] += amount
            elif event in ("capture", "refund", "chargeback"):
                money[event] += amount

    return WeekSummary(
        authorisations=events["authorize"],
        approved=results[("authorize", "approved")],
        declined=results[("authorize", "declined")],
        captured=events["capture"],
        voided=events["void"],
        expired=events["expire"],
        refunded=events["refund"],
        charged_back=events["chargeback"],
        authorised_minor=money["authorised"],
        captured_minor=money["capture"],
        refunded_minor=money["refund"],
        charged_back_minor=money["chargeback"],
    )


def money(minor: int) -> str:
    return f"${minor / 100:,.2f}"


def main(argv: list[str]) -> int:
    path = Path(argv[1]) if len(argv) > 1 else Path("data/level-09-card-events.csv")
    if not path.exists():
        print(f"no such file: {path}")
        return 1

    s = summarise(path)

    print("the week, by count")
    print(f"  authorisations            {s.authorisations:>8,}")
    print(f"  approved                  {s.approved:>8,}   {s.approval_rate:7.2%}")
    print(f"  declined                  {s.declined:>8,}")
    print(f"  captured                  {s.captured:>8,}   "
          f"{s.capture_rate:7.2%} of approvals")
    print(f"  voided                    {s.voided:>8,}")
    print(f"  expired                   {s.expired:>8,}")
    print(f"  refunded                  {s.refunded:>8,}")
    print(f"  charged back              {s.charged_back:>8,}   "
          f"{s.chargeback_rate:7.3%} of captured")

    print("\nthe week, by money")
    print(f"  authorised                {money(s.authorised_minor):>16}")
    print(f"  captured                  {money(s.captured_minor):>16}")
    print(f"  refunded                  {money(s.refunded_minor):>16}")
    print(f"  charged back              {money(s.charged_back_minor):>16}")
    print(f"  net                       {money(s.net_minor):>16}")
    print(f"  authorised, never taken   {money(s.authorised_never_captured_minor):>16}")

    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
