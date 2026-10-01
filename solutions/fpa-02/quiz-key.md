# Level 02: The part you used to do by hand: quiz answer key

> 15 questions. Pass mark is 12/15 (80%).
> Generated from `content/levels/` by `tools/build_quiz_keys.js`: do not edit by hand.

| # | Answer |
|---|--------|
| 1 | **D** |
| 2 | **C** |
| 3 | **D** |
| 4 | **A** |
| 5 | **B** |
| 6 | **A** |
| 7 | **B** |
| 8 | **A** |
| 9 | **B** |
| 10 | **D** |
| 11 | **A** |
| 12 | **C** |
| 13 | **C** |
| 14 | **B** |
| 15 | **C** |

---

### 1. Why is `df["amount"].sum()` dangerous on a column that contains `(700,200.00)`?

- A. It treats the brackets as a positive number
- B. It raises a TypeError that is easy to miss
- C. It rounds to the nearest thousand
- **D. One text value makes the whole column object dtype, so the sum silently skips or concatenates rather than adding** ✅

**Why:** Nothing raises. The column type changed, the sum returns a plausible number, and the only thing that catches it is a check that knows what the answer should be.

### 2. The loader says "2 text amounts repaired" out of 318 rows. An earlier version said 318. What was it measuring?

- A. A caching bug in pandas
- B. The number of rows in the file
- **C. The column dtype: with one text value present, every value in the column is a string, including the good ones** ✅
- D. The number of rows with a comma anywhere

**Why:** It counted values that were not int or float, which after the dtype changes is all of them. Counting what a plain conversion would throw away is the measure that means something.

### 3. Where should the sign rule that flips revenue live?

- A. In the source file, corrected before loading
- B. In the chart, so the raw numbers stay untouched
- C. In every aggregation that touches revenue
- **D. In one line in the loader, where the data arrives** ✅

**Why:** Once, at the boundary. Editing the source file loses the fix on the next export, and scattering the rule guarantees one place misses it.

### 4. A lookup table gains one duplicate row and revenue rises by a third. What happened?

- **A. The merge matched each invoice to both copies of that customer, so those invoices appear twice** ✅
- B. The amounts were stored as text
- C. pandas summed the duplicate column twice
- D. The index was reset incorrectly

**Why:** A one to many join where you assumed one to one. No error, no warning, and a total that is wrong by exactly the duplicated rows. `validate="many_to_one"` turns it into an exception.

### 5. Which of these should be fatal rather than a warning?

- A. A duplicate journal that was removed
- **B. An account code in the ledger that the mapping has never seen** ✅
- C. A cost centre with a budget and no actuals
- D. A credit note in billing that is not in the ledger

**Why:** An unmapped code is money in the ledger that appears nowhere in the pack, so the pack would be wrong. The other three leave the pack correct and need saying in the commentary.

### 6. Why does the check cell build its two sides by different routes?

- **A. So it can catch a line that is in the mapping and missing from the layout, which is how packs actually drift** ✅
- B. Because pandas cannot sum the same frame twice
- C. To handle rounding differences
- D. For speed

**Why:** Comparing a number to itself proves nothing. One side walks the layout, the other walks the data, and the difference between them is the class of error that silently drops a line.

### 7. What does `test_the_check_catches_a_dropped_pack_line` prove?

- A. That the ledger is clean
- **B. That the check works, by breaking the pack on purpose and asserting the check complains** ✅
- C. That the pack is correct
- D. That pandas merges are safe

**Why:** A check that has never failed might be checking nothing. Making it fail on demand is the only way to know which kind you have.

### 8. Why does the generated memo write "TODO: why" instead of an explanation?

- **A. Because the script knows what moved and cannot know why, and an invented cause is worse than a blank one** ✅
- B. Because the data is synthetic
- C. Because the feature is unfinished
- D. To keep the file short

**Why:** The explanation is what you are accountable for. What the script can do is guarantee that no material variance is ever missing from the list, which is exactly what a person writing at 7pm gets wrong.

### 9. The pack takes 39 ms and the command takes about three seconds. Where does the rest go?

- A. Writing the output
- **B. Starting Python and importing pandas** ✅
- C. The checks
- D. Reading the CSV files

**Why:** Import time dominates anything this small. It is worth knowing before optimising: for a monthly pack neither number matters, and speed was never the reason to automate it.

### 10. Why `.get(line, 0.0)` rather than joining the actual and budget frames?

- A. pandas cannot join on strings
- B. It avoids duplicating the index
- C. Joins are slower
- **D. A join drops the line that exists on only one side, and that line, CC600, is the interesting one** ✅

**Why:** An inner join is a decision to hide unmatched rows. In finance the unmatched row is usually the finding: a budget with no actuals is a team that was never hired.

### 11. What does an exit code of 1 from the pack script mean?

- **A. The pack did not tie or a gate was fatal, so nobody should send it** ✅
- B. The month was not found
- C. One check failed
- D. One row was dropped

**Why:** It is the automated form of the red check cell. A scheduler or a colleague can act on it without reading the output, which a spreadsheet cannot offer.

### 12. Why `dtype={"account_code": str}` when reading the CSV?

- A. pandas cannot group by integers
- B. It is faster than inferring the type
- **C. Read as a number, a code with a leading zero loses it and stops matching the other file** ✅
- D. Strings use less memory

**Why:** The day somebody adds account 0450, an inferred integer column turns it into 450 and the join quietly finds nothing.

### 13. The repair line reads "0 duplicate journals removed" this month, and "1" for the last six months. What is that?

- A. A bug in the loader
- B. Proof that the accountant fixed the ledger
- **C. Information: the export changed, and the change needs explaining before the numbers do** ✅
- D. Good news, and nothing to do

**Why:** It might be the fix, and it might be a different export with a different problem. A repair line that changes is a question, and asking it takes a minute.

### 14. A material variance is defined here as 25,000 or more. Where should that number live?

- A. In the CSV file
- **B. In one named constant, so the threshold is visible and changing it is one edit** ✅
- C. In each function that needs it
- D. Nowhere: judge each one by eye

**Why:** A threshold that lives in three places becomes three thresholds. Named once, it is also a thing you can argue about in a review, which is the point of writing it down.

### 15. What is the strongest argument for the script over the spreadsheet?

- A. It produces nicer charts
- B. Finance teams prefer Python
- **C. It can refuse to produce a number, and it does the same thing every month whoever runs it** ✅
- D. It is faster

**Why:** Speed is the weakest of the reasons. Repeatability and the ability to fail loudly are what a monthly process actually needs.
