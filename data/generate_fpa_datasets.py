"""
FinQuest analyst track: Meridian Pay, a synthetic payments company
===================================================================
Every file this writes is SYNTHETIC. No real company, customer or invoice is
used anywhere in this course.

    python data/generate_fpa_datasets.py

The company is simulated month by month rather than sampled from a
distribution, and that is the point: a balance sheet only balances if the cash
flow that moved it was real. The simulation runs a small three statement model
for 24 months, asserts that assets equal liabilities plus equity in **every**
month to the cent, and only then writes the files. If the assertion fails,
nothing is written, because a teaching dataset that does not tie would teach
somebody to stop checking.

What comes out:

    fpa-actuals.csv      the general ledger export: month, cost centre,
                         account, amount, signed the way a ledger signs it
    fpa-budget.csv       the FY2025 plan, from a planning run of the same model
    fpa-invoices.csv     invoice level revenue detail, for the SQL level
    fpa-customers.csv    who the invoices belong to
    fpa-headcount.csv    heads and payroll cost by department by month
    fpa-history.csv      the clean three statement history, for the model level

The variances between plan and actual are **caused** rather than sprinkled:
a mix shift to larger merchants on lower pricing, a marketing campaign pulled
forward from Q4, three support hires that never happened, a one off scheme fee
credit, and a cloud invoice posted to the wrong account and corrected the month
after. Each one is a thing somebody has to explain in a meeting, which is what
the analyst track is about.
"""

from __future__ import annotations

import csv
import random
from dataclasses import dataclass, field
from datetime import date, timedelta
from pathlib import Path

OUT = Path(__file__).parent
SEED = 20260927

# The close being taught. Actuals run to here; the budget covers all of FY2025.
LAST_ACTUAL = (2025, 9)
FIRST_MONTH = (2024, 1)
LAST_MONTH = (2025, 12)

TAX_RATE = 0.21
LOAN_RATE = 0.095            # annual, on the opening balance of each month
LOAN_PRINCIPAL_MONTHLY = 125_000_00      # cents


def months(first: tuple[int, int], last: tuple[int, int]) -> list[tuple[int, int]]:
    out, (y, m) = [], first
    while (y, m) <= last:
        out.append((y, m))
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)
    return out


def label(ym: tuple[int, int]) -> str:
    return f"{ym[0]}-{ym[1]:02d}"


def cents(x: float) -> int:
    """One rounding rule for the whole file, applied once per amount."""
    return int(round(x * 100))


def dollars(c: int) -> str:
    return f"{c / 100:.2f}"


# ---------------------------------------------------------------------------
# The business
# ---------------------------------------------------------------------------
@dataclass
class Assumptions:
    """What the company believes about itself.

    Two instances of this exist: the one the business actually ran at, and the
    one the annual plan assumed. Every budget variance in the course traces
    back to a difference between these two objects, which is why the teaching
    text can explain each one instead of calling it noise.
    """
    name: str
    volume_start: float = 230_000_000.0      # payment volume, dollars, Jan 2024
    volume_growth: float = 0.022             # a month
    take_rate: float = 0.0062                # transaction fee, share of volume
    scheme_cost_rate: float = 0.0033         # what the schemes and the acquirer take
    xborder_share: float = 0.18
    fx_markup: float = 0.0035
    hosting_start: float = 85_000.0
    hosting_growth: float = 0.018
    marketing: dict = field(default_factory=dict)      # month label -> dollars
    hiring: dict = field(default_factory=dict)         # department -> plan
    capex_monthly: float = 120_000.0


DEPARTMENTS = ["engineering", "sales", "marketing", "support", "g_and_a"]

# Salary per head per month, by department. Flat within a department, because a
# course dataset that models salary bands teaches nothing extra and makes every
# number harder to check by hand.
SALARY = {
    "engineering": 11_800.0,
    "sales": 9_400.0,
    "marketing": 8_900.0,
    "support": 5_600.0,
    "g_and_a": 9_100.0,
}

SEASONALITY = {1: 0.88, 2: 0.94, 3: 1.00, 4: 0.99, 5: 1.02, 6: 1.01,
               7: 0.98, 8: 0.97, 9: 1.03, 10: 1.06, 11: 1.18, 12: 1.22}


