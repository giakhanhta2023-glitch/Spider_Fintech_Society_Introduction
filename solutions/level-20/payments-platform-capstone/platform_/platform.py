"""The whole platform, wired, in one object.

    from platform_.platform import Platform
    platform = Platform()
    platform.smoke_test()

This is the single command the level asks for, minus the container runtime. There
is no Docker on the machine this solution was written on, so `docker/compose.yml`
is written and unexercised and this is the version that runs: six services, one
process, the same interfaces and the same failure modes.

What that buys, beyond running at all, is that the chaos scenarios are injectable
precisely. `platform.ledger.stop()` is a database outage at a known instant,
which is much harder to arrange against a container and much easier to reason
about afterwards.

What it costs is stated in the README: no network, no real serialisation, no
process boundaries, so nothing here proves anything about a deployment.
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field

from .api import Api, PayoutWorker
from .bank import Bank
from .ledger import Ledger
from .queue import Consumer, Outbox, Publisher
from .vault import Vault

TEST_PAN = "4111111111111111"        # a published test number, as everywhere else


@dataclass
class Platform:
    ledger: Ledger = field(default_factory=Ledger)
    vault: Vault = field(default_factory=Vault)
    outbox: Outbox = field(default_factory=Outbox)
    consumer: Consumer = field(default_factory=Consumer)
    bank: Bank = field(default_factory=Bank)
    api: Api = field(init=False)
    publisher: Publisher = field(init=False)
    worker: PayoutWorker = field(init=False)
    started_at: float = field(default_factory=time.time)

    # The asynchronous half, in its own thread. Without it the payout path blocks
    # the payment path, which is not how the platform is deployed and produced a
    # measured mean latency of 1.2 seconds against a service time of 0.04 ms: the
    # API was waiting for five hundred bank calls at a millisecond each.
    #
    # It is a thread rather than a process because the whole platform is one
    # process on purpose, and the README says what that does not prove.
    _settler: threading.Thread | None = field(default=None, init=False)
    _running: bool = field(default=False, init=False)
    settle_rounds: int = 0

    def __post_init__(self) -> None:
        self.api = Api(ledger=self.ledger, vault=self.vault, outbox=self.outbox)
        self.publisher = Publisher(outbox=self.outbox, consumer=self.consumer)
        self.worker = PayoutWorker(
            api=self.api, bank=self.bank, consumer=self.consumer, ledger=self.ledger
        )

    # ------------------------------------------------------------- driving
    def payment(self, amount_minor: int = 1999, merchant_id: str = "mer_0001") -> dict:
        return self.api.take_payment(merchant_id, amount_minor, TEST_PAN)

    def _enqueue_new_payouts(self) -> None:
        """Hand the worker exactly the payments the consumer just learned about."""
        for payment_id in self.consumer.take_new():
            self.worker.enqueue(payment_id)

    def settle(self) -> None:
        """Move everything as far as it can go: publish, pay out, sweep.

        Called between phases rather than continuously, because a capstone that
        only works when every component runs at exactly the right moment is a
        capstone that has not been tested.
        """
        self.publisher.drain_fully()
        self._enqueue_new_payouts()
        self.worker.run_once()
        self.worker.sweep()

    # -------------------------------------------------------- the background
    def start(self, interval: float = 0.005) -> None:
        """Run the publisher, the worker and the sweeper continuously."""
        if self._running:
            return
        self._running = True

        def loop() -> None:
            while self._running:
                self.settle()
                self.settle_rounds += 1
                time.sleep(interval)

        self._settler = threading.Thread(target=loop, daemon=True, name="settler")
        self._settler.start()

    def stop(self, drain: bool = True) -> None:
        self._running = False
        if self._settler is not None:
            self._settler.join(timeout=5)
            self._settler = None
        if drain:
            self.settle()

    def __enter__(self) -> Platform:
        self.start()
        return self

    def __exit__(self, *exception) -> None:
        self.stop()

    def smoke_test(self) -> dict:
        """One merchant, one payment, end to end. The level's first test.

        Returns what happened rather than True, because a smoke test that prints
        "ok" is one nobody reads when it starts lying.
        """
        result = self.payment(2500)
        assert result["status"] == 201, result
        self.settle()

        payment = self.api.payments[result["id"]]
        return {
            "payment_id": payment.id,
            "token": payment.token,
            "amount_minor": payment.amount_minor,
            "fee_minor": payment.fee_minor,
            "payout_state": payment.payout_state,
            "ledger_transactions": self.ledger.transactions(),
            "ledger_total": self.ledger.total(),
            "events_delivered": self.publisher.delivered,
            "bank_payments": len(self.bank.paid),
        }


def main() -> None:
    platform = Platform()
    outcome = platform.smoke_test()

    print("the platform, started and smoke tested\n")
    for key, value in outcome.items():
        print(f"   {key:22} {value}")
    print("\n   ledger_total is zero because every transaction balances, which is")
    print("   the invariant the reconciliation depends on.")


if __name__ == "__main__":
    main()
