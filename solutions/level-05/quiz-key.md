# Level 5: The money library everything else imports: quiz answer key

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

### 1. Why can a float not be trusted to hold $19.99?

- A. Python floats cannot hold numbers above 1,000,000
- B. Floats round every result to two places
- **C. Most decimal fractions have no exact binary form, so the stored value is slightly off** ✅
- D. Floats are limited to six decimal places

**Why:** The error is tiny and it accumulates, and it breaks exact comparisons such as a reconciliation that must come to zero.

### 2. What does `Decimal(2.675)` produce?

- **A. 2.674999999999999822..., because the float was already inexact** ✅
- B. Exactly 2.675
- C. 2.68
- D. A TypeError

**Why:** Decimal faithfully copies the broken float. Always build from a string: `Decimal("2.675")`.

### 3. Which of these currencies has an exponent of 0?

- A. USD
- B. BHD
- C. EUR
- **D. JPY** ✅

**Why:** Yen and dong have no smaller unit in use, so dividing by 100 to display them is wrong by a factor of a hundred.

### 4. ROUND_HALF_EVEN is the banking default because:

- A. It is faster to compute
- B. Regulators require it in every country
- **C. Always rounding ties upward adds a small bias that becomes real money over millions of rows** ✅
- D. It always rounds in the bank's favour

**Why:** Half the ties go up and half go down, so the bias cancels instead of accumulating.

### 5. Seven lines of $1.99 at 8.25% tax give $1.12 rounded per line and $1.15 rounded once at the end. Which is correct?

- A. Per line, always
- **B. Whichever your tax rules require, decided once and covered by a test** ✅
- C. Neither: the tax rate must be rounded first
- D. Per invoice, always

**Why:** Both are legitimate arithmetic. What is always wrong is not knowing which one your code does.

### 6. What does `allocate(10000, [1, 1, 1])` return, in cents?

- **A. [3334, 3333, 3333]** ✅
- B. [3333, 3333, 3333]
- C. [3334, 3334, 3332]
- D. [3333.33, 3333.33, 3333.33]

**Why:** The leftover cent goes to the share cut by the most, and the parts still add up to exactly 10000.

### 7. The essential property of an allocation function is:

- A. No share is ever zero
- **B. The shares sum exactly to the amount being split** ✅
- C. Every share is the same size
- D. Shares are always rounded up

**Why:** Anything else loses or invents money, and a transaction that does not sum to zero is invalid, as level 4 showed.

### 8. What does property-based testing add that example tests cannot?

- A. Faster test runs
- **B. It generates hundreds of inputs, including ones you never thought of, and shrinks a failure to the smallest case** ✅
- C. It proves the code is correct
- D. It removes the need for a type checker

**Why:** Example tests document intent; property tests hunt. Neither proves correctness, but the second finds real bugs.

### 9. `@dataclass(frozen=True)` on Money gives you:

- A. Faster attribute access
- B. Automatic currency conversion
- C. Thread safety across the whole program
- **D. A value that cannot be changed after creation, so two parts of a program cannot disagree about it** ✅

**Why:** Immutability is why passing Money around is safe. Operations return new values instead of editing old ones.

### 10. Why should Money not have a `__float__` method?

- A. Python forbids it on frozen dataclasses
- B. It would be slow
- C. Floats cannot represent currencies with exponent 0
- **D. Because any caller could then turn an exact amount back into an inexact float, and every guarantee becomes optional** ✅

**Why:** A type protects a rule only while there is no easy way around it.

### 11. What does mypy do?

- **A. Reads your type hints and reports contradictions without running the code** ✅
- B. Speeds up Python by compiling the type hints
- C. Enforces a code style
- D. Runs your tests

**Why:** Python ignores hints while running. A separate checker is what turns them into a safety net.

### 12. Your tests pass locally and the pipeline fails with a missing module. Where is the fix?

- A. On the pipeline machine: pre-install common libraries
- B. Nowhere: pin the pipeline to your local Python version
- **C. In pyproject.toml: the project failed to declare a dependency it needs** ✅
- D. In the pipeline file: install the module there

**Why:** The clean machine is right. Every undeclared assumption on your laptop is an incident for whoever clones it next.

### 13. You rename a public attribute and release it as a patch version. What is wrong?

- A. Renames require a new package name
- B. Nothing, as long as the tests pass
- **C. A rename breaks callers, so it belongs in a major version, with the old name kept as an alias first** ✅
- D. Patch versions cannot contain code changes

**Why:** Adding is safe; removing and renaming are not. The version number is how callers know which one happened.

### 14. Full test coverage means:

- **A. Every line of code ran during the tests** ✅
- B. Every line of code is correct
- C. The type checker passed
- D. Every possible input was tried

**Why:** A test that asserts nothing still produces coverage. Coverage finds untested code; properties find bugs.

### 15. Why put the package under a `src/` folder?

- A. To keep the repository tidy
- **B. So tests exercise the installed package instead of accidentally importing the folder you are standing in** ✅
- C. It makes imports faster
- D. pyproject.toml requires it

**Why:** It removes a whole class of "works in the repository, fails once installed" surprises.
