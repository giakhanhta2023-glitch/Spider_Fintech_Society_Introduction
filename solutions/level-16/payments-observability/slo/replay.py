"""Thirty days of traffic, and what each alerting rule would have done to you.

    python -m slo.replay

This is the file that should change somebody's mind. Alerting is usually argued
about in meetings, where the person with the strongest opinion wins. Replay both
rules over the same month and the argument is a table.

The month: 518.4 million requests at 200 a second, a quiet background error rate
of about 0.05%, two real incidents (90 minutes at 8% on day 5, 25 minutes at 35%
on day 19) and two brief blips of two and three minutes that nobody should be
woken for. Availability lands at 99.9129%, which meets a 99.9% target with 87%
of the error budget spent.

Everything is seeded, so the table is the same on every machine.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from .budget import FAST_BURN, SLOW_BURN

MINUTES = 30 * 24 * 60
REQUESTS_PER_SECOND = 200
BACKGROUND_ERROR_RATE = 0.0005
OBJECTIVE = 0.999

# (start minute, length in minutes, error rate)
INCIDENTS = [
    (5 * 24 * 60, 90, 0.08),        # day 5, an hour and a half at 8%
    (19 * 24 * 60, 25, 0.35),       # day 19, twenty five minutes at 35%
]
BLIPS = [
    (11 * 24 * 60 + 300, 3, 0.03),  # three minutes, recovered on its own
    (24 * 24 * 60 + 120, 2, 0.05),  # two minutes, same
]


@dataclass
class Month:
    requests: np.ndarray
    errors: np.ndarray
    incidents: list[tuple[int, int, float]] = field(default_factory=lambda: list(INCIDENTS))

    @property
    def availability(self) -> float:
        return 1 - self.errors.sum() / self.requests.sum()

    @property
    def budget_spent(self) -> float:
        """As a share of the budget, which is the number a review should open on."""
        return (self.errors.sum() / self.requests.sum()) / (1 - OBJECTIVE)

    def incident_share(self) -> dict[str, float]:
        """How much of the month's failure the memorable events accounted for.

        The answer is the uncomfortable number in the README, and it is the
        reason to look at budget spend monthly rather than only at pages.
        """
        total = self.errors.sum()
        return {
            f"day {start // 1440} at {rate:.0%}": float(
                self.errors[start:start + length].sum() / total
            )
            for start, length, rate in self.incidents
        }


def synthesise(seed: int = 1616) -> Month:
    rng = np.random.default_rng(seed)
    requests = np.full(MINUTES, REQUESTS_PER_SECOND * 60, dtype=np.int64)

    # Noise around the background rate, clipped at zero. A constant rate would
    # make the blips and incidents trivially separable and the replay worthless.
    rate = np.clip(
        rng.normal(BACKGROUND_ERROR_RATE, BACKGROUND_ERROR_RATE * 0.5, MINUTES), 0, None
    )
    for start, length, incident_rate in INCIDENTS:
        rate[start:start + length] = incident_rate
    for start, length, blip_rate in BLIPS:
        rate[start:start + length] = blip_rate

    errors = rng.binomial(requests, rate)
    return Month(requests=requests, errors=errors)


def ratio(month: Month, window: int) -> np.ndarray:
    """Error ratio over a trailing window, for every minute of the month.

    Cumulative sums rather than a loop of slices: the same arithmetic, three
    orders of magnitude faster, and it lets the replay run inside a test instead
    of being a thing somebody ran once and pasted.

    The window is inclusive of the current minute and of `window` minutes before
    it, which is what `rate(...[5m])` means in Prometheus.
    """
    errors = np.concatenate([[0], np.cumsum(month.errors)])
    requests = np.concatenate([[0], np.cumsum(month.requests)])
    index = np.arange(MINUTES)
    low = np.maximum(0, index - window)
    error_window = errors[index + 1] - errors[low]
    request_window = requests[index + 1] - requests[low]
    return np.divide(
        error_window, request_window,
        out=np.zeros(MINUTES), where=request_window > 0,
    )


# --------------------------------------------------------------- the rules
def threshold_rule(month: Month, above: float = 0.01, window: int = 5) -> np.ndarray:
    """The obvious rule: error rate above 1% for five minutes.

    It is not stupid. It is fast, it is one line, and every team writes it
    first. The replay shows what it costs.
    """
    hot = ratio(month, window) > above
    hot[:window] = False                  # not enough history yet to judge
    return hot


def burn_rule(
    month: Month,
    long_window: int,
    short_window: int | None,
    multiple: float,
) -> np.ndarray:
    """One burn rate rule: a long window, and optionally a short one to confirm.

    Separated out so the two halves of the multiwindow rule can be judged on
    their own, which is how the README can say which half provides the fast
    detection and which half sets how long the alert keeps firing.
    """
    budget = 1 - OBJECTIVE
    hot = ratio(month, long_window) > multiple * budget
    if short_window is not None:
        hot = hot & (ratio(month, short_window) > multiple * budget)
    hot[:60] = False
    return hot


def multiwindow_rule(month: Month, confirm: bool = True) -> np.ndarray:
    """Two burn rates, each with a short confirming window.

    Fast: 14.4x the budget rate over an hour, confirmed over five minutes.
    Slow: 6x over six hours, confirmed over thirty minutes.

    The confirming window is the part people leave out, and `confirm=False`
    exists to measure what leaving it out does. The answer turned out to be
    worse than the usual warning: 335 and 355 minutes of firing after the two
    incidents ended, against 28 and 30 with the short windows in place. Nearly
    six hours, because the six hour window keeps averaging in the incident long
    after it is over. That is how an alert gets silenced, and silenced is how it
    is configured during the next one.
    """
    budget = 1 - OBJECTIVE
    long_fast = ratio(month, 60) > FAST_BURN * budget
    long_slow = ratio(month, 360) > SLOW_BURN * budget

    if confirm:
        short_fast = ratio(month, 5) > FAST_BURN * budget
        short_slow = ratio(month, 30) > SLOW_BURN * budget
        hot = (long_fast & short_fast) | (long_slow & short_slow)
    else:
        hot = long_fast | long_slow

    hot[:60] = False
    return hot


# ------------------------------------------------------------- the judging
def pages(hot: np.ndarray) -> list[int]:
    """A page is a rising edge. A rule that is hot for ninety minutes wakes one
    person once, which is how alerting actually behaves."""
    out = []
    firing = False
    for minute, is_hot in enumerate(hot):
        if is_hot and not firing:
            out.append(minute)
            firing = True
        elif not is_hot:
            firing = False
    return out


GRACE = 60          # a page within an hour of an incident counts as that incident


def classify(page_minutes: list[int]) -> dict:
    caught: dict[int, int] = {}
    false_pages = 0
    for minute in page_minutes:
        belongs_to = None
        for start, length, _ in INCIDENTS:
            if start <= minute <= start + length + GRACE:
                belongs_to = start
        if belongs_to is None:
            false_pages += 1
        elif belongs_to not in caught:
            caught[belongs_to] = minute - belongs_to

    return {
        "pages": len(page_minutes),
        "caught": len(caught),
        "false_pages": false_pages,
        "detection_minutes": {
            f"day {start // 1440} at {rate:.0%}": caught.get(start)
            for start, _, rate in INCIDENTS
        },
    }


def stop_lag(hot: np.ndarray) -> dict[str, int | None]:
    """Minutes between an incident ending and the rule going quiet.

    The number nobody measures, and the reason alerts get silenced. An alert
    that keeps firing for an hour after the incident is over trains people to
    turn it off, and it is off during the next one.
    """
    out: dict[str, int | None] = {}
    for start, length, rate in INCIDENTS:
        end = start + length
        label = f"day {start // 1440} at {rate:.0%}"
        lag = None
        for minute in range(end, min(end + 12 * 60, MINUTES)):
            if not hot[minute]:
                lag = minute - end
                break
        out[label] = lag
    return out


def replay(seed: int = 1616) -> dict:
    month = synthesise(seed)
    rules = {
        "threshold, 1% for 5 minutes": threshold_rule(month),
        "multiwindow burn rate": multiwindow_rule(month),
        "fast burn alone, 14.4x over 1h": burn_rule(month, 60, 5, FAST_BURN),
        "slow burn alone, 6x over 6h": burn_rule(month, 360, 30, SLOW_BURN),
        "multiwindow, no short window": multiwindow_rule(month, confirm=False),
    }
    return {
        "requests": int(month.requests.sum()),
        "errors": int(month.errors.sum()),
        "availability": month.availability,
        "budget_spent": month.budget_spent,
        "incident_share": month.incident_share(),
        "rules": {
            name: {**classify(pages(hot)), "stops_firing_after": stop_lag(hot)}
            for name, hot in rules.items()
        },
    }


def main() -> None:
    result = replay()
    print(f"{result['requests']:,} requests, {result['errors']:,} errors, "
          f"availability {result['availability']:.4%}")
    print(f"error budget spent: {result['budget_spent']:.0%} of a "
          f"{OBJECTIVE:.1%} target over 30 days\n")

    header = f"{'rule':32s} {'pages':>6s} {'caught':>7s} {'false':>6s}  detection      stops after"
    print(header)
    print("-" * len(header))
    for name, r in result["rules"].items():
        detection = ", ".join(
            f"{k.split(' at ')[1]} in {v}m" if v is not None else f"{k} missed"
            for k, v in r["detection_minutes"].items()
        )
        stops = ", ".join(
            f"{v}m" if v is not None else "never"
            for v in r["stops_firing_after"].values()
        )
        print(f"{name:32s} {r['pages']:6d} {r['caught']:5d}/2 {r['false_pages']:6d}  "
              f"{detection:14s} {stops}")

    print("\nshare of the month's errors from the two incidents: "
          + ", ".join(f"{k}: {v:.0%}" for k, v in result["incident_share"].items()))
    total = sum(result["incident_share"].values())
    print(f"everything else, from a background rate that never paged: {1 - total:.0%}")


if __name__ == "__main__":
    main()
