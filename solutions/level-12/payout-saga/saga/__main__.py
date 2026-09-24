"""The comparison the README publishes.

    python -m saga

Runs 200 payouts through the naive orchestrator and 200 through the saga,
against the same bank behaviour and the same random seed, then sweeps both and
prints the four numbers that make the argument.
"""

from __future__ import annotations

import random
import sys

from .bank import Bank
from .orchestrator import naive, saga
from .store import Store
from .sweeper import sweep

RUNS = 200
SEED = 12


def one_mode(mode: str, runs: int = RUNS, seed: int = SEED) -> dict:
    # One Random per mode, so both modes meet exactly the same sequence of bank
    # behaviour and the comparison is about the orchestrator rather than luck.
    rng = random.Random(seed)
    store = Store()
    bank = Bank(rng)
    build = saga if mode == "saga" else naive
    orchestrator = build(store, bank, rng)

    for i in range(runs):
        orchestrator.run("M1", 5000 + i, f"{mode}-{i:05d}")

    before = len(store.inconsistent())
    result = sweep(store, bank)
    after = len(store.inconsistent())

    return {
        "mode": mode,
        "outcomes": orchestrator.outcomes,
        "inconsistent_before": before,
        "sweeper": result,
        "inconsistent_after": after,
        "store": store,
    }


def main() -> int:
    results = [one_mode("naive"), one_mode("saga")]

    for r in results:
        print(f"--- {r['mode']} ---")
        for what, n in sorted(r["outcomes"].items()):
            print(f"   {what:36s} {n:4d}")
        before = r["inconsistent_before"]
        print(f"   {'money debited with no payout':36s} {before:4d}   "
              f"({before / RUNS:.1%} of {RUNS})")
        for what, n in r["sweeper"].as_dict().items():
            if what != "examined":
                print(f"   sweeper: {what:27s} {n:4d}")
        print(f"   {'after the sweeper':36s} {r['inconsistent_after']:4d}\n")

    naive_r, saga_r = results
    print("the table that is the argument")
    print(f"   {'':34s} {'naive':>8s} {'saga':>8s}")
    print(f"   {'inconsistent before the sweeper':34s} "
          f"{naive_r['inconsistent_before']:>8d} {saga_r['inconsistent_before']:>8d}")
    print(f"   {'found to have actually been paid':34s} "
          f"{naive_r['sweeper'].was_actually_paid:>8d} "
          f"{saga_r['sweeper'].was_actually_paid:>8d}")
    print(f"   {'still inconsistent afterwards':34s} "
          f"{naive_r['inconsistent_after']:>8d} {saga_r['inconsistent_after']:>8d}")
    print(
        "\n   Read the bottom row. The sweeper alone is not enough, because a\n"
        "   sweeper that only asks 'did it go out' finds that the rejected\n"
        "   ones did not, and has nothing to do about it. Compensation alone\n"
        "   is not enough either, because it cannot touch the uncertain ones."
    )

    return 0


if __name__ == "__main__":
    sys.exit(main())
