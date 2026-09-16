"""
NeoBank Analytics: the FinQuest capstone package.

Layering, strictly one-directional:

    app.py        interface only: inputs and display, no business logic
    neobank/*     services: ledger, analytics, lending, risk, fraud, fx
    loaders.py    the only module that touches a file or a network

Nothing in this package imports Streamlit, and nothing outside loaders.py
reads a file. Those two rules are what make the middle testable.
"""

__version__ = "1.0.0"

__all__ = ["analytics", "fraud", "fx", "ledger", "lending", "loaders", "reconcile", "risk"]
