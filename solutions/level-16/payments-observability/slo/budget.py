"""Error budgets, burn rates, and the arithmetic behind both.

An availability target is a promise about how much failure is allowed, which
means it is a number of minutes. Writing the minutes down is what turns an
argument about shipping into a decision rule both sides already agreed to.

Two functions and one table. There is nothing clever here, and that is the
point: every burn rate alert in `burn_rate.yml` is this arithmetic with a
window around it.
"""

from __future__ import annotations

from dataclasses import dataclass

SECONDS_IN_30_DAYS = 30 * 24 * 60 * 60          # 2,592,000

# The two thresholds the industry settled on, and where they come from.
#
# 14.4x: at fourteen point four times the allowed rate, a 30 day budget is gone
# in 2.1 days. Something is actively on fire, so page now.
# 6x: a 30 day budget gone in 5 days. Not urgent tonight, and it will not fix
# itself, so page with less urgency rather than opening a ticket nobody reads.
FAST_BURN = 14.4
SLOW_BURN = 6.0


def error_budget_seconds(objective: float, window_seconds: int = SECONDS_IN_30_DAYS) -> float:
    """How much failure the objective permits, as time.

    Time and request share are interchangeable only when traffic is even. This
    returns the time reading because it is the one people can picture, and the
    SLI in OBJECTIVES.md is defined on requests, which is the one that is
    correct during a quiet Sunday night.
    """
    return (1 - objective) * window_seconds


def burn_rate(error_ratio: float, objective: float) -> float:
    """How many times faster than the budget allows.

    A 0.1% target with a 1.44% error rate is 14.4x, and 14.4x for an hour spends
    2% of a 30 day budget. That is the entire idea: the alert measures the rate
    of spending, so a worse incident is detected sooner without anybody
    configuring a second severity.
    """
    return error_ratio / (1 - objective)


def days_to_exhaust(rate: float, window_days: int = 30) -> float:
    return window_days / rate if rate else float("inf")


def human(seconds: float) -> str:
    """Whole units, because a budget of "4.32 minutes" is a number nobody feels
    and "4 minutes 19 seconds" is.

    Rounded rather than truncated, and that is not cosmetic. `1 - 0.9995` is
    0.0004999999999999449 in binary floating point, so a 99.95% budget computes
    as 1,295.99999 seconds and truncating prints 21 minutes 35 seconds for a
    number that is exactly 21 minutes 36. Level 2 again, in the SLO document
    this time.
    """
    total = int(round(seconds))
    hours, remainder = divmod(total, 3600)
    minutes, secs = divmod(remainder, 60)
    parts = []
    if hours:
        parts.append(f"{hours} hour{'s' if hours != 1 else ''}")
    if minutes:
        parts.append(f"{minutes} minute{'s' if minutes != 1 else ''}")
    if secs or not parts:
        parts.append(f"{secs} second{'s' if secs != 1 else ''}")
    return " ".join(parts)


@dataclass(frozen=True, slots=True)
class Objective:
    name: str
    target: float

    @property
    def budget_seconds(self) -> float:
        return error_budget_seconds(self.target)

    @property
    def budget(self) -> str:
        return human(self.budget_seconds)

    @property
    def fast_burn_ratio(self) -> float:
        """The error ratio that constitutes a fast burn for this target."""
        return FAST_BURN * (1 - self.target)

    @property
    def slow_burn_ratio(self) -> float:
        return SLOW_BURN * (1 - self.target)


# Every nine costs about ten times the one before it. The last row is the one to
# read before promising anything: four minutes a month is less than a deploy
# takes, less than a failover, and less than one bad migration.
LADDER = [
    Objective("99%", 0.99),
    Objective("99.9%", 0.999),
    Objective("99.95%", 0.9995),
    Objective("99.99%", 0.9999),
]


def table() -> list[dict]:
    return [
        {
            "target": o.name,
            "may_fail": f"{(1 - o.target) * 100:g}%",
            "budget_30_days": o.budget,
            "budget_seconds": o.budget_seconds,
            "fast_burn_error_rate": o.fast_burn_ratio,
            "slow_burn_error_rate": o.slow_burn_ratio,
        }
        for o in LADDER
    ]


if __name__ == "__main__":
    print(f"{'target':10s} {'may fail':10s} {'budget over 30 days':22s} "
          f"{'pages fast above':18s} {'slow above':10s}")
    for row in table():
        print(f"{row['target']:10s} {row['may_fail']:10s} {row['budget_30_days']:22s} "
              f"{row['fast_burn_error_rate']:<18.2%} {row['slow_burn_error_rate']:.2%}")
    print(f"\n14.4x empties a 30 day budget in {days_to_exhaust(FAST_BURN):.1f} days, "
          f"6x in {days_to_exhaust(SLOW_BURN):.1f} days.")
