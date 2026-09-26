"""Three payments summing to a target, the classic three sum.

Pattern: two pointers inside a loop
Time:    O(n^2)
Space:   O(n) for the sorted copy
First instinct: three nested loops, O(n^3). The improvement is the one worth
  being able to derive live: fix one amount, and the remaining problem is two
  sum on a sorted list, which two pointers solve in one pass.
Outcome: wrong first, fixed. My first version skipped the duplicate handling and
  returned the same triple twice on [0, 0, 0, 0] style input.

O(n^2) is the known bound for this problem. An interviewer asking for better is
usually checking whether you know that, and "I believe n squared is the bound
here" is the right answer.
"""


def three_amounts_summing_to(amounts: list[int], target: int) -> list[tuple[int, int, int]]:
    """Every distinct triple, sorted, with no repeats."""
    ordered = sorted(amounts)
    found: list[tuple[int, int, int]] = []

    for i in range(len(ordered) - 2):
        # Skip a repeated first element, or the same triple is reported twice.
        if i > 0 and ordered[i] == ordered[i - 1]:
            continue
        left, right = i + 1, len(ordered) - 1
        while left < right:
            total = ordered[i] + ordered[left] + ordered[right]
            if total == target:
                found.append((ordered[i], ordered[left], ordered[right]))
                left += 1
                right -= 1
                while left < right and ordered[left] == ordered[left - 1]:
                    left += 1
                while left < right and ordered[right] == ordered[right + 1]:
                    right -= 1
            elif total < target:
                left += 1
            else:
                right -= 1
    return found


def test_finds_a_triple():
    assert three_amounts_summing_to([500, 1000, 1500, 2000], 4500) == [(1000, 1500, 2000)]


def test_duplicates_do_not_produce_the_same_triple_twice():
    assert three_amounts_summing_to([0, 0, 0, 0], 0) == [(0, 0, 0)]


def test_no_triple():
    assert three_amounts_summing_to([1, 2, 3], 100) == []
