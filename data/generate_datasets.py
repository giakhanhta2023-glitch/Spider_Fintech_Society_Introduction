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
import re
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
# LEVEL 14: loan applications with a twelve month default outcome
# ---------------------------------------------------------------------------
def gen_applications():
    """8,000 applications, each with the outcome twelve months later.

    The relationships are deliberate and mild: debt to income and prior
    arrears carry most of the signal, income and employment carry some, and
    region carries none at all, so the level has an honest example of a
    variable that looks useful and is not. Nothing here is a real person.
    """
    rng = random.Random(SEED + 14)
    n = 8000
    purposes = ["debt_consolidation", "home_improvement", "car", "education", "medical", "other"]
    regions = ["north", "south", "central", "east"]
    rows = []

    for i in range(n):
        age = max(21, min(72, int(rng.gauss(38, 11))))
        employment_years = round(max(0.0, min(30.0, rng.gammavariate(2.0, 2.4))), 1)
        income = int(max(9_000, min(240_000, rng.lognormvariate(10.85, 0.52))))
        loan_amount = int(max(1_000, min(60_000, rng.lognormvariate(9.1, 0.65))))
        term_months = rng.choice([12, 24, 36, 48, 60])
        existing_debt = int(max(0, rng.lognormvariate(8.6, 1.1)))
        monthly_debt = existing_debt / 24 + loan_amount / term_months
        dti = round(min(1.2, monthly_debt / (income / 12)), 4)
        prior_defaults = rng.choices([0, 1, 2, 3], weights=[84, 11, 4, 1])[0]
        inquiries_6m = rng.choices([0, 1, 2, 3, 4, 5], weights=[38, 27, 17, 9, 6, 3])[0]
        purpose = rng.choices(purposes, weights=[30, 18, 20, 12, 8, 12])[0]
        region = rng.choice(regions)

        # log odds of default: the relationships the scorecard has to find
        z = (-3.05
             + 3.4 * dti
             + 0.85 * prior_defaults
             + 0.17 * inquiries_6m
             - 0.045 * employment_years
             - 0.0000085 * income
             + (0.42 if purpose == "debt_consolidation" else 0.0)
             + (0.25 if purpose == "medical" else 0.0)
             - (0.30 if purpose == "car" else 0.0)
             + 0.012 * (35 - age))
        p = 1 / (1 + math.exp(-z))
        defaulted = 1 if rng.random() < p else 0

        rows.append({
            "application_id": f"A{200000 + i}",
            "age": age,
            "income": income,
            "employment_years": employment_years,
            "loan_amount": loan_amount,
            "term_months": term_months,
            "existing_debt": existing_debt,
            "dti": dti,
            "prior_defaults": prior_defaults,
            "inquiries_6m": inquiries_6m,
            "purpose": purpose,
            "region": region,
            "defaulted_12m": defaulted,
        })

    path = OUT / "level-14-applications.csv"
    fields = ["application_id", "age", "income", "employment_years", "loan_amount",
              "term_months", "existing_debt", "dti", "prior_defaults", "inquiries_6m",
              "purpose", "region", "defaulted_12m"]
    with path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)
    bad = sum(r["defaulted_12m"] for r in rows)
    print(f"{path.name}: {len(rows)} rows, {bad} defaults ({bad / len(rows):.2%})")


