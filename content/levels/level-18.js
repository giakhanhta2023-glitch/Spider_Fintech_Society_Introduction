/* =========================================================================
   LEVEL 18: open banking and the aggregator
   ========================================================================= */
FQ.registerLevel({
  id: 18,
  codename: 'aggregator',
  title: 'Three banks, three shapes, one account view',
  tagline: 'Most fintech backend work is this: somebody else owns the data, the consent expires, the formats disagree, and your app has to show one clean list anyway.',
  difficulty: 8,
  minutes: 250,
  tags: ['OAuth2', 'consent', 'data normalisation', 'integration'],
  summary: 'Open banking lets an app read somebody\'s accounts with their permission. The protocol is the easy half. The ' +
           'work is consent that expires, tokens you must never leak, three banks with three shapes for the same ' +
           'transaction, and deduplication when the same payment arrives twice in two states.',

  objectives: [
    'Walk the authorization code flow with PKCE and say what each step protects against',
    'Store and refresh tokens without ever writing one to a log',
    'Treat consent as a thing that expires, and handle the day it does',
    'Normalise three incompatible exports into one schema',
    'Deduplicate an ingestion that runs twice and a payment that arrives twice',
    'Sync incrementally with cursors, inside a rate limit',
    'Categorise merchant strings, and let a correction teach the system'
  ],

  knowledge: [
    { h: 'Consent is the product' },
    { p: 'Open banking regulation in the UK and the EU, and the same pattern arriving elsewhere, says a bank must let a ' +
         'customer share their own data with a third party through an API. That third party is you. The permission it runs ' +
         'on has four properties, and every one of them is something your code has to handle rather than something a ' +
         'lawyer handles for you.' },
    { table: {
      head: ['Property', 'What it means in code'],
      rows: [
        ['**Explicit**', 'The customer authorises at their bank, not in your app. You never see their credentials'],
        ['**Scoped**', 'You ask for accounts and transactions, and you get exactly that. Asking for more gets refused or reported'],
        ['**Time limited**', 'Ninety days is the common figure. Your sync stops working on a date you can predict'],
        ['**Revocable**', 'They can withdraw it at the bank, without telling you. Your next call fails and that is the notification']
      ]
    }},
    { money: 'This is the whole business model of Plaid, TrueLayer, Tink and a dozen others: not the protocol, which is ' +
             'published, but handling these four properties across hundreds of banks that each implement them slightly ' +
             'differently. Building a small one against three fake banks teaches the shape of that work.' },

    { h: 'The authorization code flow, and what each step is for' },
    { code: '1. your app  ->  bank:      here is a code_challenge, and where to send the user back\n2. bank      ->  customer:  sign in and approve these scopes\n3. bank      ->  your app:  one time code, on the redirect\n4. your app  ->  bank:      the code, plus the code_verifier\n5. bank      ->  your app:  access token (minutes), refresh token (until consent ends)', lang: 'text' },
    { ul: [
      '**The user authenticates at the bank.** You never receive a password, which is the entire point of the flow and the reason screen scraping is being legislated out.',
      '**The code is one time and short lived.** Intercepting it later is worth nothing.',
      '**PKCE** sends a hash of a secret you generated (`code_challenge`), and proves you knew the secret at step 4 (`code_verifier`). Without it, anybody who steals the code on the redirect can exchange it.',
      '**The `state` parameter** is a random value you generate and check on return. It stops somebody handing your user a link that connects their account to an attacker\'s session.'
    ]},
    { check: {
      q: 'A teammate says PKCE is only for mobile apps, and your server side app can skip it because it has a client secret. ' +
         'Is that right?',
      a: 'It was the original reasoning and it is no longer the advice. PKCE costs two extra fields and defends a case the ' +
         'client secret does not: an attacker who obtains the authorization code, from a log, a referrer header, a proxy or ' +
         'a badly built redirect, cannot exchange it without the verifier that never left your server. Current OAuth ' +
         'guidance is to use it everywhere, and every open banking implementation you will meet requires it anyway.'
    }},

    { h: 'Tokens, and the two rules' },
    { p: 'You end up holding an access token that lasts minutes and a refresh token that lasts until the consent does. Both ' +
         'are credentials for somebody else\'s bank account.' },
    { ol: [
      '**Encrypted at rest, never in a log.** Encrypt the refresh token with a key held outside the database, so a dump of the table is not a set of working credentials. Level 12\'s rule about API keys, one step further, because you cannot hash these: you need them back.',
      '**Refreshed once, not five times.** Two workers refreshing the same token at once will race, and many banks invalidate the old refresh token the moment a new one is issued, so the loser is left holding a dead credential. Take a lock, or store the new token in the same transaction that used the old one.'
    ]},
    { code: 'with lock(f"refresh:{connection_id}"):        # one refresher at a time\n    fresh = bank.refresh(decrypt(row.refresh_token))\n    store(connection_id, encrypt(fresh.refresh_token), fresh.access_token, fresh.expires_at)', lang: 'python' },
    { warn: 'Log the connection id, never the token. A refresh token in an error message is in your log aggregator, your ' +
            'error tracker and somebody\'s laptop, and it works until the consent expires.' },

    { h: 'The day the consent ends' },
    { p: 'Ninety days after the customer approved, the refresh stops working. This is not an error condition to retry: it ' +
         'is a scheduled event you can put in a calendar, and the difference between an app people keep and one they ' +
         'abandon is what happens in the week before it.' },
    { table: {
      head: ['What the bank returns', 'What it means', 'What your app does'],
      rows: [
        ['`401` on the access token', 'Expired, normally', 'Refresh and retry once'],
        ['`400 invalid_grant` on refresh', 'The consent is gone', 'Mark the connection dead, ask the user to reconnect'],
        ['`403` on one account', 'Scope does not cover it', 'Stop asking for that account, do not retry'],
        ['`429`', 'Too fast', 'Back off, as in level 5'],
        ['Nothing, for ten seconds', 'Their problem', 'Time out, keep the last good data, say when it was from']
      ]
    }},
    { p: 'And the product half: tell the user before it happens. A banner at day eighty three that says which bank needs ' +
         'reconnecting is worth more than any retry logic, because the failure is not technical and cannot be fixed by ' +
         'your code.' },
    { check: {
      q: 'Your sync fails at three in the morning with `400 invalid_grant`. Your retry logic tries again five times with ' +
         'backoff, then pages you. What is wrong with that design?',
      a: 'Everything after the first attempt. `invalid_grant` on a refresh means the permission no longer exists, so the ' +
         'second attempt cannot succeed and neither can the fiftieth: it is a `4xx` in the level 5 sense, and retrying it ' +
         'is spending your rate limit to be told the same thing. Worse, it pages a person who cannot do anything, because ' +
         'the only fix is the customer reauthorising at their bank. The correct handling is to mark the connection as ' +
         'needing consent, stop syncing it, and surface it in the app where the one person who can fix it will see it.'
    }},

    { h: 'Three banks, three shapes, one transaction' },
    { p: 'Here is the same month of spending as three real banks would hand it to you. The level ships all three files.' },
    { code: 'bank A, csv\n  date,description,amount,running_balance\n  2026-06-01,LOTTE MART,-65141.00,\n\nbank B, json\n  {"transactionId": "B00000", "bookingDate": "12/06/2026",\n   "remittanceInformationUnstructured": "POS APPLE.COM/BILL HANOI",\n   "transactionAmount": {"amount": "5603200", "currency": "VND"},\n   "creditDebitIndicator": "DBIT"}\n\nbank C, csv\n  posted_at,merchant_name,debit,credit,status,reference\n  06-23-2026,Netflix.Com,89982,,pending,C00000', lang: 'text' },
    { p: 'Count the disagreements in those three rows. The **date** is ISO, then day first, then month first. The **sign** is ' +
         'negative, then a separate indicator field, then a column position. The **units** are decimal, then minor units, ' +
         'then whole units. The **merchant** is upper case, then wrapped in terminal noise, then title case. And one of ' +
         'them carries a status that means this transaction is not final.' },
    { table: {
      head: ['Field', 'Bank A', 'Bank B', 'Bank C'],
      rows: [
        ['Date format', '`2026-06-01`', '`12/06/2026`', '`06-23-2026`'],
        ['Direction', 'Negative amount', '`creditDebitIndicator`', 'Column, debit or credit'],
        ['Units', 'Decimal', 'Minor units (x100)', 'Whole units'],
        ['Merchant', '`LOTTE MART`', '`POS APPLE.COM/BILL HANOI`', '`Netflix.Com`'],
        ['Identity', 'None', '`transactionId`', '`reference`, repeated when booked']
      ]
    }},
    { p: 'The target is one schema, and choosing it is the design decision of this level: **one row, one moment, one ' +
         'signed amount in minor units, one cleaned merchant, one stable id, and a field saying which bank it came from ' +
         'and what it looked like before you touched it.**' },
    { code: '{"id": "a1c9...", "source": "bank-b", "source_id": "B00000",\n "booked_at": "2026-06-12", "amount_minor": -560320000, "currency": "VND",\n "merchant": "APPLE.COM", "category": "subscriptions",\n "status": "booked", "raw": {...}}', lang: 'json' },
    { warn: 'Keep the raw record. Every normalisation is a guess that will be wrong for some bank, and the only way to fix ' +
            'it later without asking the customer to reconnect is to still have what you were sent.' },

    { h: 'The same payment, twice' },
    { p: 'Two duplicates, with different causes and different fixes, and the files in this level contain both.' },
    { ul: [
      '**The re-sync duplicate**: bank A is exported again and the last eight rows repeat. Bank A gives you no transaction id, so identity has to be constructed: a hash of the date, the amount and the description, scoped to the account. That is a **fingerprint**, and it is what level 12 used to tell a retry from a mistake.',
      '**The pending duplicate**: bank C shows a payment as pending and then, days later, as booked, with the same reference and often a slightly different amount. Two rows, one payment. Match on the reference, replace the pending with the booked, and keep the fact that it changed.'
    ]},
    { code: 'raw rows across the three files   157\n  bank A  68  (60 real, 8 repeated by the second sync)\n  bank B  45\n  bank C  44  (35 booked, 9 of them seen as pending first)\n\nafter fingerprinting and collapsing   140', lang: 'text', label: 'the level\'s own files' },
    { check: {
      q: 'Your fingerprint is a hash of date, amount and description. A customer buys the same coffee twice on the same day ' +
         'for the same amount. What happens, and what do you do about it?',
      a: 'One of the two disappears, and the customer is looking at a statement that is missing a real purchase. The ' +
         'fingerprint is not unique, because nothing in the data makes those two rows different. The usual fix is to ' +
         'include a counter: within one account, date, amount and description, number them in order of appearance, so the ' +
         'second coffee gets a fingerprint ending in 2. A re-sync produces the same sequence and still deduplicates, and ' +
         'two genuine identical purchases survive. Where a bank gives you a transaction id, use it and skip all of this.'
    }},

    { h: 'Syncing inside somebody else\'s limits' },
    { p: 'You do not own the API and you cannot poll it hard. Three rules make a sync that does not get you blocked.' },
    { ol: [
      '**Incremental, with a cursor.** Store the point you reached, ask for what is newer, and never refetch a year of history because it was easier to write.',
      '**Overlap the window.** Ask for slightly more than you need, a day or two, because banks backdate and reorder. Your deduplication is what makes the overlap free.',
      '**Respect `429` and the documented ceiling.** Level 5 covered the backoff. What is new here is that the limit is per customer consent, so a sync loop that is polite in aggregate can still be rude to one bank.'
    ]},
    { p: 'And schedule around the customer rather than around the clock. Syncing every connection at midnight makes a spike ' +
         'that every bank notices, and spreading the same work across the hour costs nothing.' },

    { h: 'Categorising a merchant string' },
    { p: 'Level 3 categorised transactions that arrived with a category. Real ones arrive as `POS APPLE.COM/BILL HANOI` and ' +
         '`GRAB *RIDE 8812`, and turning those into something a person recognises is most of what a money app does.' },
    { ol: [
      '**Clean first.** Strip the terminal noise, the city, the reference numbers and the prefixes. Most of the win is here, and it is a list of rules rather than a model.',
      '**Match known merchants.** A table of patterns to names and categories. Boring, auditable, and correct for the top few hundred that cover most spending.',
      '**Then a model**, for the long tail, trained on what the rules already labelled.',
      '**Then the correction.** When a user recategorises something, store it as a rule for that user and as a signal for everybody. A categoriser that cannot be corrected is one people stop trusting after the third mistake.'
    ]},
    { check: {
      q: 'Your model categorises `EVN HANOI` as shopping. The user corrects it to utilities. What should happen next time ' +
         'they see it, and what should happen for other users?',
      a: 'For that user, immediately and permanently: their correction becomes a rule that wins over the model, because ' +
         'nothing erodes trust faster than fixing something and watching it come back. For everybody else, it becomes one ' +
         'vote rather than a rule: a single correction can be a mistake or a personal preference, and applying it globally ' +
         'lets one person recategorise the country\'s electricity company. Collect them, and promote a pattern to a global ' +
         'rule when enough independent users agree, which is a threshold you write down.'
    }}
  ],

  tutorial: {
    intro: 'No real bank is involved: you build against the three exports shipped with this level, plus a small fake OAuth ' +
           'server so the token flow is real code rather than a diagram. Python, FastAPI from level 12, and the ledger ' +
           'schema habits from level 11.',
    steps: [
      {
        t: 'The flow, against a fake bank',
        blocks: [
          { p: 'Write the authorization server yourself, badly and briefly. Thirty lines gives you something to point a real ' +
               'client at, and makes every later step testable without a partner.' },
          { code: 'import hashlib, base64, secrets\n\ndef pkce_pair():\n    verifier = base64.urlsafe_b64encode(secrets.token_bytes(32)).rstrip(b"=").decode()\n    challenge = base64.urlsafe_b64encode(\n        hashlib.sha256(verifier.encode()).digest()\n    ).rstrip(b"=").decode()\n    return verifier, challenge\n\nstate = secrets.token_urlsafe(16)          # checked on the way back', lang: 'python' },
          { code: '@app.get("/connect/{bank}")\ndef connect(bank: str):\n    verifier, challenge = pkce_pair()\n    state = secrets.token_urlsafe(16)\n    save_pending(state, bank, verifier)          # server side, never in the URL\n    return RedirectResponse(\n        f"{BANKS[bank][\'authorize\']}?response_type=code"\n        f"&client_id={CLIENT_ID}&redirect_uri={REDIRECT}"\n        f"&scope=accounts+transactions&state={state}"\n        f"&code_challenge={challenge}&code_challenge_method=S256"\n    )', lang: 'python' }
        ],
        check: 'The redirect carries state and a code challenge, and the verifier is stored server side only.'
      },
      {
        t: 'Exchange, and store what comes back',
        blocks: [
          { code: '@app.get("/callback")\ndef callback(code: str, state: str):\n    pending = take_pending(state)               # missing or reused state is fatal\n    if not pending:\n        raise problem(400, "bad_state", "Unknown or reused state.")\n\n    tokens = http.post(BANKS[pending.bank]["token"], data={\n        "grant_type": "authorization_code",\n        "code": code,\n        "redirect_uri": REDIRECT,\n        "client_id": CLIENT_ID,\n        "code_verifier": pending.verifier,\n    }).json()\n\n    save_connection(\n        bank=pending.bank,\n        access_token=tokens["access_token"],\n        refresh_token=encrypt(tokens["refresh_token"]),\n        expires_at=now() + timedelta(seconds=tokens["expires_in"]),\n        consent_expires_at=now() + timedelta(days=90),\n    )', lang: 'python' },
          { warn: 'Write the consent expiry down at connection time. It is the only date that lets you warn the customer ' +
                  'before the sync dies, and no bank will remind you.' }
        ],
        check: 'A replayed state is refused, and the stored refresh token is unreadable in a database dump.'
      },
      {
        t: 'Refresh, once',
        blocks: [
          { code: 'def with_fresh_token(connection_id):\n    row = load(connection_id)\n    if row.expires_at > now() + timedelta(seconds=30):\n        return row.access_token\n\n    with advisory_lock(f"refresh:{connection_id}"):       # level 11\'s lock\n        row = load(connection_id)                        # somebody may have refreshed\n        if row.expires_at > now() + timedelta(seconds=30):\n            return row.access_token\n        try:\n            fresh = bank.refresh(decrypt(row.refresh_token))\n        except InvalidGrant:\n            mark_needs_consent(connection_id)\n            raise\n        save_tokens(connection_id, fresh)\n        return fresh.access_token', lang: 'python' },
          { p: 'Read it twice: once before the lock and once inside it. That is the standard shape, and it means a hundred ' +
               'workers cost one refresh rather than a hundred races.' }
        ],
        check: 'Two threads asking at once produce exactly one refresh call, and an invalid grant marks the connection instead of retrying.'
      },
      {
        t: 'One normaliser per bank, one schema out',
        blocks: [
          { code: 'from dataclasses import dataclass\nfrom datetime import date\n\n@dataclass(frozen=True)\nclass Txn:\n    source: str\n    source_id: str | None\n    booked_at: date\n    amount_minor: int          # negative is money out, always\n    currency: str\n    merchant: str\n    status: str                # "pending" or "booked"\n    raw: dict\n\ndef from_bank_a(row) -> Txn:\n    return Txn(source="bank-a", source_id=None,\n               booked_at=date.fromisoformat(row["date"]),\n               amount_minor=int(round(float(row["amount"]) * 100)),\n               currency="VND", merchant=clean(row["description"]),\n               status="booked", raw=row)', lang: 'python' },
          { p: 'Then `from_bank_b` and `from_bank_c`, each owning exactly one bank\'s oddities. Nothing outside these three ' +
               'functions ever sees a bank specific field, which is what keeps the fourth bank from touching the rest of ' +
               'the system.' },
          { tip: 'Write one test per bank holding a real row from the shipped file and the exact Txn it should become. When ' +
                 'a bank changes its export, that test is where you find out.' }
        ],
        check: 'All three normalisers produce Txn objects with negative amounts for spending and a real date.'
      },
      {
        t: 'Fingerprint and deduplicate',
        blocks: [
          { code: 'import hashlib\n\ndef fingerprint(txn, seen_counter):\n    """Stable identity for a bank that gives you none."""\n    if txn.source_id:\n        return f"{txn.source}:{txn.source_id}"\n    base = f"{txn.source}|{txn.booked_at}|{txn.amount_minor}|{txn.merchant}"\n    n = seen_counter[base] = seen_counter.get(base, 0) + 1\n    return hashlib.sha256(f"{base}|{n}".encode()).hexdigest()[:24]', lang: 'python' },
          { p: 'Then the pending collapse: when a booked row arrives with a reference you have already seen as pending, ' +
               'update the existing row rather than inserting, and keep both amounts if they differ.' },
          { code: 'raw rows in      157\nunique out       140', lang: 'text' }
        ],
        check: 'Ingesting all three files twice leaves 140 transactions, and two identical purchases on one day both survive.'
      },
      {
        t: 'Incremental sync with a cursor',
        blocks: [
          { code: 'def sync(connection_id, overlap_days=2):\n    cursor = load_cursor(connection_id)               # the last booked_at we trusted\n    since = (cursor or date(2000, 1, 1)) - timedelta(days=overlap_days)\n\n    for page in bank.transactions(connection_id, since=since):\n        for row in page:\n            upsert(normalise(row))\n    save_cursor(connection_id, max_booked_at_seen)', lang: 'python' },
          { p: 'The overlap is free because the deduplication already works, and it saves you from the bank that backdates ' +
               'a transaction by a day. Without the overlap, that transaction is never seen again.' }
        ],
        check: 'A second sync fetches only the recent window and inserts nothing new.'
      },
      {
        t: 'Clean, match, then model',
        blocks: [
          { code: 'import re\n\nNOISE = [r"^POS\\s+", r"\\s+HANOI$", r"\\*\\w+", r"\\s{2,}", r"\\d{4,}"]\n\ndef clean(raw: str) -> str:\n    out = raw.upper().strip()\n    for pattern in NOISE:\n        out = re.sub(pattern, " ", out)\n    return re.sub(r"\\s+", " ", out).strip()\n\nRULES = [\n    (r"NETFLIX|SPOTIFY|APPLE\\.COM", "subscriptions"),\n    (r"LOTTE|VINMART|CIRCLE K", "groceries"),\n    (r"GRAB|METRO|TAXI", "transport"),\n    (r"EVN|WATER|INTERNET", "utilities"),\n]', lang: 'python' },
          { p: 'Measure the coverage: what share of transactions the rules alone can label. On these files it should be most ' +
               'of them, and that number is the honest answer to whether a model is needed yet.' }
        ],
        check: 'The cleaner turns POS APPLE.COM/BILL HANOI into APPLE.COM, and the rules cover most of the month.'
      },
      {
        t: 'The correction that sticks',
        blocks: [
          { code: 'def recategorise(user_id, merchant, category):\n    upsert_user_rule(user_id, merchant, category)       # wins over everything\n    record_vote(merchant, category)                      # one vote, not a rule\n\ndef categorise(user_id, merchant):\n    return (user_rule(user_id, merchant)\n            or global_rule(merchant)\n            or model_guess(merchant)\n            or "uncategorised")', lang: 'python' },
          { p: 'Read the order of that fallback chain. The user always wins, then the curated rules, then the model, then an ' +
               'honest admission. "Uncategorised" is a better answer than a confident wrong one.' }
        ],
        check: 'A correction survives the next sync, and a second user is unaffected until enough independent votes agree.'
      }
    ]
  },

  glossary: [
    { t: 'Open banking', d: 'Regulation requiring banks to let customers share their own data with a third party through an API.' },
    { t: 'Consent', d: 'The customer\'s permission: explicit, scoped, time limited and revocable. All four are your code\'s problem.' },
    { t: 'Authorization code flow', d: 'The OAuth2 flow where the user authenticates at the bank and your app receives a one time code.' },
    { t: 'PKCE', d: 'Proof that the app exchanging the code is the one that started the flow. Now advised for every client type.' },
    { t: 'State parameter', d: 'A random value echoed back on the redirect, checked to stop an attacker linking their account to your user.' },
    { t: 'Access token', d: 'Short lived credential for API calls. Minutes, usually.' },
    { t: 'Refresh token', d: 'Longer lived credential used to get new access tokens. Encrypted at rest, never logged.' },
    { t: 'invalid_grant', d: 'The refresh failed because the consent is gone. Not retryable: ask the user to reconnect.' },
    { t: 'Normalisation', d: 'Turning several banks\' shapes into one schema, keeping the raw record alongside.' },
    { t: 'Minor units', d: 'Integer cents or equivalent. The only sane storage for money, as in level 1.' },
    { t: 'Pending and booked', d: 'A payment seen before it settles and after. One payment, two rows, matched on a reference.' },
    { t: 'Fingerprint', d: 'A constructed identity for a bank that gives you no transaction id, with a counter for genuine repeats.' },
    { t: 'Cursor', d: 'The point a sync reached, so the next one asks only for what is newer.' },
    { t: 'Overlap window', d: 'Deliberately refetching a day or two, because banks backdate. Free once deduplication works.' },
    { t: 'Merchant cleaning', d: 'Stripping terminal noise and references from a raw description. Most of a categoriser\'s value.' }
  ],

  quiz: [
    { q: "Where does the customer type their bank password in the authorization code flow?",
      options: [
        "At their bank, and you never see it",
        "In your app, which forwards it",
        "Nowhere: the flow uses the client secret instead",
        "In the redirect URL"
      ],
      answer: 0,
      why: "That is the point of the flow, and why screen scraping with shared credentials is being legislated out." },

    { q: "What does PKCE protect against?",
      options: [
        "The access token expiring too soon",
        "Replay of the refresh token",
        "An attacker who obtains the authorization code being able to exchange it",
        "The bank refusing the scope"
      ],
      answer: 2,
      why: "The verifier never leaves your server. Current guidance is to use it for every client type, not only mobile." },

    { q: "The state parameter exists to:",
      options: [
        "Carry the requested scopes",
        "Identify the bank",
        "Hold the code verifier",
        "Stop an attacker linking their account to your user's session"
      ],
      answer: 3,
      why: "Random, stored server side, checked on return, and used once. A reused state is a fatal error rather than a warning." },

    { q: "How should a refresh token be stored?",
      options: [
        "In the session cookie",
        "In plain text, because it expires anyway",
        "Hashed, like a password",
        "Encrypted at rest with a key held outside the database"
      ],
      answer: 3,
      why: "You cannot hash it because you need it back. Encryption means a dump of the table is not a set of working credentials." },

    { q: "Two workers refresh the same token at the same moment. What usually happens?",
      options: [
        "Many banks invalidate the old refresh token, so one worker is left holding a dead credential",
        "Both succeed harmlessly",
        "The bank merges the requests",
        "The access token is issued twice with the same value"
      ],
      answer: 0,
      why: "Take a lock and re-read inside it. A hundred workers should cost one refresh rather than a hundred races." },

    { q: "A refresh returns 400 invalid_grant. What is the correct handling?",
      options: [
        "Page an engineer",
        "Mark the connection as needing consent and ask the user to reconnect",
        "Reconnect automatically using the stored credentials",
        "Retry five times with backoff"
      ],
      answer: 1,
      why: "The permission is gone. No number of retries recreates it, and the only person who can fix it is the customer." },

    { q: "Why keep the raw bank record alongside the normalised one?",
      options: [
        "Because regulators require the raw format",
        "Because normalisation is a guess that will be wrong for some bank, and fixing it later needs the original",
        "For the audit log",
        "To compute the running balance"
      ],
      answer: 1,
      why: "Otherwise the only way to correct a parsing bug is asking every customer to reconnect and resync." },

    { q: "Bank A sends no transaction id. How do you give its rows a stable identity?",
      options: [
        "Use the date alone",
        "Use the row number in the file",
        "Hash the account, date, amount and description, with a counter for genuine repeats",
        "Generate a UUID at ingestion"
      ],
      answer: 2,
      why: "A UUID changes on every sync, so the same transaction arrives as new each time. The counter is what saves two identical coffees on one day." },

    { q: "A payment appears as pending and later as booked with the same reference. The ingester should:",
      options: [
        "Match on the reference and replace the pending row, keeping the fact that the amount changed",
        "Ignore the pending one entirely",
        "Keep both rows",
        "Ask the user which is correct"
      ],
      answer: 0,
      why: "One payment, two observations. Ignoring pending rows means the app is days behind, and keeping both double counts the spending." },

    { q: "Why deliberately refetch a day or two you already have?",
      options: [
        "To check the bank is still up",
        "Because cursors are unreliable",
        "Because banks backdate and reorder transactions, and deduplication makes the overlap free",
        "To keep the rate limit warm"
      ],
      answer: 2,
      why: "Without the overlap, a transaction backdated after your cursor passed is never seen again." },

    { q: "What should the categoriser do first with POS APPLE.COM/BILL HANOI?",
      options: [
        "Feed it to the model",
        "Clean it to APPLE.COM",
        "Ask the user",
        "Look it up in a merchant database"
      ],
      answer: 1,
      why: "Most of the value is in the cleaning, and it is a list of rules rather than a model. Everything downstream gets easier." },

    { q: "A user recategorises EVN HANOI to utilities. What happens for other users?",
      options: [
        "It becomes one vote, promoted to a global rule only when enough independent users agree",
        "Nothing at all, ever",
        "The same change immediately",
        "The model retrains on it overnight"
      ],
      answer: 0,
      why: "One correction can be a mistake or a personal preference. Applying it globally lets one person recategorise the electricity company." },

    { q: "Which is the right order for the categorisation fallback chain?",
      options: [
        "Model, user rule, global rule",
        "User rule, global rule, model, uncategorised",
        "Global rule, model, user rule",
        "Model only, with corrections as training data"
      ],
      answer: 1,
      why: "The user always wins, and an honest \"uncategorised\" beats a confident wrong answer that they have to correct twice." },

    { q: "Consent typically lasts ninety days. What does that mean for the product?",
      options: [
        "Nothing, refresh handles it",
        "Tokens must be rotated daily",
        "The user must reauthenticate every login",
        "The sync will stop on a date you can predict, so warn the user before it does"
      ],
      answer: 3,
      why: "Write the expiry down at connection time. A banner at day eighty three is worth more than any retry logic." },

    { q: "Why does each bank get its own normaliser function?",
      options: [
        "For parallel processing",
        "Because the banks use different HTTP libraries",
        "So that nothing outside those functions sees a bank specific field, and a fourth bank touches nothing else",
        "To allow per bank rate limits"
      ],
      answer: 2,
      why: "One place per bank, one schema out, and a test per bank holding a real row and the exact object it should become." }
  ],

  project: {
    title: 'The account aggregator',
    story: 'Members of the society bank in three different places and want one view of their month. Build the aggregator: ' +
           'the consent flow, the token handling, three normalisers, deduplication that survives a double sync, and a ' +
           'categoriser that learns when somebody corrects it.',
    scope: 'Uses this level plus level 12 (FastAPI, errors, request ids), level 11 (Postgres, locks, unique constraints) ' +
           'and level 3 (pandas for the report). The three bank files ship with the level; the OAuth server is a small ' +
           'fake you write, so no real bank or vendor account is needed.',
    dataset: '{{RAW}}/data/level-18-bank-a.csv',
    requirements: [
      'A fake authorization server with an authorize and a token endpoint, supporting PKCE and state',
      'GET /connect/{bank} and GET /callback implementing the authorization code flow, with the verifier stored server side',
      'A connections table holding the encrypted refresh token, the access token expiry and the consent expiry',
      'A refresh path that takes a lock, re-reads inside it, and marks the connection on invalid_grant instead of retrying',
      'A test proving no token ever reaches the logs, by capturing log output during a full flow',
      'Three normaliser functions, one per bank file, producing one frozen Txn type with amounts in minor units and negative for spending',
      'One test per bank holding a real row from the shipped file and the exact Txn it must become',
      'Fingerprinting for the bank with no transaction id, including the counter that keeps two identical purchases',
      'Pending to booked collapse matched on the reference, keeping a record that the amount changed',
      'Ingesting all three files twice produces 140 transactions',
      'Incremental sync with a stored cursor and a two day overlap window',
      'A merchant cleaner, a rules table, and a fallback chain of user rule, global rule, model, uncategorised',
      'A correction endpoint that makes a user rule immediately and records a global vote',
      'A README with the schema, the consent lifecycle, and what happens on the day consent expires',
      'The repository in your GitHub portfolio as finquest-aggregator'
    ],
    starter: {
      lang: 'python',
      code: '"""FinQuest level 18: the account aggregator.\n\nLayout:\n  fakebank/            a small authorization server and transactions API\n  aggregator/oauth.py  pkce, state, exchange, refresh with a lock\n  aggregator/normalise.py  from_bank_a, from_bank_b, from_bank_c, Txn\n  aggregator/ingest.py fingerprint, upsert, pending collapse, cursor\n  aggregator/categorise.py  clean, rules, model, corrections\n  main.py              connect, callback, sync, recategorise\n"""\n\nfrom dataclasses import dataclass\nfrom datetime import date\n\n\n@dataclass(frozen=True)\nclass Txn:\n    source: str\n    source_id: str | None\n    booked_at: date\n    amount_minor: int\n    currency: str\n    merchant: str\n    status: str\n    raw: dict\n\n\ndef pkce_pair():\n    """Return (verifier, challenge)."""\n    # TODO\n    pass\n\n\ndef from_bank_a(row) -> Txn:\n    # TODO\n    pass\n\n\ndef from_bank_b(row) -> Txn:\n    # TODO\n    pass\n\n\ndef from_bank_c(row) -> Txn:\n    # TODO\n    pass\n\n\ndef fingerprint(txn, seen_counter) -> str:\n    """Stable identity, using source_id when the bank provides one."""\n    # TODO\n    pass\n\n\ndef clean(raw: str) -> str:\n    """POS APPLE.COM/BILL HANOI -> APPLE.COM"""\n    # TODO\n    pass\n\n\ndef categorise(user_id, merchant) -> str:\n    """user rule, then global rule, then model, then uncategorised."""\n    # TODO\n    pass\n'
    },
    tests: [
      'A callback with an unknown or reused state is refused',
      'The code exchange fails without the correct code verifier',
      'A full connect and sync writes no token to the logs, asserted by capturing log output',
      'Two concurrent refreshes result in exactly one call to the bank',
      'A refresh returning invalid_grant marks the connection as needing consent and does not retry',
      'Each bank normaliser turns a real shipped row into the exact expected Txn',
      'Spending is negative in every source, despite three different sign conventions',
      'Ingesting the three files produces 140 transactions, and ingesting them again still produces 140',
      'Two identical purchases on the same day both survive deduplication',
      'A pending row followed by its booked row leaves one transaction with status booked',
      'A second sync with a cursor fetches only the overlap window',
      'clean() turns POS APPLE.COM/BILL HANOI into APPLE.COM',
      'A user correction wins over the model on the next sync, and does not change another user'
    ],
    rubric: [
      { pts: 25, t: 'Consent handled properly', d: 'PKCE, state, encrypted refresh tokens, a locked refresh, and invalid_grant treated as a product event rather than an error to retry.' },
      { pts: 25, t: 'Normalisation', d: 'One function per bank, one schema out, the raw record kept, and a test per bank pinned to a real row.' },
      { pts: 20, t: 'Deduplication', d: '157 raw rows become 140 transactions, twice, with identical purchases surviving and pending rows collapsing.' },
      { pts: 15, t: 'Categorisation that learns', d: 'Cleaning first, rules second, model third, and a correction that sticks for that user without rewriting the world.' },
      { pts: 15, t: 'Shipped', d: 'Runs from a clean clone against the fake bank, tests pass, README covers the consent lifecycle.' }
    ],
    stretch: [
      'Add a fourth bank with a format you invent, and count how many files you had to change',
      'Add a webhook receiver so the bank can notify you of new transactions, verified as in level 12, and fall back to polling',
      'Add balance reconciliation: check that the running balance implied by your transactions matches the balance the bank reports, and report breaks as in level 10',
      'Add a consent expiry notifier that emails at day eighty three, and a dashboard of connections by health'
    ],
    solutionPath: 'solutions/level-18'
  },

  faq: [
    { q: 'Do I need a real bank account or a Plaid key?',
      a: 'No. The level ships three export files and you write a small fake authorization server. Everything you learn transfers, because the real ones implement the same flow with more edge cases.' },
    { q: 'Why encrypt the refresh token rather than hash it?',
      a: 'Because you have to send it back to the bank, so you need the original. Hashing works for something you only ever compare, such as an API key, which is the level 12 case.' },
    { q: 'Where does the encryption key live?',
      a: 'Outside the database: an environment variable in a small setup, a key management service in a larger one. A key stored next to the data it protects is a filing system, not encryption.' },
    { q: 'My deduplication drops real transactions',
      a: 'Your fingerprint has no counter. Two identical purchases on the same day are indistinguishable without one, and they are more common than people expect.' },
    { q: 'Should pending transactions be shown to users?',
      a: 'Usually yes, marked as pending, because people recognise the purchase they just made. What matters is that the booked version replaces it instead of adding to it.' },
    { q: 'How accurate does the categoriser need to be?',
      a: 'Good enough that corrections feel rare, and correctable when they are not. Cleaning plus a few hundred merchant rules covers most spending, and a model for the tail is a level 8 problem.' },
    { q: 'What about currencies?',
      a: 'Store the currency with every amount and never mix them in a sum. Level 5 covered conversion; here the rule is simply that a total across currencies is a bug until a rate and a date are attached.' }
  ]
});
