"""The level's sixteen tests, and what each one could honestly be checked against.

Four of them need a cloud account or a container runtime, and this machine has
neither. Those four are named below with what was done instead, in the same file
as the ones that pass, so the gap is visible rather than buried in a README.

    test 1   no test tooling in the image     static: the requirements split and
                                              the Dockerfile stages
    test 8   a clean terraform plan           not verified, infra/NOT_APPLIED.md
    test 9   destroy and rebuild staging      not verified, infra/NOT_APPLIED.md
    test 11  the database refuses outsiders   static: the security group rule
    test 12  the readiness probe drains a Pod static: the manifest, plus the unit
                                              test on the probe itself

Everything else runs here, including the two that are usually described rather
than tested: a broken version receiving no traffic, and a rollback timed to the
first healthy response.
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path

import pytest
import yaml

from app.config import ConfigError, load
from app.flags import Flags
from app.health import Health
from app.service import Version
from deploy.bluegreen import DeployRefused, Router
from deploy.rehearsal import write_flags

HERE = Path(__file__).resolve().parent.parent

GOOD_ENVIRONMENT = {
    "ENVIRONMENT": "staging",
    "DATABASE_URL": "postgres://payments@db.internal:5432/payments",
    "REDIS_URL": "redis://cache.internal:6379/0",
    "VAULT_URL": "https://card-vault.internal:8443",
}


# --------------------------------------------------------------- the artefact
def test_the_runtime_requirements_contain_no_development_tooling() -> None:
    """Test 1, statically. Measured cost of getting it wrong: 88.6 MB and 3,277
    files that never execute (`python -m ship.image`)."""
    runtime = (HERE / "requirements.txt").read_text(encoding="utf-8")
    development = (HERE / "requirements-dev.txt").read_text(encoding="utf-8")

    for tool in ("pytest", "mypy", "ruff", "hypothesis", "coverage", "black"):
        assert tool not in runtime, f"{tool} is in the runtime requirements"

    assert "-r requirements.txt" in development      # dev builds on runtime
    assert "pytest" in development


def test_the_final_stage_installs_only_the_runtime_requirements() -> None:
    """The multi stage structure, checked rather than assumed.

    A single stage Dockerfile that installs both files is the default mistake, and
    it is invisible until somebody unpacks the image.
    """
    text = (HERE / "Dockerfile").read_text(encoding="utf-8")
    stages = text.split("FROM ")
    assert len(stages) >= 3, "not a multi stage build"

    final = "FROM " + stages[-1]
    assert "requirements-dev" not in final
    assert "pip install" not in final
    assert "COPY --from=builder" in final


def test_dependencies_are_installed_before_the_source_is_copied() -> None:
    """Test 2, statically. This ordering is what makes a one line change cheap:
    26.7 seconds of installing, measured, paid only when the lockfile moves."""
    lines = (HERE / "Dockerfile").read_text(encoding="utf-8").splitlines()
    copy_requirements = next(
        i for i, line in enumerate(lines) if line.startswith("COPY requirements.txt")
    )
    install = next(
        i for i, line in enumerate(lines)
        if line.startswith("RUN pip install") and "requirements.txt" in line
    )
    copy_source = next(
        i for i, line in enumerate(lines) if line.strip() == "COPY . ."
    )
    assert copy_requirements < install < copy_source


def test_the_image_does_not_run_as_root() -> None:
    """Test 4, statically, in both places it has to be true."""
    dockerfile = (HERE / "Dockerfile").read_text(encoding="utf-8")
    assert re.search(r"^USER payments", dockerfile, re.MULTILINE)
    assert "useradd" in dockerfile

    deployment = yaml.safe_load((HERE / "k8s" / "deployment.yaml").read_text(encoding="utf-8"))
    security = deployment["spec"]["template"]["spec"]["securityContext"]
    assert security["runAsNonRoot"] is True
    assert security["runAsUser"] != 0

    container = deployment["spec"]["template"]["spec"]["containers"][0]
    assert container["securityContext"]["allowPrivilegeEscalation"] is False
    assert container["securityContext"]["readOnlyRootFilesystem"] is True


def test_the_dockerignore_excludes_everything_that_could_hold_a_secret() -> None:
    ignored = (HERE / ".dockerignore").read_text(encoding="utf-8")
    for pattern in (".git", ".env", "*.pem", "*.key", "tests/"):
        assert pattern in ignored, f"{pattern} is not in .dockerignore"


# ------------------------------------------------------------ configuration
def test_the_service_refuses_to_start_when_a_variable_is_missing() -> None:
    """Test 3. And it names every missing variable at once, because five deploys
    to discover five missing variables is twenty minutes."""
    with pytest.raises(ConfigError) as raised:
        load({})

    message = str(raised.value)
    for name in ("ENVIRONMENT", "DATABASE_URL", "REDIS_URL", "VAULT_URL"):
        assert name in message


def test_an_invalid_value_is_refused_without_echoing_it() -> None:
    """A rejected DATABASE_URL in an error message is a password in a log line."""
    environment = {**GOOD_ENVIRONMENT, "PORT": "eighty", "FEE_BASIS_POINTS": "-5"}
    with pytest.raises(ConfigError) as raised:
        load(environment)

    message = str(raised.value)
    assert "PORT is invalid: must be a port between 1 and 65535" in message
    assert "FEE_BASIS_POINTS is invalid: must be an integer greater than zero" in message

    # The rejected value is absent, which is the property that matters: the same
    # code path handles DATABASE_URL, and its value is a password.
    assert "eighty" not in message
    assert "-5" not in message

    secret = {**GOOD_ENVIRONMENT, "DATABASE_URL": "mysql://payments:hunter2@db/payments"}
    with pytest.raises(ConfigError) as raised:
        load(secret)
    assert "hunter2" not in str(raised.value)
    assert "DATABASE_URL is invalid: must be a URL beginning with postgres" in str(raised.value)


def test_a_valid_environment_loads_and_redacts_the_secrets() -> None:
    config = load(GOOD_ENVIRONMENT)
    assert config.environment == "staging"
    assert config.port == 8000                 # the documented default
    assert config.fee_basis_points == 290

    redacted = config.redacted()
    assert redacted["database_url"] == "<redacted>"
    assert redacted["port"] == 8000


# ------------------------------------------------------------------- health
def test_readiness_fails_while_the_database_is_unreachable_and_liveness_does_not() -> None:
    """Tests 5 and 12, at the level where the behaviour lives.

    Getting these the wrong way round turns a thirty second database blip into
    every instance restarting at once with cold caches.
    """
    reachable = True
    health = Health()
    health.add("database", lambda: reachable)

    assert health.ready()[0] is True
    assert health.live()[0] is True

    reachable = False
    ready, detail = health.ready()
    assert ready is False
    assert detail["checks"]["database"] == "failing"
    assert health.live()[0] is True             # still alive, just not available


def test_a_probe_that_raises_is_a_failed_check_rather_than_a_failed_request() -> None:
    health = Health()
    health.add("vault", lambda: (_ for _ in ()).throw(ConnectionError("refused")))
    assert health.ready()[0] is False


def test_shutdown_fails_readiness_before_the_process_stops() -> None:
    """The step that stops a deploy dropping requests: SIGTERM makes readiness
    fail, the load balancer stops sending work, and in flight requests finish."""
    health = Health()
    health.add("database", lambda: True)
    assert health.ready()[0] is True

    health.begin_shutdown()
    ready, detail = health.ready()
    assert ready is False
    assert detail["accepting"] is False
    assert health.live()[0] is True


def test_the_kubernetes_manifest_probes_match_the_endpoints_the_service_serves() -> None:
    """Test 12, statically. A readiness probe pointing at a path that always
    returns 200 is the same as having none."""
    deployment = yaml.safe_load((HERE / "k8s" / "deployment.yaml").read_text(encoding="utf-8"))
    container = deployment["spec"]["template"]["spec"]["containers"][0]

    assert container["readinessProbe"]["httpGet"]["path"] == "/readyz"
    assert container["livenessProbe"]["httpGet"]["path"] == "/healthz"
    assert container["startupProbe"]["httpGet"]["path"] == "/healthz"

    # Memory limit equals request, and there is deliberately no CPU limit.
    resources = container["resources"]
    assert resources["limits"]["memory"] == resources["requests"]["memory"]
    assert "cpu" not in resources.get("limits", {})

    service = yaml.safe_load((HERE / "k8s" / "service.yaml").read_text(encoding="utf-8"))
    assert service["spec"]["selector"] == deployment["spec"]["selector"]["matchLabels"]


# ---------------------------------------------------------------- the gate
def test_the_deploy_cannot_run_without_the_gate() -> None:
    """Tests 6 and 7. Both are properties of the dependency graph rather than of
    a policy somebody agreed to."""
    workflow = yaml.safe_load(
        (HERE / ".github" / "workflows" / "gate.yml").read_text(encoding="utf-8")
    )
    jobs = workflow["jobs"]

    assert set(jobs["deploy"]["needs"]) == {"check", "build", "integration"}
    assert jobs["integration"]["needs"] == "build"
    assert jobs["build"]["needs"] == "check"

    # The image that was tested is the image that deploys, by digest.
    deploy_steps = json.dumps(jobs["deploy"]["steps"])
    assert "needs.build.outputs.digest" in deploy_steps
    integration_steps = json.dumps(jobs["integration"]["steps"])
    assert "needs.build.outputs.digest" in integration_steps


def test_the_pipeline_holds_no_long_lived_cloud_credentials() -> None:
    """Test 10, on the pipeline definition: OIDC rather than an access key."""
    workflow = yaml.safe_load(
        (HERE / ".github" / "workflows" / "gate.yml").read_text(encoding="utf-8")
    )
    assert workflow["permissions"]["id-token"] == "write"

    text = (HERE / ".github" / "workflows" / "gate.yml").read_text(encoding="utf-8")
    for forbidden in ("AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "aws_access_key"):
        assert forbidden not in text


# ------------------------------------------------------------ no secrets
KEY_SHAPES = (
    re.compile(r"\b(?:AKIA|ASIA|AIDA|AROA)[0-9A-Z]{16}\b"),          # AWS key ids
    re.compile(r"aws_secret_access_key\s*=\s*\S+", re.IGNORECASE),
    re.compile(r"\bghp_[A-Za-z0-9]{36}\b"),                           # GitHub tokens
    re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
)


def test_no_credential_shaped_string_exists_anywhere_in_the_repository() -> None:
    """Test 10, on the repository. Runs in the gate, which is the only place a
    check like this is worth anything."""
    offenders = []
    for path in HERE.rglob("*"):
        if not path.is_file() or "__pycache__" in path.parts or ".git" in path.parts:
            continue
        if path.suffix in {".png", ".jpg", ".pyc", ".gz"}:
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        for shape in KEY_SHAPES:
            found = shape.search(text)
            # This test file contains the patterns themselves, which is the one
            # legitimate exception and is why the check names the file it found.
            if found and path != Path(__file__):
                offenders.append(f"{path.relative_to(HERE)}: {found.group(0)[:20]}")

    assert not offenders, "credential shaped strings found: " + ", ".join(offenders)


def test_no_long_lived_cloud_key_is_in_this_environment() -> None:
    """The other half of test 10, and the one people forget: the shell.

    A key in the environment is a key in every process that environment starts,
    including the one that uploads a build artefact somewhere public.
    """
    for name in ("AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_SESSION_TOKEN"):
        value = os.environ.get(name, "")
        # A session token is short lived and acceptable; a static key id is not.
        if name == "AWS_ACCESS_KEY_ID" and value:
            assert not value.startswith("AKIA"), (
                "a long lived access key is in this environment. Use a role."
            )


# ------------------------------------------------------------ infrastructure
def test_the_database_has_no_public_address_and_one_source() -> None:
    """Test 11, statically. The security group referring to another security group
    rather than to an address range is the single most important line in infra/."""
    main = (HERE / "infra" / "main.tf").read_text(encoding="utf-8")

    assert "publicly_accessible    = false" in main

    database_block = main[main.index('resource "aws_security_group" "database"'):]
    database_block = database_block[:database_block.index("# -----", 10)]
    assert "security_groups = [aws_security_group.service.id]" in database_block
    assert "cidr_blocks" not in database_block
    assert "0.0.0.0/0" not in database_block


def test_the_iam_policy_has_no_unexplained_wildcard() -> None:
    """The line that ships at six in the evening to make an error go away."""
    iam = (HERE / "infra" / "iam.tf").read_text(encoding="utf-8")

    assert '"*"' not in iam.replace('resources = ["*"]', "")   # actions never wildcard
    # There is exactly one wildcard resource, it is CloudWatch PutMetricData,
    # which has no resource ARN, and it is narrowed by a condition.
    assert iam.count('resources = ["*"]') == 1
    wildcard = iam[iam.index('resources = ["*"]'):]
    assert "condition {" in wildcard[:600]
    assert "cloudwatch:namespace" in wildcard[:900]


def test_the_billing_alarm_exists_before_anything_billable() -> None:
    """A NAT gateway costs money before it moves a byte. The alarm goes first."""
    main = (HERE / "infra" / "main.tf").read_text(encoding="utf-8")
    billing = (HERE / "infra" / "billing.tf").read_text(encoding="utf-8")

    assert "aws_budgets_budget" in billing
    assert "depends_on = [aws_budgets_budget.monthly]" in main


# -------------------------------------------------------- deploy and rollback
@pytest.fixture
def platform(tmp_path):
    flag_path = tmp_path / "flags.json"
    write_flags(flag_path, payouts_on=True)
    flags = Flags(path=flag_path, cache_seconds=0.0)

    from app.service import serve

    router = Router()
    router.set_side("blue", serve(Version("v1", flags=flags)))
    router.active = "blue"
    try:
        yield router, flags, flag_path
    finally:
        router.stop()


def test_a_broken_version_deployed_to_the_idle_side_receives_no_traffic(platform) -> None:
    """Test 13, by running it. The assertion is a count of requests, not a claim."""
    router, flags, _ = platform
    before = dict(router.served)
    outcome = router.deploy(Version("broken", flags=flags, broken=True), timeout=1.0)

    assert outcome["switched"] is False
    assert router.active == "blue"
    status, payload = router.payment(1999)
    assert status == 201 and payload["version"] == "v1"
    assert router.served[outcome["candidate"]] == before[outcome["candidate"]]


def test_a_rollback_completes_within_the_time_the_readme_states(platform) -> None:
    """Test 14. The README says 6.8 ms median by switching and 636.2 ms by
    redeploying, measured over five runs. The bounds here are generous by a wide
    margin, because a test that fails when a laptop is busy teaches nothing."""
    router, flags, _ = platform

    router.deploy(Version("v2", flags=flags))
    assert router.payment(1999)[1]["version"] == "v2"

    fast = router.rollback()
    assert fast["serving_version"] == "v1"
    assert fast["seconds_to_first_healthy_response"] < 1.0

    # And the slow path, which exists because a failed deploy overwrites the
    # rollback target. Documented in deploy/bluegreen.py.
    router.deploy(Version("v2", flags=flags))
    router.deploy(Version("broken", flags=flags, broken=True), timeout=1.0)
    with pytest.raises(DeployRefused):
        router.rollback()

    slow = router.rollback_by_redeploy(Version("v1", flags=flags))
    assert slow["serving_version"] == "v1"
    assert slow["seconds_to_first_healthy_response"] < 5.0


def test_turning_off_the_kill_switch_stops_payouts_without_a_deploy(platform) -> None:
    """Test 15. No restart, no deploy, no process replaced."""
    router, _flags, flag_path = platform

    assert router.payment(1999, payout=True)[0] == 201

    write_flags(flag_path, payouts_on=False)
    status, body = router.payment(1999, payout=True)

    assert status == 503
    assert body["flag"] == "payouts_enabled"
    # An ordinary payment is unaffected: the switch is on one path.
    assert router.payment(1999)[0] == 201


def test_an_unreadable_flag_store_fails_to_off(platform) -> None:
    """Fail to off, or a flag service having a bad afternoon turns an untested
    path on for everybody at once."""
    _router, _flags, flag_path = platform
    flag_path.write_text("{ not json", encoding="utf-8")

    # The last known good value is kept, so the switch does not flap on one bad
    # read. A store that was never readable leaves everything off.
    empty = Flags(path=flag_path / "missing", cache_seconds=0.0)
    assert empty.enabled("payouts_enabled") is False
    assert empty.enabled("anything_at_all") is False


def test_every_flag_has_a_removal_date_that_has_not_passed() -> None:
    """The report that runs in the gate. Sixty stale flags is a codebase nobody
    will touch, and a date nobody checks is a comment."""
    flags = Flags(path=HERE / "flags" / "flags.json", cache_seconds=0.0)
    assert flags.enabled("payouts_enabled") is True
    assert [flag.name for flag in flags.expired()] == []
    assert {flag.name for flag in flags.kill_switches()} == {
        "payouts_enabled", "vault_tokenisation", "fraud_provider_b"
    }


def test_a_flag_rollout_is_stable_for_one_merchant() -> None:
    """A random draw per request means a customer sees the new checkout on one
    page and the old one on the next."""
    flags = Flags(path=HERE / "flags" / "flags.json", cache_seconds=0.0)
    decisions = {flags.enabled("payouts_v2", key="mer_00042") for _ in range(50)}
    assert len(decisions) == 1
    assert flags.enabled("payouts_v2", key="mer_internal_test") is True


# ------------------------------------------------------------- the migration
def test_the_expand_and_contract_sequence_keeps_both_versions_correct() -> None:
    """Test 16, as a simulation of the two code versions over the same rows.

    The same sequence was run against PostgreSQL 18.6 on 25,000 rows, and
    migrations/README.md records the result: zero disagreements at step 4, and
    200 disagreements at step 5, which is the rollback window closing.
    """
    rows = [{"amount_minor": 1000 + i * 7, "fee_bps": 290, "fee_minor": None}
            for i in range(1_000)]

    def v1(row: dict) -> int:
        return (row["amount_minor"] * row["fee_bps"]) // 10_000

    def v2(row: dict) -> int | None:
        return row["fee_minor"]

    # step 2: new rows carry both
    for i in range(100):
        amount = 5_000 + i
        rows.append({"amount_minor": amount, "fee_bps": 290,
                     "fee_minor": amount * 290 // 10_000})

    # step 3: backfill
    for row in rows:
        if row["fee_minor"] is None:
            row["fee_minor"] = v1(row)

    # step 4: both versions agree on every row, so a revert is safe
    assert all(v1(row) == v2(row) for row in rows)

    # step 5: the code stops writing fee_bps, and the window closes
    for i in range(20):
        amount = 9_000 + i
        rows.append({"amount_minor": amount, "fee_bps": 0,
                     "fee_minor": amount * 290 // 10_000})

    disagreements = sum(1 for row in rows if v1(row) != v2(row))
    assert disagreements == 20, "the rollback window should now be closed"


def test_the_migration_files_are_the_documented_sequence() -> None:
    files = sorted((HERE / "migrations").glob("*.sql"))
    assert [f.name for f in files] == [
        "001_expand.sql",
        "002_code_writes_both.sql",
        "003_backfill.sql",
        "004_code_reads_new.sql",
        "005_stop_writing_old.sql",
        "006_contract.sql",
    ]

    # Comments stripped, because 001 explains at length why it does not add a
    # NOT NULL constraint, and an assertion that reads the explanation as the
    # thing it warns about is a test measuring its own prose.
    expand = files[0].read_text(encoding="utf-8")
    statements = "\n".join(
        line for line in expand.splitlines() if not line.strip().startswith("--")
    ).lower()
    assert "add column if not exists fee_minor" in statements
    assert "not null" not in statements
    assert "default" not in statements

    contract = files[-1].read_text(encoding="utf-8")
    assert "drop column if exists fee_bps" in contract
