"""The merge gate, timed step by step.

    python -m ship.gate                      # with whatever is installed here
    python -m ship.gate --python path/to/python   # with the dev tools installed

A gate nobody waits for is a gate people work around, so its duration is a design
constraint rather than a detail. The way to make one faster is to time it and look
at the largest number, which is almost never the tests.

The finding this repository kept: **process startup, not work.** Checking twenty
files by launching twenty interpreters took 9.63 s; the same twenty files in one
interpreter took 0.61 s. Nothing was removed and nothing was relaxed. That single
change took a gate from 15.97 s to 6.95 s, and both numbers are reproduced by the
first two rows below.

Steps run in order of how fast they fail. Lint before types, types before tests,
tests before anything that builds an image: a gate that takes four minutes to
tell you about a missing comma is a gate that gets skipped.
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
SOURCES = sorted(
    p for p in HERE.rglob("*.py")
    if "__pycache__" not in p.parts and ".venv" not in p.parts
)


@dataclass
class Step:
    name: str
    seconds: float
    exit_code: int | None       # None when the tool is not installed
    note: str = ""

    @property
    def status(self) -> str:
        if self.exit_code is None:
            return "not installed"
        return "pass" if self.exit_code == 0 else "FAIL"


def run(command: list[str], cwd: Path = HERE) -> tuple[float, int]:
    started = time.perf_counter()
    result = subprocess.run(command, cwd=cwd, capture_output=True, text=True, check=False)
    return time.perf_counter() - started, result.returncode


def has_module(python: str, module: str) -> bool:
    _, code = run([python, "-c", f"import {module}"])
    return code == 0


def gate(python: str = sys.executable) -> list[Step]:
    steps: list[Step] = []
    files = [str(p.relative_to(HERE)) for p in SOURCES]

    # 1. The slow way, kept on purpose. One interpreter per file.
    started = time.perf_counter()
    worst = 0
    for name in files:
        _, code = run([python, "-m", "py_compile", name])
        worst = max(worst, code)
    steps.append(
        Step("syntax check, one process per file", time.perf_counter() - started, worst,
             f"{len(files)} interpreters started")
    )

    # 2. The same work, one process.
    seconds, code = run([python, "-m", "py_compile", *files])
    steps.append(
        Step("syntax check, one process", seconds, code, "identical checks, one interpreter")
    )

    # 3. Everything imports. Catches a circular import, which no linter will.
    modules = [
        "app.config", "app.flags", "app.health", "app.service",
        "deploy.bluegreen", "ship.image", "ship.cost",
    ]
    seconds, code = run([python, "-c", "import " + ", ".join(modules)])
    steps.append(Step("imports resolve", seconds, code, f"{len(modules)} modules"))

    # 4. Lint, if it is here.
    if has_module(python, "ruff"):
        seconds, code = run([python, "-m", "ruff", "check", "."])
        steps.append(Step("lint", seconds, code))
    else:
        steps.append(Step("lint", 0.0, None, "pip install ruff"))

    # 5. Types.
    if has_module(python, "mypy"):
        seconds, code = run([python, "-m", "mypy", "app", "deploy", "ship"])
        steps.append(Step("type check", seconds, code))
    else:
        steps.append(Step("type check", 0.0, None, "pip install mypy"))

    # 6. Tests.
    if has_module(python, "pytest"):
        seconds, code = run([python, "-m", "pytest", "-q", "-p", "no:cacheprovider"])
        steps.append(Step("unit tests", seconds, code))
    else:
        steps.append(Step("unit tests", 0.0, None, "pip install pytest"))

    return steps


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--python", default=sys.executable,
        help="an interpreter with the dev tools installed, if not this one",
    )
    arguments = parser.parse_args()
    python = shutil.which(arguments.python) or arguments.python

    steps = gate(python)
    width = max(len(s.name) for s in steps)

    print(f"merge gate, timed with {python}\n")
    total = 0.0
    for step in steps:
        total += step.seconds
        shown = f"{step.seconds:6.2f} s" if step.exit_code is not None else "     -  "
        print(f"   {step.name:<{width}}  {shown}  {step.status:<13} {step.note}")
    print(f"   {'total':<{width}}  {total:6.2f} s")

    per_file = next(s for s in steps if "per file" in s.name)
    single = next(s for s in steps if s.name == "syntax check, one process")
    if single.seconds > 0:
        saved = per_file.seconds - single.seconds
        print(f"\nOne process instead of {len(SOURCES)} saves {saved:.2f} s, which is "
              f"{per_file.seconds / single.seconds:.0f}x on that step alone.")
        print("Same files, same checks, same result. Startup, not work.")


if __name__ == "__main__":
    main()
