# interview-gauntlet

Forty problems with tests, five measured complexity comparisons, four practical
exercises, a log, and five stories with numbers in them.

```bash
pip install pytest
pytest -q                          # 163 tests
python -m tools.check_problems     # the repository checks itself
python -m complexity.measure       # the five comparisons, about two minutes
python -m complexity.measure --quick
```

## Read this first: what a solution to level 19 can and cannot be

The deliverable of this level is **a record of practice**, and a record of practice
cannot be handed to you. So this repository is honest about which half is which:

| Part | What it is here |
|---|---|
| The five complexity comparisons | **Measured**, on this machine, reproducible with one command |
| Forty problems with tests and complexities | **Real work**: solutions, tests, stated complexity, named pattern, and the first instinct recorded including when it was wrong |
| The four practical exercises | **Built and tested**, with a submission note each |
| The log | **The format, and my honest outcomes.** The minutes column is empty, because these were written rather than attempted under a clock |
| The redo list | **The eight that went wrong**, with the second attempts outstanding and a check that fails until they happen |
| Five behavioural stories | **Mine**, drawn from building this course, with numbers that can be re-run. Yours have to be yours |
| Two mock interviews with a person | **Not here.** There is no way to fake a conversation with another human being, and the level is right to ask for it |

The parts that are missing are missing loudly. `log/LOG.md` opens by saying the
minutes are absent and why that matters; `log/redo.md` says the second attempts have
not happened; `stories/STAR.md` ends by telling you not to use them.

## 1. Complexity, as something you can feel

Measured with `python -m complexity.measure` on one Windows laptop, Python 3.11.9.

**The reconciliation, at three sizes**, which is where the growth is visible rather
than asserted:

| Rows each side | Nested loops | Dictionary index | Ratio |
|---|---|---|---|
| 2,000 | 119.9 ms | 0.8 ms | 153x |
| 4,000 | 545.1 ms | 1.5 ms | 361x |
| 8,000 | **4,300.6 ms** | **4.7 ms** | **911x** |

Four times the rows made the nested version **36 times slower**, which is worse than
the 16 times quadratic growth predicts. The extra comes from memory: at 2,000 rows
the inner list still sits in cache and at 8,000 it does not, so each comparison
costs more as well as there being more of them. The indexed version grew about six
times across the same range, roughly linear with its own cache penalty.

Extrapolating is the part that makes it real. A settlement file has about a million
rows, which is 125 times eight thousand, so the quadratic version is **roughly 36
hours** and the indexed version stays under a second.

**The other four**, at the sizes in the file:

| Task | The obvious way | The right way | Ratio | Kind |
|---|---|---|---|---|
| 10,000 membership checks over 100,000 references | a list: 52,693.9 ms | a set: 3.44 ms | **15,314x** | class change |
| Group 200,000 payments by merchant, 500 merchants | filter per merchant: 12,723.1 ms | one pass: 122.6 ms | **104x** | class change |
| Top 10 of 200,000 | sort everything: 515.5 ms | a heap of 10: 149.5 ms | 3.4x | constant factor |
| Build a 200,000 line export | string +=: 4,257.8 ms | `"".join(...)`: 201.5 ms | 21.1x | **see below** |

## 2. The measurement that changed the lesson

The level classifies the string concatenation comparison as a constant factor, worth
knowing and bounded. Measuring it at four sizes says otherwise:

| Lines | `+=` | `join` | Ratio |
|---|---|---|---|
| 25,000 | 32.7 ms | 17.7 ms | 1.8x |
| 50,000 | 78.2 ms | 30.8 ms | 2.5x |
| 100,000 | 509.9 ms | 44.0 ms | 11.6x |
| 200,000 | 4,257.8 ms | 201.5 ms | 21.1x |

`join` grows linearly. `+=` grows 2.4x, then 6.5x, then 8.3x for each doubling,
which is the shape of quadratic behaviour arriving.

The reason is CPython's in place concatenation optimisation. When a string has one
reference, `s += t` can extend the existing buffer instead of copying, and that is
why the small sizes look like a modest constant factor. Once the buffer is a few
megabytes the allocator can no longer extend it in place, every append copies the
whole string, and the optimisation stops rescuing the algorithm.

**One measurement at one size cannot tell a constant factor from a class change**,
which is exactly the distinction the level says matters most. This one looked like a
2x annoyance at 25,000 lines and is a 21x problem at 200,000. The level's own text
has been corrected to match this measurement.

## 3. Forty problems

Eight patterns, five problems each, one file per problem with its tests, complexity
and pattern inside it.

