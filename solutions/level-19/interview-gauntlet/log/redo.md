# The redo list

The eight problems that did not come out right the first time, and the date to come
back to them.

**The second attempts have not happened, and the level asks for evidence that they
did.** A week has not passed since these were written, so this file says `not yet`
rather than carrying invented dates. `python -m tools.check_problems` lists them as
outstanding work, and `--require-returns` turns them into a failing build, which is
the flag to put in your own pipeline once this repository is yours. A redo list that
nothing enforces is a list of good intentions.

| problem | first attempt | what went wrong | return by | returned |
|---|---|---|---|---|
| graphs/02_detect_a_cycle_in_a_chain_of_transfers | 2026-09-25 | a visited set instead of three colours, so a diamond read as a cycle | 2026-10-02 | not yet |
| graphs/05_shortest_path_in_a_currency_graph | 2026-09-25 | added the rates instead of multiplying them | 2026-10-02 | not yet |
| hash_map/05_most_frequent_decline_code | 2026-09-25 | most_common broke ties by insertion order | 2026-10-02 | not yet |
| heap/03_running_median_of_payment_amounts | 2026-09-25 | pushed to the smaller heap instead of comparing against the median | 2026-10-02 | not yet |
| intervals/04_maximum_concurrent_holds_on_one_card | 2026-09-25 | processed a start before an end on a tie | 2026-10-02 | not yet |
| prefix_sums/03_subarray_of_payments_summing_to_a_refund | 2026-09-25 | no {0: -1} seed, so a run starting at index 0 was invisible | 2026-10-02 | not yet |
| sorting/01_order_card_events_causally | 2026-09-25 | sorted by timestamp alone, so a capture could precede its authorisation | 2026-10-02 | not yet |
| two_pointers/04_three_amounts_summing_to_target | 2026-09-25 | no duplicate skipping, so the same triple was reported twice | 2026-10-02 | not yet |

## What the eight have in common

Reading them together is more useful than reading any one of them, and the grouping
is the actual output of this file.

**Four are ties and boundaries.** A start and an end at the same instant, a prefix
map with no seed at index zero, two decline codes with equal counts, two events with
equal timestamps. In every case the code was right for the interior and wrong at the
edge, and in every case the failing test was one I only wrote because an earlier
level had taught me the edge existed.

**Two are invariants held wrongly.** The running median pushing to the smaller heap,
and cycle detection with one set instead of three states. Both produce plausible
output on small inputs, which is the dangerous kind of wrong.

**One is a wrong model rather than a wrong implementation.** Adding conversion rates
instead of multiplying them. The code was clean and the arithmetic was meaningless,
and no amount of testing the implementation would have found it: the fix came from
knowing that rates compose by multiplication, which is level 5 rather than level 19.

**One is duplicate handling.** Three sum reporting the same triple twice.

The conclusion is not "practise sliding window more". It is: **when a problem has a
boundary, write the boundary test first.** Four of the eight were at an edge, and
the edge is where the interviewer's follow up question goes.

## The rule for coming back

Redo it from the question, with the file closed. Reading a solution and nodding is
the thing that feels like practice and is not: the second attempt is evidence only
if nothing was open.

One more rule, learned from the one that is not on this list.
`sliding_window/03_smallest_window_with_every_decline_code` is recorded as solved
directly **with a wrong test**: the code returned the earliest of two equally short
windows and my test asserted the later one. The code was right and my expectation
was not. That is the good version of this mistake, and in an interview the answer is
to say "both are valid, which do you want" rather than to change the code.
