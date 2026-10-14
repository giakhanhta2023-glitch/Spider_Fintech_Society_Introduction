# Level 01: Mission zero: set up your workspace: quiz answer key

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

### 1. Where should you run the SQL and pandas levels, 2 and 3?

- **A. In Google Colab, which needs no installation and is right for querying and exploring** ✅
- B. In Excel, using the Python integration
- C. In a terminal, writing files by hand
- D. In a local Python installation, because notebooks are not professional

**Why:** Colab removes the entire installation problem for the levels that are about asking questions. The later levels become folders of files, and that is when a local Python earns its evening.

### 2. What is a library, in one sentence?

- A. A folder where Python keeps your files
- B. The place a notebook saves its history
- **C. Somebody else's code that you import and use, like pandas for tables** ✅
- D. A paid add-in for Python

**Why:** pandas, sqlite3 and matplotlib are libraries. `import pandas as pd` is you borrowing years of somebody else's work in one line.

### 3. What does `pip install pandas` do?

- A. Creates a new notebook
- B. Runs pandas
- **C. Downloads the pandas library onto your machine so you can import it** ✅
- D. Updates Python itself

**Why:** pip is the package manager: it fetches libraries. You need it on your own machine and not in Colab, which already has the common ones.

### 4. In Python, what is the first item of the list `["alice", "bob", "carol"]`?

- A. rows[1]
- **B. rows[0]** ✅
- C. rows.first()
- D. rows["alice"]

**Why:** Python counts from zero. Spreadsheets count from one. This catches everybody twice and then never again.

### 5. You defined `revenue` and `fees`, then ran `total = revene + fees`. Which error comes back?

- A. TypeError, because you added two numbers
- B. No error: Python corrects the spelling
- C. KeyError, because a column is missing
- **D. NameError, because `revene` was never defined** ✅

**Why:** A NameError is a name Python has never seen, which a typo guarantees. A KeyError is a key or column that is not there, the way `ledger["amont"]` was. A TypeError is a value used in a way its type does not allow, such as adding a number to text. The last line of the error always names which one you have.

### 6. Which of these is formatting rather than a number?

- A. 3361050.34
- **B. $3,361,050** ✅
- C. 0.58
- D. 318

**Why:** Commas, currency symbols and percent signs are how a number is shown, not what it is. In Python the number is bare and the formatting happens at the moment you print it.

### 7. What does `f"revenue {total:,.0f}"` produce when total is 3361050.34?

- **A. revenue 3,361,050** ✅
- B. revenue 3361050.34
- C. revenue {total}
- D. revenue 3.36e6

**Why:** The part after the colon is the format: a thousands comma and no decimals. It is the same idea as a cell format, written where the value is printed.

### 8. Why does the course insist that every dataset in it is synthetic?

- A. Real data is too large for a course
- B. Because synthetic data is easier to analyse
- C. To avoid paying for a data provider
- **D. So that nothing in a public repository could ever be somebody's real financial data** ✅

**Why:** Your repository is public and a hiring manager will open it. The habit of never putting employer or client data where strangers can read it is one somebody will check.

### 9. What is git actually giving you?

- A. Somewhere to store large files
- **B. Every version of every file with a note on what changed, which is what budget_v4_FINAL_v2.xlsx is pretending to be** ✅
- C. A way to run Python in the cloud
- D. Automatic backups of your laptop

**Why:** History with reasons attached. The second reason is that a public repository is a link a hiring manager can open, which a line on a CV is not.

### 10. Which task belongs in a spreadsheet rather than in code?

- A. The month end pack, produced identically every month
- B. Joining the billing system to the general ledger
- **C. A quick look at a number somebody is arguing about in a meeting** ✅
- D. A forecast that must balance in four scenarios

**Why:** Spreadsheets are excellent for looking and arguing. They are poor at doing the same thing identically every month, which is the whole of the rest of this track.

### 11. What is a CSV file?

- A. A compressed spreadsheet
- B. A database
- C. A file only Python can read
- **D. Plain text, one row per line, values separated by commas: a sheet with the formatting removed** ✅

**Why:** No formulas, no colours, no merged cells. It is the lowest common denominator every finance system can export, which is why every file in this course is one.

### 12. What does `import pandas as pd` do?

- **A. Makes the pandas library available under the short name pd** ✅
- B. Installs pandas
- C. Reads a CSV file
- D. Starts a notebook

**Why:** Importing is borrowing: pip puts the library on the machine, import brings it into this file. The `as pd` is a convention everybody uses, so your code reads like everybody else's.

### 13. Your notebook worked yesterday and today a variable is undefined. What happened?

- **A. The notebook forgot everything when it closed. The cells need running again, in order** ✅
- B. The data URL changed
- C. Colab lost your file
- D. pandas was updated

**Why:** A notebook keeps its text but not its memory. That is also why anything that must run every month belongs in a file rather than in cells somebody has to run in the right order.

### 14. What is the right way to use the published solutions?

- A. Avoid them completely
- B. Copy the solution into your repository and move on
- **C. Attempt the build, get stuck, read the part you are stuck on, close it and retype the fix from memory** ✅
- D. Read all of them before starting the level

**Why:** Copying skips the only step that teaches anything, and an interviewer asking "why does this line exist" finds that out in ninety seconds.

### 15. What does this level ask you to produce?

- A. A variance pack
- **B. A working lab: Colab running, the course data loading, a GitHub repository, and Python installed for later** ✅
- C. A SQL query
- D. Nothing at all

**Why:** There is no build this time on purpose. An evening spent on installers is the most common reason people stop before writing anything that works.
