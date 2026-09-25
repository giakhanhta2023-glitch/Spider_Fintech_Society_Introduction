"""Configuration as one validated object, read once, at import.

The failure this prevents: a service that starts successfully, passes its health
check, joins the load balancer, and then fails on the first payment because
`FEE_BASIS_POINTS` was never set and `int(os.environ["..."])` ran inside the
request handler. The deploy looked green for four minutes.

Three rules, and the third is the one people skip.

**Read at import, not at use.** A missing variable is a startup failure, which a
deploy notices, rather than a request failure, which a customer notices.

**Validate, do not just read.** A port of "eight thousand" and a fee of "-1" are
both strings that `os.environ` returns happily.

**Name what is missing.** "KeyError: 'DATABASE_URL'" in a container that exits
immediately is a ten minute investigation. A message listing every missing
variable at once is a ten second one, and the difference is a `for` loop.

Secrets are read from the environment and never from the image. Level 15
unchanged: the image is a public artefact that anybody who can pull it can
unpack.
"""

from __future__ import annotations

import os
from collections.abc import Callable, Mapping
from dataclasses import dataclass, fields
from typing import Any

REQUIRED = object()          # a sentinel, so None can be a real default


class ConfigError(Exception):
    """Raised at import. The process exits, and the deploy fails loudly."""


def expects(description: str) -> Callable[[Callable[[str], Any]], Callable[[str], Any]]:
    """Attach the sentence the error message uses.

    The error says what was expected and never what arrived. That is not
    fussiness: the first version of this module interpolated the exception, so
    `PORT=eighty` produced "invalid literal for int() with base 10: 'eighty'",
    and the same code path with a bad DATABASE_URL would have put a password in a
    log line. The test that caught it is
    `test_an_invalid_value_is_refused_without_echoing_it`.
    """

    def decorate(function: Callable[[str], Any]) -> Callable[[str], Any]:
        function.expectation = description       # type: ignore[attr-defined]
        return function

    return decorate


@expects("must be an integer greater than zero")
def _positive_int(raw: str) -> int:
    value = int(raw)
    if value <= 0:
        raise ValueError
    return value


@expects("must be a port between 1 and 65535")
def _port(raw: str) -> int:
    value = int(raw)
    if not 1 <= value <= 65_535:
        raise ValueError
    return value


def _url(scheme: str) -> Callable[[str], str]:
    @expects(f"must be a URL beginning with {scheme}")
    def check(raw: str) -> str:
        if not raw.startswith(scheme):
            raise ValueError
        return raw

    return check


@expects("must be one of local, staging, production")
def _environment(raw: str) -> str:
    if raw not in {"local", "staging", "production"}:
        raise ValueError
    return raw


@expects("must be a path")
def _path(raw: str) -> str:
    return raw


# name in the environment -> (attribute, parser, default)
SCHEMA: dict[str, tuple[str, Callable[[str], Any], Any]] = {
    "ENVIRONMENT": ("environment", _environment, REQUIRED),
    "DATABASE_URL": ("database_url", _url("postgres"), REQUIRED),
    "REDIS_URL": ("redis_url", _url("redis"), REQUIRED),
    "VAULT_URL": ("vault_url", _url("https"), REQUIRED),
    "PORT": ("port", _port, 8000),
    "WORKERS": ("workers", _positive_int, 8),
    "FEE_BASIS_POINTS": ("fee_basis_points", _positive_int, 290),
    "FLAGS_PATH": ("flags_path", _path, "flags/flags.json"),
    "LOG_SAMPLE_ONE_IN": ("log_sample_one_in", _positive_int, 20),
}

# Variables whose values must never be logged, echoed in an error, or written to
# a metric label. The names are safe to print; that is the whole distinction.
SECRETS = frozenset({"DATABASE_URL", "REDIS_URL", "VAULT_TOKEN", "WEBHOOK_SECRET"})


@dataclass(frozen=True, slots=True)
class Config:
    environment: str
    database_url: str
    redis_url: str
    vault_url: str
    port: int = 8000
    workers: int = 8
    fee_basis_points: int = 290
    flags_path: str = "flags/flags.json"
    log_sample_one_in: int = 20

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    def redacted(self) -> dict[str, Any]:
        """What may be logged at startup, which is most of it.

        Logging the configuration at start is worth doing: half of all "it works
        on staging" incidents are a variable nobody looked at. Logging the
        connection strings with it is how a password reaches the log aggregator.
        """
        out = {}
        for item in fields(self):
            environment_name = next(
                name for name, (attribute, _, _) in SCHEMA.items() if attribute == item.name
            )
            value = getattr(self, item.name)
            out[item.name] = "<redacted>" if environment_name in SECRETS else value
        return out


def load(environ: Mapping[str, str] | None = None) -> Config:
    """Build the configuration, or raise with every problem at once.

    Every problem at once, rather than the first one. A container that has to be
    redeployed five times to discover five missing variables is five deploys and
    twenty minutes; one message is one deploy.
    """
    # os.environ is an _Environ rather than a dict, so the parameter is a
    # Mapping and the local is rebound under a different name. Reassigning a
    # parameter to a different type is the kind of thing mypy is for.
    source: Mapping[str, str] = os.environ if environ is None else environ

    values: dict[str, Any] = {}
    problems: list[str] = []

    for name, (attribute, parse, default) in SCHEMA.items():
        raw = source.get(name)
        if raw is None or raw == "":
            if default is REQUIRED:
                problems.append(f"{name} is required and was not set")
            else:
                values[attribute] = default
            continue
        try:
            values[attribute] = parse(raw)
        except (TypeError, ValueError):
            # The name of the variable and what was expected. Never the value,
            # and never the exception, because `int("eighty")` puts the value in
            # its own message and the same path with a bad DATABASE_URL would put
            # a password in a log line.
            expectation = getattr(parse, "expectation", "is not valid")
            problems.append(f"{name} is invalid: {expectation}")

    if problems:
        raise ConfigError(
            "the service cannot start because its configuration is wrong:\n  "
            + "\n  ".join(problems)
        )

    return Config(**values)
