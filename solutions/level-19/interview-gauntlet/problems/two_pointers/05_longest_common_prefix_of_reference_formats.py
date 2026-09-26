"""The longest common prefix across a set of reference formats.

Pattern: two pointers, column by column
Time:    O(total characters)
Space:   O(1) beyond the answer
First instinct: sort the list and compare only the first and last, which works
  and costs a sort. Scanning column by column is linear and stops at the first
  disagreement.
Outcome: solved directly.

Why a payments system cares: processors prefix references by environment and by
acquirer, so the common prefix is how you detect a file from the wrong
environment before importing it. A test file imported into production is a very
bad morning.
"""


def longest_common_prefix(references: list[str]) -> str:
    if not references:
        return ""
    shortest = min(references, key=len)
    for i, character in enumerate(shortest):
        for reference in references:
            if reference[i] != character:
                return shortest[:i]
    return shortest


def test_finds_the_common_prefix():
    assert longest_common_prefix(["prod_acq1_001", "prod_acq1_002"]) == "prod_acq1_00"


def test_no_common_prefix():
    assert longest_common_prefix(["prod_1", "test_1"]) == ""


def test_one_reference_is_its_own_prefix():
    assert longest_common_prefix(["prod_1"]) == "prod_1"


def test_empty_list():
    assert longest_common_prefix([]) == ""
