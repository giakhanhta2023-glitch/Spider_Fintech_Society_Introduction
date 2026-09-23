"""The API.

Order of work inside a write, which is the part worth reading:

    1. authenticate            before any database work, so an unauthenticated
                               flood costs a hash rather than a connection
    2. require the key         a missing Idempotency-Key is a 400, not a
                               silently non-idempotent write
    3. look the key up         a replay returns the saved response and never
                               reaches the ledger
    4. fingerprint the body    the same key with a different body is a 409,
                               because it is a bug in the caller and hiding it
                               makes it a money bug later
    5. do the work
    6. save the response       so step 3 can answer next time
"""

from __future__ import annotations

import hashlib
import json
import logging
import uuid
from contextvars import ContextVar
from typing import Annotated, Any

from fastapi import Depends, FastAPI, Header, Query, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from .auth import ApiKey, KeyRing
from .errors import CODES, ApiError, ErrorBody
from .models import (
    BalanceResponse,
    EntryResponse,
    Leg,
    Page,
    TransferRequest,
    TransferResponse,
)
from .pagination import clamp, decode, encode
from .ports import (
    AccountMissing,
    IdempotencyStore,
    InsufficientFunds,
    Ledger,
    StoredLeg,
    StoredTransfer,
)

request_id_var: ContextVar[str] = ContextVar("request_id", default="-")
log = logging.getLogger("payments")


