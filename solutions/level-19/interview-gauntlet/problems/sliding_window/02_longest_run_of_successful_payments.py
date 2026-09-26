"""The longest streak of consecutive successful payments.

Pattern: sliding window, degenerate case
Time:    O(n)
Space:   O(1)
First instinct: none worth recording. This is the simplest problem in the set and
  it is here because it is the one people get wrong under pressure, by resetting
  the best value instead of the current one.
Outcome: solved directly.

The mistake to avoid is updating `best` only at the end. A run that finishes at
the last element is the case that catches it.
"""


def longest_successful_run(payments: list[dict]) -> int:
    best = current = 0
    for payment in payments:
        if payment["status"] == "captured":
            current += 1
            best = max(best, current)     # inside the loop, not after it
        else:
            current = 0
    return best


def test_finds_the_longest_run():
    statuses = ["captured", "declined", "captured", "captured", "captured", "declined"]
    payments = [{"status": s} for s in statuses]
    assert longest_successful_run(payments) == 3


def test_the_run_can_end_on_the_last_payment():
    payments = [{"status": "declined"}, {"status": "captured"}, {"status": "captured"}]
    assert longest_successful_run(payments) == 2


def test_nothing_succeeded():
    assert longest_successful_run([{"status": "declined"}]) == 0
