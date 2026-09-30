"""
FinQuest level 4: replay a day of instructions through the ledger
=================================================================
A ledger is only interesting once something has gone through it. This reads the
day's traffic from two files and drives it through the `Ledger` in `ledger.py`,
one instruction at a time, exactly as a batch job would:

    data/level-04-accounts.csv       who exists, and which may go negative
    data/level-04-instructions.csv   what happened, in order

Every refusal is expected. Four of the seventy seven instructions are there to
be turned down, and the run counts them by reason rather than stopping: a batch
that dies on the first bad row is a batch somebody has to babysit at 6am.

Run:  python replay.py
"""

import csv
from pathlib import Path

from ledger import (InsufficientFunds, InvalidAmount, Ledger, LedgerError,
                    UnknownAccount, money, to_cents)

DATA = Path(__file__).resolve().parents[2] / "data"


def load_accounts(ledger, path=None):
    """Open every account in the file. `world` and `fee_income` already exist."""
    path = path or DATA / "level-04-accounts.csv"
    with path.open(encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            ledger.open_account(row["account_id"], kind=row["kind"],
                                allow_negative=row["allow_negative"] == "1")


def read_instructions(path=None):
    path = path or DATA / "level-04-instructions.csv"
    with path.open(encoding="utf-8") as fh:
        return list(csv.DictReader(fh))


def replay(ledger, instructions):
    """Apply every instruction, counting what happened and what was refused.

    The keys dictionary is the only state this function keeps, and it exists
    because a reversal names the payment it cancels by its idempotency key: a
    file written the night before cannot know the transaction id your ledger
    will hand out tomorrow.
    """
    seen = {}                       # idempotency key -> txn id
    done = {"deposit": 0, "transfer": 0, "split": 0, "reverse": 0}
    refused = {"overdraft": 0, "unknown account": 0, "invalid amount": 0,
               "other": 0}
    retries = 0

    for row in instructions:
        kind, key = row["kind"], row["key"]
        try:
            if kind == "deposit":
                ledger.deposit(row["src"], to_cents(row["amount"]), row["memo"])
                done["deposit"] += 1

            elif kind == "transfer":
                if key and key in seen:
                    retries += 1            # the phone tried again
                    continue
                txn = ledger.transfer(
                    row["src"], row["dst"], to_cents(row["amount"]),
                    memo=row["memo"], fee=to_cents(row["fee"] or "0"), key=key or None)
                if key:
                    seen[key] = txn
                done["transfer"] += 1

            elif kind == "split":
                ledger.split_payment(row["src"], row["dst"].split(";"),
                                     to_cents(row["amount"]), memo=row["memo"])
                done["split"] += 1

            elif kind == "reverse":
                # `src` holds the key of the payment being cancelled.
                ledger.reverse(seen[row["src"]], memo=row["memo"])
                done["reverse"] += 1

            else:
                raise LedgerError(f"unknown instruction kind {kind!r}")

        except InsufficientFunds:
            refused["overdraft"] += 1
        except UnknownAccount:
            refused["unknown account"] += 1
        except InvalidAmount:
            refused["invalid amount"] += 1
        except LedgerError:
            refused["other"] += 1

        # The invariant after every single instruction, including the refused
        # ones: a refusal that wrote half a transaction is the worst outcome
        # here, and this is the line that would catch it.
        ledger.check_invariant()

    return done, refused, retries


def main():
    ledger = Ledger()
    load_accounts(ledger)
    instructions = read_instructions()
    done, refused, retries = replay(ledger, instructions)

    print(f"replayed {len(instructions)} instructions\n")
    print("   posted")
    for kind, count in done.items():
        print(f"      {kind:<10}{count:>4}")
    print("   refused")
    for reason, count in refused.items():
        print(f"      {reason:<16}{count:>4}")
    print(f"      retry ignored   {retries:>4}")

    print("\n   closing balances")
    for account_id in sorted(ledger.accounts):
        print(f"      {account_id:<16}{money(ledger.balance(account_id)):>14}")

    total = sum(entry['amount'] for entry in ledger.entries)
    print(f"\n   {len(ledger.entries):,} entries, summing to {total}")
    print(f"   invariant holds: {ledger.check_invariant()}")

    # The three numbers worth checking against your own run.
    assert total == 0
    assert refused == {"overdraft": 1, "unknown account": 1,
                       "invalid amount": 1, "other": 0}
    assert retries == 1
    print("\n   the day balances, and every planted refusal was refused")


if __name__ == "__main__":
    main()
