# Level 02: SQL for the month end close: quiz answer key

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

### 1. Why does WHERE not work on an aggregate like SUM(amount)?

- A. You must use a subquery for any aggregate
- B. It works in PostgreSQL but not in SQLite
- C. Aggregates are not allowed in filters at all
- **D. WHERE runs before GROUP BY, so the aggregate does not exist yet. HAVING runs after** ✅

**Why:** Execution order is FROM, WHERE, GROUP BY, HAVING, SELECT, ORDER BY. WHERE filters rows before there are any groups; HAVING filters the groups.

### 2. September revenue by month is 3,361,050 and by issued_date is 3,106,395. What is the second number?

- A. Revenue from merchants who paid on time
- B. A rounding difference
- C. Revenue excluding credit notes
- **D. August revenue, because this company bills in arrears on the first of the following month** ✅

**Why:** The invoice for September usage is issued on 1 October, so invoices issued in September are August revenue. No error is raised and both numbers look reasonable.

### 3. The customers table has 235 rows and only 230 appear in invoices. What does a plain JOIN do?

- A. Duplicates the seven across all months
- **B. Silently drops the five, with no warning** ✅
- C. Raises an error about unmatched keys
- D. Returns all 221 with nulls for the missing seven

**Why:** An inner join keeps only matches. Use a LEFT JOIN and check for nulls when you need to know what did not match, which is most of the time in finance.

### 4. What does a LEFT JOIN followed by WHERE right.status = 'paid' become?

- **A. An inner join, because the WHERE throws away the unmatched rows the join kept** ✅
- B. A syntax error
- C. A cross join
- D. A left join with an extra filter

**Why:** The unmatched rows have NULL on the right side, and NULL fails the comparison. Put the condition in the ON clause when you mean to keep unmatched rows.

### 5. The mean of the three segment averages is 19,924 and the true mean invoice is 15,706. Why?

- A. The true mean excludes credit notes
- B. The segment averages were rounded
- **C. The three segments have different numbers of invoices, so averaging the averages weights them equally when they are not** ✅
- D. One segment has outliers

**Why:** Forty enterprise invoices carry the same weight as eighty-eight small ones in an average of averages. Aggregate the underlying rows, or weight by count.

### 6. COUNT(*) returns 3,778 and COUNT(paid_date) returns 3,363. What is the difference?

- A. COUNT(*) includes duplicate ids
- **B. COUNT(column) counts only rows where that column is not null, so the difference is the unpaid invoices** ✅
- C. COUNT(*) is an estimate on large tables
- D. The paid_date column has a different type

**Why:** COUNT(column) ignores nulls. That is useful when you mean it and a silent error when you do not.

### 7. Which finds the unpaid invoices?

- A. WHERE paid_date = NULL
- B. WHERE paid_date != ''
- **C. WHERE paid_date IS NULL** ✅
- D. WHERE NOT paid_date

**Why:** NULL is not equal to anything, including NULL. Only IS NULL and IS NOT NULL test it.

### 8. What does SUM(SUM(amount)) OVER (ORDER BY month) produce?

- A. The grand total repeated on every row
- B. The monthly sum multiplied by the row number
- **C. A running total of the monthly sums, month by month** ✅
- D. An error: you cannot nest aggregates

**Why:** The inner SUM aggregates within each month, then the window runs across the grouped rows in month order. It is the standard year to date column.

### 9. Your query joins invoices to customers and revenue comes out at exactly double. What do you check first?

- **A. Whether customer_id is unique in customers, because a duplicate there doubles every matching invoice** ✅
- B. Whether the database needs reindexing
- C. Whether the date filter is inclusive
- D. Whether the amounts are stored as text

**Why:** Exact doubling is the signature of a one-to-many join you thought was one-to-one. COUNT(*) against COUNT(DISTINCT key) on the lookup table finds it immediately.

### 10. 177 open invoices worth 2.68 million are over 60 days past due, on 30 day terms. What does that tell the pack?

- **A. The revenue is recognised and a large part of the cash has not arrived, which is a collections problem rather than a revenue one** ✅
- B. Revenue is overstated and should be reversed
- C. Nothing: past due invoices are normal at any size
- D. The invoices were never sent

**Why:** Revenue and cash are different questions. An ageing table is how a pack shows that the profit and loss can look healthy while the bank account does not.

### 11. What is DSO measuring?

- A. The average age of an invoice at the time it is issued
- **B. Receivables expressed as days of revenue: how long the money takes to arrive** ✅
- C. How many days the sales team takes to close a deal
- D. Days between the order and the delivery

**Why:** Receivables divided by revenue, times the number of days. 56.5 days here on 30 day terms, which says the terms are not what is happening.

### 12. A monthly revenue query has always tied to the ledger and this month is 4,820 out. What do you do?

- A. Ignore a difference that small
- B. Rebuild the database
- C. Adjust the query to match the ledger
- **D. Find the row: it is a credit note raised in billing and not posted to the ledger, and somebody has to decide which side is right** ✅

**Why:** A break is information. Finding the single row, naming it and sending it to the person who can post it is the entire job of a close.

### 13. Why group by customer_id rather than by name?

- A. Names cannot be used in GROUP BY
- **B. Names are not guaranteed unique and can be edited, while the id is the identity** ✅
- C. Ids sort faster
- D. It changes the result only on PostgreSQL

**Why:** Two merchants can share a name and one merchant can be renamed mid year. Group by the key and carry the name along for the reader.

### 14. Merchants signed in 2023 are 58% of September revenue. What does that single number carry?

- **A. Both a retention story and a concentration risk, in one row** ✅
- B. Only that the company is old
- C. That 2024 and 2025 sales underperformed
- D. That churn is high

**Why:** Two year old merchants still paying is retention. More than half of revenue resting on one cohort is concentration. A good pack says both.

### 15. What belongs in a saved .sql file alongside each query?

- A. Nothing: the SQL speaks for itself
- B. The database password
- **C. The question it answers and the answer it gave last time it ran** ✅
- D. A copy of the data

**Why:** The recorded answer turns the query into a regression test. Run it next month, and if a closed month moved, something upstream changed and you want to know before the meeting.