# ---------------------------------------------------------------------------
# LEVEL 18: the same month of spending, exported by three different banks
# ---------------------------------------------------------------------------
def gen_bank_exports():
    """One person, one month, three banks, three incompatible shapes.

    Deliberately included: a different sign convention per bank, three date
    formats, minor units in one file and decimals in another, pending rows
    that later appear as booked, and a re-export overlap so the ingester has
    to deduplicate. Nothing here is a real person or a real account.
    """
    import json

    rng = random.Random(SEED + 18)
    merchants = [
        ("CIRCLE K", "groceries"), ("HIGHLANDS COFFEE", "dining"),
        ("GRAB *RIDE", "transport"), ("VINMART", "groceries"),
        ("SHOPEE", "shopping"), ("NETFLIX.COM", "subscriptions"),
        ("EVN HANOI", "utilities"), ("PHO 24", "dining"),
        ("APPLE.COM/BILL", "subscriptions"), ("LOTTE MART", "groceries"),
    ]

    # one underlying truth, then three exports of it
    truth = []
    day = date(2026, 6, 1)
    for i in range(140):
        d = day + timedelta(days=rng.randint(0, 29))
        name, cat = rng.choice(merchants)
        amount = round(abs(rng.lognormvariate(11.2, 0.9)))     # dong, whole units
        truth.append({"id": f"TX{i:04d}", "date": d, "merchant": name,
                      "category": cat, "amount_vnd": amount})
    truth.sort(key=lambda r: r["date"])

    a, b, c = truth[:60], truth[60:105], truth[105:]

    # ---- bank A: csv, negative debits, ISO dates, decimals, re-export overlap
    rows_a = [{"date": r["date"].isoformat(),
               "description": r["merchant"],
               "amount": f"-{r['amount_vnd']}.00",
               "running_balance": ""} for r in a]
    rows_a += rows_a[-8:]                       # the overlap a second sync brings
    path_a = OUT / "level-18-bank-a.csv"
    with path_a.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=["date", "description", "amount", "running_balance"])
        w.writeheader()
        w.writerows(rows_a)

    # ---- bank B: json, credit/debit indicator, minor units, different keys
    payload = {
        "_note": "SYNTHETIC export for FinQuest level 18. Not a real account.",
        "account": {"iban": "VN00BANKB0000000001", "currency": "VND"},
        "transactions": {
            "booked": [
                {"transactionId": f"B{i:05d}",
                 "bookingDate": r["date"].strftime("%d/%m/%Y"),
                 "valueDate": (r["date"] + timedelta(days=1)).strftime("%d/%m/%Y"),
                 "remittanceInformationUnstructured": f"POS {r['merchant']} HANOI",
                 "transactionAmount": {"amount": str(r["amount_vnd"] * 100), "currency": "VND"},
                 "creditDebitIndicator": "DBIT"}
                for i, r in enumerate(b)
            ]
        }
    }
    path_b = OUT / "level-18-bank-b.json"
    path_b.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")

    # ---- bank C: csv, separate debit and credit columns, pending then booked
    rows_c = []
    for i, r in enumerate(c):
        pending = i % 4 == 0                     # a quarter appear twice
        if pending:
            rows_c.append({"posted_at": r["date"].strftime("%m-%d-%Y"),
                           "merchant_name": r["merchant"].title(),
                           "debit": f"{r['amount_vnd']}", "credit": "",
                           "status": "pending",
                           "reference": f"C{i:05d}"})
        rows_c.append({"posted_at": r["date"].strftime("%m-%d-%Y"),
                       "merchant_name": r["merchant"].title(),
                       "debit": f"{r['amount_vnd']}", "credit": "",
                       "status": "booked",
                       "reference": f"C{i:05d}"})
    path_c = OUT / "level-18-bank-c.csv"
    with path_c.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=["posted_at", "merchant_name", "debit",
                                           "credit", "status", "reference"])
        w.writeheader()
        w.writerows(rows_c)

    total_raw = len(rows_a) + len(payload["transactions"]["booked"]) + len(rows_c)
    print(f"level-18 bank exports: {total_raw} raw rows across three files, "
          f"{len(truth)} real transactions underneath")


