"""The most common decline code, with ties broken predictably.

Pattern: hash map
Time:    O(n)
Space:   O(k) for k distinct codes
First instinct: Counter.most_common(1), which is right until two codes tie and
  the answer depends on insertion order. An interviewer asks about the tie.
Outcome: wrong first, fixed. My first version returned most_common(1)[0][0] and
  a test with a tie failed, which is the test I only wrote because level 9 had
  taught me that decline codes cluster.

Ties matter here because the caller is deciding what to fix first, and an answer
that changes between runs on the same data is a coin toss with a table around it.
"""

from collections import Counter


def most_frequent_decline_code(rows: list[dict]) -> str | None:
    """The commonest code. Alphabetically first when several tie.

    max() with a key rather than most_common(), because most_common breaks ties
    by insertion order, which is not a rule anybody can rely on or explain.
    """
    counts = Counter(row["decline_code"] for row in rows if row.get("decline_code"))
    if not counts:
        return None
    return max(sorted(counts), key=lambda code: counts[code])


def test_the_commonest_code():
    rows = [{"decline_code": "insufficient_funds"}, {"decline_code": "expired_card"},
            {"decline_code": "insufficient_funds"}]
    assert most_frequent_decline_code(rows) == "insufficient_funds"


def test_a_tie_is_broken_alphabetically_rather_than_by_luck():
    rows = [{"decline_code": "expired_card"}, {"decline_code": "do_not_honour"}]
    assert most_frequent_decline_code(rows) == "do_not_honour"


def test_rows_with_no_decline_code_are_ignored():
    rows = [{"decline_code": ""}, {"decline_code": None}, {"decline_code": "lost_card"}]
    assert most_frequent_decline_code(rows) == "lost_card"


def test_no_declines_at_all():
    assert most_frequent_decline_code([{"decline_code": ""}]) is None
