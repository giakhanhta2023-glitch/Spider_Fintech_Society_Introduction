"""The checker that keeps the repository honest.

    python -m tools.check_problems

Four of the level's own tests are enforced here rather than trusted:

  every problem file states a time and a space complexity
  every problem file names one of the eight patterns
  every problem file records a first instinct and an outcome
  every problem in the log exists, and every problem file is in the log

It is a linter for the discipline rather than for the code, and it exists because
the parts of this repository that are easiest to skip are the parts that make it
worth showing: the complexity line, the first instinct, and the log entry for the
attempt that failed.
"""

from __future__ import annotations

import re
import sys
from dataclasses import dataclass
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent

PATTERNS = {
    "hash map", "two pointers", "sliding window", "heap",
    "sorting", "prefix sums", "graphs", "intervals",
}

# The eight directories, one per pattern, so a file cannot be filed under the
# wrong one without the name disagreeing with its own header.
DIRECTORY_PATTERN = {
    "hash_map": "hash map",
    "two_pointers": "two pointers",
    "sliding_window": "sliding window",
    "heap": "heap",
    "sorting": "sorting",
    "prefix_sums": "prefix sums",
    "graphs": "graphs",
    "intervals": "intervals",
}

TIME = re.compile(r"^Time:\s+(O\(.+\)|.+)$", re.MULTILINE)
SPACE = re.compile(r"^Space:\s+(O\(.+\)|.+)$", re.MULTILINE)
PATTERN = re.compile(r"^Pattern:\s+(.+)$", re.MULTILINE)
INSTINCT = re.compile(r"^First instinct:\s*(.+)$", re.MULTILINE)
OUTCOME = re.compile(r"^Outcome:\s*(.+)$", re.MULTILINE)
HAS_TEST = re.compile(r"^def test_", re.MULTILINE)


@dataclass
class Problem:
    path: Path
    text: str

    @property
    def name(self) -> str:
        return f"{self.path.parent.name}/{self.path.stem}"

    def problems(self) -> list[str]:
        found: list[str] = []
        docstring = self.text.split('"""')
        header = docstring[1] if len(docstring) > 1 else ""

        if not TIME.search(header):
            found.append("no Time: line in the docstring")
        if not SPACE.search(header):
            found.append("no Space: line in the docstring")

        pattern_match = PATTERN.search(header)
        if not pattern_match:
            found.append("no Pattern: line in the docstring")
        else:
            named = pattern_match.group(1).strip().lower()
            # "sorting with a composite key" counts as sorting: the pattern has to
            # be one of the eight, and saying more about it is an improvement.
            if not any(named.startswith(p) for p in PATTERNS):
                found.append(f"pattern {named!r} is not one of the eight")
            expected = DIRECTORY_PATTERN.get(self.path.parent.name)
            if expected and not named.startswith(expected):
                found.append(f"filed under {self.path.parent.name} and claims {named!r}")

        if not INSTINCT.search(header):
            found.append("no First instinct: line, which is the point of the exercise")
        if not OUTCOME.search(header):
            found.append("no Outcome: line")
        if not HAS_TEST.search(self.text):
            found.append("no test in the file")

        return found


def problems() -> list[Problem]:
    files = sorted(HERE.glob("problems/*/[0-9][0-9]_*.py"))
    return [Problem(path=p, text=p.read_text(encoding="utf-8")) for p in files]


def logged_names() -> set[str]:
    log = (HERE / "log" / "LOG.md").read_text(encoding="utf-8")
    return set(re.findall(r"\|\s*([a-z_]+/[0-9]{2}_[a-z0-9_]+)\s*\|", log))


@dataclass
class Redo:
    name: str
    first_attempt: str
    return_by: str
    returned: str

    @property
    def done(self) -> bool:
        """A date in the `returned` column, and nothing else counts.

        The first version of this counted any two dates anywhere in the row, which
        the `return by` column satisfied on its own: the check reported green while
        every second attempt was still outstanding. A check with a loophole is
        worse than no check.
        """
        return bool(re.fullmatch(r"\d{4}-\d{2}-\d{2}", self.returned.strip()))


def redo_entries() -> list[Redo]:
    """The redo table, read column by column rather than as a bag of dates."""
    text = (HERE / "log" / "redo.md").read_text(encoding="utf-8")
    entries: list[Redo] = []
    for line in text.splitlines():
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if len(cells) == 5 and re.fullmatch(r"[a-z_]+/[0-9]{2}_[a-z0-9_]+", cells[0]):
            entries.append(
                Redo(
                    name=cells[0],
                    first_attempt=cells[1],
                    return_by=cells[3],
                    returned=cells[4],
                )
            )
    return entries


def exercise_notes() -> list[str]:
    missing: list[str] = []
    for directory in sorted((HERE / "exercises").iterdir()):
        if not directory.is_dir() or directory.name == "__pycache__":
            continue
        note = directory / "NOTES.md"
        if not note.exists():
            missing.append(f"{directory.name} has no NOTES.md")
            continue
        text = note.read_text(encoding="utf-8").lower()
        if "skipped" not in text:
            missing.append(f"{directory.name}/NOTES.md does not say what was skipped")
        if "next" not in text:
            missing.append(f"{directory.name}/NOTES.md does not say what is next")
    return missing


def check(require_returns: bool = False) -> list[str]:
    """Structural failures. Outstanding redos are failures only on request.

    `require_returns` is the switch to put in your own pipeline once this
    repository is yours: it turns "I have not gone back to the ones I got wrong"
    from a note into a red build, which is the only version of that promise that
    survives a busy week.
    """
    failures: list[str] = []

    found = problems()
    if len(found) < 40:
        failures.append(f"{len(found)} problems, and the level asks for forty")

    for problem in found:
        for complaint in problem.problems():
            failures.append(f"{problem.name}: {complaint}")

    logged = logged_names()
    names = {p.name for p in found}
    for name in sorted(names - logged):
        failures.append(f"{name}: solved and not in the log")
    for name in sorted(logged - names):
        failures.append(f"{name}: in the log and no such file")

    for redo in redo_entries():
        if redo.name not in names:
            failures.append(f"{redo.name}: on the redo list and no such file")
        elif require_returns and not redo.done:
            failures.append(
                f"{redo.name}: first attempted {redo.first_attempt}, due back by "
                f"{redo.return_by}, returned {redo.returned!r}. A redo is evidence "
                "only once the second attempt has a date"
            )

    failures.extend(exercise_notes())
    return failures


def main() -> None:
    require_returns = "--require-returns" in sys.argv
    found = problems()
    failures = check(require_returns=require_returns)

    by_pattern: dict[str, int] = {}
    for problem in found:
        by_pattern[problem.path.parent.name] = by_pattern.get(problem.path.parent.name, 0) + 1

    print(f"{len(found)} problems across {len(by_pattern)} patterns")
    for directory in sorted(by_pattern):
        print(f"   {directory:16} {by_pattern[directory]}")

    if failures:
        print(f"\n{len(failures)} problem(s) with the repository itself:\n")
        for failure in failures:
            print(f"   {failure}")
        sys.exit(1)

    outstanding = [redo for redo in redo_entries() if not redo.done]
    if outstanding:
        print(f"\n{len(outstanding)} redo(s) outstanding, which is work rather than a defect:")
        for redo in outstanding:
            print(f"   {redo.name:52} due back by {redo.return_by}")
        print("\n   Run with --require-returns to make these fail the build, which is")
        print("   what to do once this repository is yours.")

    print("\nEvery file states its complexity, names its pattern, records a first")
    print("instinct, has a test, and appears in the log.")


if __name__ == "__main__":
    main()
