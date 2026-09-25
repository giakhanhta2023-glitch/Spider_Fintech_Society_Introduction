"""Options for the integration tests, which need something running.

The gate passes `--base-url http://localhost:8000`, pointing at the container it
has just built and started. Without it these tests skip, because a test that
quietly passes against nothing is worse than one that is obviously absent.
"""

from __future__ import annotations

import pytest


def pytest_addoption(parser) -> None:
    parser.addoption(
        "--base-url",
        action="store",
        default=None,
        help="The running service to test against, as the gate provides it",
    )


@pytest.fixture(scope="session")
def base_url(request) -> str:
    url = request.config.getoption("--base-url")
    if not url:
        pytest.skip("needs --base-url pointing at a running service")
    return url.rstrip("/")
