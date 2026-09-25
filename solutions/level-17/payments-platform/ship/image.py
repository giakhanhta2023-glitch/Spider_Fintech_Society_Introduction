"""What actually goes in the image, measured rather than guessed.

    python -m ship.image

There is no Docker on the machine this solution was written on, so this measures
the thing Docker would be copying: the installed dependency tree. A Python
image's size is its base layer plus site-packages plus the application, and the
application is a few hundred kilobytes. The interesting number is what the
dependency tree weighs with and without the tools that must never ship.

It builds two virtual environments, installs the runtime requirements into one
and the runtime plus development requirements into the other, and reports size,
file count and install time for each. The comparison is the lesson: a single
stage Dockerfile that runs `pip install -r requirements-dev.txt` ships a type
checker to production.

Three minutes, a network connection, and a few hundred megabytes of temporary
space. Nothing is written outside the temporary directory.
"""

from __future__ import annotations

import subprocess
import tempfile
import time
import venv
from pathlib import Path

# The service needs these to serve a request.
RUNTIME = ["fastapi", "uvicorn", "psycopg[binary]", "redis", "prometheus-client"]

# These make the service correct before it ships, and none of them runs in
# production. Every one is a file in the image if a single stage build installs
# one requirements file.
DEVELOPMENT = ["pytest", "pytest-cov", "hypothesis", "mypy", "ruff"]


def tree(path: Path) -> tuple[float, int]:
    """Megabytes and file count, which are the two numbers a layer costs."""
    total = 0
    files = 0
    for item in path.rglob("*"):
        if item.is_file():
            try:
                total += item.stat().st_size
            except OSError:
                continue
            files += 1
    return total / 1024 / 1024, files


def make_environment(root: Path, name: str) -> Path:
    target = root / name
    venv.create(target, with_pip=True)
    return target


def python_in(environment: Path) -> Path:
    for candidate in ("Scripts/python.exe", "bin/python"):
        path = environment / candidate
        if path.exists():
            return path
    raise FileNotFoundError(f"no interpreter inside {environment}")


def install(environment: Path, packages: list[str], no_cache: bool = False) -> float:
    arguments = [str(python_in(environment)), "-m", "pip", "install", "--quiet"]
    if no_cache:
        arguments.append("--no-cache-dir")
    started = time.perf_counter()
    result = subprocess.run(arguments + packages, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        raise RuntimeError(f"pip failed: {result.stderr[-400:]}")
    return time.perf_counter() - started


def measure() -> dict:
    with tempfile.TemporaryDirectory(prefix="image-") as temporary:
        root = Path(temporary)

        runtime_env = make_environment(root, "runtime")
        empty_mb, empty_files = tree(runtime_env)

        runtime_seconds = install(runtime_env, RUNTIME)
        runtime_mb, runtime_files = tree(runtime_env)

        development_seconds = install(runtime_env, DEVELOPMENT)
        both_mb, both_files = tree(runtime_env)

        return {
            "empty_mb": empty_mb,
            "empty_files": empty_files,
            "runtime_mb": runtime_mb,
            "runtime_files": runtime_files,
            "runtime_install_seconds": runtime_seconds,
            "both_mb": both_mb,
            "both_files": both_files,
            "development_install_seconds": development_seconds,
            "wasted_mb": both_mb - runtime_mb,
            "wasted_files": both_files - runtime_files,
            "wasted_share": (both_mb - runtime_mb) / runtime_mb,
            "runtime_packages": RUNTIME,
            "development_packages": DEVELOPMENT,
        }


def main() -> None:
    print("measuring what a single stage build would ship. Takes a few minutes.\n")
    r = measure()

    print("what goes in the image")
    print(f"   an empty virtual environment      {r['empty_mb']:7.1f} MB  "
          f"{r['empty_files']:6,} files")
    print(f"   plus the runtime dependencies     {r['runtime_mb']:7.1f} MB  "
          f"{r['runtime_files']:6,} files   installed in {r['runtime_install_seconds']:5.1f} s")
    print(f"   plus the development tooling      {r['both_mb']:7.1f} MB  "
          f"{r['both_files']:6,} files   installed in "
          f"{r['development_install_seconds']:5.1f} s")
    print()
    print(f"   shipping the tooling costs        {r['wasted_mb']:7.1f} MB  "
          f"{r['wasted_files']:6,} files   "
          f"({r['wasted_share']:.0%} more than the runtime needs)")
    print()
    print("None of it executes in production. A multi stage build leaves it in the")
    print("stage that ran the tests, which is discarded.")
    print()
    print(f"   runtime:     {', '.join(r['runtime_packages'])}")
    print(f"   development: {', '.join(r['development_packages'])}")


if __name__ == "__main__":
    main()
