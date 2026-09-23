"""The twelve tests the level asks for, plus the ones that keep the rest honest.

These run against the in-memory ledger, in process, with no database. That is
deliberate: everything asserted here is about the HTTP contract, which is what
this level is. The rules that are really about storage are tested in level 6
against a real Postgres, where they mean something.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.auth import ApiKey, KeyRing
from app.main import create_app
from app.memory import MemoryIdempotencyStore, MemoryLedger

FULL = frozenset({"transfers:write", "transfers:read", "accounts:read"})
READONLY = frozenset({"transfers:read", "accounts:read"})

GOOD_KEY = "sk_test_a_key_that_only_exists_in_tests"
READ_KEY = "sk_test_read_only"

AUTH = {"Authorization": f"Bearer {GOOD_KEY}"}


@pytest.fixture
def ledger() -> MemoryLedger:
    led = MemoryLedger()
    led.credit(1, 1_000_00)  # account 1 starts with $1,000
    return led


@pytest.fixture
def client(ledger: MemoryLedger) -> TestClient:
    keys = KeyRing.from_raw(
        {
            GOOD_KEY: ApiKey("k_live_1", merchant_id=1, scopes=FULL),
            READ_KEY: ApiKey("k_live_2", merchant_id=1, scopes=READONLY),
        }
    )
    app = create_app(ledger, keys, MemoryIdempotencyStore())
    return TestClient(app, raise_server_exceptions=False)


def transfer_body(amount: int = 10_00) -> dict:
    return {
        "currency": "USD",
        "description": "a payment",
        "legs": [
            {"account_id": 1, "amount_minor": -amount},
            {"account_id": 2, "amount_minor": amount},
        ],
    }


# --------------------------------------------------------------- the happy path
def test_a_new_key_returns_201_and_an_id(client: TestClient) -> None:
    r = client.post("/v1/transfers", json=transfer_body(), headers={**AUTH, "Idempotency-Key": "k1"})
    assert r.status_code == 201
    assert isinstance(r.json()["id"], int)
    assert r.json()["status"] == "posted"


def test_the_transfer_can_be_read_back(client: TestClient) -> None:
    created = client.post(
        "/v1/transfers", json=transfer_body(), headers={**AUTH, "Idempotency-Key": "k2"}
    ).json()
    r = client.get(f"/v1/transfers/{created['id']}", headers=AUTH)
    assert r.status_code == 200
    assert r.json()["id"] == created["id"]


def test_an_unknown_transfer_is_404(client: TestClient) -> None:
    r = client.get("/v1/transfers/999999", headers=AUTH)
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "transfer_not_found"


# --------------------------------------------------------------- idempotency
def test_the_same_key_and_body_replays_the_saved_response(client: TestClient) -> None:
    first = client.post(
        "/v1/transfers", json=transfer_body(), headers={**AUTH, "Idempotency-Key": "same"}
    )
    second = client.post(
        "/v1/transfers", json=transfer_body(), headers={**AUTH, "Idempotency-Key": "same"}
    )
    assert first.status_code == 201
    assert second.status_code == 200
    assert second.headers["Idempotent-Replay"] == "true"
    assert second.json() == first.json()


def test_a_replay_does_not_move_money_twice(client: TestClient, ledger: MemoryLedger) -> None:
    for _ in range(5):
        client.post(
            "/v1/transfers", json=transfer_body(), headers={**AUTH, "Idempotency-Key": "once"}
        )
    assert ledger.balances[2] == 10_00


def test_the_same_key_with_a_different_body_is_409(client: TestClient) -> None:
    client.post(
        "/v1/transfers", json=transfer_body(10_00), headers={**AUTH, "Idempotency-Key": "clash"}
    )
    r = client.post(
        "/v1/transfers", json=transfer_body(20_00), headers={**AUTH, "Idempotency-Key": "clash"}
    )
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "idempotency_key_reused"


def test_reordering_the_json_is_not_a_conflict(client: TestClient) -> None:
    """A client that serialises its fields in a different order is not making a
    different request, and treating it as one would be maddening."""
    body = transfer_body()
    client.post("/v1/transfers", json=body, headers={**AUTH, "Idempotency-Key": "order"})
    reordered = {"legs": body["legs"], "description": body["description"], "currency": body["currency"]}
    r = client.post("/v1/transfers", json=reordered, headers={**AUTH, "Idempotency-Key": "order"})
    assert r.status_code == 200


def test_a_write_without_an_idempotency_key_is_400(client: TestClient) -> None:
    r = client.post("/v1/transfers", json=transfer_body(), headers=AUTH)
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "idempotency_key_required"


# ------------------------------------------------------------ authentication
def test_no_authorization_header_is_401(client: TestClient, ledger: MemoryLedger) -> None:
    before = dict(ledger.balances)
    r = client.post("/v1/transfers", json=transfer_body(), headers={"Idempotency-Key": "x"})
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "unauthorized"
    assert ledger.balances == before  # nothing was touched


def test_a_wrong_key_is_401(client: TestClient) -> None:
    r = client.get("/v1/transfers/1", headers={"Authorization": "Bearer sk_test_wrong"})
    assert r.status_code == 401


def test_a_valid_key_without_the_scope_is_403(client: TestClient) -> None:
    """Authentication is who. Authorisation is what they may do."""
    r = client.post(
        "/v1/transfers",
        json=transfer_body(),
        headers={"Authorization": f"Bearer {READ_KEY}", "Idempotency-Key": "scoped"},
    )
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "forbidden"


# --------------------------------------------------------------- validation
def test_a_zero_leg_is_422_in_our_error_shape(client: TestClient) -> None:
    body = transfer_body()
    body["legs"][0]["amount_minor"] = 0
    r = client.post("/v1/transfers", json=body, headers={**AUTH, "Idempotency-Key": "z"})
    assert r.status_code == 422
    payload = r.json()
    assert payload["error"]["code"] == "invalid_request"
    assert "detail" not in payload  # the framework's shape must not leak
    assert any("amount_minor" in d["field"] for d in payload["error"]["details"])


def test_an_amount_beyond_the_maximum_is_422_naming_the_field(client: TestClient) -> None:
    body = transfer_body()
    body["legs"][0]["amount_minor"] = -10**15
    r = client.post("/v1/transfers", json=body, headers={**AUTH, "Idempotency-Key": "big"})
    assert r.status_code == 422
    assert any("amount_minor" in d["field"] for d in r.json()["error"]["details"])


def test_an_unknown_field_is_refused_rather_than_ignored(client: TestClient) -> None:
    body = transfer_body() | {"amount": 100}
    r = client.post("/v1/transfers", json=body, headers={**AUTH, "Idempotency-Key": "extra"})
    assert r.status_code == 422


def test_legs_that_do_not_sum_to_zero_are_422(client: TestClient) -> None:
    body = transfer_body()
    body["legs"][1]["amount_minor"] = 9_00
    r = client.post("/v1/transfers", json=body, headers={**AUTH, "Idempotency-Key": "u"})
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "unbalanced_transfer"


# ------------------------------------------------------------------ the money
def test_an_unknown_account_is_404(client: TestClient) -> None:
    body = transfer_body()
    body["legs"][1]["account_id"] = 9999
    r = client.post("/v1/transfers", json=body, headers={**AUTH, "Idempotency-Key": "ghost"})
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "account_not_found"


def test_more_than_the_balance_is_422_and_writes_nothing(
    client: TestClient, ledger: MemoryLedger
) -> None:
    before = dict(ledger.balances)
    entries_before = len(ledger._entries)

    r = client.post(
        "/v1/transfers", json=transfer_body(9_999_00), headers={**AUTH, "Idempotency-Key": "over"}
    )

    assert r.status_code == 422
    assert r.json()["error"]["code"] == "insufficient_funds"
    assert ledger.balances == before
    assert len(ledger._entries) == entries_before


def test_the_balance_endpoint_reports_what_moved(client: TestClient) -> None:
    client.post("/v1/transfers", json=transfer_body(250_00), headers={**AUTH, "Idempotency-Key": "b"})
    r = client.get("/v1/accounts/2/balance", headers=AUTH)
    assert r.status_code == 200
    assert r.json()["balance_minor"] == 250_00


# ---------------------------------------------------------------- request id
def test_every_response_carries_a_request_id(client: TestClient) -> None:
    r = client.get("/v1/healthz")
    assert r.headers["X-Request-Id"]


def test_a_supplied_request_id_is_echoed_back(client: TestClient) -> None:
    r = client.get("/v1/healthz", headers={"X-Request-Id": "from-the-caller"})
    assert r.headers["X-Request-Id"] == "from-the-caller"


def test_the_request_id_is_in_the_error_body_too(client: TestClient) -> None:
    r = client.get("/v1/transfers/999999", headers={**AUTH, "X-Request-Id": "trace-me"})
    assert r.json()["error"]["request_id"] == "trace-me"


# ---------------------------------------------------------------- pagination
def test_walking_two_pages_returns_no_row_twice(client: TestClient) -> None:
    for i in range(7):
        client.post(
            "/v1/transfers", json=transfer_body(1_00), headers={**AUTH, "Idempotency-Key": f"p{i}"}
        )

    first = client.get("/v1/accounts/2/entries?limit=3", headers=AUTH).json()
    assert len(first["data"]) == 3
    assert first["has_more"] is True

    second = client.get(
        f"/v1/accounts/2/entries?limit=3&cursor={first['next_cursor']}", headers=AUTH
    ).json()
    third = client.get(
        f"/v1/accounts/2/entries?limit=3&cursor={second['next_cursor']}", headers=AUTH
    ).json()

    seen = [row["id"] for page in (first, second, third) for row in page["data"]]
    assert len(seen) == len(set(seen)) == 7
    assert third["has_more"] is False
    assert third["next_cursor"] is None


def test_a_limit_of_ten_thousand_is_capped(client: TestClient) -> None:
    for i in range(5):
        client.post(
            "/v1/transfers", json=transfer_body(1_00), headers={**AUTH, "Idempotency-Key": f"c{i}"}
        )
    r = client.get("/v1/accounts/2/entries?limit=10000", headers=AUTH)
    assert r.status_code == 200
    assert len(r.json()["data"]) <= 100


def test_a_cursor_we_did_not_issue_is_refused(client: TestClient) -> None:
    r = client.get("/v1/accounts/2/entries?cursor=not-a-real-cursor", headers=AUTH)
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "invalid_cursor"


# ------------------------------------------------------------------ contract
def test_the_published_error_codes_match_the_code(client: TestClient) -> None:
    codes = {c["code"] for c in client.get("/v1/errors").json()["codes"]}
    assert {"unauthorized", "idempotency_key_reused", "insufficient_funds"} <= codes
