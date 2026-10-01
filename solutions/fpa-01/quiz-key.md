# Level 01: Mission zero: a lab that works: quiz answer key

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
- B. In a terminal, writing files by hand
- C. In a local Python installation, because notebooks are not professional
- D. In Excel, using the Python integration

**Why:** Colab removes the entire installation problem for the levels that are about asking questions. The later levels become folders of files, and that is when a local Python earns its evening.

### 2. What is a library, in one sentence?

- A. A paid add-in for Python
- B. The place a notebook saves its history
- **C. Somebody else's code that you import and use, like pandas for tables** ✅
- D. A folder where Python keeps your files

**Why:** pandas, sqlite3 and matplotlib are libraries. `import pandas as pd` is you borrowing years of somebody else's work in one line.

### 3. What does `pip install pandas` do?

- A. Updates Python itself
- B. Creates a new notebook
- **C. Downloads the pandas library onto your machine so you can import it** ✅
- D. Runs pandas

**Why:** pip is the package manager: it fetches libraries. You need it on your own machine and not in Colab, which already has the common ones.

### 4. In Python, what is the first item of the list `["alice", "bob", "carol"]`?

- A. rows.first()
- **B. rows[0]** ✅
- C. rows[1]
- D. rows["alice"]

**Why:** Python counts from zero. Spreadsheets count from one. This catches everybody twice and then never again.

### 5. An error ends with `KeyError: 'amont'`. What does that mean?

- A. Python ran out of memory
- B. The network is down
- C. The file is corrupt
- **D. You asked for a name that does not exist, in this case a mistyped column** ✅

**Why:** A KeyError is asking for a key that is not there. Read the last line of a traceback first: it names the problem, and the lines above it are only the path that reached it.

### 6. Which of these is formatting rather than a number?

- A. 3361050.34
- **B. $3,361,050** ✅
- C. 0.58
- D. 318

**Why:** Commas, currency symbols and percent signs are how a number is shown, not what it is. In Python the number is bare and the formatting happens at the moment you print it.

### 7. What does `f"revenue {total:,.0f}"` produce when total is 3361050.34?

- **A. revenue 3,361,050** ✅
- B. revenue {total}
- C. revenue 3361050.34
- D. revenue 3.36e6

**Why:** The part after the colon is the format: a thousands comma and no decimals. It is the same idea as a cell format, written where the value is printed.

### 8. Why does the course insist that every dataset in it is synthetic?

- A. To avoid paying for a data provider
- B. Because synthetic data is easier to analyse
- C. Real data is too large for a course
- **D. So that nothing in a public repository could ever be somebody's real financial data** ✅

**Why:** Your repository is public and a hiring manager will open it. The habit of never putting employer or client data where strangers can read it is one somebody will check.

### 9. What is git actually giving you?

- A. A way to run Python in the cloud
- **B. Every version of every file with a note on what changed, which is what budget_v4_FINAL_v2.xlsx is pretending to be** ✅
- C. Somewhere to store large files
- D. Automatic backups of your laptop

**Why:** History with reasons attached. The second reason is that a public repository is a link a hiring manager can open, which a line on a CV is not.

### 10. Which task belongs in a spreadsheet rather than in code?

- A. Joining the billing system to the general ledger
- B. The month end pack, produced identically every month
- **C. A quick look at a number somebody is arguing about in a meeting** ✅
- D. A forecast that must balance in four scenarios

**Why:** Spreadsheets are excellent for looking and arguing. They are poor at doing the same thing identically every month, which is the whole of the rest of this track.

### 11. What is a CSV file?

- A. A database
- B. A compressed spreadsheet
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
- B. pandas was updated
- C. The data URL changed
- D. Colab lost your file

**Why:** A notebook keeps its text but not its memory. That is also why anything that must run every month belongs in a file rather than in cells somebody has to run in the right order.

### 14. What is the right way to use the published solutions?

- A. Read all of them before starting the level
- B. Avoid them completely
- **C. Attempt the build, get stuck, read the part you are stuck on, close it and retype the fix from memory** ✅
- D. Copy the solution into your repository and move on

**Why:** Copying skips the only step that teaches anything, and an interviewer asking "why does this line exist" finds that out in ninety seconds.

### 15. What does this level ask you to produce?

- A. Nothing at all
- **B. A working lab: Colab running, the course data loading, a GitHub repository, and Python installed for later** ✅
- C. A SQL query
- D. A variance pack

**Why:** There is no build this time on purpose. An evening spent on installers is the most common reason people stop before writing anything that works.
