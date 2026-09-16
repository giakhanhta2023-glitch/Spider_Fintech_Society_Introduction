"""
FinQuest level 4: Mini ledger and payment engine  (reference solution)
=====================================================================
A double-entry ledger that cannot lose money:

  * every transaction's legs sum to exactly zero
  * money is integer cents, never floats
  * entries are append-only. Corrections are reversing entries
  * a retried transfer with the same idempotency key posts once
  * an invalid transfer raises and writes nothing at all

Uses only Level 4 material: classes, dicts, lists, custom exceptions,
integer arithmetic, f-strings, and datetime.

Run:  python ledger.py
"""

from datetime import datetime


# ---------------------------------------------------------------------------
# Errors, a caller can catch LedgerError broadly, or one kind precisely
# ---------------------------------------------------------------------------
class LedgerError(Exception):
    """Base class for every refusal this ledger makes."""


class UnknownAccount(LedgerError):
    pass


class InsufficientFunds(LedgerError):
    pass


class InvalidAmount(LedgerError):
    pass


class DuplicateAccount(LedgerError):
    pass


# ---------------------------------------------------------------------------
# Money helpers: parse once at the edge, format only for display
# ---------------------------------------------------------------------------
def to_cents(amount_text):
    """'25.00' -> 2500.  round(), never int() truncation."""
    return int(round(float(amount_text) * 100))


def money(cents):
    """2500 -> '$25.00'   |   -2500 -> '-$25.00'"""
    sign = "-" if cents < 0 else ""
    return f"{sign}${abs(cents) / 100:,.2f}"


# ---------------------------------------------------------------------------
class Account:
    def __init__(self, account_id, kind="customer", allow_negative=False):
        self.id = account_id
        self.kind = kind
        self.allow_negative = allow_negative

    def __repr__(self):
        return f"Account({self.id}, {self.kind}{', may go negative' if self.allow_negative else ''})"


