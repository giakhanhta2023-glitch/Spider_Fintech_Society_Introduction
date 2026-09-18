# Level 19: Ninety eight percent of your alerts are wrong

> **The monitoring system** · build project · difficulty 9/10

## Read this second

Attempt the build yourself first, then ask the FinQuest tutor for a hint, and only then open this folder.
Read the part you are stuck on, close the file, and retype the fix from memory. Copying the solution into
your own project skips the only step that actually teaches you anything.

## The brief

A small payments firm has 400 customers and a quarter of traffic to review. Build the screening engine, the monitoring rules, the alert queue and the tuning report, and defend the thresholds you chose.

**Scope:** Uses this level plus level 11 (Postgres, append only tables), level 13 (the event log), level 3 (pandas) and level 15's habit of measuring before claiming. All three data files are synthetic and every name in them is invented, including the watchlist.

## Files here

| File | What it is |
|------|------------|
| `monitor/names.py` | normalise, jaro and jaro_winkler, written by hand and checked against a library |
| `monitor/screen.py` | alias expansion, scoring on distinct names, the threshold sweep |
| `monitor/identify.py` | secondary identifiers, discounting on disagreement only |
| `monitor/rules.py` | structuring, pass through, and the corridor rule that finds nothing |
| `monitor/queue.py` | the alert table, the append only event table, and the triage CLI |
| `quiz-key.md` | all 15 drill answers with explanations |

## Run it

```bash
pip install -r requirements.txt && pytest -q && python -m monitor.report
```

## Why the solution is shaped this way

- Aliases are expanded before anything else. Sixty entities are ninety five searchable strings, and screening the primary name alone loses hits without ever saying so.
- Normalisation is four separate rules with a test each: case folding, punctuation, titles and token order. Together they recover five of the seven planted hits, which is the cheapest part of the whole system.
- Jaro-Winkler is implemented rather than imported, then checked against rapidfuzz on a hundred pairs. Choosing between 0.95 and 0.97 is a judgement about the algorithm, and it is not a judgement you can make about a black box.
- The threshold sweep is printed by the code and pasted nowhere. At 0.95 the queue is 182 payments and all seven hits are found; at 0.85 it is 7,081 and still seven; at 1.00 it is five alerts and two designated parties were paid.
- Secondary identifiers discount on disagreement and never on absence, and every discount is stored with its reason rather than dropped. A missing date of birth is not evidence of innocence.
- The structuring rule is reported at two deposits and at three, 16 alerts against 4, so the tuning decision appears in the output rather than in a conversation nobody wrote down.
- The corridor rule ships even though it finds nothing: 514 alerts, no real cases. A negative result that costs an analyst a year is worth writing down.
- Alerts store the rule version in force when they fired, and closing one appends an event. An alert from March has to stay explainable after April changed the thresholds.

## Where people get stuck

| Symptom | Cause |
|---------|-------|
| The sweep numbers are slightly off | Check the normaliser first, since token sorting and title stripping both move scores, then check that aliases were expanded into their own rows. |
| Jaro-Winkler disagrees with the library | The transposition count is the part everybody gets wrong. Halve it, and compare against a pair you worked out on paper. |
| Screening takes minutes | Score distinct names, not payments: 887 against 12,067. Then read the note on blocking before assuming this scales. |
| A real hit got discounted | A secondary identifier rule is firing on absence rather than disagreement. Assert in a test that none of the seven is ever discounted. |

## Self-checks the solution satisfies

- The watchlist expands from 60 rows to 95 searchable strings
- normalise() fixes case, punctuation, titles and word order, one test each
- jaro_winkler agrees with rapidfuzz to six decimal places on a hundred pairs
- The transliteration pair scores 0.9689 and the dropped letter pair scores 0.9867
- Normalised exact matching finds 5 of the 7 planted hits and nothing else
- The sweep produces 182 alerts at 0.95 and 7,081 at 0.85, with all seven hits at both
- A threshold of 0.97 loses exactly one of the seven
- No secondary identifier discount removes any of the seven real hits
- structuring() gives 16 alerts at two deposits and 4 at three, with 4 real in both
- pass_through() gives exactly 3 alerts, all real
- The corridor rule gives 514 alerts and none of them are real
- Closing an alert appends an event and leaves the alert history readable
- Every alert stores the rule_version in force when it fired

## How it is marked

| Points | Criterion | Meaning |
|--------|-----------|---------|
| 25 | Matching done properly | Aliases expanded, normalisation tested rule by rule, Jaro-Winkler implemented and verified against a library. |
| 25 | Measurement | The sweep is computed by the code, both structuring settings are reported, and the corridor rule is shown to find nothing. |
| 20 | Thresholds defended | A chosen threshold with the reason, the date, the data it was measured on, and a below the line sample. |
| 15 | The queue | Alerts carry their evidence and rule version, dispositions append rather than overwrite, and reopening works. |
| 15 | Honesty | The README says what the system does not do, who decides, and how long a held payment makes somebody wait. |

---

Part of [FinQuest](../../README.md) · Level 19 of 10
