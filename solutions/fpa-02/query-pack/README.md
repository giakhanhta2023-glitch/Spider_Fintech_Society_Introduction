# query-pack

Ten queries that answer what the ledger cannot, each one carrying the answer it
gave at the September close, so running it next month is also a check.

```bash
python load.py --check        # build meridian.db from the six CSV files
python run_queries.py         # run all ten and print the answers
python run_queries.py --verify   # and check them against the recorded ones
python run_queries.py --only ageing --month 2025-08
```

## The four numbers for the CFO

| | | The query |
|---|---|---|
| September revenue | **3,361,050**, up 8.2% on August, year to date 26,291,310 | `revenue_by_month` |
| Where it came from | **46.6%** from enterprise, on 40 of 214 invoices | `revenue_by_segment` |
| What has not arrived | **6,329,912** owed, of which **2,676,600** is over sixty days past due | `ageing` |
| Does billing agree with the books | Twenty of twenty one months to the cent. June is **4,820** apart | `tie_out` |

The fourth one is the one to lead with. A revenue report that has never been
compared to the ledger is a report nobody should sign, and the one month that
disagrees is a single credit note raised in billing and never posted.

## Why every query records its answer

```sql
-- name: top_merchants
-- Q: how concentrated is the book?
-- A: Pennant Logistics is the largest at 609,752 year to date, which is 2.3%
--    of revenue. No single merchant is a concentration risk on its own.
```

`python run_queries.py --verify` checks eight of those mechanically and exits non
zero if one has moved. A **closed** month changing is either a restatement
somebody forgot to mention or a bug in the load, and both are things to find
before the meeting rather than in it.

```
   ok    both keys are unique
   ok    September revenue is 3,361,050
   ok    enterprise September revenue is 1,565,293
   ok    the largest merchant is Pennant Logistics at 609,752
   ok    the 2023 cohort is 1,936,813 of September revenue
   ok    five merchants have never been billed
   ok    receivables are 6,329,912 across 415 open invoices
   ok    only June 2025 differs, by -4,820.00
8 recorded answers checked, 0 wrong
```

## Two things the verifier caught

**The tie out was 700,200 wrong in April, and nothing said so.** The ledger
export writes one credit in accounting brackets, `(700,200.00)`. Loaded as it
comes, SQLite stores it as text, `SUM` treats it as zero, and the April
reconciliation reports a difference with no error anywhere to explain it. The fix
is in `load.py`, at the boundary, because a repair inside one query leaves the
other nine wrong.

**The ageing total was a dollar out.** Each bucket is rounded to the dollar, so
the four rounded buckets sum to 6,329,913 against an unrounded total of
6,329,912. That one is a tolerance in the check rather than a bug, and the
comment says so. The tie out has no tolerance and never will: a rounding
allowance on a reconciliation is where the next real break hides.

## Decisions worth naming

**Group by the id, select the name.** Two merchants can share a name and one can
be renamed mid year. `GROUP BY c.customer_id, c.name` is also the version that
works on PostgreSQL, where selecting an ungrouped column is an error rather than
a surprise.

**The revenue month is not the invoice date.** This company bills in arrears, so
September's usage is invoiced on 1 October. Grouping on `issued_date` gives
3,106,395 for September, which is August's revenue, and nothing warns you. Every
date filter in the file says which column it uses.

**A left join for the merchants with no invoice.** Five merchants signed in
October and have not been billed yet. An inner join would have dropped them
silently, and the difference between "235 merchants" and "230 merchants billed in
September" is the kind of thing that ends up quoted in a board pack.

**Keys checked at load, not assumed in ten queries.** `load.py` refuses to finish
if `invoice_id` or `customer_id` is not unique, because a duplicate in a lookup
table multiplies revenue with no error at all.

## PostgreSQL

Every query runs unchanged except the two that use `julianday`, and the file
marks those with the PostgreSQL form next to them:

```sql
-- SQLite
julianday('2025-10-05') - julianday(due_date)
-- PostgreSQL
DATE '2025-10-05' - due_date::date
```

SQLite is here because it needs nothing installed, which is the whole reason a
finance analyst can run this on the laptop they already have.

---

Part of [FinQuest](../../../README.md), analyst track, level 02.