def actual_assumptions() -> Assumptions:
    a = Assumptions(name="actual")
    # The mix shift: large merchants arrived faster than planned and they are on
    # lower pricing, so volume beat the plan while the take rate fell short.
    a.volume_growth = 0.0265
    a.take_rate = 0.0058
    # The campaign that was supposed to run in October and November ran in
    # September instead, which is a timing variance rather than an overspend.
    a.marketing = {label(ym): 180_000.0 for ym in months(FIRST_MONTH, LAST_MONTH)}
    a.marketing["2025-09"] = 390_000.0
    a.marketing["2025-10"] = 95_000.0
    a.marketing["2025-11"] = 95_000.0
    # Support hiring stalled: three heads that the plan paid for were never made.
    a.hiring = {
        "engineering": {"start": 38, "adds": {"2024-04": 2, "2024-09": 3, "2025-02": 4, "2025-06": 3}},
        "sales": {"start": 14, "adds": {"2024-06": 2, "2025-01": 2, "2025-07": 2}},
        "marketing": {"start": 6, "adds": {"2024-08": 1, "2025-03": 1}},
        "support": {"start": 19, "adds": {"2024-05": 2, "2025-04": 1}},
        "g_and_a": {"start": 11, "adds": {"2024-10": 1, "2025-05": 1}},
    }
    return a


def plan_assumptions() -> Assumptions:
    """The FY2025 annual plan, built in late 2024 on the trend at the time."""
    a = Assumptions(name="plan")
    a.volume_growth = 0.021
    a.take_rate = 0.0062
    a.marketing = {label(ym): 180_000.0 for ym in months(FIRST_MONTH, LAST_MONTH)}
    a.marketing["2025-10"] = 240_000.0
    a.marketing["2025-11"] = 240_000.0
    a.hiring = {
        "engineering": {"start": 38, "adds": {"2024-04": 2, "2024-09": 3, "2025-02": 4, "2025-06": 3}},
        "sales": {"start": 14, "adds": {"2024-06": 2, "2025-01": 2, "2025-07": 2}},
        "marketing": {"start": 6, "adds": {"2024-08": 1, "2025-03": 1}},
        # The plan paid for six support hires across the year. Three happened.
        "support": {"start": 19, "adds": {"2024-05": 2, "2025-02": 2, "2025-04": 1, "2025-08": 3}},
        "g_and_a": {"start": 11, "adds": {"2024-10": 1, "2025-05": 1}},
    }
    return a


@dataclass
class MonthResult:
    month: str
    volume: int
    merchants: int
    revenue_txn: int
    revenue_sub: int
    revenue_fx: int
    cogs_scheme: int
    cogs_hosting: int
    payroll: dict
    marketing: int
    other_opex: int
    depreciation: int
    interest: int
    tax: int
    net_income: int
    cash: int
    ar: int
    ppe: int
    ap: int
    debt: int
    paid_in: int
    retained: int

    @property
    def revenue(self) -> int:
        return self.revenue_txn + self.revenue_sub + self.revenue_fx

    @property
    def cogs(self) -> int:
        return self.cogs_scheme + self.cogs_hosting

    @property
    def gross_profit(self) -> int:
        return self.revenue - self.cogs

    @property
    def opex(self) -> int:
        return sum(self.payroll.values()) + self.marketing + self.other_opex

    @property
    def ebitda(self) -> int:
        return self.gross_profit - self.opex

    @property
    def assets(self) -> int:
        return self.cash + self.ar + self.ppe

    @property
    def liabilities_and_equity(self) -> int:
        return self.ap + self.debt + self.paid_in + self.retained


def headcount(plan: dict, month: str) -> int:
    n = plan["start"]
    for when, adds in sorted(plan["adds"].items()):
        if when <= month:
            n += adds
    return n


