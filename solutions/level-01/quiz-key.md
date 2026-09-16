# Level 1: Fintech Orientation & Your Zero-Install Toolkit: quiz answer key

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

### 1. Which definition of "fintech" is the most accurate?

- **A. Technology that delivers, improves, or replaces a financial service** ✅
- B. Cryptocurrency and blockchain products specifically
- C. The department of a bank that buys software
- D. Any startup that has raised venture capital

**Why:** Fintech is defined by what the technology does (serving a financial need) not by company size, funding, or a specific technology like blockchain.

### 2. A customer taps a card and the terminal says APPROVED. What has just happened?

- A. Money moved from the customer's bank to the shop's bank
- B. The card network transferred funds instantly and irreversibly
- **C. The issuing bank promised to pay: an authorization, not a transfer** ✅
- D. The shop's bank lent the shop the money

**Why:** Approval is an authorization: the issuer reserves the funds and promises payment. Actual money movement happens at settlement, typically one to three days later.

### 3. In a card payment, which party decides to approve or decline?

- A. The payment terminal
- B. The merchant acquirer
- **C. The issuing bank** ✅
- D. The card network (Visa/Mastercard)

**Why:** The issuer (the bank that gave the customer the card) checks the balance and fraud rules and returns the decision. The network only routes the message.

### 4. What is a "rail" in payments?

- A. The physical cable connecting a terminal to the internet
- **B. A network money travels along, such as cards, ACH, or SEPA** ✅
- C. The fee a merchant pays per transaction
- D. A regulation limiting transaction size

**Why:** Rails are the pipes money moves through. They differ in speed, cost, reversibility, and limits. Picking between them is a genuine product decision.

### 5. What makes a ledger different from simply storing a balance in a database column?

- A. There is no real difference; the words are interchangeable
- B. A ledger is encrypted and a balance column is not
- C. A ledger can only be used by licensed banks
- **D. A ledger is append-only, so the balance is the sum of entries and history stays auditable** ✅

**Why:** Ledgers never overwrite. Corrections are new entries, so you can always reconstruct how a balance came to be, which is exactly what auditors and support teams need.

### 6. KYC refers to:

- A. Keep Your Cash: a liquidity rule
- **B. Know Your Customer: verifying a user's identity as required by law** ✅
- C. Key Yield Calculation: a pricing method
- D. Known Yearly Cost: a lending disclosure

**Why:** KYC is the legally required identity verification done before a customer can hold or move money. It sits alongside AML monitoring.

### 7. Why do production systems store $10.45 as the integer 1045 rather than the float 10.45?

- **A. Binary floating point cannot represent most decimals exactly, so errors accumulate across many transactions** ✅
- B. Integers use less memory than floats
- C. Databases cannot store decimal points
- D. It makes currency conversion unnecessary

**Why:** Values like 0.1 have no exact binary representation, which is why 0.1 + 0.2 != 0.3. Tiny errors multiplied across millions of transactions break reconciliation, so balances are stored in minor units.

### 8. In Python, what does `0.1 + 0.2 == 0.3` evaluate to?

- A. True
- B. It raises a TypeError
- C. It depends on the operating system
- **D. False** ✅

**Why:** It is False. 0.1 + 0.2 produces 0.30000000000000004 because of binary floating point, the reason money belongs in integers.

### 9. Which tool lets you write and run Python with no installation at all?

- A. Visual Studio Code
- **B. Google Colab** ✅
- C. GitHub Desktop
- D. Microsoft Excel

**Why:** Colab runs notebooks on Google's servers in a browser tab, with pandas, matplotlib, and scikit-learn already available.

### 10. In a Colab notebook, what does Shift + Enter do?

- A. Saves the notebook to Google Drive
- B. Restarts the Python session
- **C. Runs the current cell and moves to the next one** ✅
- D. Inserts a new cell above

**Why:** Shift + Enter runs and advances; Ctrl + Enter runs and stays put. Restarting is done from the Runtime menu.

### 11. Your notebook throws `NameError: name "blance" is not defined`. What is the most likely cause?

- A. Python ran out of memory
- B. You need to install a library
- C. The value is too large for an integer
- **D. You misspelled a variable name, or never created it** ✅

**Why:** A NameError means Python has never seen that name. It is nearly always a typo or a cell you have not run yet.

### 12. What is a GitHub repository?

- **A. One folder holding one project, with its file history** ✅
- B. A backup of your entire hard drive
- C. A database of financial market data
- D. A paid hosting plan for websites

**Why:** A repo is one project plus its commit history. Your portfolio repo will hold your FinQuest notebooks.

### 13. Which action is genuinely dangerous?

- **A. Committing a file containing your API key to a public repository** ✅
- B. Renaming a notebook after you created it
- C. Making a repository public
- D. Uploading a .ipynb notebook through the GitHub web interface

**Why:** Bots scan public GitHub for leaked credentials within minutes of a push. Keys belong in environment variables: covered in Level 5.

### 14. APR stands for Annual Percentage Rate. What does it express?

- A. The bank's profit margin on deposits
- B. The annual return of a stock portfolio
- **C. The yearly cost of borrowing, including fees** ✅
- D. The percentage of loan applications approved

**Why:** APR is a borrowing-cost disclosure that folds fees into a single yearly percentage so different loans can be compared. Level 6 builds it properly.

### 15. What unlocks a FinQuest project?

- A. Reading the knowledge page
- **B. Scoring at least 12 of 15 on the level drill** ✅
- C. Completing the previous project
- D. Paying for a subscription

**Why:** Each drill needs 12/15 (80%) to unlock its project, and the project must be marked complete before the next level opens.
