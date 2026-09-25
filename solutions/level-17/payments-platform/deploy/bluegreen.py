"""Blue green, with the readiness gate and the rollback that gets timed.

Two versions run at once. One receives traffic; the other is idle and identical
in every respect except that nobody is using it. A deploy is: start the new
version on the idle side, wait for it to be ready, switch the router, keep the
old side running. A rollback is the router switching back.

The reason to choose blue green is the rollback column rather than the deploy
column:

    rolling deploy      replace instances one at a time. Rollback is another
                        rolling deploy, in reverse, at the same speed
    blue green          both versions running. Rollback is a pointer moving,
                        and the measured number is in the README

The gate is `wait_until_ready`. Without it, "deployed" means "the process
started", and a version whose database credentials are wrong is serving 500s to
customers while the pipeline shows green. With it, a broken version fails to
become ready, the switch never happens, and the number worth asserting is that
the broken side served zero requests.

This runs locally with no container runtime, which is the point: a deploy
rehearsal that needs infrastructure never gets rehearsed. The mechanics are the
same ones a load balancer target group implements, minus the AWS invoice.
"""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field

from app.service import Instance, Version, serve


class DeployRefused(Exception):  # noqa: N818
    """The new version never became ready, so the switch did not happen.

    Named for what happened rather than with an `Error` suffix, because it is
    read in a runbook: "DeployRefused: green never became ready" is a sentence an
    on call engineer can act on.
    """


def _get(port: int, path: str, timeout: float = 2.0) -> tuple[int, dict]:
    url = f"http://127.0.0.1:{port}{path}"
    try:
        with urllib.request.urlopen(url, timeout=timeout) as response:
            return response.status, json.loads(response.read() or b"{}")
    except urllib.error.HTTPError as exc:
        return exc.code, json.loads(exc.read() or b"{}")
    except (urllib.error.URLError, TimeoutError, ConnectionError):
        return 0, {}


