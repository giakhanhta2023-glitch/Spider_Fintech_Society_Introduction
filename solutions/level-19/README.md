# Level 19: The screen that filters you out

> **interview-gauntlet: forty problems, four exercises, one honest log** · build project · difficulty 9/10

## Read this second

Attempt the build yourself first, then ask the FinQuest tutor for a hint, and only then open this folder.
Read the part you are stuck on, close the file, and retype the fix from memory. Copying the solution into
your own project skips the only step that actually teaches you anything.

## The brief

A repository that is a record of practice rather than a product. Forty problems solved with tests and complexities, the five measured complexity comparisons reproduced on your own machine, four timed practical exercises with submission notes, five behavioural stories, and a log honest enough to be useful.

**Scope:** Six weeks part time, following the schedule. The log is the deliverable that makes it real, and it is the only part that cannot be faked by copying solutions.

## Files here

| File | What it is |
|------|------------|
| `complexity/measure.py` | the five comparisons, at three sizes where it matters |
| `problems/` | forty files, eight patterns, each with tests and a stated complexity |
| `exercises/api_integration/` | timeouts, safe retries, jitter, and the test that counts charges |
| `exercises/bug_hunt/` | a one line money bug in unfamiliar code, and how it was found |
| `exercises/feature_addition/` | paging added in the conventions already there |
| `exercises/pr_review/` | a 68 line diff with ten real problems, and the review of it |
| `tools/check_problems.py` | the checker that fails the build when the discipline slips |
| `log/LOG.md` | every attempt, and what the empty minutes column means |
| `log/redo.md` | the eight that went wrong, grouped by what they have in common |
| `stories/STAR.md` | five stories with numbers that can be re-run |
| `quiz-key.md` | all 15 drill answers with explanations |

## Run it

```bash
pytest -q && python -m tools.check_problems && python -m complexity.measure
```

## Why the solution is shaped this way

- The complexity work is measured at three sizes rather than one, because one size cannot tell a constant factor from a change of class. Reconciling two files: 2,000 rows a side took 119.9 ms nested against 0.8 ms indexed, and 8,000 rows took 4,300.6 ms against 4.7 ms. Four times the rows made the nested version 36 times slower, which is worse than quadratic growth predicts, because at 8,000 the inner list no longer fits in cache.
- Extrapolation is what makes it land. At 8,000 rows a side the nested version takes 4.3 seconds, and a real settlement file has a million rows, so the quadratic version is around 36 hours while the indexed version stays under a second.
- The string concatenation comparison turned out to change kind as it grows: 1.8x at 25,000 lines, 2.5x at 50,000, 11.6x at 100,000 and 21.1x at 200,000. CPython extends a string in place while it holds the only reference, and once the buffer is a few megabytes the allocator cannot, so every append copies. The level text was corrected to match the measurement.
- Every problem file carries the same header: problem, pattern, time, space, first instinct and outcome. The first instinct line is the point of the repository, because anybody can paste forty correct solutions and the line saying what you reached for first is what makes it a record of learning.
- Eight of the forty went wrong the first time, and the redo list groups them rather than listing them: four were ties or boundaries, two were invariants held wrongly, one was a wrong model rather than a wrong implementation, and one was duplicate handling. The conclusion is to write the boundary test first, which is worth more than any individual fix.
- One problem is filed under the wrong pattern on purpose. The level lists grouping payments under sorting and the right answer is a hash map, and recognising that the obvious family is the wrong family is the skill being practised.
- The API integration exercise is scored on one test: the fake processor creates the charge and then times out, and the assertion is that the processor ends up with one charge. Asserting that the client retried would prove nothing about the money.
- The pull request review exercise has ten problems planted in 68 lines, every one of which would pass review at a company that had not read levels 4 through 17. The review is ordered by what would hurt: irreversible, then wrong money, then leaked data, then privileges, then speed.
- The repository checks itself, and the checker has its own lesson attached. Its first version counted any two dates in a redo row, which the "return by" column satisfied on its own, so it reported green while every second attempt was outstanding. A check with a loophole is worse than no check.
- What cannot honestly be provided is stated rather than faked. The log has no minutes because these were written rather than attempted under a clock, the second attempts are scheduled and outstanding, and the behavioural stories are drawn from building this course and say plainly that yours have to be yours.

## Where people get stuck

| Symptom | Cause |
|---------|-------|
| Three hundred problems solved and still failing screens | Breadth without a record. Forty with a log beats three hundred skimmed, because the log is what makes the repetition targeted. |
| The pattern arrives ten minutes in | Not enough repetition on the ones you got wrong. That is what the redo list is for, and why it has dates. |
| A memorised solution collapsed on the follow up | Memorise the eight patterns and the shape of each, never the solutions. |
| The complexity was recited rather than understood | Measure it at three sizes. One size cannot distinguish a constant factor from a class change. |
| The practical exercise was a happy path | No timeout, no retry, no failure handling. In payments that is the wrong answer even when it works. |
| The retry made a second payment | The idempotency key was generated inside the retry loop rather than once per payment. |
| The behavioural answers had no numbers in them | A story with no number is an opinion about yourself. Every one needs a measurement and a change made afterwards. |
| The log looks perfect | Then it is not a log. A record with no failures in it is a trophy cabinet and tells you nothing about what to practise. |

## Self-checks the solution satisfies

- Every problem file has a test that passes
- Every problem file states a time and a space complexity
- Every problem file names one of the eight patterns
- The log has an entry for every attempt, including the failures
- Every problem on the redo list has at least two dated attempts
- The API integration exercise sets a timeout on every call
- The API integration exercise retries with backoff and jitter, and the retry is proven safe by a test
- Each practical exercise has a submission note naming what was skipped
- Each behavioural story contains a number and a change made afterwards

## How it is marked

| Points | Criterion | Meaning |
|--------|-----------|---------|
| 20 | Complexity felt, not recited | Your own timings at several sizes, with class changes distinguished from constant factors. |
| 30 | Forty problems | Tests, complexities, named patterns, and the first instinct recorded even when wrong. |
| 20 | An honest log | Every attempt with time and outcome, a redo list, and evidence of returning to failures. |
| 20 | Practical exercises | Four completed under time, with failure handling in the integration one and a submission note on each. |
| 10 | The spoken half | Five stories with numbers, one recording of yourself, and two mock interviews with written feedback. |

---

Part of [FinQuest](../../README.md) · Level 19 of 20
