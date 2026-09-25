"""The request id, and how it reaches code that was never given it.

One value has to be everywhere: in every log line, on every span, in every
message put on a queue. Threading it through forty function signatures is the
version of this that gets abandoned in week two, so it lives in a context
variable instead.

`contextvars` rather than a thread local, because the service from level 14 is
async. A thread local is shared by every coroutine on the thread, so two
concurrent requests would overwrite each other's id and the logs would be
worse than useless: they would be plausible and wrong.
"""

from __future__ import annotations

import secrets
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass, field
from typing import Iterator

_request_id: ContextVar[str | None] = ContextVar("request_id", default=None)
_actor: ContextVar[str | None] = ContextVar("actor", default=None)


def new_request_id() -> str:
    """Generated at the edge, once, and never again.

    Generated per service instead, you get one id per hop and no way to join
    them, which is the failure mode that makes people give up on logs.
    """
    return "req_" + secrets.token_hex(8)


def request_id() -> str | None:
    return _request_id.get()


def actor() -> str | None:
    return _actor.get()


@contextmanager
def request_context(rid: str | None = None, who: str | None = None) -> Iterator[str]:
    """Bind an id for the duration of one request.

    The tokens are reset on the way out rather than set back to None: with
    nested contexts, setting None would erase an outer request's id, and a
    background task started inside a request inherits a copy of the context
    rather than sharing it.
    """
    rid = rid or new_request_id()
    rid_token = _request_id.set(rid)
    actor_token = _actor.set(who)
    try:
        yield rid
    finally:
        _request_id.reset(rid_token)
        _actor.reset(actor_token)


def from_headers(headers: dict[str, str]) -> str:
    """Accept an upstream id, or make one.

    Accepting one from the outside means a caller controls a value that ends up
    in the log aggregator, so it is checked rather than trusted: the wrong
    shape is discarded and a new id is generated. Without that check the field
    is a log injection.
    """
    offered = headers.get("x-request-id") or headers.get("X-Request-Id")
    if offered and _looks_like_ours(offered):
        return offered
    return new_request_id()


def _looks_like_ours(value: str) -> bool:
    return (
        len(value) <= 40
        and value.startswith("req_")
        and all(c.isalnum() or c == "_" for c in value)
    )


# ------------------------------------------------------------- the queue
@dataclass
class Envelope:
    """A queue message, and the trace context travelling inside its body.

    This class exists because of one of the level's tests. HTTP headers do not
    survive a queue: the consumer runs minutes later in another process, and
    whatever the producer had in its headers is long gone. So the context is a
    field of the message, written by the producer, read by the consumer, and
    versioned like any other part of the payload.
    """

    payload: dict
    request_id: str | None = None
    traceparent: str | None = None
    attempts: int = 0
    meta: dict[str, str] = field(default_factory=dict)

    @classmethod
    def wrap(cls, payload: dict, traceparent: str | None = None) -> Envelope:
        return cls(payload=payload, request_id=request_id(), traceparent=traceparent)
