"""
FinQuest level 5: Multi-currency portfolio valuation  (reference solution)
===========================================================================
Three layers of defence, in order:

    fresh cache  ->  live API (retries + backoff)  ->  bundled snapshot

and every number printed carries where it came from and how old it is.

Run:  python fx_portfolio.py
      python fx_portfolio.py --offline     # force the snapshot path
"""

import json
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd
import requests

FX_URL = "https://api.frankfurter.app/latest"
CRYPTO_URL = "https://api.coingecko.com/api/v3/simple/price"
SNAPSHOT_URL = ("https://raw.githubusercontent.com/giakhanhta2023-glitch/"
                "Spider_Fintech_Society_Introduction/main/data/level-05-fx-snapshot.json")
LOCAL_SNAPSHOT = Path(__file__).resolve().parents[2] / "data" / "level-05-fx-snapshot.json"

CACHE_FILE = Path("fx_cache.json")
MAX_AGE = timedelta(hours=6)

PORTFOLIO = [
    {"asset": "Operating cash", "currency": "USD", "units": 4200},
    {"asset": "Event float",    "currency": "EUR", "units": 1500},
    {"asset": "Sponsor escrow", "currency": "GBP", "units": 800},
    {"asset": "Travel fund",    "currency": "JPY", "units": 250000},
    {"asset": "Local reserve",  "currency": "VND", "units": 12000000},
    {"asset": "Bitcoin",        "currency": "BTC", "units": 0.05},
]

CRYPTO_IDS = {"BTC": "bitcoin", "ETH": "ethereum"}


# ---------------------------------------------------------------------------
# HTTP with a timeout, retries, and backoff
# ---------------------------------------------------------------------------
def fetch_json(url, params=None, attempts=3, timeout=10):
    """GET JSON. Raises RuntimeError once the attempts are used up."""
    last_error = None
    for attempt in range(attempts):
        try:
            response = requests.get(url, params=params, timeout=timeout)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as err:
            last_error = err
            if attempt < attempts - 1:
                time.sleep(2 ** attempt)          # 1s, then 2s
    raise RuntimeError(f"failed after {attempts} attempts: {last_error}")


# ---------------------------------------------------------------------------
# Cache
# ---------------------------------------------------------------------------
def load_cache():
    """Return the cached payload if it is younger than MAX_AGE, else None."""
    if not CACHE_FILE.exists():
        return None
    try:
        blob = json.loads(CACHE_FILE.read_text(encoding="utf-8"))
        age = datetime.now() - datetime.fromisoformat(blob["fetched_at"])
        return blob["payload"] if age < MAX_AGE else None
    except (ValueError, KeyError, OSError):
        return None                                # a corrupt cache is just a miss


def save_cache(payload):
    try:
        CACHE_FILE.write_text(
            json.dumps({"fetched_at": datetime.now().isoformat(), "payload": payload}, indent=2),
            encoding="utf-8")
    except OSError:
        pass                                       # a cache that cannot be written is not fatal


# ---------------------------------------------------------------------------
# Rates: cache -> live -> snapshot
# ---------------------------------------------------------------------------
def get_rates(base="USD", offline=False):
    """Return (rates, source, as_of). Never raises: there is always a fallback."""
    cached = load_cache()
    if cached and cached.get("base") == base:
        return cached["rates"], "cache", cached["date"]

    if not offline:
        try:
            live = fetch_json(FX_URL, {"base": base})
            save_cache(live)
            return live["rates"], "live", live["date"]
        except RuntimeError as err:
            print(f"  ! live FX feed unavailable ({err}): falling back", file=sys.stderr)

    try:
        snap = fetch_json(SNAPSHOT_URL, attempts=1, timeout=8)
    except RuntimeError:
        snap = json.loads(LOCAL_SNAPSHOT.read_text(encoding="utf-8"))

    rates = snap["rates"]
    if snap["base"] != base:                       # re-base the snapshot if needed
        if base not in rates:
            raise KeyError(f"snapshot has no rate for {base}")
        divisor = rates[base]
        rates = {k: v / divisor for k, v in rates.items()}
    return rates, "STALE SNAPSHOT", snap["date"]


def snapshot_rates(base="USD"):
    """The bundled rates, re-based. Used to fill currencies the live feed omits."""
    snap = json.loads(LOCAL_SNAPSHOT.read_text(encoding="utf-8"))
    rates = snap["rates"]
    if snap["base"] != base:
        rates = {k: v / rates[base] for k, v in rates.items()}
    return rates, snap["date"]


def get_crypto_prices(ids=("bitcoin",), vs="usd"):
    """Fail soft: a crypto outage must not take the whole report down."""
    try:
        data = fetch_json(CRYPTO_URL, {"ids": ",".join(ids), "vs_currencies": vs}, attempts=2)
        return {k: v[vs] for k, v in data.items() if vs in v}, "live"
    except (RuntimeError, KeyError, TypeError) as err:
        print(f"  ! crypto feed unavailable ({err}): valued at 0", file=sys.stderr)
        return {}, "unavailable"


# ---------------------------------------------------------------------------
# Conversion
# ---------------------------------------------------------------------------
def convert(amount, frm, to, rates, base="USD"):
    """Convert through the base currency. Handles frm == to and the base itself."""
    if frm == to:
        return amount
    table = dict(rates)
    table[base] = 1.0                              # the API omits the base; add it back
    if frm not in table:
        raise KeyError(f"no rate for {frm}")
    if to not in table:
        raise KeyError(f"no rate for {to}")
    return amount / table[frm] * table[to]


