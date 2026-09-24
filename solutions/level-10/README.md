# Level 10: The processor says one thing, your ledger says another

> **reconcile: the job that runs before anybody arrives** · build project · difficulty 8/10

## Read this second

Attempt the build yourself first, then ask the FinQuest tutor for a hint, and only then open this folder.
Read the part you are stuck on, close the file, and retype the fix from memory. Copying the solution into
your own project skips the only step that actually teaches you anything.

## The brief

Build the reconciliation engine: load the processor's settlement file, match it against your ledger, classify every difference by cause and owner, tie the payouts to the lines, and produce the report a finance team signs off. Then find the 37 payments the processor paid you for that your system has never heard of, and fix the cause rather than the symptom.

**Scope:** Uses levels 4, 6 and 9. Python and pandas, or SQL if you prefer, with the breaks stored in the level 6 database. The settlement and payout files ship with the level.

## Files here

| File | What it is |
|------|------------|
| `recon/load.py` | both sides normalised into one shape, with signs agreed |
| `recon/match.py` | the passes, most certain first, each recording why it matched |
| `recon/classify.py` | break types with owners, and the pending state that is not a break |
| `recon/payouts.py` | every payout tied to the lines that make it up |
| `recon/fees.py` | the contract recomputed, and the effective rate by payment size |
| `recon/queue.py` | stable break ids, first seen, last seen, owner, status |
| `recon/report.py` | the daily report a finance team signs |
| `quiz-key.md` | all 15 drill answers with explanations |

## Run it

```bash
python -m recon.report --settlement data/level-10-settlement.csv --ledger data/level-09-card-events.csv
```

## Why the solution is shaped this way

- Both sides are normalised before anything is compared. Signs are the first trap: the file writes a refund as negative gross and the ledger writes it as a positive refund event, and a single convention chosen at the boundary removes a whole class of confusion.
- Matching runs in passes from certain to probable, and every automatic match records the rule that made it. A match nobody can explain later is not evidence.
- pending_settlement is a classification, not a break. The settlement window is configuration, because the day a processor changes its timing every capture in the country looks broken at once.
- The five results on the shipped data: 16,408 matched exactly, 193 amount mismatches worth $1,180.96 of which 163 are currency rounding, one duplicated line, 37 movements in the file with no ledger record worth $3,116.61, and 12 captures the processor never settled worth $1,690.07.
- The 37 are resolved at the cause rather than by insertion. Every one is a level 9 authorisation that timed out and was approved anyway, so the fix is the resolver, and the break disappears because the entry now exists for a reason.
- Fees are recomputed from the contract rather than trusted. 2.9% plus 30 cents comes out at an effective 3.2851% across the file, and the fixed part is the whole story: 7.03% under $10 against 2.99% over $200.
- Breaks carry an id derived from what they are about, so the job is safe to run twice. A reconciliation that cannot be rerun will be run once, badly, by somebody in a hurry.

## Where people get stuck

| Symptom | Cause |
|---------|-------|
| The match rate is far below 99% | Usually keys or signs. Print ten unmatched rows from each side side by side. |
| Thousands of breaks on the most recent day | Timing counted as breaks. Anything inside the settlement window is pending. |
| Rerunning the job doubles the queue | Break ids are generated from the run rather than from the break. |
| The payout totals do not tie | A duplicated line counted once in one place and twice in another, or a date parsed in the wrong timezone. |
| A break was closed to make the report clean | That is a plug. Leave it open, aged and owned, and write down what has been checked. |

## Self-checks the solution satisfies

- Loading both files produces movements with refunds negative on both sides
- The reconciliation reports 16,408 exact matches
- It reports 193 amount mismatches totalling $1,180.96, with the currency ones separated
- It finds exactly one duplicated settlement line
- It reports 37 movements in the file with no ledger record, totalling $3,116.61
- It reports 12 captures in the ledger that never settled, totalling $1,690.07
- A capture two days old with no settlement line is classified pending, not a break
- The same capture five days old is classified as a break
- Every payout equals the sum of the lines that settled that day
- The fee check recomputes 2.9% plus 30 cents and finds the lines that differ
- The effective rate table reproduces 7.03% under $10 and 2.99% over $200
- Running the whole job twice produces the same open breaks with no duplicates
- Every break has a type, a value and an owner, and none is silently dropped

## How it is marked

| Points | Criterion | Meaning |
|--------|-----------|---------|
| 25 | Matching that works | Named passes, a match rate above 98%, and every automatic match recording the rule that made it. |
| 25 | Classification, not counting | Five break types with owners, timing separated from breaks, and the window configurable. |
| 20 | Repeatable and operable | Stable break ids, a queue with aging, and a second run that changes nothing. |
| 15 | The money checks | Payouts tied to lines, fees recomputed from the contract, effective rate by size. |
| 15 | Judgement | The 37 resolved at the cause, a stated tolerance with its reasoning, and a report a finance team could sign. |

---

Part of [FinQuest](../../README.md) · Level 10 of 20
