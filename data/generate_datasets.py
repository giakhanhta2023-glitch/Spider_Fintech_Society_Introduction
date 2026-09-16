"""
FinQuest: synthetic dataset generator
======================================
Every CSV in this folder is SYNTHETIC. No real customer, account, or market
data is used anywhere in this course. This script regenerates all of it
deterministically, so the expected answers in the level briefs stay stable.

Run:  python data/generate_datasets.py
"""

import csv
import math
import random
from datetime import date, datetime, timedelta
from pathlib import Path

OUT = Path(__file__).parent
SEED = 20250915
PRICE_SEED = 20250918   # chosen so the three-year paths show a realistic mix of outcomes


# ---------------------------------------------------------------------------
# LEVEL 3: personal transaction history (6 months, one account)
# ---------------------------------------------------------------------------
def gen_transactions():
    rng = random.Random(SEED)
    rows = []

    start = date(2025, 3, 1)
    months = [(2025, m) for m in range(3, 9)]  # Mar..Aug 2025

    groceries = ["FRESHMART", "GREEN GROCER", "SUPERSAVE", "CORNER MARKET"]
    dining = ["NOODLE HOUSE", "BURGER LAB", "SUSHI GO", "PIZZA UNO", "THE CURRY POT"]
    coffee = ["BEAN THERE", "CAFE ORBIT", "DAILY GRIND"]
    transport = ["METRO CARD TOPUP", "CITY BUS", "RIDEHAIL", "FUEL STOP"]
    shopping = ["ZARA", "DECATHLON", "BOOK NOOK", "TECH BAZAAR", "HOME GOODS"]

    def add(d, desc, cat, amount, method="card"):
        rows.append({
            "date": d.isoformat(),
            "description": desc,
            "category": cat,
            "amount": round(amount, 2),
            "account": "CHK-4471",
            "method": method,
        })

    for (y, m) in months:
        # --- income ---
        add(date(y, m, 25), "SALARY - NEXUS TECH", "income", 3200.00, "transfer")
        if m in (5, 8):  # quarterly bonus
            add(date(y, m, 25), "BONUS - NEXUS TECH", "income", 450.00, "transfer")

        # --- fixed costs ---
        add(date(y, m, 1), "RENT - HARBOUR LOFTS", "housing", -1150.00, "transfer")
        add(date(y, m, 15), "FIBRENET INTERNET", "utilities", -45.00, "direct_debit")
        add(date(y, m, 10), "CITY POWER", "utilities", -round(rng.uniform(48, 82), 2), "direct_debit")
        add(date(y, m, 20), "AQUA UTILITIES", "utilities", -round(rng.uniform(18, 28), 2), "direct_debit")

        # --- subscriptions (identical amount every month: the pattern to detect) ---
        add(date(y, m, 5), "NETFLIX", "subscriptions", -12.99, "card")
        add(date(y, m, 12), "SPOTIFY PREMIUM", "subscriptions", -9.99, "card")
        add(date(y, m, 8), "ICLOUD STORAGE", "subscriptions", -2.99, "card")
        add(date(y, m, 2), "IRONWORKS GYM", "subscriptions", -35.00, "direct_debit")
        add(date(y, m, 18), "CLOUDSTREAM TV", "subscriptions", -15.99, "card")

        # --- savings transfer ---
        add(date(y, m, 26), "TRANSFER TO SAVINGS", "savings", -300.00, "transfer")

        # --- variable spending ---
        for _ in range(rng.randint(4, 6)):
            d = date(y, m, rng.randint(1, 28))
            add(d, rng.choice(groceries), "groceries", -round(rng.uniform(22, 95), 2))
        for _ in range(rng.randint(5, 9)):
            d = date(y, m, rng.randint(1, 28))
            add(d, rng.choice(dining), "dining", -round(rng.uniform(9, 42), 2))
        for _ in range(rng.randint(6, 11)):
            d = date(y, m, rng.randint(1, 28))
            add(d, rng.choice(coffee), "dining", -round(rng.uniform(3.2, 7.5), 2))
        for _ in range(rng.randint(3, 6)):
            d = date(y, m, rng.randint(1, 28))
            add(d, rng.choice(transport), "transport", -round(rng.uniform(6, 55), 2))
        for _ in range(rng.randint(1, 4)):
            d = date(y, m, rng.randint(1, 28))
            add(d, rng.choice(shopping), "shopping", -round(rng.uniform(18, 180), 2))

        # --- occasional refund ---
        if rng.random() < 0.4:
            add(date(y, m, rng.randint(5, 27)), "REFUND - " + rng.choice(shopping), "shopping",
                round(rng.uniform(15, 70), 2))

    rows.sort(key=lambda r: (r["date"], r["description"]))

    path = OUT / "level-03-transactions.csv"
    with path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=["date", "description", "category", "amount", "account", "method"])
        w.writeheader()
        w.writerows(rows)
    print(f"{path.name}: {len(rows)} rows, {start}. {rows[-1]['date']}")
    return rows


