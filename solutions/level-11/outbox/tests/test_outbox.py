"""The thirteen tests the level asks for."""

from __future__ import annotations

from pathlib import Path

import pytest

from outbox.core import (
    Crash,
    Event,
    IdempotentConsumer,
    Log,
    MemoryStore,
    Publisher,
    UpsertConsumer,
)
from outbox.dlq import RetryingConsumer
from outbox.experiments import batch_sizes, dual_write, partitioning, with_outbox

DATA = Path(__file__).resolve().parents[3].parent / "data" / "level-09-card-events.csv"


def event(i: int, merchant: str = "M1", amount: int = 1_000) -> Event:
    return Event(f"P{i}", "payment.captured", {"merchant_id": merchant, "amount_minor": amount}, f"E{i}")


# ------------------------------------------------------------- dual write
def test_the_dual_write_loses_events_at_about_the_crash_rate() -> None:
    result = dual_write(payments=400, crash_rate=0.05)
    assert result["lost"] > 0
    assert 0.02 < result["lost_share"] < 0.09
    assert result["published"] + result["lost"] == result["payments"]


def test_a_rolled_back_transaction_leaves_no_outbox_row() -> None:
    """The property the whole pattern rests on. If the event could survive a
    rollback, the outbox would be a dual write with extra steps."""
    store = MemoryStore()
    store.begin()
    store.write_business_row("P1", {"amount_minor": 100})
    store.write_outbox(event(1))
    store.rollback()

    assert store.outbox == []
    assert store.business == {}


def test_the_outbox_loses_nothing_and_duplicates_instead() -> None:
    result = with_outbox(payments=400, crash_rate=0.05)
    assert result["lost"] == 0
    assert result["left_unpublished"] == 0
    assert result["duplicated"] > 0, "the injected crash never fired: the experiment measured nothing"


# -------------------------------------------------------------- publisher
def test_the_publisher_leaves_nothing_behind() -> None:
    store, log = MemoryStore(), Log()
    for i in range(250):
        store.begin()
        store.write_outbox(event(i))
        store.commit()

    Publisher(store, log, batch_size=100).drain()

    assert store.unpublished() == []
    assert log.total() == 250


def test_two_publishers_never_send_the_same_row() -> None:
    """skip locked, in memory. A row another worker holds is skipped rather
    than waited for, which is what lets two publishers run at all."""
    store, log = MemoryStore(), Log()
    for i in range(100):
        store.begin()
        store.write_outbox(event(i))
        store.commit()

    one = store.claim(40, "publisher-1")
    two = store.claim(40, "publisher-2")

    assert {r.id for r in one} & {r.id for r in two} == set()
    assert len(one) == len(two) == 40


def test_a_crash_between_sending_and_marking_duplicates_and_loses_nothing() -> None:
    store, log = MemoryStore(), Log()
    for i in range(20):
        store.begin()
        store.write_outbox(event(i))
        store.commit()

    publisher = Publisher(store, log, batch_size=5, crash_between_send_and_mark=1.0)
    with pytest.raises(Crash):
        publisher.run_once()

    # Sent, not marked. The rows are still claimable, so the next round sends
    # them again: at least once, never at most once.
    assert log.total() == 5
    assert len(store.unpublished()) == 20

    publisher.crash_between_send_and_mark = 0.0
    publisher.drain()
    assert store.unpublished() == []
    assert log.total() == 25  # 5 duplicates, 0 losses


# -------------------------------------------------------------- consumers
def test_the_idempotent_consumer_applies_an_event_once() -> None:
    consumer = IdempotentConsumer()
    e = event(1, "M1", 5_000)

    consumer.handle(e)
    consumer.handle(e)
    consumer.handle(e)

    assert consumer.projection.totals["M1"] == 5_000
    assert consumer.applied == 1
    assert consumer.skipped == 2


def test_replaying_the_whole_stream_twice_leaves_the_projection_identical() -> None:
    events = [event(i, f"M{i % 5}", 1_000 + i) for i in range(500)]

    once = IdempotentConsumer()
    for e in events:
        once.handle(e)
    after_one = once.projection.snapshot()

    for e in events:
        once.handle(e)
    after_two = once.projection.snapshot()

    assert after_one == after_two


def test_the_upsert_consumer_needs_no_deduplication_at_all() -> None:
    """Naturally idempotent, because it sets rather than increments. Where the
    work can be written this way it is strictly better: there is no processed
    event table to get wrong."""
    consumer = UpsertConsumer()
    e = event(1, "M1", 7_000)

    for _ in range(50):
        consumer.handle(e)

    assert consumer.snapshot() == {"P1": {"state": "payment.captured", "amount_minor": 7_000}}


