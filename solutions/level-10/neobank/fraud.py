"""
neobank.fraud: rule engine plus a logistic model (from Level 8).

The rules are data, so a reviewer can read the rulebook. Every score comes back
with the reasons that produced it, because a flag nobody can explain is a flag
nobody can defend.
"""

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (confusion_matrix, f1_score, precision_score,
                             recall_score, roc_auc_score)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

HOME_COUNTRY = "VN"
HIGH_RISK_CATEGORIES = ["travel", "electronics", "gaming"]
REVIEW_COST = 4.0

FEATURES = ["amount", "card_not_present", "is_foreign", "is_night",
            "txns_last_1h", "high_risk_cat", "hours_since_prev_txn"]

RULES = [
    ("large amount",       lambda r: r["amount"] > 150,          2),
    ("card not present",   lambda r: r["card_not_present"] == 1, 2),
    ("foreign country",    lambda r: r["is_foreign"] == 1,       3),
    ("overnight",          lambda r: r["is_night"] == 1,         2),
    ("high velocity",      lambda r: r["txns_last_1h"] >= 3,     2),
    ("high-risk category", lambda r: r["high_risk_cat"] == 1,    1),
]


def engineer(df):
    """Add the model features to a raw card-transaction frame."""
    df = df.copy()
    df["hour"] = df["timestamp"].dt.hour
    df["is_night"] = (df["hour"] < 6).astype(int)
    df["is_foreign"] = (df["country"] != HOME_COUNTRY).astype(int)
    df["card_not_present"] = (1 - df["card_present"]).astype(int)
    df["high_risk_cat"] = df["category"].isin(HIGH_RISK_CATEGORIES).astype(int)
    return df


def baseline(df):
    """The do-nothing benchmark every later number is judged against."""
    return {"rows": len(df),
            "fraud_cases": int(df["is_fraud"].sum()),
            "base_rate": float(df["is_fraud"].mean()),
            "do_nothing_accuracy": float((df["is_fraud"] == 0).mean()),
            "fraud_value": float(df.loc[df["is_fraud"] == 1, "amount"].sum())}


def score_row(row):
    """Return (score, reasons): the score always arrives with its explanation."""
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


def evaluate(y_true, y_pred):
    tn, fp, fn, tp = confusion_matrix(y_true, y_pred).ravel()   # this order, always
    precision = precision_score(y_true, y_pred, zero_division=0)
    recall = recall_score(y_true, y_pred, zero_division=0)
    f1 = f1_score(y_true, y_pred, zero_division=0)
    flagged = int(y_pred.sum())
    return {"flagged": flagged, "tp": int(tp), "fp": int(fp), "fn": int(fn), "tn": int(tn),
            "precision": precision, "recall": recall, "f1": f1}


def total_cost(df, threshold, review_cost=REVIEW_COST):
    """A missed fraud costs the transaction. A false alarm costs analyst time."""
    flagged = df["score"] >= threshold
    missed = df.loc[~flagged & (df["is_fraud"] == 1), "amount"].sum()
    reviews = int((flagged & (df["is_fraud"] == 0)).sum()) * review_cost
    return missed + reviews, missed, reviews


def train_model(df, test_size=0.3, seed=42):
    """Stratified split, scaler fitted on the training split only. That is the no-leakage rule."""
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
    return pd.DataFrame({
        "coefficient": coefs.round(3),
        "reading": [("a higher value raises the estimated fraud odds" if v > 0
                     else "a higher value lowers the estimated fraud odds") for v in coefs],
    })


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

def threshold_sweep(df, low=3, high=12):
    """One evaluation per threshold, as a DataFrame."""
    rows = []
    for t in range(low, high + 1):
        result = evaluate(df["is_fraud"], (df["score"] >= t).astype(int))
        rows.append({"threshold": t, **result})
    return pd.DataFrame(rows)


def cost_curve(df, review_cost=REVIEW_COST, low=3, high=12):
    """Total cost per threshold, plus the cheapest one."""
    rows = []
    for t in range(low, high + 1):
        total, missed, reviews = total_cost(df, t, review_cost)
        rows.append({"threshold": t, "missed_fraud": round(missed, 2),
                     "review_spend": round(reviews, 2), "total": round(total, 2)})
    table = pd.DataFrame(rows)
    best = table.loc[table["total"].idxmin()]
    return table, int(best["threshold"]), float(best["total"])
