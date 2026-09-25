"""Tracing, W3C format, and the part that breaks at the queue.

A trace is a tree of spans sharing one trace id. Metrics say something is wrong,
logs say why, and a trace says **where**, which is the question that takes
longest to answer by hand in a system with six services in it.

This is a small tracer rather than the OpenTelemetry SDK, for one reason: the
tests have to run with no collector, no Docker and no network, and a tracing
test that needs infrastructure is a tracing test nobody runs. The wire format is
the real one, so the mapping is direct:

    this module                       OpenTelemetry
    Tracer.span(name)                 tracer.start_as_current_span(name)
    tracer.inject(headers)            TraceContextTextMapPropagator().inject
    tracer.extract(headers)           ...extract(carrier)
    span.attributes["merchant_id"]    span.set_attribute(...)
    span.fail(code)                   span.set_status(StatusCode.ERROR)

`traceparent: 00-<32 hex trace id>-<16 hex span id>-<flags>` is what every
vendor agrees on, which is why a Python service and a Java service from level 18
can appear in one trace at all.

The interesting failure is the queue. HTTP headers do not survive it: the
consumer runs in another process, minutes later, and there are no headers left
to read. So the context travels inside the message body, and the trace stays in
one piece. A trace that stops at the queue boundary is the single most common
tracing defect, and it looks like the queue is fast, because everything after it
is invisible.
"""

from __future__ import annotations

import re
import secrets
import time
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass, field
from typing import Iterator

TRACEPARENT = re.compile(r"^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$")

_current: ContextVar["SpanContext | None"] = ContextVar("span", default=None)


@dataclass(frozen=True, slots=True)
class SpanContext:
    trace_id: str
    span_id: str
    sampled: bool = True

    @property
    def traceparent(self) -> str:
        return f"00-{self.trace_id}-{self.span_id}-{'01' if self.sampled else '00'}"

    @classmethod
    def parse(cls, traceparent: str | None) -> SpanContext | None:
        if not traceparent:
            return None
        match = TRACEPARENT.match(traceparent.strip())
        if not match:
            return None                     # malformed: start a new trace
        trace_id, span_id, flags = match.groups()
        if trace_id == "0" * 32 or span_id == "0" * 16:
            return None                     # invalid by the specification
        return cls(trace_id=trace_id, span_id=span_id, sampled=flags.endswith("1"))


@dataclass
class Span:
    name: str
    service: str
    context: SpanContext
    parent_id: str | None
    started: float
    ended: float | None = None
    status: str = "ok"
    error_code: str | None = None
    attributes: dict[str, object] = field(default_factory=dict)

    @property
    def trace_id(self) -> str:
        return self.context.trace_id

    @property
    def span_id(self) -> str:
        return self.context.span_id

    @property
    def duration_ms(self) -> float:
        return ((self.ended or time.perf_counter()) - self.started) * 1000

    def fail(self, code: str) -> None:
        self.status = "error"
        self.error_code = code


@dataclass
class Tracer:
    """One per service. Finished spans go to `collected`, which stands in for
    the exporter and makes the tests readable."""

    service: str
    collected: list[Span] = field(default_factory=list)

    @contextmanager
    def span(
        self,
        name: str,
        parent: SpanContext | None = None,
        **attributes: object,
    ) -> Iterator[Span]:
        """Start a span, as a child of whatever is current unless told otherwise.

        The parent comes from the context variable, so a function four calls
        deep produces a correctly parented span without being handed anything.
        That is the same reason the request id lives in a context variable, and
        it is the only version of this that survives a refactor.
        """
        parent = parent or _current.get()
        context = SpanContext(
            trace_id=parent.trace_id if parent else secrets.token_hex(16),
            span_id=secrets.token_hex(8),
            sampled=parent.sampled if parent else True,
        )
        span = Span(
            name=name,
            service=self.service,
            context=context,
            parent_id=parent.span_id if parent else None,
            started=time.perf_counter(),
            attributes=dict(attributes),
        )
        token = _current.set(context)
        try:
            yield span
        except Exception as exc:                        # noqa: BLE001
            span.fail(type(exc).__name__)
            raise
        finally:
            span.ended = time.perf_counter()
            _current.reset(token)
            self.collected.append(span)

    # ------------------------------------------------------- propagation
    def inject(self, headers: dict[str, str]) -> dict[str, str]:
        """Outbound HTTP. One header, and the next service continues the trace."""
        current = _current.get()
        if current:
            headers["traceparent"] = current.traceparent
        return headers

    @staticmethod
    def extract(headers: dict[str, str]) -> SpanContext | None:
        lowered = {k.lower(): v for k, v in headers.items()}
        return SpanContext.parse(lowered.get("traceparent"))

    def carry_into_message(self, body: dict) -> dict:
        """Outbound queue. The same value, in the body rather than a header.

        This is the whole fix for the broken trace. The producer writes it, the
        consumer reads it, and the span the consumer creates is a child of the
        span that published the message even though an hour passed in between.
        """
        current = _current.get()
        if current:
            body = {**body, "traceparent": current.traceparent}
        return body

    @staticmethod
    def continue_from_message(body: dict) -> SpanContext | None:
        return SpanContext.parse(body.get("traceparent"))


# ------------------------------------------------------------- inspection
def unbroken(spans: list[Span]) -> bool:
    """One trace id, one root, and every parent present.

    This is the assertion worth writing, because a broken trace still renders:
    the viewer shows two traces, both look plausible, and nobody notices that
    the second half of the payment is missing from the first one.
    """
    if not spans:
        return False
    if len({s.trace_id for s in spans}) != 1:
        return False
    ids = {s.span_id for s in spans}
    roots = [s for s in spans if s.parent_id is None]
    if len(roots) != 1:
        return False
    return all(s.parent_id in ids for s in spans if s.parent_id is not None)


def render(spans: list[Span]) -> str:
    """The trace as a waterfall, for a README or an incident channel."""
    by_parent: dict[str | None, list[Span]] = {}
    for span in spans:
        by_parent.setdefault(span.parent_id, []).append(span)

    lines: list[str] = []

    def walk(parent: str | None, depth: int) -> None:
        for span in sorted(by_parent.get(parent, []), key=lambda s: s.started):
            mark = "" if span.status == "ok" else f"  [{span.error_code}]"
            lines.append(
                f"{'  ' * depth}{span.service}: {span.name}"
                f"  {span.duration_ms:.1f} ms{mark}"
            )
            walk(span.span_id, depth + 1)

    walk(None, 0)
    return "\n".join(lines)
