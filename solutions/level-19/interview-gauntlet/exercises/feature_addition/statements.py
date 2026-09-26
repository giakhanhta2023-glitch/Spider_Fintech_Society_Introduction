"""Exercise 3: add a feature to an existing service, in its style.

Ninety minutes. The feature: merchants want their statement filtered by date range
and paginated, because one merchant now has 40,000 rows and the endpoint returns
all of them.

**What is being assessed is whether you match the conventions you find.** The
existing code below the line was not written by me. It uses a particular error
shape, a particular naming style and a particular way of returning results, and
the new code uses all three even where I would have chosen differently.
"""

from __future__ import annotations

from dataclasses import dataclass

# ------------------------------------------------------------ existing code
# Conventions to notice and keep:
#   - results come back as a dict with "data" and "meta"
#   - errors are raised as StatementError with a code and a message
#   - amounts are integer minor units, never floats
#   - dates are ISO strings, compared as strings, which works for ISO 8601
MAX_PAGE_SIZE = 100
DEFAULT_PAGE_SIZE = 25


class StatementError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


@dataclass(frozen=True, slots=True)
class Line:
    at: str
    reference: str
    amount_minor: int
    kind: str


def statement(lines: list[Line], merchant_id: str) -> dict:
    """The endpoint as it was: every line, no filtering, no paging."""
    return {
        "data": [line.__dict__ for line in lines],
        "meta": {"merchant_id": merchant_id, "count": len(lines)},
    }


# ------------------------------------------------------------- the feature
def statement_page(
    lines: list[Line],
    merchant_id: str,
    start: str | None = None,
    end: str | None = None,
    cursor: str | None = None,
    page_size: int = DEFAULT_PAGE_SIZE,
) -> dict:
    """A filtered, paginated statement, in the shape the existing endpoint uses.

    Cursor paging rather than offset paging, which is the one place I deviated
    from what the existing code would have suggested, and the reason is in the
    note: with `offset`, a line inserted while a merchant is paging shifts every
    later page and they see a row twice or miss one entirely. On a statement that
    is a support ticket about missing money.

    The cursor is the last reference seen, which is stable because references are
    unique and sortable. It is returned opaque so the client cannot construct one
    and nobody depends on its format.
    """
    if page_size < 1 or page_size > MAX_PAGE_SIZE:
        raise StatementError(
            "invalid_page_size", f"page_size must be between 1 and {MAX_PAGE_SIZE}"
        )
    if start and end and start > end:
        raise StatementError("invalid_range", "start must not be after end")

    selected = [
        line for line in sorted(lines, key=lambda line: (line.at, line.reference))
        if (start is None or line.at[:10] >= start)
        and (end is None or line.at[:10] <= end)
    ]

    if cursor is not None:
        after = [i for i, line in enumerate(selected) if line.reference == cursor]
        if not after:
            # An unknown cursor is a client error rather than an empty page. An
            # empty page here looks to the client like the end of the statement.
            raise StatementError("unknown_cursor", "cursor does not match any line")
        selected = selected[after[0] + 1:]

    page = selected[:page_size]
    remaining = len(selected) - len(page)

    return {
        "data": [line.__dict__ for line in page],
        "meta": {
            "merchant_id": merchant_id,
            "count": len(page),
            "has_more": remaining > 0,
            "next_cursor": page[-1].reference if page and remaining > 0 else None,
            "range": {"start": start, "end": end},
        },
    }


LINES = [
    Line(at="2026-09-01T10:00:00", reference="R001", amount_minor=1000, kind="capture"),
    Line(at="2026-09-01T12:00:00", reference="R002", amount_minor=-200, kind="refund"),
    Line(at="2026-09-02T09:00:00", reference="R003", amount_minor=5000, kind="capture"),
    Line(at="2026-09-03T09:00:00", reference="R004", amount_minor=700, kind="capture"),
]


def test_the_existing_endpoint_still_behaves():
    """The feature is additive. Breaking the old shape breaks every client."""
    result = statement(LINES, "M1")
    assert result["meta"]["count"] == 4
    assert set(result["data"][0]) == {"at", "reference", "amount_minor", "kind"}


def test_a_page_reports_whether_there_is_more():
    first = statement_page(LINES, "M1", page_size=2)
    assert [line["reference"] for line in first["data"]] == ["R001", "R002"]
    assert first["meta"]["has_more"] is True
    assert first["meta"]["next_cursor"] == "R002"


def test_paging_to_the_end():
    second = statement_page(LINES, "M1", cursor="R002", page_size=2)
    assert [line["reference"] for line in second["data"]] == ["R003", "R004"]
    assert second["meta"]["has_more"] is False
    assert second["meta"]["next_cursor"] is None


def test_the_date_range_is_inclusive_at_both_ends():
    result = statement_page(LINES, "M1", start="2026-09-01", end="2026-09-02")
    assert [line["reference"] for line in result["data"]] == ["R001", "R002", "R003"]


def test_a_row_inserted_mid_page_does_not_shift_the_next_page():
    """Why cursor paging rather than offset paging, asserted rather than argued."""
    first = statement_page(LINES, "M1", page_size=2)
    grown = [*LINES, Line(at="2026-09-01T11:00:00", reference="R00X",
                          amount_minor=1, kind="capture")]
    second = statement_page(grown, "M1", cursor=first["meta"]["next_cursor"], page_size=2)
    assert [line["reference"] for line in second["data"]] == ["R003", "R004"]


def test_the_errors_use_the_existing_shape():
    import pytest

    for bad in (0, MAX_PAGE_SIZE + 1):
        with pytest.raises(StatementError) as raised:
            statement_page(LINES, "M1", page_size=bad)
        assert raised.value.code == "invalid_page_size"

    with pytest.raises(StatementError) as raised:
        statement_page(LINES, "M1", start="2026-09-05", end="2026-09-01")
    assert raised.value.code == "invalid_range"

    with pytest.raises(StatementError) as raised:
        statement_page(LINES, "M1", cursor="nonsense")
    assert raised.value.code == "unknown_cursor"
