"""One place that knows how to connect, so nothing else has to.

The connection string comes from the environment and there is no default. A
default would be a production database somebody connected to by accident.
"""

from __future__ import annotations

import os
from collections.abc import Iterator
from contextlib import contextmanager

import psycopg
from psycopg.rows import dict_row


def url() -> str:
    """The connection string, or a refusal to start."""
    value = os.environ.get("DATABASE_URL")
    if not value:
        raise SystemExit(
            "DATABASE_URL is not set. Copy .env.example, fill it in, and export it.\n"
            "Nothing here has a default, because a default is how you end up\n"
            "connected to production by accident."
        )
    return value


@contextmanager
def connect(autocommit: bool = False) -> Iterator[psycopg.Connection]:
    """A connection that always closes, and rolls back on an exception.

    psycopg's context manager commits on a clean exit and rolls back on an
    exception, which is exactly the behaviour transfer() depends on.
    """
    with psycopg.connect(url(), row_factory=dict_row, autocommit=autocommit) as conn:
        yield conn
