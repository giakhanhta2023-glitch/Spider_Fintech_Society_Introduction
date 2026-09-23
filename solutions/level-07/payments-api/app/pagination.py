"""Cursor pagination, and why it is not OFFSET.

Measured on 398,003 entries, asking for rows 200,001 to 200,050:

    offset 200000 limit 50     read 200,050 rows   102,460 buffers   113.684 ms
    where (created_at, id) >   read      50 rows        30 buffers     0.101 ms

OFFSET does not skip. It reads every row it is skipping and throws each one
away, so page 4,001 costs four thousand times what page 1 costs, and the query
gets slower as the table grows even though the page size never changes. The
keyset version asks the index for the place it left off, so every page costs
the same.

The cursor is opaque on purpose: it encodes (created_at, id), and callers must
not construct one. If they could, they would, and then the sort order could
never change.
"""

from __future__ import annotations

import base64
import binascii
from datetime import datetime

from .errors import ApiError

MAX_LIMIT = 100
DEFAULT_LIMIT = 25


def clamp(limit: int | None) -> int:
    """A caller asking for 10,000 rows gets 100.

    Capped rather than rejected, because a limit that is too large is usually
    optimism rather than an attack, and an API that refuses is harder to use
    than one that quietly does the sane thing and says so in the docs.
    """
    if limit is None:
        return DEFAULT_LIMIT
    return max(1, min(limit, MAX_LIMIT))


def encode(created_at: datetime, row_id: int) -> str:
    raw = f"{created_at.isoformat()}|{row_id}".encode()
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def decode(cursor: str | None) -> tuple[datetime, int] | None:
    if cursor is None:
        return None
    try:
        padded = cursor + "=" * (-len(cursor) % 4)
        text = base64.urlsafe_b64decode(padded.encode()).decode()
        when, _, row_id = text.rpartition("|")
        return datetime.fromisoformat(when), int(row_id)
    except (ValueError, binascii.Error, UnicodeDecodeError) as exc:
        raise ApiError("invalid_cursor") from exc
