"""The four measurements the README publishes.

    python -m outbox.experiments

1. dual write, and how many events it loses
2. the outbox, and how many it duplicates instead
3. batch size, and where the time actually goes
4. partitioning over the real level 9 stream
"""

from __future__ import annotations

import csv
import random
import sys
import time
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

from .core import Crash, Event, Log, MemoryStore, Publisher

PAYMENTS = 400
CRASH_RATE = 0.05


# --------------------------------------------------- 1. the dual write
def dual_write(payments: int = PAYMENTS, crash_rate: float = CRASH_RATE) -> dict:
    """Write the business row, commit, then publish. The obvious way.

    The window is between the commit and the publish. The transaction is
    already durable, so a crash there loses the event permanently: no error,
    no retry, nothing to find later. The business data says the payment
    happened and no downstream system ever hears about it.
    """
    rng = random.Random(11)
    store = MemoryStore()
    log = Log()
    lost = 0

    for i in range(payments):
        store.begin()
        store.write_business_row(f"P{i}", {"amount_minor": 1000 + i})
        store.commit()                      # durable. The payment happened.

        if rng.random() < crash_rate:
            lost += 1                       # and nobody will ever know
            continue

        log.append(Event(f"P{i}", "payment.captured", {"amount_minor": 1000 + i}))

    return {
        "payments": payments,
        "published": log.total(),
        "lost": lost,
        "lost_share": lost / payments,
    }


# -------------------------------------------------------- 2. the outbox
def with_outbox(payments: int = PAYMENTS, crash_rate: float = CRASH_RATE) -> dict:
    """The event written in the same transaction as the business row.

    Now the crash cannot lose anything, because the event is durable for
    exactly the reasons the payment is. What it can do is duplicate: the
    publisher sends, dies before marking, and sends again next time.
    """
    store = MemoryStore()
    log = Log()

    for i in range(payments):
        store.begin()
        store.write_business_row(f"P{i}", {"amount_minor": 1000 + i})
        store.write_outbox(
            Event(f"P{i}", "payment.captured", {"amount_minor": 1000 + i}, f"E{i}")
        )
        store.commit()                      # both, or neither

    # A batch of 10 rather than 50, so that 400 payments become 40 rounds and
    # the injected crash rate actually gets 40 chances to fire. At a batch of
    # 50 there are 8 rounds, and a 5% crash rate produces no crashes at all
    # about two runs in three: the experiment then reports a beautiful zero
    # and has measured nothing.
    publisher = Publisher(
        store, log, batch_size=10, crash_between_send_and_mark=crash_rate
    )
    totals = publisher.drain()

    delivered = defaultdict(int)
    for partition in range(log.partitions):
        for event in log.read(partition):
            delivered[event.event_id] += 1

    duplicated = sum(n - 1 for n in delivered.values() if n > 1)
    return {
        "payments": payments,
        "unique_delivered": len(delivered),
        "lost": payments - len(delivered),
        "duplicated": duplicated,
        "duplicate_share": duplicated / payments,
        "crashes": totals["crashes"],
        "left_unpublished": len(store.unpublished()),
    }


# --------------------------------------------------------- 3. batch size
def batch_sizes(events: int = 4_000) -> list[dict]:
    """The same work, in different sized bites.

    The in-memory store has no network, so this measures the loop rather than
    the round trips. Against a real database the effect is far larger, because
    each batch is one round trip instead of one per row: level 11 measured
    30,473 ms one row at a time against 116 ms in batches of 500.
    """
    out = []
    for size in (1, 10, 100, 500):
        store = MemoryStore()
        log = Log()
        for i in range(events):
            store.begin()
            store.write_outbox(Event(f"P{i}", "e", {"amount_minor": i}, f"E{i}"))
            store.commit()

        publisher = Publisher(store, log, batch_size=size)
        started = time.perf_counter()
        publisher.drain()
        took = (time.perf_counter() - started) * 1000
        out.append(
            {
                "batch_size": size,
                "ms": took,
                "per_second": events / (took / 1000),
                "rounds": (events + size - 1) // size,
            }
        )
    return out


