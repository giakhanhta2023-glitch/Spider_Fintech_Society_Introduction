"""Feature flags read at request time, defaulting to off, with kill switches.

Deploying is not releasing. The code goes out dark and a configuration change
turns it on: for you, then one merchant, then one percent, then everybody.

Four properties, and each one is a mistake somebody has already made.

**Read at request time.** A flag read at start means turning it off needs a
restart, and you have given up the only advantage flags have over a deploy.

**Default to off, and fail to off.** If the flag store is unreachable, the new
path stays dark. Failing open means the flag service having a bad afternoon
enables an untested path for every customer at once.

**A kill switch on every risky path.** Turning something off is a configuration
change measured in seconds. A rollback is a deploy measured in minutes. During an
incident that difference is the incident.

**Flags expire.** Every flag is a branch and two paths to test. Each one carries
a removal date, and `expired()` lists the ones past it so the list is a report
rather than an intention. Sixty stale flags is a codebase nobody will touch.

The store here is a JSON file, which is the local stand in for LaunchDarkly,
Unleash, or a table in Postgres behind a five second cache. What matters for the
level is the shape: read at request time, default off, and a documented set of
switches somebody can reach for at three in the morning.
"""

from __future__ import annotations

import hashlib
import json
import time
from dataclasses import dataclass, field
from datetime import UTC, date, datetime
from pathlib import Path


@dataclass(frozen=True, slots=True)
class Flag:
    name: str
    description: str
    # None means off for everybody. 0.01 means one percent, by a stable hash.
    rollout: float | None = None
    merchants: tuple[str, ...] = ()
    expires: str = ""                      # ISO date. Not optional in review.
    kill_switch: bool = False

    def enabled_for(self, key: str | None) -> bool:
        if self.merchants and key in self.merchants:
            return True
        if self.rollout is None:
            return False
        if self.rollout >= 1.0:
            return True
        if key is None:
            return False
        # Stable on the key, so one merchant does not flicker between paths
        # from request to request. A random draw per request means a customer
        # sees the new checkout on one page and the old one on the next.
        digest = hashlib.blake2b(f"{self.name}:{key}".encode(), digest_size=8).digest()
        return (int.from_bytes(digest, "big") % 10_000) < self.rollout * 10_000


@dataclass
class Flags:
    """The store. Reloaded when the file changes, and never cached forever."""

    path: Path
    cache_seconds: float = 5.0
    _flags: dict[str, Flag] = field(default_factory=dict)
    _loaded_at: float = 0.0
    _mtime: float = 0.0
    reads: int = 0
    reloads: int = 0

    def _maybe_reload(self) -> None:
        now = time.monotonic()
        if self._flags and now - self._loaded_at < self.cache_seconds:
            return
        try:
            mtime = self.path.stat().st_mtime
            if mtime != self._mtime or not self._flags:
                raw = json.loads(self.path.read_text(encoding="utf-8"))
                self._flags = {
                    name: Flag(name=name, **body) for name, body in raw["flags"].items()
                }
                self._mtime = mtime
                self.reloads += 1
        except (OSError, ValueError, TypeError):
            # Unreachable or unparseable store. Keep whatever was last known
            # good, and if nothing was ever loaded, everything is off. Failing
            # to off is the whole design.
            pass
        self._loaded_at = now

    def enabled(self, name: str, key: str | None = None) -> bool:
        """The only way this codebase asks about a flag."""
        self.reads += 1
        self._maybe_reload()
        flag = self._flags.get(name)
        if flag is None:
            return False                   # an unknown flag is an off flag
        return flag.enabled_for(key)

    def kill_switches(self) -> list[Flag]:
        self._maybe_reload()
        return [f for f in self._flags.values() if f.kill_switch]

    def expired(self, today: date | None = None) -> list[Flag]:
        """Flags past their removal date. A report, run in the gate.

        This is the only mechanism that has ever worked against flag rot: make
        the list visible on every build and let it be embarrassing.
        """
        # datetime.now(UTC).date() rather than date.today(), which reads the
        # machine's timezone. A flag expiring 'today' in two places on two
        # continents is a small bug with an annoying reproduction.
        today = today or datetime.now(UTC).date()
        self._maybe_reload()
        out = []
        for flag in self._flags.values():
            if not flag.expires:
                out.append(flag)           # no date at all is worse than a late one
            elif date.fromisoformat(flag.expires) < today:
                out.append(flag)
        return out


def payouts_enabled(flags: Flags) -> bool:
    """The switch somebody reaches for during an incident.

    Written as a named function rather than a string at the call site, so the
    runbook can say "set payouts_enabled to false" and mean one specific thing,
    and so the grep for it finds every caller.

    Note the inversion: the flag is named for the safe state. `payouts_enabled`
    missing from the store means payouts are off, which is the correct failure
    for a path that moves money.
    """
    return flags.enabled("payouts_enabled")
