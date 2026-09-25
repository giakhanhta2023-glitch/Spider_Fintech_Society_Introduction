"""The service, small enough to start twice and deploy for real.

This is a deliberately tiny HTTP server built on the standard library rather than
the FastAPI app from level 7. The reason is the deploy rehearsal: the blue green
switch, the readiness gating and the timed rollback in `deploy/` have to run in a
test suite on any machine, with nothing installed and no container runtime. A
rehearsal that needs Docker is a rehearsal that runs once.

The production service is level 7's, and the endpoints here have the same shape:

    GET  /healthz     liveness. Does not touch a dependency
    GET  /readyz      readiness. Checks the dependencies, gates the deploy
    GET  /version     which build is answering, which is what blue green needs
    POST /payments    the work, and the payout path behind a kill switch

`Version` carries a `broken` flag. That is not a shortcut: deploying a version
whose readiness never passes is exactly the scenario the level asks to be proved
safe, and it needs a version that is broken on purpose.
"""

from __future__ import annotations

import json
import threading
from dataclasses import dataclass, field
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

from .flags import Flags, payouts_enabled
from .health import Health


@dataclass
class Version:
    """One build of the service, as it behaves at runtime."""

    name: str
    flags: Flags | None = None
    database_reachable: bool = True
    broken: bool = False               # readiness never passes
    requests: int = 0
    payouts: int = 0
    refused_payouts: int = 0
    health: Health = field(default_factory=Health)

    def __post_init__(self) -> None:
        self.health.add("database", lambda: self.database_reachable and not self.broken)

    # ---------------------------------------------------------- the work
    def take_payment(self, body: dict) -> tuple[int, dict]:
        self.requests += 1
        amount = body.get("amount_minor")
        if not isinstance(amount, int) or amount <= 0:
            return 400, {"error": "amount_minor must be a positive integer"}

        payout = bool(body.get("payout"))
        if payout:
            # Read at request time, every time. Turning the switch off stops the
            # next payout without a deploy and without a restart.
            if self.flags is None or not payouts_enabled(self.flags):
                self.refused_payouts += 1
                return 503, {
                    "error": "payouts are disabled",
                    "flag": "payouts_enabled",
                    "version": self.name,
                }
            self.payouts += 1

        return 201, {"status": "captured", "amount_minor": amount, "version": self.name}


class Handler(BaseHTTPRequestHandler):
    version: Version                    # set by serve()
    protocol_version = "HTTP/1.1"

    def log_message(self, *args: Any) -> None:
        return                                        # silence in tests

    def _send(self, status: int, payload: dict) -> None:
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        if self.path == "/healthz":
            ok, payload = self.version.health.live()
            self._send(200 if ok else 500, payload)
        elif self.path == "/readyz":
            ok, payload = self.version.health.ready()
            # 503 rather than 500: this instance is fine and is not available,
            # which is a different thing and the load balancer treats it so.
            self._send(200 if ok else 503, payload)
        elif self.path == "/version":
            self._send(200, {"version": self.version.name})
        else:
            self._send(404, {"error": "not found"})

    def do_POST(self) -> None:
        if self.path != "/payments":
            self._send(404, {"error": "not found"})
            return
        length = int(self.headers.get("Content-Length", "0"))
        try:
            body = json.loads(self.rfile.read(length) or b"{}")
        except ValueError:
            self._send(400, {"error": "body is not json"})
            return
        status, payload = self.version.take_payment(body)
        self._send(status, payload)


@dataclass
class Instance:
    """A running version, on a port, in a thread."""

    version: Version
    server: ThreadingHTTPServer
    thread: threading.Thread

    @property
    def port(self) -> int:
        return self.server.server_address[1]

    def stop(self) -> None:
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=5)


def serve(version: Version, port: int = 0) -> Instance:
    """Start one instance. Port 0 means the operating system picks."""
    handler = type("BoundHandler", (Handler,), {"version": version})
    server = ThreadingHTTPServer(("127.0.0.1", port), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return Instance(version=version, server=server, thread=thread)
