"""A thousand payouts, crashes injected everywhere, then three assertions.

    python -m saga.chaos

The third assertion is the one that matters. Late is a support ticket. Twice is
money gone, usually to somebody with no reason to return it, and it is the
failure that ends careers in payments.
"""

from __future__ import annotations

import random
import sys
from collections import Counter
from dataclasses import dataclass

from .bank import Bank
from .orchestrator import saga
from .store import Store
from .sweeper import sweep

RUNS = 1_000


@dataclass
class ChaosResult:
    runs: int
    states: Counter
    all_final: bool
    balance_matches: bool
    no_reference_paid_twice: bool
    expected_balance: int
    actual_balance: int
    inconsistent: int
    submissions: int
    distinct_references: int

    @property
    def passed(self) -> bool:
        return (
            self.all_final
            and self.balance_matches
            and self.no_reference_paid_twice
            and self.inconsistent == 0
        )


def run(runs: int = RUNS, seed: int = 12) -> ChaosResult:
    rng = random.Random(seed)
    store = Store()
    bank = Bank(rng, reject_rate=0.08, timeout_rate=0.07)
    orchestrator = saga(store, bank, rng, crash_after_submit=0.06)

    for i in range(runs):
        orchestrator.run("M1", 5_000 + i, f"chaos-{i:05d}")

    # The sweeper runs repeatedly, as it would on a schedule. Once is enough
    # here, and running it three times also checks it is safe to repeat.
    for _ in range(3):
        sweep(store, bank)

    paid = [p for p in store.payouts.values() if p.state == "paid"]
    expected = -sum(p.amount_minor for p in paid)

    return ChaosResult(
        runs=runs,
        states=Counter(p.state for p in store.payouts.values()),
        all_final=all(p.is_final for p in store.payouts.values()),
        balance_matches=store.balance("M1") == expected,
        # The bank is idempotent on our reference, so one reference can only
        # ever produce one payment. This checks we never reused one.
        no_reference_paid_twice=len({p.our_ref for p in store.payouts.values()}) == runs,
        expected_balance=expected,
        actual_balance=store.balance("M1"),
        inconsistent=len(store.inconsistent()),
        submissions=bank.submissions,
        distinct_references=len(bank.submitted),
    )


def main() -> int:
    result = run()

    print(f"{result.runs:,} payouts, 8% rejected, 7% timing out, 6% crashing after submit\n")
    for state, n in sorted(result.states.items()):
        print(f"   {state:16s} {n:5,}")

    print(f"\n   bank submissions          {result.submissions:5,}")
    print(f"   distinct references       {result.distinct_references:5,}")
    print(f"\n   every payout final        {result.all_final}")
    print(f"   balances match            {result.balance_matches}  "
          f"({result.actual_balance:,} against {result.expected_balance:,})")
    print(f"   no reference paid twice   {result.no_reference_paid_twice}")
    print(f"   inconsistent payouts      {result.inconsistent}")

    print("\n   PASSED" if result.passed else "\n   FAILED")
    return 0 if result.passed else 1


if __name__ == "__main__":
    sys.exit(main())
