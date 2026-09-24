"""Matching in named passes, each recording why it matched.

Passes rather than one clever join, because a reconciliation has to be able to
answer "why is this line matched to that one" two months later, in front of an
auditor. A single query that produces the right pairs and cannot explain itself
is worth less than a slower one that can.

The order matters: strictest first. Once a line is matched it leaves the pool,
so a looser pass can never steal a line that an exact pass would have claimed.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass, field

from .load import Movement


@dataclass(frozen=True, slots=True)
class Match:
    ledger: Movement
    settlement: Movement
    pass_name: str
    reason: str
    difference_minor: int = 0


@dataclass
class MatchResult:
    matches: list[Match] = field(default_factory=list)
    unmatched_ledger: list[Movement] = field(default_factory=list)
    unmatched_settlement: list[Movement] = field(default_factory=list)
    duplicates: list[Movement] = field(default_factory=list)

    def by_pass(self) -> Counter:
        return Counter(m.pass_name for m in self.matches)


def reconcile(ledger: list[Movement], settlement: list[Movement]) -> MatchResult:
    result = MatchResult()

    by_key: dict[tuple[str, str], Movement] = {m.match_key: m for m in ledger}
    if len(by_key) != len(ledger):
        # Our own side having duplicates is a different and worse problem than
        # the processor's file having them, so it is not quietly absorbed.
        seen = Counter(m.match_key for m in ledger)
        raise ValueError(
            f"the ledger has duplicate movements: {[k for k, n in seen.items() if n > 1][:5]}"
        )

    settlement_by_key: dict[tuple[str, str], list[Movement]] = defaultdict(list)
    for line in settlement:
        settlement_by_key[line.match_key].append(line)

    matched_ledger_keys: set[tuple[str, str]] = set()

    for key, lines in settlement_by_key.items():
        # Pass 0: the same line twice. The processor sent it, we did it once.
        # Every line after the first is a duplicate, and the first one still
        # goes through normal matching.
        first, *rest = sorted(lines, key=lambda m: m.line_id)
        result.duplicates.extend(rest)

        ours = by_key.get(key)
        if ours is None:
            result.unmatched_settlement.append(first)
            continue

        matched_ledger_keys.add(key)

        if ours.amount_minor == first.amount_minor:
            # Pass 1: exact. Same payment, same kind, same signed amount.
            result.matches.append(
                Match(ours, first, "exact", "same payment, kind and amount")
            )
        elif first.currency != "USD":
            # Pass 2: matched, and the difference is explained by the line
            # having been converted. Still a match: it is the same movement.
            # The difference is classified separately rather than tolerated.
            result.matches.append(
                Match(
                    ours,
                    first,
                    "converted",
                    f"settled in {first.currency}: {first.note or 'no rate given'}",
                    difference_minor=first.amount_minor - ours.amount_minor,
                )
            )
        else:
            # Pass 3: same payment and kind, different amount. Matched so that
            # the pair can be reported together, and flagged so somebody looks.
            result.matches.append(
                Match(
                    ours,
                    first,
                    "amount_differs",
                    "same payment and kind, different amount",
                    difference_minor=first.amount_minor - ours.amount_minor,
                )
            )

    result.unmatched_ledger = [
        m for m in ledger if m.match_key not in matched_ledger_keys
    ]
    return result
