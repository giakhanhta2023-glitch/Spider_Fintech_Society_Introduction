"""One error shape, and the complete list of codes that can appear in it.

Every error this API returns looks the same, including the ones the framework
raises on its own. A caller writes one piece of code to read errors, and the
list below is the contract: adding a code is a change to the API, and it goes
in the README at the same time.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True, slots=True)
class ErrorCode:
    code: str
    status: int
    message: str


# The complete list. Nothing else may reach a caller.
CODES: dict[str, ErrorCode] = {
    c.code: c
    for c in (
        ErrorCode("unauthorized", 401, "A valid bearer API key is required"),
        ErrorCode("forbidden", 403, "This key may not act for that merchant"),
        ErrorCode("not_found", 404, "No such resource"),
        ErrorCode("account_not_found", 404, "No such account"),
        ErrorCode("transfer_not_found", 404, "No such transfer"),
        ErrorCode("idempotency_key_required", 400, "An Idempotency-Key header is required on writes"),
        ErrorCode("idempotency_key_reused", 409, "That Idempotency-Key was used with a different request"),
        ErrorCode("invalid_request", 422, "The request body is not valid"),
        ErrorCode("insufficient_funds", 422, "The source account does not hold that much"),
        ErrorCode("unbalanced_transfer", 422, "The legs of a transfer must sum to zero"),
        ErrorCode("currency_mismatch", 422, "All legs of a transfer must share one currency"),
        ErrorCode("invalid_cursor", 400, "That cursor is not one this API issued"),
        ErrorCode("rate_limited", 429, "Too many requests"),
        ErrorCode("internal_error", 500, "Something went wrong at our end"),
    )
}


class ApiError(Exception):
    """The only exception a handler should raise on purpose."""

    def __init__(
        self,
        code: str,
        message: str | None = None,
        details: list[dict[str, Any]] | None = None,
    ) -> None:
        if code not in CODES:
            raise KeyError(f"{code!r} is not in the published list of error codes")
        known = CODES[code]
        super().__init__(message or known.message)
        self.code = code
        self.status = known.status
        self.message = message or known.message
        self.details = details or []


@dataclass(slots=True)
class ErrorBody:
    """The body every failure returns. Nothing else, ever."""

    code: str
    message: str
    request_id: str
    details: list[dict[str, Any]] = field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        return {
            "error": {
                "code": self.code,
                "message": self.message,
                "request_id": self.request_id,
                "details": self.details,
            }
        }
