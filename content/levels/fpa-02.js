/* =========================================================================
   ANALYST TRACK, LEVEL 2: SQL for the month end close
   ========================================================================= */
FQ.registerLevel({
  id: 102,
  track: 'fpa',
  position: 2,
  codename: 'query',
  title: 'SQL for the month end close',
  tagline: 'Stop asking for an export. 3,778 invoices, 235 merchants, and the ten questions finance asks every month, answered in queries you can re-run.',
  difficulty: 4,
  minutes: 240,
  tags: ['sql', 'joins', 'window functions', 'receivables'],
  summary: 'The number you need is almost never in the file you were sent. This level teaches enough SQL to stop ' +
           'waiting for somebody else to run a query: selecting, joining, grouping, window functions, and the four ' +
           'aggregation mistakes that produce a confident wrong answer.',

  objectives: [
    'Load the company data into a database and query it, with no installation',
    'Write SELECT, WHERE, GROUP BY and HAVING without guessing at the order of execution',
    'Join two tables, and know what an inner join silently throws away',
    'Use window functions for running totals, month on month growth and ranking',
    'Recognise the average of averages, the wrong date column and the NULL that eats a row',
    'Prove your query ties to the ledger before anybody asks'
  ],

  knowledge: [
    { h: 'Why an analyst learns SQL first' },
    { p: 'In level 1 somebody sent you a file. That works until the question changes: which merchants drove the ' +
         'September upside, are the new ones paying later than the old ones, what share of revenue comes from the ' +
         'five biggest accounts. Each of those is a new export request, a day of waiting, and a file that answers ' +
         'the question you asked yesterday rather than the one you have now.' },
    { p: 'SQL removes the waiting. It is also, unusually for a technical skill, **the one finance teams expect and ' +
         'most finance graduates do not have**, which makes it the highest return week of study on this whole track.' },
    { money: 'The number this level ends on: grouping September revenue by the invoice date instead of the revenue ' +
             'month gives **3,106,395** instead of **3,361,050**. It is a 7.6% error, it looks completely normal, ' +
             'and it is one wrong column name.' },

    { h: 'The four tables' },
    { p: 'The same company as level 1, with the detail behind the ledger:' },
    { table: {
      head: ['Table', 'Rows', 'One row is'],
      rows: [
        ['`invoices`', '3,778', 'One merchant, one month: platform fee, transaction fees, FX, and when it was paid'],
        ['`customers`', '235', 'A merchant: country, segment, the month they signed, the month they left'],
        ['`actuals`', '318', 'The general ledger, from level 1'],
        ['`budget`', '192', 'The FY2025 plan, from level 1']
      ]
    }},
    { p: 'Loading them needs no database server. Python ships with SQLite, so four `read_csv` calls and a `to_sql` ' +
         'put all four tables in a file you can query, and every query in this level runs unchanged on PostgreSQL ' +
         'except where the text says otherwise.' },
    { code: 'import pandas as pd, sqlite3\n\ncon = sqlite3.connect("meridian.db")\nfor name in ["invoices", "customers", "actuals", "budget"]:\n    url = f"{{RAW}}/data/fpa-{name}.csv"\n    pd.read_csv(url).to_sql(name, con, if_exists="replace", index=False)\ncon.commit()', lang: 'python' },

    { h: 'The order SQL actually runs in' },
    { p: 'You write it in one order and the database runs it in another, and knowing that removes most beginner ' +
         'confusion at a stroke:' },
    { code: 'written:   SELECT ... FROM ... WHERE ... GROUP BY ... HAVING ... ORDER BY ... LIMIT\nexecuted:  FROM -> WHERE -> GROUP BY -> HAVING -> SELECT -> ORDER BY -> LIMIT', lang: 'text' },
    { p: 'Two consequences you will hit in your first hour. **`WHERE` cannot see an aggregate**, because it runs ' +
         'before the grouping, which is what `HAVING` is for. And **`ORDER BY` can see the alias you made in ' +
         '`SELECT`** while `WHERE` cannot, because it runs after.' },
    { code: '-- Revenue by segment, September, largest first\nSELECT c.segment,\n       COUNT(*)                AS invoices,\n       ROUND(SUM(i.amount), 0) AS revenue\nFROM invoices i\nJOIN customers c ON c.customer_id = i.customer_id\nWHERE i.month = \'2025-09\'          -- before grouping: a row filter\nGROUP BY c.segment\nHAVING SUM(i.amount) > 100000      -- after grouping: a group filter\nORDER BY revenue DESC;             -- can use the alias', lang: 'sql' },
    { table: {
      head: ['segment', 'invoices', 'revenue', 'share'],
      rows: [
        ['enterprise', '40', '**1,565,293**', '46.6%'],
        ['mid', '87', '1,303,362', '38.8%'],
        ['small', '87', '492,395', '14.7%']
      ]
    }},
    { p: 'Forty invoices out of 214 are 46.6% of the revenue. That single table changes how you think about the ' +
         'merchant book, and it took four lines.' },

    { h: 'The join, and what it throws away' },
    { p: 'A join matches rows from two tables on a key. The default, `JOIN`, is an **inner** join: it keeps only rows ' +
         'that match on both sides, and it does not tell you what it dropped.' },
    { code: '-- 235 customers, but how many appear in the invoice table?\nSELECT COUNT(*) FROM customers;                                       -- 235\nSELECT COUNT(DISTINCT customer_id) FROM invoices;                    -- 230\n\n-- Which five are missing, and why?\nSELECT c.customer_id, c.name, c.signed_month, c.churned_month\nFROM customers c\nLEFT JOIN invoices i ON i.customer_id = c.customer_id\nWHERE i.invoice_id IS NULL;', lang: 'sql' },
    { p: 'Five merchants have no invoice, because they signed in October, after the last closed month. That is a fine reason. ' +
         'The point is that an inner join would have hidden them, and the difference between "we have 235 merchants" ' +
         'and "230 merchants billed in September" is the kind of thing that gets quoted in a board pack.' },
    { warn: 'A `LEFT JOIN` followed by `WHERE right_table.column = something` is an inner join wearing a disguise: ' +
            'the `WHERE` throws away the unmatched rows the `LEFT JOIN` just kept. Put the condition in the `ON` ' +
            'clause instead when you mean to keep them.' },

    { h: 'The wrong date column' },
    { p: 'This dataset bills in arrears: September usage is invoiced on the first of October. So every invoice has ' +
         'two dates and a month, and they mean different things.' },
    { table: {
      head: ['Column', 'September invoice', 'What it answers'],
      rows: [
        ['`month`', '2025-09', 'Which month the revenue belongs to. **This is the revenue question**'],
        ['`issued_date`', '2025-10-01', 'When we billed it. The receivables question'],
        ['`due_date`', '2025-10-31', 'When it should be paid'],
        ['`paid_date`', 'null', 'When it actually was']
      ]
    }},
    { code: 'SELECT ROUND(SUM(amount), 0) FROM invoices WHERE month = \'2025-09\';\n-- 3,361,050   <- September revenue\n\nSELECT ROUND(SUM(amount), 0) FROM invoices\nWHERE issued_date LIKE \'2025-09%\';\n-- 3,106,395   <- August revenue, billed in September', lang: 'sql' },
    { p: 'Both queries are correct SQL, both return a plausible number, and one of them answers a question nobody ' +
         'asked. There is no error message for this, ever. The only defence is knowing what each date column means ' +
         'before you group by one.' },
    { check: {
      q: 'Your revenue by month query returns numbers that are each about a month behind the ledger, and the annual ' +
         'total is nearly right. What happened, and how would you have caught it in ten seconds?',
      a: 'You grouped on the invoice date rather than the revenue month, so every month contains the previous ' +
         'month\'s revenue and the year total is almost the same because the shift cancels out over twelve months. ' +
         'Catching it is a tie out: sum your query for one month and compare it to the ledger revenue for that ' +
         'month, which in September is 3,361,050. The habit of tying every query back to a source you trust is worth ' +
         'more than knowing every function in the language.'
    }},

    { h: 'Window functions, which are what make SQL worth learning' },
    { p: 'An aggregate collapses rows. A window function computes across rows while keeping every row, which is ' +
         'exactly what a finance table needs: this month, last month, the change, the running total, the rank.' },
    { code: 'SELECT month,\n       ROUND(SUM(amount), 0)                                   AS revenue,\n       ROUND(SUM(SUM(amount)) OVER (ORDER BY month), 0)        AS ytd,\n       ROUND(100.0 * (SUM(amount) - LAG(SUM(amount)) OVER (ORDER BY month))\n             / LAG(SUM(amount)) OVER (ORDER BY month), 1)      AS mom_pct\nFROM invoices\nWHERE month LIKE \'2025%\'\nGROUP BY month\nORDER BY month;', lang: 'sql' },
    { table: {
      head: ['month', 'revenue', 'ytd', 'mom %'],
      rows: [
        ['2025-06', '3,012,918', '16,773,813', '+1.1'],
        ['2025-07', '3,050,051', '19,823,864', '+1.2'],
        ['2025-08', '3,106,395', '22,930,260', '+1.8'],
        ['2025-09', '**3,361,050**', '**26,291,310**', '**+8.2**']
      ]
    }},
    { p: 'The 8.2% jump in September is the thing to notice, and it is the same volume story level 1 found in the ' +
         'variance pack, arrived at from the other direction. Two independent routes to one fact is how you become ' +
         'confident in it.' },
    { tip: 'The doubled `SUM(SUM(amount))` is not a typo. The inner `SUM` aggregates within the month, and the ' +
           'window then runs across the grouped rows. It reads strangely for about a week and then it does not.' },
    { p: 'The other three you will use constantly:' },
    { code: 'RANK()       OVER (ORDER BY revenue DESC)        -- 1, 2, 2, 4  (ties share, then skip)\nDENSE_RANK() OVER (ORDER BY revenue DESC)        -- 1, 2, 2, 3  (ties share, no gap)\nROW_NUMBER() OVER (PARTITION BY segment ORDER BY revenue DESC)\n                                                 -- top n per group', lang: 'sql' },

    { h: 'Four ways to get a confident wrong answer' },
    { p: '**1. The average of averages.** Averaging segment averages treats 40 enterprise invoices as equal in ' +
         'weight to 88 small ones:' },
    { code: 'mean of the three segment means   19,924\ntrue mean invoice                 15,706   <- 27% apart', lang: 'text' },
    { p: '**2. `COUNT(*)` against `COUNT(column)`.** The first counts rows, the second counts rows where that ' +
         'column is not null. On this data `COUNT(paid_date)` is the number of paid invoices and `COUNT(*)` is all ' +
         'of them, and using the wrong one turns a collection rate into a meaningless ratio.' },
    { p: '**3. NULL means unknown.** It compares equal to nothing, including itself, so `WHERE paid_date != \'2025-10-01\'` silently drops ' +
         'every unpaid invoice, because a comparison with NULL is neither true nor false. Use `IS NULL` and ' +
         '`IS NOT NULL`, and reach for `COALESCE` when a null should read as zero.' },
    { p: '**4. Joining to a table that has more than one matching row.** If a customer appeared twice in ' +
         '`customers`, every invoice would join to both and your revenue would double, with no error and no warning. ' +
         'Check the key is unique before you trust the join:' },
    { code: 'SELECT COUNT(*), COUNT(DISTINCT customer_id) FROM customers;  -- 235, 235: safe\nSELECT COUNT(*), COUNT(DISTINCT invoice_id)  FROM invoices;   -- 3778, 3778: safe', lang: 'sql' },

    { h: 'Receivables: the question a CFO asks on day four' },
    { p: '"How much are we owed, and how old is it?" Two queries. The first is an ageing table, bucketed by how far ' +
         'past due each unpaid invoice is; the second is days sales outstanding, which is receivables expressed as ' +
         'days of revenue.' },
    { code: 'SELECT CASE\n         WHEN julianday(\'2025-10-05\') - julianday(due_date) <= 0  THEN \'1 not yet due\'\n         WHEN julianday(\'2025-10-05\') - julianday(due_date) <= 30 THEN \'2 up to 30 days\'\n         WHEN julianday(\'2025-10-05\') - julianday(due_date) <= 60 THEN \'3 31 to 60 days\'\n         ELSE \'4 over 60 days\'\n       END AS bucket,\n       COUNT(*)                AS invoices,\n       ROUND(SUM(amount), 0)   AS owed\nFROM invoices\nWHERE paid_date IS NULL\nGROUP BY bucket ORDER BY bucket;', lang: 'sql' },
    { table: {
      head: ['bucket', 'invoices', 'owed'],
      rows: [
        ['1 not yet due', '214', '3,361,050'],
        ['2 up to 30 days', '15', '160,361'],
        ['3 31 to 60 days', '9', '131,902'],
        ['**4 over 60 days**', '**177**', '**2,676,600**']
      ]
    }},
    { warn: 'Read that last row before moving on. **177 invoices worth 2.68 million are more than sixty days past ' +
            'due**, against a not yet due balance of 3.36 million. Total receivables are 6.33 million against ' +
            'September revenue of 3.36 million, which is a DSO of 56.5 days on a 30 day payment term. The ' +
            'revenue is real and a good part of the cash has not arrived.' },
    { p: 'That is the difference between a revenue report and a finance report, and it is why receivables ageing is ' +
         'in the monthly pack of every company that sells on credit.' },
    { p: 'On PostgreSQL the same query uses date arithmetic rather than `julianday`, which is the one dialect ' +
         'difference worth memorising now:' },
    { code: '-- SQLite\njulianday(\'2025-10-05\') - julianday(due_date)\n\n-- PostgreSQL\nDATE \'2025-10-05\' - due_date::date\n\n-- Both give a number of days. Everything else in this level is identical.', lang: 'sql' },

    { h: 'Cohorts, in four lines' },
    { p: 'A cohort is just a `GROUP BY` on when somebody joined. It answers the question a board asks about every ' +
         'subscription business: is the growth coming from new customers or from the old ones growing?' },
    { code: 'SELECT substr(c.signed_month, 1, 4)  AS cohort,\n       COUNT(*)                     AS merchants,\n       ROUND(SUM(i.amount), 0)      AS september_revenue\nFROM invoices i JOIN customers c ON c.customer_id = i.customer_id\nWHERE i.month = \'2025-09\'\nGROUP BY cohort ORDER BY cohort;', lang: 'sql' },
    { table: {
      head: ['cohort', 'merchants', 'September revenue', 'share'],
      rows: [
        ['signed 2023', '130', '1,936,813', '58%'],
        ['signed 2024', '46', '854,777', '25%'],
        ['signed 2025', '38', '569,460', '17%']
      ]
    }},
    { p: 'Merchants signed in 2023 are still 58% of revenue two years later, which is a retention story and a ' +
         'concentration risk in the same row. Neither number exists in the ledger: this is what the detail is for.' },
    { check: {
      q: 'Your query returns 230 merchants billed in September, the customers table has 235 rows, and the CRM says ' +
         '230. Which number goes in the board pack?',
      a: 'None of them, without a sentence. Say what each one counts: 230 merchants were billed for September, 235 ' +
         'merchants exist in the billing system including five that signed too recently to be billed, and the CRM ' +
         'counts 230 including prospects that have not gone live. The pack should carry the one that matches the ' +
         'question being asked, with its definition next to it. Numbers that disagree are normal; numbers that ' +
         'disagree without an explanation are how a finance team loses credibility.'
    }}
  ],

  tutorial: {
    intro: 'Python with sqlite3 and pandas, either locally or in Colab. No database server, no installation. About ' +
           'two hours, and keep every query you write in one .sql file rather than in the scrollback.',
    steps: [
      {
        t: 'Build the database',
        blocks: [
          { code: 'import pandas as pd, sqlite3\n\ncon = sqlite3.connect("meridian.db")\nfor name in ["invoices", "customers", "actuals", "budget"]:\n    pd.read_csv(f"{{RAW}}/data/fpa-{name}.csv").to_sql(\n        name, con, if_exists="replace", index=False)\n\ndef q(sql):\n    return pd.read_sql_query(sql, con)\n\nq("SELECT name FROM sqlite_master WHERE type=\'table\'")', lang: 'python' },
          { p: 'That `q()` helper is worth more than it looks: every query in this level is now one function call ' +
               'that returns a DataFrame, which is also how level 3 starts.' }
        ],
        check: 'Four tables, and `q("SELECT COUNT(*) FROM invoices")` returns 3778.'
      },
      {
        t: 'Check the keys before trusting any join',
        blocks: [
          { code: 'SELECT COUNT(*) AS rows, COUNT(DISTINCT invoice_id) AS ids FROM invoices;\nSELECT COUNT(*) AS rows, COUNT(DISTINCT customer_id) AS ids FROM customers;', lang: 'sql' },
          { p: 'Equal counts mean the key is unique and a join on it cannot multiply rows. Unequal counts mean stop ' +
               'and find out why before writing anything else.' }
        ],
        check: '3778 and 3778, then 235 and 235.'
      },
      {
        t: 'Revenue by month, and tie it to the ledger',
        blocks: [
          { p: 'Write the revenue query, then immediately write the query that checks it against the general ledger ' +
               'you used in level 1. Getting into this habit now is the whole point of the level.' },
          { code: '-- the detail\nSELECT month, ROUND(SUM(amount), 2) AS invoiced\nFROM invoices GROUP BY month ORDER BY month;\n\n-- the ledger, revenue is a credit so flip the sign\nSELECT month, ROUND(-SUM(amount), 2) AS ledger_revenue\nFROM actuals WHERE line_type = \'revenue\'\nGROUP BY month ORDER BY month;', lang: 'sql' },
          { warn: 'Careful with the ledger table: it holds the duplicated journal from level 1 and two amounts ' +
                  'stored as text. `SUM` on a text column in SQLite silently treats it as 0.' }
        ],
        check: 'Every month agrees except 2025-06, which is 4,820 apart.'
      },
      {
        t: 'Find the 4,820',
        blocks: [
          { p: 'One month disagrees. Do not adjust anything: find the row.' },
          { code: 'SELECT * FROM invoices\nWHERE month = \'2025-06\' AND amount < 0;', lang: 'sql' },
          { p: 'A credit note, raised in the billing system, never posted to the ledger. That is a real month end ' +
               'break: the billing detail says one thing and the books say another, and somebody has to decide which ' +
               'is right before the pack goes out. Write the sentence you would send to the accountant.' }
        ],
        check: 'One row, -4,820.00, and you can explain the difference in one sentence.'
      },
      {
        t: 'Join, group, and rank',
        blocks: [
          { code: 'SELECT c.name, c.segment, c.country,\n       ROUND(SUM(i.amount), 0) AS revenue_2025,\n       RANK() OVER (ORDER BY SUM(i.amount) DESC) AS rank\nFROM invoices i\nJOIN customers c ON c.customer_id = i.customer_id\nWHERE i.month LIKE \'2025%\'\nGROUP BY c.customer_id\nORDER BY revenue_2025 DESC\nLIMIT 10;', lang: 'sql' },
          { p: 'Group by the **id**, not the name: two merchants can share a name and one merchant can be renamed. ' +
               'Selecting the name alongside works in SQLite and MySQL and is an error on PostgreSQL unless the name ' +
               'is in the GROUP BY or wrapped in an aggregate. Adding `c.name` to the GROUP BY is the portable fix.' }
        ],
        check: 'Pennant Logistics leads with 609,752, which is 2.3% of the year to date.'
      },
      {
        t: 'The receivables ageing',
        blocks: [
          { p: 'The ageing query from the knowledge section, then the two follow ups a CFO asks next.' },
          { code: '-- who owes the oldest money?\nSELECT c.name, COUNT(*) AS invoices, ROUND(SUM(i.amount), 0) AS owed,\n       MIN(i.due_date) AS oldest_due\nFROM invoices i JOIN customers c ON c.customer_id = i.customer_id\nWHERE i.paid_date IS NULL AND i.due_date < \'2025-08-05\'\nGROUP BY c.customer_id, c.name\nORDER BY owed DESC LIMIT 10;', lang: 'sql' },
          { tip: 'Every collections conversation starts from this table. It is also the fastest way to find a ' +
                 'billing error: an invoice nobody has queried and nobody has paid is often an invoice nobody ' +
                 'should have been sent.' }
        ],
        check: 'Four buckets summing to 6,329,912 across 415 open invoices.'
      },
      {
        t: 'Save the queries as a file',
        blocks: [
          { p: 'Ten named queries in one `.sql` file, each with a comment saying what question it answers and what ' +
               'the answer was the last time you ran it. That file is the deliverable, not the numbers.' },
          { code: '-- 04_revenue_by_segment.sql\n-- Q: which segment drove September?\n-- A (2025-09): enterprise 1,565,293 of 3,361,050, 46.6%, from 40 invoices\nSELECT ...', lang: 'sql' },
          { p: 'The recorded answer is the part people skip. It turns every query into its own regression test: run ' +
               'it next month, and if September moved, something upstream changed and you want to know.' }
        ],
        check: 'A .sql file you could hand to somebody else, with an answer recorded under each query.'
      }
    ]
  },

  glossary: [
    { t: 'SQL', d: 'The language for asking a database questions. Pronounced either way, and nobody who matters cares.' },
    { t: 'Table', d: 'Rows and named, typed columns. A spreadsheet tab with rules that are enforced.' },
    { t: 'Primary key', d: 'The column that uniquely identifies a row. invoice_id here.' },
    { t: 'Foreign key', d: 'A column pointing at another table\'s key. invoices.customer_id points at customers.' },
    { t: 'JOIN', d: 'Match rows from two tables on a key. Inner by default, which keeps only matches.' },
    { t: 'LEFT JOIN', d: 'Keep every row from the left table, with nulls where the right side has no match.' },
    { t: 'GROUP BY', d: 'Collapse rows into one per group, with aggregates computed per group.' },
    { t: 'HAVING', d: 'A filter applied after grouping, which is why WHERE cannot see an aggregate.' },
    { t: 'Window function', d: 'A calculation across rows that keeps every row: running totals, ranks, previous values.' },
    { t: 'LAG', d: 'The previous row\'s value in the window order. Month on month growth in one function.' },
    { t: 'NULL', d: 'Unknown. Not zero, not empty, and not equal to anything including itself.' },
    { t: 'COALESCE', d: 'Return the first value that is not null. How a null becomes a zero on purpose.' },
    { t: 'CTE', d: 'A named subquery written with WITH. The way to make a long query readable.' },
    { t: 'Ageing', d: 'Unpaid invoices bucketed by how far past due they are.' },
    { t: 'DSO', d: 'Days sales outstanding: receivables divided by revenue, times days. How long the money takes to arrive.' },
    { t: 'Credit note', d: 'A negative invoice that cancels or reduces an earlier one.' },
    { t: 'Cohort', d: 'A group defined by when it started, followed over time.' },
    { t: 'Tie out', d: 'Proving a query agrees with a source you already trust, before anybody asks.' }
  ],

  quiz: [
    { q: "Why does WHERE not work on an aggregate like SUM(amount)?",
      options: [
        "You must use a subquery for any aggregate",
        "It works in PostgreSQL but not in SQLite",
        "Aggregates are not allowed in filters at all",
        "WHERE runs before GROUP BY, so the aggregate does not exist yet. HAVING runs after"
      ],
      answer: 3,
      why: "Execution order is FROM, WHERE, GROUP BY, HAVING, SELECT, ORDER BY. WHERE filters rows before there are any groups; HAVING filters the groups." },

    { q: "September revenue by month is 3,361,050 and by issued_date is 3,106,395. What is the second number?",
      options: [
        "Revenue from merchants who paid on time",
        "A rounding difference",
        "Revenue excluding credit notes",
        "August revenue, because this company bills in arrears on the first of the following month"
      ],
      answer: 3,
      why: "The invoice for September usage is issued on 1 October, so invoices issued in September are August revenue. No error is raised and both numbers look reasonable." },

    { q: "The customers table has 235 rows and only 230 appear in invoices. What does a plain JOIN do?",
      options: [
        "Duplicates the seven across all months",
        "Silently drops the five, with no warning",
        "Raises an error about unmatched keys",
        "Returns all 221 with nulls for the missing seven"
      ],
      answer: 1,
      why: "An inner join keeps only matches. Use a LEFT JOIN and check for nulls when you need to know what did not match, which is most of the time in finance." },

    { q: "What does a LEFT JOIN followed by WHERE right.status = 'paid' become?",
      options: [
        "An inner join, because the WHERE throws away the unmatched rows the join kept",
        "A syntax error",
        "A cross join",
        "A left join with an extra filter"
      ],
      answer: 0,
      why: "The unmatched rows have NULL on the right side, and NULL fails the comparison. Put the condition in the ON clause when you mean to keep unmatched rows." },

    { q: "The mean of the three segment averages is 19,924 and the true mean invoice is 15,706. Why?",
      options: [
        "The true mean excludes credit notes",
        "The segment averages were rounded",
        "The three segments have different numbers of invoices, so averaging the averages weights them equally when they are not",
        "One segment has outliers"
      ],
      answer: 2,
      why: "Forty enterprise invoices carry the same weight as eighty-eight small ones in an average of averages. Aggregate the underlying rows, or weight by count." },

    { q: "COUNT(*) returns 3,778 and COUNT(paid_date) returns 3,363. What is the difference?",
      options: [
        "COUNT(*) includes duplicate ids",
        "COUNT(column) counts only rows where that column is not null, so the difference is the unpaid invoices",
        "COUNT(*) is an estimate on large tables",
        "The paid_date column has a different type"
      ],
      answer: 1,
      why: "COUNT(column) ignores nulls. That is useful when you mean it and a silent error when you do not." },

    { q: "Which finds the unpaid invoices?",
      options: [
        "WHERE paid_date = NULL",
        "WHERE paid_date != ''",
        "WHERE paid_date IS NULL",
        "WHERE NOT paid_date"
      ],
      answer: 2,
      why: "NULL is not equal to anything, including NULL. Only IS NULL and IS NOT NULL test it." },

    { q: "What does SUM(SUM(amount)) OVER (ORDER BY month) produce?",
      options: [
        "The grand total repeated on every row",
        "The monthly sum multiplied by the row number",
        "A running total of the monthly sums, month by month",
        "An error: you cannot nest aggregates"
      ],
      answer: 2,
      why: "The inner SUM aggregates within each month, then the window runs across the grouped rows in month order. It is the standard year to date column." },

    { q: "Your query joins invoices to customers and revenue comes out at exactly double. What do you check first?",
      options: [
        "Whether customer_id is unique in customers, because a duplicate there doubles every matching invoice",
        "Whether the database needs reindexing",
        "Whether the date filter is inclusive",
        "Whether the amounts are stored as text"
      ],
      answer: 0,
      why: "Exact doubling is the signature of a one-to-many join you thought was one-to-one. COUNT(*) against COUNT(DISTINCT key) on the lookup table finds it immediately." },

    { q: "177 open invoices worth 2.68 million are over 60 days past due, on 30 day terms. What does that tell the pack?",
      options: [
        "The revenue is recognised and a large part of the cash has not arrived, which is a collections problem rather than a revenue one",
        "Revenue is overstated and should be reversed",
        "Nothing: past due invoices are normal at any size",
        "The invoices were never sent"
      ],
      answer: 0,
      why: "Revenue and cash are different questions. An ageing table is how a pack shows that the profit and loss can look healthy while the bank account does not." },

    { q: "What is DSO measuring?",
      options: [
        "The average age of an invoice at the time it is issued",
        "Receivables expressed as days of revenue: how long the money takes to arrive",
        "How many days the sales team takes to close a deal",
        "Days between the order and the delivery"
      ],
      answer: 1,
      why: "Receivables divided by revenue, times the number of days. 56.5 days here on 30 day terms, which says the terms are not what is happening." },

    { q: "A monthly revenue query has always tied to the ledger and this month is 4,820 out. What do you do?",
      options: [
        "Ignore a difference that small",
        "Rebuild the database",
        "Adjust the query to match the ledger",
        "Find the row: it is a credit note raised in billing and not posted to the ledger, and somebody has to decide which side is right"
      ],
      answer: 3,
      why: "A break is information. Finding the single row, naming it and sending it to the person who can post it is the entire job of a close." },

    { q: "Why group by customer_id rather than by name?",
      options: [
        "Names cannot be used in GROUP BY",
        "Names are not guaranteed unique and can be edited, while the id is the identity",
        "Ids sort faster",
        "It changes the result only on PostgreSQL"
      ],
      answer: 1,
      why: "Two merchants can share a name and one merchant can be renamed mid year. Group by the key and carry the name along for the reader." },

    { q: "Merchants signed in 2023 are 58% of September revenue. What does that single number carry?",
      options: [
        "Both a retention story and a concentration risk, in one row",
        "Only that the company is old",
        "That 2024 and 2025 sales underperformed",
        "That churn is high"
      ],
      answer: 0,
      why: "Two year old merchants still paying is retention. More than half of revenue resting on one cohort is concentration. A good pack says both." },

    { q: "What belongs in a saved .sql file alongside each query?",
      options: [
        "Nothing: the SQL speaks for itself",
        "The database password",
        "The question it answers and the answer it gave last time it ran",
        "A copy of the data"
      ],
      answer: 2,
      why: "The recorded answer turns the query into a regression test. Run it next month, and if a closed month moved, something upstream changed and you want to know before the meeting." }
  ],

  project: {
    title: 'The revenue query pack',
    story: 'The head of finance wants the revenue story behind the September pack: who drove it, whether the growth ' +
           'is new merchants or old ones, and how much of it has actually been collected. She also wants to be able ' +
           'to ask for October without asking you again. Build a query pack she can run.',
    scope: 'SQL against the four tables, in SQLite or PostgreSQL. Python only for loading the CSVs and running the ' +
           'queries. No pandas analysis: that is the next level.',
    dataset: '{{RAW}}/data/fpa-invoices.csv',
    requirements: [
      'A loader that builds the database from the four CSVs in one command, and is safe to re-run',
      'A key check on both lookup tables, proving no join can multiply rows',
      'Query: revenue by month for 2025, with year to date and month on month growth',
      'Query: revenue by segment and by country for a month given as a parameter',
      'Query: the top ten merchants year to date, with rank and share of total',
      'Query: cohort revenue, by the year each merchant signed',
      'Query: receivables ageing in four buckets, as at a date you choose',
      'Query: the ten merchants with the oldest unpaid invoices, with the oldest due date',
      'Query: DSO for September, with the two inputs shown rather than only the answer',
      'Query: the tie out, invoice detail against the ledger, per month, with the difference column',
      'Every query saved in one .sql file, named, with the question it answers and the answer it gave',
      'A short README with the four numbers you would put in front of the CFO, and the query that produced each'
    ],
    starter: {
      lang: 'sql',
      code: '-- FinQuest analyst level 2: the revenue query pack\n--\n-- One file, ten queries, each with a header like this one:\n--\n--   -- 03_top_merchants.sql\n--   -- Q: who are the ten biggest merchants year to date, and how concentrated are we?\n--   -- A (as at 2025-09): Pennant Logistics 609,752, 2.3% of YTD revenue\n--   --    top ten together: ...\n--\n-- Rules for the file:\n--   1. Group by ids, select names for the reader\n--   2. Every date filter says which date column and why\n--   3. Anything that could be a one to many join gets a key check above it\n--   4. The last query is always the tie out to the ledger\n\n-- 00_keys.sql\n-- Q: can any join in this file multiply rows?\n-- A: no, both lookup keys are unique\nSELECT COUNT(*) AS rows, COUNT(DISTINCT customer_id) AS ids FROM customers;\nSELECT COUNT(*) AS rows, COUNT(DISTINCT invoice_id)  AS ids FROM invoices;\n'
    },
    tests: [
      'The loader runs twice in a row without error and leaves the same four tables',
      'Revenue by month for September returns 3,361,050 and agrees with the ledger',
      'The tie out query returns a non zero difference for exactly one month, 2025-06, of -4,820',
      'The segment query for September returns enterprise 1,565,293 across 40 invoices',
      'The ageing buckets sum to the total open balance of 6,329,912 across 415 invoices',
      'The top ten query returns Pennant Logistics first at 609,752 year to date',
      'The cohort query shows the 2023 cohort at 1,936,813 of September revenue',
      'Every query in the file has a question and a recorded answer above it',
      'Running the whole file end to end produces no errors on a fresh database'
    ],
    rubric: [
      { pts: 25, t: 'Correct', d: 'The numbers match the ledger where they should and differ only where there is a real break, which is named.' },
      { pts: 20, t: 'Safe', d: 'Keys checked, join types chosen deliberately, nulls handled, the right date column used and said out loud.' },
      { pts: 20, t: 'Readable', d: 'Named queries, aliases that mean something, CTEs instead of nested subqueries, comments that say why rather than what.' },
      { pts: 20, t: 'Useful', d: 'The pack answers the questions a CFO actually asks, including the one about cash rather than revenue.' },
      { pts: 15, t: 'Repeatable', d: 'A parameter changes the month. Somebody else can run the file next month and get October.' }
    ],
    stretch: [
      'Rewrite the ageing query for PostgreSQL and prove both dialects give the same buckets',
      'Add a query that finds any invoice paid before it was issued, and explain what you would do about the one it finds',
      'Build a monthly retention query: of the merchants billed in a month, how many were billed the month before',
      'Add the level 1 budget table and produce the variance pack in SQL, then compare it to your spreadsheet'
    ],
    solutionPath: 'solutions/fpa-02'
  },

  faq: [
    { q: 'SQLite or PostgreSQL?',
      a: 'Start with SQLite because it needs nothing installed and the file is portable. Everything in this level except one date function is identical on PostgreSQL, and the stretch goal is to prove that. When you get a job, it will be PostgreSQL, SQL Server or Snowflake, and the differences are smaller than the similarities.' },
    { q: 'Should I learn SQL or Python first?',
      a: 'SQL, and it is not close. It is older, more stable, more widely expected in finance roles, and it goes where the data already is. Python is the next level, and it is much more useful once you can get the right rows out of the database first.' },
    { q: 'My query is right but slow.',
      a: 'At 3,797 rows nothing here is slow. When it matters, the two things that fix most queries are filtering earlier and indexing the columns you join and filter on. Level 6 of the engineering track has the measurements if you want them.' },
    { q: 'How do I know my answer is right?',
      a: 'Tie it to something you already trust. Every number in this level can be checked against the ledger from level 1, and the one month that does not tie is a real break worth finding. Getting the same number two independent ways is the only durable form of confidence.' },
    { q: 'Do analysts really write SQL, or do data teams do it?',
      a: 'Both, and the ones who write their own get answers in minutes rather than in days, which compounds. It also changes what you ask for: an analyst who knows what a join costs asks for a table rather than for a report.' }
  ]
});
