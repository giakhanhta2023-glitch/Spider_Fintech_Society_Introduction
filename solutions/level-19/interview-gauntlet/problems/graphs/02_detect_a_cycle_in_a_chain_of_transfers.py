"""Is there a cycle in a chain of transfers between accounts?

Pattern: graphs, depth first search with three colours
Time:    O(V + E)
Space:   O(V)
First instinct: a visited set, which finds a node twice and cannot tell a cycle
  from a diamond. The fix is three states rather than two: unvisited, in progress,
  and finished.
Outcome: wrong first, fixed. My first version used one set and reported a cycle
  for A to B, A to C, B to D, C to D, which is not a cycle at all. The test for it
  is the second one below.

Circular transfers are a real money laundering pattern and also a real bug: a
chain of internal transfers that loops is a balance that never settles.
"""


def has_cycle(transfers: dict[str, list[str]]) -> bool:
    WHITE, GREY, BLACK = 0, 1, 2
    colour: dict[str, int] = {}

    def visit(node: str) -> bool:
        colour[node] = GREY                      # on the current path
        for neighbour in transfers.get(node, []):
            state = colour.get(neighbour, WHITE)
            if state == GREY:                    # back edge: a real cycle
                return True
            if state == WHITE and visit(neighbour):
                return True
        colour[node] = BLACK                     # finished, and reachable again
        return False

    return any(colour.get(node, WHITE) == WHITE and visit(node) for node in transfers)


def test_a_cycle_is_found():
    assert has_cycle({"a": ["b"], "b": ["c"], "c": ["a"]}) is True


def test_a_diamond_is_not_a_cycle():
    assert has_cycle({"a": ["b", "c"], "b": ["d"], "c": ["d"], "d": []}) is False


def test_a_self_transfer_is_a_cycle():
    assert has_cycle({"a": ["a"]}) is True


def test_no_transfers():
    assert has_cycle({}) is False
