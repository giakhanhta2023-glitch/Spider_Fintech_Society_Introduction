# The log

Every attempt, with its outcome. The rule that makes it worth keeping: **the
failures go in first**, because a log of successes is a trophy cabinet and tells
you nothing about what to practise.

## Read this before reading the table

**The minutes column is empty, and that is a real gap in this repository rather
than a formatting choice.** These forty files are reference solutions written for
the course, in one sitting, with no clock running. Your log must have real minutes
in it, because the minutes are the whole point: they are what tells you that
sliding window problems take you twice as long as hash map problems, which is the
one fact that makes practice targeted instead of random.

What is honest here is the **outcome** column, and it is taken from each file's own
`Outcome:` line by `tools/check_problems.py`, so the log and the files cannot drift
apart. 8 of the 40 did not come out right the first time, and each one
says what went wrong in the file where it happened.

## How to use it for real

| Column | What goes in it |
|---|---|
| date | The day of the attempt. Not the day you tidied the file |
| problem | Directory and file, so the log links to the code |
| minutes | Wall clock from reading the question to the tests passing. Round up |
| outcome | `solved`, `solved with a self hint`, or `failed`. Three values, no prose |

Three outcomes and no more. "Nearly" and "solved but messy" are ways of not
writing `failed`, and `failed` is the only entry that changes what you do next.

**A self hint** means you looked at your own notes, the pattern list, or a previous
solution. It counts as different from solved, because in the interview those are
not available.

## The log

| date | problem | minutes | outcome |
|---|---|---|---|
| 2026-09-25 | graphs/01_cheapest_route_across_payment_networks | - | solved directly |
| 2026-09-25 | graphs/02_detect_a_cycle_in_a_chain_of_transfers | - | wrong first, fixed |
| 2026-09-25 | graphs/03_accounts_reachable_from_one | - | solved directly |
| 2026-09-25 | graphs/04_order_microservice_deploys | - | solved directly |
| 2026-09-25 | graphs/05_shortest_path_in_a_currency_graph | - | wrong first, fixed |
| 2026-09-25 | hash_map/01_duplicate_references | - | solved directly |
| 2026-09-25 | hash_map/02_first_non_repeated_merchant | - | solved directly |
| 2026-09-25 | hash_map/03_two_payments_summing_to_target | - | solved directly |
| 2026-09-25 | hash_map/04_files_are_anagrams_by_reference | - | solved directly |
| 2026-09-25 | hash_map/05_most_frequent_decline_code | - | wrong first, fixed |
| 2026-09-25 | heap/01_top_ten_refunds_from_a_stream | - | solved directly |
| 2026-09-25 | heap/02_merge_k_sorted_settlement_files | - | solved directly |
| 2026-09-25 | heap/03_running_median_of_payment_amounts | - | wrong first, fixed |
| 2026-09-25 | heap/04_kth_largest_chargeback | - | solved directly |
| 2026-09-25 | heap/05_schedule_payouts_by_priority | - | solved directly |
| 2026-09-25 | intervals/01_merge_overlapping_authorisation_holds | - | solved directly |
| 2026-09-25 | intervals/02_free_capacity_in_a_payout_schedule | - | solved directly |
| 2026-09-25 | intervals/03_insert_a_hold_into_a_sorted_list | - | solved directly |
| 2026-09-25 | intervals/04_maximum_concurrent_holds_on_one_card | - | wrong first, fixed |
| 2026-09-25 | intervals/05_minimum_batches_covering_settlement_windows | - | solved directly |
| 2026-09-25 | prefix_sums/01_balance_as_of_any_date | - | solved directly |
| 2026-09-25 | prefix_sums/02_days_the_balance_went_negative | - | solved directly |
| 2026-09-25 | prefix_sums/03_subarray_of_payments_summing_to_a_refund | - | wrong first, fixed |
| 2026-09-25 | prefix_sums/04_largest_single_day_movement | - | solved directly, after reading the question twice on purpose |
| 2026-09-25 | prefix_sums/05_fee_totals_between_two_dates | - | solved directly |
| 2026-09-25 | sliding_window/01_highest_24_hour_volume | - | solved directly |
| 2026-09-25 | sliding_window/02_longest_run_of_successful_payments | - | solved directly |
| 2026-09-25 | sliding_window/03_smallest_window_with_every_decline_code | - | solved directly, with a wrong test |
| 2026-09-25 | sliding_window/04_rolling_average_latency | - | solved directly, with a note |
| 2026-09-25 | sliding_window/05_count_windows_over_a_velocity_limit | - | solved directly |
| 2026-09-25 | sorting/01_order_card_events_causally | - | wrong first, fixed |
| 2026-09-25 | sorting/02_group_payments_by_merchant_then_day | - | solved directly |
| 2026-09-25 | sorting/03_sort_by_amount_with_reference_tie_break | - | solved directly |
| 2026-09-25 | sorting/04_first_gap_in_a_sequence_of_ids | - | solved directly |
| 2026-09-25 | sorting/05_custom_order_for_settlement_currencies | - | solved directly |
| 2026-09-25 | two_pointers/01_merge_two_sorted_event_streams | - | solved directly |
| 2026-09-25 | two_pointers/02_remove_duplicate_refunds_in_place | - | solved directly |
| 2026-09-25 | two_pointers/03_nearest_pair_of_amounts | - | solved directly |
| 2026-09-25 | two_pointers/04_three_amounts_summing_to_target | - | wrong first, fixed |
| 2026-09-25 | two_pointers/05_longest_common_prefix_of_reference_formats | - | solved directly |

## What the outcomes say

32 of 40 came out right on the first attempt. The
8 that did not are on the redo list, and they cluster: three of them are
off by one errors at a boundary, which is the pattern in my own mistakes rather
than a pattern in the problems.

A log with no failures in it means the problems were too easy or the log is not
honest. Either way it is not telling you where to spend the next week.