def fingerprint_body(body: dict[str, Any]) -> str:
    """Stable across key order, so a client reordering JSON is not a conflict."""
    return hashlib.sha256(
        json.dumps(body, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


def to_response(transfer: StoredTransfer) -> dict[str, Any]:
    return TransferResponse(
        id=transfer.id,
        status="posted",
        currency=transfer.currency,
        description=transfer.description,
        reference=transfer.reference,
        legs=[Leg(account_id=leg.account_id, amount_minor=leg.amount_minor)
              for leg in transfer.legs],
        created_at=transfer.created_at,
    ).model_dump(mode="json")


def caller(request: Request, authorization: Annotated[str | None, Header()] = None) -> ApiKey:
    """Authentication, before any database work.

    Defined at module level rather than inside the factory on purpose. With
    `from __future__ import annotations` every annotation is a string, and
    FastAPI resolves those against the module's globals: a dependency alias
    declared inside the factory is invisible to it, and the parameter silently
    becomes a required query string instead. The symptom is every endpoint
    returning 422 with "field required", which is a confusing half hour.
    """
    return request.app.state.keys.authenticate(authorization)


Caller = Annotated[ApiKey, Depends(caller)]


def create_app(ledger: Ledger, keys: KeyRing, idempotency: IdempotencyStore) -> FastAPI:
    app = FastAPI(
        title="payments-api",
        version="1.0.0",
        description="Transfers over a double entry ledger. Every write is idempotent.",
    )
    app.state.ledger = ledger
    app.state.keys = keys
    app.state.idempotency = idempotency

    # ------------------------------------------------------------ request id
    @app.middleware("http")
    async def request_id_middleware(request: Request, call_next):  # type: ignore[no-untyped-def]
        """Accepted from the caller when supplied, so one identifier spans their
        logs and ours. Generated when not. On every response, always."""
        rid = request.headers.get("X-Request-Id") or str(uuid.uuid4())
        token = request_id_var.set(rid)
        try:
            response = await call_next(request)
        finally:
            request_id_var.reset(token)
        response.headers["X-Request-Id"] = rid
        return response

    # -------------------------------------------------------------- errors
    def fail(exc: ApiError) -> JSONResponse:
        body = ErrorBody(
            code=exc.code,
            message=exc.message,
            request_id=request_id_var.get(),
            details=exc.details,
        )
        log.warning("request failed code=%s request_id=%s", exc.code, body.request_id)
        return JSONResponse(status_code=exc.status, content=body.as_dict())

    @app.exception_handler(ApiError)
    async def _api_error(_: Request, exc: ApiError) -> JSONResponse:
        return fail(exc)

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError) -> JSONResponse:
        """The framework's 422 rewritten into our shape, naming the field.

        Without this, one endpoint returns {"detail": [...]} and the rest
        return our shape, and every caller writes two parsers.
        """
        details = [
            {
                "field": ".".join(str(p) for p in err["loc"][1:]) or str(err["loc"][0]),
                "reason": err["msg"],
            }
            for err in exc.errors()
        ]
        return fail(ApiError("invalid_request", details=details))

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        mapped = {401: "unauthorized", 403: "forbidden", 404: "not_found"}
        return fail(ApiError(mapped.get(exc.status_code, "internal_error")))

    @app.exception_handler(Exception)
    async def _unexpected(_: Request, exc: Exception) -> JSONResponse:
        """Never leak a stack trace to a caller. Log it with the request id so
        the line in the log can be found from the response they show you."""
        log.exception("unhandled error request_id=%s", request_id_var.get())
        return fail(ApiError("internal_error"))

    # ------------------------------------------------------------ endpoints
    @app.post("/v1/transfers", status_code=201, response_model=TransferResponse)
    async def create_transfer(
        body: TransferRequest,
        response: Response,
        key: Caller,
        idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
    ) -> Any:
        app.state.keys.require(key, "transfers:write")

        if not idempotency_key:
            raise ApiError("idempotency_key_required")

        payload = body.model_dump(mode="json")
        fingerprint = fingerprint_body(payload)

        seen = app.state.idempotency.get(idempotency_key)
        if seen is not None:
            stored_fingerprint, status, saved = seen
            if stored_fingerprint != fingerprint:
                raise ApiError("idempotency_key_reused")
            response.status_code = 200
            response.headers["Idempotent-Replay"] = "true"
            return saved

        if sum(leg.amount_minor for leg in body.legs) != 0:
            raise ApiError("unbalanced_transfer")

        try:
            transfer = app.state.ledger.create_transfer(
                currency=body.currency,
                description=body.description,
                reference=body.reference,
                legs=[StoredLeg(leg.account_id, leg.amount_minor) for leg in body.legs],
            )
        except AccountMissing as exc:
            raise ApiError(
                "account_not_found", f"no account {exc.account_id}"
            ) from exc
        except InsufficientFunds as exc:
            raise ApiError(
                "insufficient_funds",
                f"account {exc.account_id} holds {exc.available} and needs {exc.requested}",
            ) from exc

        saved = to_response(transfer)
        app.state.idempotency.put(idempotency_key, fingerprint, 201, saved)
        return saved

    @app.get("/v1/transfers/{transfer_id}", response_model=TransferResponse)
    async def get_transfer(transfer_id: int, key: Caller) -> Any:
        app.state.keys.require(key, "transfers:read")
        transfer = app.state.ledger.get_transfer(transfer_id)
        if transfer is None:
            raise ApiError("transfer_not_found")
        return to_response(transfer)

    @app.get("/v1/accounts/{account_id}/balance", response_model=BalanceResponse)
    async def balance(account_id: int, key: Caller) -> Any:
        app.state.keys.require(key, "accounts:read")
        try:
            minor, currency, as_of = app.state.ledger.balance(account_id)
        except AccountMissing as exc:
            raise ApiError("account_not_found") from exc
        return BalanceResponse(
            account_id=account_id, currency=currency, balance_minor=minor, as_of=as_of
        )

    @app.get("/v1/accounts/{account_id}/entries", response_model=Page)
    async def entries(
        account_id: int,
        key: Caller,
        cursor: Annotated[str | None, Query(max_length=200)] = None,
        limit: Annotated[int | None, Query(ge=1, le=10_000)] = None,
    ) -> Any:
        app.state.keys.require(key, "accounts:read")
        size = clamp(limit)
        after = decode(cursor)
        try:
            rows = app.state.ledger.entries(account_id, after, size)
        except AccountMissing as exc:
            raise ApiError("account_not_found") from exc

        has_more = len(rows) > size
        page = rows[:size]
        return Page(
            data=[
                EntryResponse(
                    id=r.id,
                    transfer_id=r.transfer_id,
                    account_id=r.account_id,
                    amount_minor=r.amount_minor,
                    created_at=r.created_at,
                )
                for r in page
            ],
            has_more=has_more,
            next_cursor=encode(page[-1].created_at, page[-1].id) if has_more and page else None,
        )

    @app.get("/v1/healthz", include_in_schema=False)
    async def healthz() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/v1/errors", include_in_schema=False)
    async def error_codes() -> dict[str, Any]:
        """The published list, served by the API so it cannot drift from the code."""
        return {
            "codes": [
                {"code": c.code, "status": c.status, "message": c.message}
                for c in CODES.values()
            ]
        }

    return app