def simulate(a: Assumptions, roster: list, noise: bool = True,
             ignore_churn: bool = False) -> list[MonthResult]:
    """Run the company for 24 months, three statements at a time.

    Deliberately written as one loop with the balance sheet at the bottom: the
    order here is the order a model is built in, and the cash line is a result
    rather than an input. Everything is integer cents, so the tie at the end is
    exact rather than nearly exact.
    """
    rng = random.Random(SEED if a.name == "actual" else SEED + 1)

    # The opening balance sheet, 31 December 2023. Retained earnings is the
    # plug that makes it balance, which is what an opening balance always is:
    # here it is negative, because the company has raised more than it has
    # earned, which is the normal state of a growing payments business.
    cash = 12_000_000_00
    ar = 2_300_000_00
    ppe = 3_100_000_00
    ap = 1_850_000_00
    debt = 6_000_000_00
    paid_in = 22_000_000_00
    retained = (cash + ar + ppe) - (ap + debt + paid_in)

    out: list[MonthResult] = []
    volume = a.volume_start
    hosting = a.hosting_start
    prev_ar = ar
    prev_ap = ap

    for ym in months(FIRST_MONTH, LAST_MONTH):
        m = label(ym)
        season = SEASONALITY[ym[1]]
        wobble = rng.uniform(0.985, 1.015) if noise else 1.0

        month_volume = volume * season * wobble
        revenue_txn = cents(month_volume * a.take_rate)
        # The platform fee comes from the merchant roster rather than from an
        # average, so the invoice file can tie to this number exactly. The plan
        # ignores churn, because plans do.
        revenue_sub = subscription_cents(roster, m, ignore_churn)
        revenue_fx = cents(month_volume * a.xborder_share * a.fx_markup)
        revenue = revenue_txn + revenue_sub + revenue_fx

        cogs_scheme = cents(month_volume * a.scheme_cost_rate)
        # August 2025: the schemes refunded an interchange overcharge going back
        # four months. Real money, one month, and it makes that month's gross
        # margin look like something the company did.
        if a.name == "actual" and m == "2025-08":
            cogs_scheme -= 145_000_00
        cogs_hosting = cents(hosting)
        cogs = cogs_scheme + cogs_hosting

        payroll = {d: cents(headcount(a.hiring[d], m) * SALARY[d]) for d in DEPARTMENTS}
        marketing = cents(a.marketing[m])
        # Rent, software, audit, insurance: flat with a small annual step.
        other_opex = cents(148_000.0 * (1.06 if ym[0] == 2025 else 1.0))
        opex = sum(payroll.values()) + marketing + other_opex

        capex = cents(a.capex_monthly)
        depreciation = cents(ppe / 100 * 0.0235)       # about a four year life
        ebit = revenue - cogs - opex - depreciation
        interest = cents(debt / 100 * LOAN_RATE / 12)
        pretax = ebit - interest
        tax = int(round(max(0, pretax) * TAX_RATE))
        net_income = pretax - tax

        # Working capital. Both are days of the thing they follow, which is the
        # assumption a forecast makes and the one level 4 asks about.
        ar = int(round(revenue * 38 / 30.4))
        ap = int(round((cogs + opex) * 32 / 30.4))
        cfo = net_income + depreciation - (ar - prev_ar) + (ap - prev_ap)
        cfi = -capex
        cff = -LOAN_PRINCIPAL_MONTHLY
        cash = cash + cfo + cfi + cff
        ppe = ppe + capex - depreciation
        debt = debt - LOAN_PRINCIPAL_MONTHLY
        retained = retained + net_income

        result = MonthResult(
            month=m, volume=cents(month_volume),
            merchants=sum(1 for c in roster if c.active(m, ignore_churn)),
            revenue_txn=revenue_txn, revenue_sub=revenue_sub, revenue_fx=revenue_fx,
            cogs_scheme=cogs_scheme, cogs_hosting=cogs_hosting,
            payroll=payroll, marketing=marketing, other_opex=other_opex,
            depreciation=depreciation, interest=interest, tax=tax,
            net_income=net_income, cash=cash, ar=ar, ppe=ppe, ap=ap, debt=debt,
            paid_in=paid_in, retained=retained,
        )

        # The check that makes this dataset worth teaching from.
        assert result.assets == result.liabilities_and_equity, (
            f"{m}: assets {result.assets} against {result.liabilities_and_equity}, "
            f"out by {result.assets - result.liabilities_and_equity} cents"
        )

        out.append(result)
        prev_ar, prev_ap = ar, ap
        volume *= (1 + a.volume_growth)
        hosting *= (1 + a.hosting_growth)

    return out


# ---------------------------------------------------------------------------
# The chart of accounts
# ---------------------------------------------------------------------------
# Cost centres, because an FP&A variance is always "whose line is this".
COST_CENTRES = {
    "engineering": ("CC100", "Engineering"),
    "sales": ("CC200", "Sales"),
    "marketing": ("CC300", "Marketing"),
    "support": ("CC400", "Customer support"),
    "g_and_a": ("CC500", "General and administrative"),
    "corporate": ("CC900", "Corporate"),
}

