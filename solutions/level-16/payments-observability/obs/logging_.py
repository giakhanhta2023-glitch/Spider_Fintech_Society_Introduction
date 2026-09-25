"""Structured logs: stable event names, an allowlist, and a sampling policy.

Three rules, each of which exists because of a specific bad night.

**One event name per thing that happens**, from a fixed list. `payment.captured`
is searchable, aggregatable and stable across a refactor. "Captured payment
pay_123 for merchant M1 successfully" is a sentence, and sentences change
wording every time somebody touches the line, which quietly breaks the query
somebody built a dashboard on.

**An allowlist of fields.** A denylist removes what somebody thought of. The
endpoint added last Tuesday has a field nobody listed, and it is already in the
aggregator, replicated and retained for a year. The card redaction from level 15
belongs here too and is not repeated: this module assumes the vault, so no field
here should ever contain a card number in the first place.

**A sampling policy written as a rule, not a percentage.** Keep every error and
every slow request, sample the boring successes. That is the difference between
a 1% sample that throws away the incident and a 1% sample that keeps it.

The module is `logging_` rather than `logging` so that reading an import in this
package never leaves any doubt about which one is meant.
"""

from __future__ import annotations

import hashlib
import json
import logging
import re
import time
from dataclasses import dataclass
from typing import Any

from .context import actor, request_id

# Fields that may appear in a log line. Everything else is dropped, counted,
# and visible in the `dropped` field so the author finds out immediately.
ALLOWED = frozenset(
    {
        "event", "level", "at", "request_id", "trace_id", "actor",
        "merchant_id", "payment_id", "token", "bin", "last4",
        "amount_minor", "currency", "status", "status_class", "error_code",
        "endpoint", "method", "duration_ms", "attempt", "queue", "outcome",
    }
)

# Every event this service can emit. A name not in here raises in tests and
# logs as `event.unregistered` in production, because a logging call is not a
# place to fail a payment.
EVENTS = frozenset(
    {
        "request.started", "request.finished",
        "payment.authorized", "payment.captured", "payment.declined",
        "payment.refunded", "payment.chargeback",
        "vault.tokenised", "vault.detokenised",
        "queue.published", "queue.consumed", "queue.retried",
        "saga.compensated", "reconcile.break",
        "alert.fired", "alert.resolved",
        "event.unregistered",
    }
)

NAME_SHAPE = re.compile(r"^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$")


class UnregisteredEvent(Exception):
    """A name not on the list. Raised in tests, tolerated in production."""


class JsonFormatter(logging.Formatter):
    """One line, one JSON object, only allowed fields, sorted keys.

    Sorted because a diff of two log lines should show what changed rather than
    what moved.
    """

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(record.created)),
            "event": record.getMessage(),
            "level": record.levelname.lower(),
        }
        for key, value in getattr(record, "fields", {}).items():
            if key in ALLOWED:
                payload[key] = value
        dropped = getattr(record, "dropped", [])
        if dropped:
            payload["dropped"] = dropped
        return json.dumps(payload, sort_keys=True, default=str, separators=(",", ":"))


def log(
    logger: logging.Logger,
    event: str,
    level: int = logging.INFO,
    strict: bool = False,
    **fields: Any,
) -> None:
    """The only way this codebase logs.

    The request id is taken from the context rather than passed in, so a
    function three layers down cannot forget it and no signature carries it.
    """
    if event not in EVENTS or not NAME_SHAPE.match(event):
        if strict:
            raise UnregisteredEvent(
                f"{event!r} is not a registered event name. Add it to EVENTS, "
                "and use dot.separated.lowercase"
            )
        fields = {**fields, "status": "unregistered:" + event[:40]}
        event = "event.unregistered"

    present = {"request_id": request_id(), "actor": actor(), **fields}
    present = {k: v for k, v in present.items() if v is not None}
    dropped = sorted(set(present) - ALLOWED)
    logger.log(level, event, extra={"fields": present, "dropped": dropped})


# ------------------------------------------------------- the sampling policy
@dataclass(frozen=True, slots=True)
class SamplingPolicy:
    """Keep everything that matters, sample what does not.

    `keep_one_in` applies only to ordinary fast successes. The decision is
    taken on the request id rather than at random, so every line belonging to
    one request is kept or dropped together. Sampling per line gives you three
    lines out of nine and a story with holes in it, which is worse than either
    extreme.
    """

    keep_one_in: int = 20
    slow_ms: float = 250.0

    def keep(self, rid: str, *, failed: bool, duration_ms: float) -> bool:
        if failed or duration_ms >= self.slow_ms:
            return True
        digest = hashlib.blake2b(rid.encode(), digest_size=8).digest()
        return int.from_bytes(digest, "big") % self.keep_one_in == 0


@dataclass(frozen=True, slots=True)
class Volume:
    """What the logs cost, measured rather than guessed.

    The dollar figure is arithmetic over a price you supply. There is no
    industry price to quote here: hosted log platforms charge between a few
    cents and several dollars per gigabyte ingested depending on the contract,
    so the default below is a round number to make the arithmetic legible. Put
    your own invoice in it before quoting the result to anybody.
    """

    bytes_per_line: float
    lines_per_request: float
    requests_per_second: float
    dollars_per_gb: float = 0.50

    @property
    def gb_per_day(self) -> float:
        per_day = self.requests_per_second * 86_400 * self.lines_per_request
        return per_day * self.bytes_per_line / 1e9

    @property
    def dollars_per_year(self) -> float:
        return self.gb_per_day * 365 * self.dollars_per_gb

    def sampled(self, policy: SamplingPolicy, failure_rate: float, slow_rate: float) -> Volume:
        """The same volume under the policy.

        Errors and slow requests are kept whole, so the saving is bounded by
        how much of the traffic is ordinary. At a 0.1% failure rate and 2% slow
        requests, keeping one in twenty of the rest keeps about 7% of the lines,
        and every line anybody will ever want during an incident.
        """
        interesting = failure_rate + slow_rate
        kept_share = interesting + (1 - interesting) / policy.keep_one_in
        return Volume(
            bytes_per_line=self.bytes_per_line,
            lines_per_request=self.lines_per_request * kept_share,
            requests_per_second=self.requests_per_second,
            dollars_per_gb=self.dollars_per_gb,
        )
