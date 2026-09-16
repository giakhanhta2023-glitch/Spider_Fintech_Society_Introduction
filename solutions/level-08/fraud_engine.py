"""
FinQuest Level 8 — Fraud Scoring Engine  (reference solution)
=============================================================
A transparent rule engine, a logistic-regression model, and — the part that
actually decides what ships — a threshold tuned against money rather than F1.

Run:  python fraud_engine.py
"""

from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (confusion_matrix, f1_score, precision_score,
                             recall_score, roc_auc_score)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

URL = ("https://raw.githubusercontent.com/giakhanhta2023-glitch/"
       "Spider_Fintech_Society_Introduction/main/data/level-08-transactions.csv")
LOCAL = Path(__file__).resolve().parents[2] / "data" / "level-08-transactions.csv"

HOME_COUNTRY = "VN"
HIGH_RISK_CATEGORIES = ["travel", "electronics", "gaming"]
REVIEW_COST = 4.0          # an analyst's time per flagged transaction

FEATURES = ["amount", "card_not_present", "is_foreign", "is_night",
            "txns_last_1h", "high_risk_cat", "hours_since_prev_txn"]

# Rules as data: adding one is a single line, and the list prints as a rulebook.
RULES = [
    ("large amount",       lambda r: r["amount"] > 150,          2),
    ("card not present",   lambda r: r["card_not_present"] == 1, 2),
    ("foreign country",    lambda r: r["is_foreign"] == 1,       3),
    ("overnight",          lambda r: r["is_night"] == 1,         2),
    ("high velocity",      lambda r: r["txns_last_1h"] >= 3,     2),
    ("high-risk category", lambda r: r["high_risk_cat"] == 1,    1),
]


# ---------------------------------------------------------------------------
def load_and_engineer(url=URL):
    try:
        df = pd.read_csv(url, parse_dates=["timestamp"])
    except Exception:
        print(f"(network unavailable — reading {LOCAL.name} from the repo)")
        df = pd.read_csv(LOCAL, parse_dates=["timestamp"])

    df["hour"] = df["timestamp"].dt.hour
    df["is_night"] = (df["hour"] < 6).astype(int)
    df["is_foreign"] = (df["country"] != HOME_COUNTRY).astype(int)
    df["card_not_present"] = (1 - df["card_present"]).astype(int)
    df["high_risk_cat"] = df["category"].isin(HIGH_RISK_CATEGORIES).astype(int)
    return df


def baseline(df):
    """Print this BEFORE any model. Everything later is measured against it."""
    base_rate = df["is_fraud"].mean()
    do_nothing = (df["is_fraud"] == 0).mean()
    print(f"{'rows':<34}{len(df):>12,}")
    print(f"{'fraud cases':<34}{int(df['is_fraud'].sum()):>12,}")
    print(f"{'base rate':<34}{base_rate:>12.2%}")
    print(f"{'accuracy of flagging nothing':<34}{do_nothing:>12.2%}   <- the number to beat")
    print(f"{'total value of the fraud':<34}{df.loc[df['is_fraud'] == 1, 'amount'].sum():>12,.2f}")
    return {"base_rate": base_rate, "do_nothing_accuracy": do_nothing}


def feature_comparison(df):
    rows = []
    for col in ["amount", "card_present", "is_foreign", "is_night", "txns_last_1h",
                "high_risk_cat", "hours_since_prev_txn"]:
        grouped = df.groupby("is_fraud")[col].mean()
        rows.append({"feature": col, "legitimate": grouped[0], "fraud": grouped[1],
                     "ratio": grouped[1] / grouped[0] if grouped[0] else float("inf")})
    return pd.DataFrame(rows).set_index("feature")


# ---------------------------------------------------------------------------
def score_row(row):
    """Return (score, reasons) — the score always arrives with its explanation."""
    score, reasons = 0, []
    for name, test, points in RULES:
        if test(row):
            score += points
            reasons.append(name)
    return score, reasons


def apply_rules(df):
    scored = df.apply(score_row, axis=1)
    df = df.copy()
    df["score"] = [s for s, _ in scored]
    df["reasons"] = [", ".join(r) for _, r in scored]
    return df


def evaluate(y_true, y_pred, label=""):
    tn, fp, fn, tp = confusion_matrix(y_true, y_pred).ravel()   # this order, always
    precision = precision_score(y_true, y_pred, zero_division=0)
    recall = recall_score(y_true, y_pred, zero_division=0)
    f1 = f1_score(y_true, y_pred, zero_division=0)
    if label:
        print(f"{label:<16}{int(y_pred.sum()):>9,}{tp:>7}{fp:>8,}{fn:>7}"
              f"{precision:>11.1%}{recall:>10.1%}{f1:>9.3f}")
    return {"tp": tp, "fp": fp, "fn": fn, "tn": tn,
            "precision": precision, "recall": recall, "f1": f1}


