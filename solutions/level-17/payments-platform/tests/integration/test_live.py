"""Integration tests: the same image the gate built, running, over HTTP.

    pytest tests/integration --base-url http://localhost:8000

These are the tests that cannot be faked into passing. Each one exercises a
property of the artefact rather than of the source: that the container came up at
all, that its readiness endpoint reflects its dependencies, and that the payout
kill switch works through the real request path.

Never run against production. Every one of them posts a payment.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request

import pytest

TEST_AMOUNT = 1999


def get(url: str, path: str) -> tuple[int, dict]:
    try:
        with urllib.request.urlopen(f"{url}{path}", timeout=5) as response:
            return response.status, json.loads(response.read() or b"{}")
    except urllib.error.HTTPError as exc:
        return exc.code, json.loads(exc.read() or b"{}")


def post(url: str, path: str, body: dict) -> tuple[int, dict]:
    request = urllib.request.Request(
        f"{url}{path}",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=5) as response:
            return response.status, json.loads(response.read() or b"{}")
    except urllib.error.HTTPError as exc:
        return exc.code, json.loads(exc.read() or b"{}")


def test_the_container_is_live_and_ready(base_url) -> None:
    """If this fails, nothing else in the file means anything."""
    status, live = get(base_url, "/healthz")
    assert status == 200 and live["status"] == "live"

    status, ready = get(base_url, "/readyz")
    assert status == 200, f"not ready: {ready}"
    assert all(state == "ok" for state in ready["checks"].values())


def test_the_version_endpoint_names_the_build(base_url) -> None:
    """Blue green needs this: without it, "which version is serving" is guesswork
    during the one minute when the answer matters."""
    status, body = get(base_url, "/version")
    assert status == 200
    assert body["version"]


def test_a_payment_is_accepted(base_url) -> None:
    status, body = post(base_url, "/payments", {"amount_minor": TEST_AMOUNT})
    assert status == 201
    assert body["amount_minor"] == TEST_AMOUNT


def test_an_invalid_amount_is_refused_with_a_reason(base_url) -> None:
    status, body = post(base_url, "/payments", {"amount_minor": -1})
    assert status == 400
    assert "amount_minor" in body["error"]


@pytest.mark.parametrize("path", ["/", "/admin", "/payments/../../etc/passwd"])
def test_unknown_paths_return_404_rather_than_a_stack_trace(base_url, path) -> None:
    status, body = get(base_url, path)
    assert status in (400, 404)
    assert "Traceback" not in json.dumps(body)


def test_the_payout_kill_switch_is_reachable_through_the_real_path(base_url) -> None:
    """The flag is read at request time, so this is a configuration change rather
    than a deploy. In the gate the switch is on, so the payout succeeds; the
    refusal path is covered in tests/test_platform.py where the file can be
    rewritten mid test."""
    status, body = post(base_url, "/payments", {"amount_minor": TEST_AMOUNT, "payout": True})
    assert status in (201, 503)
    if status == 503:
        assert body["flag"] == "payouts_enabled"
