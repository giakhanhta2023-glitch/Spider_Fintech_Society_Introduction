"""The same payment operation in Python, for the comparison the level asks for.

    python bench/python_baseline.py

**What is being compared, precisely.** One function: compute the fee in integer
minor units, move the payment through the state machine, and insert it under an
idempotency key. No HTTP, no database, no framework. That is deliberate and it is
the only comparison that says anything about the runtimes rather than about who
wrote the faster SQL, and the README says what it therefore does not tell you.

The Java side of the same measurement is `finquest.bench.WarmUp` phase 1, which
runs the identical operation against `PaymentStore.takePayment`.

**What this comparison cannot tell you.** In a real payment service the database
round trip is 1 to 5 ms and this function is microseconds, so the runtime is 1% of
the request and the language is not why anything is slow. The reason to measure it
anyway is to be able to say that sentence with a number behind it.
"""

from __future__ import annotations

import statistics
import sys
import time

FEE_BASIS_POINTS = 290

# The state machine, as level 9's table. A dict of allowed transitions rather than
# an enum with a switch, which is the shape difference the comparison is about: the
# Java version cannot compile an unhandled state and this one cannot notice.
TRANSITIONS = {
    ("requested", "authorize"): "authorized",
    ("authorized", "capture"): "captured",
    ("authorized", "void"): "voided",
    ("authorized", "expire"): "expired",
    ("captured", "refund"): "refunded",
    ("captured", "chargeback"): "charged_back",
    ("refunded", "chargeback"): "charged_back",
}


class IllegalTransition(Exception):
    pass


def next_state(state: str, event: str) -> str:
    try:
        return TRANSITIONS[(state, event)]
    except KeyError:
        raise IllegalTransition(f"cannot {event} a payment that is {state}") from None


def fee_minor(amount_minor: int) -> int:
    """Integer arithmetic, rounded half up. The same line as Money.percentage."""
    return (amount_minor * FEE_BASIS_POINTS + 5_000) // 10_000


class PaymentStore:
    """The same three things the Java store does, and nothing else."""

    def __init__(self) -> None:
        self._by_id: dict[str, dict] = {}
        self._by_key: dict[str, str] = {}
        self._sequence = 0

    def take_payment(self, merchant_id: str, amount_minor: int, token: str,
                     key: str) -> tuple[dict, bool]:
        existing = self._by_key.get(key)
        if existing is not None:
            return self._by_id[existing], False

        self._sequence += 1
        payment_id = f"pay_{self._sequence:08d}"
        payment = {
            "id": payment_id,
            "merchant_id": merchant_id,
            "amount_minor": amount_minor,
            "fee_minor": fee_minor(amount_minor),
            "state": next_state("requested", "authorize"),
            "token": token,
        }
        self._by_id[payment_id] = payment
        self._by_key[key] = payment_id
        return payment, True


def measure(buckets: int = 12, calls_per_bucket: int = 20_000) -> list[dict]:
    """The same shape as the Java warm up: buckets, so a curve is visible.

    Python has no JIT here, so the expectation is a flat line. That is the point of
    running the same shape: a flat line is a result, and it is the contrast with the
    JVM's eight fold improvement over the first second.
    """
    store = PaymentStore()
    rows = []

    for bucket in range(buckets):
        micros: list[float] = []
        for i in range(calls_per_bucket):
            started = time.perf_counter_ns()
            store.take_payment("mer_0001", 1999, "tok_test", f"idem_{bucket}_{i}")
            micros.append((time.perf_counter_ns() - started) / 1_000)
        micros.sort()
        rows.append({
            "bucket": bucket + 1,
            "p50_us": micros[len(micros) // 2],
            "p99_us": micros[int(len(micros) * 0.99)],
            "max_us": micros[-1],
            "mean_us": statistics.fmean(micros),
            "per_second": calls_per_bucket / (sum(micros) / 1e6),
        })
    return rows


def main() -> None:
    print(f"Python {sys.version.split()[0]}, the same operation as "
          f"finquest.bench.WarmUp phase 1\n")
    print(f"{'bucket':>8}  {'p50 us':>12}  {'p99 us':>12}  {'max us':>12}  {'calls/s':>12}")

    rows = measure()
    for row in rows:
        print(f"{row['bucket']:>8}  {row['p50_us']:>12.2f}  {row['p99_us']:>12.2f}  "
              f"{row['max_us']:>12.2f}  {row['per_second']:>12,.0f}")

    first, last = rows[0], rows[-1]
    print(f"\np50 {first['p50_us']:.2f} us to {last['p50_us']:.2f} us "
          f"({first['p50_us'] / last['p50_us']:.1f}x), "
          f"which is flat because there is nothing compiling.")
    print(f"steady state: {last['p50_us']:.2f} us p50, {last['per_second']:,.0f} calls "
          f"a second on one core.")


if __name__ == "__main__":
    main()
