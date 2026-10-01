"""The two things a human actually receives: a chart and a draft memo.

    python -m closepack.report            # writes both into out/

The memo is deliberately a **draft**. The script knows what moved and by how
much, and it does not know why, so it writes the arithmetic and leaves the cause
as a gap with the word TODO in it. A tool that invents the explanation is worse
than useless in a finance team: the explanation is the part a person is
accountable for, and it is the only part of the pack anybody reads twice.

The chart is a waterfall from budget EBITDA to actual EBITDA, because that is
the one picture that answers "we planned this much profit and made that much,
where did it go" without a single word of commentary.
"""

from __future__ import annotations

from pathlib import Path

import matplotlib
matplotlib.use("Agg")                      # no display on a build machine
import matplotlib.pyplot as plt            # noqa: E402

from .pack import Pack, build              # noqa: E402

OUT = Path(__file__).resolve().parent.parent / "out"
MATERIALITY = 25_000


def waterfall(pack: Pack, path: Path) -> Path:
    """Budget EBITDA, every material variance, actual EBITDA."""
    start = float(pack.totals["ebitda_budget"])
    end = float(pack.totals["ebitda_actual"])

    moves = [(row["line"], float(row["variance"]))
             for _, row in pack.lines.iterrows()
             if abs(row["variance"]) >= MATERIALITY]
    moves.sort(key=lambda pair: -abs(pair[1]))
    other = (end - start) - sum(value for _, value in moves)
    if abs(other) >= 1:
        moves.append(("Everything else", other))

    labels = ["Budget EBITDA"] + [name for name, _ in moves] + ["Actual EBITDA"]
    running = start
    bottoms, heights, colours = [0.0], [start], ["#3B4252"]
    for _, value in moves:
        bottoms.append(running if value > 0 else running + value)
        heights.append(abs(value))
        colours.append("#2F6F4E" if value > 0 else "#8C2F39")
        running += value
    bottoms.append(0.0)
    heights.append(end)
    colours.append("#3B4252")

    figure, axes = plt.subplots(figsize=(11, 6))
    axes.bar(range(len(labels)), heights, bottom=bottoms, color=colours, width=0.62)
    for index, (bottom, height) in enumerate(zip(bottoms, heights)):
        value = height if index in (0, len(labels) - 1) else (
            height if colours[index] == "#2F6F4E" else -height)
        axes.text(index, bottom + height + 6_000, f"{value:+,.0f}" if 0 < index < len(labels) - 1
                  else f"{value:,.0f}", ha="center", fontsize=9)
    axes.set_xticks(range(len(labels)))
    axes.set_xticklabels(labels, rotation=20, ha="right", fontsize=9)
    axes.set_ylabel("EBITDA, dollars")
    axes.set_title(f"From plan to actual, {pack.month}: "
                   f"{start:,.0f} planned against {end:,.0f} delivered", fontsize=11)
    axes.spines[["top", "right"]].set_visible(False)
    axes.grid(axis="y", alpha=0.25)
    figure.tight_layout()
    figure.savefig(path, dpi=140)
    plt.close(figure)
    return path


def memo(pack: Pack, path: Path) -> Path:
    """The draft. Numbers filled in, causes left as gaps on purpose."""
    t = pack.totals
    material = sorted(
        ((row["line"], float(row["variance"])) for _, row in pack.lines.iterrows()
         if abs(row["variance"]) >= MATERIALITY),
        key=lambda pair: -abs(pair[1]))

    lines = [
        f"# Management pack, {pack.month}",
        "",
        "## The five numbers",
        "",
        "| | Actual | Budget | Variance |",
        "|---|---|---|---|",
        f"| Revenue | {t['revenue_actual']:,.0f} | {t['revenue_budget']:,.0f} | "
        f"{t['revenue_actual'] - t['revenue_budget']:+,.0f} |",
        f"| Gross profit | {t['gross_actual']:,.0f} | {t['gross_budget']:,.0f} | "
        f"{t['gross_actual'] - t['gross_budget']:+,.0f} |",
        f"| Gross margin | {t['gross_margin_actual']:.1%} | {t['gross_margin_budget']:.1%} | "
        f"{(t['gross_margin_actual'] - t['gross_margin_budget']) * 100:+.1f} points |",
        f"| Operating expenses | {t['opex_actual']:,.0f} | {t['opex_budget']:,.0f} | "
        f"{t['opex_budget'] - t['opex_actual']:+,.0f} |",
        f"| EBITDA | {t['ebitda_actual']:,.0f} | {t['ebitda_budget']:,.0f} | "
        f"{t['ebitda_actual'] - t['ebitda_budget']:+,.0f} |",
        "",
        f"Revenue is {t['revenue_actual'] / t['revenue_budget'] - 1:+.1%} against plan and EBITDA is "
        f"{t['ebitda_actual'] / t['ebitda_budget'] - 1:+.1%}. Gross margin is "
        f"{(t['gross_margin_actual'] - t['gross_margin_budget']) * 100:+.1f} points.",
        "",
        "## What moved",
        "",
    ]
    for name, value in material:
        word = "favourable" if value > 0 else "unfavourable"
        lines += [f"**{name}, {value:+,.0f} {word}.** TODO: why. TODO: what happens next.", ""]

    bridge = pack.bridge
    if bridge:
        lines += [
            "## Transaction fees, split",
            "",
            f"Volume was {bridge['volume_actual'] / bridge['volume_plan'] - 1:+.1%} against plan and the "
            f"take rate was {bridge['rate_actual'] / bridge['rate_plan'] - 1:+.1%}, so of the "
            f"{bridge['reported']:+,.0f} variance, {bridge['volume_effect']:+,.0f} is volume and "
            f"{bridge['rate_effect']:+,.0f} is rate.",
            "",
            "TODO: is the rate move mix or pricing? Name the merchants if it is mix.",
            "",
        ]

    warnings = [f for f in pack.findings if f.level == "warning"]
    if warnings:
        lines += ["## Worth knowing", ""]
        lines += [f"- {f.detail}" for f in warnings] + [""]

    lines += [
        "## How this was produced",
        "",
        "`python -m closepack.pack` against `data/fpa-actuals.csv` and "
        "`data/fpa-budget.csv`. The pack ties to the ledger, and the check is "
        f"printed with it: {pack.tie_difference:+,.2f}.",
        "",
    ]
    path.write_text("\n".join(lines), encoding="utf-8")
    return path


def main() -> None:
    pack = build("2025-09")
    OUT.mkdir(exist_ok=True)
    chart = waterfall(pack, OUT / f"waterfall-{pack.month}.png")
    draft = memo(pack, OUT / f"memo-{pack.month}.md")
    print(f"   {chart.relative_to(OUT.parent)}")
    print(f"   {draft.relative_to(OUT.parent)}")
    print("\n   the memo has TODO where the cause belongs. That part is yours.")


if __name__ == "__main__":
    main()