def _post(port: int, path: str, body: dict, timeout: float = 2.0) -> tuple[int, dict]:
    request = urllib.request.Request(
        f"http://127.0.0.1:{port}{path}",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.status, json.loads(response.read() or b"{}")
    except urllib.error.HTTPError as exc:
        return exc.code, json.loads(exc.read() or b"{}")
    except (urllib.error.URLError, TimeoutError, ConnectionError):
        return 0, {}


@dataclass
class Router:
    """The load balancer, reduced to the one decision it makes.

    `active` is the pointer a real target group holds. Everything else in this
    class exists so the rehearsal can assert what was served by whom.
    """

    blue: Instance | None = None
    green: Instance | None = None
    active: str = "blue"
    served: dict[str, int] = field(default_factory=lambda: {"blue": 0, "green": 0})
    switches: list[tuple[float, str, str]] = field(default_factory=list)

    @property
    def idle(self) -> str:
        return "green" if self.active == "blue" else "blue"

    def side(self, name: str) -> Instance | None:
        return self.blue if name == "blue" else self.green

    def set_side(self, name: str, instance: Instance | None) -> None:
        if name == "blue":
            self.blue = instance
        else:
            self.green = instance

    # -------------------------------------------------------- serving
    def payment(self, amount_minor: int, payout: bool = False) -> tuple[int, dict]:
        """One request, through the router, to whichever side is active."""
        instance = self.side(self.active)
        if instance is None:
            return 502, {"error": "no active version"}
        self.served[self.active] += 1
        return _post(
            instance.port,
            "/payments",
            {"amount_minor": amount_minor, "payout": payout},
        )

    def ready(self, name: str) -> bool:
        instance = self.side(name)
        if instance is None:
            return False
        status, _ = _get(instance.port, "/readyz")
        return status == 200

    # -------------------------------------------------------- deploying
    def wait_until_ready(
        self, name: str, timeout: float = 5.0, interval: float = 0.05
    ) -> float:
        """Poll readiness. Returns the seconds it took, or raises.

        A real deploy uses the target group's own health check with the same
        shape: a number of consecutive successes, an interval, and a deadline.
        Two consecutive successes rather than one, because a single probe against
        a process that is about to crash is a coin toss.
        """
        started = time.perf_counter()
        consecutive = 0
        while time.perf_counter() - started < timeout:
            if self.ready(name):
                consecutive += 1
                if consecutive >= 2:
                    return time.perf_counter() - started
            else:
                consecutive = 0
            time.sleep(interval)
        raise DeployRefused(
            f"{name} never became ready within {timeout:.1f}s, so traffic was "
            "never switched to it. This is the gate working."
        )

    def deploy(self, version: Version, timeout: float = 5.0) -> dict:
        """Start the new version on the idle side, gate it, then switch."""
        target = self.idle
        previous = self.active

        existing = self.side(target)
        if existing is not None:
            existing.stop()
        self.set_side(target, serve(version))

        started = time.perf_counter()
        try:
            ready_after = self.wait_until_ready(target, timeout=timeout)
        except DeployRefused:
            # The broken version stays running and receives nothing. Leaving it
            # up is deliberate: its logs and its /readyz output are the evidence.
            return {
                "switched": False,
                "active": self.active,
                "candidate": target,
                "candidate_version": version.name,
                "waited_seconds": time.perf_counter() - started,
                "reason": "readiness never passed",
            }

        switch_started = time.perf_counter()
        self.active = target
        self.switches.append((time.time(), previous, target))
        return {
            "switched": True,
            "active": self.active,
            "previous": previous,
            "version": version.name,
            "ready_after_seconds": ready_after,
            "switch_seconds": time.perf_counter() - switch_started,
        }

    def rollback(self) -> dict:
        """Back to the other side, timed from decision to first healthy response.

        That is the number to publish, and it is deliberately not "time to switch
        the pointer". The pointer moves in microseconds. What a customer
        experiences is the first successful request afterwards, so the clock stops
        when one comes back.

        This is the fast path, and it only exists while the idle side still holds
        the previous version. Writing the rehearsal turned up the hazard that
        makes that sentence necessary: see `rollback_by_redeploy`.
        """
        decided_at = time.perf_counter()
        target = self.idle
        if self.side(target) is None:
            raise DeployRefused("there is no other side to roll back to")

        if not self.ready(target):
            raise DeployRefused(
                f"{target} is not ready, so rolling back to it would be an outage "
                "with extra steps. Redeploy the last known good version instead: "
                "rollback_by_redeploy()"
            )

        previous = self.active
        self.active = target
        self.switches.append((time.time(), previous, target))

        status, payload = self.payment(1999)
        first_healthy = time.perf_counter() - decided_at
        return {
            "path": "switch",
            "rolled_back_to": target,
            "from": previous,
            "status": status,
            "serving_version": payload.get("version"),
            "seconds_to_first_healthy_response": first_healthy,
        }

    def rollback_by_redeploy(self, known_good: Version, timeout: float = 5.0) -> dict:
        """The slow path, for when the idle side no longer holds a good version.

        The case is easy to miss and it happens: **a failed deploy has already
        overwritten your rollback target.** With two sides, deploying
        onto the idle side destroys whatever was there, so after
        `blue=v1, green=v2 active`, a broken v3 deploy replaces v1 on blue. If
        the switch then happened anyway, or v2 turned out to be broken too, there
        is no healthy side left to point at.

        The rollback is then a deploy: start the known good version, wait for
        readiness, switch. It is slower by exactly the readiness gate, which is
        why a README should publish both numbers rather than the flattering one.

        In a real setup this is what "keep the previous image tagged and ready"
        buys you, and it is the argument for three target groups rather than two
        if the money allows it.
        """
        decided_at = time.perf_counter()
        target = self.idle

        existing = self.side(target)
        if existing is not None:
            existing.stop()
        self.set_side(target, serve(known_good))
        self.wait_until_ready(target, timeout=timeout)

        previous = self.active
        self.active = target
        self.switches.append((time.time(), previous, target))

        status, payload = self.payment(1999)
        return {
            "path": "redeploy",
            "rolled_back_to": target,
            "from": previous,
            "status": status,
            "serving_version": payload.get("version"),
            "seconds_to_first_healthy_response": time.perf_counter() - decided_at,
        }

    def stop(self) -> None:
        for name in ("blue", "green"):
            instance = self.side(name)
            if instance is not None:
                instance.stop()
                self.set_side(name, None)
