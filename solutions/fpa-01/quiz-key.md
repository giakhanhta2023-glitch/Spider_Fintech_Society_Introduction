# Level 01: The spreadsheet that does not lie: quiz answer key

> 15 questions. Pass mark is 12/15 (80%).
> Generated from `content/levels/` by `tools/build_quiz_keys.js`: do not edit by hand.

| # | Answer |
|---|--------|
| 1 | **A** |
| 2 | **C** |
| 3 | **C** |
| 4 | **B** |
| 5 | **D** |
| 6 | **B** |
| 7 | **A** |
| 8 | **D** |
| 9 | **B** |
| 10 | **C** |
| 11 | **D** |
| 12 | **A** |
| 13 | **A** |
| 14 | **C** |
| 15 | **B** |

---

### 1. The ledger export shows transaction fees as -2,348,188. What does the minus sign mean?

- **A. It is a credit, which is how every accounting export writes revenue** ✅
- B. The export is corrupt and should be requested again
- C. The company lost money on transaction fees that month
- D. The amount is a refund of previously recognised revenue

**Why:** Revenue is a credit and credits export as negatives. Normalise the sign once, where the data arrives, and every number downstream means what a reader assumes.

### 2. Revenue is 4.4% above plan and gross profit is 1.4% below it. Which explanation fits?

- A. Gross profit and revenue cannot move in opposite directions
- B. Somebody has double counted revenue
- **C. More was sold at a lower margin: volume up, take rate down, and costs that scale with volume** ✅
- D. The budget was wrong, so no explanation is needed

**Why:** Volume was 14.3% ahead at a take rate 6.5% behind. Scheme costs scale with volume at a fixed rate, so the margin is squeezed from both ends. This is the single most common shape in a payments business.

### 3. Transaction fees beat plan by 151,993. The volume effect is +313,938. What is the rate effect?

- A. -465,882
- B. It cannot be calculated from this
- **C. -161,945** ✅
- D. +161,945

**Why:** The two effects must add to the total variance, so 151,993 - 313,938 = -161,945. If your decomposition does not add back up, it is a story rather than an analysis.

### 4. Cost centre CC600 has a budget of 96,000 a month and has never had a single actual. How should the pack treat it?

- A. Exclude it silently, since there is nothing to compare
- **B. Show it, and say in the commentary that the team was never created and the plan needs reforecasting** ✅
- C. As a favourable variance, because the money was not spent
- D. Reallocate its budget across the other cost centres

**Why:** Nothing was saved, something never happened. Reporting it as a saving flatters the pack every month, and reallocating it hides the planning error. Show it and name it.

### 5. Why join the ledger to the budget on account_code rather than account_name?

- A. Excel cannot match on text
- B. Account names are not unique within a month
- C. Codes sort faster than names
- **D. Names differ between systems: 5100 is Cloud hosting in the ledger and Hosting in the plan, so a name join drops the row** ✅

**Why:** A join on a label fails silently. The row simply does not appear, the pack still totals something, and the difference shows up as an unexplained variance.

### 6. Marketing is 210,000 over plan in September, and October and November are now 290,000 under. What is this?

- A. An overspend that needs approval
- **B. A timing difference: the campaign moved forward, and the full year is 80,000 favourable** ✅
- C. A budgeting error in the original plan
- D. A reclassification between cost centres

**Why:** Spend that moves between periods rather than changing in total is a timing difference, and the commentary has to say so or somebody will try to cut a budget that is already under.

### 7. Support salaries are 28,000 under plan because five budgeted hires were never made. How is this reported?

- **A. As a favourable variance, with the service consequence named** ✅
- B. As an unfavourable variance, because hiring failed
- C. As a favourable variance and nothing more
- D. It is not a variance at all

**Why:** Favourable is an arithmetic fact and it is not the same as good. The cost line improved because capacity did not arrive, and the person reading the pack needs both halves.

### 8. What is the check cell for?

- A. To count the rows in the import
- B. To check the budget was approved
- C. To confirm the formulas have no circular references
- **D. To prove the pack ties to the ledger, on the face of the output, every time it is refreshed** ✅

**Why:** One cell, pack total minus ledger total, red when it is not zero. It catches a broken range or a missing mapping row in the second it happens rather than in the meeting.

### 9. A `SUM` over the amount column returns a number that is exactly 590,000 too high. What do you look for first?

- A. A missing minus sign
- **B. A duplicated export row** ✅
- C. A floating point rounding error
- D. A hidden row

**Why:** A round, exact, single-line discrepancy is almost always a duplicate. Count rows against count distinct on the journal id. This dataset has one, in June.

### 10. One amount in the file reads `(700,200.00)` and another reads `180,000.00`. What happens if you ignore them?

- A. The import fails
- B. Nothing, spreadsheets read brackets as negative
- **C. The column becomes text in most tools, the SUM skips it, and the pack is understated with no error shown** ✅
- D. It is rounded to zero

**Why:** Brackets and thousands separators make the cell text. The dangerous part is that nothing breaks: the sum simply excludes them, and the check cell is what catches it. The brackets are also a minus sign, so reading it as 653,400 gets the sign wrong as well as the type.

### 11. Why use INDEX/MATCH or XLOOKUP rather than VLOOKUP with a column number?

- A. VLOOKUP cannot look up text
- B. They are faster on large files
- C. They handle duplicates automatically
- **D. They name the column they return, so inserting a column in the source cannot silently change the answer** ✅

**Why:** VLOOKUP counts columns. Somebody inserts one, every lookup shifts by one, and the numbers are still plausible. That is the worst kind of wrong.

### 12. Where should the sign-flipping rule live?

- **A. In one column on the calculations tab, applied once where the data arrives** ✅
- B. In each formula that touches revenue
- C. In the raw import, by typing over the negatives
- D. In the commentary, as a note to the reader

**Why:** Once, at the boundary. Typing over raw data loses it on the next refresh, and scattering the rule through formulas guarantees one of them is missed.

### 13. What is the difference between a budget and a forecast?

- **A. The budget is fixed at the start of the year as the benchmark; the forecast is what you now expect and is updated monthly** ✅
- B. The forecast is approved by the board and the budget is not
- C. The budget covers costs and the forecast covers revenue
- D. None, the words are interchangeable

**Why:** A budget you keep editing stops being a benchmark and you can no longer tell whether you are behind. Both exist because they answer different questions.

### 14. Which commentary is doing its job?

- A. "Opex 86k unfavourable, see attached."
- B. "Opex overspend driven by elevated marketing investment to capture market opportunity."
- **C. "Opex is 86k unfavourable: marketing 210k over on a campaign pulled into September that leaves the year 80k under, and salaries 124k under, of which 96k is a cost centre that was never created."** ✅
- D. "Opex was materially above budget due to phasing and other factors."

**Why:** The gross movements, their causes, and what the reader should do. The net number alone hides two unrelated stories, and the adjectives in the other options carry no information.

### 15. Your pack ties to the ledger, but the ledger itself includes a duplicated journal. What is the right answer?

- A. Adjust the budget to match
- **B. Exclude it, flag it to the accountant, and say in the commentary that the ledger is overstated by 590k until it is corrected** ✅
- C. Remove the duplicate from your calculations tab and say nothing
- D. Leave it: the pack ties, which is what matters

**Why:** Tying to a wrong number is not accuracy. The analyst who finds the error, tells the person who can fix it, and states the effect is the one who gets trusted with the next thing.
