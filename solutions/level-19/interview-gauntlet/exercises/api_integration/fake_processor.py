"""A processor that fails on purpose, so the failure handling can be tested.

The point of writing this rather than mocking the transport call by call: a mock
asserts that the code called something, and this asserts what the *processor*
ended up with, which is the only question that matters. One charge or two.

It implements the idempotency contract the real ones publish: the same key
returns the same charge, and a second call with the same key never creates a
second charge, whatever the client did in between.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from .client import Response


@dataclass
class FakeProcessor:
    """Configurable failure, and a record of every charge actually created."""

    # Statuses to return before behaving, consumed one per call. [500, 500] means
    # the first two calls fail and the third succeeds.
    failures: list[int] = field(default_factory=list)
    timeouts: int = 0                      # calls that hang rather than answer
    retry_after: str | None = None
    charges: dict[str, dict] = field(default_factory=dict)
    calls: list[dict] = field(default_factory=list)

    def post(
        self,
        path: str,
        body: dict,
        headers: dict[str, str],
        connect_timeout: float,
        read_timeout: float,
    ) -> Response:
        # Asserted by a test rather than trusted: a transport that silently
        # defaults the timeout is the bug this records.
        self.calls.append({
            "path": path,
            "idempotency_key": headers.get("Idempotency-Key"),
            "attempt": headers.get("Idempotency-Attempt"),
            "connect_timeout": connect_timeout,
            "read_timeout": read_timeout,
        })

        if self.timeouts > 0:
            self.timeouts -= 1
            # The nasty case: the charge is created and the answer never arrives.
            # This is what makes a retry without an idempotency key a double
            # charge rather than a wasted call.
            self._create(headers.get("Idempotency-Key", ""), body)
            raise TimeoutError(f"read timeout after {read_timeout}s")

        if self.failures:
            status = self.failures.pop(0)
            headers_out = {"Retry-After": self.retry_after} if self.retry_after else {}
            return Response(status, {"error": "try again"}, headers_out)

        key = headers.get("Idempotency-Key", "")
        charge = self._create(key, body)
        return Response(201, charge)

    def _create(self, key: str, body: dict) -> dict:
        if key in self.charges:
            return self.charges[key]        # the contract: same key, same charge
        charge = {
            "id": f"ch_{len(self.charges) + 1:04d}",
            "amount_minor": body["amount_minor"],
            "currency": body["currency"],
            "status": "captured",
        }
        self.charges[key] = charge
        return charge

    @property
    def charge_count(self) -> int:
        """The number that decides whether a retry was safe."""
        return len(self.charges)
