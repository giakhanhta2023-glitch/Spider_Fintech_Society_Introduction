# Level 10: Compliance, Architecture & the Capstone Build: quiz answer key

> 15 questions. Pass mark is 12/15 (80%).
> Generated from `content/levels/` by `tools/build_quiz_keys.js`: do not edit by hand.

| # | Answer |
|---|--------|
| 1 | **A** |
| 2 | **D** |
| 3 | **C** |
| 4 | **A** |
| 5 | **C** |
| 6 | **A** |
| 7 | **D** |
| 8 | **B** |
| 9 | **B** |
| 10 | **A** |
| 11 | **B** |
| 12 | **B** |
| 13 | **C** |
| 14 | **C** |
| 15 | **D** |

---

### 1. What does KYC require of a money-handling product?

- **A. Verifying a customer's identity before they can hold or move money** ✅
- B. Reporting profits to regulators quarterly
- C. Encrypting all customer data
- D. Keeping customer funds in a separate bank

**Why:** KYC is identity verification at onboarding. In code it usually appears as a state machine where no transaction is permitted until verification completes.

### 2. Which is the best example of data minimisation?

- A. Encrypting the full card number at rest
- B. Backing up data twice a day
- C. Storing data in a different country
- **D. Not collecting a date of birth at all if the product never needs one** ✅

**Why:** The safest PII is the field you never stored. Minimisation reduces breach impact, compliance scope, and retention obligations simultaneously.

### 3. Why store a masked card number like `**** 4471` rather than the full PAN?

- A. It uses less disk space
- B. Masking makes queries faster
- **C. Storing full card numbers puts you in scope for PCI DSS and raises breach impact enormously** ✅
- D. Full card numbers cannot be stored in a database

**Why:** Full PANs carry a heavy security standard and severe consequences if leaked. Most products only ever need the last four digits to help a user recognise a card.

### 4. In a layered architecture, which dependency direction is allowed?

- **A. The interface may call services, but services must never know the interface exists** ✅
- B. Storage may call services
- C. Any layer may call any other
- D. Services may import the interface

**Why:** One-directional dependencies are what make the middle testable and the interface swappable. A service calling st.write is the classic violation.

### 5. What does "a test needs a browser" tell you about a codebase?

- A. The test framework is misconfigured
- B. The app is too fast to test
- **C. Business logic is trapped inside the interface layer** ✅
- D. The tests are thorough

**Why:** Pure logic can be tested by importing a function. Needing a browser means the calculation and the UI are the same code.

### 6. What is the purpose of `__init__.py` in a folder?

- **A. It marks the folder as a package so it can be imported as a module path** ✅
- B. It runs when the app starts
- C. It stores configuration
- D. It initialises the database

**Why:** It makes `from neobank.ledger import Ledger` work. It may be empty; its presence is what matters.

### 7. Why does `loaders.py` build paths from `Path(__file__).resolve().parent.parent`?

- A. Because pandas requires absolute paths
- B. To make the code shorter
- C. To hide the file location from users
- **D. So data files are found regardless of which directory the app was started from** ✅

**Why:** Relative paths depend on the working directory, which is why "it works on my machine" happens. Anchoring to the module's own location removes the ambiguity.

### 8. What is reconciliation?

- A. Correcting a failed payment
- **B. Comparing internal records against an external source and explaining every difference** ✅
- C. Rebalancing a portfolio to target weights
- D. Merging two customer accounts

**Why:** Every real money system reconciles daily. An unexplained break is a bug, a timing difference, or fraud, and you cannot tell which without investigating.

### 9. Your ledger says $10,450 and the bank statement says $10,400. What is the correct response?

- A. Ignore it, since it is under 1%
- **B. Record the $50 break and investigate its cause before changing anything** ✅
- C. Adjust the ledger to match the statement
- D. Delete the most recent ledger entry

**Why:** Silently adjusting destroys the evidence and may be hiding a real problem. Ledgers are append-only: investigate, then post a documented correcting entry if one is warranted.

### 10. Which README section most signals professional maturity?

- **A. Limitations and next steps** ✅
- B. A complete list of every function
- C. The programming languages used
- D. A long installation troubleshooting guide

**Why:** Knowing and stating what your system does not do is the difference between a demo and an engineer. Overclaiming has the opposite effect on a reviewer.

### 11. What belongs at the very top of a portfolio README?

- A. The licence
- **B. One sentence on what it is, then a live link and a screenshot** ✅
- C. The full architecture diagram
- D. Your contact details

**Why:** A reviewer gives you about thirty seconds. A sentence, a link, and a picture is the fastest possible proof the thing is real.

### 12. Why must every dataset in your capstone be synthetic?

- A. Real data is too large for GitHub
- **B. Committing real personal or financial data is a serious privacy and legal risk, and history cannot be un-pushed** ✅
- C. Synthetic data produces better charts
- D. Regulators require open source projects to use synthetic data

**Why:** Repositories keep history forever and may become public. Generate realistic data instead, and say clearly in the README that it is generated.

### 13. Open banking is best summarised as:

- A. Banks publishing their source code
- B. Cryptocurrency exchanges connecting to banks
- **C. Regulated API access to a customer's bank data with their explicit, scoped, revocable consent** ✅
- D. Free banking for everyone

**Why:** The consent model is the part worth internalising: explicit, limited in scope, time-limited, and revocable. Anything reading someone else's data should meet that bar.

### 14. Which question belongs in an ethics section for a fraud model?

- A. How fast does the model train?
- B. How large is the dataset?
- **C. Who is harmed when it is wrong, and can they find out why?** ✅
- D. Which library version was used?

**Why:** A false flag can strand someone at a checkout with no other way to pay. If your explanation is "the model decided", you have built something you cannot defend.

### 15. Which statement is the most honest in a capstone write-up?

- A. "This is a production-ready banking platform."
- B. "No known limitations."
- C. "The model is 99% accurate."
- **D. "The ledger is single-process; concurrent writes would need row-level locking."** ✅

**Why:** A specific, technically accurate limitation demonstrates understanding. The other three are claims a reviewer will test in the first two minutes of an interview.