def threshold_sweep(df, low=3, high=12):
    print(f"{'threshold':<16}{'flagged':>9}{'TP':>7}{'FP':>8}{'FN':>7}{'precision':>11}{'recall':>10}{'F1':>9}")
    print("-" * 77)
    out = {}
    for t in range(low, high + 1):
        out[t] = evaluate(df["is_fraud"], (df["score"] >= t).astype(int), f"score >= {t}")
    return out


# ---------------------------------------------------------------------------
def total_cost(df, threshold, review_cost=REVIEW_COST):
    """A missed fraud costs the transaction. A false alarm costs analyst time."""
    flagged = df["score"] >= threshold
    missed = df.loc[~flagged & (df["is_fraud"] == 1), "amount"].sum()
    reviews = int((flagged & (df["is_fraud"] == 0)).sum()) * review_cost
    return missed + reviews, missed, reviews


def cost_curve(df, review_cost=REVIEW_COST, low=3, high=12):
    print(f"{'threshold':<12}{'missed fraud':>16}{'review spend':>16}{'total':>14}")
    print("-" * 58)
    best = None
    for t in range(low, high + 1):
        total, missed, reviews = total_cost(df, t, review_cost)
        marker = ""
        if best is None or total < best[1]:
            best = (t, total)
            marker = ""
        print(f"{t:<12}{missed:>16,.0f}{reviews:>16,.0f}{total:>14,.0f}{marker}")
    print(f"\ncheapest threshold at a {review_cost:,.0f} review cost: {best[0]} (${best[1]:,.0f})")
    return best


# ---------------------------------------------------------------------------
def train_model(df, test_size=0.3, seed=42):
    """Stratified split, scaler fitted on TRAIN only. That is the no-leakage rule."""
    X = df[FEATURES]
    y = df["is_fraud"]
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=seed, stratify=y)

    scaler = StandardScaler().fit(X_train)
    model = LogisticRegression(max_iter=2000, class_weight="balanced")
    model.fit(scaler.transform(X_train), y_train)

    probabilities = model.predict_proba(scaler.transform(X_test))[:, 1]
    return {"model": model, "scaler": scaler, "X_test": X_test, "y_test": y_test,
            "probabilities": probabilities, "auc": roc_auc_score(y_test, probabilities)}


def explain_coefficients(model, features=FEATURES):
    """Standardised, so the magnitudes are comparable and can be read aloud."""
    coefs = pd.Series(model.coef_[0], index=features).sort_values(key=abs, ascending=False)
    for name, value in coefs.items():
        direction = "raises" if value > 0 else "lowers"
        print(f"  {name:<24}{value:>+8.2f}   a higher value {direction} the estimated fraud odds")
    return coefs


def review_queue(df, probabilities, index, top=20, base=0.9):
    cases = df.loc[index].copy()
    cases["probability"] = probabilities
    queue = cases[cases["probability"] >= base].sort_values("probability", ascending=False)
    return queue.head(top)[["txn_id", "amount", "country", "category",
                            "probability", "reasons", "is_fraud"]]


def fairness_check(df, threshold):
    """Flag rate by country. A large gap is a design question, not a footnote."""
    flagged = df["score"] >= threshold
    out = (pd.DataFrame({"flag_rate": flagged.groupby(df["country"]).mean(),
                         "transactions": df.groupby("country").size(),
                         "actual_fraud_rate": df.groupby("country")["is_fraud"].mean()})
           .sort_values("flag_rate", ascending=False))
    return out


