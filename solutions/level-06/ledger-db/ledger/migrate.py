"""Forward only migrations, applied once each, recorded in the database.

The whole runner is forty lines, and that is the point: the thing you need
from a migration tool is that it applies each file exactly once, in order,
inside a transaction, and can tell you what it has already done. Everything
else a migration framework offers is convenience.

Rules this follows, all of which come from the level:

  - Files are numbered and never edited after they have run anywhere.
  - Each file runs inside its own transaction, so a failure leaves the schema
    at the last good state rather than halfway through a file.
  - A lock is taken, so two deploys starting at the same moment cannot both
    apply 005.
  - Every migration is timed, because a migration that takes four minutes on
    your laptop is an outage in production and you want to know before.
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

from .db import connect

MIGRATIONS = Path(__file__).resolve().parent.parent / "migrations"

CREATE_TABLE = """
create table if not exists schema_migrations (
    filename   text primary key,
    applied_at timestamptz not null default now(),
    took_ms    integer     not null
)
"""


def pending(conn) -> list[Path]:
    """Every file on disk that the database has not recorded, in order."""
    with conn.cursor() as cur:
        cur.execute(CREATE_TABLE)
        cur.execute("select filename from schema_migrations")
        done = {row["filename"] for row in cur.fetchall()}
    conn.commit()
    return sorted(p for p in MIGRATIONS.glob("*.sql") if p.name not in done)


def apply(conn, path: Path) -> float:
    """Run one file in one transaction and record it in the same transaction.

    Recording the migration in the same transaction as the migration itself is
    what makes the runner safe to interrupt: either both happened or neither
    did, so there is no state where a file ran and nobody knows.
    """
    started = time.perf_counter()
    with conn.cursor() as cur:
        cur.execute(path.read_text(encoding="utf-8"))
        took = (time.perf_counter() - started) * 1000
        cur.execute(
            "insert into schema_migrations (filename, took_ms) values (%s, %s)",
            (path.name, int(took)),
        )
    conn.commit()
    return took


def main() -> int:
    with connect() as conn:
        with conn.cursor() as cur:
            # Two deploys can start at the same second. The first one to get
            # here holds the lock; the second waits and then finds nothing to
            # do, which is the correct outcome rather than a race.
            cur.execute("select pg_advisory_lock(%s)", (int("1edge7", 16),))
        conn.commit()

        todo = pending(conn)
        if not todo:
            print("nothing to apply: the database is up to date")
            return 0

        for path in todo:
            took = apply(conn, path)
            print(f"applied {path.name} in {took:.0f} ms")

        print(f"{len(todo)} migration(s) applied")
    return 0


if __name__ == "__main__":
    sys.exit(main())
