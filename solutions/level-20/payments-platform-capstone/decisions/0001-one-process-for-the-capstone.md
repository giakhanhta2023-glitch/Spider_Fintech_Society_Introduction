# 1. The capstone runs in one process

**Status** accepted · **Date** 2026-09-25 · **Deciders** the author

## Context

The level asks for one compose file that starts every service on a fresh clone,
an hour of load against it, four injected failures and a migration under load.

The machine this was written on has no container runtime. That is not a detail to
work around quietly: a capstone whose headline claim is "it runs" cannot be
published with an unexercised compose file and a paragraph implying otherwise.

Three things have to be true whatever is chosen. The payment path has to run end
to end. The failures have to be injectable at a known moment, because "time to
detection" is meaningless if the injection time is a guess. And the whole thing
has to run on somebody else's laptop, or the numbers cannot be reproduced.

## Options

**A. Write the compose file, do not run it, describe the results.** Cheapest, and
it produces a repository whose central claim is untested. Rejected: the point of
the level is evidence.

**B. Wait for a machine with Docker.** Honest and unavailable.

**C. Run the platform in one process, with the compose file written and labelled
as unexercised.** Six services as six modules, wired in `platform_/platform.py`,
with threads for the asynchronous half.

**D. Run the services as separate processes over loopback HTTP.** Closer to the
real shape, and measured on this machine in level 18: a p50 of 5 ms and a p99
pinned near 39 ms per request, which is delayed acknowledgement meeting Nagle
rather than anything the service did. Several hops of that per payment would make
an hour of load a measurement of the socket layer, and it would put the injection
moment inside a socket timeout rather than at a known microsecond.

## Decision

**C.** The platform runs in one process. The compose file is written, is not run,
and says so in its first comment. Every number in the README comes from the in
process platform, and every number is labelled with what it does and does not
prove.

## Consequences

**What this buys.** The scenarios are injectable to the microsecond:
`ledger.stop()` is a database outage at a known instant, which against containers
requires `docker compose stop` and a poll loop to find out when it took effect.
The whole capstone runs in about four minutes on any machine with Python.

**What it costs, and the list is the honest part.** No network, so nothing here
measures serialisation, connection pools, TLS handshakes or partial failure of a
socket. No process boundaries, so a memory leak in one service is a memory leak in
all of them and a crash takes everything with it. One GIL, so the throughput
numbers are a measurement of Python rather than of the design. No orchestrator, so
nothing proves that a readiness probe drains a pod.

**What that means for the claims.** "Zero breaks after four injected failures" is
about the *logic*: the states, the idempotency, the reconciliation. It is not a
claim about a deployment, and the README says so in the same sentence as the
number.

**What would change this.** A machine with Docker, and an afternoon. The compose
file and the module boundaries are written so that each service can be lifted into
its own container without rewriting anything except the wiring: every call between
services already goes through a narrow interface rather than through a shared
object.