# ---------------------------------------------------------------------------
# LEVEL 5: offline fallback snapshot of FX rates (so the level works offline)
# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------
# LEVEL 19: AML monitoring. Customers, payments, and a watchlist.
# ---------------------------------------------------------------------------
def gen_aml():
    """Three files for the monitoring level. Every name here is invented.

    The watchlist is fictional: the names are built from syllables and match
    no real sanctions programme, no real designation and no real person. The
    high risk jurisdictions use ISO 3166 user assigned codes (XA, XB, XC) for
    the same reason, which is also what a real test fixture should do.
    """
    rng = random.Random(SEED + 19)

    syl_a = ["Ka", "Ve", "Mor", "Tal", "Nis", "Dor", "Ral", "Sev",
             "Bran", "Ily", "Zar", "Hen", "Ost", "Umi", "Fel", "Grev"]
    syl_b = ["ren", "vic", "dan", "mir", "lo", "tas", "nek", "riel"]
    fam_a = ["Aldre", "Bosko", "Cerna", "Davre", "Enko", "Farel", "Gostyn", "Hanre",
             "Ivask", "Jorel", "Krevo", "Lundra", "Maros", "Nevic", "Orzek", "Pravin"]
    fam_b = ["ov", "ski", "enko", "ar", "itz", "ul", "yan", "es"]

    given = sorted({a + b for a in syl_a for b in syl_b})
    family = sorted({a + b for a in fam_a for b in fam_b})

    clean = ["VN", "SG", "GB", "US", "DE", "JP", "AU", "FR", "KR", "MY"]
    risky = ["XA", "XB", "XC"]

    # ---- the watchlist: 60 fictional designations, some with aliases
    rng.shuffle(given)
    rng.shuffle(family)
    watch = []
    for i in range(60):
        g, f = given[i], family[i]
        aliases = []
        if i % 3 == 0:
            aliases.append(f"{f}, {g}")                                 # family name first
        if i % 4 == 0:
            aliases.append(f"{g} {given[(i + 31) % len(given)]} {f}")   # with a middle name
        watch.append({
            "entity_id": f"WL-{i:04d}",
            "name": f"{g} {f}",
            "aliases": "|".join(aliases),
            "entity_type": "individual" if i % 5 else "entity",
            "country": rng.choice(risky + clean[:3]),
            "programme": f"SYNTH-{rng.choice(['A', 'B', 'C'])}",
            "dob": "" if i % 5 == 0 else f"19{rng.randint(55, 92)}-{rng.randint(1, 12):02d}-{rng.randint(1, 28):02d}",
        })

    path = OUT / "level-19-watchlist.csv"
    with path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=list(watch[0].keys()))
        w.writeheader()
        w.writerows(watch)
    n_alias = sum(len(e["aliases"].split("|")) for e in watch if e["aliases"])
    print(f"{path.name}: {len(watch)} entities, {n_alias} aliases")

    # ---- customers
    customers = []
    for i in range(400):
        customers.append({
            "customer_id": f"C{i:04d}",
            "name": f"{rng.choice(given)} {rng.choice(family)}",
            "country": rng.choice(clean),
            "onboarded_at": (date(2024, 1, 1) + timedelta(days=rng.randint(0, 800))).isoformat(),
            "risk_rating": rng.choice(["low"] * 7 + ["medium"] * 2 + ["high"]),
            "is_pep": "true" if rng.random() < 0.02 else "false",
        })
    path = OUT / "level-19-customers.csv"
    with path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=list(customers[0].keys()))
        w.writeheader()
        w.writerows(customers)
    print(f"{path.name}: {len(customers)} customers")

    # ---- counterparties: ordinary ones, plus deliberate near misses
    listed = {e["name"]} if False else set()
    for e in watch:
        listed.add(" ".join(sorted(e["name"].upper().split())))
        for a in (e["aliases"].split("|") if e["aliases"] else []):
            listed.add(" ".join(sorted(re.sub(r"[^A-Za-z0-9 ]", " ", a).upper().split())))

    def collides(name):
        return " ".join(sorted(name.upper().split())) in listed

    counterparties = []
    while len(counterparties) < 760:
        cand = f"{rng.choice(given)} {rng.choice(family)}"
        if not collides(cand):
            counterparties.append(cand)
    for e in watch[:40]:
        g, f = e["name"].split(" ")
        counterparties.append(f"{g} {f[:-4]}ski" if f.endswith("enko") else f"{g} {f[:-2]}enko")
        other = rng.choice(given)
        while collides(f"{other} {f}"):
            other = rng.choice(given)
        counterparties.append(f"{other} {f}")
    counterparties = sorted({c for c in counterparties if not collides(c)})

    # ---- payments
    start = datetime(2026, 4, 1, 0, 0)
    payments = []

    def add(when, cust, direction, amount, name, country, channel):
        payments.append({
            "payment_id": f"P{len(payments):06d}",
            "booked_at": when.strftime("%Y-%m-%dT%H:%M:%S"),
            "customer_id": cust,
            "direction": direction,
            "amount_usd": f"{amount:.2f}",
            "counterparty_name": name,
            "counterparty_country": country,
            "channel": channel,
        })

    for _ in range(12000):
        when = start + timedelta(minutes=rng.randint(0, 90 * 24 * 60))
        cust = f"C{rng.randint(0, 399):04d}"
        amount = round(abs(rng.lognormvariate(7.0, 1.1)), 2)
        country = rng.choice(clean) if rng.random() > 0.04 else rng.choice(risky)
        add(when, cust, rng.choice(["in", "out"]), amount,
            rng.choice(counterparties), country,
            rng.choice(["wire"] * 6 + ["card"] * 2 + ["cash"]))

    # ---- planted: seven payments to real watchlist entities, written seven ways
    hits = [
        (watch[0]["name"], "exact"),
        (watch[1]["name"].upper(), "upper case"),
        (watch[3]["aliases"].split("|")[0], "alias, family name first"),
        (watch[7]["name"].replace("k", "c").replace("K", "C"), "transliteration"),
        ("MR " + watch[11]["name"], "with a title"),
        (watch[15]["name"][:4] + watch[15]["name"][5:], "one letter dropped"),
        (" ".join(reversed(watch[21]["name"].split(" "))), "word order swapped"),
    ]
    for name, _kind in hits:
        when = start + timedelta(minutes=rng.randint(0, 90 * 24 * 60))
        add(when, f"C{rng.randint(0, 399):04d}", "out",
            round(abs(rng.lognormvariate(8.2, 0.6)), 2), name,
            rng.choice(risky), "wire")

    # ---- planted: structuring, four customers under a 10,000 report threshold
    for k in range(4):
        cust = f"C{300 + k:04d}"
        day0 = start + timedelta(days=10 + k * 7)
        for j in range(6):
            add(day0 + timedelta(days=j % 5, hours=rng.randint(9, 17)), cust, "in",
                round(rng.uniform(9000, 9900), 2),
                f"{rng.choice(given)} {rng.choice(family)}", "US", "cash")

    # ---- innocent cash: near the threshold but neither frequent nor clustered
    for k in range(12):
        cust = f"C{200 + k:04d}"
        day0 = start + timedelta(days=rng.randint(0, 80))
        for j in range(2):
            add(day0 + timedelta(days=j * rng.randint(2, 4), hours=rng.randint(9, 17)),
                cust, "in", round(rng.uniform(9000, 9900), 2),
                f"{rng.choice(given)} {rng.choice(family)}", "US", "cash")

    # ---- planted: pass through, in and almost all out within a day
    for k in range(3):
        cust = f"C{350 + k:04d}"
        t0 = start + timedelta(days=20 + k * 9, hours=9)
        received = round(rng.uniform(40000, 60000), 2)
        add(t0, cust, "in", received, f"{rng.choice(given)} {rng.choice(family)}",
            rng.choice(clean), "wire")
        left = received * rng.uniform(0.92, 0.96)
        for j in range(3):
            add(t0 + timedelta(hours=4 + j * 5), cust, "out", round(left / 3, 2),
                f"{rng.choice(given)} {rng.choice(family)}", rng.choice(risky), "wire")

    payments.sort(key=lambda r: r["booked_at"])
    path = OUT / "level-19-payments.csv"
    with path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=list(payments[0].keys()))
        w.writeheader()
        w.writerows(payments)
    print(f"{path.name}: {len(payments)} payments, {len(counterparties)} counterparties")


