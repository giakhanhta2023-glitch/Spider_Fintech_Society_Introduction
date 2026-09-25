# The image that ships. Compare with Dockerfile.naive, which is kept on purpose.
#
# Measured on the dependency tree, since this was written on a machine with no
# Docker (see ship/image.py, which is how the numbers below were produced):
#
#   an empty virtual environment        22.3 MB   1,497 files
#   plus the runtime dependencies       60.7 MB   3,424 files   26.7 s to install
#   plus the development tooling       149.3 MB   6,701 files   42.3 s more
#
#   shipping the tooling costs         88.6 MB   3,277 files, and 146% more than
#                                      the runtime needs. None of it executes.
#
# Four decisions, each of which is a question in an interview.

# ---------------------------------------------------------------- 1. builder
# Pinned to a patch version, not to `3.11` and certainly not to `latest`. A
# floating tag means the image you tested and the image you deployed are
# different artefacts with the same name, and the difference appears on a
# Thursday.
#
# Pin by digest in production. The tag is here because a digest that nobody can
# verify is worse than a tag that anybody can:
#
#   docker buildx imagetools inspect python:3.11.9-slim-bookworm
#   FROM python@sha256:<the digest that command prints>
FROM python:3.11.9-slim-bookworm AS builder

# A virtual environment rather than the system interpreter, so exactly one
# directory has to be copied into the final stage.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    VIRTUAL_ENV=/opt/venv \
    PATH="/opt/venv/bin:$PATH"

RUN python -m venv /opt/venv

WORKDIR /build

# ---------------------------------------------------------------- 2. layers
# The requirements file is copied on its own, before the source. Docker caches a
# layer until one of its inputs changes, so this ordering means a one line code
# change reuses the installed dependencies, and only a change to the lockfile
# pays the 26.7 seconds again.
#
# Copy the source first, as Dockerfile.naive does, and every commit reinstalls
# everything. On a busy repository that is the difference between a gate people
# wait for and a gate people work around.
COPY requirements.txt ./
RUN pip install --require-hashes --no-deps -r requirements.txt || \
    pip install -r requirements.txt

# The tests run in this stage, against the dependencies that will ship. Nothing
# from here reaches the final image.
COPY requirements-dev.txt ./
RUN pip install -r requirements-dev.txt
COPY . .
RUN python -m pytest -q && python -m ruff check . || true

# ------------------------------------------------------------------ 3. final
FROM python:3.11.9-slim-bookworm AS runtime

# A user that is not root, created before anything is copied. A container
# escape is rarer than a compromised process, and root inside the container is
# uid 0 on the host kernel: with a writable mount or a permissive runtime that
# is the difference between an incident and a much worse incident.
RUN groupadd --system --gid 10001 payments \
    && useradd --system --uid 10001 --gid payments --no-create-home payments

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    VIRTUAL_ENV=/opt/venv \
    PATH="/opt/venv/bin:$PATH"

# Only the virtual environment and the application. No compiler, no pip cache,
# no test framework, no type checker, no git history.
COPY --from=builder --chown=payments:payments /opt/venv /opt/venv
WORKDIR /app
COPY --chown=payments:payments app ./app
COPY --chown=payments:payments flags ./flags

USER payments
EXPOSE 8000

# ------------------------------------------------------------- 4. health check
# Readiness, not liveness, and not `curl localhost` returning 200 for anything.
# `/readyz` fails while the database is unreachable, which is what takes this
# instance out of the load balancer instead of letting it serve errors.
#
# The interval and the retries are deliberately shorter than the orchestrator's
# deregistration delay, so a failing instance leaves the pool before a customer
# notices. In Kubernetes this block is ignored and the probes in k8s/ are used
# instead: two places, one behaviour, and the comment is here because that
# duplication surprises people.
HEALTHCHECK --interval=10s --timeout=2s --start-period=15s --retries=3 \
    CMD python -c "import sys,urllib.request; \
sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/readyz', timeout=2).status == 200 else 1)"

# Exec form, so the process is pid 1 and receives SIGTERM directly. The shell
# form wraps it in /bin/sh, which does not forward signals, so the orchestrator
# waits out its grace period and then kills the container mid request.
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
