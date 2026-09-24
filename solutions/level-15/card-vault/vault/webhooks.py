"""Signing what you send, and the four ways a forgery gets in.

The construction is the one most payment processors use, and every piece of it
is there for a specific attack.

    signed = f"{timestamp}.{raw_body}"
    signature = hmac_sha256(secret, signed)
    header: X-Signature: t=1758585600,v1=9f86d081...

**The raw body**, before any parsing. Re-serialising JSON changes bytes, and a
receiver that verifies against its own re-serialisation fails every signature
in a way that takes a day to find.

**The timestamp inside the signed string**, not beside it. Outside, an attacker
edits it freely. Inside, changing it invalidates the signature, which is what
makes the replay window enforceable.

**A version prefix**, so the algorithm can change later without breaking every
integration on the same day.

**Two secrets accepted at once**, so a receiver can rotate without downtime.
"""

from __future__ import annotations

import hashlib
import hmac
import time
from dataclasses import dataclass

# How old a request may be and still be accepted. Five minutes: long enough to
# survive clock skew and a slow network, short enough that a captured request
# is not useful for long.
REPLAY_WINDOW_SECONDS = 300


class BadSignature(Exception):
    """Refused. The reason is not returned to the caller."""


def sign(secret: bytes, raw_body: bytes, timestamp: int | None = None) -> str:
    when = int(time.time()) if timestamp is None else timestamp
    signed = f"{when}.".encode() + raw_body
    mac = hmac.new(secret, signed, hashlib.sha256).hexdigest()
    return f"t={when},v1={mac}"


def verify(
    header: str,
    raw_body: bytes,
    secrets_accepted: list[bytes],
    now: int | None = None,
    window_seconds: int = REPLAY_WINDOW_SECONDS,
) -> bool:
    """Verify against any accepted secret, within the replay window.

    `secrets_accepted` is a list rather than one value so a rotation is a
    deploy that adds the new secret, a window in which both work, and a deploy
    that removes the old one. Anything else is an outage for every receiver.
    """
    now = int(time.time()) if now is None else now

    try:
        parts = dict(piece.split("=", 1) for piece in header.split(","))
        when = int(parts["t"])
        offered = parts["v1"]
    except (ValueError, KeyError) as exc:
        raise BadSignature("malformed signature header") from exc

    if abs(now - when) > window_seconds:
        # Checked before the HMAC, so a flood of stale requests costs a
        # subtraction rather than a hash.
        raise BadSignature("outside the replay window")

    signed = f"{when}.".encode() + raw_body
    for secret in secrets_accepted:
        expected = hmac.new(secret, signed, hashlib.sha256).hexdigest()
        # compare_digest rather than ==. Level 15 could not reproduce the
        # timing leak at this length and measured compare_digest at 60 ns more
        # expensive, so it is used because it is free rather than because the
        # attack was observed. Sixty nanoseconds to stop depending on an
        # implementation detail is not a decision worth having twice.
        if hmac.compare_digest(expected, offered):
            return True

    raise BadSignature("no accepted secret produces this signature")


@dataclass
class RotationWindow:
    """Two secrets, and the order they are retired in.

    Sign with the new one from the moment it exists; accept both until every
    receiver has been given the new one. Signing with the old one while
    accepting both is the mistake: it makes the window indefinite, because
    nothing forces the receivers to move.
    """

    current: bytes
    previous: bytes | None = None

    def accepted(self) -> list[bytes]:
        return [self.current] + ([self.previous] if self.previous else [])

    def rotate(self, new_secret: bytes) -> None:
        self.previous = self.current
        self.current = new_secret

    def close_window(self) -> None:
        self.previous = None
