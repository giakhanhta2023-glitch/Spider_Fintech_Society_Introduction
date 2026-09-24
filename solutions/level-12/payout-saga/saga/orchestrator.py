"""Three steps, two systems, no transaction.

    1. debit the merchant balance      (our database)
    2. submit the payout to the bank   (their API, over the network)
    3. record the bank reference       (our database)

Steps 1 and 3 can share a transaction. Step 2 cannot join it, because it
happens on a computer we do not own, and no amount of careful coding changes
that. Two orchestrators live here: the naive one, kept because the fix only
means something next to the thing it replaces, and the saga.
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field

from .bank import Bank, BankRejected, BankTimeout
from .store import Payout, Store


class ProcessCrashed(Exception):
    """Our own process dies after submitting, before recording anything."""


@dataclass
class Orchestrator:
    store: Store
    bank: Bank
    rng: random.Random
    crash_after_submit: float = 0.04
    compensate_on_reject: bool = True     # the difference between naive and saga
    outcomes: dict[str, int] = field(default_factory=dict)

    def _count(self, what: str) -> None:
        self.outcomes[what] = self.outcomes.get(what, 0) + 1

    def run(self, merchant_id: str, amount_minor: int, our_ref: str) -> Payout:
        payout = self.store.create(merchant_id, amount_minor, our_ref)

        # Step 1, committed before step 2 begins.
        self.store.debit(payout)

        # Step 2. Everything interesting happens in the three except branches.
        payout.attempts += 1
        try:
            if self.rng.random() < self.crash_after_submit:
                self.bank.submit(payout.our_ref, amount_minor)   # it happened
                raise ProcessCrashed()                            # and we never wrote it down
            bank_ref = self.bank.submit(payout.our_ref, amount_minor)

        except BankRejected:
            # A FAILURE: we know exactly what happened, so we can act.
            if self.compensate_on_reject:
                self.store.compensate(payout)
                self._count("rejected, money returned")
            else:
                self.store.set_state(payout, "failed")
                self._count("rejected, money still debited")
            return payout

        except BankTimeout:
            # UNCERTAINTY, which is a different thing and needs a different
            # mechanism. Do not retry: it might pay twice. Do not compensate:
            # it might cancel a real payment. Record the truth, which is that
            # we do not know, and let the sweeper establish it.
            self.store.set_state(payout, "unknown")
            self._count("timeout, state unknown")
            return payout

        except ProcessCrashed:
            # The row stays in 'debited' with the reference stored, which is
            # exactly the state that tells the sweeper where to look.
            self._count("crashed after submitting")
            return payout

        # Step 3.
        self.store.set_state(payout, "paid", bank_ref=bank_ref)
        self._count("paid")
        return payout


def naive(store: Store, bank: Bank, rng: random.Random, **kwargs) -> Orchestrator:
    """No compensation. Kept in the repository on purpose: the saga's number
    means nothing without this one next to it."""
    return Orchestrator(store, bank, rng, compensate_on_reject=False, **kwargs)


def saga(store: Store, bank: Bank, rng: random.Random, **kwargs) -> Orchestrator:
    """Every step has a compensating action, run in reverse on failure.

    Not a rollback: the debit really happened, and so did the credit that
    reversed it, and both stay in the ledger forever. Accountants call that a
    semantic rollback, and it is the only kind available once a step has left
    your database.
    """
    return Orchestrator(store, bank, rng, compensate_on_reject=True, **kwargs)
