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
| `bench/complexity.py` | the five comparisons, timed on your own machine |
| `problems/` | forty files, each with a test, a complexity and a named pattern |
| `exercises/` | four practical exercises, timed, each with a submission note |
| `log.md` | every attempt: date, minutes, outcome |
| `redo.md` | the failures, with the dates you came back to them |
| `stories.md` | five STAR stories, each with a number in it |
| `quiz-key.md` | all 15 drill answers with explanations |

## Run it

```bash
python -m bench.complexity && pytest -q problems/
```

## Why the solution is shaped this way

- Complexity is felt before it is studied. The level 10 reconciliation matched two 8,000 row files in 8,528.3 ms with nested loops and 7.0 ms with a dictionary index, and at 2,000 rows the same pair was 187.2 ms against 1.1 ms.
- The growth is reported honestly rather than theoretically. Four times the rows made the nested version forty five times slower, not sixteen, because the inner list stopped fitting in cache. Complexity describes the number of operations; the cost of each one moves too.
- The extrapolation is the argument: at a million rows a side, quadratic matching is about 36 hours and indexed matching is under a second. That is why the expected answer is a dictionary, said in the first minute.
- Four more comparisons separate class changes from constant factors: list against set membership at 19,708.9 ms against 6.82 ms, grouping by repeated filtering at 9,527.8 ms against 59.1 ms in one pass, sorting for a top ten at 309.1 ms against 41.8 ms with a heap, and string concatenation at 195.2 ms against 82.8 ms with join. The first two grow without limit; the last two do not.
- Every problem file records the first instinct, including when it was wrong, because that note is the most useful line in the file a week later.
- The log includes failures with times, and the redo list has at least two dated attempts per entry. Repetition on what was got wrong is the mechanism; the log is what keeps it targeted.
- The practical exercises are built rather than found, because building them teaches what they test. The API integration one is required to have a timeout, backoff with jitter, and a test proving the retry is safe.

## Where people get stuck

| Symptom | Cause |
|---------|-------|
| Three hundred problems and still failing screens | No record of the failures, so the practice was never targeted. |
| Solved it but did not pass | Silence. The approach and its complexity go out loud before any code is written. |
| Ran out of time optimising | A working slow answer first, said to be slow, then improved. Correct beats elegant. |
| The practical exercise was unfinished and scored badly | No submission note. Say what breaks, why, and what you would do next. |
| The failure story sounded rehearsed and empty | No number and no change afterwards. Use one of your own levels. |

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

Part of [FinQuest](../../README.md) · Level 19 of 10
