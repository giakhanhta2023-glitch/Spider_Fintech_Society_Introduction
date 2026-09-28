"""The daily reconciliation. It returns zero, or the capstone has not passed.

    python -m recon.daily

Level 10, applied across every service rather than to one file. Seven checks, and
each one compares two systems that arrived at the same fact independently:

  1. the ledger balances                    the ledger against itself
  2. every capture has a ledger transaction  the API against the ledger
  3. every capture reached the consumer      the API against the queue
  4. no event was delivered twice            the queue against itself
  5. every paid payout is at the bank        the platform against the bank
  6. the bank paid nothing we did not ask for the bank against the platform
  7. the money out matches the bank's total  the ledger against the bank

The fifth and sixth are the pair worth understanding. Checking only one direction
finds payments we know about and misses the ones we do not, and a settlement that
exists at the processor with no record on our side is the break that costs the
most to explain.

A break is returned with the evidence needed to investigate it rather than as a
count, because a reconciliation that says "3 breaks" starts an investigation and
one that says which three finishes it.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from platform_.api import BANK_CLEARING, Api, PayoutWorker
from platform_.bank import Bank
from platform_.ledger import Ledger
from platform_.platform import Platform
from platform_.queue import Consumer, Outbox


@dataclass(frozen=True, slots=True)
class Break:
    kind: str
    key: str
    detail: str

    def __str__(self) -> str:
        return f"{self.kind}: {self.key} ({self.detail})"


@dataclass
class Reconciliation:
    breaks: list[Break] = field(default_factory=list)
    checks: dict[str, int] = field(default_factory=dict)
    totals: dict[str, int] = field(default_factory=dict)

    @property
    def clean(self) -> bool:
        return not self.breaks

    def summary(self) -> str:
        """Counts and money are kept apart, which the first version of this did
        not: it summed an amount in minor units into "facts checked" and reported
        20,902 checks on four payments. A number that mixes units is a number
        nobody can sanity check."""
        if self.clean:
            return f"{sum(self.checks.values()):,} facts checked, 0 breaks"
        return f"{len(self.breaks)} break(s) across {len(self.checks)} checks"


def reconcile(platform: Platform) -> Reconciliation:
    """Every check, against a platform in whatever state it is in.

    Deliberately takes the platform rather than files: the capstone's question is
    whether the services agree with each other after something went wrong, and
    the answer has to be computable at any moment rather than at the end of a
    tidy day.
    """
    result = Reconciliation()
    ledger: Ledger = platform.ledger
    api: Api = platform.api
    consumer: Consumer = platform.consumer
    outbox: Outbox = platform.outbox
    bank: Bank = platform.bank
    worker: PayoutWorker = platform.worker

    # 1. The ledger balances. If this fails nothing else is worth checking.
    result.checks["ledger_entries"] = len(ledger.entries)
    if ledger.total() != 0:
        result.breaks.append(
            Break("ledger_unbalanced", "ledger", f"sums to {ledger.total()}")
        )

    captured = [p for p in api.payments.values() if p.status == "captured"]
    result.checks["payments"] = len(captured)

    # One pass to index the ledger by reference, then a lookup per payment.
    #
    # The first version called `ledger.by_reference(payment.id)` in the loop, and
    # that scans every entry, so the reconciliation was quadratic in the number of
    # payments. The capstone's own load test found it, and `recon/measure.py`
    # re-runs the comparison: the old loop takes 1,304.8 ms at 2,000 payments,
    # 5,148.8 ms at 4,000 and 24,061.8 ms at 8,000, against 6.5, 12.1 and 26.1 ms
    # indexed. The number that matters is not 923 times at 8,000, it is that the
    # ratio was 201 times at 2,000: it grows with the data, so at a million
    # payments the first version would never have finished.
    by_reference: dict[str, list] = {}
    for entry in ledger.entries:
        by_reference.setdefault(entry.reference, []).append(entry)
    references = set(by_reference)

    for payment in captured:
        # 2. Every capture has its transaction, and that transaction balances.
        if payment.id not in references:
            result.breaks.append(
                Break("missing_in_ledger", payment.id, "captured with no ledger entry")
            )
            continue
        movements = by_reference[payment.id]
        if sum(e.amount_minor for e in movements) != 0:
            result.breaks.append(
                Break("unbalanced_transaction", payment.id, "does not sum to zero")
            )

        # 3. Every capture reached the consumer, once the outbox has drained.
        # A backlog is lag rather than loss, and the distinction is the whole
        # point of the outbox: the check reports it separately.
        if payment.id not in consumer.payouts and outbox.backlog == 0:
            result.breaks.append(
                Break("event_lost", payment.id, "captured, drained, never consumed")
            )

    result.checks["outbox_backlog"] = outbox.backlog

    # 4. Nothing was consumed twice. The consumer counts what it refused, and a
    # refusal is the system working rather than a break.
    result.checks["duplicates_refused"] = consumer.duplicates_refused
    if len(consumer.seen) != len(set(consumer.seen)):
        result.breaks.append(Break("duplicate_delivery", "consumer", "double counted"))

    # 5 and 6. The platform and the bank, in both directions.
    paid = {p.payout_reference: p for p in api.payments.values() if p.payout_state == "paid"}
    result.checks["payouts_paid"] = len(paid)

    for reference, payment in paid.items():
        if bank.status(reference) != "paid":
            result.breaks.append(
                Break("paid_here_not_at_bank", payment.id,
                      "we recorded a payout the bank has no record of")
            )

    for reference in bank.paid:
        if reference not in paid:
            owner = next(
                (p for p in api.payments.values() if p.payout_reference == reference),
                None,
            )
            state = owner.payout_state if owner else "no such payout"
            result.breaks.append(
                Break("paid_at_bank_not_here", reference,
                      f"the bank paid it and we think it is {state}")
            )

    # 7. The money that left, against the money the bank says left.
    moved_out = -ledger.balance(BANK_CLEARING)
    bank_total = sum(bank.paid.values())
    result.totals["bank_clearing_minor"] = moved_out
    result.totals["bank_paid_minor"] = bank_total
    if moved_out != bank_total:
        result.breaks.append(
            Break("clearing_mismatch", "bank_clearing",
                  f"ledger says {moved_out}, the bank says {bank_total}")
        )

    # Unknown payouts are not breaks and are not nothing. They are work, and the
    # count belongs in the report so that "zero breaks" cannot hide them.
    result.checks["payouts_unknown"] = sum(
        1 for p in api.payments.values() if p.payout_state == "unknown"
    )
    # `submitted` means the bank was called and has not answered yet. It is not a
    # break and it is not nothing: a payout stuck in it is the level 12 failure,
    # so it is counted where somebody will see it.
    result.checks["payouts_submitted"] = sum(
        1 for p in api.payments.values() if p.payout_state == "submitted"
    )
    result.checks["payouts_compensated"] = worker.compensated
    return result


def main() -> None:
    platform = Platform()
    for amount in (1999, 2500, 4999, 12_000):
        platform.payment(amount)
    platform.settle()

    result = reconcile(platform)

    print("daily reconciliation\n")
    for name, value in result.checks.items():
        print(f"   {name:24} {value:>12,}")
    for name, value in result.totals.items():
        print(f"   {name:24} {value:>12,}   minor units")
    print()
    if result.clean:
        print(f"   {result.summary()}")
    else:
        print(f"   {result.summary()}\n")
        for found in result.breaks:
            print(f"      {found}")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
