"""The alerts, so that "time to detection" is a measurement rather than a claim.

Level 16, reduced to four rules and evaluated in process. Each rule is a
predicate over the platform's current state plus a window, and the chaos runner
polls them, so detection time is the interval between injecting a failure and a
rule first returning true.

Two properties carried over from level 16 deliberately:

**Every rule names an objective and a runbook.** A rule that maps to neither gets
deleted, and deleting it is the cheapest reliability work available.

**Symptoms page, causes do not.** There is no rule here for "the ledger is
unavailable", because that is a cause. The rule is "payments are failing", which
is what a customer experiences, and it fires whatever the cause turns out to be.
"""

from __future__ import annotations

import time
from collections import deque
from collections.abc import Callable
from dataclasses import dataclass, field


@dataclass(frozen=True, slots=True)
class Rule:
    name: str
    objective: str
    runbook: str
    severity: str
    fires_when: Callable[[Signals], bool]


@dataclass
class Signals:
    """What the rules see. Sampled, because a rule over instantaneous state
    fires on a single unlucky request."""

    error_ratio: float = 0.0
    payments_offered: int = 0
    outbox_backlog: int = 0
    payouts_unknown: int = 0
    payouts_pending: int = 0
    credential_refusals: int = 0


RULES = (
    Rule(
        name="PaymentsFailing",
        objective="payments-availability",
        runbook="runbooks/payments-failing.md",
        severity="page",
        # 14.4 times a 99.9% budget, which is level 16's fast burn threshold.
        fires_when=lambda s: s.payments_offered >= 20 and s.error_ratio > 0.0144,
    ),
    Rule(
        name="EventBacklogGrowing",
        objective="payout-freshness",
        runbook="runbooks/event-backlog.md",
        severity="page",
        fires_when=lambda s: s.outbox_backlog > 500,
    ),
    Rule(
        name="PayoutsUnknown",
        objective="payouts-correctness",
        runbook="runbooks/payouts-unknown.md",
        severity="page",
        # No budget. From level 12: a payout in a non final state is money taken
        # from a merchant with nothing to show for it.
        fires_when=lambda s: s.payouts_unknown > 0,
    ),
    Rule(
        name="VaultRefusingCredential",
        objective="payments-availability",
        runbook="runbooks/vault-credential.md",
        severity="page",
        fires_when=lambda s: s.credential_refusals > 5,
    ),
)


@dataclass
class AlertLog:
    """Which rules fired, and when, relative to a start time."""

    started: float = field(default_factory=time.perf_counter)
    firing: set[str] = field(default_factory=set)
    events: list[tuple[float, str, str]] = field(default_factory=list)
    recent_errors: deque = field(default_factory=lambda: deque(maxlen=200))

    def observe(self, signals: Signals) -> list[str]:
        """Evaluate every rule once. Returns the names that changed state."""
        changed: list[str] = []
        for rule in RULES:
            hot = rule.fires_when(signals)
            if hot and rule.name not in self.firing:
                self.firing.add(rule.name)
                self.events.append((self.since_start, "fired", rule.name))
                changed.append(rule.name)
            elif not hot and rule.name in self.firing:
                self.firing.discard(rule.name)
                self.events.append((self.since_start, "resolved", rule.name))
                changed.append(rule.name)
        return changed

    def fired_at(self, name: str) -> float | None:
        for at, what, rule in self.events:
            if rule == name and what == "fired":
                return at
        return None

    def resolved_at(self, name: str) -> float | None:
        for at, what, rule in reversed(self.events):
            if rule == name and what == "resolved":
                return at
        return None

    @property
    def since_start(self) -> float:
        return time.perf_counter() - self.started

    def record_request(self, ok: bool) -> None:
        self.recent_errors.append(0 if ok else 1)

    @property
    def error_ratio(self) -> float:
        if not self.recent_errors:
            return 0.0
        return sum(self.recent_errors) / len(self.recent_errors)
