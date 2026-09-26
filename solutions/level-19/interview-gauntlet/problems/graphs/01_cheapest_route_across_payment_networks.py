"""The cheapest route for a payment across intermediary networks.

Pattern: graphs, Dijkstra
Time:    O((V + E) log V)
Space:   O(V + E)
First instinct: breadth first search, which finds the fewest hops rather than the
  cheapest route. Those are different answers and the fewest hops is often the
  expensive one, which is the trap in the question.
Outcome: solved directly.

Fees are non negative, which is what makes Dijkstra valid. If a route could pay
you to use it, this would need Bellman Ford, and saying that unprompted is worth
more than the implementation.
"""

import heapq


def cheapest_route(
    fees: dict[str, dict[str, int]], start: str, destination: str
) -> tuple[int, list[str]] | None:
    """Total fee in minor units, and the route taken."""
    queue: list[tuple[int, str, list[str]]] = [(0, start, [start])]
    settled: set[str] = set()

    while queue:
        cost, node, route = heapq.heappop(queue)
        if node == destination:
            return cost, route
        # A node can enter the queue several times with different costs. The
        # first time it comes out it is settled, and the rest are stale.
        if node in settled:
            continue
        settled.add(node)
        for neighbour, fee in fees.get(node, {}).items():
            if neighbour not in settled:
                heapq.heappush(queue, (cost + fee, neighbour, [*route, neighbour]))
    return None


NETWORKS = {
    "us_bank": {"visa": 30, "swift": 400},
    "visa": {"uk_bank": 25, "sepa": 60},
    "swift": {"uk_bank": 20},
    "sepa": {"uk_bank": 5},
    "uk_bank": {},
}


def test_the_cheapest_route_is_not_the_shortest():
    cost, route = cheapest_route(NETWORKS, "us_bank", "uk_bank")
    assert cost == 55
    assert route == ["us_bank", "visa", "uk_bank"]


def test_no_route():
    assert cheapest_route({"a": {}, "b": {}}, "a", "b") is None


def test_the_start_is_the_destination():
    assert cheapest_route(NETWORKS, "uk_bank", "uk_bank") == (0, ["uk_bank"])
