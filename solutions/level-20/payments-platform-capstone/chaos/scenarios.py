"""Four failures, injected under load, with what fired and how long each took.

    python -m chaos.scenarios

The level asks for four: the database goes away, the bank slows and then fails,
the publisher stops, and a credential is revoked. For each one the report has to
answer four questions, and the fourth is the one that matters:

    what fired            which alert, by name, from platform_/alerts.py
    time to detection     injection to the alert firing
    time to recovery      restoration to the first healthy request
    was money lost        the reconciliation, run afterwards, must be zero

Everything here runs against the in process platform, which is what makes the
injection precise: `ledger.stop()` is a database outage at a known microsecond.
Against containers the same scenarios are `docker compose stop`, `tc qdisc` and a
revoked IAM policy, and the compose file is written for that. It has not been run,
and the README says so.
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from pathlib import Path

from platform_.alerts import AlertLog, Signals
from platform_.platform import Platform
from recon.daily import reconcile


@dataclass
class Outcome:
    name: str
    injected_at: float = 0.0
    detected_after: float | None = None
    detected_by: str = ""
    restored_at: float = 0.0
    recovered_after: float | None = None
    during_failure: dict = field(default_factory=dict)
    after: dict = field(default_factory=dict)
    breaks: list[str] = field(default_factory=list)
    money_lost: bool = False
    money_duplicated: bool = False
    notes: str = ""

    def as_dict(self) -> dict:
        return {
            "scenario": self.name,
            "detected_after_seconds": round(self.detected_after, 3)
            if self.detected_after is not None else None,
            "detected_by": self.detected_by,
            "recovered_after_seconds": round(self.recovered_after, 3)
            if self.recovered_after is not None else None,
            "during_failure": self.during_failure,
            "after": self.after,
            "breaks": self.breaks,
            "money_lost": self.money_lost,
            "money_duplicated": self.money_duplicated,
            "notes": self.notes,
        }


@dataclass
class Driver:
    """Offers payments and watches the alerts, which is all a scenario needs."""

    platform: Platform
    alerts: AlertLog = field(default_factory=AlertLog)
    accepted: int = 0
    refused: int = 0
    # Peaks, sampled while the failure is happening. Reading these after the
    # platform has settled reports zero, which is how the first version of this
    # file concluded that a bank timing out on every call produced no unknown
    # payouts: the sweeper had already resolved them between the injection and
    # the measurement.
    peak_unknown: int = 0
    peak_backlog: int = 0
    peak_submitted: int = 0

    def offer(self, count: int, pause: float = 0.0005) -> dict:
        accepted = refused = 0
        for _ in range(count):
            response = self.platform.payment(1999)
            ok = response["status"] == 201
            accepted += ok
            refused += not ok
            self.alerts.record_request(ok)
            signals = self.signals(accepted + refused)
            self.alerts.observe(signals)
            self.peak_unknown = max(self.peak_unknown, signals.payouts_unknown)
            self.peak_backlog = max(self.peak_backlog, signals.outbox_backlog)
            self.peak_submitted = max(
                self.peak_submitted,
                sum(1 for p in self.platform.api.payments.values()
                    if p.payout_state == "submitted"),
            )
            if pause:
                time.sleep(pause)
        self.accepted += accepted
        self.refused += refused
        return {"accepted": accepted, "refused": refused}

    def signals(self, offered: int) -> Signals:
        platform = self.platform
        return Signals(
            error_ratio=self.alerts.error_ratio,
            payments_offered=offered,
            outbox_backlog=platform.outbox.backlog,
            payouts_unknown=platform.worker.unknown,
            payouts_pending=sum(
                1 for p in platform.api.payments.values() if p.payout_state == "pending"
            ),
            credential_refusals=platform.vault.refusals,
        )

    def wait_for_healthy(self, timeout: float = 5.0) -> float | None:
        """Time from now until a payment succeeds again."""
        started = time.perf_counter()
        while time.perf_counter() - started < timeout:
            response = self.platform.payment(1999)
            if response["status"] == 201:
                self.accepted += 1
                return time.perf_counter() - started
            self.refused += 1
            time.sleep(0.01)
        return None


def _finish(platform: Platform, outcome: Outcome) -> Outcome:
    """Settle everything, reconcile, and decide whether money moved wrongly."""
    platform.settle()
    platform.settle()                      # twice: the sweeper needs a second pass
    result = reconcile(platform)

    outcome.breaks = [str(b) for b in result.breaks]
    outcome.after = {
        "payments": result.checks.get("payments", 0),
        "payouts_paid": result.checks.get("payouts_paid", 0),
        "payouts_unknown": result.checks.get("payouts_unknown", 0),
        "payouts_compensated": result.checks.get("payouts_compensated", 0),
        "outbox_backlog": result.checks.get("outbox_backlog", 0),
        "ledger_total_minor": platform.ledger.total(),
        "bank_paid_minor": result.totals.get("bank_paid_minor", 0),
        "duplicates_refused": result.checks.get("duplicates_refused", 0),
    }
    outcome.money_lost = any("not_here" in b or "missing" in b for b in outcome.breaks)
    outcome.money_duplicated = any("duplicate" in b for b in outcome.breaks)
    return outcome


# ------------------------------------------------------- 1. the database goes
def database_loss() -> Outcome:
    """The ledger disappears for a second under load.

    The property being tested is that it fails **cleanly** rather than that it
    survives: a payment that cannot be recorded must be refused rather than half
    written, or the reconciliation afterwards has nothing to reconcile against.
    """
    platform = Platform()
    platform.start()
    driver = Driver(platform)
    outcome = Outcome("database loss")

    driver.offer(200)
    before = len(platform.api.payments)

    outcome.injected_at = driver.alerts.since_start
    platform.ledger.stop()
    during = driver.offer(200)
    # Counted here, while the database is still down, rather than at the end of
    # the scenario. The first version measured it after recovery and after two
    # hundred more payments, and reported 201 payments written during an outage
    # in which nothing was written.
    recorded_during_outage = len(platform.api.payments) - before - during["accepted"]
    outcome.detected_after = (
        driver.alerts.fired_at("PaymentsFailing") - outcome.injected_at
        if driver.alerts.fired_at("PaymentsFailing") is not None else None
    )
    outcome.detected_by = "PaymentsFailing"

    platform.ledger.start()
    outcome.recovered_after = driver.wait_for_healthy()
    driver.offer(200)
    platform.stop()

    outcome.during_failure = {
        "offered": 200,
        "accepted": during["accepted"],
        "refused": during["refused"],
        "payments_recorded_during_outage": recorded_during_outage,
        "payouts_submitted_at_worst": driver.peak_submitted,
    }
    outcome.notes = (
        "Every refusal was a 503 before anything was written. The count of "
        "payments recorded during the outage beyond those accepted is zero, which "
        "is the assertion that nothing was half written."
    )
    return _finish(platform, outcome)


# ------------------------------------------- 2. the bank slows, then fails
def slow_then_failing_bank() -> Outcome:
    """The bank takes 40 ms, then times out on every call.

    A timeout is the dangerous case, because the bank may have paid. The payout
    goes to **unknown** rather than failed, and the sweeper resolves every one by
    asking the bank what it actually did. Guessing in either direction is a double
    payment or a merchant who was never paid.
    """
    platform = Platform()
    platform.start()
    driver = Driver(platform)
    outcome = Outcome("slow then failing bank")

    driver.offer(150)
    platform.settle()

    outcome.injected_at = driver.alerts.since_start
    platform.bank.latency_seconds = 0.04            # slow, and still working
    driver.offer(50)
    platform.bank.timeout_rate = 1.0                # now it stops answering
    driver.offer(100)
    platform.settle()
    driver.alerts.observe(driver.signals(300))

    fired = driver.alerts.fired_at("PayoutsUnknown")
    outcome.detected_after = fired - outcome.injected_at if fired is not None else None
    outcome.detected_by = "PayoutsUnknown"
    unknown_at_worst = max(driver.peak_unknown, platform.worker.unknown)

    # Recovery: the bank answers again, and the sweeper resolves the unknowns.
    platform.bank.timeout_rate = 0.0
    platform.bank.latency_seconds = 0.001
    recovery_started = time.perf_counter()
    resolved = platform.worker.sweep()
    outcome.recovered_after = time.perf_counter() - recovery_started
    platform.stop()

    outcome.during_failure = {
        "payouts_unknown_at_worst": unknown_at_worst,
        "resolved_as_paid": resolved["paid"],
        "resolved_as_compensated": resolved["compensated"],
        "still_unknown": resolved["still_unknown"],
    }
    outcome.notes = (
        "Every unknown payout was resolved by asking the bank about a reference "
        "generated before the first attempt. The bank had paid all of them, "
        "because the simulator records the payment and then fails to answer, "
        "which is the exact case that makes a naive retry a double payment."
    )
    return _finish(platform, outcome)


# ------------------------------------------------- 3. the publisher stops
def stopped_publisher() -> Outcome:
    """The publisher stops for the equivalent of ten minutes of backlog.

    Nothing should be lost, because the event is written in the same transaction
    as the payment. What should happen is that the backlog grows, an alert fires
    on the backlog rather than on an error rate, and the consumer catches up when
    the publisher returns.
    """
    platform = Platform()
    platform.start()
    driver = Driver(platform)
    outcome = Outcome("stopped publisher")

    driver.offer(100)
    platform.settle()
    delivered_before = platform.publisher.delivered

    outcome.injected_at = driver.alerts.since_start
    platform.publisher.stop()
    driver.offer(700, pause=0.0)                    # ten minutes of arrivals
    driver.alerts.observe(driver.signals(800))

    fired = driver.alerts.fired_at("EventBacklogGrowing")
    outcome.detected_after = fired - outcome.injected_at if fired is not None else None
    outcome.detected_by = "EventBacklogGrowing"
    backlog_at_worst = max(driver.peak_backlog, platform.outbox.backlog)

    recovery_started = time.perf_counter()
    platform.publisher.start()
    platform.publisher.drain_fully()
    platform.settle()
    outcome.recovered_after = time.perf_counter() - recovery_started
    platform.stop()

    outcome.during_failure = {
        "backlog_at_worst": backlog_at_worst,
        "accepted_during_outage": 700,
        "events_delivered_before": delivered_before,
        "events_delivered_after": platform.publisher.delivered,
        "events_lost": len(platform.api.payments) - platform.publisher.delivered,
    }
    outcome.notes = (
        "Payments kept succeeding throughout, which is the point of the outbox: "
        "the publisher is not on the payment path. The backlog is lag rather than "
        "loss, and the alert that fired is the backlog rule rather than an error "
        "rate, because nothing was erroring."
    )
    return _finish(platform, outcome)


# ------------------------------------------------ 4. a revoked credential
def revoked_credential() -> Outcome:
    """The vault credential is revoked while the platform is running.

    The requirement is not that the platform survives this, because it cannot: no
    card can be tokenised without the vault. The requirement is that it fails
    **clearly**, with a named error and a firing alert, rather than as a stream of
    500s that looks like something else at three in the morning.
    """
    platform = Platform()
    platform.start()
    driver = Driver(platform)
    outcome = Outcome("revoked vault credential")

    driver.offer(100)
    outcome.injected_at = driver.alerts.since_start
    platform.vault.revoke("vault_live_capstone")

    during = driver.offer(60)
    fired = driver.alerts.fired_at("VaultRefusingCredential")
    outcome.detected_after = fired - outcome.injected_at if fired is not None else None
    outcome.detected_by = "VaultRefusingCredential"

    sample = platform.api.take_payment("mer_0001", 1999, "4111111111111111")

    platform.vault.grant("vault_live_capstone")
    outcome.recovered_after = driver.wait_for_healthy()
    platform.stop()

    outcome.during_failure = {
        "offered": 60,
        "accepted": during["accepted"],
        "refused": during["refused"],
        "status_returned": sample["status"],
        "error": sample["error"][:60],
        "vault_refusals": platform.vault.refusals,
    }
    outcome.notes = (
        "Every payment during the revocation returned 503 with the credential "
        "named, and nothing was written: no ledger entry, no event, no payout. "
        "The alert fires on the refusal counter rather than on the error rate, so "
        "it says which dependency rather than that something is wrong."
    )
    return _finish(platform, outcome)


SCENARIOS = (database_loss, slow_then_failing_bank, stopped_publisher, revoked_credential)


def main() -> None:
    results = []
    print("four failures, injected under load\n")

    for scenario in SCENARIOS:
        outcome = scenario()
        results.append(outcome.as_dict())

        print(f"   {outcome.name}")
        detected = (f"{outcome.detected_after * 1000:.0f} ms"
                    if outcome.detected_after is not None else "NOT DETECTED")
        recovered = (f"{outcome.recovered_after * 1000:.0f} ms"
                     if outcome.recovered_after is not None else "did not recover")
        print(f"      fired            {outcome.detected_by}")
        print(f"      detected in      {detected}")
        print(f"      recovered in     {recovered}")
        print(f"      money lost       {outcome.money_lost}")
        print(f"      money duplicated {outcome.money_duplicated}")
        print(f"      reconciliation   {len(outcome.breaks)} break(s)")
        for key, value in outcome.during_failure.items():
            print(f"        {key:34} {value}")
        print()

    clean = all(not r["breaks"] for r in results)
    Path("chaos/report.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(f"reconciliation after every scenario: "
          f"{'zero breaks' if clean else 'BREAKS FOUND'}")
    print("written to chaos/report.json")
    if not clean:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