# ---------------------------------------------------------------------------
# LEVEL 20: one load test against the level 12 payment service
# ---------------------------------------------------------------------------
def gen_loadtest():
    """Ten minutes at a hundred requests a second, with one bad minute in it.

    Synthetic, but shaped like a real run: a warm up, a steady state, a
    minute where the database slows down and a fraction of requests fail,
    and a recovery. The point is that the summary average hides all of it.
    """
    rng = random.Random(SEED + 20)

    endpoints = (["POST /payments"] * 6 + ["GET /payments/{id}"] * 3 + ["GET /health"])
    base = {"POST /payments": 3.55, "GET /payments/{id}": 2.95, "GET /health": 1.10}

    start = datetime(2026, 7, 2, 14, 0, 0)
    rows = []
    for i in range(60000):
        offset = i / 100.0                       # 100 requests a second
        when = start + timedelta(seconds=offset)
        ep = rng.choice(endpoints)
        latency = rng.lognormvariate(base[ep], 0.55)

        if offset < 5:                           # cold start, first five seconds
            latency *= rng.uniform(3.0, 9.0)

        status = 201 if ep.startswith("POST") else 200
        if 360 <= offset < 420:                  # the bad minute
            latency *= rng.uniform(3.5, 7.0)
            if rng.random() < 0.09:
                status = 503
                latency = rng.uniform(20, 60)    # failures come back fast
        elif rng.random() < 0.0008:              # ordinary background errors
            status = 500
            latency = rng.uniform(15, 40)

        rows.append({
            "at": when.strftime("%Y-%m-%dT%H:%M:%S.") + f"{int((offset % 1) * 1000):03d}",
            "endpoint": ep,
            "status": status,
            "latency_ms": f"{latency:.2f}",
        })

    path = OUT / "level-20-loadtest.csv"
    with path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    bad = sum(1 for r in rows if int(r["status"]) >= 500)
    print(f"{path.name}: {len(rows)} requests, {bad} failed ({bad / len(rows):.2%})")


