"""Every request and response, with a minimum and a maximum on every number.

Unbounded numeric fields are how an API gets handed 10**30 and returns a
stack trace. Bounds here are not defensive clutter: they are the contract, and
pydantic turns each one into a documented constraint in the generated schema.
"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

# One hundred million major units, in minor units. Large enough for any real
# transfer, small enough that a typo cannot create a number nobody can read.
MAX_MINOR = 10_000_000_000
MIN_MINOR = -10_000_000_000

AccountId = Annotated[int, Field(ge=1, le=2**53)]
AmountMinor = Annotated[int, Field(ge=MIN_MINOR, le=MAX_MINOR)]
Currency = Annotated[str, Field(min_length=3, max_length=3, pattern=r"^[A-Z]{3}$")]


class Leg(BaseModel):
    model_config = ConfigDict(extra="forbid")

    account_id: AccountId
    amount_minor: AmountMinor

    @field_validator("amount_minor")
    @classmethod
    def not_zero(cls, v: int) -> int:
        if v == 0:
            raise ValueError("a leg of zero moves nothing")
        return v


class TransferRequest(BaseModel):
    """extra='forbid' on purpose: a caller who misspells a field should be told,
    rather than silently getting a transfer that ignores it."""

    model_config = ConfigDict(extra="forbid")

    currency: Currency
    description: Annotated[str, Field(min_length=1, max_length=200)]
    reference: Annotated[str | None, Field(default=None, max_length=64)]
    legs: Annotated[list[Leg], Field(min_length=2, max_length=20)]


class TransferResponse(BaseModel):
    id: int
    status: Literal["posted"]
    currency: str
    description: str
    reference: str | None
    legs: list[Leg]
    created_at: datetime


class BalanceResponse(BaseModel):
    account_id: int
    currency: str
    balance_minor: int
    as_of: datetime


class EntryResponse(BaseModel):
    id: int
    transfer_id: int
    account_id: int
    amount_minor: int
    created_at: datetime


class Page(BaseModel):
    """Cursor pagination. No total, because counting the whole table to render
    a page is the query that takes the site down at three in the morning."""

    data: list[EntryResponse]
    has_more: bool
    next_cursor: str | None
