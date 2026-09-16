# Level 2: The time value of money: quiz answer key

> 15 questions. Pass mark is 12/15 (80%).
> Generated from `content/levels/` by `tools/build_quiz_keys.js`: do not edit by hand.

| # | Answer |
|---|--------|
| 1 | **D** |
| 2 | **D** |
| 3 | **B** |
| 4 | **A** |
| 5 | **C** |
| 6 | **B** |
| 7 | **C** |
| 8 | **C** |
| 9 | **A** |
| 10 | **A** |
| 11 | **B** |
| 12 | **D** |
| 13 | **B** |
| 14 | **A** |
| 15 | **C** |

---

### 1. $5,000 earns 6% simple interest for 3 years. What is the total interest?

- A. $1,080
- B. $955.08
- C. $300
- **D. $900** ✅

**Why:** Simple interest is P x r x t = 5000 x 0.06 x 3 = $900. Compound interest over the same period would give $955.08.

### 2. Which expression correctly computes compound future value in Python?

- A. principal * (1 + rate * years)
- B. principal ** (1 + rate) * years
- C. principal * (1 + rate) ^ years
- **D. principal * (1 + rate) ** years** ✅

**Why:** Python uses ** for exponents. The ^ operator is bitwise XOR: with a float rate it raises a TypeError, and with whole numbers it silently returns a wrong answer (2 ^ 10 gives 8, not 1024).

### 3. In FV = P(1 + r/n)^(nt), what does n represent?

- A. The number of years
- **B. How many times interest compounds per year** ✅
- C. The nominal rate
- D. The number of payments made

**Why:** n is the compounding frequency. It divides the annual rate into a periodic rate and multiplies the years into total periods.

### 4. A card advertises 24% APR compounding monthly. What is the effective annual rate?

- **A. 26.82%** ✅
- B. 24.00%
- C. 22.14%
- D. 2.00%

**Why:** (1 + 0.24/12)^12 - 1 = 0.2682. The monthly 2% compounds into 26.82% a year: the gap the headline APR hides.

### 5. Why do lenders advertise APR while savings accounts advertise APY?

- A. Regulators require exactly that split in every country
- B. APY cannot be calculated for loans
- **C. APR is the smaller-looking number for a borrower and APY the bigger-looking one for a saver** ✅
- D. APR includes inflation and APY does not

**Why:** Both describe the same money; each side quotes the basis that flatters it. Always convert competing offers to a common basis before comparing.

### 6. Increasing compounding from monthly to daily on an 8% account has what effect?

- A. Roughly doubles the interest earned
- **B. Adds a very small amount: the returns to frequency diminish quickly** ✅
- C. Has no effect at all
- D. Reduces the effective rate

**Why:** On $1,000 for a year, monthly gives $1,083.00 and daily $1,083.28. Continuous compounding only reaches $1,083.29: frequency matters far less than rate or time.

### 7. What does the annuity formula C x [((1+i)^N - 1) / i] calculate?

- A. The present value of a lump sum
- B. The monthly payment needed to repay a loan
- **C. The future value of a series of equal periodic payments** ✅
- D. The effective annual rate

**Why:** It sums a stream of equal deposits, each compounding for a different remaining time. Level 6 rearranges the same relationship to solve for a loan payment.

### 8. Your contributions function must handle a 0% rate. Why?

- A. Because the future value would be negative
- B. Because Python cannot multiply by zero
- **C. Because the formula divides by i, and dividing by zero raises ZeroDivisionError** ✅
- D. Because a 0% rate is illegal in most countries

**Why:** With i = 0 the formula is undefined; the correct answer is simply payment x periods. Guard the case explicitly with an if statement.

### 9. What is $10,000 received in 5 years worth today at a 6% discount rate?

- **A. $7,472.58** ✅
- B. $13,382.26
- C. $9,433.96
- D. $8,000.00

**Why:** PV = 10000 / 1.06^5 = $7,472.58. Discounting is the same compounding relationship run backwards.

### 10. You earn 6% nominal while inflation is 4%. What is the real return?

- **A. 1.92%** ✅
- B. Exactly 2.00%
- C. 2.08%
- D. 10.24%

**Why:** (1.06 / 1.04) - 1 = 1.92%. Subtracting rates is a shortcut that is close at low rates and increasingly wrong as rates rise.

### 11. Using the Rule of 72, roughly how long does money take to double at 9%?

- A. 4 years
- **B. 8 years** ✅
- C. 12 years
- D. 18 years

**Why:** 72 / 9 = 8 years. The exact answer via logarithms is 8.04 years: close enough for mental math.

### 12. Why is `for year in range(1, years + 1)` used instead of `range(years)`?

- A. It avoids floating point errors
- B. range(years) is not valid Python
- C. It runs faster
- **D. range is exclusive of its end, and a schedule should start at year 1, not year 0** ✅

**Why:** range(1, 11) yields 1 through 10. Using range(10) would give 0 through 9, labelling your first row "Year 0".

### 13. In an f-string, what does `f"{rate:.2%}"` produce for rate = 0.0682?

- A. 0.07
- **B. 6.82%** ✅
- C. 0.0682%
- D. 68.20%

**Why:** The % format multiplies by 100, appends the sign, and applies the given precision. Doing it manually is a common source of 100x bugs.

### 14. Your goal-solver loop must return something when a target is unreachable. What is the best design?

- **A. Cap the search with max_years and return None so the caller can report it** ✅
- B. Loop forever until it is reached
- C. Raise an error that crashes the program
- D. Return 0 years

**Why:** An unbounded loop can hang the whole app on a 0% rate. A bounded search with a None result lets the interface say "not reachable in 100 years" gracefully.

### 15. When should a financial projection round its numbers?

- A. Never, always show full precision
- B. Only when the number exceeds 1,000
- **C. Only when displaying the result to a user** ✅
- D. After every single calculation step

**Why:** Rounding mid-calculation injects error that compounds along with the interest. Keep full precision internally and format at the edge.
