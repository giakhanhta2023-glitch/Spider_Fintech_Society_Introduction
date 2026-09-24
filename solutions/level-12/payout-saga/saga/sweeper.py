"""The job that goes and finds out.

Compensation handles the failure you know about. This handles the one you do
not, and you need both: the measurement in the README shows the saga alone
leaves 8.5% broken and the sweeper alone leaves nine payouts with the money
missing. Together they leave nothing.

What it does is the opposite of guessing. For every payout that is not in a
final state, it asks the bank what really happened and finishes the job in
whichever direction the answer points.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from .bank import Bank
from .store import Store

# How long a payout may sit unfinished before the sweeper touches it.
#
# Two minutes, and the reasoning is that it has to be comfortably longer than
# the slowest normal completion, so the sweeper never races a request that is
# simply slow. Against this simulator the bank answers instantly and two
# minutes is enormous; against a real bank it might be an hour. Either way it
# is configuration rather than a constant in a condition.
SWEEP_AFTER_SECONDS = 120


@dataclass
class SweepResult:
    was_actually_paid: int = 0
    never_reached_the_bank: int = 0
    still_unfinished: int = 0
    examined: int = 0
    details: list[str] = field(default_factory=list)

    def as_dict(self) -> dict[str, int]:
        return {
            "examined": self.examined,
            "was actually paid": self.was_actually_paid,
            "never reached the bank, money returned": self.never_reached_the_bank,
            "still unfinished": self.still_unfinished,
        }


def sweep(
    store: Store,
    bank: Bank,
    worker: str = "sweeper-1",
    older_than_seconds: int = 0,
    limit: int = 1000,
) -> SweepResult:
    """Resolve everything left mid flight.

    Claimed with skip-locked semantics so several sweepers can run at once
    without two of them resolving the same payout, which is how a compensation
    and a completion end up racing each other.
    """
    result = SweepResult()
    claimed = store.claim(worker, limit=limit, older_than_seconds=older_than_seconds)
    result.examined = len(claimed)

    try:
        for payout in claimed:
            truth = bank.lookup(payout.our_ref)

            if truth is not None:
                # It went out. Finish the saga forwards rather than undoing it:
                # compensating a payment that actually happened would send the
                # money twice.
                store.set_state(payout, "paid", bank_ref=truth)
                result.was_actually_paid += 1
                result.details.append(f"{payout.our_ref}: paid as {truth}")
            else:
                # The bank has no record. It never went, so the money goes back.
                store.compensate(payout)
                result.never_reached_the_bank += 1
                result.details.append(f"{payout.our_ref}: never sent, money returned")
    finally:
        store.release(claimed)

    result.still_unfinished = len(store.unfinished())
    return result