# ---------------------------------------------------------------------------
# LEVEL 9: a day of card authorisations and everything that happened next
# ---------------------------------------------------------------------------
def gen_card_events():
    """One merchant, one week, every event in the life of each payment.

    Shaped like a real card book: most authorisations are approved and then
    captured within a day, a few are captured for less than was authorised, a
    few are voided, some holds expire untouched, a small share are refunded,
    and a very small share come back as chargebacks. A handful of requests time
    out, which is the case that costs engineers their afternoon: the network
    may or may not have approved them.
    """
    rng = random.Random(SEED + 9)

    DECLINE_CODES = [
        ("insufficient_funds", 0.42, True),    # retryable later: the money may arrive
        ("do_not_honor", 0.24, True),          # issuer said no without saying why
        ("incorrect_cvc", 0.11, False),
        ("expired_card", 0.08, False),
        ("velocity_exceeded", 0.08, True),
        ("lost_or_stolen", 0.04, False),
        ("pickup_card", 0.03, False),
    ]
    codes = [c for c, _, _ in DECLINE_CODES]
    weights = [w for _, w, _ in DECLINE_CODES]

    start = datetime(2026, 5, 4, 0, 0)          # a Monday
    rows = []
    payment = 0

    def add(payment_id, at, event, amount, result="", code="", latency_ms=""):
        rows.append({
            "event_id": f"E{len(rows):06d}",
            "payment_id": payment_id,
            "at": at.strftime("%Y-%m-%dT%H:%M:%S"),
            "event": event,
            "amount_minor": amount,
            "result": result,
            "decline_code": code,
            "latency_ms": latency_ms,
        })

    for _ in range(20000):
        payment += 1
        pid = f"P{payment:06d}"

        # busier in the evening, quieter overnight
        day = rng.randint(0, 6)
        hour = rng.choices(range(24),
                           weights=[2, 1, 1, 1, 1, 2, 4, 7, 9, 10, 11, 12,
                                    13, 12, 11, 11, 12, 14, 16, 15, 12, 9, 6, 3])[0]
        at = start + timedelta(days=day, hours=hour, minutes=rng.randint(0, 59),
                               seconds=rng.randint(0, 59))
        amount = int(round(abs(rng.lognormvariate(8.6, 0.9))))      # cents
        amount = max(amount, 150)

        roll = rng.random()
        if roll < 0.0072:
            # the network never answered: state unknown until reconciliation
            add(pid, at, "authorize", amount, "timeout", "", rng.randint(28000, 31000))
            continue
        if roll < 0.0072 + 0.1284:
            code = rng.choices(codes, weights=weights)[0]
            add(pid, at, "authorize", amount, "declined", code, rng.randint(90, 900))
            continue

        add(pid, at, "authorize", amount, "approved", "", rng.randint(80, 1200))

        outcome = rng.random()
        if outcome < 0.031:
            add(pid, at + timedelta(minutes=rng.randint(2, 240)), "void", amount)
            continue
        if outcome < 0.031 + 0.048:
            # nobody ever captured it: the hold expires after seven days
            add(pid, at + timedelta(days=7), "expire", amount)
            continue

        # captured, usually within a day, occasionally much later
        delay = timedelta(hours=rng.choices([2, 8, 20, 30, 70, 140],
                                            weights=[34, 30, 18, 10, 6, 2])[0],
                          minutes=rng.randint(0, 59))
        captured = amount
        if rng.random() < 0.081:
            captured = int(amount * rng.uniform(0.35, 0.92))        # partial capture
        capture_at = at + delay
        add(pid, capture_at, "capture", captured)

        after = rng.random()
        if after < 0.0412:
            refund = captured if rng.random() < 0.72 else int(captured * rng.uniform(0.2, 0.8))
            add(pid, capture_at + timedelta(days=rng.randint(1, 20)), "refund", refund)
        elif after < 0.0412 + 0.0054:
            add(pid, capture_at + timedelta(days=rng.randint(10, 60)), "chargeback", captured)

    rows.sort(key=lambda r: (r["at"], r["event_id"]))
    path = OUT / "level-09-card-events.csv"
    with path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)

    auths = [r for r in rows if r["event"] == "authorize"]
    approved = sum(1 for r in auths if r["result"] == "approved")
    print(f"{path.name}: {len(rows)} events, {len(auths)} authorisations, "
          f"{approved} approved ({approved / len(auths):.1%})")


