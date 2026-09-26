"""A run of consecutive payments that sums exactly to a refund amount.

Pattern: prefix sums with a hash map
Time:    O(n)
Space:   O(n)
First instinct: every start and every end, O(n^2). The prefix trick is the one
  worth being able to derive: if prefix[j] - prefix[i] == target, then the run
  from i+1 to j is the answer, so store the prefixes seen and look up the
  complement.
Outcome: wrong first, fixed. I forgot to seed the map with {0: -1}, so a run
  starting at index 0 was never found. That is the classic off by one in this
  pattern and the test for it is the first one below.

Amounts can be negative here, because refunds are in the stream, which is exactly
why a sliding window does not work and a prefix map does.
"""


def run_summing_to(amounts: list[int], target: int) -> tuple[int, int] | None:
    """The inclusive index range of the first matching run."""
    # Seeded with prefix 0 at index -1, so a run starting at 0 is findable.
    seen: dict[int, int] = {0: -1}
    running = 0
    for index, amount in enumerate(amounts):
        running += amount
        if running - target in seen:
            return seen[running - target] + 1, index
        # Only the earliest index for a prefix is kept, which yields the longest
        # run rather than the shortest. Either is defensible and it should be a
        # decision rather than an accident.
        seen.setdefault(running, index)
    return None


def test_a_run_starting_at_the_beginning():
    assert run_summing_to([500, 500, 900], 1000) == (0, 1)


def test_a_run_in_the_middle_with_a_refund_in_it():
    assert run_summing_to([900, 500, -200, 700, 100], 1000) == (1, 3)


def test_no_run():
    assert run_summing_to([1, 2, 3], 100) is None


def test_a_single_payment_equal_to_the_target():
    assert run_summing_to([1000], 1000) == (0, 0)
