# Level 05: The pack that rebuilds itself

> **monthly-close: raw files to a finished pack, in one command** · build project · difficulty 7/10

## Read this second

Attempt the build yourself first, then ask the FinQuest tutor for a hint, and only then open this folder.
Read the part you are stuck on, close the file, and retype the fix from memory. Copying the solution into
your own project skips the only step that actually teaches you anything.

## The brief

It is the third working day. Run one command and get the pack, the chart, the detail behind the revenue, the receivables position, a reconciliation between billing and the ledger, and a reforecast, as one document. If anything is wrong, produce nothing and say why.

**Scope:** Python. Assemble levels 1 to 4 by importing them rather than copying. SQLite for the detail, pandas for the pack, the model for the forecast, markdown for the output.

## Files here

| File | What it is |
|------|------------|
| `monthly-close/close/stages.py` | the six stages, each timed, each with a verdict |
| `monthly-close/close/run.py` | the plan, the stopping, and the exit code |
| `monthly-close/close/document.py` | the pack in reading order, with the causes left to a person |
| `monthly-close/close/_earlier.py` | levels 3 and 4 imported rather than copied, and honest about how |
| `monthly-close/tests/test_close.py` | 9 tests, most of them about stopping rather than running |
| `quiz-key.md` | all 15 drill answers with explanations |

## Run it

```bash
python -m close.run && pytest -q
```

## Why the solution is shaped this way

- Six stages, 258 ms, one document, and an exit code. The exit code is the point: a close that can say "do not send this" is a different thing from a spreadsheet that can only be wrong quietly. The whole command takes about 4.4 seconds, nearly all of it importing pandas and matplotlib.
- A stage has two booleans rather than one. `ok` is whether there is anything to say and `fatal` is whether the close can continue, and the design of the pipeline lives in the gap between them. The reconciliation break is not ok and not fatal, which is the state most pipelines leave out.
- That distinction is tested. The reconciliation finds one month out by 4,820, which is one credit note raised in billing and never posted, and the test asserts both that it reports the break and that it does not stop the close. Treat every difference as fatal and somebody adds a flag to skip the checks; treat none as fatal and a wrong pack goes out with a warning nobody read.
- The earlier levels are imported rather than copied, and `_earlier.py` says in its own docstring that putting sibling folders on sys.path is a compromise for a repository that would otherwise have them as one package. Two copies of the same logic drift apart from the first bug fix onwards, and then the monthly pack and the quarterly pack disagree.
- The database is deleted and rebuilt on every run, so nothing survives between closes. A reporting database that accumulates state is one where last month bad row lives forever, and a close has to be reproducible from the source files alone.
- The document is written in reading order rather than computation order: five numbers, what moved, the detail, what has not been collected, whether billing agrees, what it means for next year, and a footer naming the command and the tie. Writing it in the order the pipeline computed is the most common way a technically correct pack goes unread.
- The strongest test is the one about stopping. A forced failure in stage two is asserted to stop every later stage and to write nothing at all, because a pipeline that stops after writing half a pack has not stopped in any useful sense.

## Where people get stuck

| Symptom | Cause |
|---------|-------|
| The close never finishes | Every difference was made fatal. A break with an owner belongs in the commentary, not in a refusal. |
| A wrong pack went out with a warning | Nothing was fatal. The test is whether the output would be wrong, not how big the number is. |
| The pipeline stopped and half a pack was written | Write outputs only after every stage has passed, and assert the absence of the file in the test. |
| Two packs disagree | The logic was copied between folders and then fixed in one of them. |
| Last month bad row is still in the database | The load appended instead of rebuilding. Delete and rebuild every run. |
| The pack is questioned every month | No provenance. Name the command, the files and the tie difference in the footer. |

## Self-checks the solution satisfies

- python -m close.run completes, exits 0, and writes both the document and the chart
- Every stage reports a time greater than zero
- The pack ties to the ledger inside the pipeline, and the document says so
- The reconciliation finds exactly one month out, 2025-06 by -4,820, and does not stop the close
- The document contains the September numbers and at least one TODO
- All four forecast scenarios run and balance, and the stress case draws the facility in 2026-09
- A forced failure in an early stage stops every later stage and writes no document
- Asking for a month the plan does not cover exits non zero
- The imported modules resolve to the level 3 and level 4 folders rather than to local copies

## How it is marked

| Points | Criterion | Meaning |
|--------|-----------|---------|
| 25 | It assembles | Four levels, one command, nothing copied, and a clear error when a piece is missing. |
| 25 | It refuses | Fatal stops everything and writes nothing. Notes continue and are reported. The split is defensible and tested. |
| 20 | It reconciles | Two systems compared both ways, every difference named, no tolerance hiding anything. |
| 15 | It reads | A document in reading order, causes left to a person, provenance in the footer. |
| 15 | It hands over | A fresh clone runs it. The README has the command, a real run, and what it cannot do. |

---

Part of [FinQuest](../../README.md) · Analyst track, Level 05 of 5
