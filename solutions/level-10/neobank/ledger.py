"""
neobank.ledger: double-entry ledger (from Level 4)
===================================================
A double-entry ledger that cannot lose money:

  * every transaction's legs sum to exactly zero
  * money is integer cents, never floats
  * entries are append-only. Corrections are reversing entries
  * a retried transfer with the same idempotency key posts once
  * an invalid transfer raises and writes nothing at all

A service-layer module: it raises, it returns, and it never prints.
The statement renderer moved to the interface layer where it belongs.
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
        """Entries for one account with a running balance, as plain rows.

        Returns data; the interface decides how to draw it. This is the layer
        boundary in one method.
        """
        self._require(account_id)
        running = 0
        rows = []
        for e in self.entries:
            if e["account"] != account_id:
                continue
            running += e["amount"]
            rows.append({**e, "balance": running})
        return rows
