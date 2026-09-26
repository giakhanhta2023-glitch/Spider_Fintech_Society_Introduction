"""Order service deploys so every dependency ships first.

Pattern: graphs, topological sort with Kahn's algorithm
Time:    O(V + E)
Space:   O(V + E)
First instinct: sort by the number of dependencies, which is wrong in a way that
  looks right on small examples. Kahn's algorithm is the correct version and it is
  eight lines.
Outcome: solved directly.

Returning None on a cycle rather than a partial order is the decision that
matters. A deploy plan that silently omits three services is worse than no plan,
and a dependency cycle between services is a design problem somebody needs to be
told about.
"""

from collections import deque


def deploy_order(dependencies: dict[str, list[str]]) -> list[str] | None:
    """`dependencies[x]` lists what x needs deployed before it.

    Returns None when there is a cycle, because then no valid order exists.
    """
    services = set(dependencies) | {d for deps in dependencies.values() for d in deps}
    remaining = {s: len(set(dependencies.get(s, []))) for s in services}

    dependents: dict[str, list[str]] = {s: [] for s in services}
    for service, deps in dependencies.items():
        for dependency in set(deps):
            dependents[dependency].append(service)

    # Sorted, so the plan is the same every run. An arbitrary order is fine for
    # correctness and useless for a deploy somebody has to review.
    ready = deque(sorted(s for s, count in remaining.items() if count == 0))
    order: list[str] = []

    while ready:
        service = ready.popleft()
        order.append(service)
        for dependent in sorted(dependents[service]):
            remaining[dependent] -= 1
            if remaining[dependent] == 0:
                ready.append(dependent)

    return order if len(order) == len(services) else None


def test_dependencies_ship_first():
    graph = {
        "payments-api": ["card-vault", "ledger"],
        "card-vault": ["kms"],
        "ledger": ["postgres"],
        "reporting": ["ledger"],
    }
    order = deploy_order(graph)
    assert order is not None
    assert order.index("kms") < order.index("card-vault") < order.index("payments-api")
    assert order.index("postgres") < order.index("ledger") < order.index("reporting")


def test_the_order_is_deterministic():
    graph = {"a": ["b", "c"], "b": [], "c": []}
    assert deploy_order(graph) == deploy_order(graph) == ["b", "c", "a"]


def test_a_cycle_has_no_order():
    assert deploy_order({"a": ["b"], "b": ["a"]}) is None


def test_no_services():
    assert deploy_order({}) == []
