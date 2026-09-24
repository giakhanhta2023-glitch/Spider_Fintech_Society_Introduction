"""The two checks that are not about matching: fees, and payouts.

Matching asks whether both sides agree a movement happened. These ask whether
the money attached to it is right, which is a different question and the one
that quietly costs a merchant the most.
"""

from __future__ import annotations

import csv
from collections import defaultdict
from dataclasses import dataclass
from datetime import date
from pathlib import Path

from .config import DEFAULT, Config
from .load import Movement


# ------------------------------------------------------------------- fees
@dataclass(frozen=True, slots=True)
class FeeDifference:
    key: str
    gross_minor: int
    charged_minor: int
    expected_minor: int
    currency: str
    note: str

    @property
    def difference_minor(self) -> int:
        return self.charged_minor - self.expected_minor


def check_fees(
    settlement: list[Movement], config: Config = DEFAULT
) -> list[FeeDifference]:
    """Recompute every capture fee and list the ones that differ.

    Only captures: refunds and chargebacks have their own fee rules, and
    applying the capture schedule to them produces noise rather than findings.
    """
    out = []
    for line in settlement:
        if line.kind != "capture":
            continue
        expected = config.fees.expected(line.amount_minor)
        if abs(line.fee_minor - expected) > config.fee_tolerance_minor:
            out.append(
                FeeDifference(
                    key=line.key,
                    gross_minor=line.amount_minor,
                    charged_minor=line.fee_minor,
                    expected_minor=expected,
                    currency=line.currency,
                    note=line.note,
                )
            )
    return out


# --------------------------------------------------------- effective rates
BANDS: tuple[tuple[int, int, str], ...] = (
    (0, 1_000, "under $10"),
    (1_000, 5_000, "$10 to $50"),
    (5_000, 20_000, "$50 to $200"),
    (20_000, 10**12, "over $200"),
)


@dataclass(frozen=True, slots=True)
class Band:
    label: str
    count: int
    gross_minor: int
    fee_minor: int

    @property
    def effective_rate(self) -> float:
        return self.fee_minor / self.gross_minor if self.gross_minor else 0.0


def effective_rates(settlement: list[Movement]) -> list[Band]:
    """What the fee actually costs, by payment size.

    The headline rate is 2.9% plus 30 cents. The 30 cents is the whole story:
    on a $5 coffee it is six percent on its own, and the table is how a
    merchant discovers that their small payments cost more than twice what
    they were quoted.
    """
    totals: dict[str, list[int]] = defaultdict(lambda: [0, 0, 0])
    for line in settlement:
        if line.kind != "capture":
            continue
        for low, high, label in BANDS:
            if low <= line.amount_minor < high:
                bucket = totals[label]
                bucket[0] += 1
                bucket[1] += line.amount_minor
                bucket[2] += line.fee_minor
                break
    return [
        Band(label, *totals[label]) for _, _, label in BANDS if label in totals
    ]


# ---------------------------------------------------------------- payouts
@dataclass(frozen=True, slots=True)
class PayoutCheck:
    payout_id: str
    paid_at: date
    stated_lines: int
    actual_lines: int
    stated_net_minor: int
    actual_net_minor: int

    @property
    def agrees(self) -> bool:
        return (
            self.stated_lines == self.actual_lines
            and self.stated_net_minor == self.actual_net_minor
        )

    @property
    def difference_minor(self) -> int:
        return self.stated_net_minor - self.actual_net_minor


def check_payouts(path: Path, settlement: list[Movement]) -> list[PayoutCheck]:
    """Every payout should equal the lines that settled that day.

    This is the check that catches a duplicated settlement line actually
    costing money: if the duplicate was included in the payout, the payout is
    larger than the lines justify and somebody was paid twice.
    """
    by_day: dict[date, list[Movement]] = defaultdict(list)
    for line in settlement:
        by_day[line.when].append(line)

    out = []
    with path.open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            day = date.fromisoformat(row["paid_at"])
            lines = by_day.get(day, [])
            out.append(
                PayoutCheck(
                    payout_id=row["payout_id"],
                    paid_at=day,
                    stated_lines=int(row["line_count"]),
                    actual_lines=len(lines),
                    stated_net_minor=int(row["net_minor"]),
                    actual_net_minor=sum(m.amount_minor - m.fee_minor for m in lines),
                )
            )
    return out
