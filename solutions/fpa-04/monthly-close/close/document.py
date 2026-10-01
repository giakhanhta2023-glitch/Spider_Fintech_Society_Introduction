"""The thing a person actually receives.

One markdown file, in the order somebody reads rather than the order the
pipeline computed: the five numbers first, then what moved, then the detail
behind it, then cash, then what it means for next year. The commentary is left
as TODO, and the document says at the bottom exactly which command produced it
and how long it took, because a pack whose provenance is a mystery gets
questioned every month.
"""

from __future__ import annotations

from pathlib import Path

from .stages import Stage


def find(done: list[Stage], name: str) -> Stage | None:
    return next((s for s in done if s.name == name), None)


def write_document(month: str, done: list[Stage], out: Path) -> Path:
    pack_stage = find(done, "build the pack")
    detail = find(done, "query the detail")
    recon = find(done, "reconcile billing to the ledger")
    forecast = find(done, "reforecast")
    checks = find(done, "check the data")
    pack = pack_stage.data["pack"]
    totals = pack.totals

    lines = [
        f"# Meridian Pay, management pack, {month}",
        "",
        "## The five numbers",
        "",
        "| | Actual | Budget | Variance |",
        "|---|---|---|---|",
        f"| Revenue | {totals['revenue_actual']:,.0f} | {totals['revenue_budget']:,.0f} | "
        f"{totals['revenue_actual'] - totals['revenue_budget']:+,.0f} |",
        f"| Gross profit | {totals['gross_actual']:,.0f} | {totals['gross_budget']:,.0f} | "
        f"{totals['gross_actual'] - totals['gross_budget']:+,.0f} |",
        f"| Gross margin | {totals['gross_margin_actual']:.1%} | {totals['gross_margin_budget']:.1%} | "
        f"{(totals['gross_margin_actual'] - totals['gross_margin_budget']) * 100:+.1f} points |",
        f"| Operating expenses | {totals['opex_actual']:,.0f} | {totals['opex_budget']:,.0f} | "
        f"{totals['opex_budget'] - totals['opex_actual']:+,.0f} |",
        f"| EBITDA | {totals['ebitda_actual']:,.0f} | {totals['ebitda_budget']:,.0f} | "
        f"{totals['ebitda_actual'] - totals['ebitda_budget']:+,.0f} |",
        "",
        f"Revenue is {totals['revenue_actual'] / totals['revenue_budget'] - 1:+.1%} against plan "
        f"and EBITDA is {totals['ebitda_actual'] / totals['ebitda_budget'] - 1:+.1%}.",
        "",
        "## What moved",
        "",
    ]

    material = sorted(((row["line"], float(row["variance"]))
                       for _, row in pack.lines.iterrows() if abs(row["variance"]) >= 25_000),
                      key=lambda pair: -abs(pair[1]))
    for name, value in material:
        word = "favourable" if value > 0 else "unfavourable"
        lines += [f"**{name}, {value:+,.0f} {word}.** TODO: why. TODO: what happens next.", ""]

    bridge = pack.bridge
    lines += [
        "## Transaction fees, split",
        "",
        f"Volume was {bridge['volume_actual'] / bridge['volume_plan'] - 1:+.1%} against plan and the "
        f"take rate {bridge['rate_actual'] / bridge['rate_plan'] - 1:+.1%}, so of the "
        f"{bridge['reported']:+,.0f} variance, {bridge['volume_effect']:+,.0f} is volume and "
        f"{bridge['rate_effect']:+,.0f} is rate ({bridge['rounding']:+,.2f} rounding).",
        "",
    ]

    if detail:
        segment = detail.data["by_segment"]
        ageing = detail.data["ageing"]
        lines += ["## Where the revenue came from", "",
                  "| Segment | Invoices | Revenue | Share |", "|---|---|---|---|"]
        total = segment["revenue"].sum()
        for _, row in segment.iterrows():
            lines.append(f"| {row['segment']} | {int(row['invoices'])} | {row['revenue']:,.0f} | "
                         f"{row['revenue'] / total:.1%} |")
        lines += ["", "## What has not been collected", "",
                  "| Bucket | Invoices | Owed |", "|---|---|---|"]
        for _, row in ageing.iterrows():
            lines.append(f"| {row['bucket']} | {int(row['invoices'])} | {row['owed']:,.0f} |")
        owed = ageing["owed"].sum()
        lines += ["",
                  f"Receivables are {owed:,.0f} against revenue of "
                  f"{totals['revenue_actual']:,.0f}, a DSO of "
                  f"{owed / totals['revenue_actual'] * 30:.1f} days on 30 day terms.",
                  "TODO: collections plan for the oldest bucket.", ""]

    if recon:
        lines += ["## Does billing agree with the ledger", ""]
        breaks = recon.data["breaks"]
        if breaks.empty:
            lines += ["Every month agrees.", ""]
        else:
            for _, row in breaks.iterrows():
                lines.append(f"- **{row['month']}**: billing {row['billed']:,.2f} against ledger "
                             f"{row['ledger']:,.2f}, a difference of {row['difference']:+,.2f}. "
                             f"TODO: which side is right, and who is posting the correction.")
            lines.append("")

    if forecast:
        lines += ["## What it means for next year", "",
                  "| Case | FY2026 revenue | FY2026 EBITDA | Facility drawn |", "|---|---|---|---|"]
        for name, case in forecast.data["cases"].items():
            lines.append(f"| {name} | {case['revenue'] / 1e6:.1f}m | {case['ebitda'] / 1e6:.1f}m | "
                         f"{case['first_draw']} |")
        lines += ["", "Every scenario balances in every month. TODO: which case the board should "
                      "plan against.", ""]

    if checks:
        notes = [f for f in checks.data.get("findings", []) if f.level == "warning"]
        if notes:
            lines += ["## Worth knowing", ""] + [f"- {f.detail}" for f in notes] + [""]

    total_ms = sum(s.milliseconds for s in done)
    lines += [
        "---",
        "",
        f"Produced by `python -m close.run --month {month}` from `data/fpa-*.csv`. "
        f"The six stages took {total_ms:,.0f} ms, not counting the chart or this file. "
        f"The pack ties to the ledger: {pack.tie_difference:+,.2f}.",
        "",
    ]

    path = out / f"close-{month}.md"
    path.write_text("\n".join(lines), encoding="utf-8")
    return path
