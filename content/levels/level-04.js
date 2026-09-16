/* =========================================================================
   Level 4: payments and ledgers
   ========================================================================= */
FQ.registerLevel({
  id: 4,
  codename: 'ledger',
  title: 'Payments and the double-entry ledger',
  tagline: 'Every fintech quietly runs on a ledger that balances whatever happens. You build one.',
  difficulty: 4,
  minutes: 150,
  tags: ['double-entry', 'idempotency', 'classes'],
  summary: 'A payments company is a ledger with a marketing department. This level teaches the 500-year-old accounting ' +
           'invariant that keeps money from appearing out of nowhere, and the engineering rules that keep it true under retries.',

  objectives: [
    'Explain double-entry bookkeeping and why every transaction must sum to zero',
    'Store money as integer minor units and format it only for display',
    'Model accounts and entries with Python classes',
    'Enforce invariants by raising errors instead of writing bad data',
    'Make a payment endpoint idempotent so a retry cannot double-charge',
    'Correct mistakes with reversing entries rather than deletions'
  ],

  knowledge: [
    { h: 'Money cannot appear from nowhere' },
    { p: 'Every movement of money has two sides: it leaves somewhere and arrives somewhere. **Double-entry bookkeeping**, ' +
         'standardised in Venice in 1494 and unchanged since, writes both sides as separate entries and requires them to cancel out. ' +
         'If a transaction\'s entries do not sum to zero, the transaction is invalid, not "slightly off", *invalid*.' },
    { code: 'Alice pays Bob $25.00\n\n  entry 1:  alice   -2500   (cents)\n  entry 2:  bob     +2500\n  ---------------------------\n  sum                    0     <- the invariant', lang: 'text', label: 'one transfer, two entries' },
    { p: 'In traditional accounting the two sides are called **debit** and **credit**: a debit increases an asset account and ' +
         'decreases a liability one, which confuses everybody for about a month. Many modern ledger systems keep the identical ' +
         'invariant with **signed amounts**: positive means value in, negative means value out, and a valid transaction sums to zero. ' +
         'That is the model you will build, and it is exactly equivalent.' },
    { money: 'This invariant is the reason a bank can survive a crashed server mid-payment. Either both entries were written, ' +
             'or the transaction never happened. There is no valid state in between.' },

    { h: 'Three or more sides: fees' },
    { p: 'Nothing says a transaction has only two entries. It needs only to **balance**. A $25 payment with a 50-cent platform fee is three entries:' },
    { code: '  customer   -2500\n  merchant   +2450\n  fee_income   +50\n  --------------------\n  sum            0', lang: 'text', label: 'a payment with a fee' },
    { p: 'This is how every payment processor records revenue. The customer\'s view ("I paid $25") and the merchant\'s view ' +
         '("I received $24.50") are both true, on the same balanced transaction.' },

    { h: 'The balance is derived, never stored' },
    { p: 'An account\'s balance is the **sum of its entries**, not a column you update. If you store a balance and also store ' +
         'entries, the day will come when they disagree, and you will not know which one is lying.' },
    { code: 'def balance(account_id):\n    return sum(e.amount for e in entries if e.account == account_id)', lang: 'python' },
    { p: 'Production systems cache balances for speed, but the cache is always rebuildable from entries. The entries are the truth.' },
    { warn: 'Never `UPDATE` or `DELETE` a posted entry. If a payment was wrong, post a **reversing entry** that cancels it. ' +
            'The original stays visible forever. That is what makes the history auditable, and in most jurisdictions, legal.' },

    { h: 'Integer minor units, revisited' },
    { p: 'Level 1 warned you: never store a balance as a float. Here is the discipline in practice.' },
    { table: {
      head: ['Rule', 'Code'],
      rows: [
        ['Store in minor units', '`amount_cents = 2500`'],
        ['Parse user input once, at the edge', '`cents = round(float(text) * 100)`'],
        ['Do all arithmetic in integers', '`total = a + b` (never floats)'],
        ['Format only at display time', '`f"${cents / 100:,.2f}"`'],
        ['Never divide without deciding rounding', 'splitting 100 cents three ways needs a rule for the leftover cent']
      ]
    }},
    { p: 'That last one has a name: the **penny-splitting problem**. If you split $10.00 between three people you cannot give ' +
         'each $3.333... Someone must get the extra cent, and your code must decide who: deterministically. Silently dropping ' +
         'it means your transaction no longer sums to zero.' },

    { h: 'Idempotency: the network will lie to you' },
    { p: 'A user taps Pay. The request reaches your server, you post the transaction, and the response is lost on the way back. ' +
         'The phone retries. Without protection, you just charged them twice.' },
    { p: 'The fix is an **idempotency key**: the client generates a unique string per intent and sends it with the request. ' +
         'The server records the key with the resulting transaction. If a request arrives with a key it has already seen, ' +
         'it returns the *original* result instead of doing the work again.' },
    { code: 'if key in self._keys:\n    return self._keys[key]        # same answer, no second charge\n\ntxn = self._post(...)\nself._keys[key] = txn\nreturn txn', lang: 'python' },
    { money: 'Stripe, Adyen, and every serious payments API require an idempotency key on writes. It is the single most ' +
             'important pattern in payment engineering, and a favourite interview question.' },

    { h: 'The life of a payment' },
    { table: {
      head: ['State', 'Meaning', 'Money moved?'],
      rows: [
        ['`pending`', 'Authorized: funds reserved on the payer', 'No'],
        ['`posted`', 'Captured and written to the ledger', 'Yes, in your books'],
        ['`settled`', 'Cleared between institutions', 'Yes, for real'],
        ['`reversed`', 'Cancelled by a balancing entry', 'Net zero'],
        ['`failed`', 'Rejected before any entry was written', 'No']
      ]
    }},
    { p: 'Refunds, chargebacks and disputes are all reversals with different reasons and different deadlines. ' +
         'Your ledger does not need to know which. It only needs to record a balanced, reasoned entry.' },

    { h: 'Fail loudly, not quietly' },
    { p: 'When a transfer is invalid (unknown account, zero amount, insufficient funds) the correct behaviour is to ' +
         '**raise an error and write nothing**. Returning `False` or `None` invites a caller to ignore it, and a ledger that ' +
         'silently skips a write is worse than one that crashes.' },
    { code: 'class InsufficientFunds(Exception):\n    """Raised when an account cannot cover a debit."""\n\nif self.balance(src) < amount:\n    raise InsufficientFunds(f"{src} has {self.balance(src)}, needs {amount}")', lang: 'python' },
    { tip: 'Custom exception classes let a caller handle *this* failure differently from a bug in your code. ' +
           '`except InsufficientFunds:` reads better than checking a return value, and cannot be forgotten.' }
  ],

  tutorial: {
    intro: 'New notebook: `finquest-level-04.ipynb`. This level introduces classes: the tool for bundling data with the ' +
           'rules that protect it. Everything the project needs is here.',
    steps: [
      {
        t: 'Dictionaries: the record type you already have',
        blocks: [
          { p: 'A dict maps keys to values. A list of dicts is a perfectly good table when you do not need pandas.' },
          { code: 'entry = {"txn_id": "T1", "account": "alice", "amount": -2500}\nprint(entry["account"])\nprint(entry.get("memo", "no memo"))     #.get never raises KeyError\n\nentries = [\n    {"txn_id": "T1", "account": "alice", "amount": -2500},\n    {"txn_id": "T1", "account": "bob",   "amount":  2500},\n]\nprint(sum(e["amount"] for e in entries))   # 0 -> balanced', lang: 'python' },
          { p: 'That last line is a **generator expression** inside `sum()`: read it as "the amount of each entry, added up". ' +
               'You will write it constantly.' }
        ],
        check: 'You can build a list of entry dicts and prove they sum to zero.'
      },
      {
        t: 'Your first class',
        blocks: [
          { p: 'A class bundles data (**attributes**) with the operations allowed on it (**methods**). `__init__` runs when ' +
               'you create an instance; `self` is the instance itself.' },
          { code: 'class Account:\n    def __init__(self, account_id, kind="customer", allow_negative=False):\n        self.id = account_id\n        self.kind = kind\n        self.allow_negative = allow_negative\n\n    def __repr__(self):\n        return f"Account({self.id}, {self.kind})"\n\n\na = Account("alice")\nb = Account("fee_income", kind="revenue", allow_negative=True)\nprint(a, b)', lang: 'python' },
          { p: '`__repr__` controls how the object prints. Adding one takes ten seconds and saves hours of debugging.' },
          { tip: 'Why a class instead of a dict? Because a class can *refuse*. A dict will happily let anyone set ' +
                 '`balance = -999999`; a class exposes only the methods you allow.' }
        ],
        check: 'You created two Account objects and they print readably.'
      },
      {
        t: 'Money helpers: cents in, dollars out',
        blocks: [
          { code: 'def to_cents(amount_text):\n    """Parse user input into integer cents, once, at the edge."""\n    return int(round(float(amount_text) * 100))\n\ndef money(cents):\n    """Format integer cents for display."""\n    sign = "-" if cents < 0 else ""\n    return f"{sign}${abs(cents) / 100:,.2f}"\n\nprint(to_cents("25.00"))    # 2500\nprint(to_cents("0.1") + to_cents("0.2") == to_cents("0.3"))   # True\nprint(money(-2500))         # -$25.00', lang: 'python' },
          { p: 'Compare that `True` with level 1\'s `0.1 + 0.2 == 0.3` being `False`. That is the entire argument for minor units, ' +
               'in one line.' },
          { warn: '`int(2.999)` truncates to 2. It does not round. Always `int(round(x))` when converting money, or you will ' +
                  'lose a cent on roughly half of all inputs.' }
        ],
        check: 'to_cents("19.99") returns 1999 and money(1999) returns $19.99.'
      },
      {
        t: 'Raise your own exceptions',
        blocks: [
          { code: 'class LedgerError(Exception):\n    """Base class for everything this ledger refuses to do."""\n\nclass UnknownAccount(LedgerError):\n    pass\n\nclass InsufficientFunds(LedgerError):\n    pass\n\nclass InvalidAmount(LedgerError):\n    pass\n\n\ndef withdraw(balance, amount):\n    if amount <= 0:\n        raise InvalidAmount("amount must be positive")\n    if amount > balance:\n        raise InsufficientFunds(f"balance {balance}, requested {amount}")\n    return balance - amount\n\n\ntry:\n    withdraw(1000, 5000)\nexcept InsufficientFunds as err:\n    print("refused:", err)', lang: 'python' },
          { p: 'Subclassing a common `LedgerError` lets a caller catch everything from your ledger with one `except`, ' +
               'or handle a specific failure precisely. Both options stay open.' }
        ],
        check: 'Calling withdraw with too large an amount prints "refused:" and a useful message.'
      },
      {
        t: 'Build the ledger core',
        blocks: [
          { p: 'The ledger owns its entries. Nothing outside the class may touch the list. That is what makes the invariant enforceable.' },
          { code: 'from datetime import datetime\n\nclass Ledger:\n    def __init__(self):\n        self.accounts = {}          # id -> Account\n        self.entries = []           # append-only list of dicts\n        self._next_id = 1\n\n    def open_account(self, account_id, kind="customer", allow_negative=False):\n        if account_id in self.accounts:\n            raise LedgerError(f"account {account_id} already exists")\n        self.accounts[account_id] = Account(account_id, kind, allow_negative)\n        return self.accounts[account_id]\n\n    def balance(self, account_id):\n        if account_id not in self.accounts:\n            raise UnknownAccount(account_id)\n        return sum(e["amount"] for e in self.entries if e["account"] == account_id)\n\n    def _post(self, legs, memo):\n        """Write a balanced set of legs: [(account_id, signed_cents),...]"""\n        if sum(amount for _, amount in legs) != 0:\n            raise LedgerError("transaction does not balance")\n        txn_id = f"TXN{self._next_id:05d}"\n        self._next_id += 1\n        stamp = datetime.now().isoformat(timespec="seconds")\n        for account_id, amount in legs:\n            self.entries.append({\n                "txn_id": txn_id, "account": account_id, "amount": amount,\n                "memo": memo, "at": stamp,\n            })\n        return txn_id', lang: 'python' },
          { p: 'The leading underscore in `_post` is a convention meaning *internal*: callers should use `transfer`, ' +
               'which validates first. Python will not stop them, but every Python programmer reads it as "do not touch".' }
        ],
        check: 'You can open accounts and call balance() on an empty ledger to get 0.'
      },
      {
        t: 'A validated, idempotent transfer',
        blocks: [
          { code: 'class Ledger(Ledger):        # (in the notebook, just extend the class above)\n\n    def deposit(self, account_id, amount, memo="deposit"):\n        if amount <= 0:\n            raise InvalidAmount("deposit must be positive")\n        if account_id not in self.accounts:\n            raise UnknownAccount(account_id)\n        return self._post([(account_id, amount), ("world", -amount)], memo)\n\n    def transfer(self, src, dst, amount, memo="transfer", fee=0, key=None):\n        if key is not None and key in self._keys:\n            return self._keys[key]                     # idempotent replay\n        if amount <= 0:\n            raise InvalidAmount("amount must be positive")\n        for acct in (src, dst):\n            if acct not in self.accounts:\n                raise UnknownAccount(acct)\n        if not self.accounts[src].allow_negative and self.balance(src) < amount + fee:\n            raise InsufficientFunds(f"{src} holds {money(self.balance(src))}")\n\n        legs = [(src, -(amount + fee)), (dst, amount)]\n        if fee:\n            legs.append(("fee_income", fee))\n        txn_id = self._post(legs, memo)\n        if key is not None:\n            self._keys[key] = txn_id\n        return txn_id', lang: 'python' },
          { p: 'Note the order: **validate everything, then write**. Never write one leg and then discover the second is invalid. ' +
               'Remember to create `self._keys = {}` in `__init__`.' },
          { tip: 'The `"world"` account is the outside world: money entering your system from a bank rail. It is allowed to go ' +
                 'negative, and its balance is the mirror image of all customer money you hold. Real ledgers call this a ' +
                 'contra or nostro account.' }
        ],
        check: 'A transfer with the same idempotency key twice creates only one transaction.'
      },
      {
        t: 'Reverse, do not delete',
        blocks: [
          { code: 'class Ledger(Ledger):\n\n    def reverse(self, txn_id, memo=None):\n        original = [e for e in self.entries if e["txn_id"] == txn_id]\n        if not original:\n            raise LedgerError(f"unknown transaction {txn_id}")\n        legs = [(e["account"], -e["amount"]) for e in original]\n        return self._post(legs, memo or f"reversal of {txn_id}")\n\n    def check_invariant(self):\n        """Every transaction, and the ledger as a whole, must sum to zero."""\n        total = sum(e["amount"] for e in self.entries)\n        if total != 0:\n            raise LedgerError(f"ledger is out of balance by {total}")\n        return True', lang: 'python' },
          { p: 'Reversing flips the sign of every leg, so the pair nets to zero while both remain visible. Run `check_invariant()` ' +
               'after every operation in your tests, if it ever fails, the bug is in the last thing you wrote.' }
        ],
        check: 'After reversing a transfer, both balances return to their earlier values and check_invariant() passes.'
      },
      {
        t: 'Print a statement',
        blocks: [
          { code: 'class Ledger(Ledger):\n\n    def statement(self, account_id):\n        if account_id not in self.accounts:\n            raise UnknownAccount(account_id)\n        rows = [e for e in self.entries if e["account"] == account_id]\n        running = 0\n        print(f"Statement: {account_id}")\n        print(f"{\'txn\':<10}{\'memo\':<22}{\'amount\':>12}{\'balance\':>14}")\n        for e in rows:\n            running += e["amount"]\n            print(f"{e[\'txn_id\']:<10}{e[\'memo\'][:21]:<22}{money(e[\'amount\']):>12}{money(running):>14}")\n        print(f"{\'\':<32}{\'CLOSING\':>12}{money(running):>14}")', lang: 'python' },
          { p: 'A running balance column is what makes a statement usable: it shows not just what happened but what the ' +
               'balance was after each event: the first thing support asks for.' }
        ],
        check: 'Your statement prints entries in order with a running balance that ends at the current balance.'
      }
    ]
  },

  glossary: [
    { t: 'Double-entry', d: 'Every transaction is recorded as balanced entries that sum to zero.' },
    { t: 'Entry (leg)', d: 'One side of a transaction: an account and a signed amount.' },
    { t: 'Invariant', d: 'A condition that must always hold: here, that entries sum to zero.' },
    { t: 'Minor units', d: 'The smallest currency unit (cents). Money is stored as integers of these.' },
    { t: 'Idempotency key', d: 'A client-supplied unique string letting a server recognise a retry and return the original result.' },
    { t: 'Reversal', d: 'A new transaction with opposite signs that cancels an earlier one without deleting it.' },
    { t: 'Authorization', d: 'Funds reserved by the issuer; no ledger movement yet.' },
    { t: 'Capture', d: 'Confirming an authorized payment so it can be posted and settled.' },
    { t: 'Chargeback', d: 'A forced reversal initiated by the cardholder\'s bank after a dispute.' },
    { t: 'Contra account', d: 'An account representing the outside world, allowed to hold a negative balance.' },
    { t: 'Penny splitting', d: 'Deciding deterministically who receives the leftover unit when an amount cannot divide evenly.' },
    { t: 'Class', d: 'A Python construct bundling data with the methods allowed to change it.' }
  ],

  quiz: [
    { q: "What makes a transaction valid in a double-entry ledger?",
      options: [
        "It has exactly two entries",
        "Its entries sum to zero",
        "It was approved by an administrator",
        "Both accounts have positive balances"
      ],
      answer: 1,
      why: "Balance is the rule, not the entry count. A payment with a fee has three legs and is perfectly valid because they still sum to zero." },

    { q: "How should an account balance be obtained?",
      options: [
        "Computed as the sum of that account's entries",
        "Read from a balance column that each transfer updates",
        "Requested from the payment network",
        "Stored in a separate cache that is never rebuilt"
      ],
      answer: 0,
      why: "Entries are the source of truth. A stored balance can drift out of agreement with them, and then nobody knows which is right. Caches are allowed only if rebuildable." },

    { q: "A payment of $25.00 carries a $0.50 platform fee. Which set of legs is correct?",
      options: [
        "customer -2500, merchant +2450, fee_income +50",
        "customer -2500, merchant +2500",
        "customer -2550, merchant +2500, fee_income +50",
        "customer -2500, merchant +2450"
      ],
      answer: 0,
      why: "The customer paid $25.00, the merchant nets $24.50, and the platform keeps $0.50: three legs summing to zero. The two-leg version that credits the merchant $24.50 loses 50 cents and would be rejected as unbalanced." },

    { q: "A payment request arrives with an idempotency key the server has already seen. What should happen?",
      options: [
        "Post it and immediately reverse it",
        "Post the transaction again for safety",
        "Reject the request with an error",
        "Return the original transaction without posting anything new"
      ],
      answer: 3,
      why: "That is the entire point of the key: a retried request returns the original result so a lost response cannot become a double charge." },

    { q: "A posted payment was wrong. What is the correct fix?",
      options: [
        "Edit the amount on the original entries",
        "Post a reversing transaction with opposite signs",
        "Adjust the stored balance directly",
        "Delete the entries"
      ],
      answer: 1,
      why: "Ledgers are append-only. A reversal nets the effect to zero while leaving both the error and the correction visible for audit." },

    { q: "Why is `int(round(float(text) * 100))` used to parse money rather than `int(float(text) * 100)`?",
      options: [
        "float cannot multiply by 100",
        "int truncates, so 19.99 * 100 = 1998.9999... would become 1998",
        "round converts the string to a number",
        "round is faster"
      ],
      answer: 1,
      why: "int() chops the fractional part. Binary floating point often lands a hair below the intended value, so truncation loses a cent on roughly half of all inputs." },

    { q: "What is the \"penny-splitting problem\"?",
      options: [
        "Fees smaller than one cent",
        "Storing amounts smaller than the minor unit",
        "Deciding who gets the leftover unit when an amount does not divide evenly",
        "Rounding errors when converting currencies"
      ],
      answer: 2,
      why: "Splitting 100 cents three ways gives 33, 33, 33 and one cent left over. The rule for allocating it must be deliberate and deterministic, or the transaction stops balancing." },

    { q: "What should a transfer do when the source account has insufficient funds?",
      options: [
        "Write only the credit leg",
        "Return False so the caller can decide",
        "Raise an exception and write nothing",
        "Write the entries and flag the account as overdrawn"
      ],
      answer: 2,
      why: "Validate fully, then write. Raising cannot be ignored by accident, and a partially written transaction would break the invariant immediately." },

    { q: "In a Python class, what is `self`?",
      options: [
        "The instance the method was called on",
        "A copy of the class definition",
        "A reserved keyword like def or return",
        "The parent class"
      ],
      answer: 0,
      why: "self is the instance, passed automatically as the first argument. It is a naming convention rather than a keyword, but never rename it." },

    { q: "Why does the tutorial ledger keep a \"world\" account that is allowed to go negative?",
      options: [
        "To hold profits",
        "To represent money entering from outside the system, so deposits still balance",
        "To store rounding errors",
        "Because banks require it by regulation"
      ],
      answer: 1,
      why: "A deposit must have two legs. The world (contra) account is the counterparty for money arriving from an external rail, and its negative balance mirrors the customer funds you hold." },

    { q: "Which payment state means funds are reserved but no money has moved?",
      options: [
        "posted",
        "settled",
        "reversed",
        "pending (authorized)"
      ],
      answer: 3,
      why: "Authorization reserves funds and lowers the available balance. Posting writes it to your ledger; settlement moves money between institutions days later." },

    { q: "What does `sum(e[\"amount\"] for e in self.entries)` return on a healthy ledger?",
      options: [
        "The number of entries",
        "The largest balance",
        "Zero",
        "The total money held"
      ],
      answer: 2,
      why: "Every transaction balances, so the whole ledger sums to zero. A non-zero result means a bug wrote an unbalanced transaction: check it after every operation in tests." },

    { q: "Why is a custom exception class better than returning False on failure?",
      options: [
        "It automatically logs the error",
        "It prevents the function from being called again",
        "It runs faster",
        "It cannot be silently ignored, and callers can handle each failure type precisely"
      ],
      answer: 3,
      why: "An ignored False leaves the caller believing the payment succeeded. An exception propagates until something handles it, and a class hierarchy lets callers catch broadly or narrowly." },

    { q: "Why do payment APIs like Stripe require an idempotency key on write requests?",
      options: [
        "To authenticate the caller",
        "To encrypt the payload",
        "Because networks lose responses, and the client retry must not create a second charge",
        "To order transactions by time"
      ],
      answer: 2,
      why: "The request may have succeeded before the response was lost. The key lets the server recognise the retry as the same intent rather than a new payment." },

    { q: "What does the leading underscore in `_post` communicate?",
      options: [
        "The method is internal by convention. Validated public methods should be used instead",
        "The method is private and enforced by Python",
        "The method is deprecated",
        "The method returns nothing"
      ],
      answer: 0,
      why: "Python does not enforce privacy, but the underscore is a universally understood signal. _post skips validation, so callers use transfer() or deposit() instead." }
  ],

  project: {
    title: 'Mini ledger and payment engine',
    story: 'The society is launching a little wallet for event tickets and merch, and you are writing the piece it ' +
           'all rests on. It needs a ledger that cannot lose money, cannot charge twice when the phone retries, and ' +
           'can explain every last cent to a treasurer.',
    scope: 'Uses only this level: classes, dicts, lists, custom exceptions, integer arithmetic, f-strings. ' +
           'No pandas, no database, no external libraries beyond `datetime`.',
    requirements: [
      'Custom exceptions: `LedgerError` base plus `UnknownAccount`, `InsufficientFunds`, `InvalidAmount`, `DuplicateAccount`',
      'An `Account` class holding id, kind, and an `allow_negative` flag, with a readable `__repr__`',
      'A `Ledger` class that owns an append-only `entries` list, no method may edit or remove an existing entry',
      '`to_cents(text)` and `money(cents)` helpers; every internal amount is an integer',
      '`open_account(id, kind, allow_negative=False)` raising DuplicateAccount on a repeat',
      '`balance(id)` computed by summing entries, raising UnknownAccount for unknown ids',
      '`deposit(id, amount)` and `withdraw(id, amount)` posting balanced legs against a `world` contra account',
      '`transfer(src, dst, amount, fee=0, key=None)` that validates everything before writing anything',
      'Idempotency: calling transfer twice with the same key posts once and returns the same transaction id',
      'Overdraft protection: a transfer that would take a customer account negative raises InsufficientFunds and writes nothing',
      '`reverse(txn_id)` posting opposite legs, and refusing to reverse an unknown transaction',
      '`check_invariant()` raising if the ledger does not sum to zero; call it after every operation in your tests',
      '`statement(id)` printing entries with a running balance and a closing line',
      '`split_payment(src, recipients, amount)` dividing an amount evenly and allocating leftover cents deterministically so the transaction still balances',
      'A `demo()` function running an end-to-end story: open accounts, deposit, pay with a fee, retry with the same key, attempt an overdraft, reverse a payment, print statements, assert the invariant',
      'At least 8 assert-based tests covering the happy path and every error case',
      'Saved to your portfolio repo as `level-04-ledger.ipynb` (or `.py`)'
    ],
    starter: {
      lang: 'python',
      code: '"""FinQuest level 4: Mini ledger and payment engine"""\n\nfrom datetime import datetime\n\n\nclass LedgerError(Exception):\n    """Base class for every refusal this ledger makes."""\n\nclass UnknownAccount(LedgerError): pass\nclass InsufficientFunds(LedgerError): pass\nclass InvalidAmount(LedgerError): pass\nclass DuplicateAccount(LedgerError): pass\n\n\ndef to_cents(amount_text):\n    """\'25.00\' -> 2500. Round, never truncate."""\n    # TODO\n    pass\n\n\ndef money(cents):\n    """2500 -> \'$25.00\'  |  -2500 -> \'-$25.00\'"""\n    # TODO\n    pass\n\n\nclass Account:\n    def __init__(self, account_id, kind="customer", allow_negative=False):\n        # TODO\n        pass\n\n\nclass Ledger:\n    def __init__(self):\n        self.accounts = {}\n        self.entries = []          # append-only. Never edit, never delete.\n        self._keys = {}            # idempotency key -> txn_id\n        self._next_id = 1\n\n    # --- internals ---------------------------------------------------\n    def _post(self, legs, memo):\n        """legs = [(account_id, signed_cents),...] and must sum to zero."""\n        # TODO\n        pass\n\n    # --- public API --------------------------------------------------\n    def open_account(self, account_id, kind="customer", allow_negative=False):\n        pass\n\n    def balance(self, account_id):\n        pass\n\n    def deposit(self, account_id, amount, memo="deposit"):\n        pass\n\n    def withdraw(self, account_id, amount, memo="withdrawal"):\n        pass\n\n    def transfer(self, src, dst, amount, memo="transfer", fee=0, key=None):\n        pass\n\n    def split_payment(self, src, recipients, amount, memo="split"):\n        """Divide amount between recipients; leftover cents go to the first\n        recipients in order so the transaction still balances."""\n        pass\n\n    def reverse(self, txn_id, memo=None):\n        pass\n\n    def check_invariant(self):\n        pass\n\n    def statement(self, account_id):\n        pass\n\n\ndef demo():\n    """End-to-end story the treasurer could read."""\n    pass\n\n\nif __name__ == "__main__":\n    demo()\n'
    },
    tests: [
      'to_cents("19.99") == 1999 and to_cents("0.1") + to_cents("0.2") == to_cents("0.3")',
      'money(-2500) == "-$25.00"',
      'After deposit("alice", 10000), balance("alice") == 10000 and balance("world") == -10000',
      'transfer("alice", "bob", 2500, fee=50) leaves alice 7450, bob 2500, fee_income 50',
      'Calling that transfer twice with key="abc" posts once: len(ledger.entries) is unchanged and the same txn id comes back',
      'transfer("alice", "bob", 999999) raises InsufficientFunds and adds zero entries',
      'transfer("alice", "nobody", 100) raises UnknownAccount and adds zero entries',
      'transfer("alice", "bob", 0) raises InvalidAmount',
      'reverse(txn) restores both balances exactly and leaves the original entries in place',
      'split_payment("alice", ["b", "c", "d"], 100) posts 34 + 33 + 33 and check_invariant() passes',
      'check_invariant() returns True after every single operation above'
    ],
    rubric: [
      { pts: 25, t: 'Invariant holds', d: 'Every path leaves the ledger summing to zero; check_invariant is asserted throughout the demo.' },
      { pts: 20, t: 'Validation and errors', d: 'All four error types raised in the right situations, always with zero entries written.' },
      { pts: 20, t: 'Idempotency and reversal', d: 'Duplicate keys post once and return the original id; reversals cancel without deleting.' },
      { pts: 15, t: 'Money discipline', d: 'Integers everywhere internally, formatting only at the edges, penny split allocated deterministically.' },
      { pts: 10, t: 'Tests', d: 'At least eight asserts covering happy path and every failure mode.' },
      { pts: 10, t: 'Readable output', d: 'Statement with a running balance; demo that tells a story a treasurer could follow.' }
    ],
    stretch: [
      'Add pending/posted states: `authorize()` reserves funds, `capture()` posts, `void()` releases',
      'Add multi-currency: reject any transaction whose legs mix currencies',
      'Export entries to CSV and reload them, proving balances reconstruct exactly',
      'Add `as_of(date)` to compute a historical balance from the entry timestamps'
    ],
    solutionPath: 'solutions/level-04'
  },

  faq: [
    { q: 'What does "balanced" actually mean?',
      a: 'The signed amounts of all legs in one transaction add to exactly zero. Two legs for a plain transfer, three when there is a fee.' },
    { q: 'My ledger does not sum to zero',
      a: 'Something wrote one leg without its partner, or wrote before validating. Check that every path goes through _post with a complete leg list, and that failed transfers write nothing at all.' },
    { q: 'How do I implement idempotency?',
      a: 'Keep a dict of key -> txn_id. At the top of transfer, if the key is already present return the stored txn_id immediately. Store the key only after a successful post.' },
    { q: 'Should transfer return False or raise on failure?',
      a: 'Raise. A returned False can be ignored by accident, leaving the caller thinking the payment worked. Use custom exceptions so callers can catch precisely.' },
    { q: 'How do I split $1.00 three ways?',
      a: 'Integer divide: 100 // 3 = 33 each, remainder 100 - 99 = 1. Give the leftover cents to the first recipients in order. Never drop the remainder, or the transaction will not balance.' },
    { q: 'Why store cents as integers instead of Decimal?',
      a: 'Decimal is a fine alternative and used in production too. Integers are simpler, immune to rounding config, and make the balance check exact. The rule that matters is: not floats.' },
    { q: 'Can I edit an entry to fix a mistake?',
      a: 'No. Post a reversing transaction instead. The audit trail must show the error and the correction; regulators and support teams both depend on it.' }
  ]
});