ACCOUNTS = {
    "4000": ("Transaction fees", "revenue"),
    "4100": ("Subscription fees", "revenue"),
    "4200": ("FX markup", "revenue"),
    "5000": ("Scheme and interchange costs", "cogs"),
    "5100": ("Cloud hosting", "cogs"),
    "6000": ("Salaries and wages", "opex"),
    "6100": ("Marketing programmes", "opex"),
    "6200": ("Facilities and administration", "opex"),
    "7000": ("Depreciation", "other"),
    "8000": ("Interest expense", "other"),
    "9000": ("Income tax", "other"),
}


def gl_rows(results, upto):
    """The general ledger export, signed the way a ledger signs it.

    **Revenue is negative and costs are positive**, because revenue is a credit
    and a credit is a negative number in every accounting export anybody will
    hand you. Summing this file without normalising the sign first produces a
    number that looks like a loss on a profitable month, and that is the first
    thing the analyst track teaches.
    """
    rows = []
    seq = 0

    def add(month, cc_key, code, amount_cents, note=""):
        nonlocal seq
        seq += 1
        code_str, cc_name = COST_CENTRES[cc_key]
        name, line_type = ACCOUNTS[code]
        rows.append({
            "journal_id": f"JE{seq:06d}",
            "month": month,
            "cost_centre": code_str,
            "cost_centre_name": cc_name,
            "account_code": code,
            "account_name": name,
            "line_type": line_type,
            "amount": dollars(amount_cents),
            "memo": note,
        })

    for r in results:
        if r.month > upto:
            break
        # Revenue, as credits.
        add(r.month, "corporate", "4000", -r.revenue_txn)
        add(r.month, "corporate", "4100", -r.revenue_sub)
        add(r.month, "corporate", "4200", -r.revenue_fx)

        # Cost of sales, as debits.
        add(r.month, "corporate", "5000", r.cogs_scheme,
            "includes scheme refund for Apr to Jul" if r.month == "2025-08" else "")

        hosting = r.cogs_hosting
        if r.month == "2025-07":
            # The misposting. Somebody coded the July cloud invoice to
            # facilities, and it was corrected the month after. Both months are
            # wrong on their own and the pair of them is right, which is why a
            # variance is investigated over two months rather than one.
            add(r.month, "corporate", "5100", hosting - 88_000_00)
            add(r.month, "g_and_a", "6200", 88_000_00, "cloud invoice, coded in error")
        elif r.month == "2025-08":
            add(r.month, "corporate", "5100", hosting + 88_000_00,
                "reclass of July cloud invoice")
            add(r.month, "g_and_a", "6200", -88_000_00, "reversal of July error")
        else:
            add(r.month, "corporate", "5100", hosting)

        # Payroll, by the cost centre that spends it.
        for dept, amount in r.payroll.items():
            add(r.month, dept, "6000", amount)

        add(r.month, "marketing", "6100", r.marketing)
        add(r.month, "g_and_a", "6200", r.other_opex)
        add(r.month, "corporate", "7000", r.depreciation)
        add(r.month, "corporate", "8000", r.interest)
        add(r.month, "corporate", "9000", r.tax)

    return rows


def write_actuals(results):
    rows = gl_rows(results, label(LAST_ACTUAL))
    planted = []

    # 1. A duplicated journal. Exports get re-run, and the second run lands in
    #    the same file more often than anybody admits.
    dup = next(r for r in rows if r["month"] == "2025-06" and r["account_code"] == "6000"
               and r["cost_centre"] == "CC100")
    rows.insert(rows.index(dup) + 1, dict(dup))
    planted.append(f"duplicate journal {dup['journal_id']}, {dup['amount']} in 2025-06")

    # 2. Two amounts written the way a spreadsheet writes them: a thousands
    #    comma on a cost, and brackets for the minus sign on a credit. Both read
    #    as text, and the column quietly becomes an object.
    comma = next(r for r in rows if r["month"] == "2025-03" and r["account_code"] == "6100")
    comma["amount"] = f"{float(comma['amount']):,.2f}"
    planted.append(f"comma separated amount in {comma['journal_id']}, {comma['amount']}")

    brackets = next(r for r in rows if r["month"] == "2025-04" and r["account_code"] == "4100")
    brackets["amount"] = f"({abs(float(brackets['amount'])):,.2f})"
    planted.append(f"bracketed credit in {brackets['journal_id']}, {brackets['amount']}")

    # 3. The same account name with a trailing space, which groups as a second
    #    account in every tool that groups by name rather than by code.
    spaced = next(r for r in rows if r["month"] == "2025-05" and r["account_code"] == "5100")
    spaced["account_name"] = spaced["account_name"] + " "
    planted.append(f"trailing space on an account name in {spaced['journal_id']}")

    path = OUT / "fpa-actuals.csv"
    with path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    return path, len(rows), planted


