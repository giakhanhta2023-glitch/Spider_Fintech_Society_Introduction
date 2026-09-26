"""The ten largest refunds in a stream you only get to read once.

Pattern: heap
Time:    O(n log k)
Space:   O(k)
First instinct: collect everything and sort, O(n log n) time and O(n) space. Fine
  for a list, impossible for a stream that does not fit in memory, which is the
  constraint that makes this a heap question rather than a sorting one.
Outcome: solved directly.

Measured in complexity/measure.py on 200,000 payments: sorting everything took
515.5 ms and a heap of ten took 149.5 ms, a factor of 3.4. That is a constant
factor rather than a class change, and the real argument for the heap is the
memory: O(k) instead of O(n).
"""

import heapq


def top_refunds(stream, k: int = 10) -> list[int]:
    """The k largest amounts, largest first. `stream` is consumed once.

    A min heap of size k, which is the part that reads backwards at first: to
    keep the largest values, hold the smallest of the keepers at the top so it is
    the cheapest one to evict.
    """
    keepers: list[int] = []
    for refund in stream:
        amount = refund["amount_minor"]
        if len(keepers) < k:
            heapq.heappush(keepers, amount)
        elif amount > keepers[0]:
            heapq.heapreplace(keepers, amount)     # one operation, not two
    return sorted(keepers, reverse=True)


def test_finds_the_largest():
    stream = ({"amount_minor": a} for a in [100, 900, 500, 700, 300])
    assert top_refunds(stream, k=3) == [900, 700, 500]


def test_fewer_refunds_than_k():
    stream = iter([{"amount_minor": 100}])
    assert top_refunds(stream, k=5) == [100]


def test_the_stream_is_read_once():
    stream = iter([{"amount_minor": a} for a in range(20)])
    assert top_refunds(stream, k=2) == [19, 18]
    assert list(stream) == []       # nothing left, which a sort could not promise
