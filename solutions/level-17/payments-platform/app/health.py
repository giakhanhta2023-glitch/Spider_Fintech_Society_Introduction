"""Liveness and readiness, which are different questions with different answers.

Getting these the wrong way round is one of the two or three most common
production mistakes in a containerised service, and it fails in a way that looks
like an infrastructure problem.

**Liveness: is this process broken beyond recovery?** A failing liveness check
gets the container killed and restarted. So it must not check the database,
because a database blip would then restart every instance at once, which turns a
thirty second dependency problem into a full outage with cold caches.

**Readiness: should this instance receive traffic right now?** A failing
readiness check removes the instance from the load balancer and leaves it
running. This one does check the dependencies, because an instance that cannot
reach the database has nothing useful to do with a request.

    liveness  fails -> restart me
    readiness fails -> stop sending me work, I am still here

A readiness check that always returns 200 is the same as having none, and it is
what a deploy uses to decide that a broken version is healthy.
"""

from __future__ import annotations

import time
from collections.abc import Callable
from dataclasses import dataclass, field

Probe = Callable[[], bool]


@dataclass
class Health:
    """The two probes, and the dependency checks readiness runs.

    Checks are functions rather than values so the probe result is current. A
    boolean captured at start is a lie by the second request.
    """

    checks: dict[str, Probe] = field(default_factory=dict)
    started: float = field(default_factory=time.monotonic)
    # Set false by the shutdown handler, on SIGTERM, before the process stops
    # accepting work. Readiness then fails while in flight requests finish, so
    # the load balancer stops sending new ones and nobody sees a reset
    # connection. Skipping this is why deploys drop requests.
    accepting: bool = True
    ready_since: float | None = None

    def add(self, name: str, probe: Probe) -> None:
        self.checks[name] = probe

    # ------------------------------------------------------------ liveness
    def live(self) -> tuple[bool, dict]:
        """Is the process itself functional. No dependencies, on purpose."""
        return True, {"status": "live", "uptime_seconds": round(self.uptime, 1)}

    # ----------------------------------------------------------- readiness
    def ready(self) -> tuple[bool, dict]:
        results: dict[str, str] = {}
        healthy = self.accepting

        for name, probe in self.checks.items():
            try:
                ok = bool(probe())
            except Exception:
                # A dependency check that raises is a failed check, not a failed
                # request. A readiness endpoint that can return 500 is one that
                # reports "unknown" as "fine" on the next deploy.
                ok = False
            results[name] = "ok" if ok else "failing"
            healthy = healthy and ok

        if healthy and self.ready_since is None:
            self.ready_since = time.monotonic()
        if not healthy:
            self.ready_since = None

        return healthy, {
            "status": "ready" if healthy else "not ready",
            "accepting": self.accepting,
            "checks": results,
        }

    def begin_shutdown(self) -> None:
        """Called on SIGTERM. Readiness starts failing immediately; the process
        keeps serving what it already accepted."""
        self.accepting = False

    @property
    def uptime(self) -> float:
        return time.monotonic() - self.started
