# Level 6: Credit, Loans & Amortization: quiz answer key

> 15 questions. Pass mark is 12/15 (80%).
> Generated from `content/levels/` by `tools/build_quiz_keys.js`: do not edit by hand.

| # | Answer |
|---|--------|
| 1 | **D** |
| 2 | **C** |
| 3 | **D** |
| 4 | **C** |
| 5 | **B** |
| 6 | **B** |
| 7 | **C** |
| 8 | **C** |
| 9 | **B** |
| 10 | **A** |
| 11 | **A** |
| 12 | **D** |
| 13 | **A** |
| 14 | **B** |
| 15 | **A** |

---

### 1. In `payment = P * i / (1 - (1 + i) ** -n)`, what is i?

- A. The inflation rate
- B. The total interest paid
- C. The annual interest rate
- **D. The rate per payment period: annual rate divided by payments per year** ✅

**Why:** Every term in the formula is per period. Passing an annual rate with a monthly term count inflates the payment by roughly twelve times.

### 2. How is the interest portion of a monthly payment calculated?

- A. Original loan amount x periodic rate
- B. Payment amount x periodic rate
- **C. Current outstanding balance x periodic rate** ✅
- D. Total interest divided by the number of payments

**Why:** Interest accrues on what is still owed. Using the original amount is the classic bug: the balance then never reaches zero.

### 3. On a $250,000 loan at 5.5% over 30 years, roughly what share of the first payment reduces the debt?

- A. About 81%
- B. All of it
- C. About 50%
- **D. About 19%** ✅

**Why:** Month 1 is $1,145.83 interest and $273.64 principal out of $1,419.47: 19.3%. The split crosses over around month 180.

### 4. What does the crossover point of an amortization schedule mean?

- A. The month the loan is half repaid in time
- B. The month the payment changes
- **C. The month the principal portion first exceeds the interest portion** ✅
- D. The month the balance goes negative

**Why:** It marks the shift from mostly paying for the money to mostly repaying it. On this 30-year mortgage it lands in month 210 (year 18) far later than most borrowers expect.

### 5. A lender charges a $400 fee on a $20,000 loan at 7% for 5 years. What happens to the APR?

- A. It stays at 7% because the rate did not change
- **B. It rises to about 7.85% because the borrower receives only $19,600** ✅
- C. It falls, since the fee is paid separately
- D. It cannot be calculated

**Why:** APR is the rate at which the payment stream equals the cash actually advanced. Fees raise the effective cost even when the quoted rate is unchanged.

### 6. Why is bisection used to find a fee-inclusive APR?

- A. Because the formula is too slow to evaluate
- **B. Because there is no closed-form solution, so the rate must be searched for numerically** ✅
- C. Because APR is always an approximation by law
- D. Because Python cannot compute exponents

**Why:** The rate appears inside a polynomial with no algebraic solution. Bisection brackets the answer and halves the interval until it is precise enough.

### 7. An extra $200 a month on a 30-year $250,000 mortgage at 5.5% saves about:

- A. $54,000 and 22 months
- B. $7,500 and 9 months
- **C. about $75,616 and 91 months** ✅
- D. $200,000 and 15 years

**Why:** Each extra dollar of principal removes all the future interest that dollar would have generated, so $54,000 of overpayments removes about $75,616 of interest and 7.5 years.

### 8. An extra payment on an amortizing loan is applied to:

- A. The final payment only
- B. Interest first, then principal
- **C. Principal only** ✅
- D. Split in the same ratio as the regular payment

**Why:** The scheduled payment already covers the accrued interest, so anything extra reduces the balance directly, which is exactly why overpaying is so effective.

### 9. Why is the last payment of a real loan usually a different amount?

- A. The borrower gets a discount
- **B. Rounding to cents means identical payments do not land exactly on zero** ✅
- C. Interest rates change at the end of a term
- D. Lenders charge a closing fee

**Why:** Each payment is rounded, so a tiny residue accumulates. The final payment is whatever is actually left, and your schedule should end at exactly zero.

### 10. What does a DTI of 31.3% mean?

- **A. Monthly debt payments consume 31.3% of gross monthly income** ✅
- B. The borrower has a 31.3% chance of default
- C. 31.3% of the loan is repaid
- D. The loan covers 31.3% of the asset value

**Why:** DTI measures capacity to pay. Under roughly 36% is usually considered comfortable; above 43% is commonly treated as high risk.

### 11. A $200,000 loan against a $250,000 property has what LTV, and what does it imply?

- **A. 80%, moderate risk with a 20% equity cushion** ✅
- B. 125%, the loan exceeds the value
- C. 20%, very low risk
- D. 80%, meaning the borrower owns 80% of the property

**Why:** LTV = 200,000 / 250,000 = 80%. The 20% deposit is the lender's cushion if the property must be sold; higher LTV means higher risk and a higher rate.

### 12. Expected loss on a loan portfolio is approximately:

- A. Interest rate x loan amount
- B. Total defaults divided by total loans
- C. Loan amount minus collateral value
- **D. Probability of default x loss given default x exposure** ✅

**Why:** Three factors: how likely default is, how much is lost when it happens, and how much is outstanding. The rate charged must cover this plus funding, operations, and profit.

### 13. Why must credit models avoid variables that proxy for protected characteristics?

- **A. Because lending decisions based on them can be illegal discrimination, whatever the intent** ✅
- B. They reduce model accuracy
- C. Because regulators ban all demographic data
- D. Because such data is always missing

**Why:** Fair-lending law looks at outcomes, not intentions. A postcode variable can encode race; "the model said so" is not a defence, which is why explainability is mandatory in credit.

### 14. Your schedule loop ends with a balance of -$0.17. What is wrong?

- A. The interest rate is too high
- **B. The final payment was not capped at the remaining balance** ✅
- C. Nothing, negative balances are normal
- D. The loop ran too few times

**Why:** When the principal portion exceeds what is left, cap it at the remaining balance so the final payment is smaller and the loan ends at exactly zero.

### 15. Why include a `month < 1200` bound in the schedule loop?

- **A. As a safety bound: a payment too small to cover the interest would otherwise loop forever** ✅
- B. Because loans cannot exceed 100 years by law
- C. To stop the DataFrame growing too large
- D. To make the function faster

**Why:** If the payment is less than the accrued interest the balance grows every month and the while condition never becomes false. A bound turns an infinite hang into a visible bug.
