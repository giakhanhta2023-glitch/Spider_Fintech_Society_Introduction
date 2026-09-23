"""Bearer API keys, stored as hashes, checked before any database work.

Two decisions, both from level 15 arriving early:

  Only the hash is stored. A leaked key table is then a leaked list of hashes,
  which is useless, rather than a leaked list of working credentials.

  The comparison is constant time. The measurement in level 15 could not find
  the timing leak at this length, and compare_digest costs 60 nanoseconds more,
  so it is used because it is free rather than because the attack was observed.
"""

from __future__ import annotations

import hashlib
import hmac
from dataclasses import dataclass

from .errors import ApiError


@dataclass(frozen=True, slots=True)
class ApiKey:
    """A caller. The scopes are here so level 15 has somewhere to land."""

    key_id: str
    merchant_id: int
    scopes: frozenset[str]


def fingerprint(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()


class KeyRing:
    """The keys this service accepts, by hash. Never by value."""

    def __init__(self, keys: dict[str, ApiKey]) -> None:
        self._by_hash = keys

    @classmethod
    def from_raw(cls, raw: dict[str, ApiKey]) -> KeyRing:
        """For tests and local development only. In production the hashes come
        from the database and the raw key exists once, at the moment it is
        issued, and is never stored."""
        return cls({fingerprint(k): v for k, v in raw.items()})

    def authenticate(self, header: str | None) -> ApiKey:
        if not header or not header.startswith("Bearer "):
            raise ApiError("unauthorized")

        offered = fingerprint(header.removeprefix("Bearer ").strip())

        # Walk every key rather than a dictionary lookup, so the work does not
        # depend on whether a prefix matched.
        found: ApiKey | None = None
        for known_hash, key in self._by_hash.items():
            if hmac.compare_digest(known_hash, offered):
                found = key
        if found is None:
            raise ApiError("unauthorized")
        return found

    def require(self, key: ApiKey, scope: str) -> None:
        """A valid key proves who. It never proves what they may do."""
        if scope not in key.scopes:
            raise ApiError("forbidden", f"this key does not have the {scope} scope")