class Ledger:
    """Accounts and an append-only list of entries. The entries are the truth."""

    def __init__(self):
        self.accounts = {}
        self.entries = []          # append-only: never edited, never deleted
        self._keys = {}            # idempotency key -> txn_id
        self._next_id = 1

        # The outside world. Its balance mirrors the customer money we hold.
        self.open_account("world", kind="contra", allow_negative=True)
        self.open_account("fee_income", kind="revenue", allow_negative=True)

    # ---------------- internals ----------------
    def _post(self, legs, memo):
        """Write a balanced set of legs: [(account_id, signed_cents),...]"""
        if not legs:
            raise LedgerError("a transaction needs at least one leg")
        if sum(amount for _, amount in legs) != 0:
            raise LedgerError("transaction does not balance")

        txn_id = f"TXN{self._next_id:05d}"
        self._next_id += 1
        stamp = datetime.now().isoformat(timespec="seconds")
        for account_id, amount in legs:
            self.entries.append({
                "txn_id": txn_id,
                "account": account_id,
                "amount": amount,
                "memo": memo,
                "at": stamp,
            })
        return txn_id

    def _require(self, *account_ids):
        for account_id in account_ids:
            if account_id not in self.accounts:
                raise UnknownAccount(f"no such account: {account_id}")

    # ---------------- public API ----------------
    def open_account(self, account_id, kind="customer", allow_negative=False):
        if account_id in self.accounts:
            raise DuplicateAccount(f"account {account_id} already exists")
        self.accounts[account_id] = Account(account_id, kind, allow_negative)
        return self.accounts[account_id]

    def balance(self, account_id):
        """Derived from the entries. Never stored, so it can never disagree."""
        self._require(account_id)
        return sum(e["amount"] for e in self.entries if e["account"] == account_id)

    def deposit(self, account_id, amount, memo="deposit"):
        if amount <= 0:
            raise InvalidAmount("deposit must be positive")
        self._require(account_id)
        return self._post([(account_id, amount), ("world", -amount)], memo)

    def withdraw(self, account_id, amount, memo="withdrawal"):
        if amount <= 0:
            raise InvalidAmount("withdrawal must be positive")
        self._require(account_id)
        if not self.accounts[account_id].allow_negative and self.balance(account_id) < amount:
            raise InsufficientFunds(
                f"{account_id} holds {money(self.balance(account_id))}, needs {money(amount)}")
        return self._post([(account_id, -amount), ("world", amount)], memo)

    def transfer(self, src, dst, amount, memo="transfer", fee=0, key=None):
        """Validate everything, then write. Never the other way round."""
        if key is not None and key in self._keys:
            return self._keys[key]                      # idempotent replay

        if amount <= 0:
            raise InvalidAmount("amount must be positive")
        if fee < 0:
            raise InvalidAmount("fee cannot be negative")
        self._require(src, dst)
        if src == dst:
            raise LedgerError("cannot transfer to the same account")

        total = amount + fee
        if not self.accounts[src].allow_negative and self.balance(src) < total:
            raise InsufficientFunds(
                f"{src} holds {money(self.balance(src))}, needs {money(total)}")

        legs = [(src, -total), (dst, amount)]
        if fee:
            legs.append(("fee_income", fee))

        txn_id = self._post(legs, memo)
        if key is not None:
            self._keys[key] = txn_id                    # only after success
        return txn_id

    def split_payment(self, src, recipients, amount, memo="split"):
        """Divide amount between recipients. The leftover cents go to the first
        recipients in order: deterministic, and the transaction still balances.
        """
        if amount <= 0:
            raise InvalidAmount("amount must be positive")
        if not recipients:
            raise LedgerError("no recipients")
        self._require(src, *recipients)
        if not self.accounts[src].allow_negative and self.balance(src) < amount:
            raise InsufficientFunds(f"{src} holds {money(self.balance(src))}, needs {money(amount)}")

        share, leftover = divmod(amount, len(recipients))
        shares = [share + (1 if i < leftover else 0) for i in range(len(recipients))]
        legs = [(src, -amount)] + list(zip(recipients, shares))
        return self._post(legs, memo)

    def reverse(self, txn_id, memo=None):
        """Cancel a transaction by writing its mirror image. Nothing is deleted."""
        original = [e for e in self.entries if e["txn_id"] == txn_id]
        if not original:
            raise LedgerError(f"unknown transaction {txn_id}")
        legs = [(e["account"], -e["amount"]) for e in original]
        return self._post(legs, memo or f"reversal of {txn_id}")

    def check_invariant(self):
        """The whole ledger, and every transaction in it, must sum to zero."""
        total = sum(e["amount"] for e in self.entries)
        if total != 0:
            raise LedgerError(f"ledger is out of balance by {money(total)}")
        per_txn = {}
        for e in self.entries:
            per_txn[e["txn_id"]] = per_txn.get(e["txn_id"], 0) + e["amount"]
        broken = [t for t, v in per_txn.items() if v != 0]
        if broken:
            raise LedgerError(f"unbalanced transactions: {broken}")
        return True

    def statement(self, account_id):
        self._require(account_id)
        rows = [e for e in self.entries if e["account"] == account_id]
        running = 0
        print(f"\nStatement: {account_id}  ({self.accounts[account_id].kind})")
        print(f"{'txn':<10}{'memo':<26}{'amount':>13}{'balance':>15}")
        print("-" * 64)
        for e in rows:
            running += e["amount"]
            print(f"{e['txn_id']:<10}{e['memo'][:25]:<26}{money(e['amount']):>13}{money(running):>15}")
        print("-" * 64)
        print(f"{'':<36}{'Closing':>13}{money(running):>15}")


