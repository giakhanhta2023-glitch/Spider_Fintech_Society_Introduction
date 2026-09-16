# Level 3: Reading the Money: quiz answer key

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

### 1. Why is `df[df["amount"] > 0]` the wrong way to find income in this dataset?

- A. Because income is stored as a negative number
- B. Because it returns a Series instead of a DataFrame
- C. Because pandas cannot compare numbers to columns
- **D. Because refunds are also positive amounts, and they are not income** ✅

**Why:** Refunds, reversals, and interest credits are all positive. Filter on the category column when you mean income, or you will overstate it.

### 2. What does `parse_dates=["date"]` do in read_csv?

- A. Removes rows with invalid dates
- B. Sets the date column as the index
- **C. Converts the column from text into real datetime values** ✅
- D. Sorts the rows by date

**Why:** Without it the column stays text, the .dt accessor is unavailable, and sorting is alphabetical, which places 2025-10 before 2025-3.

### 3. df.dtypes shows the amount column as `object`. What does that mean?

- A. It is a currency type with correct rounding
- B. It is an integer column
- C. The column has been indexed
- **D. It contains text or mixed values: a stray non-numeric entry got in** ✅

**Why:** object means text or mixed. Calling .sum() on it concatenates strings instead of adding numbers, giving a silently wrong answer.

### 4. What is a boolean mask?

- **A. A True/False Series used inside df[...] to select rows** ✅
- B. A way of hiding columns from display
- C. A pandas method that converts types
- D. A password on a DataFrame

**Why:** df["amount"] < 0 produces a True/False Series; df[mask] keeps the True rows. It is the standard filtering idiom.

### 5. Which expression correctly selects dining transactions over $30?

- A. df[df["category"] == "dining" and df["amount"] < -30]
- **B. df[(df["category"] == "dining") & (df["amount"] < -30)]** ✅
- C. df[df["category"] == "dining" && df["amount"] < -30]
- D. df.filter("dining", -30)

**Why:** pandas uses & and |, not and/or, and every condition needs its own brackets because & binds tighter than the comparison operators.

### 6. What does `SettingWithCopyWarning` usually indicate?

- **A. You filtered a DataFrame and then added a column without taking a .copy()** ✅
- B. A column contains missing values
- C. Your data contains duplicates
- D. You are out of memory

**Why:** pandas cannot tell whether you meant to modify the original or the filtered view. Adding.copy() when you filter states your intent and removes the warning.

### 7. What does the split-apply-combine pattern describe?

- A. Splitting a column into first and last name
- **B. Grouping rows, aggregating each group, and combining the results into a table** ✅
- C. Merging two DataFrames on a key
- D. Splitting a CSV into several files

**Why:** That is exactly what groupby does, and nearly every analytics question reduces to it.

### 8. How do you get a month column from a datetime column?

- **A. df["date"].dt.to_period("M")** ✅
- B. df["date"].month
- C. df["date"].astype("month")
- D. df.month("date")

**Why:** Date parts live under the .dt accessor on a Series. .dt.to_period("M") gives a month period; .dt.month would give just the number 3.

### 9. What does `spend.groupby(["description", "abs_amount"]).size()` produce?

- A. The average amount per merchant
- **B. A count of rows for each unique merchant-and-amount pair** ✅
- C. The total amount per merchant
- D. The number of columns in each group

**Why:** Passing a list groups by both keys at once, and .size() counts the rows, which is how identical repeated charges reveal themselves.

### 10. Why should a transfer to your own savings account be excluded from "spending"?

- A. Because savings transfers are usually duplicates
- B. Because banks do not report transfers
- C. Because transfers always have a zero amount
- **D. Because the money is still yours: counting it as an expense understates the user's position** ✅

**Why:** Moving money between your own accounts changes location, not net worth. Several shipped budgeting apps get this wrong and users notice immediately.

### 11. A subscription-detection rule finds merchants with at least three identical charges. What false positive should you expect?

- **A. Fixed commitments like rent or a savings transfer, which are recurring but not cancellable** ✅
- B. One-off electronics purchases
- C. Refunds
- D. Coffee shop visits at random prices

**Why:** Rent is perfectly recurring and perfectly identical. A useful report separates cancellable subscriptions from fixed commitments rather than lumping them together.

### 12. Which chart best answers "which category did I spend most on"?

- A. A pie chart of all categories
- B. A scatter plot of amount against date
- **C. A horizontal bar chart sorted by size** ✅
- D. A stacked area chart

**Why:** Bars share a common baseline so the eye compares lengths precisely. Pie charts require comparing angles, which people do badly.

### 13. Income is $20,100 and spending excluding savings transfers is $13,358.30. What is the savings rate?

- A. 65.4%
- B. 8.96%
- **C. 33.5%** ✅
- D. 66.5%

**Why:** (20,100 - 13,358.30) / 20,100 = 0.3354. The savings rate is the share of income that did not get spent, not the share that was transferred.

### 14. What does `.value_counts()` on a text column tell you?

- A. The number of missing values
- **B. How many times each distinct value appears** ✅
- C. The column type
- D. The sum of the column

**Why:** It is the fastest way to see what is actually in a categorical column: including typos and unexpected categories.

### 15. In `f"${total:>14,.2f}"`, what does the `>` do?

- A. Adds a greater-than sign to the output
- B. Rounds up to the next whole number
- **C. Right-aligns the value within 14 characters** ✅
- D. Compares total to 14

**Why:** Alignment specifiers are < left, > right, ^ centre, followed by the width. Right-aligned money columns are what make a text report readable.