def write_budget(plan):
    """The FY2025 plan, in the shape a plan actually arrives in.

    Whole dollars, positive numbers for everything including revenue, one
    account the finance team calls something else, and a cost centre that was
    planned and never created. Every one of those is a join that silently drops
    rows if you join on the label instead of the code.
    """
    rows = []
    planted = []
    names = {"5100": "Hosting", "6200": "Facilities"}      # the plan's own words

    for r in plan:
        if not r.month.startswith("2025"):
            continue
        lines = [
            ("corporate", "4000", r.revenue_txn), ("corporate", "4100", r.revenue_sub),
            ("corporate", "4200", r.revenue_fx), ("corporate", "5000", r.cogs_scheme),
            ("corporate", "5100", r.cogs_hosting), ("marketing", "6100", r.marketing),
            ("g_and_a", "6200", r.other_opex), ("corporate", "7000", r.depreciation),
            ("corporate", "8000", r.interest), ("corporate", "9000", r.tax),
        ] + [(d, "6000", amount) for d, amount in r.payroll.items()]

        for cc_key, code, amount in lines:
            cc_code, cc_name = COST_CENTRES[cc_key]
            rows.append({
                "month": r.month,
                "cost_centre": cc_code,
                "cost_centre_name": cc_name,
                "account_code": code,
                "account_name": names.get(code, ACCOUNTS[code][0]),
                "budget_amount": f"{abs(amount) / 100:.0f}",
            })

        # The sixth cost centre: a new product team that was planned, budgeted
        # and never hired. It has a budget and it will never have an actual.
        rows.append({
            "month": r.month, "cost_centre": "CC600", "cost_centre_name": "New product",
            "account_code": "6000", "account_name": "Salaries and wages",
            "budget_amount": "96000",
        })

    planted.append("account 5100 is Hosting in the plan and Cloud hosting in the ledger")
    planted.append("account 6200 is Facilities in the plan")
    planted.append("cost centre CC600 exists only in the plan, 96,000 a month")

    path = OUT / "fpa-budget.csv"
    with path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    return path, len(rows), planted


# ---------------------------------------------------------------------------
# The merchants, and the invoices they are sent
# ---------------------------------------------------------------------------
# A platform fee by size, which is what gives the SQL level something worth
# grouping by. The volume weight is how much card volume a merchant of that
# size puts through, relative to the smallest.
SEGMENTS = {
    "enterprise": {"fee": 7_200.0, "weight": 8.0, "share": 0.15},
    "mid": {"fee": 3_600.0, "weight": 3.0, "share": 0.45},
    "small": {"fee": 1_800.0, "weight": 1.0, "share": 0.40},
}

COUNTRIES = ["US", "GB", "DE", "FR", "SG", "AU", "CA", "NL", "IE", "VN"]
CURRENCY = {"US": "USD", "GB": "GBP", "DE": "EUR", "FR": "EUR", "SG": "SGD",
            "AU": "AUD", "CA": "CAD", "NL": "EUR", "IE": "EUR", "VN": "VND"}

# No word here may appear on the banned list in .claude/skills/no-ai-slop: a
# merchant called Beacon Logistics is a perfectly good name and it lights up the
# repository's own prose scanner every time a level quotes it.
FIRST_WORDS = ["Harbour", "Lantern", "Copper", "Northgate", "Riverbend", "Quill",
               "Maple", "Orchard", "Pennant", "Foundry", "Kestrel", "Sable",
               "Verdant", "Anchor", "Thistle", "Granite", "Willow", "Fathom",
               "Cinder", "Meridian", "Alder", "Brook", "Cobalt", "Dune"]
LAST_WORDS = ["Retail", "Logistics", "Markets", "Grocers", "Outfitters", "Travel",
              "Health", "Studios", "Supply", "Foods", "Mobility", "Rentals",
              "Tickets", "Delivery", "Works", "Trading"]