def test_a_full_rebuild_from_offset_zero_reproduces_the_projection() -> None:
    events = [event(i, f"M{i % 7}", 500 + i) for i in range(300)]

    original = IdempotentConsumer()
    for e in events:
        original.handle(e)
    expected = original.projection.snapshot()

    rebuilt = IdempotentConsumer()  # truncated projection, offset reset to zero
    for e in events:
        rebuilt.handle(e)

    assert rebuilt.projection.snapshot() == expected


# ----------------------------------------------------------- partitioning
@pytest.mark.skipif(not DATA.exists(), reason=f"stream not found at {DATA}")
def test_partitioning_by_payment_id_gives_zero_out_of_order() -> None:
    by_payment, _ = partitioning(DATA)
    assert by_payment.key == "payment_id"
    assert by_payment.out_of_order == 0
    assert by_payment.payments_affected == 0


@pytest.mark.skipif(not DATA.exists(), reason=f"stream not found at {DATA}")
def test_partitioning_at_random_breaks_about_a_quarter_of_payments() -> None:
    _, at_random = partitioning(DATA)
    assert at_random.out_of_order > 1_000
    assert 0.15 < at_random.share < 0.40


def test_an_order_dependent_consumer_fails_on_the_wrong_key() -> None:
    """A consumer that requires authorise before capture. Same events, two
    orders, and the only difference is which partition they went to."""

    seen: set[str] = set()

    def handle(e: Event) -> None:
        if e.event_type == "capture" and e.aggregate_id not in seen:
            raise ValueError(f"capture for {e.aggregate_id} arrived before its authorisation")
        seen.add(e.aggregate_id)

    in_order = [
        Event("P1", "authorize", {}, "E1"),
        Event("P1", "capture", {}, "E2"),
    ]
    out_of_order = list(reversed(in_order))

    right = RetryingConsumer(handle=handle, max_attempts=1)
    right.consume(in_order)
    assert right.dead_letters == []

    seen.clear()
    wrong = RetryingConsumer(handle=handle, max_attempts=1)
    wrong.consume(out_of_order)
    assert len(wrong.dead_letters) == 1
    assert "before its authorisation" in wrong.dead_letters[0].error


# ------------------------------------------------------------ dead letters
def test_a_poison_event_is_dead_lettered_and_does_not_block_the_partition() -> None:
    applied: list[str] = []

    def handle(e: Event) -> None:
        if e.aggregate_id == "P2":
            raise ValueError("cannot parse this one")
        applied.append(e.aggregate_id)

    consumer = RetryingConsumer(handle=handle, max_attempts=3)
    offset = consumer.consume([event(1), event(2), event(3), event(4)])

    assert applied == ["P1", "P3", "P4"]          # the rest kept flowing
    assert len(consumer.dead_letters) == 1
    assert consumer.dead_letters[0].attempts == 3
    assert consumer.dead_letters[0].offset == 1
    assert offset == 4


def test_replaying_a_dead_letter_after_the_fix_does_not_double_count() -> None:
    projection = IdempotentConsumer()
    broken = {"still": True}

    def handle(e: Event) -> None:
        if broken["still"] and e.aggregate_id == "P2":
            raise ValueError("the bug")
        projection.handle(e)

    consumer = RetryingConsumer(handle=handle, max_attempts=2)
    consumer.consume([event(1, "M1"), event(2, "M1"), event(3, "M1")])

    assert projection.projection.totals["M1"] == 2_000   # P2 never applied
    assert len(consumer.dead_letters) == 1

    broken["still"] = False
    outcome = consumer.replay_dead_letters()

    assert outcome == {"replayed": 1, "still_dead": 0}
    assert projection.projection.totals["M1"] == 3_000

    # And replaying again changes nothing, because the consumer underneath is
    # idempotent. This is the test that says the replay is safe to repeat.
    for e in (event(1, "M1"), event(2, "M1"), event(3, "M1")):
        projection.handle(e)
    assert projection.projection.totals["M1"] == 3_000


# ------------------------------------------------------------ batch sizes
def test_larger_batches_do_fewer_rounds() -> None:
    results = {r["batch_size"]: r for r in batch_sizes(events=2_000)}
    assert results[1]["rounds"] == 2_000
    assert results[500]["rounds"] == 4
    assert results[500]["per_second"] > results[1]["per_second"]
