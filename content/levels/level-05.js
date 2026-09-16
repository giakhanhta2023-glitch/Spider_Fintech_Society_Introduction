/* =========================================================================
   LEVEL 5: Market data and APIs
   ========================================================================= */
FQ.registerLevel({
  id: 5,
  codename: 'market feed',
  title: 'Market data and APIs',
  tagline: 'Pull live rates off the internet, and keep your app calm on the day the internet says no.',
  difficulty: 5,
  minutes: 150,
  tags: ['REST', 'JSON', 'requests', 'resilience'],
  summary: 'Fintech products are mostly other people\'s data, arriving over HTTP, sometimes late, sometimes wrong, ' +
           'occasionally not at all. This level is about fetching it and about what your code does when the fetch fails.',

  objectives: [
    'Read an API endpoint, its query parameters, and its JSON response',
    'Use requests with a timeout and check status codes properly',
    'Handle failure with try/except, retries with backoff, and a cached fallback',
    'Keep API keys out of your code and out of your repository',
    'Convert money between currencies, including cross rates',
    'Value a multi-currency portfolio and stamp the result with its data source and age'
  ],

  knowledge: [
    { h: 'An API is a menu, not a mystery' },
    { p: 'A REST API is a set of URLs you can request. You send a URL, you get back JSON. That is genuinely all it is. ' +
         'The skill is in reading the menu and handling the times the kitchen is closed.' },
    { code: 'https://api.frankfurter.app/latest?base=USD&symbols=EUR,GBP\n\\____/  \\_______________/\\_____/ \\____________________/\nscheme       host          path        query parameters', lang: 'text', label: 'anatomy of a request' },
    { code: '{\n  "amount": 1.0,\n  "base": "USD",\n  "date": "2025-09-01",\n  "rates": { "EUR": 0.9123, "GBP": 0.7684 }\n}', lang: 'json', label: 'the JSON that comes back' },
    { p: 'JSON maps directly onto Python: objects become dicts, arrays become lists, strings and numbers stay themselves. ' +
         '`response.json()` does the conversion, so `data["rates"]["EUR"]` gets you 0.9123.' },
    { table: {
      head: ['Verb', 'Means', 'Used for'],
      rows: [
        ['`GET`', 'Read something', 'Fetching rates, prices, balances'],
        ['`POST`', 'Create something', 'Making a payment, opening an account'],
        ['`PUT` / `PATCH`', 'Replace / update', 'Editing a profile'],
        ['`DELETE`', 'Remove', 'Closing a card']
      ]
    }},
    { p: 'This level only uses `GET`, because reading market data is the safe half of the job. Note the pattern though: ' +
         '`GET` is naturally repeatable, `POST` is not, which is exactly why level 4 needed idempotency keys.' },

    { h: 'Status codes tell you whose fault it is' },
    { table: {
      head: ['Code', 'Meaning', 'What you should do'],
      rows: [
        ['`200`', 'OK', 'Carry on'],
        ['`400`', 'Bad request', 'Your parameters are wrong. Fix the code, do not retry'],
        ['`401` / `403`', 'Unauthorized / forbidden', 'Key missing, wrong, or out of permissions'],
        ['`404`', 'Not found', 'Wrong path or unknown symbol'],
        ['`429`', 'Too many requests', 'You hit the rate limit: back off and slow down'],
        ['`500` / `502` / `503`', 'Their server broke', 'Retry with backoff; it may fix itself']
      ]
    }},
    { p: 'The rule of thumb: **4xx means you are wrong, 5xx means they are wrong**. Retrying a 400 forever just burns ' +
         'your rate limit; retrying a 503 a few times usually works.' },
    { warn: '`requests.get(url)` with no `timeout` can hang **forever** if the server accepts the connection and never answers. ' +
            'Every request in production code has a timeout. No exceptions.' },

    { h: 'Rate limits and backoff' },
    { p: 'Free APIs cap how often you may call them: perhaps 30 requests a minute. Exceed it and you get `429`, sometimes ' +
         'followed by a temporary ban. The polite and effective response is **exponential backoff**: wait 1 second, then 2, then 4.' },
    { code: 'for attempt in range(3):\n    try:\n        r = requests.get(url, timeout=10)\n        r.raise_for_status()\n        return r.json()\n    except requests.RequestException:\n        time.sleep(2 ** attempt)        # 1s, 2s, 4s\nraise RuntimeError("giving up after 3 attempts")', lang: 'python' },
    { money: 'A trading desk that hammers a rate-limited feed gets throttled precisely when markets are volatile: the ' +
             'moment the data matters most. Backoff is self-preservation.' },

    { h: 'Never trust a single live call' },
    { p: 'An app that shows a blank screen when an API is slow is a broken app. Three layers of defence, in order:' },
    { ol: [
      '**Cache**: save the last good response with a timestamp. If it is younger than your freshness window, use it and skip the call entirely.',
      '**Retry**: on a network error or 5xx, try again a few times with backoff.',
      '**Fallback**: if everything fails, use a bundled snapshot and **label it clearly as stale**.'
    ]},
    { p: 'The last part matters more than the code: a rate shown without its age is a lie waiting to happen. ' +
         'Every number you display from an external source should carry where it came from and when.' },

    { h: 'Secrets do not go in code' },
    { p: 'Many APIs need a key. It identifies you and often bills you, so treat it like a password.' },
    { code: 'import os\nfrom getpass import getpass\n\n# In Colab: type it once per session, never save it in the notebook\nAPI_KEY = os.environ.get("MARKET_API_KEY") or getpass("API key: ")', lang: 'python' },
    { table: {
      head: ['Do', 'Do not'],
      rows: [
        ['Read from an environment variable', 'Paste the key into a cell you will commit'],
        ['Prompt with `getpass` in a notebook', 'Put it in a URL you print or log'],
        ['Add `.env` to `.gitignore`', 'Email it to a teammate'],
        ['Rotate a key the moment it leaks', 'Assume a deleted commit is gone. It is not']
      ]
    }},
    { warn: 'Deleting a key from a file does **not** remove it from git history. If a key is ever committed, revoke it immediately. ' +
            'Bots scan public repositories continuously and will find it in minutes.' },

    { h: 'FX: base, quote, cross rates, and the spread' },
    { p: 'A rate is always a pair. `EUR/USD = 1.0961` means one **base** unit (EUR) costs 1.0961 of the **quote** currency (USD). ' +
         'Reading it backwards is the single most common FX bug.' },
    { code: '# Given rates quoted against USD:\n#   EUR = 0.9123   (1 USD buys 0.9123 EUR)\n#   GBP = 0.7684\n\nusd_to_eur = 250 * 0.9123           # 228.08 EUR\neur_to_usd = 250 / 0.9123           # 274.03 USD   <- divide to go back\n\n# cross rate EUR -> GBP, via the common base\neur_to_gbp = 0.7684 / 0.9123        # 0.8423', lang: 'python' },
    { p: 'Real trading quotes come in pairs: the **bid** (what a dealer pays you) and the **ask** (what they charge you). ' +
         'The gap is the **spread**, and it is how the dealer earns. A mid-market rate (the average) is what news sites show ' +
         'and is never what you actually get. Consumer apps quoting "the real exchange rate" mean mid-market plus a stated fee.' },
    { tip: 'Sanity-check every conversion: if 1 USD buys 25,480 VND, then $10 should be about 254,800 VND. If your ' +
           'answer is 0.0004, you divided when you should have multiplied.' },

    { h: 'No feed covers everything' },
    { p: 'The free FX API in this level publishes the **European Central Bank reference set**: 29 currencies. ' +
         'USD, EUR, GBP, JPY, SGD and INR are in it. **VND is not**, and neither are most African, Middle Eastern, ' +
         'and smaller Asian currencies.' },
    { p: 'This is normal, and it is a design question rather than a bug. When a source does not quote a currency you hold, ' +
         'you have three options: drop the holding (wrong (it understates the total), value it at zero (worse) it lies ' +
         'quietly), or **fall back to another source for that one currency and label the row**. The third is what real ' +
         'systems do, and it is why professional valuation tables carry a source column rather than a single footnote.' },
    { money: 'Mixed provenance is the normal state of financial data: a treasury report routinely blends a live feed, ' +
             'a broker file, and a manually entered rate. The discipline is not avoiding the mix. It is labelling it.' }
  ],

  tutorial: {
    intro: 'New notebook: `finquest-level-05.ipynb`. `requests` is preinstalled in Colab. Both APIs here are free and need ' +
           'no key, so you can run every cell immediately.',
    steps: [
      {
        t: 'Your first API call',
        blocks: [
          { code: 'import requests\n\nr = requests.get("https://api.frankfurter.app/latest",\n                 params={"base": "USD", "symbols": "EUR,GBP,JPY"},\n                 timeout=10)\n\nprint(r.status_code)        # 200\nprint(r.url)                # requests built the query string for you\ndata = r.json()\nprint(data)', lang: 'python' },
          { p: 'Passing `params` as a dict is safer than gluing the URL together yourself: requests escapes special characters ' +
               'correctly. And `timeout=10` is not optional.' },
          { code: 'print(data["base"])              # USD\nprint(data["date"])              # the date these rates are from\nprint(data["rates"]["EUR"])      # 0.9123', lang: 'python' }
        ],
        check: 'You printed a live EUR rate and the date it belongs to.'
      },
      {
        t: 'Check the response before you trust it',
        blocks: [
          { p: '`raise_for_status()` turns any 4xx/5xx into an exception so a bad response cannot slip through as data.' },
          { code: 'r = requests.get("https://api.frankfurter.app/latest",\n                 params={"base": "XYZ"}, timeout=10)\nprint(r.status_code)         # 404. XYZ is not a currency\n\ntry:\n    r.raise_for_status()\nexcept requests.HTTPError as err:\n    print("API said no:", err)', lang: 'python' },
          { warn: 'Without `raise_for_status()`, calling `.json()` on an error response either throws a confusing JSON error ' +
                  'or hands you an error object that your code treats as rates.' }
        ],
        check: 'A bad currency code gives you a handled error message instead of a crash.'
      },
      {
        t: 'Wrap it in a function that cannot hang',
        blocks: [
          { code: 'import time\n\ndef fetch_json(url, params=None, attempts=3, timeout=10):\n    """GET JSON with retries and exponential backoff. Raises on final failure."""\n    last_error = None\n    for attempt in range(attempts):\n        try:\n            r = requests.get(url, params=params, timeout=timeout)\n            r.raise_for_status()\n            return r.json()\n        except requests.RequestException as err:\n            last_error = err\n            if attempt < attempts - 1:\n                time.sleep(2 ** attempt)          # 1s, 2s\n    raise RuntimeError(f"failed after {attempts} attempts: {last_error}")\n\n\nrates = fetch_json("https://api.frankfurter.app/latest", {"base": "USD"})\nprint(len(rates["rates"]), "currencies")', lang: 'python' },
          { p: '`requests.RequestException` is the parent of timeouts, connection errors, and HTTP errors, so one `except` ' +
               'covers every network failure mode.' }
        ],
        check: 'fetch_json returns a dict, and raises a clear RuntimeError if you point it at a dead URL.'
      },
      {
        t: 'Cache to disk so you stop re-asking',
        blocks: [
          { code: 'import json, os\nfrom datetime import datetime, timedelta\n\nCACHE = "fx_cache.json"\nMAX_AGE = timedelta(hours=6)\n\ndef load_cache():\n    if not os.path.exists(CACHE):\n        return None\n    with open(CACHE, "r", encoding="utf-8") as fh:\n        blob = json.load(fh)\n    age = datetime.now() - datetime.fromisoformat(blob["fetched_at"])\n    return blob if age < MAX_AGE else None\n\ndef save_cache(payload):\n    blob = {"fetched_at": datetime.now().isoformat(), "payload": payload}\n    with open(CACHE, "w", encoding="utf-8") as fh:\n        json.dump(blob, fh, indent=2)', lang: 'python' },
          { p: '`with open(...)` closes the file for you even if something throws. `json.dump` writes, `json.load` reads. ' +
               'In Colab the file lives in the session and disappears on restart, which is fine, that is what a cache is.' }
        ],
        check: 'Running your fetch twice writes fx_cache.json once and reuses it the second time.'
      },
      {
        t: 'Three layers: cache, live, snapshot',
        blocks: [
          { p: 'This function is the shape of every resilient data client you will ever write. Note that it always reports ' +
               '**where** the numbers came from.' },
          { code: 'SNAPSHOT_URL = "{{RAW}}/data/level-05-fx-snapshot.json"\n\ndef get_rates(base="USD"):\n    """Return (rates_dict, source_label, as_of_date)."""\n    cached = load_cache()\n    if cached and cached["payload"]["base"] == base:\n        p = cached["payload"]\n        return p["rates"], "cache", p["date"]\n\n    try:\n        live = fetch_json("https://api.frankfurter.app/latest", {"base": base})\n        save_cache(live)\n        return live["rates"], "live", live["date"]\n    except RuntimeError as err:\n        print("live feed unavailable:", err)\n\n    snap = fetch_json(SNAPSHOT_URL)          # bundled fallback\n    return snap["rates"], "STALE SNAPSHOT", snap["date"]\n\n\nrates, source, as_of = get_rates("USD")\nprint(f"{len(rates)} rates from {source}, as of {as_of}")', lang: 'python' },
          { tip: 'To test the fallback without unplugging your wifi, temporarily point the live URL at ' +
                 '`https://api.frankfurter.app/nope` and watch it degrade gracefully.' }
        ],
        check: 'You saw all three paths work: live first, cache second, and snapshot when the live URL is broken.'
      },
      {
        t: 'Convert money correctly',
        blocks: [
          { code: 'def convert(amount, frm, to, rates, base="USD"):\n    """Convert between any two currencies quoted against a common base."""\n    if frm == to:\n        return amount\n    table = dict(rates)\n    table[base] = 1.0                       # the base is always 1 of itself\n    if frm not in table or to not in table:\n        raise KeyError(f"no rate for {frm} or {to}")\n    in_base = amount / table[frm]           # to base currency\n    return in_base * table[to]              # out to the target\n\n\nprint(round(convert(250, "EUR", "USD", rates), 2))\nprint(round(convert(250, "EUR", "GBP", rates), 2))     # cross rate\nprint(round(convert(100, "USD", "USD", rates), 2))     # 100.0', lang: 'python' },
          { p: 'Going *through the base* handles every pair with one line of logic, including the base itself. ' +
               'Adding `table[base] = 1.0` is the trick that prevents a `KeyError` on USD -> EUR.' }
        ],
        check: 'convert(250, "EUR", "USD") is larger than 250 and convert(100, "USD", "USD") is exactly 100.'
      },
      {
        t: 'A second source: crypto, and a portfolio table',
        blocks: [
          { code: 'coins = fetch_json("https://api.coingecko.com/api/v3/simple/price",\n                   {"ids": "bitcoin,ethereum", "vs_currencies": "usd"})\nprint(coins)          # {"bitcoin": {"usd": 64210}, "ethereum": {"usd": 2480}}\n\nbtc_usd = coins["bitcoin"]["usd"]', lang: 'python' },
          { p: 'Different API, different JSON shape. That is normal. Read the structure, then index it. ' +
               'Build the portfolio table with pandas from level 3:' },
          { code: 'import pandas as pd\n\nholdings = [\n    {"asset": "Cash EUR", "currency": "EUR", "units": 1200},\n    {"asset": "Cash JPY", "currency": "JPY", "units": 90000},\n    {"asset": "Bitcoin",  "currency": "BTC", "units": 0.05},\n]\n\nrows = []\nfor h in holdings:\n    if h["currency"] == "BTC":\n        value = h["units"] * btc_usd\n    else:\n        value = convert(h["units"], h["currency"], "USD", rates)\n    rows.append({**h, "value_usd": round(value, 2)})\n\ndf = pd.DataFrame(rows)\ndf["weight"] = df["value_usd"] / df["value_usd"].sum()\nprint(df.to_string(index=False))\nprint(f"\\nTotal: ${df[\'value_usd\'].sum():,.2f}   source: {source} ({as_of})")', lang: 'python' },
          { p: '`{**h, "value_usd": value}` copies a dict and adds a key: a neat way to build result rows without mutating ' +
               'the original data.' }
        ],
        check: 'A portfolio table prints with USD values, weights summing to 1.0, and a source stamp.'
      }
    ]
  },

  glossary: [
    { t: 'REST API', d: 'A set of URLs returning data, usually JSON, over HTTP.' },
    { t: 'Endpoint', d: 'One specific URL path of an API, such as /latest.' },
    { t: 'Query parameter', d: 'A key=value pair after ? that filters or configures the request.' },
    { t: 'JSON', d: 'Text format of objects and arrays that maps directly to Python dicts and lists.' },
    { t: 'Status code', d: 'The 3-digit result of an HTTP request. 4xx is your fault, 5xx is theirs.' },
    { t: 'Timeout', d: 'The maximum time a request may wait before failing. Always set one.' },
    { t: 'Rate limit', d: 'The cap on how many requests you may make in a period. Exceeding it returns 429.' },
    { t: 'Exponential backoff', d: 'Waiting 1s, 2s, 4s between retries so a struggling service can recover.' },
    { t: 'Cache', d: 'A stored previous response reused while it is fresh enough.' },
    { t: 'Base / quote', d: 'In EUR/USD, EUR is the base and USD the quote: one EUR costs 1.09 USD.' },
    { t: 'Cross rate', d: 'A rate between two currencies derived through a common third currency.' },
    { t: 'Bid / ask / spread', d: 'What a dealer pays, what they charge, and the gap they earn.' },
    { t: 'Mid-market rate', d: 'The midpoint of bid and ask: a reference price, not a price you can trade at.' },
    { t: 'Environment variable', d: 'A value supplied by the environment, used to keep secrets out of source code.' }
  ],

  quiz: [
    { q: "In `https://api.frankfurter.app/latest?base=USD&symbols=EUR`, which part is the query string?",
      options: [
        "https",
        "api.frankfurter.app",
        "base=USD&symbols=EUR",
        "/latest"
      ],
      answer: 2,
      why: "Everything after the ? is the query string: key=value pairs joined by &, used to filter or configure the request." },

    { q: "What does `response.json()` return in Python?",
      options: [
        "A dict (or list) built from the JSON body",
        "A string of JSON text",
        "A pandas DataFrame",
        "The status code"
      ],
      answer: 0,
      why: "It parses the body into native Python objects (JSON objects become dicts, arrays become lists) so you can index straight into it." },

    { q: "You receive HTTP 429. What is the correct response?",
      options: [
        "Retry immediately in a tight loop",
        "Fix your query parameters",
        "Rotate your API key",
        "Back off: wait, then retry more slowly, because you have hit the rate limit"
      ],
      answer: 3,
      why: "429 means too many requests. Retrying immediately makes it worse and can earn a temporary ban. Exponential backoff is the standard fix." },

    { q: "Which status code means the problem is in your request rather than their server?",
      options: [
        "500",
        "502",
        "400",
        "503"
      ],
      answer: 2,
      why: "4xx codes are client errors: bad parameters, missing auth, unknown resource. Retrying them unchanged will never succeed." },

    { q: "Why must every production `requests.get` have a timeout?",
      options: [
        "To reduce bandwidth costs",
        "Because without one the call can hang indefinitely and freeze your app",
        "Because the API requires it",
        "To avoid rate limits"
      ],
      answer: 1,
      why: "A server that accepts a connection and never replies will block your thread forever. Requests has no default timeout. You must set it." },

    { q: "What does `raise_for_status()` do?",
      options: [
        "Raises an exception if the status code indicates an error",
        "Retries the request",
        "Prints the status code",
        "Converts the response to JSON"
      ],
      answer: 0,
      why: "It turns 4xx and 5xx into an HTTPError so a failed response cannot be quietly processed as if it were data." },

    { q: "What is exponential backoff?",
      options: [
        "Reducing the timeout on each retry",
        "Waiting progressively longer between retries: 1s, 2s, 4s",
        "Switching to a backup API immediately",
        "Requesting more data with each attempt"
      ],
      answer: 1,
      why: "Growing delays give a struggling or rate-limiting service room to recover instead of being hammered by a retry storm." },

    { q: "Your FX app cannot reach the live API. What is the best behaviour?",
      options: [
        "Show a blank screen until it recovers",
        "Use the most recent cached or bundled rates and label them clearly as stale",
        "Use rates of 1.0 for everything as a placeholder",
        "Retry in a loop until it succeeds"
      ],
      answer: 1,
      why: "Degrade, do not disappear, but never present old data as current. Every displayed rate should carry its source and age." },

    { q: "Where should an API key live?",
      options: [
        "Hardcoded in the script so it always works",
        "In the repository README for the team",
        "In the URL, so it is easy to inspect",
        "In an environment variable or a getpass prompt, never committed"
      ],
      answer: 3,
      why: "Keys are credentials. Committed keys are found by scanners within minutes, and deleting the line does not remove it from git history." },

    { q: "You accidentally committed a key to a public repo and deleted it in the next commit. What now?",
      options: [
        "Nothing, the deletion removed it",
        "Make the repository private and keep the key",
        "Rename the variable",
        "Revoke and rotate the key immediately; it is still in the history"
      ],
      answer: 3,
      why: "Git keeps every version. The only safe assumption is that the key is compromised the moment it is pushed." },

    { q: "Rates are quoted against USD and EUR = 0.9123. How do you convert 250 EUR into USD?",
      options: [
        "250 / 0.9123",
        "250 * 0.9123",
        "250 * (1 - 0.9123)",
        "250 + 0.9123"
      ],
      answer: 0,
      why: "The rate says 1 USD buys 0.9123 EUR, so going the other way you divide: 250 / 0.9123 = $274.03. Getting this backwards is the classic FX bug." },

    { q: "With USD-based rates EUR = 0.9123 and GBP = 0.7684, what is the EUR to GBP cross rate?",
      options: [
        "0.9123 + 0.7684",
        "0.9123 * 0.7684",
        "0.7684 / 0.9123",
        "0.9123 / 0.7684"
      ],
      answer: 2,
      why: "Go through the base: EUR to USD is divide by 0.9123, USD to GBP is multiply by 0.7684, which simplifies to 0.7684 / 0.9123 = 0.8423." },

    { q: "What is the spread in an FX quote?",
      options: [
        "The fee charged by the regulator",
        "The range of rates across different banks",
        "The gap between the bid and the ask, which is the dealer's margin",
        "The difference between today's and yesterday's rate"
      ],
      answer: 2,
      why: "Bid is what a dealer pays you, ask is what they charge you. You never trade at the mid-market rate news sites display." },

    { q: "Why add `table[base] = 1.0` inside a convert function?",
      options: [
        "So converting to or from the base currency works instead of raising KeyError",
        "To normalise all the other rates",
        "To round the result",
        "Because APIs always omit the first currency"
      ],
      answer: 0,
      why: "The API omits the base from its rates map, since a currency is trivially 1 of itself. Adding it makes one code path handle every pair." },

    { q: "Which order gives the most resilient data client?",
      options: [
        "Live call, then cache, then snapshot",
        "Fresh cache, then live call with retries, then bundled snapshot",
        "Snapshot, then cache, then live",
        "Live call only, with an error message on failure"
      ],
      answer: 1,
      why: "Check the cache first to avoid the call entirely, go live when it is stale, and fall back to a labelled snapshot only when everything else fails." }
  ],

  project: {
    title: 'Multi-currency portfolio valuation service',
    story: 'The society holds cash in four currencies plus a little crypto, and right now nobody can say what the ' +
           'treasury is worth. Build the valuation service, and make sure it still works on the conference wifi that ' +
           'blocks half the internet.',
    scope: 'Uses this level plus level 3 (pandas) and level 2 (formatting): requests with timeout, retries, JSON, ' +
           'file caching, try/except, and a DataFrame for the output. No API key is required anywhere.',
    dataset: '{{RAW}}/data/level-05-fx-snapshot.json',
    requirements: [
      'A `fetch_json(url, params=None, attempts=3, timeout=10)` helper with `raise_for_status` and exponential backoff',
      'A disk cache written as JSON with a `fetched_at` timestamp and a configurable max age',
      'A `get_rates(base)` returning `(rates, source, as_of)` and trying cache, then live, then the bundled snapshot',
      'The snapshot path must be exercised: prove it works by pointing the live URL at a dead endpoint',
      'A `convert(amount, frm, to, rates, base)` handling same-currency, base-to-x, x-to-base, and cross rates',
      'A `get_crypto_prices(ids)` call to CoinGecko that fails soft: if it errors, crypto is valued at 0 with a clear warning',
      'Per-currency fallback: the live feed does not quote VND, so that holding must be valued from the snapshot and labelled, not dropped and not silently zero',
      'A `source` column on every row of the output showing where that particular rate came from',
      'A portfolio defined as a list of dicts with at least 5 holdings across 4+ currencies plus one crypto asset',
      'A `value_portfolio(holdings, base)` returning a DataFrame with asset, currency, units, unit value, value in base, and weight',
      'Weights that sum to 1.0 (to 6 decimal places) and a total row',
      'A `report(...)` printing the table, the total, and a clearly formatted data-source stamp naming source and as-of date',
      'Graceful handling of an unknown currency code: a clear message, not a traceback',
      'A short markdown cell listing every failure mode you handle and what the user sees in each case',
      'Saved to your portfolio repo as `level-05-fx-portfolio.ipynb`'
    ],
    starter: {
      lang: 'python',
      code: '"""FinQuest level 5: Multi-currency portfolio valuation"""\n\nimport json\nimport os\nimport time\nfrom datetime import datetime, timedelta\n\nimport pandas as pd\nimport requests\n\nFX_URL = "https://api.frankfurter.app/latest"\nCRYPTO_URL = "https://api.coingecko.com/api/v3/simple/price"\nSNAPSHOT_URL = "{{RAW}}/data/level-05-fx-snapshot.json"\nCACHE_FILE = "fx_cache.json"\nMAX_AGE = timedelta(hours=6)\n\nPORTFOLIO = [\n    {"asset": "Operating cash", "currency": "USD", "units": 4200},\n    {"asset": "Event float",    "currency": "EUR", "units": 1500},\n    {"asset": "Sponsor escrow", "currency": "GBP", "units": 800},\n    {"asset": "Travel fund",    "currency": "JPY", "units": 250000},\n    {"asset": "Local reserve",  "currency": "VND", "units": 12000000},\n    {"asset": "Bitcoin",        "currency": "BTC", "units": 0.05},\n]\n\n\ndef fetch_json(url, params=None, attempts=3, timeout=10):\n    """GET JSON with retries and exponential backoff. Raise on final failure."""\n    # TODO\n    pass\n\n\ndef load_cache():\n    """Return the cached payload if it is younger than MAX_AGE, else None."""\n    # TODO\n    pass\n\n\ndef save_cache(payload):\n    # TODO\n    pass\n\n\ndef get_rates(base="USD"):\n    """Return (rates, source, as_of). Try cache -> live -> snapshot."""\n    # TODO\n    pass\n\n\ndef get_crypto_prices(ids=("bitcoin",), vs="usd"):\n    """Return {id: price}. Must fail soft, never crash the valuation."""\n    # TODO\n    pass\n\n\ndef convert(amount, frm, to, rates, base="USD"):\n    """Convert through the base currency. Handle frm == to."""\n    # TODO\n    pass\n\n\ndef value_portfolio(holdings, rates, crypto, base="USD"):\n    """Return a DataFrame with value_base and weight columns."""\n    # TODO\n    pass\n\n\ndef report(holdings=PORTFOLIO, base="USD"):\n    """Print the table, the total, and the data-source stamp."""\n    # TODO\n    pass\n\n\nif __name__ == "__main__":\n    report()\n'
    },
    tests: [
      'fetch_json against a 404 URL raises RuntimeError after its retries rather than hanging',
      'Every requests.get call in your file passes a timeout: grep your own code to confirm',
      'get_rates returns source "live" first, then "cache" on an immediate second call',
      'With the live URL broken, get_rates returns the snapshot and source says STALE',
      'convert(100, "USD", "USD", rates) == 100 exactly',
      'convert(250, "EUR", "USD", rates) is about 274 with snapshot rates (250 / 0.9123)',
      'convert(250, "EUR", "GBP", rates) is about 210.6 with snapshot rates',
      'convert(10, "USD", "VND", rates) is about 254,800 with snapshot rates',
      'convert(5, "USD", "XXX", rates) raises a handled error with a readable message',
      'With live rates (which omit VND) the VND holding is still valued, its row says source = snapshot, and the total does not silently lose it',
      'Portfolio weights sum to 1.0 to six decimal places',
      'Killing your network mid-run still produces a full report, labelled stale'
    ],
    rubric: [
      { pts: 25, t: 'Resilience', d: 'Cache, retry, and snapshot all demonstrably work; no path can hang or crash the report.' },
      { pts: 20, t: 'Correct conversion', d: 'All four conversion directions right, including cross rates and the base-currency case.' },
      { pts: 20, t: 'Honest presentation', d: 'Source and as-of date always shown, per row where sources differ; stale data is labelled as stale.' },
      { pts: 15, t: 'Error handling', d: 'Unknown currencies, dead endpoints, and crypto failures produce clear messages, not tracebacks.' },
      { pts: 10, t: 'Secret hygiene', d: 'No keys anywhere; if you add a keyed API, it reads from the environment.' },
      { pts: 10, t: 'Shipped', d: 'Runs top to bottom in a fresh session and is committed to your portfolio repo.' }
    ],
    stretch: [
      'Add a `--base` style parameter so the whole report can be produced in EUR or VND',
      'Apply a 0.5% spread to every conversion and show mid-market vs what the member actually receives',
      'Fetch a 30-day history from /2025-08-01..2025-08-31 and chart one currency pair over time',
      'Persist the cache to a CSV as well, so the report can run entirely offline on a second machine'
    ],
    solutionPath: 'solutions/level-05'
  },

  faq: [
    { q: 'My request hangs forever',
      a: 'You forgot timeout=. Requests has no default. Add timeout=10 to every call, and wrap it in try/except requests.RequestException.' },
    { q: 'I get a 404 from the FX API',
      a: 'Usually an invalid currency code in base or symbols. Codes are three-letter ISO 4217, uppercase: USD, EUR, VND. Use raise_for_status to surface it clearly.' },
    { q: 'KeyError: "USD" inside convert',
      a: 'The API omits the base currency from its rates map. Add table[base] = 1.0 to your copy of the rates before looking anything up.' },
    { q: 'My converted amounts are tiny / enormous',
      a: 'You multiplied where you should divide. With USD-based rates, going x -> USD divides by the rate, USD -> x multiplies. Sanity-check against a known pair.' },
    { q: 'How do I test the offline fallback?',
      a: 'Point the live URL at a nonsense path such as /nope for one run. Your retries should fail, the snapshot should load, and the report should say STALE.' },
    { q: 'CoinGecko returns 429',
      a: 'That is the free rate limit. Back off, cache the crypto price like you cache FX, and make the crypto call fail soft so the rest of the report still prints.' },
    { q: 'The API returns no rate for VND',
      a: 'It never will: the feed publishes the 29-currency ECB reference set and VND is not in it. That is the point of ' +
         'that holding. Catch the KeyError, fall back to the bundled snapshot rate for that one currency, and label the row ' +
         'as snapshot-sourced.' },
    { q: 'Should I commit the cache file?',
      a: 'No. Add fx_cache.json to .gitignore: it is derived data that goes stale. Commit only the snapshot, which is deliberately versioned.' }
  ]
});