@dataclass
class Customer:
    customer_id: str
    name: str
    country: str
    segment: str
    signed: str
    churned: str = ""
    size: float = 1.0          # this merchant against a typical one of its size

    @property
    def fee(self) -> float:
        return SEGMENTS[self.segment]["fee"]

    @property
    def weight(self) -> float:
        """Share of card volume. The size factor is what makes a top ten list
        worth producing: without it every merchant in a segment is a clone and
        `order by revenue desc` returns an arbitrary alphabetical answer."""
        return SEGMENTS[self.segment]["weight"] * self.size

    def active(self, month: str, ignore_churn: bool = False) -> bool:
        if month < self.signed:
            return False
        if self.churned and not ignore_churn and month >= self.churned:
            return False
        return True


def build_roster() -> list[Customer]:
    """140 merchants on day one, a few signing every month, a few leaving.

    The roster is built once and both the actual and the plan read it, because
    a plan is built from the same pipeline the business is selling into. The
    only difference is that the plan assumed nobody would leave, which is what
    plans assume, and that difference is a variance somebody has to explain.
    """
    rng = random.Random(SEED + 7)
    names_used: set[str] = set()
    roster: list[Customer] = []

    def new_name() -> str:
        while True:
            name = f"{rng.choice(FIRST_WORDS)} {rng.choice(LAST_WORDS)}"
            if name not in names_used:
                names_used.add(name)
                return name

    def segment_for(i: int) -> str:
        r = rng.random()
        if r < SEGMENTS["enterprise"]["share"]:
            return "enterprise"
        if r < SEGMENTS["enterprise"]["share"] + SEGMENTS["mid"]["share"]:
            return "mid"
        return "small"

    seq = 0
    for i in range(140):
        seq += 1
        roster.append(Customer(f"MER{seq:04d}", new_name(), rng.choice(COUNTRIES),
                               segment_for(i), signed="2023-11",
                               size=round(rng.lognormvariate(0, 0.55), 3)))

    # Signings run one month past the last closed month, because the customer
    # list is current and the billing is a month behind. Those merchants have a
    # contract and no invoice yet, which is the row an inner join throws away
    # without saying so.
    for ym in months(FIRST_MONTH, LAST_MONTH):
        m = label(ym)
        if ym > (LAST_ACTUAL[0], LAST_ACTUAL[1] + 1):
            break
        for _ in range(rng.choice([3, 4, 4, 5])):
            seq += 1
            roster.append(Customer(f"MER{seq:04d}", new_name(), rng.choice(COUNTRIES),
                                   segment_for(seq), signed=m,
                                   size=round(rng.lognormvariate(0, 0.55), 3)))

    # Churn starts once the book is big enough to lose anybody: one a month,
    # never an enterprise account, because those leave with notice and a project.
    #
    # A leaver has to have arrived first, and to have been a customer for at
    # least three months. The first version of this picked from a shuffled list
    # without checking, and produced seven merchants who churned before they
    # signed: a fact with no invoices behind it, and exactly the kind of thing
    # that makes somebody stop trusting a dataset.
    candidates = [c for c in roster if c.segment != "enterprise"]
    rng.shuffle(candidates)
    for ym in months((2024, 6), LAST_ACTUAL):
        m = label(ym)
        for c in candidates:
            if c.churned or c.signed >= m:
                continue
            if len(months((int(c.signed[:4]), int(c.signed[5:])), ym)) < 4:
                continue                      # at least three months as a customer
            c.churned = m
            break

    return roster


def subscription_cents(roster: list[Customer], month: str, ignore_churn: bool) -> int:
    return cents(sum(c.fee for c in roster if c.active(month, ignore_churn)))


def allocate(total: int, weights: list[float]) -> list[int]:
    """Split an integer amount by weight, losing nothing.

    Largest remainder: floor every share, then hand the leftover cents out one
    at a time to whoever was rounded down hardest. The same rule as the money
    type in the engineering track, for the same reason: the parts have to add
    back up to the whole or the invoice detail will not tie to the ledger.
    """
    if not weights or total == 0:
        return [0] * len(weights)
    pool = sum(weights)
    exact = [total * w / pool for w in weights]
    out = [int(x) for x in exact]
    left = total - sum(out)
    order = sorted(range(len(weights)), key=lambda i: exact[i] - out[i], reverse=True)
    for i in range(left):
        out[order[i % len(order)]] += 1
    return out


