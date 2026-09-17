/* =========================================================================
   Level 6: credit and lending
   ========================================================================= */
FQ.registerLevel({
  id: 6,
  codename: 'underwriting',
  title: 'Credit, loans and amortization',
  tagline: 'Where that monthly payment comes from, and why the first year barely dents the debt.',
  difficulty: 6,
  minutes: 150,
  tags: ['amortization', 'APR', 'credit risk'],
  summary: 'Lending is the most profitable thing in finance and the easiest to get wrong. This level builds the ' +
           'amortization schedule behind every mortgage, car loan and BNPL plan, then shows what an extra $200 a month really does.',

  objectives: [
    'Derive the monthly payment for an amortizing loan and explain every symbol',
    'Build a full schedule splitting each payment into interest and principal',
    'Explain why early payments are mostly interest and late payments mostly principal',
    'Distinguish interest rate from APR, and compute an APR that includes fees',
    'Quantify the effect of overpayments on total interest and term',
    'Describe how lenders assess credit risk with DTI, LTV, and the five Cs'
  ],

  knowledge: [
    { h: 'An amortizing loan in one sentence' },
    { p: 'You borrow a lump sum and repay it with **equal payments**. Each payment first covers the interest that accrued ' +
         'since the last one; whatever is left reduces the balance. Because the balance shrinks, the interest portion shrinks, ' +
         'so the principal portion grows: the same payment, split differently every month.' },
    { code: 'payment = P x i / (1 - (1 + i) ** -n)\n\nP = amount borrowed\ni = periodic rate  = annual rate / payments per year\nn = total payments = years x payments per year', lang: 'text', label: 'the amortization formula' },
    { p: 'This is the level 2 annuity relationship rearranged: the payment whose present value equals the loan. ' +
         'You are solving "what stream of payments is worth exactly $250,000 today at this discount rate?"' },
    { table: {
      head: ['Loan', 'Rate', 'Term', 'Monthly', 'Total interest'],
      rows: [
        ['$20,000 car', '7.0%', '5 yrs', '$396.02', '$3,761.44'],
        ['$250,000 home', '5.5%', '30 yrs', '$1,419.47', '**$261,010**'],
        ['$5,000 card debt', '24.0%', '2 yrs', '$264.36', '$1,344.53']
      ]
    }},
    { check: {
      q: 'The car loan is $20,000 at 7% for five years, and 60 payments of $396.02 come to $23,761.20. A member expects the ' +
         'interest to be 7% of $20,000 for five years, which is $7,000. It is $3,761. Where did the other half go?',
      a: 'It was never owed. You hold the full $20,000 for one month only. After the first payment you owe about $19,720, ' +
         'and by the final year you owe a few hundred dollars, so the interest each month is charged on a balance that is ' +
         'falling the whole time. Average roughly half the loan over the term and you land near half the naive figure, which ' +
         'is what happened here. The same reasoning tells you why an interest only loan costs so much more: nothing shrinks.'
    }},
    { money: 'On that mortgage the borrower repays $511,010 for a $250,000 house. The interest is not a rounding detail. ' +
             'It is the second house. Showing this clearly is the single most useful feature a lending product can ship.' },

    { h: 'Why the first payment barely dents the debt' },
    { p: 'On the $250,000 mortgage the first payment of $1,419.47 splits like this:' },
    { code: 'interest  = 250,000 x (0.055 / 12) = $1,145.83\nprincipal = 1,419.47 - 1,145.83    =   $273.64', lang: 'text', label: 'month 1' },
    { check: {
      q: 'Work out the month 2 split without building a schedule, then say what it tells you about month 3.',
      a: 'The balance is now 250,000.00 - 273.64 = $249,726.36. Interest is 249,726.36 x 0.055 / 12 = $1,144.58, so principal ' +
         'is 1,419.47 - 1,144.58 = $274.89: $1.25 more than last month. Month 3 will move a little more than that, because ' +
         'the balance fell a little further. That widening step is the entire mechanism of amortization, and it is why the ' +
         'crossover happens two thirds of the way in rather than halfway.'
    }},
    { p: 'Only **19%** of the first payment reduces the debt. By month 210 the split has crossed over and most of the payment ' +
         'is principal. This is not a trick by the bank (it falls out of charging interest on the outstanding balance) ' +
         'but borrowers are consistently shocked by it, which makes it worth showing on screen.' },
    { warn: 'Recomputing interest on the *original* amount each month instead of the *current balance* is the most common ' +
            'bug in a first amortization schedule. Your final balance will not land on zero, which is how you catch it.' },

    { check: {
      q: 'A schedule charges interest on the original $250,000 every month instead of the current balance. The payment is ' +
         'right and the term is right, so nothing looks wrong. How does the bug announce itself?',
      a: 'The closing balance. Interest is stuck at $1,145.83, so principal is stuck at $273.64, and 360 x 273.64 = ' +
         '$98,510.40. After thirty years of paying on time the borrower would still owe $151,489.60. The schedule ends ' +
         'nowhere near zero, which is why the last line of your build is an assertion that the final balance is exactly ' +
         'zero: it is the one check that catches most of the ways this can go wrong.'
    }},

    { h: 'Interest rate vs APR' },
    { p: 'The **interest rate** prices the borrowed money. The **APR** is a legally-defined disclosure that also folds in ' +
         'fees, so two loans can be compared fairly. If a lender charges a $400 origination fee on a $20,000 loan at 7%, ' +
         'the borrower receives only $19,600 but still repays $396.02 a month.' },
    { code: 'Rate stated:  7.00%\nCash received: $19,600  (after the $400 fee)\nPayment:       $396.02 x 60 months\n\nTrue APR:      7.85%   <- the rate that makes the payments worth $19,600 today', lang: 'text', label: 'fees change the real cost' },
    { p: 'There is no closed-form solution for that APR: you find it by **searching**: try a rate, compute the present value ' +
         'of the payments, and adjust. Halving the search range each time (bisection) converges in a handful of steps.' },

    { check: {
      q: 'Two lenders quote 7% on $20,000 over five years. The payment is $396.02 either way, but one deducts a $400 ' +
         'origination fee from the cash it hands over. Which is cheaper, and which number says so?',
      a: 'The one without the fee, and the number is the APR. The borrower with the fee repays the same $23,761.20 having ' +
         'received $19,600, so the rate that makes those payments worth $19,600 today is 7.85%, not 7.00%. The stated rate ' +
         'cannot show the difference, because it is identical in both offers. That gap is exactly what APR disclosure rules ' +
         'exist to close, and it is why a loan comparison screen that shows rate rather than APR is not a comparison.'
    }},

    { h: 'Overpayment: the highest-return move most borrowers never make' },
    { p: 'An extra payment goes **entirely to principal**. Every dollar of principal removed also removes all the future ' +
         'interest that dollar would have generated, which is why the effect is so large.' },
    { table: {
      head: ['$250,000 at 5.5% over 30 years', 'Standard', 'Plus $200/month'],
      rows: [
        ['Monthly payment', '$1,419.47', '$1,619.47'],
        ['Months to clear', '360', '**269**'],
        ['Total interest', '$261,010', '$185,394'],
        ['Interest saved', '', '**$75,616**']
      ]
    }},
    { p: 'An extra $200 a month ($54,000 of deposits over 22 years) removes about $75,616 of interest and ends the loan ' +
         'seven and a half years early. Comparing that against an investment returning the same rate is a genuinely ' +
         'useful thing for a product to do.' },
    { check: {
      q: 'The extra deposits add up to $53,800, yet the interest bill falls by $75,616. Explain how paying in $53,800 takes ' +
         'out $75,616.',
      a: 'Because a dollar of principal repaid early takes every future month of interest on that dollar with it. The $200 ' +
         'paid in month one comes off the balance and carries 359 months of its own interest away with it. Then the loan ' +
         'finishes 91 months early, so 91 payments of $1,419.47, another $129,171, are never made at all. The deposits are ' +
         'small and early; what they cancel is large and spread over decades.'
    }},
    { tip: 'Not all lenders treat overpayments the same way. Some reduce the term (best for the borrower), others reduce ' +
           'the future payment, and some charge an early repayment penalty. Read the contract before writing the feature.' },

    { h: 'How lenders decide: the five Cs' },
    { table: {
      head: ['C', 'Question', 'Measured by'],
      rows: [
        ['**Character**', 'Do they repay debts?', 'Credit history, prior defaults'],
        ['**Capacity**', 'Can they afford this?', 'Debt-to-income ratio'],
        ['**Capital**', 'What have they put in?', 'Deposit, savings'],
        ['**Collateral**', 'What secures it?', 'Loan-to-value ratio'],
        ['**Conditions**', 'What is the environment?', 'Rates, sector, purpose']
      ]
    }},
    { code: 'DTI = monthly debt payments / gross monthly income\n      $1,250 / $4,000 = 31.3%     (under ~36% is comfortable)\n\nLTV = loan / asset value\n      $200,000 / $250,000 = 80%   (higher LTV = higher risk = higher rate)', lang: 'text', label: 'the two ratios you will meet everywhere' },
    { check: {
      q: 'An applicant grosses $4,000 a month, already pays $1,250 a month on other debt, and wants the $250,000 mortgage at ' +
         '$1,419.47. Work out the ratio a lender will look at, and say which of the five Cs just decided this.',
      a: '(1,250.00 + 1,419.47) / 4,000.00 = 66.7% debt to income, against a comfort line around 36%. That is capacity, and ' +
         'it fails on its own: character, capital, collateral and conditions do not get a vote, because the payments do not ' +
         'fit in the income whatever else is true. A well built product says this before the application, not after, since ' +
         'the applicant can act on a number they can see.'
    }},
    { p: 'A lender\'s price is a risk price. Expected loss is roughly **probability of default x loss given default x exposure**, ' +
         'and the interest rate must cover that expected loss, the cost of funds, operating cost, and profit. When you see a ' +
         '29% APR product, you are usually looking at a population where many borrowers do not repay.' },
    { warn: 'Credit models decide who gets a loan, so they are heavily regulated. Using a variable that proxies for race, ' +
            'gender, or postcode can be illegal discrimination even when the intent is innocent, and "the model said so" ' +
            'is not a defence. Level 8 returns to this with fraud scoring.' },

    { check: {
      q: 'Your credit model never sees race or gender, and it is measurably more accurate with postcode included. Is it safe ' +
         'to ship?',
      a: 'Not on that reasoning alone. Where people live correlates strongly with race in most countries, so postcode can ' +
         'carry the protected attribute into the model without anyone having to intend it, and the law in the US, the UK and ' +
         'the EU looks at the outcome rather than the intent. What you owe is measurement: approval and pricing rates ' +
         'compared across protected groups, a reason you can give for every decline, and a willingness to give up some ' +
         'accuracy when the test fails. "The model is more accurate this way" is a description of the problem, not a defence.'
    }},

    { h: 'Rounding the last payment' },
    { p: 'Payments are rounded to cents, so 359 identical payments will not clear the balance exactly. Real lenders make the ' +
         '**final payment different**: it is whatever is left. Your schedule should do the same, and finish with a balance of ' +
         'exactly zero rather than $0.04 or -$0.17.' },
    { check: {
      q: 'Your schedule charges 360 payments of exactly $1,419.47 and ends at a balance of -$0.17. Say what the minus sign ' +
         'means for the borrower, and what a real lender does instead.',
      a: 'It means they paid 17 cents more than they owed, so the lender is holding money that is not theirs. Tiny, and ' +
         'still the kind of thing that becomes a letter. A real lender sizes the last payment to whatever is left: that ' +
         'month\'s interest plus the remaining balance, which makes the final row a few cents different from the other 359 ' +
         'and lands the schedule on exactly zero. Assert that closing balance in your build. It is the cheapest test you ' +
         'will ever write and it catches most of the ways a schedule goes wrong.'
    }}
  ],

  tutorial: {
    intro: 'New notebook: `finquest-level-06.ipynb`. You will reuse pandas from level 3 and the formatting habits from level 2.',
    steps: [
      {
        t: 'The payment formula, with the zero-rate guard',
        blocks: [
          { code: 'def monthly_payment(principal, annual_rate, years, payments_per_year=12):\n    """Equal payment that amortizes a loan to zero."""\n    i = annual_rate / payments_per_year\n    n = years * payments_per_year\n    if i == 0:\n        return principal / n              # interest-free: just split it\n    return principal * i / (1 - (1 + i) ** -n)\n\n\nprint(f"${monthly_payment(20000, 0.07, 5):,.2f}")      # 396.02\nprint(f"${monthly_payment(250000, 0.055, 30):,.2f}")   # 1,419.47', lang: 'python' },
          { p: 'The `-n` in the exponent is not a typo: `(1 + i) ** -n` is 1 divided by `(1 + i) ** n`. Writing it the long ' +
               'way is fine too, but this matches how the formula appears in every textbook.' }
        ],
        check: 'Both example payments match to the cent.'
      },
      {
        t: 'Build the schedule one month at a time',
        blocks: [
          { p: 'Interest is always charged on the **current** balance. Collect rows in a list of dicts, then hand them to pandas.' },
          { code: 'import pandas as pd\n\ndef schedule(principal, annual_rate, years, extra=0, payments_per_year=12):\n    """Return a DataFrame: month, payment, interest, principal, balance."""\n    i = annual_rate / payments_per_year\n    payment = monthly_payment(principal, annual_rate, years, payments_per_year)\n    balance = principal\n    rows = []\n    month = 0\n\n    while balance > 0.005 and month < 1200:          # safety bound\n        month += 1\n        interest = balance * i\n        principal_part = payment + extra - interest\n        if principal_part > balance:                 # final payment is smaller\n            principal_part = balance\n        balance -= principal_part\n        rows.append({\n            "month": month,\n            "payment": round(interest + principal_part, 2),\n            "interest": round(interest, 2),\n            "principal": round(principal_part, 2),\n            "balance": round(max(balance, 0), 2),\n        })\n\n    return pd.DataFrame(rows)\n\n\ndf = schedule(250000, 0.055, 30)\nprint(df.head(3).to_string(index=False))\nprint(df.tail(2).to_string(index=False))\nprint(len(df), "payments,", f"${df[\'interest\'].sum():,.2f} interest")', lang: 'python' },
          { p: 'Three details that separate a working schedule from a broken one: interest on the *current* balance, ' +
               'a *smaller final payment*, and a *loop bound* so a bad input cannot spin forever.' }
        ],
        check: 'The schedule has 360 rows, ends with a balance of 0.0, and totals about $261,010 of interest.'
      },
      {
        t: 'Find the crossover month',
        blocks: [
          { code: 'crossover = df[df["principal"] > df["interest"]].iloc[0]\nprint(f"Principal overtakes interest in month {int(crossover[\'month\'])}"\n      f" (year {int(crossover[\'month\']) // 12 + 1})")\n\nfirst = df.iloc[0]\nprint(f"Month 1: {first[\'principal\'] / first[\'payment\']:.1%} of the payment reduces the debt")', lang: 'python' },
          { p: '`.iloc[0]` takes the first row of a filtered DataFrame by position. This one statistic ("you cross over in ' +
               'year 15") communicates more about a 30-year mortgage than the whole schedule.' }
        ],
        check: 'You can state the crossover month and the month-1 principal share (19.3%).'
      },
      {
        t: 'Compare scenarios',
        blocks: [
          { code: 'def compare(principal, rate, years, extra):\n    base = schedule(principal, rate, years)\n    fast = schedule(principal, rate, years, extra=extra)\n    saved_interest = base["interest"].sum() - fast["interest"].sum()\n    saved_months = len(base) - len(fast)\n\n    print(f"{\'\':<22}{\'standard\':>14}{\'+ extra\':>14}")\n    print(f"{\'months\':<22}{len(base):>14}{len(fast):>14}")\n    print(f"{\'total interest\':<22}{base[\'interest\'].sum():>14,.2f}{fast[\'interest\'].sum():>14,.2f}")\n    print(f"{\'interest saved\':<22}{\'\':>14}{saved_interest:>14,.2f}")\n    print(f"{\'time saved\':<22}{\'\':>14}{saved_months // 12:>11} y {saved_months % 12} m")\n    return saved_interest, saved_months\n\n\ncompare(250000, 0.055, 30, extra=200)', lang: 'python' }
        ],
        check: 'Your comparison shows about $75,616 saved and 91 months cut.'
      },
      {
        t: 'Solve for APR with bisection',
        blocks: [
          { p: 'To include fees you need the rate at which the payment stream is worth the **cash actually received**. ' +
               'Bisection: keep a low and a high guess, test the midpoint, and discard the half that cannot contain the answer.' },
          { code: 'def present_value(payment, annual_rate, years, payments_per_year=12):\n    i = annual_rate / payments_per_year\n    n = years * payments_per_year\n    if i == 0:\n        return payment * n\n    return payment * (1 - (1 + i) ** -n) / i\n\n\ndef true_apr(principal, fees, annual_rate, years):\n    """The APR a borrower really pays once fees are deducted up front."""\n    payment = monthly_payment(principal, annual_rate, years)\n    received = principal - fees\n    low, high = 0.0, 1.0\n    for _ in range(100):\n        mid = (low + high) / 2\n        if present_value(payment, mid, years) > received:\n            low = mid          # rate too low -> payments look too valuable\n        else:\n            high = mid\n    return low\n\n\nprint(f"{true_apr(20000, 400, 0.07, 5):.2%}")     # 7.85%', lang: 'python' },
          { tip: '100 iterations of bisection narrows a range of 1.0 to about 1e-30: far more precision than money needs. ' +
                 'Twenty would do; the loop is cheap either way.' }
        ],
        check: 'true_apr(20000, 400, 0.07, 5) returns 7.85%.'
      },
      {
        t: 'Affordability ratios',
        blocks: [
          { code: 'def dti(monthly_debt_payments, gross_monthly_income):\n    return monthly_debt_payments / gross_monthly_income\n\ndef ltv(loan_amount, asset_value):\n    return loan_amount / asset_value\n\ndef assess(payment, other_debts, income, loan, value):\n    ratio = dti(payment + other_debts, income)\n    band = "comfortable" if ratio < 0.36 else "stretched" if ratio < 0.43 else "high risk"\n    print(f"DTI {ratio:.1%}: {band}")\n    print(f"LTV {ltv(loan, value):.1%}")\n\n\nassess(payment=1419.47, other_debts=250, income=6000, loan=250000, value=312500)', lang: 'python' },
          { p: 'A chained conditional expression (`a if cond else b if cond2 else c`) reads top to bottom and is the ' +
               'clearest way to turn a number into a band. Thresholds like 36% and 43% are conventions, not laws: ' +
               'document where yours came from.' }
        ],
        check: 'Your assessor prints a DTI band and an LTV percentage.'
      },
      {
        t: 'Chart the split over time',
        blocks: [
          { code: 'import matplotlib.pyplot as plt\n\nfig, ax = plt.subplots(figsize=(9, 4))\nax.plot(df["month"], df["interest"], label="interest")\nax.plot(df["month"], df["principal"], label="principal")\nax.set_title("Where each payment goes: $250,000 at 5.5% over 30 years")\nax.set_xlabel("month")\nax.set_ylabel("USD")\nax.legend()\nplt.tight_layout()\nplt.show()', lang: 'python' },
          { p: 'Two lines crossing is the clearest possible picture of amortization. Always label both series and both axes, ' +
               'an unlabelled financial chart is decoration, not evidence.' }
        ],
        check: 'A chart shows the interest line falling and the principal line rising, crossing near month 210.'
      }
    ]
  },

  glossary: [
    { t: 'Principal', d: 'The outstanding amount borrowed, on which interest is charged.' },
    { t: 'Amortization', d: 'Repaying a loan through equal payments that cover interest first, then reduce principal.' },
    { t: 'Periodic rate (i)', d: 'Annual rate divided by payments per year.' },
    { t: 'Term (n)', d: 'Total number of payments.' },
    { t: 'APR', d: 'Fee-inclusive annual cost of borrowing, used to compare offers on equal terms.' },
    { t: 'Origination fee', d: 'An up-front charge deducted from the advance, raising the true APR.' },
    { t: 'Crossover point', d: 'The month when the principal portion first exceeds the interest portion.' },
    { t: 'Overpayment', d: 'An extra amount applied entirely to principal, removing all its future interest.' },
    { t: 'Early repayment charge', d: 'A penalty some lenders apply when a loan is cleared ahead of schedule.' },
    { t: 'DTI', d: 'Debt-to-income: monthly debt payments divided by gross monthly income.' },
    { t: 'LTV', d: 'Loan-to-value: loan divided by the value of the asset securing it.' },
    { t: 'Expected loss', d: 'Probability of default x loss given default x exposure at default.' },
    { t: 'Bisection', d: 'Root-finding by repeatedly halving an interval that brackets the answer.' },
    { t: 'Balloon payment', d: 'A large final payment left over when earlier payments do not fully amortize the loan.' }
  ],

  quiz: [
    { q: "In `payment = P * i / (1 - (1 + i) ** -n)`, what is i?",
      options: [
        "The inflation rate",
        "The total interest paid",
        "The annual interest rate",
        "The rate per payment period: annual rate divided by payments per year"
      ],
      answer: 3,
      why: "Every term in the formula is per period. Passing an annual rate with a monthly term count inflates the payment by roughly twelve times." },

    { q: "How is the interest portion of a monthly payment calculated?",
      options: [
        "Original loan amount x periodic rate",
        "Payment amount x periodic rate",
        "Current outstanding balance x periodic rate",
        "Total interest divided by the number of payments"
      ],
      answer: 2,
      why: "Interest accrues on what is still owed. Using the original amount is the classic bug: the balance then never reaches zero." },

    { q: "On a $250,000 loan at 5.5% over 30 years, roughly what share of the first payment reduces the debt?",
      options: [
        "About 81%",
        "All of it",
        "About 50%",
        "About 19%"
      ],
      answer: 3,
      why: "Month 1 is $1,145.83 interest and $273.64 principal out of $1,419.47: 19.3%. The split crosses over around month 180." },

    { q: "What does the crossover point of an amortization schedule mean?",
      options: [
        "The month the loan is half repaid in time",
        "The month the payment changes",
        "The month the principal portion first exceeds the interest portion",
        "The month the balance goes negative"
      ],
      answer: 2,
      why: "It marks the shift from mostly paying for the money to mostly repaying it. On this 30-year mortgage it lands in month 210 (year 18) far later than most borrowers expect." },

    { q: "A lender charges a $400 fee on a $20,000 loan at 7% for 5 years. What happens to the APR?",
      options: [
        "It stays at 7% because the rate did not change",
        "It rises to about 7.85% because the borrower receives only $19,600",
        "It falls, since the fee is paid separately",
        "It cannot be calculated"
      ],
      answer: 1,
      why: "APR is the rate at which the payment stream equals the cash actually advanced. Fees raise the effective cost even when the quoted rate is unchanged." },

    { q: "Why is bisection used to find a fee-inclusive APR?",
      options: [
        "Because the formula is too slow to evaluate",
        "Because there is no closed-form solution, so the rate must be searched for numerically",
        "Because APR is always an approximation by law",
        "Because Python cannot compute exponents"
      ],
      answer: 1,
      why: "The rate appears inside a polynomial with no algebraic solution. Bisection brackets the answer and halves the interval until it is precise enough." },

    { q: "An extra $200 a month on a 30-year $250,000 mortgage at 5.5% saves about:",
      options: [
        "$54,000 and 22 months",
        "$7,500 and 9 months",
        "about $75,616 and 91 months",
        "$200,000 and 15 years"
      ],
      answer: 2,
      why: "Each extra dollar of principal removes all the future interest that dollar would have generated, so $54,000 of overpayments removes about $75,616 of interest and 7.5 years." },

    { q: "An extra payment on an amortizing loan is applied to:",
      options: [
        "The final payment only",
        "Interest first, then principal",
        "Principal only",
        "Split in the same ratio as the regular payment"
      ],
      answer: 2,
      why: "The scheduled payment already covers the accrued interest, so anything extra reduces the balance directly, which is exactly why overpaying is so effective." },

    { q: "Why is the last payment of a real loan usually a different amount?",
      options: [
        "The borrower gets a discount",
        "Rounding to cents means identical payments do not land exactly on zero",
        "Interest rates change at the end of a term",
        "Lenders charge a closing fee"
      ],
      answer: 1,
      why: "Each payment is rounded, so a tiny residue accumulates. The final payment is whatever is actually left, and your schedule should end at exactly zero." },

    { q: "What does a DTI of 31.3% mean?",
      options: [
        "Monthly debt payments consume 31.3% of gross monthly income",
        "The borrower has a 31.3% chance of default",
        "31.3% of the loan is repaid",
        "The loan covers 31.3% of the asset value"
      ],
      answer: 0,
      why: "DTI measures capacity to pay. Under roughly 36% is usually considered comfortable; above 43% is commonly treated as high risk." },

    { q: "A $200,000 loan against a $250,000 property has what LTV, and what does it imply?",
      options: [
        "80%, moderate risk with a 20% equity cushion",
        "125%, the loan exceeds the value",
        "20%, very low risk",
        "80%, meaning the borrower owns 80% of the property"
      ],
      answer: 0,
      why: "LTV = 200,000 / 250,000 = 80%. The 20% deposit is the lender's cushion if the property must be sold; higher LTV means higher risk and a higher rate." },

    { q: "Expected loss on a loan portfolio is approximately:",
      options: [
        "Interest rate x loan amount",
        "Total defaults divided by total loans",
        "Loan amount minus collateral value",
        "Probability of default x loss given default x exposure"
      ],
      answer: 3,
      why: "Three factors: how likely default is, how much is lost when it happens, and how much is outstanding. The rate charged must cover this plus funding, operations, and profit." },

    { q: "Why must credit models avoid variables that proxy for protected characteristics?",
      options: [
        "Because lending decisions based on them can be illegal discrimination, whatever the intent",
        "They reduce model accuracy",
        "Because regulators ban all demographic data",
        "Because such data is always missing"
      ],
      answer: 0,
      why: "Fair-lending law looks at outcomes, not intentions. A postcode variable can encode race; \"the model said so\" is not a defence, which is why explainability is mandatory in credit." },

    { q: "Your schedule loop ends with a balance of -$0.17. What is wrong?",
      options: [
        "The interest rate is too high",
        "The final payment was not capped at the remaining balance",
        "Nothing, negative balances are normal",
        "The loop ran too few times"
      ],
      answer: 1,
      why: "When the principal portion exceeds what is left, cap it at the remaining balance so the final payment is smaller and the loan ends at exactly zero." },

    { q: "Why include a `month < 1200` bound in the schedule loop?",
      options: [
        "As a safety bound: a payment too small to cover the interest would otherwise loop forever",
        "Because loans cannot exceed 100 years by law",
        "To stop the DataFrame growing too large",
        "To make the function faster"
      ],
      answer: 0,
      why: "If the payment is less than the accrued interest the balance grows every month and the while condition never becomes false. A bound turns an infinite hang into a visible bug." }
  ],

  project: {
    title: 'Loan amortization and early-payoff simulator',
    story: 'A member is torn between a 25-year and a 30-year mortgage, and wonders whether overpaying $200 a month ' +
           'beats investing it instead. Build the tool that answers both questions with numbers rather than ' +
           'opinions.',
    scope: 'Uses this level plus levels 2 and 3: the payment formula, a while loop, pandas DataFrames, matplotlib, ' +
           'bisection, and f-string formatting. No new libraries.',
    requirements: [
      '`monthly_payment(principal, annual_rate, years, payments_per_year=12)` with a zero-rate guard',
      '`schedule(...)` returning a DataFrame of month, payment, interest, principal, balance',
      'Interest computed on the current balance; final payment capped so the balance ends at exactly 0.00',
      'A loop safety bound that prevents an infinite loop when the payment cannot cover the interest',
      '`summarise(df)` returning total paid, total interest, interest as a share of principal, and the crossover month',
      '`compare_terms(principal, rate, [15, 25, 30])` printing payment and total interest per term side by side',
      '`compare_overpayment(principal, rate, years, extra)` printing interest saved and months saved',
      '`true_apr(principal, fees, annual_rate, years)` using bisection, accurate to 0.01%',
      '`dti(...)` and `ltv(...)` plus an `assess(...)` that bands the result as comfortable / stretched / high risk',
      'A chart of interest vs principal per month with both series labelled and a marked crossover',
      'A second chart of the declining balance, standard vs overpaid, on the same axes',
      'An `invest_instead(extra, rate, years)` comparison: overpaying vs investing the same $200 at a stated return, with your written conclusion about which wins and why the honest answer depends on the rate gap and on risk',
      'A `report(...)` that prints every section in an aligned, readable block',
      'Saved to your portfolio repo as `level-06-loan-simulator.ipynb`'
    ],
    starter: {
      lang: 'python',
      code: '"""FinQuest level 6: Loan amortization and early-payoff simulator"""\n\nimport pandas as pd\nimport matplotlib.pyplot as plt\n\n\ndef monthly_payment(principal, annual_rate, years, payments_per_year=12):\n    """Equal payment that amortizes the loan to zero. Handle rate == 0."""\n    # TODO\n    pass\n\n\ndef schedule(principal, annual_rate, years, extra=0, payments_per_year=12):\n    """DataFrame: month, payment, interest, principal, balance.\n    Interest on the current balance. Cap the final payment. Bound the loop.\n    """\n    # TODO\n    pass\n\n\ndef summarise(df):\n    """Total paid, total interest, interest share, crossover month."""\n    # TODO\n    pass\n\n\ndef compare_terms(principal, annual_rate, terms=(15, 25, 30)):\n    # TODO\n    pass\n\n\ndef compare_overpayment(principal, annual_rate, years, extra):\n    # TODO\n    pass\n\n\ndef present_value(payment, annual_rate, years, payments_per_year=12):\n    # TODO\n    pass\n\n\ndef true_apr(principal, fees, annual_rate, years):\n    """Bisection search for the fee-inclusive APR."""\n    # TODO\n    pass\n\n\ndef dti(monthly_debt_payments, gross_monthly_income):\n    pass\n\n\ndef ltv(loan_amount, asset_value):\n    pass\n\n\ndef assess(payment, other_debts, income, loan, value):\n    pass\n\n\ndef plot_split(df):\n    """Interest vs principal per month, crossover marked."""\n    pass\n\n\ndef plot_balances(principal, annual_rate, years, extra):\n    """Standard vs overpaid balance on one chart."""\n    pass\n\n\ndef invest_instead(extra, invest_rate, years):\n    """Future value of investing the overpayment instead (Level 2 annuity)."""\n    pass\n\n\ndef report(principal=250000, annual_rate=0.055, years=30, extra=200, fees=400):\n    pass\n\n\nif __name__ == "__main__":\n    report()\n'
    },
    tests: [
      'monthly_payment(20000, 0.07, 5) == 396.02 (to 2dp)',
      'monthly_payment(250000, 0.055, 30) == 1419.47 (to 2dp)',
      'monthly_payment(12000, 0.0, 4) == 250.00 exactly',
      'schedule(250000, 0.055, 30) has exactly 360 rows and a final balance of 0.00',
      'That schedule totals $261,010 of interest (a few cents either way, depending on where you round)',
      'Month 1 shows $1,145.83 interest and $273.64 principal',
      'schedule(..., extra=200) has 269 rows and about $185,394 of interest',
      'compare_overpayment reports about $75,616 saved and exactly 91 months cut',
      'true_apr(20000, 400, 0.07, 5) is 7.85% (to 2dp)',
      'dti(1250, 4000) == 0.3125 and ltv(200000, 250000) == 0.80',
      'A payment smaller than the monthly interest terminates via the loop bound instead of hanging'
    ],
    rubric: [
      { pts: 30, t: 'Schedule correctness', d: 'Row counts, interest totals, month-1 split, and a final balance of exactly zero all match.' },
      { pts: 20, t: 'Scenario analysis', d: 'Term comparison, overpayment comparison, and the invest-instead question answered with numbers.' },
      { pts: 15, t: 'APR by bisection', d: 'Converges to 7.85% and still finds the right rate when the fees or the term change.' },
      { pts: 15, t: 'Charts', d: 'Two labelled charts: the interest/principal split with crossover, and the two balance curves.' },
      { pts: 10, t: 'Risk ratios', d: 'DTI and LTV implemented with documented bands.' },
      { pts: 10, t: 'Shipped', d: 'Runs clean from top to bottom and is committed to your portfolio repo.' }
    ],
    stretch: [
      'Add an early repayment charge of 2% of the outstanding balance in the first 5 years and show when overpaying stops being worth it',
      'Model a variable rate: 5.5% for 2 years then 7% thereafter, recomputing the payment at the reset',
      'Add a biweekly payment option (26 half-payments a year) and quantify the hidden 13th payment',
      'Solve for the maximum loan a given income can support at a 36% DTI limit'
    ],
    solutionPath: 'solutions/level-06'
  },

  faq: [
    { q: 'My balance never reaches zero',
      a: 'You are almost certainly charging interest on the original principal instead of the current balance, or not capping the final payment at the remaining balance.' },
    { q: 'My payment is about 12x too big',
      a: 'You passed the annual rate as i, or the years as n. Both must be per period: i = annual_rate / 12 and n = years * 12.' },
    { q: 'The loop never finishes',
      a: 'If payment <= balance * i the debt grows every month. Add a bound (month < 1200) and raise a clear error explaining that the payment cannot service the interest.' },
    { q: 'What exactly is the difference between the interest rate and the APR?',
      a: 'The rate prices the money; the APR also includes fees, so it reflects the cash actually received. A $400 fee on a $20,000 5-year loan at 7% makes the true APR 7.85%.' },
    { q: 'How does bisection find the APR?',
      a: 'Keep a low and a high guess that bracket the answer. Compute the present value of the payments at the midpoint: too high means the rate is too low, so move the low bound up. Repeat about 50 times.' },
    { q: 'Is overpaying always better than investing?',
      a: 'No. Overpaying earns a guaranteed return equal to the loan rate; investing may earn more but is uncertain and less liquid. Compare the rate gap, then say plainly that risk and access to cash are part of the answer.' },
    { q: 'Why is my crossover month different from the example?',
      a: 'It depends on rate and term. Check you are finding the first month where principal > interest, not where the balance is halved. Those are very different months.' }
  ]
});