# ---------------------------------------------------------------------------
# LEVEL 7: daily prices for four fictional assets (3 years, business days)
# ---------------------------------------------------------------------------
def gen_prices():
    rng = random.Random(PRICE_SEED)

    assets = [
        # ticker,    start,  annual drift, annual vol, correlation with market factor
        ("TECHX", 100.0, 0.16, 0.30, 0.80),
        ("BANKCO", 55.0, 0.07, 0.19, 0.65),
        ("GOLDF", 180.0, 0.05, 0.14, 0.15),
        ("CRYPTOZ", 240.0, 0.28, 0.72, 0.70),
    ]

    start = date(2022, 9, 1)
    end = date(2025, 8, 29)
    days = []
    d = start
    while d <= end:
        if d.weekday() < 5:
            days.append(d)
        d += timedelta(days=1)

    dt = 1 / 252
    prices = {t: [p0] for (t, p0, _, _, _) in assets}

    for i in range(1, len(days)):
        market = rng.gauss(0, 1)  # shared factor -> realistic correlation
        for (ticker, _p0, mu, sigma, rho) in assets:
            idio = rng.gauss(0, 1)
            # rho * market + sqrt(1 - rho^2) * idio keeps the shock at unit
            # variance, so realised vol matches sigma instead of exceeding it.
            shock = rho * market + math.sqrt(1 - rho * rho) * idio
            prev = prices[ticker][-1]
            nxt = prev * math.exp((mu - 0.5 * sigma ** 2) * dt + sigma * math.sqrt(dt) * shock)
            prices[ticker].append(round(nxt, 2))

    path = OUT / "level-07-prices.csv"
    with path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["date"] + [a[0] for a in assets])
        for i, day in enumerate(days):
            w.writerow([day.isoformat()] + [prices[a[0]][i] for a in assets])
    print(f"{path.name}: {len(days)} rows x {len(assets)} assets")


# ---------------------------------------------------------------------------
# LEVEL 8: labelled card transactions for fraud detection
# ---------------------------------------------------------------------------
def gen_fraud():
    rng = random.Random(SEED + 8)
    n = 6000
    fraud_rate = 0.018

    categories = ["grocery", "fuel", "restaurant", "electronics", "travel", "gaming", "pharmacy", "clothing"]
    home_country = "VN"
    foreign = ["SG", "US", "GB", "RU", "NG", "BR", "JP"]

    start = datetime(2025, 6, 1)
    rows = []

    for i in range(n):
        is_fraud = rng.random() < fraud_rate
        customer = f"C{rng.randint(1000, 1400)}"
        ts = start + timedelta(minutes=rng.randint(0, 60 * 24 * 60))

        if not is_fraud:
            hour_weights = [1, 1, 1, 1, 1, 2, 4, 6, 8, 9, 9, 10, 10, 9, 8, 8, 9, 10, 10, 9, 7, 5, 3, 2]
            hour = rng.choices(range(24), weights=hour_weights)[0]
            ts = ts.replace(hour=hour, minute=rng.randint(0, 59))
            category = rng.choice(categories)
            amount = round(abs(rng.lognormvariate(3.1, 0.85)), 2)
            country = home_country if rng.random() < 0.94 else rng.choice(foreign)
            card_present = 1 if rng.random() < 0.62 else 0
            hours_since_prev = round(abs(rng.lognormvariate(2.0, 1.1)), 2)
            txns_last_1h = rng.choices([0, 1, 2, 3], weights=[62, 26, 9, 3])[0]
        else:
            hour = rng.choices(range(24), weights=[8, 9, 9, 8, 6, 3, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 5, 6, 7, 8, 9, 9])[0]
            ts = ts.replace(hour=hour, minute=rng.randint(0, 59))
            category = rng.choices(categories, weights=[2, 3, 3, 26, 22, 24, 2, 18])[0]
            amount = round(abs(rng.lognormvariate(4.6, 1.0)), 2)
            country = rng.choice(foreign) if rng.random() < 0.72 else home_country
            card_present = 1 if rng.random() < 0.08 else 0
            hours_since_prev = round(abs(rng.lognormvariate(-0.6, 1.0)), 2)
            txns_last_1h = rng.choices([0, 1, 2, 3, 4, 5, 6], weights=[4, 8, 14, 20, 20, 18, 16])[0]

        rows.append({
            "txn_id": f"T{100000 + i}",
            "timestamp": ts.strftime("%Y-%m-%d %H:%M:%S"),
            "customer_id": customer,
            "amount": amount,
            "category": category,
            "country": country,
            "card_present": card_present,
            "hours_since_prev_txn": hours_since_prev,
            "txns_last_1h": txns_last_1h,
            "is_fraud": int(is_fraud),
        })

    rows.sort(key=lambda r: r["timestamp"])

    path = OUT / "level-08-transactions.csv"
    fields = ["txn_id", "timestamp", "customer_id", "amount", "category", "country",
              "card_present", "hours_since_prev_txn", "txns_last_1h", "is_fraud"]
    with path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)
    frauds = sum(r["is_fraud"] for r in rows)
    print(f"{path.name}: {len(rows)} rows, {frauds} fraud ({frauds / len(rows):.2%})")


# ---------------------------------------------------------------------------
# LEVEL 5: offline fallback snapshot of FX rates (so the level works offline)
# ---------------------------------------------------------------------------
def gen_fx_snapshot():
    import json
    snapshot = {
        "_note": "SYNTHETIC offline fallback for FinQuest Level 5. Not live market data.",
        "base": "USD",
        "date": "2025-09-01",
        "rates": {
            "USD": 1.0, "EUR": 0.9123, "GBP": 0.7684, "JPY": 147.32,
            "VND": 25480.0, "SGD": 1.3045, "AUD": 1.5012, "INR": 87.41
        }
    }
    path = OUT / "level-05-fx-snapshot.json"
    path.write_text(json.dumps(snapshot, indent=2), encoding="utf-8")
    print(f"{path.name}: {len(snapshot['rates'])} currencies")


if __name__ == "__main__":
    gen_transactions()
    gen_prices()
    gen_fraud()
    gen_fx_snapshot()
    print("done, all datasets are synthetic")
