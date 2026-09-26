"""The level's own tests, run against this repository.

Nine requirements, and the interesting thing about them is that they are tests of
the repository rather than of any code in it: whether every problem states its
complexity, whether the log has the failures in it, whether each exercise says what
was skipped. The discipline is the deliverable, so the discipline is what is
checked.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from tools.check_problems import (
    PATTERNS,
    check,
    problems,
    redo_entries,
)

HERE = Path(__file__).resolve().parent.parent


def test_there_are_forty_problems_in_eight_patterns() -> None:
    found = problems()
    assert len(found) == 40

    per_pattern: dict[str, int] = {}
    for problem in found:
        per_pattern[problem.path.parent.name] = per_pattern.get(problem.path.parent.name, 0) + 1
    assert len(per_pattern) == 8
    assert set(per_pattern.values()) == {5}


def test_the_repository_passes_its_own_checker() -> None:
    """Tests 1 to 3 and 8, in one call, because the checker is the thing that runs
    in a gate rather than this test."""
    failures = check()
    assert failures == [], "\n".join(failures)


def test_every_problem_names_one_of_the_eight_patterns() -> None:
    for problem in problems():
        header = problem.text.split('"""')[1]
        named = re.search(r"^Pattern:\s+(.+)$", header, re.MULTILINE).group(1).lower()
        assert any(named.startswith(pattern) for pattern in PATTERNS), named


def test_every_problem_records_a_first_instinct_of_some_length() -> None:
    """The line that is easiest to leave blank and the reason the repository is
    worth showing: what you reached for before you reached for the right thing."""
    for problem in problems():
        header = problem.text.split('"""')[1]
        instinct = re.search(r"^First instinct:\s*(.+)$", header, re.MULTILINE).group(1)
        assert len(instinct.strip()) > 20, f"{problem.name}: {instinct!r}"


def test_the_log_contains_every_problem_including_the_ones_that_went_wrong() -> None:
    log = (HERE / "log" / "LOG.md").read_text(encoding="utf-8")
    for problem in problems():
        assert problem.name in log, f"{problem.name} is not in the log"

    wrong = [p for p in problems() if "wrong first" in p.text.split('"""')[1]]
    assert len(wrong) >= 5, "a log with no failures in it is not an honest log"


def test_every_problem_that_went_wrong_is_on_the_redo_list() -> None:
    wrong = {p.name for p in problems() if "wrong first" in p.text.split('"""')[1]}
    listed = {redo.name for redo in redo_entries()}
    assert wrong <= listed, f"missing from redo.md: {sorted(wrong - listed)}"


def test_the_redo_list_is_honest_about_the_second_attempts() -> None:
    """The level asks for two dated attempts per redo. These have one, the second is
    scheduled, and `--require-returns` fails the build until it happens.

    This test asserts the shape rather than the completion, and the README says so
    plainly. Asserting completion here would mean putting a date in the file that
    nothing happened on.
    """
    entries = redo_entries()
    assert entries, "the redo list is empty, which would mean nothing ever went wrong"
    for redo in entries:
        assert re.fullmatch(r"\d{4}-\d{2}-\d{2}", redo.first_attempt)
        assert re.fullmatch(r"\d{4}-\d{2}-\d{2}", redo.return_by)
        assert redo.return_by > redo.first_attempt

    outstanding = [redo for redo in entries if not redo.done]
    strict = check(require_returns=True)
    assert len(strict) == len(outstanding), (
        "the strict check should fail for exactly the outstanding redos"
    )


def test_each_exercise_has_a_submission_note_that_says_what_was_skipped() -> None:
    directories = [
        d for d in sorted((HERE / "exercises").iterdir())
        if d.is_dir() and d.name != "__pycache__"
    ]
    assert len(directories) == 4

    for directory in directories:
        note = (directory / "NOTES.md").read_text(encoding="utf-8").lower()
        assert "skipped" in note
        assert "next" in note


def test_the_api_exercise_sets_a_timeout_and_retries_safely() -> None:
    """Tests 6 and 7 of the level, asserted against the code rather than the prose."""
    client = (HERE / "exercises" / "api_integration" / "client.py").read_text(encoding="utf-8")
    assert "CONNECT_TIMEOUT_SECONDS" in client
    assert "READ_TIMEOUT_SECONDS" in client
    assert "connect_timeout=CONNECT_TIMEOUT_SECONDS" in client
    assert "Idempotency-Key" in client
    assert "rng.uniform" in client        # jitter, not a fixed interval

    tests = (HERE / "exercises" / "api_integration" / "test_client.py").read_text(
        encoding="utf-8"
    )
    # The specific test the level asks for, by the property it asserts.
    assert "charge_count == 1" in tests
    assert "test_a_retried_timeout_creates_one_charge" in tests


def test_every_behavioural_story_has_a_number_and_a_change() -> None:
    text = (HERE / "stories" / "STAR.md").read_text(encoding="utf-8")
    stories = [s for s in text.split("\n## ") if s.startswith(("1.", "2.", "3.", "4.", "5."))]
    assert len(stories) == 5

    for story in stories:
        title = story.splitlines()[0]
        assert re.search(r"\d", story), f"{title}: no number in the story"
        assert "What changed afterwards" in story or "changed afterwards" in story, (
            f"{title}: no change recorded, which is the half people leave off"
        )


@pytest.mark.parametrize("document", ["log/LOG.md", "log/redo.md", "stories/STAR.md"])
def test_the_documents_say_what_they_cannot_evidence(document: str) -> None:
    """The three places where this repository is a reference solution rather than a
    record of practice. Each one has to say so, or it is pretending."""
    text = (HERE / document).read_text(encoding="utf-8").lower()
    assert any(
        phrase in text
        for phrase in ("not happened", "not yet", "must have real", "they are mine")
    ), f"{document} does not state its own limits"
