"""The exception queue: breaks that persist between runs.

A reconciliation that prints a list and forgets is a report. A reconciliation
that remembers is a workflow, and the difference is three columns: first seen,
last seen, and status.

The property that matters most is that running the job twice changes nothing.
Same breaks, no duplicates, nothing reopened, nothing lost. Without it the job
cannot be run on a schedule, and a reconciliation somebody has to remember to
run is a reconciliation that stops happening in December.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from datetime import date
from pathlib import Path

from .classify import Break


@dataclass
class Exception_:
    break_id: str
    type: str
    key: str
    kind: str
    value_minor: int
    owner: str
    detail: str
    first_seen: str
    last_seen: str
    status: str = "open"          # open | resolved
    resolution: str | None = None


@dataclass
class ExceptionQueue:
    path: Path
    items: dict[str, Exception_] = field(default_factory=dict)

    def load(self) -> ExceptionQueue:
        if self.path.exists():
            raw = json.loads(self.path.read_text(encoding="utf-8"))
            self.items = {k: Exception_(**v) for k, v in raw.items()}
        return self

    def save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(
            json.dumps({k: asdict(v) for k, v in self.items.items()}, indent=2, sort_keys=True),
            encoding="utf-8",
        )

    def apply(self, breaks: list[Break], run_date: date) -> dict[str, int]:
        """Fold today's breaks into the queue.

        Three cases, and the third is the one people forget:

          new        first seen today
          still open seen before and still there: last_seen moves, nothing else
          gone       in the queue, not in today's breaks: resolved automatically
                     with a reason, rather than sitting open forever
        """
        today = run_date.isoformat()
        seen_today = {b.break_id for b in breaks if b.is_break}
        counts = {"new": 0, "still_open": 0, "auto_resolved": 0, "reopened": 0}

        for b in breaks:
            if not b.is_break:
                continue
            existing = self.items.get(b.break_id)
            if existing is None:
                self.items[b.break_id] = Exception_(
                    break_id=b.break_id,
                    type=b.type,
                    key=b.key,
                    kind=b.kind,
                    value_minor=b.value_minor,
                    owner=b.owner,
                    detail=b.detail,
                    first_seen=today,
                    last_seen=today,
                )
                counts["new"] += 1
            else:
                # last_seen moves; first_seen never does, because that is what
                # the aging report is measured from.
                existing.last_seen = today
                existing.value_minor = b.value_minor
                existing.detail = b.detail
                if existing.status == "resolved":
                    existing.status = "open"
                    existing.resolution = None
                    counts["reopened"] += 1
                else:
                    counts["still_open"] += 1

        for break_id, item in self.items.items():
            if item.status == "open" and break_id not in seen_today:
                item.status = "resolved"
                item.resolution = f"no longer present as of {today}"
                counts["auto_resolved"] += 1

        return counts

    def open_items(self) -> list[Exception_]:
        return [i for i in self.items.values() if i.status == "open"]

    def aging(self, run_date: date) -> dict[str, int]:
        """How long open breaks have been open. The number that shows whether
        anybody is actually working the queue."""
        buckets = {"0-1 days": 0, "2-7 days": 0, "8-30 days": 0, "over 30 days": 0}
        for item in self.open_items():
            age = (run_date - date.fromisoformat(item.first_seen)).days
            if age <= 1:
                buckets["0-1 days"] += 1
            elif age <= 7:
                buckets["2-7 days"] += 1
            elif age <= 30:
                buckets["8-30 days"] += 1
            else:
                buckets["over 30 days"] += 1
        return buckets
