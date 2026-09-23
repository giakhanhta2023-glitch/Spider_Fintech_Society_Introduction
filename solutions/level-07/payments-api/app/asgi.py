"""The production entry point: the real ledger, wired from the environment.

    DATABASE_URL=... uvicorn app.asgi:app
"""

from __future__ import annotations

import os

from .auth import ApiKey, KeyRing
from .main import create_app
from .postgres import PostgresIdempotencyStore, PostgresLedger


def _keys_from_environment() -> KeyRing:
    """Hashes only. The raw key exists once, when it is issued, and is never
    stored anywhere, including here."""
    raw = os.environ.get("API_KEYS_SHA256", "")
    keys: dict[str, ApiKey] = {}
    for item in filter(None, (part.strip() for part in raw.split(","))):
        key_hash, _, merchant = item.partition(":")
        keys[key_hash] = ApiKey(
            key_id=key_hash[:8],
            merchant_id=int(merchant or 0),
            scopes=frozenset({"transfers:write", "transfers:read", "accounts:read"}),
        )
    return KeyRing(keys)


def build():  # pragma: no cover - exercised by running the service
    conninfo = os.environ.get("DATABASE_URL")
    if not conninfo:
        raise SystemExit("DATABASE_URL is not set, and there is no default")
    return create_app(
        ledger=PostgresLedger(conninfo),
        keys=_keys_from_environment(),
        idempotency=PostgresIdempotencyStore(conninfo),
    )


app = build()  # pragma: no cover
