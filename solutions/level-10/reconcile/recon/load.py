"""Both sides, normalised into one shape.

The single most useful thing this file does is put the sign on. A refund is
money going back, so it is negative, on both sides, before anything compares
them. Without that, every refund and every chargeback shows up as a mismatch:
in the shipped data that is 771 false breaks out of 16,601, which would bury
the 30 real ones.

Everything else here is dull on purpose. Matching is hard enough without the
two sides disagreeing about what a column means.
"""

from __future__ import annotations

import csv
from dataclasses import dataclass
from datetime import date
from pathlib import Path

# Money out is negative, on both sides, always.
SIGN = {"capture": 1, "refund": -1, "chargeback": -1}


@dataclass(frozen=True, slots=True)
class Movement:
    """One thing that happened, from one side, in a shape both sides share."""

    key: str            # payment id: what the two sides agree to call it
    kind: str           # capture, refund, chargeback
    amount_minor: int   # signed
    when: date
    source: str         # 'ledger' or 'settlement'
    currency: str = "USD"
    fee_minor: int = 0
    line_id: str = ""
    note: str = ""

    @property
    def match_key(self) -> tuple[str, str]:
        return (self.key, self.kind)


def load_ledger(path: Path) -> list[Movement]:
    """Our side: the card events from level 9.

    Only the three events that move money. An authorisation is a hold and
    settles nothing, and including it here is the mistake that makes a
    reconciliation report thousands of missing settlements that were never
    coming.
    """
    out: list[Movement] = []
    with path.open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            kind = row["event"]
            if kind not in SIGN:
                continue
            out.append(
                Movement(
                    key=row["payment_id"],
                    kind=kind,
                    amount_minor=SIGN[kind] * int(row["amount_minor"]),
                    when=date.fromisoformat(row["at"][:10]),
                    source="ledger",
                    line_id=row["event_id"],
                )
            )
    return out


def load_settlement(path: Path) -> list[Movement]:
    """Their side. The file already carries the sign, so it is trusted and
    checked rather than re-derived: if a refund ever arrives positive, the
    assertion below is where you find out."""
    out: list[Movement] = []
    with path.open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            kind = row["type"]
            amount = int(row["gross_minor"])
            if SIGN[kind] * amount < 0:
                raise ValueError(
                    f"settlement line {row['settlement_id']} is a {kind} of {amount}: "
                    "the sign convention has changed and every comparison below is wrong"
                )
            out.append(
                Movement(
                    key=row["payment_id"],
                    kind=kind,
                    amount_minor=amount,
                    when=date.fromisoformat(row["settled_at"]),
                    source="settlement",
                    currency=row["currency"],
                    fee_minor=int(row["fee_minor"] or 0),
                    line_id=row["settlement_id"],
                    note=row.get("note", ""),
                )
            )
    return out