def write_customers(roster: list[Customer]) -> tuple[Path, int]:
    path = OUT / "fpa-customers.csv"
    with path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["customer_id", "name", "country", "currency", "segment",
                    "signed_month", "churned_month"])
        for c in roster:
            w.writerow([c.customer_id, c.name, c.country, CURRENCY[c.country],
                        c.segment, c.signed, c.churned])
    return path, len(roster)


def write_invoices(results: list[MonthResult], roster: list[Customer]
                   ) -> tuple[Path, int, list[str]]:
    """One invoice per active merchant per month, and they tie to the ledger.

    The transaction fee and FX lines are the ledger's own totals split across
    merchants by volume weight, so `sum(invoice lines) == the revenue in the
    general ledger` for every month, to the cent. That equality is the first
    thing the SQL level asks a learner to prove, because a revenue report that
    does not tie to the ledger is a report nobody can sign.
    """
    rng = random.Random(SEED + 11)
    rows: list[dict] = []
    planted: list[str] = []
    seq = 0

    for r in results:
        if r.month > label(LAST_ACTUAL):
            break
        active = [c for c in roster if c.active(r.month)]
        weights = [c.weight for c in active]
        txn = allocate(r.revenue_txn, weights)
        fx = allocate(r.revenue_fx, weights)

        year, month = int(r.month[:4]), int(r.month[5:])
        # Billed in arrears: September's usage is invoiced on 1 October and due
        # thirty days later. The revenue month and the invoice date are
        # therefore different, which is why grouping revenue by issued_date is
        # the first mistake this dataset is built to catch.
        issued_on = date(year + (month == 12), (month % 12) + 1, 1)
        issued = issued_on.isoformat()
        due = (issued_on + timedelta(days=30)).isoformat()

        for c, txn_c, fx_c in zip(active, txn, fx):
            seq += 1
            amount = cents(c.fee) + txn_c + fx_c
            # Most invoices are paid, a few are late, a few are still open, and
            # the most recent month is mostly unpaid because it was just issued.
            roll = rng.random()
            if r.month == label(LAST_ACTUAL):
                # Invoiced on the first of this month, thirty days to pay: open
                # and not yet late, which is what the newest month always looks
                # like at a close.
                status, paid = ("open", "")
            elif roll < 0.78:
                status = "paid"
                paid = (issued_on + timedelta(days=rng.randint(3, 29))).isoformat()
            elif roll < 0.94:
                status = "paid"
                paid = (issued_on + timedelta(days=rng.randint(31, 74))).isoformat()
            else:
                status, paid = ("open", "")

            rows.append({
                "invoice_id": f"INV{seq:06d}",
                "customer_id": c.customer_id,
                "month": r.month,
                "issued_date": issued,
                "due_date": due,
                "paid_date": paid,
                "status": status,
                "platform_fee": dollars(cents(c.fee)),
                "transaction_fee": dollars(txn_c),
                "fx_fee": dollars(fx_c),
                "amount": dollars(amount),
            })

    # A credit note: a merchant was overbilled in May and it was put right in
    # June. It is a negative invoice, and any report that filters on
    # `amount > 0` will quietly overstate revenue by exactly this much.
    credited = next(r for r in rows if r["month"] == "2025-06")
    seq += 1
    rows.append({
        "invoice_id": f"INV{seq:06d}", "customer_id": credited["customer_id"],
        "month": "2025-06", "issued_date": "2025-06-14", "due_date": "2025-07-01",
        "paid_date": "2025-06-14", "status": "credited",
        "platform_fee": "0.00", "transaction_fee": "-4820.00", "fx_fee": "0.00",
        "amount": "-4820.00",
    })
    planted.append("a credit note of -4,820.00 in 2025-06, which breaks the tie to the ledger by design")

    # An invoice paid before it was issued: somebody keyed the year wrong.
    bad_date = next(r for r in rows if r["month"] == "2025-04" and r["status"] == "paid")
    bad_date["paid_date"] = "2024-05-19"
    planted.append(f"{bad_date['invoice_id']} is marked paid before it was issued")

    path = OUT / "fpa-invoices.csv"
    with path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    return path, len(rows), planted


def write_headcount(results: list[MonthResult], a: Assumptions) -> tuple[Path, int]:
    path = OUT / "fpa-headcount.csv"
    with path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["month", "cost_centre", "department", "heads", "payroll_cost"])
        for r in results:
            if r.month > label(LAST_ACTUAL):
                break
            for dept in DEPARTMENTS:
                w.writerow([r.month, COST_CENTRES[dept][0], dept,
                            headcount(a.hiring[dept], r.month), dollars(r.payroll[dept])])
    return path, sum(1 for r in results if r.month <= label(LAST_ACTUAL)) * len(DEPARTMENTS)


