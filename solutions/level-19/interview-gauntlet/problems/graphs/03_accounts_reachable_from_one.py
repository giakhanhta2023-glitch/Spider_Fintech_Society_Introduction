"""Every account reachable from a starting account.

Pattern: graphs, breadth first search
Time:    O(V + E)
Space:   O(V)
First instinct: recursion, which is correct and risks a stack overflow on a long
  chain. An explicit queue has no depth limit, and in a fraud graph the chains are
  long on purpose.
Outcome: solved directly.

The distance is returned as well as the set, because "who is reachable" is rarely
the real question. "Who is reachable within two hops" is, and it costs one extra
field.
"""

from collections import deque


def reachable_from(transfers: dict[str, list[str]], start: str) -> dict[str, int]:
    """Account to hops from the start, including the start at zero."""
    distances = {start: 0}
    queue = deque([start])
    while queue:
        node = queue.popleft()
        for neighbour in transfers.get(node, []):
            if neighbour not in distances:
                distances[neighbour] = distances[node] + 1
                queue.append(neighbour)
    return distances


GRAPH = {"a": ["b", "c"], "b": ["d"], "c": ["d"], "d": ["e"], "e": [], "z": ["a"]}


def test_reachable_with_distances():
    assert reachable_from(GRAPH, "a") == {"a": 0, "b": 1, "c": 1, "d": 2, "e": 3}


def test_direction_matters():
    assert "z" not in reachable_from(GRAPH, "a")
    assert "a" in reachable_from(GRAPH, "z")


def test_an_isolated_account():
    assert reachable_from(GRAPH, "e") == {"e": 0}


def test_a_long_chain_does_not_recurse():
    chain = {str(i): [str(i + 1)] for i in range(5_000)}
    assert len(reachable_from(chain, "0")) == 5_001
