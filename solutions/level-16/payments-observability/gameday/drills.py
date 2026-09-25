"""Game day against the guardrails: break something, see whether anything notices.

    python -m gameday.drills

Each drill is the change a developer would plausibly make, applied to a throwaway
copy of this repository, followed by the full test suite. A drill that the suite
does not notice is a guardrail that does not exist, and finding that out on a
Tuesday afternoon is the entire point.

This is not a substitute for a game day against a running system. Killing a pod,
blackholing the database and pausing the card network need the compose stack, and
the list of those drills is in GAMEDAY.md. It is a substitute for believing that
tests you have never seen fail are protecting you.

Every drill reverts itself, and nothing is written outside the temporary copy.
"""

from __future__ import annotations

import shutil
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent


@dataclass(frozen=True, slots=True)
class Edit:
    path: str
    old: str
    new: str


@dataclass(frozen=True, slots=True)
class Drill:
    name: str
    why: str
    edits: tuple[Edit, ...]


DRILLS = (
    Drill(
        "add merchant_id to the RED counter",
        "the most common cardinality accident, and it always looks reasonable",
        (
            Edit("obs/metrics.py",
                 '            ["endpoint", "status_class"],',
                 '            ["endpoint", "status_class", "merchant_id"],'),
            Edit("obs/metrics.py",
                 'MetricSpec("http_requests_total", "counter", ("endpoint", "status_class")),',
                 'MetricSpec("http_requests_total", "counter", '
                 '("endpoint", "status_class", "merchant_id")),'),
            Edit(
                "obs/metrics.py",
                '    def observe(self, method: str, path: str, status: int, seconds: float) -> str:\n'
                '        endpoint = normalise_endpoint(method, path)\n'
                '        self.requests.labels(endpoint=endpoint, '
                'status_class=f"{status // 100}xx").inc()',
                '    def observe(self, method: str, path: str, status: int, seconds: float,\n'
                '                merchant_id: str = "mer_1") -> str:\n'
                '        endpoint = normalise_endpoint(method, path)\n'
                '        self.requests.labels(endpoint=endpoint, '
                'status_class=f"{status // 100}xx",\n'
                '                             merchant_id=merchant_id).inc()',
            ),
        ),
    ),
    Drill(
        "ship the Prometheus default buckets",
        "the default is wrong for every service, and the dashboard still renders",
        (Edit("obs/metrics.py",
              "BUCKETS = (0.02, 0.03, 0.04, 0.05, 0.06, 0.08, 0.1, 0.15, 0.2, 0.25, 0.3, "
              "0.4, 0.6, 1.0)",
              "BUCKETS = (0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1.0, 2.5, "
              "5.0, 7.5, 10.0)"),),
    ),
    Drill(
        "add pan to the log allowlist",
        "level 15's whole point, undone by one word in a set",
        (Edit("obs/logging_.py",
              '        "amount_minor", "currency", "status", "status_class", "error_code",',
              '        "amount_minor", "currency", "status", "status_class", "error_code", '
              '"pan",'),),
    ),
    Drill(
        "log a free text sentence instead of an event name",
        "how a searchable log becomes a pile of prose, one helpful commit at a time",
        (Edit("obs/logging_.py",
              "    if event not in EVENTS or not NAME_SHAPE.match(event):",
              "    if False:"),),
    ),
    Drill(
        "stop carrying the trace into the queue message",
        "the trace still renders, and the half after the queue is missing",
        (Edit("obs/tracing.py",
              '        current = _current.get()\n'
              '        if current:\n'
              '            body = {**body, "traceparent": current.traceparent}\n'
              '        return body',
              '        return body'),),
    ),
    Drill(
        "sample traces at the head instead of the tail",
        "1% sampling keeps 1% of the failures, and the incident is not in the tool",
        (Edit("obs/sampling.py",
              '        if self.failed(trace):\n'
              '            return True, "error"\n'
              '        if self.duration_ms(trace) >= self.slow_ms:\n'
              '            return True, "slow"',
              '        pass'),),
    ),
    Drill(
        "drop the short confirming windows from the burn rate rules",
        "the alert keeps firing for hours, and gets silenced before the next incident",
        (Edit("slo/replay.py",
              '    if confirm:\n'
              '        short_fast = ratio(month, 5) > FAST_BURN * budget\n'
              '        short_slow = ratio(month, 30) > SLOW_BURN * budget\n'
              '        hot = (long_fast & short_fast) | (long_slow & short_slow)\n'
              '    else:\n'
              '        hot = long_fast | long_slow',
              '    hot = long_fast | long_slow'),),
    ),
    Drill(
        "add an alert with no runbook",
        "a question mark delivered at three in the morning",
        (Edit("slo/burn_rate.yml",
              "      - alert: PaymentsLatencyObjectiveBreached",
              "      - alert: DiskAlmostFull\n"
              "        expr: disk_used_ratio > 0.85\n"
              "        for: 5m\n"
              "        labels:\n"
              "          severity: page\n"
              "          slo: payments-availability\n"
              "        annotations:\n"
              "          summary: A disk is at 85%\n"
              "\n"
              "      - alert: PaymentsLatencyObjectiveBreached"),),
    ),
    Drill(
        "truncate the error budget instead of rounding it",
        "a one second error in a published SLO document, from binary floating point",
        (Edit("slo/budget.py", "    total = int(round(seconds))", "    total = int(seconds)"),),
    ),
)


def run_suite(where: Path) -> tuple[bool, float, list[str]]:
    started = time.perf_counter()
    result = subprocess.run(
        [sys.executable, "-m", "pytest", "-q", "--no-header", "-p", "no:cacheprovider"],
        cwd=where, capture_output=True, text=True, check=False,
    )
    took = time.perf_counter() - started
    failed = [
        line.split("::")[1].split(" ")[0]
        for line in result.stdout.splitlines()
        if line.startswith("FAILED") and "::" in line
    ]
    return result.returncode == 0, took, failed


def main() -> None:
    with tempfile.TemporaryDirectory(prefix="gameday-") as temporary:
        work = Path(temporary) / "copy"
        shutil.copytree(
            HERE, work, ignore=shutil.ignore_patterns("__pycache__", ".pytest_cache", ".git")
        )

        passed, took, _ = run_suite(work)
        print(f"baseline: {'green' if passed else 'ALREADY RED'} in {took:.1f}s\n")
        if not passed:
            print("Fix the suite before running a game day against it.")
            return

        caught = 0
        for drill in DRILLS:
            originals = {}
            ok = True
            for edit in drill.edits:
                target = work / edit.path
                text = target.read_text(encoding="utf-8")
                originals.setdefault(edit.path, text)
                if edit.old not in text:
                    print(f"{drill.name:46s} SKIPPED, anchor moved in {edit.path}")
                    ok = False
                    break
                target.write_text(text.replace(edit.old, edit.new, 1), encoding="utf-8")

            if ok:
                passed, took, failed = run_suite(work)
                caught += not passed
                print(
                    f"{drill.name:46s} {'NOT CAUGHT' if passed else 'caught':11s} "
                    f"{took:4.1f}s  {', '.join(failed[:2]) if failed else 'nothing failed'}"
                )

            for path, text in originals.items():
                (work / path).write_text(text, encoding="utf-8")

        print(f"\n{caught} of {len(DRILLS)} drills caught.")
        if caught < len(DRILLS):
            print("Each one that was not caught is a guardrail this repository "
                  "does not actually have.")


if __name__ == "__main__":
    main()
