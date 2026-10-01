"""The tests for the whole close, which are mostly tests about stopping.

    pytest -q

A pipeline's job is not only to produce the pack. It is to produce nothing at
all when the pack would be wrong, and to tell the difference between "this is
broken" and "this needs a sentence in the commentary". Most of these assert that
distinction, because getting it wrong in either direction is how a close either
never finishes or quietly ships a bad number.
"""

from __future__ import annotations

import shutil

import pytest

from close import run as close_run
from close import stages


@pytest.fixture(scope="module")
def september():
    code, done = close_run.run("2025-09", quiet=True)
    return code, done


def stage(done, name):
    return next(s for s in done if s.name == name)


def test_the_close_completes_and_writes_its_outputs(september):
    code, done = september
    assert code == 0
    assert len(done) == 6
    out = close_run.OUT
    assert (out / "close-2025-09.md").exists()
    assert (out / "waterfall-2025-09.png").exists()


def test_every_stage_reports_a_time(september):
    _, done = september
    assert all(s.milliseconds > 0 for s in done)


def test_the_pack_ties_inside_the_pipeline(september):
    _, done = september
    assert "tie to the ledger +0.00" in stage(done, "build the pack").lines


def test_the_reconciliation_finds_the_credit_note_and_does_not_stop_the_close(september):
    """A break is not a failure. It is a thing somebody has to own."""
    _, done = september
    reconciliation = stage(done, "reconcile billing to the ledger")
    assert not reconciliation.ok, "one month does not agree"
    assert not reconciliation.fatal, "and that must not stop the close"
    breaks = reconciliation.data["breaks"]
    assert list(breaks["month"]) == ["2025-06"]
    assert round(float(breaks["difference"].iloc[0]), 2) == -4820.00


def test_the_document_carries_the_numbers_and_leaves_the_causes(september):
    _, done = september
    text = (close_run.OUT / "close-2025-09.md").read_text(encoding="utf-8")
    assert "3,361,050" in text and "265,989" in text
    assert "TODO: why" in text, "the explanation is a person's job"
    assert "ties to the ledger: +0.00" in text


def test_the_reforecast_runs_every_scenario_and_they_all_balance(september):
    _, done = september
    cases = stage(done, "reforecast").data["cases"]
    assert set(cases) == {"base", "upside", "downside", "stress"}
    assert cases["stress"]["first_draw"] == "2026-09"
    assert cases["base"]["first_draw"] == "never"


def test_a_fatal_stage_stops_everything_after_it(monkeypatch, tmp_path):
    """The property that makes a pipeline safe: it stops, and writes nothing."""
    def broken(month):
        failed = stages.Stage("check the data")
        failed.fail("pretend the ledger will not load")
        return failed

    monkeypatch.setattr(stages, "quality_gates", broken)
    monkeypatch.setattr(close_run, "OUT", tmp_path)
    code, done = close_run.run("2025-09", quiet=True)

    assert code == 1
    assert [s.name for s in done][2:] == [
        "build the pack", "query the detail",
        "reconcile billing to the ledger", "reforecast"]
    assert all(not s.ok for s in done[2:]), "later stages must not run"
    assert not list(tmp_path.glob("close-*.md")), "and nothing may be written"


def test_a_month_the_plan_does_not_cover_is_refused(tmp_path, monkeypatch):
    monkeypatch.setattr(close_run, "OUT", tmp_path)
    code, done = close_run.run("2024-05", quiet=True)
    assert code == 1
    assert stage(done, "check the data").fatal


def test_the_earlier_levels_are_imported_rather_than_copied():
    """If levels 2 and 3 are missing, this level says so rather than drifting."""
    from close import _earlier
    assert all(folder.exists() for folder in _earlier.EARLIER)
    assert _earlier.closepack_pack.__file__.endswith("pack.py")
    assert "fpa-02" in _earlier.closepack_pack.__file__
    assert "fpa-03" in _earlier.model_forecast.__file__
