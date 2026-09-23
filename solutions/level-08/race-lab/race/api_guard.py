"""Wiring the chosen fix into the level 7 API.

Two failures, two different answers, and telling them apart is the whole job:

    the customer does not have the money   ->  422 insufficient_funds
                                               Their fault, permanent, and
                                               retrying will not help.

    we have no connection to spare         ->  503 with Retry-After
                                               Our fault, temporary, and
                                               retrying is exactly right.

Returning 500 for the second one is the common mistake, and it tells the caller
to give up when they should come back in a moment. Hanging until the pool
frees up is worse: the caller times out with no information, and the request
keeps occupying a slot after nobody is waiting for it, which is the goodput
problem from level 14 arriving early.
"""

from __future__ import annotations

from typing import Any

from psycopg_pool import PoolTimeout

# The level 7 error list, plus the one this level adds.
POOL_EXHAUSTED = {
    "code": "service_busy",
    "status": 503,
    "message": "No database connection was free. Try again shortly.",
}


def install(app: Any, retry_after_seconds: int = 1) -> None:
    """Turn a pool timeout into a 503 with Retry-After, everywhere at once."""
    from fastapi import Request
    from fastapi.responses import JSONResponse

    @app.exception_handler(PoolTimeout)
    async def _pool_exhausted(request: Request, exc: PoolTimeout) -> JSONResponse:
        return JSONResponse(
            status_code=503,
            headers={"Retry-After": str(retry_after_seconds)},
            content={
                "error": {
                    "code": POOL_EXHAUSTED["code"],
                    "message": POOL_EXHAUSTED["message"],
                    "request_id": request.headers.get("X-Request-Id", "-"),
                    "details": [],
                }
            },
        )


# The pool the API should hold. The arithmetic, written down where somebody
# will read it:
#
#   max_size x instances  <  the database's max_connections, with room for
#                            migrations, psql and whatever else connects
#   max_size / query time  =  the requests per second one instance can serve
#
#   8 x 6 instances = 48 connections, against a Postgres allowing 100.
#   8 / 0.004 s = 2,000 requests per second per instance, which is far more
#   than this service sees, so the pool is not the constraint.
POOL_SETTINGS = {
    "min_size": 4,
    "max_size": 8,
    # Fail fast rather than queue. A request that waits three seconds for a
    # connection is a request whose caller has already given up.
    "timeout": 3.0,
    # Recycle connections so a long lived one cannot accumulate server side
    # state or hold a stale plan forever.
    "max_lifetime": 600.0,
}