# ---------------------------------------------------------------------------
# LEVEL 10: what the processor says happened, which is never quite what you say
# ---------------------------------------------------------------------------
def gen_settlement():
    """The processor's settlement file for the level 9 week, plus payouts.

    Built from the same events, then made realistic: fees deducted, money
    settled a day or two after capture, a few lines the ledger has never seen,
    a few captures that settle later than the file covers, one duplicated line,
    amounts that differ by rounding on foreign currency, and the chargebacks
    with their dispute fees. Every break in it is a break somebody has spent a
    morning on in a real job.
    """
    rng = random.Random(SEED + 10)

    source = OUT / "level-09-card-events.csv"
    events = list(csv.DictReader(source.open(encoding="utf-8")))
    for e in events:
        e["amount_minor"] = int(e["amount_minor"])
        e["at"] = datetime.fromisoformat(e["at"])

    PCT, FIXED = 0.029, 30                      # 2.9% plus 30 cents
    DISPUTE_FEE = 1500                          # $15.00 per chargeback

    def fee_for(amount):
        return int(round(amount * PCT)) + FIXED

    rows = []
    breaks = {"missing_in_ledger": 0, "missing_in_file": 0, "never_settled": 0,
              "amount": 0, "duplicate": 0, "fx_rounding": 0, "fee_mismatch": 0}

    # a small set of payments the processor settled that the ledger never recorded:
    # these are the level 9 timeouts that were actually approved at the network
    timeouts = [e for e in events if e["event"] == "authorize" and e["result"] == "timeout"]
    ghosts = set(rng.sample([e["payment_id"] for e in timeouts], 37))

    def add(line_id, settled_at, payment_id, kind, gross, fee, currency="USD", note=""):
        rows.append({
            "settlement_id": line_id,
            "settled_at": settled_at.strftime("%Y-%m-%d"),
            "payment_id": payment_id,
            "type": kind,
            "gross_minor": gross,
            "fee_minor": fee,
            "net_minor": gross - fee,
            "currency": currency,
            "note": note,
        })

    cutoff = datetime(2026, 7, 20)              # the file covers everything up to here

    # captures the processor simply never settled: real money the merchant is owed
    captures = [e for e in events if e["event"] == "capture"]
    never_settled = set(rng.sample([e["event_id"] for e in captures], 12))

    for e in events:
        if e["event"] not in {"capture", "refund", "chargeback"}:
            continue
        settle_days = rng.choices([1, 2, 3], weights=[62, 31, 7])[0]
        settled = e["at"] + timedelta(days=settle_days)
        if settled >= cutoff:
            breaks["missing_in_file"] += 1       # captured, settles after this file
            continue
        if e["event_id"] in never_settled:
            breaks["never_settled"] += 1         # the processor owes this and has not paid
            continue

        pid = e["payment_id"]
        amount = e["amount_minor"]
        line = f"S{len(rows):06d}"

        if e["event"] == "capture":
            fee = fee_for(amount)
            currency, note = "USD", ""
            if rng.random() < 0.0094:            # priced in euros, settled in dollars
                currency, note = "EUR", "converted at 1.0961"
                amount = int(round(amount * 1.0961))
                fee = fee_for(amount) + rng.choice([-1, 1])
                breaks["fx_rounding"] += 1
            elif rng.random() < 0.0036:          # the processor charged a different fee
                fee += rng.choice([-25, -12, 11, 40])
                breaks["fee_mismatch"] += 1
            elif rng.random() < 0.0021:          # the processor settled a different amount
                amount += rng.choice([-100, -1, 1, 250])
                fee = fee_for(amount)
                breaks["amount"] += 1
            add(line, settled, pid, "capture", amount, fee, currency, note)

        elif e["event"] == "refund":
            add(line, settled, pid, "refund", -amount, 0)
        else:
            add(line, settled, pid, "chargeback", -amount, DISPUTE_FEE)

    # lines for payments the ledger never recorded at all
    for pid in sorted(ghosts):
        e = next(x for x in events if x["payment_id"] == pid)
        amount = e["amount_minor"]
        settled = e["at"] + timedelta(days=2)
        if settled >= cutoff:
            settled = cutoff - timedelta(days=1)
        add(f"S{len(rows):06d}", settled, pid, "capture", amount, fee_for(amount),
            "USD", "")
        breaks["missing_in_ledger"] += 1

    # one line the processor sent twice
    victim = rng.choice([r for r in rows if r["type"] == "capture"])
    duplicate = dict(victim)
    duplicate["settlement_id"] = f"S{len(rows):06d}"
    rows.append(duplicate)
    breaks["duplicate"] += 1

    rows.sort(key=lambda r: (r["settled_at"], r["settlement_id"]))
    path = OUT / "level-10-settlement.csv"
    with path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)

    # payouts: one per settlement date, the net of everything settled that day
    by_day = {}
    for r in rows:
        by_day.setdefault(r["settled_at"], []).append(r)
    payouts = []
    for day in sorted(by_day):
        lines = by_day[day]
        payouts.append({
            "payout_id": f"PO-{day}",
            "paid_at": day,
            "line_count": len(lines),
            "gross_minor": sum(r["gross_minor"] for r in lines),
            "fee_minor": sum(r["fee_minor"] for r in lines),
            "net_minor": sum(r["net_minor"] for r in lines),
        })
    ppath = OUT / "level-10-payouts.csv"
    with ppath.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=list(payouts[0].keys()))
        w.writeheader()
        w.writerows(payouts)

    print(f"{path.name}: {len(rows)} settlement lines, {ppath.name}: {len(payouts)} payouts")
    print(f"   planted breaks: {breaks}")


def gen_fx_snapshot():
    import json
    snapshot = {
        "_note": "SYNTHETIC offline fallback for FinQuest level 5. Not live market data.",
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
    gen_applications()
    gen_bank_exports()
    gen_aml()
    gen_loadtest()
    gen_card_events()
    gen_settlement()
    gen_fx_snapshot()
    print("done, all datasets are synthetic")
