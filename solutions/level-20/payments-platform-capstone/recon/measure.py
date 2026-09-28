"""The reconciliation, timed at four sizes, against the version it replaced.

    python -m recon.measure                   # 2,000 / 4,000 / 8,000 payments
    python -m recon.measure --sizes 1000 2000 # something quicker

The reconciliation in `daily.py` was quadratic in the number of payments, and the
docstring there says so with numbers. This file is where those numbers come from,
because a claim about a 1,000 fold improvement that cannot be re-run is a claim
nobody should believe.

Three things are timed at each size:

**The first version's inner loop.** A copy of it, kept deliberately: for each
captured payment, `ledger.by_reference(payment.id)`, which scans every entry in
the ledger. Five ledger entries per payment, so the scan grows with the payments
and the loop runs once per payment.

**The shipped inner loop.** One pass to index the ledger by reference, then a
dictionary lookup per payment.

**The whole shipped reconciliation**, all seven checks, so the loop's share of
the real work is visible rather than implied.

The ratio is the number worth reading. A single size tells you which version was
faster on one machine on one day; four sizes tell you that one of them is
quadratic, and that is the property that decides what happens at a million
payments.
"""

from __future__ import annotations

import argparse
import time

from platform_.platform import Platform
from recon.daily import reconcile


def build(payments: int) -> Platform:
    """A platform with `payments` captured payments, fully settled."""
    platform = Platform()
    for i in range(payments):
        platform.payment(1999 + (i % 97))
        if i % 500 == 499:              # settle in batches, or the queue grows
            platform.settle()
    platform.settle()
    return platform


def naive_loop(platform: Platform) -> int:
    """The first version, exactly as it was. One ledger scan per payment."""
    ledger = platform.ledger
    balanced = 0
    for payment in platform.api.payments.values():
        if payment.status != "captured":
            continue
        movements = ledger.by_reference(payment.id)      # scans every entry
        if movements and sum(e.amount_minor for e in movements) == 0:
            balanced += 1
    return balanced


def indexed_loop(platform: Platform) -> int:
    """The shipped version. One pass to index, then a lookup per payment."""
    ledger = platform.ledger
    by_reference: dict[str, list] = {}
    for entry in ledger.entries:
        by_reference.setdefault(entry.reference, []).append(entry)

    balanced = 0
    for payment in platform.api.payments.values():
        if payment.status != "captured":
            continue
        movements = by_reference.get(payment.id)
        if movements and sum(e.amount_minor for e in movements) == 0:
            balanced += 1
    return balanced


def timed(call) -> tuple[float, object]:
    started = time.perf_counter()
    value = call()
    return (time.perf_counter() - started) * 1_000, value


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sizes", type=int, nargs="+", default=[2_000, 4_000, 8_000])
    parser.add_argument("--naive-limit", type=int, default=8_000,
                        help="skip the quadratic version above this size")
    args = parser.parse_args()

    print(f"{'payments':>9}  {'entries':>9}  {'first version':>14}  "
          f"{'indexed':>10}  {'ratio':>8}  {'whole recon':>12}")

    for size in args.sizes:
        platform = build(size)
        entries = len(platform.ledger.entries)

        if size <= args.naive_limit:
            naive_ms, naive_count = timed(lambda: naive_loop(platform))
        else:
            naive_ms, naive_count = float("nan"), None

        indexed_ms, indexed_count = timed(lambda: indexed_loop(platform))
        whole_ms, result = timed(lambda: reconcile(platform))

        if naive_count is not None and naive_count != indexed_count:
            raise SystemExit(f"the two loops disagree at {size}: "
                             f"{naive_count} against {indexed_count}")
        if not result.clean:
            raise SystemExit(f"the reconciliation is not clean at {size}: "
                             f"{result.summary()}")

        naive_text = "skipped" if naive_count is None else f"{naive_ms:,.1f} ms"
        ratio = "" if naive_count is None else f"{naive_ms / indexed_ms:,.0f}x"
        print(f"{size:>9,}  {entries:>9,}  {naive_text:>14}  "
              f"{indexed_ms:>7,.1f} ms  {ratio:>8}  {whole_ms:>9,.1f} ms")

    print("\nBoth loops count the same balanced transactions, and the "
          "reconciliation is clean at every size, or this exits non zero.")


if __name__ == "__main__":
    main()
