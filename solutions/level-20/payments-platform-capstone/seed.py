"""One merchant, one payment, end to end. The smoke test.

    python seed.py

The level's first test: a fresh clone starts the platform with one command and a
payment flows from the API through the vault, the ledger, the event stream and the
payout without anybody intervening.

It prints what happened rather than "ok", because a smoke test that prints ok is
one nobody reads when it starts lying, and it exits non zero when any of the five
assertions fails, so it works in a pipeline as well as in a terminal.
"""

from __future__ import annotations

import sys

from platform_.platform import Platform
from recon.daily import reconcile

MERCHANT = "mer_0001"
AMOUNT_MINOR = 2_500          # $25.00
TEST_PAN = "4111111111111111"  # a published test number. Nothing here is a card


def main() -> int:
    platform = Platform()

    print("1. taking one payment\n")
    response = platform.api.take_payment(MERCHANT, AMOUNT_MINOR, TEST_PAN)
    if response["status"] != 201:
        print(f"   FAILED: {response}")
        return 1

    payment_id = response["id"]
    print(f"   payment      {payment_id}")
    print(f"   amount       {AMOUNT_MINOR} minor units")
    print(f"   fee          {response['fee_minor']} minor units")
    print(f"   token        {response['token']}")
    print("   card number  never stored outside the vault")

    print("\n2. letting the asynchronous half run\n")
    platform.settle()
    payment = platform.api.payments[payment_id]
    print(f"   payout state {payment.payout_state}")
    print(f"   bank ref     {payment.bank_reference}")
    print(f"   events       {platform.publisher.delivered} delivered")

    print("\n3. checking the money\n")
    print(f"   ledger transactions  {platform.ledger.transactions()}")
    print(f"   ledger total         {platform.ledger.total()}   (zero, always)")
    for account in ("settlement_receivable", "merchant_payable", "fee_income",
                    "bank_clearing"):
        print(f"   {account:22} {platform.ledger.balance(account):>8}")

    print("\n4. reconciling\n")
    result = reconcile(platform)
    print(f"   {result.summary()}")
    for found in result.breaks:
        print(f"      {found}")

    checks = {
        "the payment was accepted": response["status"] == 201,
        "the card number is not in the response": TEST_PAN not in str(response),
        "the payout reached a final state": payment.payout_state == "paid",
        "the ledger balances": platform.ledger.total() == 0,
        "the reconciliation is clean": result.clean,
    }

    print("\n5. the smoke test\n")
    for name, passed in checks.items():
        print(f"   {'pass' if passed else 'FAIL'}  {name}")

    failed = [name for name, passed in checks.items() if not passed]
    if failed:
        print(f"\n{len(failed)} check(s) failed")
        return 1

    print("\nthe platform works end to end. Next:")
    print("   python -m bench.load --minutes 60     an hour of load")
    print("   python -m chaos.scenarios             four injected failures")
    print("   python -m migrate.under_load          a migration with traffic on it")
    return 0


if __name__ == "__main__":
    sys.exit(main())