# ------------------------------------------------------- 4. partitioning
ORDER = {"authorize": 0, "void": 1, "capture": 1, "expire": 1, "refund": 2, "chargeback": 2}


@dataclass(frozen=True, slots=True)
class PartitionResult:
    key: str
    partitions: int
    out_of_order: int
    payments_affected: int
    multi_event_payments: int

    @property
    def share(self) -> float:
        return self.payments_affected / max(self.multi_event_payments, 1)


def partitioning(path: Path, partitions: int = 4, seed: int = 11) -> list[PartitionResult]:
    """Does a capture ever arrive before its own authorisation?

    A partitioned log promises order only WITHIN a partition. So the question
    is not whether the log preserves order, it is whether you put the events
    that must stay in order into the same partition. That is the partition key,
    and it is the only decision that matters here.
    """
    rows = []
    with path.open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            rows.append((row["payment_id"], row["event"], row["at"]))
    rows.sort(key=lambda r: (r[2], r[0]))

    per_payment = defaultdict(int)
    for payment_id, _, _ in rows:
        per_payment[payment_id] += 1
    multi = sum(1 for n in per_payment.values() if n > 1)

    results = []
    for key_name in ("payment_id", "random"):
        rng = random.Random(seed)
        buckets: dict[int, list[tuple[str, str]]] = defaultdict(list)
        for payment_id, event, _ in rows:
            partition = (
                sum(payment_id.encode()) % partitions
                if key_name == "payment_id"
                else rng.randrange(partitions)
            )
            buckets[partition].append((payment_id, event))

        # Each partition is consumed in order, but partitions progress at their
        # own speed. Interleaving them by a per partition rate is what a real
        # consumer group looks like.
        delivered: list[tuple[float, str, str]] = []
        for partition, items in buckets.items():
            speed = rng.uniform(0.6, 1.8)
            for i, (payment_id, event) in enumerate(items):
                delivered.append((i * speed + rng.uniform(0, 0.3), payment_id, event))
        delivered.sort()

        highest: dict[str, int] = {}
        violations = 0
        affected: set[str] = set()
        for _, payment_id, event in delivered:
            rank = ORDER[event]
            seen = highest.get(payment_id, -1)
            if rank < seen:
                violations += 1
                affected.add(payment_id)
            highest[payment_id] = max(seen, rank)

        results.append(
            PartitionResult(key_name, partitions, violations, len(affected), multi)
        )
    return results


def main(argv: list[str]) -> int:
    data = Path(argv[1]) if len(argv) > 1 else Path("data/level-09-card-events.csv")

    print("1. dual write: publish after the transaction commits")
    d = dual_write()
    print(f"   {d['payments']} payments, {CRASH_RATE:.0%} crash rate")
    print(f"   published {d['published']}, LOST {d['lost']} ({d['lost_share']:.2%})")
    print("   no error, no retry, nothing to find later\n")

    print("2. outbox: the event written in the same transaction")
    o = with_outbox()
    print(f"   {o['payments']} payments, {o['crashes']} publisher crashes")
    print(f"   lost {o['lost']}, duplicated {o['duplicated']} "
          f"({o['duplicate_share']:.2%}), unpublished {o['left_unpublished']}")
    print("   nothing lost. The trade is duplicates, which a consumer can absorb\n")

    print("3. batch size")
    for row in batch_sizes():
        print(f"   {row['batch_size']:>4} per batch  {row['rounds']:>5,} rounds  "
              f"{row['ms']:8.1f} ms  {row['per_second']:>10,.0f} events/s")
    print()

    if data.exists():
        print(f"4. partitioning over {data.name}")
        for r in partitioning(data):
            print(
                f"   keyed by {r.key:11s} {r.out_of_order:>6,} out of order, "
                f"{r.payments_affected:>6,} of {r.multi_event_payments:,} "
                f"multi event payments ({r.share:.1%})"
            )
    else:
        print(f"4. partitioning skipped: {data} not found")

    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
