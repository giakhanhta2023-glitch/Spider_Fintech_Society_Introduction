# Level 05: The pack that rebuilds itself: quiz answer key

> 15 questions. Pass mark is 12/15 (80%).
> Generated from `content/levels/` by `tools/build_quiz_keys.js`: do not edit by hand.

| # | Answer |
|---|--------|
| 1 | **C** |
| 2 | **A** |
| 3 | **D** |
| 4 | **C** |
| 5 | **B** |
| 6 | **A** |
| 7 | **B** |
| 8 | **B** |
| 9 | **D** |
| 10 | **D** |
| 11 | **A** |
| 12 | **C** |
| 13 | **C** |
| 14 | **A** |
| 15 | **B** |

---

### 1. The reconciliation finds one month out by 4,820. Should it stop the close?

- A. Yes, unless it is under a materiality threshold
- B. Only if it is in the current month
- **C. No: the pack is right, the break has an owner, and it belongs in the commentary** ✅
- D. Yes: a difference means the numbers cannot be trusted

**Why:** A break is a thing somebody has to own, not a reason to publish nothing. Treating every difference as fatal is how a team ends up with a flag that skips the checks.

### 2. What makes a stage fatal rather than a note?

- **A. Whether the output would be wrong if the run continued** ✅
- B. The size of the number involved
- C. Whether it happened in the current month
- D. Whether the person running it has time to fix it

**Why:** An unmapped account means money that appears nowhere in the pack, so the pack would be wrong. A credit note not yet posted leaves the pack correct and needs a sentence.

### 3. Why does the pipeline delete and rebuild the database on every run?

- A. To save disk space
- B. To avoid locking
- C. Because SQLite requires it
- **D. So the close is reproducible from the files alone, and last month's bad row cannot survive** ✅

**Why:** State that accumulates between runs is state nobody can account for. A close has to be reproducible from the source files and nothing else.

### 4. Why import levels 3 and 4 rather than copying their code into the capstone?

- A. Imports are faster
- B. The files are too large
- **C. Two copies of the same logic drift apart from the first bug fix onwards, and then two packs disagree** ✅
- D. Copying would break the tests

**Why:** It is the same lesson as the mapping table and the sign rule: one implementation, one place to fix it. The monthly pack and the quarterly pack disagreeing is how it shows up.

### 5. The reconciliation uses an outer join rather than an inner one. Why?

- A. Outer joins are faster on small tables
- **B. A month present in one system and missing from the other is a finding, and an inner join hides it** ✅
- C. To keep the column order
- D. Because pandas defaults to it

**Why:** In a reconciliation, the missing row is usually the interesting one. An inner join is a decision to only compare what both sides already agree exists.

### 6. Why does the generated document leave every cause as TODO?

- **A. The pipeline knows what moved and cannot know why, and an invented cause is worse than a gap** ✅
- B. The feature is unfinished
- C. To keep the document short
- D. Because the data is synthetic

**Why:** The machine guarantees completeness, which is what a person writing at 7pm gets wrong. The person supplies causation, which is what they are accountable for.

### 7. What is the strongest test of a pipeline that can stop?

- A. That it retries
- **B. That when a stage fails, nothing after it runs and nothing is written** ✅
- C. That it runs successfully on good data
- D. That it logs the failure

**Why:** A pipeline that stops after writing half a pack has not stopped in any useful sense. Assert the absence of the output file, not just the exit code.

### 8. Six stages take 258 ms and the whole command takes about 4.4 seconds. What is the rest?

- A. Writing the document
- **B. Starting Python and importing pandas and matplotlib** ✅
- C. The four forecast scenarios
- D. The database rebuild

**Why:** Import time dominates everything at this size. Knowing that stops anybody optimising the wrong thing, and the honest way to report it is both numbers.

### 9. What belongs in the document's footer?

- A. The analyst's name and the date
- B. A disclaimer about accuracy
- C. The version of Python
- **D. The command that produced it, the files it read, and whether the pack tied** ✅

**Why:** Provenance is what stops a pack being re-litigated every month. A reader who doubts a number gets somewhere to start that is not your inbox.

### 10. The document is written in a different order from the pipeline's computation. Why?

- A. To make the file shorter
- B. To hide the implementation
- C. Because the forecast depends on the pack
- **D. Because a reader wants the five numbers first, and the pipeline has to load the data first** ✅

**Why:** Dependency order and reading order are different problems. Writing the document in computation order is the most common way a technically correct pack goes unread.

### 11. A colleague asks to have the pack emailed automatically overnight. What is the right answer?

- **A. The numbers can run overnight; the document should not go out while it still contains TODO** ✅
- B. Only if the reconciliation is clean
- C. No, automation is unsafe
- D. Yes, it is fully automated

**Why:** Automate the completeness and keep the accountability. Run it on a schedule so the numbers and the exit code are waiting, and have a person spend twenty minutes on the commentary.

### 12. The same 4,820 break appears for three months running. What changes?

- A. Adjust the ledger to match billing
- B. Remove the reconciliation stage
- **C. The commentary: "first seen in June, still open". The break keeps being reported** ✅
- D. Add a threshold so it stops being reported

**Why:** A threshold is where the next real break will hide. Ageing the break in the document keeps the pressure on the fix rather than on the alarm.

### 13. Which reconciliation direction is more dangerous to leave out?

- A. Neither, if the totals match
- B. Billing against the ledger
- **C. The ledger against billing, because it catches revenue booked with no invoice behind it** ✅
- D. They are equivalent

**Why:** Comparing one way finds the things you know about. Revenue in the books with nothing billed is the break that costs the most to explain.

### 14. What is the real test of the handover documentation?

- **A. That somebody else runs it next month from a clean checkout without asking you anything** ✅
- B. That it covers every function
- C. That it is under two pages
- D. That it has a diagram

**Why:** Half of what breaks at a handover breaks because of a file that existed only on the machine it was written on. A fresh clone is the only way to find that.

### 15. What single feature separates this pipeline from the spreadsheet in level 1?

- A. It uses a database
- **B. It can refuse: it stops, writes nothing, and returns a non zero exit code** ✅
- C. It produces charts
- D. It is faster

**Why:** A spreadsheet cannot decline to show you a number. Everything else in this track is a convenience next to that.
