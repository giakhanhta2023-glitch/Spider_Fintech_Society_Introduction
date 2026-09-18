/* =========================================================================
   LEVEL 3: Reading the money: transaction data with pandas
   ========================================================================= */
FQ.registerLevel({
  id: 3,
  codename: 'transactions',
  title: 'Reading the money',
  tagline: 'Take 233 messy transaction rows and turn them into the five numbers someone actually wants to know.',
  difficulty: 3,
  minutes: 120,
  tags: ['pandas', 'data cleaning', 'analytics'],
  summary: 'Every fintech product is, underneath, a pile of transaction rows. This level teaches you to load them, ' +
           'clean them, group them, and answer questions with them: the single most employable skill in the industry.',

  objectives: [
    'Describe the anatomy of a transaction record and why sign conventions matter',
    'Load a CSV into a pandas DataFrame and check its types before trusting it',
    'Filter rows with boolean masks and build new columns',
    'Aggregate with groupby to answer "how much per month / per category / per merchant"',
    'Detect recurring subscriptions by finding repeated identical charges',
    'Compute a savings rate and present findings as a readable report and a chart'
  ],

  knowledge: [
    { h: 'What one row of bank data is' },
    { p: 'Open any banking app and scroll. Every line you see is one moment when money moved: a coffee, a salary, a rent ' +
         'payment. Behind the app, each of those lines is one row in a table, and that table is what every fintech ' +
         'product is built on. Level 1 called these rows ledger entries. In this level you learn to read a lot of them ' +
         'at once and pull answers out.' },
    { p: 'The file for this level holds **233 rows**: six months, March to August 2025, of one person\'s everyday ' +
         'account. The person and the shops are made up for the course, but the shape is exactly what a real bank ' +
         'export looks like. Here are the first three rows, as they sit in the file:' },
    { table: {
      head: ['date', 'description', 'category', 'amount', 'account', 'method'],
      rows: [
        ['2025-03-01', 'DECATHLON', 'shopping', '-155.12', 'CHK-4471', 'card'],
        ['2025-03-01', 'RENT - HARBOUR LOFTS', 'housing', '-1150.0', 'CHK-4471', 'transfer'],
        ['2025-03-02', 'IRONWORKS GYM', 'subscriptions', '-35.0', 'CHK-4471', 'direct_debit']
      ]
    }},
    { p: 'Read the first row as a sentence: on 1 March, $155.12 left the account at a sports shop, paid by card. Every ' +
         'row reads the same way. This is what each column holds, and the mistake each one invites:' },
    { table: {
      head: ['Column', 'What it holds', 'What can go wrong'],
      rows: [
        ['`date`', 'The day the bank recorded the payment', 'You pay on 31 March, the bank records it on 2 April, and the purchase counts in the wrong month'],
        ['`description`', 'The shop\'s name, as the bank received it', 'Usually in capitals and often cut short, so the same shop can appear under two spellings'],
        ['`category`', 'A label for grouping: dining, groceries, housing', 'Somebody or some program chose it. It is a guess, and guesses are sometimes wrong'],
        ['`amount`', 'How much money moved, with a minus sign when it left', 'Banks disagree about the sign, so check it before you add anything up'],
        ['`account`', 'Which account the row belongs to', 'Every row here is `CHK-4471`, one account. Mix two accounts and money moved between them counts twice'],
        ['`method`', 'How it was paid', '189 rows are `card`, 24 are `direct_debit` (the company takes it automatically), 20 are `transfer` (the owner sends it)']
      ]
    }},

    { h: 'The minus sign decides everything' },
    { p: 'In this course, **money leaving the account is negative and money arriving is positive**, seen from the owner\'s ' +
         'side. Rent is `-1150.0`. The monthly salary is `+3200.0`. Add every row together and you get how much the ' +
         'account grew: here, **$5,072.74** over the six months.' },
    { p: 'Not every bank writes it that way. Some write every amount as a positive number and put the direction in a ' +
         'separate column, with a word like `DEBIT` (money out) or `CREDIT` (money in). Load one of those files, add up the ' +
         'amount column, and rent and salary both count as money in. Nothing crashes. You just get an answer that is ' +
         'badly wrong and looks fine.' },
    { p: 'So before you total anything, find two rows you already understand, a salary and a rent payment, and look at ' +
         'which way their signs point. It takes ten seconds and it is the first thing a professional checks.' },
    { check: {
      q: 'Suppose this same file came from a bank that writes every amount as positive, with a separate DEBIT or CREDIT ' +
         'column. You forget to check and add up the amount column. What do you report, and how far off is it?',
      a: 'You report $35,389.34, which is every payment in and every payment out added together as if all of it arrived. ' +
         'The real answer is that the account grew by $5,072.74, so you are wrong by about seven times. The fix is one step ' +
         'at the start: turn the amount negative on every DEBIT row, then add. After that the file behaves exactly like ' +
         'the one in this level.'
    }},

    { h: 'Positive does not mean income' },
    { p: '12 rows in this file are positive. Eight of them are pay: six monthly salaries of $3,200.00 on the 25th, and two ' +
         'bonuses of $450.00 in May and August. That is **$20,100.00** of income.' },
    { p: 'The other four are **refunds**: $29.75 back from TECH BAZAAR, $23.62 from DECATHLON, and $33.20 and $44.47 from ' +
         'ZARA. A refund is money you already spent coming back to you. It is positive, because it arrives, but nobody ' +
         'earned it. Counting it as income is like counting a returned jacket as a pay rise.' },
    { warn: 'When you mean income, pick rows by their label, `category == "income"`, never by the sign. The sign tells you ' +
            'the direction money moved. It does not tell you why.' },
    { check: {
      q: 'Those four refunds are $29.75, $23.62, $33.20 and $44.47. If you take income to be every row where `amount > 0`, ' +
         'what do you report, and how much does it matter?',
      a: 'You report $20,231.04 instead of $20,100.00, because the refunds add $131.04. That is 0.65% high, and the small ' +
         'size is exactly the danger: it is far too small to look wrong, so nobody questions it. It then feeds the savings ' +
         'rate, which reads 34.0% instead of 33.5%, so the number you show the user is flattering and you cannot explain ' +
         'where it came from. Pick rows with `category == "income"` and the refunds stay where they belong, as money back ' +
         'on shopping.'
    }},

    { h: 'Moving money to savings is not spending' },
    { p: 'Six rows say `TRANSFER TO SAVINGS`, $300.00 each month, $1,800.00 in total. In this file they are negative, ' +
         'because the money left this account. But it went into the same person\'s savings account, where it shows up as ' +
         '+$300.00 in a different file. They are not $300.00 poorer. They moved money from one pocket to another.' },
    { p: 'So when you total spending, leave these rows out. Count them as spending and the person looks like they spent ' +
         'more than they did, and a person who saves more looks worse. It is an easy bug to ship, because the row looks ' +
         'exactly like a payment.' },

    { h: 'pandas: a spreadsheet you drive with code' },
    { p: 'You could open these 233 rows in Excel and use filters and SUM. For one file, once, that works. pandas does the ' +
         'same jobs with code, which buys you three things a spreadsheet cannot. Every step is written down, so anybody ' +
         'can see how you got a number. Next month\'s file runs through the same steps in a second. And it copes with a ' +
         'million rows as easily as 233.' },
    { p: '**pandas** is a Python library: a package of ready-made code you load with one line, `import pandas as pd`. ' +
         'Three words cover most of what you will read in pandas code, and each one has a spreadsheet twin:' },
    { table: {
      head: ['pandas word', 'In a spreadsheet', 'In this level'],
      rows: [
        ['**DataFrame**', 'The whole sheet: rows, with a name on each column', '`df`, all 233 rows'],
        ['**Series**', 'One column', '`df["amount"]`, the 233 amounts'],
        ['**boolean mask**', 'The filter button: a tick or a cross next to each row', '`df["amount"] < -20`, one True or False per row']
      ]
    }},
    { p: 'The mask is the one that takes a moment, so here it is on five real rows. The question is "did this cost more ' +
         'than $20?", which in this sign system means an amount below -20:' },
    { code: 'five = df.iloc[2:7]            # five rows from the file\nmask = five["amount"] < -20    # ask the question of every row at once\nprint(mask)', lang: 'python' },
    { code: '2     True     # IRONWORKS GYM   -35.00\n3     True     # THE CURRY POT   -40.40\n4    False     # NETFLIX         -12.99\n5    False     # BEAN THERE       -3.66\n6     True     # CORNER MARKET   -49.84\nName: amount, dtype: bool', lang: 'text', label: 'what prints, with the shop names added so you can check' },
    { p: 'Comparing a column to a number did not give you one answer. It gave you one answer per row. Put that list of ' +
         'answers inside square brackets, `five[mask]`, and pandas keeps the rows marked True: the gym, the curry and the ' +
         'groceries. That is all a filter is.' },
    { check: {
      q: 'Name what each of these is: `df`, `df["amount"]`, `df["amount"] < 0`, and `df[df["amount"] < 0]`.',
      a: 'A DataFrame (the whole table), a Series (one column), a mask (one True or False per row), and a DataFrame again ' +
         '(the table, keeping only the rows where the mask said True). The third is the one that surprises people: ' +
         'comparing a column to a number gives one answer per row, not one answer. Once you can name those four, you can ' +
         'read most pandas code, because most of it is those four things in a row.'
    }},

    { h: 'Check what type each column is before you add anything' },
    { p: 'Every column has a **type**: numbers, text or dates. It matters because Python treats them differently. Numbers ' +
         'add up. Text gets glued together. Dates can be split into months or subtracted to count days.' },
    { p: 'A CSV file is only text, so when pandas reads one it has to guess the type of every column from what it sees. ' +
         'Usually it guesses well. `df.info()` shows you what it decided, and on this file it prints:' },
    { code: 'df = pd.read_csv(URL, parse_dates=["date"])\ndf.info()', lang: 'python' },
    { code: 'RangeIndex: 233 entries, 0 to 232\nData columns (total 6 columns):\n #   Column       Non-Null Count  Dtype\n---  ------       --------------  -----\n 0   date         233 non-null    datetime64[ns]\n 1   description  233 non-null    object\n 2   category     233 non-null    object\n 3   amount       233 non-null    float64\n 4   account      233 non-null    object\n 5   method       233 non-null    object', lang: 'text', label: 'df.info(), trimmed to the part that matters' },
    { p: 'Read the last column, `Dtype` (short for data type). `float64` means numbers with decimals, which is right for ' +
         'amounts. `datetime64` means real dates, and you only get that because of `parse_dates=["date"]`: leave it out ' +
         'and the date column is plain text. `object` is pandas\' word for text. And `233 non-null` means no cell is empty.' },
    { p: 'Here is why you check. The same three amounts, stored as text and then as numbers:' },
    { code: 'pd.Series(["12.50", "3.00", "40.40"]).sum()    # \'12.503.0040.40\'  glued together\npd.Series([12.50, 3.00, 40.40]).sum()          # 55.9              added up', lang: 'python' },
    { p: 'And it only takes one bad cell. If a single amount is written `N/A`, or `1,150.00` with a comma, pandas cannot ' +
         'read it as a number, so it treats the **whole column** as text. There is no error message. `.sum()` hands you a ' +
         'long string of digits, and if you do not look closely you might believe it.' },
    { tip: 'The habit: run `df.info()` before any arithmetic. If a column that should hold money says `object`, stop and ' +
           'find the cell that broke it.' },
    { check: {
      q: 'A colleague sends you the same file with the rent typed as `"1,150.00"`, comma and all. You call ' +
         '`df["amount"].sum()`, nothing raises, and a very long line of digits prints. What happened?',
      a: 'The comma made that one value unreadable as a number, so pandas typed the whole column as `object`, meaning text. ' +
         '`sum()` on text glues the pieces end to end, so it stuck 233 amounts together instead of adding them. No error, no ' +
         'warning, just an answer wrong by an amount you could never guess. That is the case `df.info()` exists to catch. ' +
         'The repair is `pd.to_numeric(df["amount"].str.replace(",", ""), errors="coerce")`, which removes the commas and ' +
         'turns anything still unreadable into `NaN` (pandas\' mark for a missing value). Then count the `NaN`s to see what ' +
         'else was hiding in the column.'
    }},

    { h: 'Grouping: sorting receipts into piles' },
    { p: 'Picture a shoebox of six months of receipts, and someone asks how much went on eating out. You would tip them ' +
         'onto a table, sort them into piles by type, add up each pile, and write the totals on one piece of paper. That ' +
         'is the method behind almost every money report: **split** the rows into groups, **add up** each group, then ' +
         '**collect** the totals into a small table. pandas calls it `groupby`.' },
    { p: 'Do it once by hand so it stops being magic. Five real rows from the file:' },
    { table: {
      head: ['Date', 'Description', 'Category', 'Amount'],
      rows: [
        ['2025-03-02', 'IRONWORKS GYM', 'subscriptions', '-35.00'],
        ['2025-03-02', 'THE CURRY POT', 'dining', '-40.40'],
        ['2025-03-05', 'NETFLIX', 'subscriptions', '-12.99'],
        ['2025-03-06', 'BEAN THERE', 'dining', '-3.66'],
        ['2025-03-06', 'CORNER MARKET', 'groceries', '-49.84']
      ]
    }},
    { p: '**Split** by category and you hold three piles: dining has two rows, subscriptions has two, groceries has one. ' +
         '**Add up** each pile: dining is 40.40 + 3.66 = $44.06, subscriptions is 35.00 + 12.99 = $47.99, groceries is ' +
         '$49.84. **Collect** those three answers and you have a table with one row per category, totalling $141.89. That ' +
         'is the same money as the five rows you started with, each counted once. Checking that the totals add back up to ' +
         'where you started is worth doing on every report you ever write.' },
    { p: 'The code does the same thing to all the spending at once. The minus signs are awkward in a report, so the ' +
         'second line makes a positive copy of each amount first:' },
    { code: 'spend = df[df["amount"] < 0].copy()              # the 221 rows where money left\nspend["abs_amount"] = spend["amount"].abs()      # the same amounts without the minus\nby_cat = spend.groupby("category")["abs_amount"].sum().sort_values(ascending=False)\nprint(by_cat.to_string())', lang: 'python' },
    { code: 'category\nhousing          6900.00\nsavings          1800.00\nshopping         1448.96\ndining           1399.78\ngroceries        1373.50\ntransport         977.12\nutilities         797.18\nsubscriptions     461.76', lang: 'text' },
    { p: 'Now read it like an analyst rather than a machine. Housing is six rent payments of $1,150.00. Savings is the ' +
         'transfer you already know to leave out. Dining is **95** separate purchases averaging $14.73, and 23 of them cost ' +
         'under $5, which is how small habits end up costing more than the groceries.' },
    { p: 'To ask "how much each month", you need a column that holds the month. Once the date column is a real date, ' +
         'pandas can pull pieces out of it with `.dt`: `.dt.to_period("M")` turns `2025-03-14` into `2025-03`. Then it is ' +
         'the same groupby, with savings left out:' },
    { code: 'spend["month"] = spend["date"].dt.to_period("M")\nby_month = spend[spend["category"] != "savings"].groupby("month")["abs_amount"].sum()\nprint(by_month.to_string())', lang: 'python' },
    { code: 'month\n2025-03    2206.81\n2025-04    2284.40\n2025-05    2069.97\n2025-06    2113.41\n2025-07    2368.04\n2025-08    2315.67\nFreq: M', lang: 'text' },
    { p: 'Spending sits between $2,069.97 and $2,368.04 every month, against income of $3,200.00, or $3,650.00 in the two ' +
         'bonus months. A steady picture like that is itself a finding: this person is not in trouble, and the useful ' +
         'advice is about the small things, not a crisis.' },
    { warn: 'Notice `.copy()` on the first line. When you filter a table and then add a column to the result, pandas ' +
            'cannot tell whether you meant to change the original table too, so it prints a `SettingWithCopyWarning`. ' +
            '`.copy()` says plainly: this is a new table of its own.' },
    { check: {
      q: 'Run `spend.groupby("category")["abs_amount"].sum()` on those five rows and three numbers come back, labelled ' +
         'dining, groceries and subscriptions. Is that a DataFrame, and where did the dates and descriptions go?',
      a: 'It is a Series: one column of numbers, with the category names as its row labels, because you asked for one ' +
         'column (`["abs_amount"]`) and squeezed it down to one number per group. The dates and descriptions are gone on ' +
         'purpose. Each pile held several of them, and a single total has no room for any, so pandas drops every column you ' +
         'did not ask it to add up. If you want more back, ask for more: `.agg(["sum", "count"])` gives the total and how ' +
         'many rows made it.'
    }},

    { h: 'Finding subscriptions: the same charge, again and again' },
    { p: 'A subscription has a simple fingerprint: **the same shop, charging the same amount, every month**. Here is ' +
         'Netflix in this file:' },
    { table: {
      head: ['Date', 'Description', 'Amount'],
      rows: [
        ['2025-03-05', 'NETFLIX', '-12.99'],
        ['2025-04-05', 'NETFLIX', '-12.99'],
        ['2025-05-05', 'NETFLIX', '-12.99'],
        ['2025-06-05', 'NETFLIX', '-12.99'],
        ['2025-07-05', 'NETFLIX', '-12.99'],
        ['2025-08-05', 'NETFLIX', '-12.99']
      ]
    }},
    { p: 'Six months, six identical charges, always on the 5th. You do not need anything clever to find these. Count how ' +
         'many times each pair of shop and amount appears, and keep the pairs that appear three times or more. A coffee ' +
         'shop will not pass, because the price changes from visit to visit. A subscription will, because it never does.' },
    { code: 'counts = (spend.groupby(["description", "abs_amount"])   # one pile per shop AND amount\n                .size()                                   # how many rows in each pile\n                .reset_index(name="times"))               # back into a normal table\nrecurring = counts[counts["times"] >= 3].sort_values("abs_amount", ascending=False)\nprint(recurring.to_string(index=False))', lang: 'python' },
    { code: '         description  abs_amount  times\nRENT - HARBOUR LOFTS     1150.00      6\n TRANSFER TO SAVINGS      300.00      6\n   FIBRENET INTERNET       45.00      6\n       IRONWORKS GYM       35.00      6\n      CLOUDSTREAM TV       15.99      6\n             NETFLIX       12.99      6\n     SPOTIFY PREMIUM        9.99      6\n      ICLOUD STORAGE        2.99      6', lang: 'text' },
    { check: {
      q: 'On this file the rule finds eight shops billing the same amount six times each. Three of them do not belong in ' +
         'a list headed "things you could cancel". Which three, and what separates them from the rest?',
      a: 'Rent at $1,150.00, the $300.00 transfer to savings, and $45.00 of internet. The transfer is not spending at all, ' +
         'the money only changed pocket. Rent and internet are spending, but they are commitments: cancelling them means ' +
         'moving house or going offline, which is not a tip anyone can use. The five that remain are the gym at $35.00, ' +
         'streaming at $15.99, Netflix at $12.99, Spotify at $9.99 and iCloud at $2.99, which come to $76.96 a month and ' +
         '$923.52 a year. The rule found all eight. Deciding which five to show is your job, not the rule\'s.'
    }},
    { money: 'Every serious money app ships this feature, because a forgotten subscription is the easiest saving a person ' +
             'can make. This person pays for two streaming services at once, CLOUDSTREAM TV and Netflix, $28.98 a month ' +
             'or $347.76 a year together. Asking whether they need both is worth more to them than any chart you draw.' },

    { h: 'The numbers a person actually wants' },
    { p: 'Nobody wants 233 rows. They want a handful of numbers that tell them how they are doing. Here they are for this ' +
         'file, each one defined in a sentence:' },
    { table: {
      head: ['Number', 'What it means', 'This file'],
      rows: [
        ['**Income**', 'Money earned: the rows labelled income, not every positive row', '$20,100.00'],
        ['**Spending**', 'Money gone: every outgoing row except the transfers to savings', '$13,358.30'],
        ['**Saved**', 'Income minus spending', '$6,741.70'],
        ['**Savings rate**', 'Saved divided by income: of every $100 earned, how much was kept', '**33.5%**'],
        ['**Net cash flow**', 'Every row added together: how much this one account grew', '+$5,072.74'],
        ['**Bills and commitments**', 'Housing, utilities and subscriptions: hard to change this month', '$8,158.94, 61.1%'],
        ['**Day to day choices**', 'Dining, groceries, shopping and transport: changeable tomorrow', '$5,199.36, 38.9%']
      ]
    }},
    { p: 'The **savings rate** is the one people remember, and 33.5% is healthy: this person keeps a third of what they earn. ' +
         'It is also a fair comparison between people on very different pay, which a dollar amount is not.' },
    { p: 'Why is net cash flow ($5,072.74) smaller than saved ($6,741.70)? Because the checking account only shows part of ' +
         'the story. $1,800.00 of the savings left for the savings account, and the $131.04 of refunds came in without ' +
         'being income: 6,741.70 - 1,800.00 + 131.04 = 5,072.74. When two of your numbers disagree, being able to explain ' +
         'the gap to the cent is how you know both are right.' },
    { p: 'The last two rows are the split between money that is already committed and money chosen fresh every day. Advice ' +
         'only helps with the second group. Nobody changes their rent this month, but anyone can change what they eat out.' },
    { check: {
      q: 'Income is $20,100.00 and spending, transfers excluded, is $13,358.30, so the savings rate is 33.5%. A reviewer says ' +
         'the $1,800.00 moved into savings should come off as well. Work out their number and say why it is wrong.',
      a: 'Theirs is (20,100.00 - 13,358.30 - 1,800.00) / 20,100.00 = 24.6%. It is wrong because the transfer is the saving. ' +
         'It already sits inside the $6,741.70 that did not get spent, so subtracting it counts the same money twice, once as ' +
         'saved and once as spent. Their version also punishes the careful saver: someone who left the $1,800.00 sitting in ' +
         'checking would score 33.5%, while the person who actually moved it into savings scores 24.6%.'
    }},

    { h: 'One chart, chosen on purpose' },
    { p: 'A chart exists to make one comparison easy to see. For "which category is biggest", use a **horizontal bar chart ' +
         'sorted by size**. Every bar starts from the same line, so your eye only has to compare lengths, which people do ' +
         'accurately. A pie chart asks people to compare the angles of slices, which they do badly: slices of 13% and 16% ' +
         'are hard to tell apart. For "how did this change over time", use a **line**, because time runs left to right.' },
    { code: 'import matplotlib.pyplot as plt\n\nby_cat.drop("savings").sort_values().plot(kind="barh", figsize=(8, 4))\nplt.title("Spending by category: Mar to Aug 2025")\nplt.xlabel("USD")\nplt.tight_layout()\nplt.show()', lang: 'python' },
    { p: 'Two small choices in that code are doing real work. `.drop("savings")` removes the transfer, because it is not ' +
         'spending and would otherwise be the second longest bar. `.sort_values()` puts the bars in order, so the reader ' +
         'sees the ranking without reading a single number.' },
    { check: {
      q: 'On that chart housing is $6,900.00 and subscriptions is $461.76, a stub about a fifteenth as long. Does the length ' +
         'of the bar tell you what to put in your findings?',
      a: 'No, and this is where analysts lose people. The chart answers one question, where the money goes, and on that ' +
         'question housing wins and nothing is close. What to do about it is a different question with a different answer: ' +
         'the person cannot move house this month, but they can cancel $76.96 a month of subscriptions, which is $923.52 ' +
         'over a year. Report the long bar because it is true, and lead the advice with the short one because it is ' +
         'something they can act on.'
    }}
  ],

  tutorial: {
    intro: 'New notebook: `finquest-level-03.ipynb`. Pandas and matplotlib are already installed in Colab: no pip needed. ' +
           'The dataset is six months of a fictional person\'s account, generated for this course.',
    steps: [
      {
        t: 'Load the data straight from the web',
        blocks: [
          { p: '`read_csv` accepts a URL as happily as a filename, so there is nothing to download.' },
          { code: 'import pandas as pd\n\nURL = "{{RAW}}/data/level-03-transactions.csv"\ndf = pd.read_csv(URL, parse_dates=["date"])\n\nprint(df.shape)        # (233, 6)\ndf.head()', lang: 'python' },
          { p: '`parse_dates=["date"]` is what turns that column from text into real dates. Without it the column stays text: ' +
               '`.dt` raises an error, and you cannot pull out a month or count the days between two payments.' },
          { tip: 'Prefer working offline, or the URL is blocked on your network? Download the CSV from the repo, then in Colab ' +
                 'click the folder icon on the left and drag the file in. Load it with `pd.read_csv("level-03-transactions.csv", parse_dates=["date"])`.' }
        ],
        check: 'df.shape prints (233, 6) and df.head() shows dates, descriptions and amounts.'
      },
      {
        t: 'Inspect before you trust',
        blocks: [
          { code: 'df.info()\nprint(df["amount"].dtype)          # float64: good\nprint(df["category"].value_counts())\nprint(df["date"].min(), "->", df["date"].max())', lang: 'python' },
          { p: 'You are checking three things: the amount column is numeric, the date range is what you expect, ' +
               'and there are no surprise categories. `value_counts()` on any text column is the fastest way to see what is in it.' }
        ],
        check: 'amount is float64, date runs from 2025-03-01 to 2025-08-27, and you can list the categories.'
      },
      {
        t: 'Filter rows with boolean masks',
        blocks: [
          { p: 'A comparison on a column produces a True/False Series. Put it inside `df[...]` to keep only the True rows.' },
          { code: 'spend = df[df["amount"] < 0].copy()          # money out only\nincome = df[df["category"] == "income"]      # not amount > 0, because refunds are positive too\n\nprint(len(spend), "outgoing rows")\nprint(f"Income:  ${income[\'amount\'].sum():,.2f}")\nprint(f"Outgoing: ${spend[\'amount\'].sum():,.2f}")', lang: 'python' },
          { p: 'Combine conditions with `&` (and) / `|` (or), and wrap each condition in brackets: Python\'s operator ' +
               'precedence will bite you otherwise:' },
          { code: 'big_dining = df[(df["category"] == "dining") & (df["amount"] < -30)]\nprint(big_dining[["date", "description", "amount"]].to_string(index=False))', lang: 'python' }
        ],
        check: 'Income prints $20,100.00, confirming that the refunds were correctly excluded.'
      },
      {
        t: 'Add columns you need',
        blocks: [
          { code: 'spend["abs_amount"] = spend["amount"].abs()\nspend["month"] = spend["date"].dt.to_period("M")\nspend["weekday"] = spend["date"].dt.day_name()\n\nspend.head(3)', lang: 'python' },
          { p: 'Assigning to a column name that does not exist creates it. This is why you took a `.copy()` when filtering: ' +
               'without it pandas cannot tell whether you meant to modify the original table.' }
        ],
        check: 'spend has abs_amount, month and weekday columns and no SettingWithCopyWarning.'
      },
      {
        t: 'Aggregate with groupby',
        blocks: [
          { code: '# by category, largest first\nby_cat = spend.groupby("category")["abs_amount"].sum().sort_values(ascending=False)\nprint(by_cat.round(2).to_string())\n\n# by month\nby_month = spend.groupby("month")["abs_amount"].sum()\nprint(by_month.round(2).to_string())\n\n# top merchants\ntop = spend.groupby("description")["abs_amount"].sum().sort_values(ascending=False).head(10)', lang: 'python' },
          { p: 'You can aggregate several ways at once with `.agg()`: useful when you want both a total and a count:' },
          { code: 'summary = spend.groupby("category")["abs_amount"].agg(["sum", "count", "mean"]).round(2)\nsummary = summary.sort_values("sum", ascending=False)\nsummary', lang: 'python' }
        ],
        check: 'Housing is the largest category at $6,900.00 and subscriptions total $461.76.'
      },
      {
        t: 'Detect recurring charges',
        blocks: [
          { p: 'Group by merchant **and** amount together by passing a list. `.size()` counts rows in each group; ' +
               '`reset_index` turns the result back into a normal DataFrame.' },
          { code: 'counts = (spend.groupby(["description", "abs_amount"])\n                .size()\n                .reset_index(name="times"))\n\nrecurring = counts[counts["times"] >= 3].sort_values("abs_amount", ascending=False)\nrecurring["yearly_cost"] = recurring["abs_amount"] * 12\nprint(recurring.to_string(index=False))', lang: 'python' },
          { p: 'Rent and the savings transfer will show up too. They are genuinely recurring. Your report should separate ' +
               '"subscriptions you could cancel" from "fixed commitments you cannot", and that is a judgement your code makes explicit.' }
        ],
        check: 'You can list the recurring charges with their annual cost, including CLOUDSTREAM TV at $191.88 a year.'
      },
      {
        t: 'Draw one honest chart',
        blocks: [
          { code: 'import matplotlib.pyplot as plt\n\nchart = by_cat.drop("savings", errors="ignore").sort_values()\nax = chart.plot(kind="barh", figsize=(8, 4), color="#5B8CFF")\nax.set_title("Spending by category: Mar to Aug 2025")\nax.set_xlabel("USD")\nplt.tight_layout()\nplt.show()', lang: 'python' },
          { p: 'Dropping `savings` is a deliberate analytical choice, not a trick: transfers to yourself are not consumption, ' +
               'and leaving them in the chart makes the biggest bar a lie. Say so in a comment.' },
          { tip: 'Save a chart with `plt.savefig("spending.png", dpi=150, bbox_inches="tight")` and upload the PNG to your ' +
                 'repo so the README can show it.' }
        ],
        check: 'A sorted horizontal bar chart appears with a title and an axis label.'
      },
      {
        t: 'Format a report humans will read',
        blocks: [
          { code: 'income_total = df[df["category"] == "income"]["amount"].sum()\nspend_total = spend[spend["category"] != "savings"]["abs_amount"].sum()\nsaved = income_total - spend_total\nrate = saved / income_total\n\nprint("=" * 46)\nprint(f"{\'Six-month money report\':^46}")\nprint("=" * 46)\nprint(f"Income          ${income_total:>14,.2f}")\nprint(f"Spending        ${spend_total:>14,.2f}")\nprint(f"Saved           ${saved:>14,.2f}")\nprint(f"Savings rate    {rate:>14.1%}")', lang: 'python' },
          { p: '`:^46` centres text in 46 characters, `:>14,.2f` aligns money to the right. Plain text reports like this are what ' +
               'gets pasted into a chat channel, so make them tidy.' }
        ],
        check: 'Your report prints with aligned columns and a savings rate around 33.5%.'
      }
    ]
  },

  glossary: [
    { t: 'DataFrame', d: 'A pandas table: named columns, typed values, an index of row labels.' },
    { t: 'Series', d: 'A single typed column of a DataFrame.' },
    { t: 'Boolean mask', d: 'A True/False Series used inside df[...] to select rows.' },
    { t: 'groupby', d: 'Split rows into groups, apply an aggregation, combine results into a table.' },
    { t: 'dtype', d: 'The type of a column. Object means text or mixed, usually a warning sign on numeric data.' },
    { t: 'parse_dates', d: 'read_csv argument that converts text columns into real datetimes.' },
    { t: '.dt accessor', d: 'Gives date parts (month, day_name, year) from a datetime column.' },
    { t: 'Sign convention', d: 'The rule deciding whether money out is negative. Must be verified before analysis.' },
    { t: 'Savings rate', d: '(income - spending) / income. The clearest single indicator of financial health.' },
    { t: 'Recurring charge', d: 'An identical amount billed by the same merchant on a regular cadence.' },
    { t: 'Fixed vs variable', d: 'Commitments you cannot change this month versus daily discretionary choices.' }
  ],

  quiz: [
    { q: "Why is `df[df[\"amount\"] > 0]` the wrong way to find income in this dataset?",
      options: [
        "Because income is stored as a negative number",
        "Because it returns a Series instead of a DataFrame",
        "Because pandas cannot compare numbers to columns",
        "Because refunds are also positive amounts, and they are not income"
      ],
      answer: 3,
      why: "Refunds, reversals, and interest credits are all positive. Filter on the category column when you mean income, or you will overstate it." },

    { q: "What does `parse_dates=[\"date\"]` do in read_csv?",
      options: [
        "Removes rows with invalid dates",
        "Sets the date column as the index",
        "Converts the column from text into real datetime values",
        "Sorts the rows by date"
      ],
      answer: 2,
      why: "Without it the column stays text, the .dt accessor is unavailable, and sorting is alphabetical, which places 2025-10 before 2025-3." },

    { q: "df.dtypes shows the amount column as `object`. What does that mean?",
      options: [
        "It is a currency type with correct rounding",
        "It is an integer column",
        "The column has been indexed",
        "It contains text or mixed values: a stray non-numeric entry got in"
      ],
      answer: 3,
      why: "object means text or mixed. Calling .sum() on it concatenates strings instead of adding numbers, giving a silently wrong answer." },

    { q: "What is a boolean mask?",
      options: [
        "A True/False Series used inside df[...] to select rows",
        "A way of hiding columns from display",
        "A pandas method that converts types",
        "A password on a DataFrame"
      ],
      answer: 0,
      why: "df[\"amount\"] < 0 produces a True/False Series; df[mask] keeps the True rows. It is the standard filtering idiom." },

    { q: "Which expression correctly selects dining transactions over $30?",
      options: [
        "df[df[\"category\"] == \"dining\" and df[\"amount\"] < -30]",
        "df[(df[\"category\"] == \"dining\") & (df[\"amount\"] < -30)]",
        "df[df[\"category\"] == \"dining\" && df[\"amount\"] < -30]",
        "df.filter(\"dining\", -30)"
      ],
      answer: 1,
      why: "pandas uses & and |, not and/or, and every condition needs its own brackets because & binds tighter than the comparison operators." },

    { q: "What does `SettingWithCopyWarning` usually indicate?",
      options: [
        "You filtered a DataFrame and then added a column without taking a .copy()",
        "A column contains missing values",
        "Your data contains duplicates",
        "You are out of memory"
      ],
      answer: 0,
      why: "pandas cannot tell whether you meant to modify the original or the filtered view. Adding.copy() when you filter states your intent and removes the warning." },

    { q: "What does the split-apply-combine pattern describe?",
      options: [
        "Splitting a column into first and last name",
        "Grouping rows, aggregating each group, and combining the results into a table",
        "Merging two DataFrames on a key",
        "Splitting a CSV into several files"
      ],
      answer: 1,
      why: "That is exactly what groupby does, and nearly every analytics question reduces to it." },

    { q: "How do you get a month column from a datetime column?",
      options: [
        "df[\"date\"].dt.to_period(\"M\")",
        "df[\"date\"].month",
        "df[\"date\"].astype(\"month\")",
        "df.month(\"date\")"
      ],
      answer: 0,
      why: "Date parts live under the .dt accessor on a Series. .dt.to_period(\"M\") gives a month period; .dt.month would give just the number 3." },

    { q: "What does `spend.groupby([\"description\", \"abs_amount\"]).size()` produce?",
      options: [
        "The average amount per merchant",
        "A count of rows for each unique merchant-and-amount pair",
        "The total amount per merchant",
        "The number of columns in each group"
      ],
      answer: 1,
      why: "Passing a list groups by both keys at once, and .size() counts the rows, which is how identical repeated charges reveal themselves." },

    { q: "Why should a transfer to your own savings account be excluded from \"spending\"?",
      options: [
        "Because savings transfers are usually duplicates",
        "Because banks do not report transfers",
        "Because transfers always have a zero amount",
        "Because the money is still yours: counting it as an expense understates the user's position"
      ],
      answer: 3,
      why: "Moving money between your own accounts changes location, not net worth. Several shipped budgeting apps get this wrong and users notice immediately." },

    { q: "A subscription-detection rule finds merchants with at least three identical charges. What false positive should you expect?",
      options: [
        "Fixed commitments like rent or a savings transfer, which are recurring but not cancellable",
        "One-off electronics purchases",
        "Refunds",
        "Coffee shop visits at random prices"
      ],
      answer: 0,
      why: "Rent is perfectly recurring and perfectly identical. A useful report separates cancellable subscriptions from fixed commitments rather than lumping them together." },

    { q: "Which chart best answers \"which category did I spend most on\"?",
      options: [
        "A pie chart of all categories",
        "A scatter plot of amount against date",
        "A horizontal bar chart sorted by size",
        "A stacked area chart"
      ],
      answer: 2,
      why: "Bars share a common baseline so the eye compares lengths precisely. Pie charts require comparing angles, which people do badly." },

    { q: "Income is $20,100 and spending excluding savings transfers is $13,358.30. What is the savings rate?",
      options: [
        "65.4%",
        "8.96%",
        "33.5%",
        "66.5%"
      ],
      answer: 2,
      why: "(20,100 - 13,358.30) / 20,100 = 0.3354. The savings rate is the share of income that did not get spent, not the share that was transferred." },

    { q: "What does `.value_counts()` on a text column tell you?",
      options: [
        "The number of missing values",
        "How many times each distinct value appears",
        "The column type",
        "The sum of the column"
      ],
      answer: 1,
      why: "It is the fastest way to see what is actually in a categorical column: including typos and unexpected categories." },

    { q: "In `f\"${total:>14,.2f}\"`, what does the `>` do?",
      options: [
        "Adds a greater-than sign to the output",
        "Rounds up to the next whole number",
        "Aligns the value to the right within 14 characters",
        "Compares total to 14"
      ],
      answer: 2,
      why: "Alignment specifiers are < left, > right, ^ centre, followed by the width. Money columns aligned to the right are what make a text report readable." }
  ],

  project: {
    title: 'Personal spending analyzer',
    story: 'A member drops six months of their bank export on your desk with one question: "where is my money ' +
           'actually going?" Build the analyzer that answers it, and see if you can find them at least one thing ' +
           'worth cancelling.',
    scope: 'Uses only this level plus level 2: pandas (read_csv, masks, groupby, sort_values, value_counts, .dt, .abs), ' +
           'matplotlib bar charts, f-string formatting, and functions. No machine learning, no APIs, no classes.',
    dataset: '{{RAW}}/data/level-03-transactions.csv',
    requirements: [
      'Load the CSV from the URL with dates parsed, and print shape plus dtypes to prove the load is clean',
      'A function `load_data(url)` returning a DataFrame with `abs_amount`, `month` and `weekday` columns added',
      'A function `headline_numbers(df)` returning total income, total spend excluding savings transfers, net cash flow, and savings rate',
      'A function `by_category(df)` returning spend per category sorted largest first',
      'A function `by_month(df)` returning spend and income per month side by side',
      'A function `top_merchants(df, n=10)` returning the biggest merchants by total spend',
      'A function `find_recurring(df, min_times=3)` returning merchant, amount, times seen, and annual cost',
      'Your recurring output must separate cancellable subscriptions from fixed commitments (rent, utilities, savings)',
      'A function `weekday_pattern(df)` showing which day of the week the user spends most on',
      'One sorted horizontal bar chart of spending by category, excluding savings transfers, with a title and axis label',
      'A `report(df)` function printing an aligned plain-text summary of everything above',
      'Three written findings in a markdown cell, each with the number that supports it and one concrete recommendation',
      'Notebook saved to your portfolio repo as `level-03-spending-analyzer.ipynb`'
    ],
    starter: {
      lang: 'python',
      code: '"""FinQuest level 3: Personal spending analyzer"""\n\nimport pandas as pd\nimport matplotlib.pyplot as plt\n\nURL = "{{RAW}}/data/level-03-transactions.csv"\n\n\ndef load_data(url=URL):\n    """Read the CSV and add abs_amount, month and weekday columns."""\n    # TODO: parse_dates, then build the helper columns\n    pass\n\n\ndef headline_numbers(df):\n    """Return a dict: income, spend (excl. savings), net, savings_rate."""\n    # TODO\n    pass\n\n\ndef by_category(df):\n    """Spend per category, largest first."""\n    # TODO\n    pass\n\n\ndef by_month(df):\n    """Spend and income per month."""\n    # TODO\n    pass\n\n\ndef top_merchants(df, n=10):\n    """Biggest merchants by total spend."""\n    # TODO\n    pass\n\n\ndef find_recurring(df, min_times=3):\n    """Merchants charging an identical amount at least min_times.\n    Include a yearly_cost column and a flag for cancellable vs fixed.\n    """\n    # TODO\n    pass\n\n\ndef weekday_pattern(df):\n    """Total spend by day of week."""\n    # TODO\n    pass\n\n\ndef plot_categories(df):\n    """Sorted horizontal bar chart, savings transfers excluded."""\n    # TODO\n    pass\n\n\ndef report(df):\n    """Print the whole analysis as an aligned text report."""\n    # TODO\n    pass\n\n\nif __name__ == "__main__":\n    data = load_data()\n    report(data)\n    plot_categories(data)\n'
    },
    tests: [
      'The DataFrame has 233 rows and 6 original columns',
      'Total income (category == "income") is exactly $20,100.00',
      'Total spend excluding savings transfers is $13,358.30',
      'Net cash flow (sum of every amount) is $5,072.74',
      'Savings rate is 33.5% (to one decimal)',
      'Housing is the top category at $6,900.00; subscriptions total $461.76 over six months',
      'find_recurring finds 8 recurring charges at min_times=3, of which 5 are cancellable subscriptions',
      'CLOUDSTREAM TV appears at $15.99 x 6. An annual cost of $191.88',
      'Monthly subscription cost is $76.96'
    ],
    rubric: [
      { pts: 25, t: 'Correct aggregation', d: 'Headline numbers match the expected values, including the income-vs-refund and savings-transfer distinctions.' },
      { pts: 20, t: 'Recurring detection', d: 'Finds all repeated identical charges and separates cancellable from fixed.' },
      { pts: 20, t: 'Clean pandas', d: 'Masks and groupby instead of loops, .copy() when filtering, no SettingWithCopyWarning, no hardcoded totals.' },
      { pts: 20, t: 'Communication', d: 'Readable text report, one honest labelled chart, three findings each backed by a number and a recommendation.' },
      { pts: 15, t: 'Shipped', d: 'Notebook in your GitHub portfolio repo, runs top to bottom without errors after Restart and Run All.' }
    ],
    stretch: [
      'Flag any month where spending exceeded income and print by how much',
      'Add a `category_share(df)` that expresses each category as a percentage of total spend',
      'Detect a subscription price increase: same merchant, two different repeated amounts',
      'Rebuild the report for a rolling 3-month window instead of the whole file'
    ],
    solutionPath: 'solutions/level-03'
  },

  faq: [
    { q: 'read_csv gives a 404 or connection error',
      a: 'Check the URL is the raw.githubusercontent.com form, not the github.com page. Otherwise download the CSV and drag it into ' +
         'the Colab file panel, then read it by filename.' },
    { q: 'What is SettingWithCopyWarning and how do I fix it?',
      a: 'It appears when you add a column to a filtered slice. Take a copy at filter time: spend = df[df["amount"] < 0].copy().' },
    { q: 'My income total looks too high',
      a: 'You are probably using amount > 0, which includes refunds. Filter on category == "income" instead. The correct total is $20,100.00.' },
    { q: 'Why is my savings rate negative or over 100%?',
      a: 'You likely counted the transfer to savings as spending, or included it in both places. Exclude category == "savings" from spend, then (income - spend) / income.' },
    { q: 'How do I group by month?',
      a: 'Make sure the date column is datetime (parse_dates), then df["month"] = df["date"].dt.to_period("M") and group on that.' },
    { q: 'My chart is unreadable / bars are in random order',
      a: 'Sort before plotting: by_cat.sort_values().plot(kind="barh"). Add a title and an axis label, and drop savings transfers.' },
    { q: 'How do I find subscriptions?',
      a: 'Group by both description and absolute amount, count with .size(), and keep groups seen 3+ times. Then separate cancellable subscriptions from fixed commitments like rent.' }
  ]
});
