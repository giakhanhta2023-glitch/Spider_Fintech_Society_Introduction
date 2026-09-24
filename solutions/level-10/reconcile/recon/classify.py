"""Turning match results into breaks with a type, a value and an owner.

The type that earns its place is `pending_settlement`, which is explicitly not
a break. A capture from this morning has not settled because it is this
morning, and reporting it as a break trains everybody to ignore the report.
Distinguishing "wrong" from "not finished yet" is most of what makes a
reconciliation usable by a person.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import date, timedelta

from .config import DEFAULT, Config
from .load import Movement
from .match import MatchResult


@dataclass(frozen=True, slots=True)
class Break:
    break_id: str
    type: str
    key: str
    kind: str
    value_minor: int      # what is at stake, signed as the money is
    owner: str
    detail: str
    when: date

    @property
    def is_break(self) -> bool:
        return self.type != "pending_settlement"


def break_id(break_type: str, key: str, kind: str) -> str:
    """Stable across runs, so the same problem keeps the same id.

    Derived from what the break IS rather than from when it was found. A break
    id that changes between runs produces a new ticket every night for the same
    problem, and the aging report becomes meaningless.
    """
    return hashlib.sha256(f"{break_type}|{key}|{kind}".encode()).hexdigest()[:16]


def classify(
    result: MatchResult,
    as_of: date,
    config: Config = DEFAULT,
) -> list[Break]:
    breaks: list[Break] = []

    def add(break_type: str, m: Movement, value: int, detail: str) -> None:
        breaks.append(
            Break(
                break_id=break_id(break_type, m.key, m.kind),
                type=break_type,
                key=m.key,
                kind=m.kind,
                value_minor=value,
                owner=config.owners.get(break_type, "unassigned"),
                detail=detail,
                when=m.when,
            )
        )

    # Matched, but not equal.
    for match in result.matches:
        if match.pass_name == "exact":
            continue
        if match.pass_name == "converted":
            add(
                "currency_rounding",
                match.settlement,
                match.difference_minor,
                f"{match.reason}; ours {match.ledger.amount_minor}, "
                f"theirs {match.settlement.amount_minor}",
            )
        elif abs(match.difference_minor) > config.amount_tolerance_minor:
            add(
                "amount_mismatch",
                match.settlement,
                match.difference_minor,
                f"ours {match.ledger.amount_minor}, theirs {match.settlement.amount_minor}",
            )

    # They sent it twice.
    for line in result.duplicates:
        add(
            "duplicate_settlement",
            line,
            line.amount_minor,
            f"settlement line {line.line_id} repeats a movement already settled",
        )

    # In their file, not in ours. Money we cannot account for.
    for line in result.unmatched_settlement:
        add(
            "missing_in_ledger",
            line,
            line.amount_minor,
            f"settlement line {line.line_id} names a movement we have no record of",
        )

    # In ours, not in theirs. Either not settled yet, or lost.
    cutoff = as_of - timedelta(days=config.settlement_window_days)
    for movement in result.unmatched_ledger:
        pending = movement.when > cutoff
        add(
            "pending_settlement" if pending else "unsettled_capture",
            movement,
            movement.amount_minor,
            (
                f"captured {movement.when}, inside the "
                f"{config.settlement_window_days} day window"
                if pending
                else f"captured {movement.when}, still unsettled "
                f"{(as_of - movement.when).days} days later"
            ),
        )

    return breaks
