"""Merge k sorted settlement files into one ordered stream.

Pattern: heap
Time:    O(n log k) for n rows across k files
Space:   O(k)
First instinct: concatenate and sort, O(n log n) and every row in memory. With
  twelve acquirer files of a million rows each that is the wrong shape entirely.
Outcome: solved directly.

The heap holds one row per file, so memory is the number of files rather than the
number of rows. This is also exactly what `heapq.merge` does, and knowing the
library function exists is worth saying out loud after you have shown you can
write it.
"""

import heapq


def merge_files(files: list[list[dict]]) -> list[dict]:
    """One ordered list, with the file index breaking ties deterministically."""
    heap: list[tuple] = []
    for file_index, rows in enumerate(files):
        if rows:
            # (sort key, file index, row index, row). The two indexes make the
            # tuple comparable without ever comparing the dicts, which would
            # raise. That is the bug people hit here first.
            heap.append((rows[0]["reference"], file_index, 0, rows[0]))
    heapq.heapify(heap)

    merged: list[dict] = []
    while heap:
        _, file_index, row_index, row = heapq.heappop(heap)
        merged.append(row)
        following = row_index + 1
        if following < len(files[file_index]):
            nxt = files[file_index][following]
            heapq.heappush(heap, (nxt["reference"], file_index, following, nxt))
    return merged


def test_merges_three_files():
    files = [
        [{"reference": "A"}, {"reference": "D"}],
        [{"reference": "B"}],
        [{"reference": "C"}, {"reference": "E"}],
    ]
    assert [r["reference"] for r in merge_files(files)] == ["A", "B", "C", "D", "E"]


def test_equal_references_do_not_compare_the_rows():
    files = [[{"reference": "A", "side": "one"}], [{"reference": "A", "side": "two"}]]
    assert [r["side"] for r in merge_files(files)] == ["one", "two"]


def test_empty_files_are_skipped():
    assert merge_files([[], [{"reference": "A"}], []]) == [{"reference": "A"}]
