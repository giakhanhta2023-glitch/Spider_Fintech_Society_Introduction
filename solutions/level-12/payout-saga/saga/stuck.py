"""The query that should always return nothing.

The sweeper handles the known unknowns. This catches the category nobody
planned for: a payout sitting in a perfectly normal state for far too long.
A queue that stopped, a bug that never advances one kind of payout, a bank that
accepts submissions and never settles them.

It is the cheapest safety net in the system and it catches the failures your
careful design did not cover, which by definition are the ones that will
actually happen.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta

from .store import Store

# Alert when anything has been unfinished for longer than this.
#
# Fifteen minutes, and the reason is that it has to be far longer than the
# sweeper's own interval (two minutes) plus a few retries, so a payout that the
# sweeper is about to pick up never pages anybody. Anything still unfinished
# after fifteen minutes has been past the sweeper seven times and is not going
# to resolve itself.
STUCK_AFTER_SECONDS = 15 * 60


@dataclass(frozen=True, slots=True)
class StuckState:
    state: str
    count: int
    oldest_seconds: int


def stuck(store: Store, threshold_seconds: int = STUCK_AFTER_SECONDS) -> list[StuckState]:
    """Group unfinished payouts by state, with the age of the oldest.

    The SQL version, which is what actually runs on a schedule:

        select state, count(*), min(updated_at) as oldest
          from payouts
         where state not in ('paid', 'compensated', 'rejected', 'failed')
           and updated_at < now() - interval '15 minutes'
         group by state;
    """
    cutoff = store.now - timedelta(seconds=threshold_seconds)
    by_state: dict[str, list] = {}
    for payout in store.payouts.values():
        if payout.is_final or payout.updated_at >= cutoff:
            continue
        by_state.setdefault(payout.state, []).append(payout)

    return [
        StuckState(
            state=state,
            count=len(items),
            oldest_seconds=int(
                max((store.now - p.updated_at).total_seconds() for p in items)
            ),
        )
        for state, items in sorted(by_state.items())
    ]


def alert_text(rows: list[StuckState]) -> str | None:
    """What the page says. None when there is nothing to say."""
    if not rows:
        return None
    worst = max(rows, key=lambda r: r.oldest_seconds)
    total = sum(r.count for r in rows)
    return (
        f"{total} payout(s) unfinished for over {STUCK_AFTER_SECONDS // 60} minutes. "
        f"Oldest is in state '{worst.state}', {worst.oldest_seconds // 60} minutes old. "
        f"Check the sweeper is running before anything else."
    )
