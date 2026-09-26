"""The best rate for converting one currency to another through intermediaries.

Pattern: graphs, shortest path with multiplied weights
Time:    O((V + E) log V)
Space:   O(V + E)
First instinct: add the rates. Rates multiply, so adding them is meaningless, and
  the result looks plausible enough to ship.
Outcome: wrong first, fixed. The fix is the standard one and worth knowing:
  maximising a product of positive numbers is minimising the sum of the negative
  logarithms, which turns it back into an ordinary shortest path.

Level 5's rule still applies underneath: rates are a Decimal in real code. Floats
are used here because logarithms are floats anyway, and the docstring says so
rather than leaving somebody to find out during a conversion.
"""

import heapq
import math


def best_rate(
    rates: dict[str, dict[str, float]], source: str, target: str
) -> tuple[float, list[str]] | None:
    """The best achievable rate and the path, or None when unreachable.

    The rate returned is a float, and a real conversion would recompute the
    amount with Decimal along the returned path. The graph search chooses the
    path; it does not price the trade.
    """
    if source == target:
        return 1.0, [source]

    queue: list[tuple[float, str, list[str]]] = [(0.0, source, [source])]
    settled: set[str] = set()

    while queue:
        cost, node, path = heapq.heappop(queue)
        if node == target:
            return math.exp(-cost), path
        if node in settled:
            continue
        settled.add(node)
        for neighbour, rate in rates.get(node, {}).items():
            if rate > 0 and neighbour not in settled:
                heapq.heappush(queue, (cost - math.log(rate), neighbour, [*path, neighbour]))
    return None


RATES = {
    "USD": {"EUR": 0.92, "GBP": 0.75},
    "EUR": {"GBP": 0.85},
    "GBP": {"JPY": 190.0},
    "JPY": {},
}


def test_a_two_hop_route_can_beat_a_direct_one():
    result = best_rate(RATES, "USD", "GBP")
    assert result is not None
    rate, path = result
    assert path == ["USD", "EUR", "GBP"]
    assert round(rate, 4) == round(0.92 * 0.85, 4)


def test_a_three_hop_route():
    result = best_rate(RATES, "USD", "JPY")
    assert result is not None
    rate, path = result
    assert path == ["USD", "EUR", "GBP", "JPY"]
    assert round(rate, 2) == round(0.92 * 0.85 * 190.0, 2)


def test_unreachable():
    assert best_rate(RATES, "JPY", "USD") is None


def test_the_same_currency_is_one_to_one():
    assert best_rate(RATES, "USD", "USD") == (1.0, ["USD"])