# ---------------------------------------------------------------------------
# Valuation
# ---------------------------------------------------------------------------
def value_portfolio(holdings, rates, crypto, base="USD", primary_source="live"):
    """Value every holding, recording the source of each rate.

    The live ECB feed quotes 29 currencies and VND is not one of them. Rather
    than dropping that holding, fall back to the bundled snapshot for just
    that currency and label the row: mixed provenance, stated openly.
    """
    fallback, fallback_date = None, None
    rows = []

    for h in holdings:
        currency = h["currency"]
        source = primary_source
        note = ""
        try:
            if currency in CRYPTO_IDS:
                unit_value = crypto.get(CRYPTO_IDS[currency], 0.0)
                source = "coingecko" if unit_value else "unavailable"
                note = "" if unit_value else "price unavailable: valued at 0"
            else:
                try:
                    unit_value = convert(1, currency, base, rates)
                except KeyError:
                    if fallback is None:
                        fallback, fallback_date = snapshot_rates(base)
                    unit_value = convert(1, currency, base, fallback)
                    source = "snapshot"
                    note = f"not quoted by the live feed: snapshot rate of {fallback_date}"
            value = h["units"] * unit_value
        except KeyError as err:
            unit_value, value, source, note = 0.0, 0.0, "unavailable", str(err)

        rows.append({**h, "unit_value": round(unit_value, 6),
                     f"value_{base.lower()}": round(value, 2),
                     "source": source, "note": note})

    df = pd.DataFrame(rows)
    column = f"value_{base.lower()}"
    total = df[column].sum()
    # Full precision here; rounded only when printed. Rounding each weight
    # first makes the column sum to 1.000001 instead of 1.0.
    df["weight"] = (df[column] / total) if total else 0.0
    return df.sort_values(column, ascending=False).reset_index(drop=True)


def report(holdings=PORTFOLIO, base="USD", offline=False):
    rates, source, as_of = get_rates(base, offline=offline)
    crypto, crypto_source = get_crypto_prices(tuple(CRYPTO_IDS[c] for c in
                                                    {h["currency"] for h in holdings}
                                                    & set(CRYPTO_IDS)))
    df = value_portfolio(holdings, rates, crypto, base,
                         primary_source="snapshot" if source.startswith("STALE") else source)
    column = f"value_{base.lower()}"
    total = df[column].sum()

    width = 82
    print("=" * width)
    print(f"{'Society treasury valuation':^{width}}")
    print("=" * width)
    print(f"{'asset':<18}{'ccy':<6}{'units':>16}{'unit value':>14}{'value ' + base:>16}{'weight':>9}  {'source':<10}")
    print("-" * width)
    for _, r in df.iterrows():
        print(f"{r['asset']:<18}{r['currency']:<6}{r['units']:>16,.4f}"
              f"{r['unit_value']:>14,.6f}{r[column]:>16,.2f}{r['weight']:>9.1%}  {r['source']:<10}")
    for _, r in df[df["note"] != ""].iterrows():
        print(f"  note: {r['asset']}: {r['note']}")
    print("-" * width)
    print(f"{'Total':<18}{'':<6}{'':>16}{'':>14}{total:>16,.2f}{df['weight'].sum():>9.1%}")
    print("=" * width)
    print(f"FX source: {source}   (as of {as_of})")
    print(f"Crypto source: {crypto_source}")
    print(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    if source.startswith("STALE"):
        print("Warning: these rates are a bundled snapshot, not live market data.")
    return df


# ---------------------------------------------------------------------------
def tests():
    """Run against the bundled snapshot so the numbers are reproducible."""
    snap = json.loads(LOCAL_SNAPSHOT.read_text(encoding="utf-8"))
    rates = snap["rates"]

    assert convert(100, "USD", "USD", rates) == 100
    assert round(convert(250, "EUR", "USD", rates), 2) == 274.03
    assert round(convert(250, "EUR", "GBP", rates), 2) == 210.57
    assert round(convert(10, "USD", "VND", rates), 0) == 254800
    assert round(convert(convert(77, "GBP", "JPY", rates), "JPY", "GBP", rates), 6) == 77.0

    for bad in [lambda: convert(5, "USD", "XXX", rates), lambda: convert(5, "XXX", "USD", rates)]:
        try:
            bad()
        except KeyError:
            pass
        else:
            raise AssertionError("expected a KeyError for an unknown currency")

    try:
        fetch_json("https://api.frankfurter.app/definitely-not-a-real-path", attempts=1, timeout=8)
    except RuntimeError:
        pass                                        # raised, did not hang
    else:
        raise AssertionError("expected RuntimeError from a dead endpoint")

    df = value_portfolio(PORTFOLIO, rates, {"bitcoin": 64000.0})
    assert round(df["weight"].sum(), 6) == 1.0
    assert (df["value_usd"] >= 0).all()

    # a currency the live feed does not quote must still be valued, and labelled
    live_like = {k: v for k, v in rates.items() if k != "VND"}
    mixed = value_portfolio(PORTFOLIO, live_like, {"bitcoin": 64000.0})
    vnd = mixed[mixed["currency"] == "VND"].iloc[0]
    assert vnd["value_usd"] > 0, "VND should fall back to the snapshot, not vanish"
    assert vnd["source"] == "snapshot"
    assert round(mixed["weight"].sum(), 6) == 1.0

    print("all self-checks passed (snapshot rates)\n")


if __name__ == "__main__":
    tests()
    offline = "--offline" in sys.argv
    if offline:
        print("(--offline: skipping the live feed to demonstrate the fallback)\n")
    report(offline=offline)
