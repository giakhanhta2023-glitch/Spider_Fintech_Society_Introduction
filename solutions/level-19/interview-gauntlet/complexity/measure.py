"""The five comparisons, on this machine, at sizes you can feel.

    python -m complexity.measure            # all five, about a minute
    python -m complexity.measure --quick    # smaller sizes, a few seconds

Big O describes how work grows with input, not how fast anything is. The
distinction sounds academic until you watch the same task take a millisecond and
then eight seconds, so this file exists to be run rather than read.

Two kinds of result, and the difference matters more than either number:

  a class change      O(n^2) to O(n). The ratio grows without limit as the data
                      does, so the measurement at one size understates it
  a constant factor   O(n) to O(n). Real, bounded, and worth much less in an
                      interview than the first kind

Sizes are deliberately small enough to finish. Where the quadratic version would
take hours at production scale, the README extrapolates and says it is doing so.
"""

from __future__ import annotations

import argparse
import heapq
import random
import time
from collections import defaultdict


def timed(function, *arguments) -> tuple[float, object]:
    """Milliseconds and the result, so a comparison can assert both agree."""
    started = time.perf_counter()
    result = function(*arguments)
    return (time.perf_counter() - started) * 1000, result


def payments(count: int, merchants: int = 500, seed: int = 19) -> list[dict]:
    rng = random.Random(seed)
    return [
        {
            "reference": f"REF{i:07d}",
            "merchant_id": f"M{rng.randrange(merchants):04d}",
            "amount_minor": rng.randrange(100, 500_000),
        }
        for i in range(count)
    ]


# ----------------------------------------------- 1. the reconciliation, three sizes
def reconcile_nested(ours: list[dict], theirs: list[dict]) -> int:
    """The obvious way. For every row on our side, scan theirs.

    O(n*m), and it is the answer that ends an interview early, because matching
    two files by a key is the canonical hash map question.
    """
    matched = 0
    for row in ours:
        for other in theirs:
            if other["reference"] == row["reference"]:
                matched += 1
                break
    return matched


def reconcile_indexed(ours: list[dict], theirs: list[dict]) -> int:
    """One pass to build the index, one pass to look up. O(n + m)."""
    index = {row["reference"]: row for row in theirs}
    return sum(1 for row in ours if row["reference"] in index)


def reconciliation(sizes: tuple[int, ...] = (2_000, 4_000, 8_000)) -> list[dict]:
    rows = []
    for size in sizes:
        ours = payments(size)
        theirs = payments(size, seed=20)
        # Overlap most of the references, so both versions do real matching work.
        for i in range(0, size, 2):
            theirs[i]["reference"] = ours[i]["reference"]

        nested_ms, nested = timed(reconcile_nested, ours, theirs)
        indexed_ms, indexed = timed(reconcile_indexed, ours, theirs)
        assert nested == indexed, "the fast version must give the same answer"

        rows.append({
            "rows": size,
            "nested_ms": nested_ms,
            "indexed_ms": indexed_ms,
            "ratio": nested_ms / indexed_ms,
            "matched": nested,
        })
    return rows


# --------------------------------------------------- 2. "have I seen this before"
def seen_with_list(known: list[str], queries: list[str]) -> int:
    """`in` on a list is a scan. O(n) per query, and nobody notices until n grows."""
    return sum(1 for q in queries if q in known)


def seen_with_set(known: set[str], queries: list[str]) -> int:
    """O(1) per query, amortised. The same line of code, a different container."""
    return sum(1 for q in queries if q in known)


def membership(known_count: int = 100_000, queries: int = 10_000) -> dict:
    known = [f"REF{i:07d}" for i in range(known_count)]
    rng = random.Random(191)
    asked = [f"REF{rng.randrange(known_count * 2):07d}" for _ in range(queries)]

    list_ms, from_list = timed(seen_with_list, known, asked)
    set_ms, from_set = timed(seen_with_set, set(known), asked)
    assert from_list == from_set

    return {
        "known": known_count,
        "queries": queries,
        "list_ms": list_ms,
        "set_ms": set_ms,
        "ratio": list_ms / set_ms,
        "found": from_list,
    }


# ------------------------------------------------------------------ 3. grouping
def group_by_filtering(rows: list[dict], merchants: list[str]) -> dict[str, int]:
    """One pass per merchant. Reads the whole list 500 times, which is the bug."""
    return {
        merchant: sum(1 for row in rows if row["merchant_id"] == merchant)
        for merchant in merchants
    }


def group_in_one_pass(rows: list[dict]) -> dict[str, int]:
    counts: dict[str, int] = defaultdict(int)
    for row in rows:
        counts[row["merchant_id"]] += 1
    return dict(counts)


