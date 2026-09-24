"""Logs are a data store, and this one allowlists.

A denylist only removes the fields somebody thought of. The endpoint added last
Tuesday has a field nobody added to the list, and now it is in the log
aggregator, replicated, and retained for a year.

So: an allowlist of what may be logged, and a redactor as a second line of
defence for anything that slips through as free text. Both, because the
allowlist protects structured fields and the redactor protects the error
message somebody interpolated a card number into.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

# The only fields that may appear in a log line. Everything else is dropped.
ALLOWED = frozenset(
    {
        "event", "level", "request_id", "merchant_id", "payment_id", "token",
        "bin", "last4", "amount_minor", "currency", "status", "error_code",
        "duration_ms", "attempt", "scope", "actor",
    }
)

# Second line of defence: a card-shaped number anywhere in free text. Matches
# 13 to 19 digits with optional spaces or dashes, which is every card format.
PAN_PATTERN = re.compile(r"\b(?:\d[ -]?){12,18}\d\b")


def redact(text: str) -> str:
    """Replace anything card shaped, keeping the BIN and last four.

    Keeping those is deliberate: they are not sensitive on their own and they
    are what makes a log line useful for support. A fully redacted line helps
    nobody and gets replaced by an unredacted one.
    """

    def mask(match: re.Match[str]) -> str:
        digits = re.sub(r"[ -]", "", match.group(0))
        if len(digits) < 13:
            return match.group(0)
        return f"{digits[:6]}{'*' * (len(digits) - 10)}{digits[-4:]}"

    return PAN_PATTERN.sub(mask, text)


class AllowlistFormatter(logging.Formatter):
    """JSON output containing only allowed fields, all of them redacted."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "event": record.getMessage(),
            "level": record.levelname.lower(),
        }
        for key, value in getattr(record, "fields", {}).items():
            if key in ALLOWED:
                payload[key] = value
        return redact(json.dumps(payload, sort_keys=True, default=str))


def log(logger: logging.Logger, event: str, **fields: Any) -> None:
    """The only way this codebase logs.

    Fields not on the allowlist are dropped silently rather than raising,
    because a logging call is not a place to fail a request. Dropped keys are
    counted so a test can assert what was refused.
    """
    dropped = sorted(set(fields) - ALLOWED)
    logger.info(event, extra={"fields": fields, "dropped": dropped})
