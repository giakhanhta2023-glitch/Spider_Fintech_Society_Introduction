"""Merge two sorted card event streams into one ordered stream.

Pattern: two pointers
Time:    O(n + m)
Space:   O(n + m) for the output
First instinct: concatenate and sort, O((n+m) log(n+m)). It is one line and it
  throws away the fact that both inputs are already sorted, which is the only
  interesting thing about the problem.
Outcome: solved directly.

The tie rule is the part worth deciding on purpose: when two events share a
timestamp, the one from our side goes first, so replaying the merged stream is
deterministic. Level 11 cared about this for real, because a capture arriving
before its own authorisation is an ordering bug rather than a sorting detail.
"""


def merge_events(ours: list[dict], theirs: list[dict]) -> list[dict]:
    merged: list[dict] = []
    i = j = 0
    while i < len(ours) and j < len(theirs):
        # <= rather than <, so equal timestamps keep our side first and the
        # result is stable and reproducible.
        if ours[i]["at"] <= theirs[j]["at"]:
            merged.append(ours[i])
            i += 1
        else:
            merged.append(theirs[j])
            j += 1
    merged.extend(ours[i:])
    merged.extend(theirs[j:])
    return merged


def test_interleaves_two_streams():
    ours = [{"at": 1, "side": "us"}, {"at": 5, "side": "us"}]
    theirs = [{"at": 2, "side": "them"}, {"at": 9, "side": "them"}]
    assert [e["at"] for e in merge_events(ours, theirs)] == [1, 2, 5, 9]


def test_equal_timestamps_keep_our_side_first():
    ours = [{"at": 3, "side": "us"}]
    theirs = [{"at": 3, "side": "them"}]
    assert [e["side"] for e in merge_events(ours, theirs)] == ["us", "them"]


def test_one_side_empty():
    ours = [{"at": 1}]
    assert merge_events(ours, []) == ours
    assert merge_events([], ours) == ours