def write_history(results: list[MonthResult]) -> tuple[Path, int]:
    """The three statements, one row a month, already tied.

    This is the file the model level starts from. It is deliberately clean:
    the mess lives in the ledger export, and a forecast is hard enough without
    it.
    """
    path = OUT / "fpa-history.csv"
    fields = ["month", "payment_volume", "revenue_transaction", "revenue_subscription",
              "revenue_fx", "revenue_total", "cogs_scheme", "cogs_hosting", "cogs_total",
              "gross_profit", "payroll", "marketing", "other_opex", "opex_total",
              "ebitda", "depreciation", "ebit", "interest", "tax", "net_income",
              "cash", "accounts_receivable", "ppe_net", "accounts_payable",
              "debt", "paid_in_capital", "retained_earnings"]
    with path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(fields)
        for r in results:
            if r.month > label(LAST_ACTUAL):
                break
            w.writerow([
                r.month, dollars(r.volume), dollars(r.revenue_txn),
                dollars(r.revenue_sub), dollars(r.revenue_fx), dollars(r.revenue),
                dollars(r.cogs_scheme), dollars(r.cogs_hosting), dollars(r.cogs),
                dollars(r.gross_profit), dollars(sum(r.payroll.values())),
                dollars(r.marketing), dollars(r.other_opex), dollars(r.opex),
                dollars(r.ebitda), dollars(r.depreciation),
                dollars(r.ebitda - r.depreciation), dollars(r.interest), dollars(r.tax),
                dollars(r.net_income), dollars(r.cash), dollars(r.ar), dollars(r.ppe),
                dollars(r.ap), dollars(r.debt), dollars(r.paid_in), dollars(r.retained),
            ])
    return path, sum(1 for r in results if r.month <= label(LAST_ACTUAL))



def write_plan_drivers(plan: list[MonthResult], a: Assumptions) -> tuple[Path, int]:
    """What the plan assumed, underneath the dollars.

    A budget in dollars cannot be explained, only compared. To say *why* a
    revenue line missed you need the two numbers underneath it, and a plan that
    does not publish its drivers is a plan nobody can hold to account. This is
    the file that makes the price and volume split possible.
    """
    path = OUT / "fpa-plan-drivers.csv"
    fields = ["month", "payment_volume", "take_rate", "xborder_share", "fx_markup",
              "scheme_cost_rate", "merchants"] + [f"heads_{d}" for d in DEPARTMENTS]
    with path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(fields)
        rows = 0
        for r in plan:
            if not r.month.startswith("2025"):
                continue
            w.writerow([r.month, dollars(r.volume), f"{a.take_rate:.5f}",
                        f"{a.xborder_share:.2f}", f"{a.fx_markup:.5f}",
                        f"{a.scheme_cost_rate:.5f}", r.merchants]
                       + [headcount(a.hiring[d], r.month) for d in DEPARTMENTS])
            rows += 1
    return path, rows

def main() -> None:
    roster = build_roster()
    actual = simulate(actual_assumptions(), roster)
    plan = simulate(plan_assumptions(), roster, ignore_churn=True)

    print("Meridian Pay, a synthetic payments company")
    print(f"   {len(actual)} months simulated, assets equal liabilities plus equity "
          f"in every one of them, to the cent\n")

    path, n, planted = write_actuals(actual)
    print(f"{path.name}: {n} ledger rows to {label(LAST_ACTUAL)}")
    for note in planted:
        print(f"   planted: {note}")

    path, n, planted = write_budget(plan)
    print(f"{path.name}: {n} plan rows for FY2025")
    for note in planted:
        print(f"   planted: {note}")

    path, n = write_customers(roster)
    print(f"{path.name}: {n} merchants")

    path, n, planted = write_invoices(actual, roster)
    print(f"{path.name}: {n} invoices")
    for note in planted:
        print(f"   planted: {note}")

    path, n = write_headcount(actual, actual_assumptions())
    print(f"{path.name}: {n} rows")

    path, n = write_plan_drivers(plan, plan_assumptions())
    print(f"{path.name}: {n} months of plan drivers")

    path, n = write_history(actual)
    print(f"{path.name}: {n} months of tied statements")

    print("\ndone, every file is synthetic")


if __name__ == "__main__":
    main()
