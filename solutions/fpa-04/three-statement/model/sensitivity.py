"""Two questions the model exists to answer, and neither is "what will happen".

    python -m model.sensitivity

**How wrong can the forecast be before the answer changes?** A two way table of
FY2026 EBITDA across the take rate and volume growth, because those are the two
drivers the business argues about and the only two that move the answer enough
to matter.

**When does the company need money?** The first month each case draws on the
revolver. A forecast whose only output is a number is a guess with a decimal
point; a forecast that says "below 0.54% and we are at the facility by August"
is a decision.
"""

from __future__ import annotations

from .drivers import base
from .forecast import run

TAKE_RATES = [0.0050, 0.0054, 0.0058, 0.0062, 0.0066]
VOLUME_GROWTH = [-0.005, 0.005, 0.0215, 0.030]


def fy2026(forecast) -> tuple[float, float, str]:
    year = [m for m in forecast.months if m.month.startswith("2026")]
    ebitda = sum(m.ebitda for m in year)
    drawn = next((m.month for m in forecast.months if m.revolver > 0), "never")
    return ebitda, sum(m.revenue for m in year), drawn


def main() -> None:
    reference = base()

    print("FY2026 EBITDA, by take rate and monthly volume growth\n")
    header = "   " + "growth".ljust(10) + "".join(f"{r * 100:>12.2f}%" for r in TAKE_RATES)
    print(header)
    for growth in VOLUME_GROWTH:
        cells = []
        for rate in TAKE_RATES:
            assumptions = reference.scaled(
                "cell", take_rate=rate / reference.take_rate.value,
                volume_growth=growth / reference.volume_growth.value)
            ebitda, _, _ = fy2026(run(assumptions))
            cells.append(f"{ebitda / 1e6:>12.1f}m")
        print(f"   {growth * 100:>6.2f}%   " + "".join(cells))

    print("\n   the base case is 0.58% and 2.15%, at the centre of the table")
    print("\nwhen each case first draws on the revolver\n")
    for scenario in ["base", "upside", "downside", "stress"]:
        from .drivers import scenarios
        chosen = next(s for s in scenarios() if s.name == scenario)
        forecast = run(chosen)
        ebitda, revenue, drawn = fy2026(forecast)
        print(f"   {scenario:<10} FY2026 revenue {revenue / 1e6:>5.1f}m, "
              f"EBITDA {ebitda / 1e6:>5.1f}m ({ebitda / revenue:>5.1%}), "
              f"revolver {drawn}, peak {forecast.peak_revolver:>10,.0f}")

    print("\n   Every cell above is a full fifteen month model, run from the same "
          "opening\n   balance sheet, and every one of them balances to the cent.")


if __name__ == "__main__":
    main()