# ---------------------------------------------------------------------------
def report():
    width = 77
    df = load_and_engineer()

    print("=" * width)
    print(f"{'FRAUD SCORING ENGINE':^{width}}")
    print("=" * width)
    print("\nBASELINE (before any modelling)")
    baseline(df)

    print("\n" + "-" * width)
    print("FEATURE SEPARATION — legitimate vs fraud")
    print(feature_comparison(df).round(2).to_string())

    df = apply_rules(df)

    print("\n" + "-" * width)
    print("RULE ENGINE — precision and recall trade against each other")
    sweep = threshold_sweep(df)
    best_f1 = max(sweep, key=lambda t: sweep[t]["f1"])
    print(f"\nF1-optimal threshold: {best_f1} (F1 {sweep[best_f1]['f1']:.3f})")

    print("\n" + "-" * width)
    print(f"COST MODEL — missed fraud costs the amount, a review costs ${REVIEW_COST:,.0f}")
    cheap = cost_curve(df)
    print("\nSensitivity: if an analyst review costs $20 instead of $4")
    cheap20 = cost_curve(df, review_cost=20.0)
    print(f"\nThe F1-optimal threshold is {best_f1}; the cost-optimal one is {cheap[0]} at $4 "
          f"and {cheap20[0]} at $20.")
    print("F1 treats both errors as equally bad. Your business does not, which is why the")
    print("assumptions above ARE the model — state them whenever you quote a threshold.")

    print("\n" + "-" * width)
    print("LOGISTIC REGRESSION")
    fit = train_model(df)
    print(f"test AUC: {fit['auc']:.3f}")
    print("This is unrealistically high because the data is synthetic and cleanly separable.")
    print("Real card-fraud models live around 0.85-0.95 against an adversary who adapts.\n")
    explain_coefficients(fit["model"])

    print("\n" + "-" * width)
    print("RULES vs MODEL, compared at matched recall")
    rule_at_6 = evaluate(df["is_fraud"], (df["score"] >= 6).astype(int))
    target_recall = rule_at_6["recall"]
    probs = fit["probabilities"]
    cutoff = np.quantile(probs, 1 - (probs >= 0.5).mean())      # start near the middle
    for candidate in np.linspace(0.99, 0.01, 99):
        pred = (probs >= candidate).astype(int)
        if recall_score(fit["y_test"], pred) >= target_recall:
            cutoff = candidate
            break
    model_match = evaluate(fit["y_test"], (probs >= cutoff).astype(int))
    print(f"{'rules @ score 6':<22}precision {rule_at_6['precision']:>6.1%}   recall {rule_at_6['recall']:>6.1%}")
    print(f"{'model @ p>=' + format(cutoff, '.2f'):<22}precision {model_match['precision']:>6.1%}   "
          f"recall {model_match['recall']:>6.1%}")
    print("\nRecommendation: ship both. The rules are explainable and legally defensible, and")
    print("they run on day one. The model ranks what the rules leave ambiguous, and a human")
    print("works the queue. A score routes a case; it should not silently decide it.")

    print("\n" + "-" * width)
    print("REVIEW QUEUE — top cases, with the money at stake and the reasons")
    queue = review_queue(df, fit["probabilities"], fit["X_test"].index, top=10)
    print(queue.to_string(index=False))

    print("\n" + "-" * width)
    print(f"FAIRNESS CHECK — flag rate by country at threshold {cheap[0]}")
    print(fairness_check(df, cheap[0]).round(3).to_string())
    print("\nThe foreign flag rate is far higher than the home rate. Here that tracks a real")
    print("difference in fraud rate, but country can proxy for nationality — so this belongs")
    print("in a model card, needs a human review path, and would need a disparate-impact test")
    print("before it went anywhere near production.")

    print("\n" + "=" * width)
    print(f"RECOMMENDED: rules at threshold {cheap[0]}, model-ranked queue above p>=0.9.")
    weekly = cheap[1] / (len(df) / 6000) / 8.6     # the sample spans ~8.6 weeks
    print(f"Expected cost about ${weekly:,.0f} a week at a $4 review cost, assuming the mix")
    print("of fraud stays as it is in this sample — which is exactly what an adversary changes.")
    print("=" * width)


# ---------------------------------------------------------------------------
def tests():
    df = load_and_engineer()
    assert df.shape[0] == 6000
    assert int(df["is_fraud"].sum()) == 108
    assert abs(df["is_fraud"].mean() - 0.018) < 0.0005

    comparison = feature_comparison(df)
    assert abs(comparison.loc["amount", "legitimate"] - 31.85) < 0.05
    assert abs(comparison.loc["amount", "fraud"] - 167.25) < 0.05
    assert abs(comparison.loc["card_present", "legitimate"] - 0.611) < 0.005
    assert abs(comparison.loc["card_present", "fraud"] - 0.037) < 0.005

    scored = apply_rules(df)
    assert scored["score"].between(0, 12).all()

    at6 = evaluate(scored["is_fraud"], (scored["score"] >= 6).astype(int))
    assert (at6["tp"], at6["fp"]) == (88, 72)
    assert abs(at6["precision"] - 0.550) < 0.005
    assert abs(at6["recall"] - 0.815) < 0.005

    at7 = evaluate(scored["is_fraud"], (scored["score"] >= 7).astype(int))
    assert (at7["tp"], at7["fp"]) == (77, 14)
    assert abs(at7["precision"] - 0.846) < 0.005
    assert abs(at7["recall"] - 0.713) < 0.005

    at9 = evaluate(scored["is_fraud"], (scored["score"] >= 9).astype(int))
    assert at9["precision"] == 1.0
    assert abs(at9["recall"] - 0.287) < 0.005

    total4, _, _ = total_cost(scored, 4)
    assert abs(total4 - 2068) < 5
    cheapest, cost = None, None
    for t in range(3, 13):
        total, _, _ = total_cost(scored, t)
        if cost is None or total < cost:
            cheapest, cost = t, total
    assert cheapest == 4, f"cheapest threshold should be 4, got {cheapest}"

    fit = train_model(scored)
    assert fit["auc"] > 0.98
    assert len(fit["y_test"]) == 1800

    flagged = review_queue(scored, fit["probabilities"], fit["X_test"].index)
    assert (flagged["reasons"].str.len() > 0).all(), "every flagged case must carry its reasons"

    print("all self-checks passed\n")


if __name__ == "__main__":
    tests()
    report()
