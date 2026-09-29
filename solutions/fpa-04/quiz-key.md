# Level 04: A model that ties: quiz answer key

> 15 questions. Pass mark is 12/15 (80%).
> Generated from `content/levels/` by `tools/build_quiz_keys.js`: do not edit by hand.

| # | Answer |
|---|--------|
| 1 | **B** |
| 2 | **A** |
| 3 | **A** |
| 4 | **D** |
| 5 | **B** |
| 6 | **B** |
| 7 | **C** |
| 8 | **C** |
| 9 | **A** |
| 10 | **B** |
| 11 | **D** |
| 12 | **C** |
| 13 | **D** |
| 14 | **C** |
| 15 | **A** |

---

### 1. Why must cash be an output of the model rather than an input?

- A. Because auditors require it
- **B. Because it is the closing line of the cash flow statement, and typing it in means plugging the balance sheet** ✅
- C. Because cash is hard to predict
- D. Because the bank provides the forecast

**Why:** Cash falls out of net income, non cash charges, working capital movements, capex and financing. Forecast it directly and the balance sheet only balances by accident or by plug.

### 2. Revenue grows 2.15% a month, payroll 0.8%, and marketing and facilities are flat. What does the margin do?

- **A. Rises, because most of the cost base does not grow with revenue. That is operating leverage** ✅
- B. Stays flat, since costs are a percentage of revenue
- C. Cannot be determined without the tax rate
- D. Falls, because costs compound faster

**Why:** From 7.9% to 19.3% here. A model that forecasts every cost as a percentage of revenue cannot show this, which is the main reason not to build one that way.

### 3. What does DSO moving from 38 days to 57 days cost, on revenue of 3.36 million a month?

- **A. About 2.1 million of cash, once, as receivables step up** ✅
- B. 19 days of revenue every month
- C. Nothing, it is a timing difference
- D. It depends on the tax rate

**Why:** 3.36m x 19 / 30.4. It is a one off cash cost because the balance steps to a new level and stays there. The recurring cost is the interest on financing it.

### 4. A profitable, growing company keeps running out of cash. What is the most likely cause?

- A. The tax rate is wrong
- B. Revenue is being recognised too early
- C. Depreciation is too high
- **D. Growth is consuming working capital: each month sells more and collects it 38 days later** ✅

**Why:** A growing business lends its growth to its customers. It is the normal reason profitable companies raise money, and it is visible only in a model that links the three statements.

### 5. Why is depreciation calculated on the opening fixed asset balance?

- A. Because capex arrives at the end of the month
- **B. Using the closing balance makes it circular for no reason, since closing assets depend on depreciation** ✅
- C. Accounting standards require it
- D. It produces a larger charge

**Why:** Depreciation reduces the closing balance, so calculating it on the closing balance depends on itself. Opening balance, then add capex, then subtract the charge.

### 6. What creates the circular reference in this model?

- A. Receivables, which depend on revenue
- **B. The revolver: a draw costs interest, interest reduces cash, and less cash means a bigger draw** ✅
- C. Depreciation and fixed assets
- D. Tax, which depends on profit

**Why:** Interest depends on the draw and the draw depends on interest. Excel needs iterative calculation turned on; a script loops until the draw stops moving.

### 7. The stress case resolves the circularity in five passes and the base case in one. Why one?

- A. It converges faster with higher revenue
- B. The base case is simpler arithmetic
- **C. The base case never draws, so there is nothing to iterate. A case that never draws proves nothing about the mechanism** ✅
- D. The loop is skipped for profitable scenarios

**Why:** That is why a stress case severe enough to need the facility is worth building even if nobody expects it: it is the only thing that exercises the circular logic.

### 8. Why build scenarios as multiples of a base case rather than as separate files?

- A. Because Excel cannot handle four files
- B. It is faster to calculate
- **C. Because separate copies drift, and then nobody can say whether a difference is the assumption or the drift** ✅
- D. It uses less disk space

**Why:** Correct a measured driver once and all four cases move. The only difference between them stays the thing being varied, which is the entire point of having them.

### 9. The sensitivity table shows 16 basis points of take rate worth more than 3.5 points of monthly volume growth. What is that for?

- **A. Deciding which argument is worth having: the company debates volume constantly and pricing almost never** ✅
- B. Widening the forecast into a range
- C. Proving the model is accurate
- D. Setting the budget

**Why:** A range nobody acts on is decoration. A table that says the meeting is about the wrong thing changes what happens next week.

### 10. What does it mean when a driver is marked as a judgement rather than measured?

- A. It is a placeholder to be filled in later
- **B. It came from a person's decision rather than from the history, so a reviewer knows which inputs are opinions** ✅
- C. It is less important
- D. It cannot be changed in scenarios

**Why:** The take rate, the cash floor and the facility rate are decisions. Marking them is how a model stops being believed more than it deserves.

### 11. Retained earnings in the opening balance sheet are negative 11.5 million. What is the one sentence answer?

- A. The company has a going concern problem
- B. Dividends exceeded profits
- C. An error in the ledger
- **D. Cumulative losses since founding, against twenty two million raised. Normal for a growing business** ✅

**Why:** Retained earnings are cumulative profit since day one. A company that has raised more than it has earned has a negative balance, and it says nothing on its own about whether the business works.

### 12. Retained earnings should move each month by exactly what?

- A. Net income plus depreciation
- B. EBITDA
- **C. Net income** ✅
- D. Cash flow from operations

**Why:** Net income and nothing else, absent dividends or equity issues. It is one of the identities worth asserting in a test, because when it breaks the model is wrong whatever the assumptions were.

### 13. Your model hits its 50 pass iteration cap. What has happened?

- A. Python ran out of memory
- B. The forecast is too long
- C. The revolver rate is too high
- **D. The circular calculation is not converging, and any number it shows is meaningless** ✅

**Why:** Hitting the cap is a failure, not a result. Excel in the same situation shows a stale number with no warning, which is worse.

### 14. Which cost is a decision rather than a consequence?

- A. Scheme and interchange fees
- B. Depreciation
- **C. Marketing spend** ✅
- D. Receivables

**Why:** Scheme fees follow volume, depreciation follows the asset base, receivables follow revenue. Marketing is a number a person chooses, and modelling it as a percentage of revenue hides that.

### 15. What is the strongest evidence that a three statement model is right?

- **A. The balance sheet balances in every month of every scenario, with no plug** ✅
- B. The forecast looks reasonable
- C. It matches last year
- D. The CFO approved it

**Why:** Balancing is not proof that the assumptions are good, and it is proof that the mechanics are. Sixty forecast months balancing to the cent means every linkage is doing what it should.