# ---------------------------------------------------------------------------
# Tests: happy path and every refusal
# ---------------------------------------------------------------------------
def tests():
    # money helpers
    assert to_cents("19.99") == 1999
    assert to_cents("0.1") + to_cents("0.2") == to_cents("0.3")     # floats cannot do this
    assert to_cents("25") == 2500
    assert money(-2500) == "-$25.00"
    assert money(0) == "$0.00"

    led = Ledger()
    led.open_account("alice")
    led.open_account("bob")

    # deposit
    led.deposit("alice", 10_000)
    assert led.balance("alice") == 10_000
    assert led.balance("world") == -10_000
    assert led.check_invariant()

    # transfer with a fee: three legs, still zero
    txn = led.transfer("alice", "bob", 2_500, fee=50, memo="ticket")
    assert led.balance("alice") == 7_450
    assert led.balance("bob") == 2_500
    assert led.balance("fee_income") == 50
    assert led.check_invariant()

    # idempotency: same key, one posting, same id back
    before = len(led.entries)
    first = led.transfer("alice", "bob", 100, key="abc")
    mid = len(led.entries)
    second = led.transfer("alice", "bob", 100, key="abc")
    assert first == second
    assert len(led.entries) == mid, "a retry must not write new entries"
    assert mid == before + 2

    # refusals all write nothing
    for bad in [
        lambda: led.transfer("alice", "bob", 999_999),      # InsufficientFunds
        lambda: led.transfer("alice", "nobody", 100),       # UnknownAccount
        lambda: led.transfer("alice", "bob", 0),            # InvalidAmount
        lambda: led.transfer("alice", "bob", -5),           # InvalidAmount
        lambda: led.transfer("alice", "alice", 100),        # LedgerError
        lambda: led.deposit("alice", 0),                    # InvalidAmount
        lambda: led.withdraw("bob", 10_000_000),            # InsufficientFunds
        lambda: led.open_account("alice"),                  # DuplicateAccount
    ]:
        count = len(led.entries)
        try:
            bad()
        except LedgerError:
            assert len(led.entries) == count, "a refused operation wrote entries"
        else:
            raise AssertionError("expected a LedgerError")

    # reversal restores balances and keeps the original entries
    alice_before, bob_before, fees_before = (led.balance("alice"), led.balance("bob"),
                                             led.balance("fee_income"))
    entries_before = len(led.entries)
    led.reverse(txn)
    assert led.balance("alice") == alice_before + 2_550
    assert led.balance("bob") == bob_before - 2_500
    assert led.balance("fee_income") == fees_before - 50
    assert len(led.entries) > entries_before, "reversal must add entries, not remove them"
    assert any(e["txn_id"] == txn for e in led.entries), "the original must still be visible"
    assert led.check_invariant()

    # penny splitting: 100 cents, three ways, nothing lost
    for name in ("c1", "c2", "c3"):
        led.open_account(name)
    split = led.split_payment("alice", ["c1", "c2", "c3"], 100)
    assert [led.balance("c1"), led.balance("c2"), led.balance("c3")] == [34, 33, 33]
    assert sum(e["amount"] for e in led.entries if e["txn_id"] == split) == 0
    assert led.check_invariant()

    # unknown transaction cannot be reversed
    try:
        led.reverse("TXN99999")
    except LedgerError:
        pass
    else:
        raise AssertionError("expected a LedgerError")

    print("all 8 test groups passed: invariant held after every operation\n")


# ---------------------------------------------------------------------------
def demo():
    """A story a treasurer could read."""
    led = Ledger()
    led.open_account("society")
    led.open_account("member_mai")
    led.open_account("supplier_print")

    print("=" * 64)
    print(f"{'SOCIETY WALLET: EVENT DAY':^64}")
    print("=" * 64)

    led.deposit("member_mai", to_cents("120.00"), memo="top-up from bank")
    led.deposit("society", to_cents("500.00"), memo="opening float")

    ticket = led.transfer("member_mai", "society", to_cents("45.00"),
                          fee=to_cents("0.50"), memo="gala ticket", key="ticket-mai-001")
    print(f"ticket sold: {ticket}")

    retry = led.transfer("member_mai", "society", to_cents("45.00"),
                         fee=to_cents("0.50"), memo="gala ticket", key="ticket-mai-001")
    print(f"phone retried the same request -> {retry} (no second charge)")

    try:
        led.transfer("member_mai", "society", to_cents("5000.00"), memo="oversized")
    except InsufficientFunds as err:
        print(f"refused: {err}")

    led.transfer("society", "supplier_print", to_cents("180.00"), memo="posters")
    refund = led.transfer("society", "member_mai", to_cents("20.00"), memo="partial refund")
    led.reverse(refund, memo="refund issued in error")

    led.split_payment("society", ["member_mai", "supplier_print"], to_cents("10.01"),
                      memo="split the leftover float")

    for account in ("society", "member_mai", "supplier_print", "fee_income", "world"):
        print(f"{account:<18}{money(led.balance(account)):>14}")

    led.statement("member_mai")
    led.statement("society")

    assert led.check_invariant()
    print(f"\ninvariant holds: {len(led.entries)} entries summing to $0.00")


if __name__ == "__main__":
    tests()
    demo()