```
problems/hash_map/         duplicates, first non repeated, two sum, anagrams, mode
problems/two_pointers/     merge, dedupe in place, nearest pair, three sum, prefix
problems/sliding_window/   rolling volume, longest run, smallest window, average, velocity
problems/heap/             top k from a stream, merge k files, running median, kth, priority
problems/sorting/          causal order, group by, tie breaks, first gap, custom order
problems/prefix_sums/      balance as of, negative days, subarray sum, largest day, fee range
problems/graphs/           cheapest route, cycle, reachable, deploy order, currency path
problems/intervals/        merge holds, free capacity, insert, max concurrent, min batches
```

Every file carries the same header, and `tools/check_problems.py` fails the build if
one does not:

```
Problem: ...
Pattern: hash map
Time:    O(n)
Space:   O(n)
First instinct: sort the references and scan for equal neighbours. Correct, and
  O(n log n) for no benefit, because counting does not need order.
Outcome: solved directly.
```

**The first instinct line is the point of the repository.** Anybody can paste forty
correct solutions. The line that says what you reached for before you reached for
the right thing is the one that makes it a record of learning, and it is the line
that makes the redo list useful a week later.

**Eight of the forty went wrong the first time**, and they are in `log/redo.md`
grouped by what they have in common rather than listed: four were ties or
boundaries, two were invariants held wrongly, one was a wrong model rather than a
wrong implementation, and one was duplicate handling. The conclusion that falls out
of the grouping is worth more than any individual fix: **when a problem has a
boundary, write the boundary test first.**

One problem is filed under the wrong pattern on purpose. The level lists "group
payments by merchant then by day" under sorting, and the right answer is a hash map.
Recognising that the obvious family is the wrong family is the skill, so the header
says sorting and the code does not sort.

## 4. The four exercises

| Exercise | What it demonstrates | Tests |
|---|---|---|
| `api_integration/` | Timeouts on every call, safe retries, backoff with full jitter, a budget | 11 |
| `bug_hunt/` | Diagnosing a one line money bug in unfamiliar code | 5 |
| `feature_addition/` | Adding paging in the conventions already there | 6 |
| `pr_review/` | Reading a 68 line diff and finding the six things that matter | prose |

Each has a `NOTES.md` saying what was done, what was skipped and what is next,
because that note is what turns an unfinished exercise into a demonstration of
judgement.

**The API exercise is the one the level singles out**, and the test it is scored on
is `test_a_retried_timeout_creates_one_charge`. The fake processor creates the
charge and then times out, which is the case that turns a naive retry into a double
payment, and the assertion is that the processor ends up with **one** charge.
Asserting that the client retried would prove nothing about the money.

The dangerous line in that client is the idempotency key, generated once per payment
outside the retry loop. Move it inside and every timeout becomes a double charge,
and no test that only checks "did it retry" would notice.

**The pull request review** is the exercise most people treat as a formality. The
diff under review has ten problems in it and every one of them would pass review at
a company that had not read levels 4 through 17: a float fee, a card number in a log
line, a PAN in the ledger, net instead of gross, `s3:*` on `*`, a migration with
three separate hazards in it, a query per payment, and a merchant id as a metric
label. The review is ordered by what would hurt: irreversible, then wrong money,
then leaked data, then privileges, then speed.

## 5. What the repository checks about itself

```bash
python -m tools.check_problems                     # lists the outstanding redos
python -m tools.check_problems --require-returns   # and fails on them
```

- forty problems, five per pattern
- every file states a time and a space complexity
- every file names one of the eight patterns, and matches the directory it is in
- every file records a first instinct and an outcome, and has a test
- every problem appears in the log, and every log entry has a file
- every exercise note says what was skipped and what is next

The redo check has a story attached. Its first version counted any two dates in the
row, which the "return by" column satisfied on its own, so it reported green while
every second attempt was outstanding. **A check with a loophole is worse than no
check, because it reports green.** It now reads the `returned` column and nothing
else, and `--require-returns` is the flag to put in your own pipeline.

## 6. What is missing, and what I would do about it

- **The minutes.** Every log entry should have a wall clock time, and these do not.
  The minutes are what tell you that sliding window problems take you twice as long
  as hash map problems, which is the one fact that makes practice targeted.
- **The second attempts.** Eight problems are due back on 2026-10-02 and the check
  says so.
- **The recording.** The level asks for one recording of yourself narrating a
  solution. It is the single most uncomfortable item in the whole course and the one
  with the highest return, because everybody discovers the same thing: the silences
  are longer than they feel.
- **Two mock interviews with a person.** No repository can contain these.

---

Part of [FinQuest](../../../README.md) level 19.
