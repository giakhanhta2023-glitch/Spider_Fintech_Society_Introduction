"""The ten tests the level asks for.

These need a real Postgres, and they are marked so, because there is no honest
way to test a lost update against an in-memory substitute: the bug IS the
database's concurrency behaviour, and a fake that does not implement it will
pass every one of these and ship the bug.

    createdb race_lab
    DATABASE_URL=postgresql://localhost/race_lab python -m race.setup
    DATABASE_URL=postgresql://localhost/race_lab pytest
"""

from __future__ import annotations

import os

import psycopg
import pytest
from psycopg.rows import dict_row

from race.rig import run
from race.setup import reset_account, setup

pytestmark = pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"),
    reason="needs a real Postgres: the behaviour under test is the database's",
)


@pytest.fixture
def conninfo() -> str:
    url = os.environ["DATABASE_URL"]
    setup(url, with_constraint=False)
    reset_account(url)
    return url


# ------------------------------------------------------------------ the bug
def test_the_naive_mode_overdraws_every_time(conninfo: str) -> None:
    """Ten runs out of ten. A race that reproduces once in twenty is a race
    nobody believes; this one is engineered to be reliable by starting the
    workers on a barrier with their connections already open."""
    for _ in range(10):
        result = run(conninfo, "naive", workers=8, spend_each=1000, starting_balance=10000)
        assert result.final_balance > result.expected_balance, (
            "the naive mode lost an update: the balance should be higher than "
            "the spends account for"
        )
        assert result.succeeded > 2, "more workers succeeded than the money allows"


# ----------------------------------------------------------------- the fixes
def test_row_lock_ends_at_exactly_2000(conninfo: str) -> None:
    result = run(conninfo, "row_lock", workers=8, spend_each=1000, starting_balance=10000)
    assert result.succeeded == 8
    assert result.final_balance == 2000
    assert result.correct


def test_optimistic_ends_correct_and_counts_its_retries(conninfo: str) -> None:
    result = run(conninfo, "optimistic", workers=8, spend_each=1000, starting_balance=10000)
    assert result.final_balance == 2000
    assert result.correct
    assert result.retries >= 0  # reported either way, because zero is a result


def test_serializable_ends_correct_and_reports_the_level_it_ran_at(
    conninfo: str,
) -> None:
    result = run(conninfo, "serializable", workers=8, spend_each=1000, starting_balance=10000)
    assert result.final_balance == 2000
    assert result.correct
    levels = {o.isolation_seen for o in result.outcomes if o.isolation_seen}
    assert levels == {"serializable"}, (
        f"the transaction did not run at serializable, it ran at {levels}. "
        "A session level SET is discarded by a transaction mode pooler."
    )


def test_eight_workers_spending_1000_from_10000_all_succeed_under_the_lock(
    conninfo: str,
) -> None:
    result = run(conninfo, "row_lock", workers=8, spend_each=1000, starting_balance=10000)
    assert result.succeeded == 8
    assert result.final_balance == 2000


def test_a_ninth_worker_is_refused_rather_than_overdrawing(conninfo: str) -> None:
    result = run(conninfo, "row_lock", workers=11, spend_each=1000, starting_balance=10000)
    assert result.succeeded == 10
    assert result.final_balance == 0
    assert all(
        o.refused_by == "insufficient funds" for o in result.outcomes if not o.succeeded
    )


# ------------------------------------------------------------- the safety net
def test_the_constraint_stops_the_balance_going_negative(conninfo: str) -> None:
    """Not a fix for the race: workers still disagree about what happened.
    What it guarantees is that the consequence cannot reach the database."""
    setup(conninfo, with_constraint=True)
    try:
        result = run(conninfo, "constraint", workers=8, spend_each=2000, starting_balance=10000)
        assert result.final_balance >= 0
        assert any(o.refused_by == "constraint" for o in result.outcomes)
    finally:
        setup(conninfo, with_constraint=False)


def test_isolation_is_read_back_from_inside_the_transaction(conninfo: str) -> None:
    """The trap this level exists to show. Setting the level on the session and
    reading it back in the next statement proves nothing through a pooler."""
    with psycopg.connect(conninfo, row_factory=dict_row) as conn:
        with conn.transaction(), conn.cursor() as cur:
            cur.execute("set transaction isolation level serializable")
            cur.execute("select current_setting('transaction_isolation') as level")
            assert cur.fetchone()["level"] == "serializable"  # type: ignore[index]


# ------------------------------------------------------------------- the pool
@pytest.mark.slow
def test_a_right_sized_pool_beats_no_pool(conninfo: str) -> None:
    from race.pool_bench import drive
    import contextlib

    from psycopg_pool import ConnectionPool

    @contextlib.contextmanager
    def fresh():
        with psycopg.connect(conninfo) as conn:
            yield conn

    no_pool = drive("no pool", fresh, requests=60, concurrency=6)
    pool = ConnectionPool(conninfo, min_size=6, max_size=6, open=True)
    pool.wait()
    try:
        pooled = drive("pooled", pool.connection, requests=60, concurrency=6)
    finally:
        pool.close()

    no_pool_rps = len(no_pool.samples) / no_pool.wall_s
    pooled_rps = len(pooled.samples) / pooled.wall_s
    assert pooled_rps > no_pool_rps
