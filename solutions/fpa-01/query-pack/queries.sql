-- ===========================================================================
-- The revenue query pack, Meridian Pay
--
--   python run_queries.py            runs every query and prints the answers
--   python run_queries.py --verify   and checks them against the answers below
--
-- Ten queries. Each one carries the question it answers and the answer it gave
-- at the September 2025 close, which turns the file into its own regression
-- test: run it next month, and if a closed month has moved, something upstream
-- changed and that is worth knowing before the meeting.
--
-- Rules for this file:
--   1. Group by ids, select names for the reader
--   2. Every date filter says which date column it uses and why
--   3. A key check comes before anything that joins
--   4. The last query is always the tie out to the ledger
-- ===========================================================================


-- name: keys
-- Q: can any join in this file multiply rows?
-- A: no. 3,778 invoices with 3,778 distinct ids, 235 customers with 235.
SELECT 'invoices'  AS table_name, COUNT(*) AS rows, COUNT(DISTINCT invoice_id)  AS ids FROM invoices
UNION ALL
SELECT 'customers' AS table_name, COUNT(*) AS rows, COUNT(DISTINCT customer_id) AS ids FROM customers;


-- name: revenue_by_month
-- Q: what did each month of 2025 bill, and how fast is it growing?
-- A: September 3,361,050, year to date 26,291,310, up 8.2% on August.
--    Grouped on `month`, the revenue period, NOT on issued_date: this company
--    bills in arrears, so invoices issued in September are August's revenue.
SELECT month,
       ROUND(SUM(amount), 0)                            AS revenue,
       ROUND(SUM(SUM(amount)) OVER (ORDER BY month), 0) AS year_to_date,
       ROUND(100.0 * (SUM(amount) - LAG(SUM(amount)) OVER (ORDER BY month))
             / LAG(SUM(amount)) OVER (ORDER BY month), 1) AS growth_pct
FROM invoices
WHERE month LIKE '2025%'
GROUP BY month
ORDER BY month;


-- name: revenue_by_segment
-- Q: which segment drove September?
-- A: enterprise 1,565,293 of 3,361,050, 46.6%, from 40 of 214 invoices.
SELECT c.segment,
       COUNT(*)              AS invoices,
       ROUND(SUM(i.amount), 0) AS revenue,
       ROUND(100.0 * SUM(i.amount)
             / (SELECT SUM(amount) FROM invoices WHERE month = :month), 1) AS share_pct
FROM invoices i
JOIN customers c ON c.customer_id = i.customer_id
WHERE i.month = :month
GROUP BY c.segment
ORDER BY revenue DESC;


-- name: revenue_by_country
-- Q: where is the revenue, geographically?
-- A: Singapore leads the year to date. Ten countries, none above a fifth.
SELECT c.country,
       COUNT(DISTINCT c.customer_id) AS merchants,
       ROUND(SUM(i.amount), 0)       AS revenue_2025
FROM invoices i
JOIN customers c ON c.customer_id = i.customer_id
WHERE i.month LIKE '2025%'
GROUP BY c.country
ORDER BY revenue_2025 DESC;


-- name: top_merchants
-- Q: how concentrated is the book?
-- A: Pennant Logistics is the largest at 609,752 year to date, which is 2.3%
--    of revenue. No single merchant is a concentration risk on its own.
SELECT c.name,
       c.segment,
       c.country,
       ROUND(SUM(i.amount), 0) AS revenue_2025,
       RANK() OVER (ORDER BY SUM(i.amount) DESC) AS rank
FROM invoices i
JOIN customers c ON c.customer_id = i.customer_id
WHERE i.month LIKE '2025%'
GROUP BY c.customer_id, c.name, c.segment, c.country
ORDER BY revenue_2025 DESC
LIMIT 10;


-- name: cohorts
-- Q: is the revenue coming from new merchants or from the ones we already had?
-- A: merchants signed in 2023 are still 58% of September revenue, from 130 of
--    the 214 billed. Retention and concentration, in one table.
SELECT SUBSTR(c.signed_month, 1, 4) AS cohort,
       COUNT(*)                     AS merchants,
       ROUND(SUM(i.amount), 0)      AS revenue
