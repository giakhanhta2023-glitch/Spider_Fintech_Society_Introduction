"""Tail sampling: decide what to keep after you know how it went.

Head sampling decides at the first span, before anything has happened. At 1% it
keeps 1% of the failures, which is the same as saying it throws away 99 out of
every 100 traces anybody would ever want to look at. During an incident you open
the tracing tool and the incident is not in it.

Tail sampling waits for the trace to finish and then decides. It costs memory,
because every unfinished trace is buffered, and it is worth it:

    keep every trace with an error                         100%
    keep every trace slower than the objective             100%
    keep a deterministic fraction of ordinary fast traces  1 in N

The fraction is deterministic on the trace id rather than random, so the same
trace is kept by every instance that sees part of it. With a random draw per
service, one service keeps its half and another drops its half, and the trace
arrives in the viewer with a hole in the middle.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass

from .tracing import Span


@dataclass(frozen=True, slots=True)
class TailSampler:
    slow_ms: float = 250.0
    keep_one_in: int = 100

    def failed(self, trace: list[Span]) -> bool:
        return any(span.status != "ok" for span in trace)

    def duration_ms(self, trace: list[Span]) -> float:
        """The root span's duration, which is what the customer waited."""
        roots = [s for s in trace if s.parent_id is None]
        if roots:
            return roots[0].duration_ms
        return max((s.duration_ms for s in trace), default=0.0)

    def keep(self, trace: list[Span]) -> tuple[bool, str]:
        """Returns the decision and the reason, because the reason is what a
        reviewer argues with."""
        if not trace:
            return False, "empty"
        if self.failed(trace):
            return True, "error"
        if self.duration_ms(trace) >= self.slow_ms:
            return True, "slow"
        digest = hashlib.blake2b(trace[0].trace_id.encode(), digest_size=8).digest()
        if int.from_bytes(digest, "big") % self.keep_one_in == 0:
            return True, "sampled"
        return False, "dropped"


@dataclass(frozen=True, slots=True)
class Retention:
    traces: int
    kept: int
    failed_total: int
    failed_kept: int
    slow_total: int
    slow_kept: int

    @property
    def kept_share(self) -> float:
        return self.kept / self.traces if self.traces else 0.0


def measure(sampler: TailSampler, traces: list[list[Span]]) -> Retention:
    """What the policy actually retained, rather than what it promised.

    The two numbers to check are `failed_kept == failed_total` and
    `slow_kept == slow_total`. A policy that keeps 99.9% of failures is not a
    tail sampling policy, it is a bug with a rounding error in front of it.
    """
    kept = failed_total = failed_kept = slow_total = slow_kept = 0
    for trace in traces:
        decision, _ = sampler.keep(trace)
        is_failed = sampler.failed(trace)
        is_slow = sampler.duration_ms(trace) >= sampler.slow_ms
        kept += decision
        failed_total += is_failed
        slow_total += is_slow
        failed_kept += is_failed and decision
        slow_kept += is_slow and decision

    return Retention(
        traces=len(traces),
        kept=kept,
        failed_total=failed_total,
        failed_kept=failed_kept,
        slow_total=slow_total,
        slow_kept=slow_kept,
    )