def grouping(count: int = 200_000, merchants: int = 500) -> dict:
    rows = payments(count, merchants=merchants)
    names = sorted({row["merchant_id"] for row in rows})

    filter_ms, by_filter = timed(group_by_filtering, rows, names)
    pass_ms, by_pass = timed(group_in_one_pass, rows)
    assert by_filter == by_pass

    return {
        "rows": count,
        "merchants": len(names),
        "filter_ms": filter_ms,
        "one_pass_ms": pass_ms,
        "ratio": filter_ms / pass_ms,
    }


# ------------------------------------------------------------------- 4. top ten
def top_by_sorting(rows: list[dict], k: int = 10) -> list[int]:
    """Sorts 200,000 things to keep 10. O(n log n) and correct."""
    return [r["amount_minor"] for r in sorted(rows, key=lambda r: -r["amount_minor"])[:k]]


def top_with_heap(rows: list[dict], k: int = 10) -> list[int]:
    """O(n log k), and the answer an interviewer is listening for."""
    return [r["amount_minor"] for r in heapq.nlargest(k, rows, key=lambda r: r["amount_minor"])]


def top_ten(count: int = 200_000) -> dict:
    rows = payments(count)
    sort_ms, by_sort = timed(top_by_sorting, rows)
    heap_ms, by_heap = timed(top_with_heap, rows)
    assert by_sort == by_heap

    return {
        "rows": count,
        "sort_ms": sort_ms,
        "heap_ms": heap_ms,
        "ratio": sort_ms / heap_ms,
    }


# -------------------------------------------------------------- 5. the export
def export_with_concatenation(rows: list[dict]) -> str:
    """`+=` on a string builds a new string every time.

    CPython optimises some of this in place, which is why the ratio is 2x rather
    than the quadratic disaster the same code is in other languages. It is still
    the wrong habit, and on a language without that optimisation it is the
    difference between a second and a minute.
    """
    out = ""
    for row in rows:
        out += f"{row['reference']},{row['merchant_id']},{row['amount_minor']}\n"
    return out


def export_with_join(rows: list[dict]) -> str:
    return "".join(
        f"{row['reference']},{row['merchant_id']},{row['amount_minor']}\n" for row in rows
    )


def export(count: int = 200_000) -> dict:
    rows = payments(count)
    concat_ms, a = timed(export_with_concatenation, rows)
    join_ms, b = timed(export_with_join, rows)
    assert a == b

    return {
        "rows": count,
        "concat_ms": concat_ms,
        "join_ms": join_ms,
        "ratio": concat_ms / join_ms,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--quick", action="store_true", help="smaller sizes")
    quick = parser.parse_args().quick

    print("1. Reconciling two files by reference\n")
    header = f"   {'rows each side':>15}  {'nested loops':>14}"
    print(header + f"  {'dictionary':>12}  {'ratio':>9}")
    sizes = (500, 1_000, 2_000) if quick else (2_000, 4_000, 8_000)
    previous = None
    for row in reconciliation(sizes):
        grew = None if previous is None else row["nested_ms"] / previous
        growth = "" if grew is None else f"   nested grew {grew:.1f}x"
        print(f"   {row['rows']:>15,}  {row['nested_ms']:>11,.1f} ms  "
              f"{row['indexed_ms']:>9,.1f} ms  {row['ratio']:>8,.0f}x{growth}")
        previous = row["nested_ms"]

    print("\n2. \"Have I seen this reference?\"")
    m = membership(10_000 if quick else 100_000, 2_000 if quick else 10_000)
    print(f"   {m['queries']:,} queries over {m['known']:,} known references")
    print(f"   a list: {m['list_ms']:>11,.1f} ms      a set: {m['set_ms']:.2f} ms"
          f"      {m['ratio']:,.0f}x")

    print("\n3. Grouping payments by merchant")
    g = grouping(20_000 if quick else 200_000)
    print(f"   {g['rows']:,} payments, {g['merchants']} merchants")
    print(f"   filter per merchant: {g['filter_ms']:>9,.1f} ms      "
          f"one pass: {g['one_pass_ms']:.1f} ms      {g['ratio']:,.0f}x")

    print("\n4. The ten largest payments")
    t = top_ten(20_000 if quick else 200_000)
    print(f"   sort everything: {t['sort_ms']:>7,.1f} ms      "
          f"a heap of ten: {t['heap_ms']:.1f} ms      {t['ratio']:.1f}x")

    print("\n5. Building an export file")
    e = export(20_000 if quick else 200_000)
    print(f"   string +=: {e['concat_ms']:>11,.1f} ms      "
          f"join: {e['join_ms']:.1f} ms      {e['ratio']:.1f}x")

    print("\nThe first three are changes of complexity class: the ratio grows with")
    print("the data. The last two are constant factors: real, bounded, and worth")
    print("much less in an interview.")


if __name__ == "__main__":
    main()