FROM invoices i
JOIN customers c ON c.customer_id = i.customer_id
WHERE i.month = :month
GROUP BY cohort
ORDER BY cohort;


-- name: never_billed
-- Q: which merchants exist and have never been invoiced, and is that a problem?
-- A: five, all signed in October, after the last closed month. Not a problem,
--    and an inner join would have hidden them.
SELECT c.customer_id, c.name, c.signed_month
FROM customers c
LEFT JOIN invoices i ON i.customer_id = c.customer_id
WHERE i.invoice_id IS NULL
ORDER BY c.customer_id;


-- name: ageing
-- Q: how much are we owed, and how old is it?
-- A: 6,329,912 across 415 open invoices, of which 2,676,600 across 177
--    invoices is more than sixty days past due, on thirty day terms.
--    PostgreSQL: replace julianday(a) - julianday(b) with a::date - b::date
SELECT CASE
         WHEN julianday(:as_at) - julianday(due_date) <= 0  THEN '1 not yet due'
         WHEN julianday(:as_at) - julianday(due_date) <= 30 THEN '2 up to 30 days'
         WHEN julianday(:as_at) - julianday(due_date) <= 60 THEN '3 31 to 60 days'
         ELSE '4 over 60 days'
       END                   AS bucket,
       COUNT(*)              AS invoices,
       ROUND(SUM(amount), 0) AS owed
FROM invoices
WHERE paid_date IS NULL
GROUP BY bucket
ORDER BY bucket;


-- name: oldest_debtors
-- Q: who owes the oldest money, so collections know where to start?
-- A: the list every collections conversation starts from. It is also the
--    fastest way to find a billing error: an invoice nobody has queried and
--    nobody has paid is often one that should never have been sent.
SELECT c.name,
       COUNT(*)              AS open_invoices,
       ROUND(SUM(i.amount), 0) AS owed,
       MIN(i.due_date)       AS oldest_due
FROM invoices i
JOIN customers c ON c.customer_id = i.customer_id
WHERE i.paid_date IS NULL AND i.due_date < :as_at
GROUP BY c.customer_id, c.name
ORDER BY owed DESC
LIMIT 10;


-- name: dso
-- Q: how long does the money take to arrive?
-- A: 56.5 days, on thirty day terms. Both inputs are shown rather than only
--    the answer, because a ratio nobody can decompose is a ratio nobody can
--    argue with.
SELECT ROUND(SUM(CASE WHEN paid_date IS NULL THEN amount ELSE 0 END), 0) AS receivables,
       ROUND(SUM(CASE WHEN month = :month     THEN amount ELSE 0 END), 0) AS revenue_in_month,
       ROUND(SUM(CASE WHEN paid_date IS NULL THEN amount ELSE 0 END)
             / SUM(CASE WHEN month = :month   THEN amount ELSE 0 END) * 30, 1) AS dso_days
FROM invoices;


-- name: tie_out
-- Q: does the billing detail agree with the general ledger?
-- A: in twenty of twenty one months, to the cent. June 2025 is 4,820 lower in
--    billing than in the ledger, which is one credit note raised in billing and
--    never posted to the books. The ledger's revenue is a credit, so the sign
--    is flipped, and the duplicated journal is excluded by taking one row per
--    journal_id.
WITH billed AS (
    SELECT month, ROUND(SUM(amount), 2) AS billing
    FROM invoices GROUP BY month
),
ledger AS (
    SELECT month, ROUND(-SUM(amount), 2) AS ledger
    FROM (SELECT DISTINCT journal_id, month, line_type, amount FROM actuals)
    WHERE line_type = 'revenue'
    GROUP BY month
)
SELECT COALESCE(b.month, l.month) AS month,
       COALESCE(b.billing, 0)     AS billing,
       COALESCE(l.ledger, 0)      AS ledger,
       ROUND(COALESCE(b.billing, 0) - COALESCE(l.ledger, 0), 2) AS difference
FROM billed b
LEFT JOIN ledger l ON l.month = b.month
ORDER BY month;
