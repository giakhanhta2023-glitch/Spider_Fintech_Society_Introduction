# Level 10.2: Scala, and the job that runs at four in the morning

> **The same reconciliation, in Scala, agreeing to the cent** · build project · difficulty 7/10

## Read this second

Attempt the build yourself first, then ask the FinQuest tutor for a hint, and only then open this folder.
Read the part you are stuck on, close the file, and retype the fix from memory. Copying the solution into
your own project skips the only step that actually teaches you anything.

## The brief

Rebuild level 10's reconciliation in Scala 3 against the same two files, then prove it by making it agree with the Python engine on every count and every total. Model the disagreements as a closed set the compiler checks, hold money in an opaque type, collect bad rows instead of dying on them, and write the whole thing as transformations over immutable collections.

**Scope:** Uses levels 9 and 10 and their datasets. Scala 3.3 and scala-cli, which is one executable that fetches its own compiler and JVM, plus munit for the tests. No sbt, no Spark, no database. **This is the only Scala in the course** and it is an aside, so level 11 opens on level 10 whether you do this or not.

## Files here

| File | What it is |
|------|------------|
| `recon-scala/src/Money.scala` | an opaque type: compile time safety, no run time object |
| `recon-scala/src/Model.scala` | Movement, Kind, and Break as a closed set |
| `recon-scala/src/Load.scala` | bad rows as values, a changed header as an exception |
| `recon-scala/src/Reconcile.scala` | the passes, the window, and the totals |
| `recon-scala/test/ReconcileTest.scala` | 19 tests, six of them level 10's published figures |
| `quiz-key.md` | all 15 drill answers with explanations |

## Run it

```bash
cd recon-scala && scala-cli test . --server=false --jvm 21
```

## Why the solution is shaped this way

- The verification is the point of this solution. It is not checked by reading it or by its own tests: it is checked by agreeing with level 10's Python engine on the real 16,639 line file. Both report 16,613 ledger movements, 16,639 settlement lines, 16,408 exact matches, 163 converted, 30 differing, and then amount_mismatch 30 at $14.19, currency_rounding 163 at $1,166.77, duplicate_settlement 1 at $104.12, missing_in_ledger 37 at $3,116.61 and unsettled_capture 12 at $1,690.07. Tests written by the same mind that wrote the bug agree with the bug; two independent implementations do not.
- Break is an enum rather than a string, and owner, value and label are three separate exhaustive matches over it. Adding a seventh kind of disagreement breaks all three at compile time, which is three reminders instead of one, and the one you would have forgotten is the routing.
- PendingSettlement is its own case because a capture that has not settled yet is not a break. Counting it as one is how a reconciliation report trains the people reading it to ignore the number at the bottom.
- Loaders return (Vector[Movement], Vector[BadRow]) so one unreadable row does not cost you the other 16,638, but a missing column raises. That is the line between the two kinds of failure: a bad row is expected and collected, a file whose columns moved is a different file and reading column 4 as column 5 silently is much worse than stopping.
- The two engines disagreed exactly once while this was written, and neither was obviously wrong. Python totalled break values as magnitudes and this one netted them, so a line $5.09 over and one $9.10 under came to $4.01 here and $14.19 there. Netting is the bug: it understates the work and lets two errors that happen to cancel look like one small one. There is a test with those two amounts in it now.
- The boundary test was also wrong before it was right. The window is three days and the check is `when.isAfter(cutoff)`, so a capture exactly three days old is already a break, in both engines. Off by one there raises a break a day early on every unsettled capture, every morning.

## Where people get stuck

| Symptom | Cause |
|---------|-------|
| The compile server fails with an exit code and no message | scala-cli picked up an old Java from PATH. `--jvm 21 --server=false` makes it fetch its own and skip bloop. Slower per run, immune to whatever is installed. |
| Thousands of missing settlements | Authorisations are in your ledger side. A hold settles nothing. Only capture, refund and chargeback move money. |
| `"".toLong` throws two thirds of the way through the file | The settlement file leaves the fee column empty on some rows. Money.parse handles it in one line. |
| A bare Long compiles as an amount | The opaque type only protects outside the file that declares it. Inside Money.scala, Cents and Long are the same type, which is the point and also the gap. |

## Self-checks the solution satisfies

- Both files load with no bad rows: 16,613 ledger movements and 16,639 settlement lines
- Kind.parse("authorize") is None, so holds are never counted as unsettled
- A settlement refund arriving positive is a bad row naming the sign convention
- A missing column raises rather than being collected
- Matching reports 16,408 exact, 163 converted and 30 with a different amount
- Exactly one settlement line is a duplicate
- amount_mismatch is 30 lines totalling $14.19, as magnitudes not net
- currency_rounding is 163 lines totalling $1,166.77
- missing_in_ledger is 37 lines totalling $3,116.61
- unsettled_capture is 12 lines totalling $1,690.07
- A capture two days old is pending; three days old is a break
- Two mismatches of +$5.09 and -$9.10 total $14.19, not $4.01
- Money(311661).show is "$3,116.61" and a bare Long will not compile as a Cents

## How it is marked

| Points | Criterion | Meaning |
|--------|-----------|---------|
| 25 | It agrees | Every count and every total matches the Python engine on the real file, asserted in tests. |
| 20 | The disagreements are a closed set | An enum with per case fields, and at least three exhaustive matches over it. |
| 15 | Bad rows are collected | Loaders return failures as values; a changed header still raises. |
| 15 | Nothing is mutated | The reconciliation is transformations over immutable collections, callable from a test. |
| 15 | Policy is visible | The window is a parameter, the totals are magnitudes, and both choices are commented with why. |
| 10 | Money | An opaque type with no run time object, and an empty fee column handled. |

---

Part of [FinQuest](../../README.md) · Level 10.2, an aside rather than one of the 20
