"""
neobank.reconcile — compare the ledger against an external source of truth.

Every real money system does this daily. A difference nobody can explain is a
bug, a timing difference, or fraud — and you cannot tell which until you look.
"""


def reconcile(ledger, external_balances):
    """Return one row per account with the internal and external view.

    Amounts are integer cents throughout, so a break is exact rather than
    "about a cent".
    """
    rows = []
    accounts = set(external_balances) | set(ledger.accounts)
    for account in sorted(accounts):
        if account not in ledger.accounts:
            rows.append({"account": account, "internal": None,
                         "external": external_balances[account],
                         "difference": None, "status": "unknown to the ledger"})
            continue
        internal = ledger.balance(account)
        if account not in external_balances:
            rows.append({"account": account, "internal": internal, "external": None,
                         "difference": None, "status": "not on the statement"})
            continue
        difference = internal - external_balances[account]
        rows.append({"account": account, "internal": internal,
                     "external": external_balances[account],
                     "difference": difference,
                     "status": "matched" if difference == 0 else "BREAK"})
    return rows


def breaks(rows):
    """Only the rows that need a human."""
    return [r for r in rows if r["status"] != "matched"]


def is_clean(rows):
    return not breaks(rows)
