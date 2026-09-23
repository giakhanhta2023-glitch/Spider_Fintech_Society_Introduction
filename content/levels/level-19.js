/* =========================================================================
   LEVEL 19: the screen that filters you out
   ========================================================================= */
FQ.registerLevel({
  id: 19,
  codename: 'gauntlet',
  title: 'The screen that filters you out',
  tagline: 'Fourteen repositories will not help you if you cannot pass the sixty minute screen in front of them. This level is the filter itself: complexity you can feel, the eight patterns that keep appearing, and the practical exercises payments companies actually set.',
  difficulty: 9,
  minutes: 600,
  tags: ['interviews', 'complexity', 'data structures', 'practice'],
  summary: 'Everything before this level was about being worth hiring. This one is about being allowed to demonstrate ' +
           'it. The coding screen, the patterns that cover most of it, forty problems dressed as payments work, the ' +
           'Stripe style practical exercise, the behavioural round, and a rehearsal schedule. The complexity numbers ' +
           'here were measured, because feeling the difference is worth more than memorising the notation.',

  objectives: [
    'State the complexity of your own code without guessing',
    'Recognise which of eight patterns a problem wants',
    'Write a correct solution while talking, under time',
    'Handle a practical exercise: read a codebase fast, find the bug, ship the change',
    'Answer behavioural questions with a structure and a real story',
    'Rehearse on a schedule instead of grinding at random'
  ],

  knowledge: [
    { h: 'What the loop actually is' },
    { p: 'For a backend role at a payments company, the shape is nearly always this, and each stage is filtering for ' +
         'something different:' },
    { table: {
      head: ['Stage', 'Length', 'What it really tests'],
      rows: [
        ['Recruiter call', '20 min', 'That you can say what you have built in three sentences'],
        ['Technical screen', '45 to 60 min', 'Whether you can write working code while talking. Most rejections happen here'],
        ['Practical exercise', '60 to 90 min', 'Can you work in somebody else\'s codebase, at all'],
        ['Onsite coding, twice', '60 min each', 'Depth, and whether you improve a first answer'],
        ['System design', '45 to 60 min', 'Whether you have seen a system rather than read about one'],
        ['Behavioural', '45 min', 'Ownership, disagreement, and what you do when you are wrong']
      ]
    }},
    { p: 'Two things are worth knowing before you prepare. **Most candidates are rejected at the technical screen**, so ' +
         'that hour deserves most of your practice. And **Stripe, Adyen and several others prefer practical exercises to ' +
         'puzzles**: a small repository with a failing test, an API to integrate against, a bug to find, a migration to ' +
         'write. Preparing only on algorithm puzzles leaves you unready for the half of the industry that stopped ' +
         'setting them.' },
    { money: 'Your repositories change what these stages feel like rather than replacing them. A system design round ' +
             'where you can say "I built the reconciliation, and here is the break rate it found" is a different ' +
             'conversation from one where you are describing a design you have only read about. But you have to get to ' +
             'that round.' },

    { h: 'Complexity, as something you can feel' },
    { p: 'Big O describes how the work grows with the input, not how fast it is. That distinction sounds academic until ' +
         'you watch it. Here is the level 10 reconciliation, matching two files by reference, written the obvious way ' +
         'and the indexed way:' },
    { table: {
      head: ['Rows each side', 'Nested loops', 'Dictionary index', 'Ratio'],
      rows: [
        ['2,000', '187.2 ms', '1.1 ms', '175x'],
        ['8,000', '**8,528.3 ms**', '**7.0 ms**', '**1,220x**']
      ]
    }},
    { p: 'Four times the rows made the nested version **forty five times slower**, which is worse than the sixteen times ' +
         'quadratic growth predicts. The extra came from memory: at 2,000 rows the inner list still sits in cache, and ' +
         'at 8,000 it does not, so each comparison costs more as well as there being more of them. The indexed version ' +
         'grew by about six times, which is roughly linear with its own cache penalty.' },
    { p: 'Now scale it. At 8,000 rows a side the nested version takes 8.5 seconds. A real settlement file has a million ' +
         'rows, and a million is 125 times eight thousand, so the quadratic version would take **around 36 hours**, ' +
         'while the indexed version stays under a second. That is why the answer to "how would you match these two ' +
         'files" is a dictionary, and why an interviewer stops listening when it is not.' },
    { p: 'The same lesson, four more ways, all measured:' },
    { table: {
      head: ['Task', 'The obvious way', 'The right way', 'Ratio'],
      rows: [
        ['"Have I seen this reference?" 10,000 times, over 100,000 known references', 'A list: 19,708.9 ms', 'A set: 6.82 ms', '**2,891x**'],
        ['Group 200,000 payments by merchant, 500 merchants', 'Filter once per merchant: 9,527.8 ms', 'One pass into a dictionary: 59.1 ms', '**161x**'],
        ['Top 10 merchants out of 200,000', 'Sort everything: 309.1 ms', 'A heap of 10: 41.8 ms', '7.4x'],
        ['Build a 200,000 line export', 'String += in a loop: 195.2 ms', '`"".join(...)`: 82.8 ms', '2.4x']
      ]
    }},
    { p: 'Notice the sizes of the ratios. The first two are changes of complexity class, so they grow without limit as ' +
         'the data does. The last two are constant factor improvements, valuable but bounded. **Interviewers care much ' +
         'more about the first kind**, and so should you: getting a 7x speedup is nice, and turning `O(n²)` into `O(n)` ' +
         'is the answer to the question.' },
    { check: {
      q: 'In a screen you write a solution and say "this is O(n log n)". The interviewer asks whether it could be O(n). ' +
         'You cannot immediately see how. What is the best thing to say?',
      a: 'Say what you actually know, out loud, and then reason forwards. Something like: "The log n comes from the ' +
         'sort, so to remove it I would need to avoid needing sorted order. What I am using the order for is finding ' +
         'matches, and a hash map gives me lookups without order, so let me see whether that covers every case." Then ' +
         'try it. That answer shows the interviewer the thing they are actually assessing, which is whether you can ' +
         'find your way to a better solution with a hint, and it is far stronger than either guessing or going silent. ' +
         'If it turns out not to be possible, saying "I think n log n is the bound here, because we need the ordering ' +
         'for the ranking" is a perfectly good answer, and interviewers do sometimes ask about improvements that are ' +
         'not available to see what you do.'
    }},

    { h: 'The eight patterns' },
    { p: 'Almost every screen question is one of these wearing a costume. Learn to recognise the costume:' },
    { table: {
      head: ['Pattern', 'The tell', 'A payments version'],
      rows: [
        ['**Hash map counting**', '"How many", "duplicates", "seen before"', 'Find every payment reference that appears twice in a settlement file'],
        ['**Two pointers**', 'A sorted array, pairs, or merging', 'Merge two sorted transaction streams into one timeline'],
        ['**Sliding window**', '"In any period of", "consecutive"', 'The highest total any merchant took in a rolling 24 hours'],
        ['**Heap**', '"Top k", "k largest", a stream', 'The ten largest refunds today, from a stream you cannot store'],
        ['**Sort by a key**', '"Group", "order by", "earliest"', 'Order card events so authorisations precede their captures'],
        ['**Prefix sums**', '"Running total", "sum between"', 'A balance as of any date, from a list of entries'],
        ['**Graph and breadth first search**', '"Path", "reachable", "cycle"', 'Cheapest route through payment networks, or detecting a cycle in transfers'],
        ['**Intervals**', '"Overlap", "merge", "free time"', 'Merge overlapping authorisation holds on one card']
      ]
    }},
    { p: 'The recognition is the hard part and it is trainable. For every problem you practise, write down which pattern ' +
         'it was after you solve it. After thirty problems you will start naming the pattern from the question, which is ' +
         'what people mean when they say somebody is good at these.' },

    { h: 'Forty problems, in payments clothing' },
    { p: 'Solve each with tests and a stated complexity. They are ordinary interview problems: the costume is there so ' +
         'that you think about the domain at the same time, and so that your repository is worth showing.' },
    { table: {
      head: ['Pattern', 'Problems'],
      rows: [
        ['Hash map', 'Duplicate references in a file. First non repeated merchant. Two payments summing to a target. Are two settlement files anagrams of each other by reference. Most frequent decline code.'],
        ['Two pointers', 'Merge two sorted event streams. Remove duplicate refunds in place. Nearest pair of amounts. Three amounts summing to a target. Longest common prefix of two reference formats.'],
        ['Sliding window', 'Highest 24 hour volume for a merchant. Longest run of successful payments. Smallest window containing one of every decline code. Rolling average latency. Count windows over a velocity limit.'],
        ['Heap', 'Top ten refunds from a stream. Merge k sorted settlement files. Running median of payment amounts. The kth largest chargeback. Schedule payouts by priority.'],
        ['Sorting', 'Order card events so authorisation precedes capture. Group payments by merchant then by day. Sort by amount with references breaking ties. Find the first gap in a sequence of ids. Custom order for settlement currencies.'],
        ['Prefix sums', 'Balance as of any date. Days where the balance went negative. Subarray of payments summing to a refund. Largest single day movement. Fee totals between two dates.'],
        ['Graphs', 'Cheapest route across payment networks. Detect a cycle in a chain of transfers. Which accounts are reachable from one. Order microservice deploys by dependency. Shortest path in a currency conversion graph.'],
        ['Intervals', 'Merge overlapping authorisation holds. Free capacity in a payout schedule. Insert a hold into a sorted list. Maximum concurrent holds on one card. Minimum batches covering every settlement window.']
      ]
    }},
    { tip: 'Do not solve forty problems once. Solve twenty, twice, a week apart, under time, and keep a record of which ' +
           'ones you failed the second time. Repetition on the ones you got wrong is worth ten fresh problems, and the ' +
           'record is what makes the repetition targeted rather than random.' },

    { h: 'The hour itself' },
    { p: 'The most common way to fail a screen is not being unable to solve it. It is silence, or writing code before ' +
         'the problem is clear. This order works, and interviewers are grading against something close to it:' },
    { code: '1. Repeat the problem back, in your own words.            30 seconds\n2. Ask about edges: empty input, duplicates, size,\n   negative amounts, currencies, ties.                    1 minute\n3. Write one small example by hand and state the answer.   1 minute\n4. Say the approach and its complexity BEFORE coding.      1 minute\n5. Code, narrating. Leave the optimisation for later.     20 minutes\n6. Run your own example through it, out loud.              3 minutes\n7. Say what you would do with more time.                   1 minute', lang: 'text' },
    { p: 'Step 4 is the one candidates skip and the one interviewers weight most heavily. Saying "I will build a hash map ' +
         'of references, which makes this one pass and O(n) time with O(n) memory" before writing anything tells them ' +
         'almost everything they were going to learn from the whole hour.' },
    { ul: [
      '**Talk continuously, even when stuck.** "I am trying to see whether sorting first helps here" is information. Thirty seconds of silence is not, and it reads as being lost.',
      '**A working slow answer beats an unfinished fast one.** Get something correct, say what is slow about it, then improve it. Many interviews are scored on whether you got there, not on how directly.',
      '**Use the language you are fastest in,** unless the role is specifically Java, which is why level 18 exists.',
      '**Test with your own example,** by hand, before saying you are done. Finding your own bug is a positive signal; having the interviewer find it is not.',
      '**When you are stuck, three moves:** say the brute force out loud, try a tiny example on paper, or ask "would it help if the input were sorted?". One of the three almost always moves it forward.'
    ]},

    { h: 'The practical exercise' },
    { p: 'This is the round payments companies increasingly prefer, because it resembles the job. You are given a small ' +
         'repository and ninety minutes, and asked to do something real:' },
    { table: {
      head: ['Exercise', 'They are watching for'],
      rows: [
        ['Integrate against an API from its documentation', 'Do you read the docs, handle errors, set a timeout, retry safely'],
        ['Find and fix a bug from a failing test', 'Can you navigate unfamiliar code without panicking'],
        ['Add a feature to an existing service', 'Do you match the existing style, or impose your own'],
        ['Write a migration and a backfill', 'Level 13, in ninety minutes'],
        ['Review a pull request and comment', 'What you notice, and how you say it']
      ]
    }},
    { ul: [
      '**Run the tests in the first five minutes,** before reading everything. A working baseline tells you more than an hour of reading, and a broken setup is something you want to find early.',
      '**Follow the conventions you find.** A pull request that reformats the file while fixing a bug is a bad signal at every company.',
      '**Commit small and often,** with messages. Some companies read the history to see how you worked.',
      '**Write a short note with your submission:** what you did, what you did not have time for, what you would do next. It converts an unfinished exercise into a demonstration of judgement.',
      '**Handle the failure cases,** because that is the entire point of the payments version. A happy path integration with no timeout and no retry is the wrong answer even when it works.'
    ]},
    { check: {
      q: 'In a ninety minute practical exercise you realise at minute seventy that your approach cannot handle one of ' +
         'the required cases. Do you start again, hack around it, or stop and explain?',
      a: 'None of those exactly, and the order matters. First, make sure what you have is committed and working for the ' +
         'cases it does handle, because a working partial solution is worth much more than a broken complete one. Then ' +
         'spend two minutes deciding whether the gap is a small fix inside your design or a design problem, and say ' +
         'which it is in your notes. If it is small, do it. If it is structural, do not start again with twenty minutes ' +
         'left, because you will hand in nothing. Write the note instead: what breaks, why your approach cannot handle ' +
         'it, and what you would do differently given another hour, ideally with the shape of the correct design ' +
         'sketched. Reviewers consistently score that above a rushed rewrite, because it is exactly what they want a ' +
         'colleague to do at four in the afternoon on a Friday.'
    }},

    { h: 'The behavioural round is not a formality' },
    { p: 'At a payments company this round is often where offers are decided, because the domain punishes people who ' +
         'hide mistakes. Use **STAR**: Situation, Task, Action, Result, in about two minutes, with the Action being most ' +
         'of it and containing the word "I" rather than "we".' },
    { p: 'Prepare five stories, written down, and reuse them across questions:' },
    { ul: [
      '**Something you built that mattered,** with a number in it. One of your levels, with the measurement.',
      '**A time you were wrong,** and what you did when you found out. Not a disguised strength.',
      '**A disagreement with somebody,** and how it was resolved. What you did when you lost the argument counts here.',
      '**Something that broke,** what you did first, and what you changed afterwards so it could not recur.',
      '**A money bug,** even a small one from your own projects: the one cent rounding difference, the double capture, the missing idempotency key. In fintech this story lands harder than any of the others.'
    ]},
    { p: 'The failure story is the one people prepare worst. Interviewers are not looking for a small tidy mistake; they ' +
         'are looking for whether you noticed, told somebody, fixed it and changed something. "I shipped a rounding bug ' +
         'that under charged 40 merchants by a cent each, I found it in reconciliation, I told my lead before fixing it, ' +
         'we corrected the entries and I added a property test that would have caught it" is a strong answer, and it is ' +
         'a story every one of these levels can give you.' },

    { h: 'A rehearsal schedule' },
    { p: 'Grinding problems at random is how people spend three months and improve slowly. Six weeks, structured, beats ' +
         'three months of drift:' },
    { table: {
      head: ['Week', 'Coding', 'Everything else'],
      rows: [
        ['1', 'Ten problems, hash map and two pointers, untimed. Name the pattern for each', 'Write the five stories'],
        ['2', 'Ten problems, sliding window and heap, 30 minutes each', 'One practical exercise, timed'],
        ['3', 'Ten problems, sorting and prefix sums, 30 minutes, talking aloud', 'Rewrite the two weakest stories'],
        ['4', 'Ten problems, graphs and intervals, 30 minutes, talking aloud', 'One practical exercise, timed'],
        ['5', 'Redo the ten you failed, under time', 'Two mock interviews with a person'],
        ['6', 'Five fresh problems, full hour format', 'Level 20: system design, and the final package']
      ]
    }},
    { warn: 'Rehearse out loud, with somebody, at least twice. Explaining code while writing it uses a different part of ' +
            'your brain from writing it silently, and the first time you try it must not be in an interview. A friend on ' +
            'a call is enough; the value is in the talking, not in their feedback.' },
    { p: 'And the part nobody says out loud: **you will fail some of these**, including ones you should have passed. The ' +
         'screens are noisy, the hour is short and interviewers have bad days too. The response is to write down what ' +
         'happened while it is fresh, fix the specific thing, and apply to the next one. A rejection from a company that ' +
         'sets a problem you had never seen is information about the problem, not a verdict on you.' }
  ],

  tutorial: {
    intro: 'This level is practice rather than construction, so the repository is a record of practice: forty solved ' +
           'problems with tests and complexities, four timed exercises, and an honest log. Work in a repository called ' +
           '`interview-gauntlet`.',
    steps: [
      {
        t: 'Feel the complexity before you study it',
        blocks: [
          { p: 'Write the reconciliation both ways and time it yourself at several sizes. Do not read the numbers below ' +
               'and move on: produce your own, because the memory of watching 8.5 seconds become 7 milliseconds is what ' +
               'you will actually recall in an interview.' },
          { code: '2,000 rows a side   nested   187.2 ms   indexed   1.1 ms      175x\n8,000 rows a side   nested 8,528.3 ms   indexed   7.0 ms    1,220x', lang: 'text' },
          { p: 'Then extrapolate to a million rows, as the knowledge section does, and write the number in your README.' }
        ],
        check: 'You have your own timings at three sizes, and the growth ratio between them.'
      },
      {
        t: 'The four other comparisons',
        blocks: [
          { p: 'List against set membership, grouping by filter against one pass, sorting against a heap for top k, and ' +
               'string concatenation against join. Time each, and label which are changes of complexity class and which ' +
               'are constant factors.' },
          { code: 'membership, 100,000 known   list 19,708.9 ms   set   6.82 ms   2,891x   class change\ngrouping, 200,000 rows      filter 9,527.8 ms   pass 59.1 ms     161x   class change\ntop 10 of 200,000           sort    309.1 ms   heap 41.8 ms     7.4x   constant factor\n200,000 line export         +=      195.2 ms   join 82.8 ms     2.4x   constant factor', lang: 'text' }
        ],
        check: 'You can say, for each pair, whether the gap grows with the input or stays roughly fixed.'
      },
      {
        t: 'Twenty problems, with the pattern named',
        blocks: [
          { p: 'Work through the first twenty from the list, untimed to begin with. For each one: a solution, a test, ' +
               'the complexity in a comment, and the pattern name. One file per problem.' },
          { code: '"""Duplicate references in a settlement file.\n\nPattern: hash map counting\nTime:    O(n)\nSpace:   O(n)\nNote:    my first attempt sorted first, which was O(n log n) for no gain.\n"""', lang: 'python' },
          { p: 'That last line, recording your first wrong instinct, is the most useful thing in the file when you come ' +
               'back in week five.' }
        ],
        check: 'Twenty solved problems, each with a test, a complexity and a named pattern.'
      },
      {
        t: 'Twenty more, under thirty minutes each',
        blocks: [
          { p: 'Timer visible. Stop at thirty minutes whether or not you are finished, and record the outcome honestly: ' +
               'solved, solved with a hint you gave yourself, or failed. The log is the point.' },
          { tip: 'A problem you failed is more valuable than one you solved. Put it in a list called `redo.md` with the ' +
                 'date, and come back to it a week later.' }
        ],
        check: 'A log of forty attempts with times and outcomes, and a redo list.'
      },
      {
        t: 'Talk while you type',
        blocks: [
          { p: 'Redo five problems you have already solved, narrating every step out loud to a recording or a person. ' +
               'Follow the seven step order from the knowledge section, including saying the complexity before you ' +
               'write anything.' },
          { p: 'Listen to one recording. It is unpleasant and it is the fastest improvement available in this entire ' +
               'level, because the gap between what you thought you explained and what you actually said is large.' }
        ],
        check: 'You can solve a familiar problem while speaking continuously, with no silences over ten seconds.'
      },
      {
        t: 'Four practical exercises, timed',
        blocks: [
          { p: 'Build the exercises for yourself, because building them teaches you what they test:' },
          { code: '1. Integrate with a public API you have never used, with a timeout,\n   retries with backoff, and a test that proves the retry is safe.\n2. Take one of your own repositories, introduce a subtle bug on a\n   branch, leave it a week, then find it from the failing test alone.\n3. Add a feature to somebody else\'s small open source project,\n   matching their style exactly.\n4. Write a migration and a backfill for a schema you have not seen\n   for a month, in ninety minutes, with a rollback plan.', lang: 'text' },
          { p: 'Each one gets a note at the end: what you did, what you skipped, what you would do next. Practise ' +
               'writing that note, because it is part of the submission and almost nobody rehearses it.' }
        ],
        check: 'Four exercises completed under time, each with a submission note.'
      },
      {
        t: 'Write the five stories',
        blocks: [
          { p: 'Written out in STAR form, two minutes each spoken. Pull the numbers from your own levels: the 13% ' +
               'inconsistent payouts, the 49% histogram error, the break rate your reconciliation found.' },
          { p: 'Then say them out loud to somebody and ask which one was vague. There is always one that reads well and ' +
               'sounds like nothing.' }
        ],
        check: 'Five stories, each containing at least one number and at least one thing you changed afterwards.'
      },
      {
        t: 'Two mock interviews, with a person',
        blocks: [
          { p: 'A full hour each, with somebody who will not rescue you. One coding, one behavioural. Ask for the ' +
               'feedback in the form "what would have made you say no", which is more useful than praise.' },
          { p: 'Then fix exactly the two things they name, and stop preparing. Past a point, more practice stops helping ' +
               'and applying starts.' }
        ],
        check: 'Two mock interviews done, feedback written down, and two specific fixes made.'
      }
    ]
  },

  glossary: [
    { t: 'Big O', d: 'How the work grows with the input. A statement about growth, not about speed.' },
    { t: 'O(1)', d: 'Constant. A dictionary lookup. Does not care how large the data is.' },
    { t: 'O(log n)', d: 'Halving each step. Binary search, a balanced tree.' },
    { t: 'O(n)', d: 'One pass. The target for most interview answers.' },
    { t: 'O(n log n)', d: 'Sorting. Usually acceptable, and often the honest bound.' },
    { t: 'O(n squared)', d: 'Nested loops over the same data. What you are being tested for noticing.' },
    { t: 'Amortised', d: 'Average over many operations, even when one is occasionally expensive.' },
    { t: 'Hash map', d: 'Constant time lookup by key. The single most useful structure in these interviews.' },
    { t: 'Heap', d: 'Cheap access to the smallest or largest. The answer whenever you hear "top k".' },
    { t: 'Two pointers', d: 'Two indices moving through sorted data, avoiding a nested loop.' },
    { t: 'Sliding window', d: 'A range that moves, with totals updated rather than recomputed.' },
    { t: 'Prefix sum', d: 'Cumulative totals, so any range sum becomes one subtraction.' },
    { t: 'Breadth first search', d: 'Explore a graph level by level. Shortest path on unweighted edges.' },
    { t: 'STAR', d: 'Situation, Task, Action, Result. The structure for a behavioural answer.' },
    { t: 'Practical exercise', d: 'A real task in a small codebase. What payments companies increasingly set instead of puzzles.' }
  ],

  quiz: [
    { q: "Matching two 8,000 row files by reference took 8,528.3 ms with nested loops and 7.0 ms with a dictionary. At a million rows, roughly what happens?",
      options: [
        "The nested version would take around 36 hours while the indexed one stays under a second",
        "Both grow by the same factor",
        "Neither is usable",
        "The nested version becomes about 125 times slower"
      ],
      answer: 0,
      why: "Quadratic growth against linear. This is why \"use a dictionary\" is the expected answer, said early." },

    { q: "Four times the rows made the nested version 45 times slower rather than 16. Why?",
      options: [
        "Memory: at the smaller size the data still fits in cache, so each comparison also got more expensive",
        "Because the algorithm is cubic",
        "Garbage collection",
        "The measurement was wrong"
      ],
      answer: 0,
      why: "Complexity describes growth in operations. Constant factors move too, and usually in the wrong direction." },

    { q: "Which of these is a change of complexity class rather than a constant factor improvement?",
      options: [
        "Using a faster JSON library",
        "Sorting 200,000 items against using a heap for the top 10",
        "String += in a loop against \"\".join(...)",
        "Checking membership in a list against a set"
      ],
      answer: 3,
      why: "Measured at 100,000 known references: 19,708.9 ms against 6.82 ms, and the gap grows with the data." },

    { q: "Grouping 200,000 payments by merchant: filtering once per merchant took 9,527.8 ms, one pass took 59.1 ms. What is the pattern name?",
      options: [
        "Sliding window",
        "Two pointers",
        "Hash map, one pass building a dictionary of lists",
        "Prefix sums"
      ],
      answer: 2,
      why: "Filtering per key is a nested loop wearing a comprehension. 161x, and it grows." },

    { q: "\"The ten largest refunds today, from a stream you cannot store.\" Which pattern?",
      options: [
        "Sorting",
        "A heap",
        "Prefix sums",
        "Intervals"
      ],
      answer: 1,
      why: "Whenever you hear \"top k\", especially over a stream, the answer starts with a heap." },

    { q: "\"The highest total any merchant took in a rolling 24 hours.\" Which pattern?",
      options: [
        "Hash map counting",
        "Two pointers",
        "Sliding window",
        "Graph traversal"
      ],
      answer: 2,
      why: "\"In any period of\" and \"consecutive\" are the tells. Update the total rather than recomputing it." },

    { q: "Which step do candidates skip most often, and interviewers weight most heavily?",
      options: [
        "Asking about edge cases",
        "Writing tests",
        "Optimising the solution",
        "Stating the approach and its complexity before writing any code"
      ],
      answer: 3,
      why: "One sentence before you type tells the interviewer most of what the hour was going to reveal." },

    { q: "You are stuck five minutes in. What is the best move?",
      options: [
        "Start writing code and hope",
        "Say the brute force out loud, try a tiny example, or ask whether sorting the input would help",
        "Think silently until you have it",
        "Ask for a different question"
      ],
      answer: 1,
      why: "Silence reads as lost. One of those three almost always moves the problem forward." },

    { q: "A working slow solution against an unfinished fast one. Which scores better?",
      options: [
        "It depends on the company",
        "The unfinished fast one, because it shows ambition",
        "The working slow one, said aloud to be slow, then improved",
        "They score the same"
      ],
      answer: 2,
      why: "Get correct first, name what is slow, then improve. Many loops score whether you arrived, not how directly." },

    { q: "In a practical exercise, what should you do in the first five minutes?",
      options: [
        "Start writing the fix",
        "Plan the change in full",
        "Run the tests, so you have a working baseline and find a broken setup early",
        "Read the whole codebase"
      ],
      answer: 2,
      why: "A working baseline tells you more than an hour of reading, and setup problems are worth finding at minute two." },

    { q: "At minute seventy of a ninety minute exercise you find your approach cannot handle a required case. Best response?",
      options: [
        "Start again with the correct design",
        "Commit what works, then write a note saying what breaks, why, and what you would do with another hour",
        "Hack around it so everything appears to pass",
        "Stop and submit nothing"
      ],
      answer: 1,
      why: "Reviewers score that above a rushed rewrite, because it is what they want a colleague to do on a Friday." },

    { q: "Why does reformatting a file while fixing a bug count against you?",
      options: [
        "It does not matter",
        "Because formatters disagree",
        "It is slower",
        "Because it buries the actual change and ignores the conventions of the codebase you are joining"
      ],
      answer: 3,
      why: "Matching the style you find is a signal about working with people, which is what the exercise is for." },

    { q: "What makes a good failure story in a behavioural round?",
      options: [
        "A failure caused by somebody else",
        "That you noticed it, told somebody, fixed it, and changed something so it could not recur",
        "A small mistake with no consequences",
        "A strength disguised as a weakness"
      ],
      answer: 1,
      why: "In fintech this round often decides the offer, because the domain punishes people who hide mistakes." },

    { q: "Why rehearse out loud with a person rather than only solving problems?",
      options: [
        "Because explaining while writing uses a different skill from writing silently, and the first attempt must not be in an interview",
        "To build a network",
        "Because it is faster",
        "To get feedback on your solutions"
      ],
      answer: 0,
      why: "The value is in the talking. A friend on a call is enough." },

    { q: "What is the most useful thing to do with a problem you failed under time?",
      options: [
        "Put it on a redo list with the date and attempt it again a week later",
        "Read the model solution and consider it learned",
        "Move on to a new problem",
        "Solve it untimed until it is comfortable"
      ],
      answer: 0,
      why: "Repetition on what you got wrong is worth ten fresh problems, and the list is what keeps it targeted." }
  ],

  project: {
    title: 'interview-gauntlet: forty problems, four exercises, one honest log',
    story: 'A repository that is a record of practice rather than a product. Forty problems solved with tests and ' +
           'complexities, the five measured complexity comparisons reproduced on your own machine, four timed practical ' +
           'exercises with submission notes, five behavioural stories, and a log honest enough to be useful.',
    scope: 'Six weeks part time, following the schedule. The log is the deliverable that makes it real, and it is the ' +
           'only part that cannot be faked by copying solutions.',
    requirements: [
      'Your own timings for the reconciliation, at three sizes, with the growth ratio between them',
      'The four other complexity comparisons reproduced, each labelled as a class change or a constant factor',
      'Forty problems from the list, one file each, with a test, a stated time and space complexity, and a named pattern',
      'A note in each file recording your first instinct, especially when it was wrong',
      'A log of every attempt: date, time taken, and outcome as solved, solved with a self hint, or failed',
      'A `redo.md` of failed problems with dates, and evidence that you returned to them a week later',
      'At least five problems solved a second time under thirty minutes, narrating aloud, with one recording kept',
      'Four practical exercises built and completed under time, each with a submission note saying what you skipped and what you would do next',
      'The API integration exercise must include a timeout, backoff with jitter, and a test proving the retry is safe',
      'Five behavioural stories in STAR form, each with a number in it and a change you made afterwards',
      'Two mock interviews with a person, with the feedback written down and the two fixes you made',
      'A one page summary of your weakest pattern and what you did about it',
      'The repository public on GitHub as `interview-gauntlet`'
    ],
    starter: {
      lang: 'python',
      code: '"""FinQuest level 19: one file per problem, this shape every time.\n\nProblem: duplicate references in a settlement file\nPattern: hash map counting\nTime:    O(n)\nSpace:   O(n)\nFirst instinct: sort then scan for neighbours, O(n log n) for no gain.\nTime taken: 11 minutes.  Outcome: solved.\n"""\nfrom collections import Counter\n\n\ndef duplicate_references(rows: list[dict]) -> list[str]:\n    """References appearing more than once, in first seen order."""\n    counts = Counter(r["reference"] for r in rows)\n    seen, out = set(), []\n    for r in rows:\n        ref = r["reference"]\n        if counts[ref] > 1 and ref not in seen:\n            seen.add(ref)\n            out.append(ref)\n    return out\n\n\ndef test_duplicate_references():\n    rows = [{"reference": "A"}, {"reference": "B"}, {"reference": "A"}]\n    assert duplicate_references(rows) == ["A"]\n\n\ndef test_empty():\n    assert duplicate_references([]) == []\n'
    },
    tests: [
      'Every problem file has a test that passes',
      'Every problem file states a time and a space complexity',
      'Every problem file names one of the eight patterns',
      'The log has an entry for every attempt, including the failures',
      'Every problem on the redo list has at least two dated attempts',
      'The API integration exercise sets a timeout on every call',
      'The API integration exercise retries with backoff and jitter, and the retry is proven safe by a test',
      'Each practical exercise has a submission note naming what was skipped',
      'Each behavioural story contains a number and a change made afterwards'
    ],
    rubric: [
      { pts: 20, t: 'Complexity felt, not recited', d: 'Your own timings at several sizes, with class changes distinguished from constant factors.' },
      { pts: 30, t: 'Forty problems', d: 'Tests, complexities, named patterns, and the first instinct recorded even when wrong.' },
      { pts: 20, t: 'An honest log', d: 'Every attempt with time and outcome, a redo list, and evidence of returning to failures.' },
      { pts: 20, t: 'Practical exercises', d: 'Four completed under time, with failure handling in the integration one and a submission note on each.' },
      { pts: 10, t: 'The spoken half', d: 'Five stories with numbers, one recording of yourself, and two mock interviews with written feedback.' }
    ],
    stretch: [
      'Solve ten of the problems in Java as well, and compare how long the same idea takes to express',
      'Build a small timing script that plots your solution against input size, so the complexity is visible rather than asserted',
      'Write the interviewer\'s rubric for five of your problems: what would earn a strong hire, and what would earn a no',
      'Run a mock loop for somebody else, which teaches you more about scoring than being interviewed does',
      'Take one failed problem and write up the three approaches you tried and why each did not work'
    ],
    solutionPath: 'solutions/level-19'
  },

  faq: [
    { q: 'How many problems do I actually need?',
      a: 'Forty solved properly, with twenty of them revisited, beats three hundred skimmed. The signal you are ready is naming the pattern from the question within the first minute, which usually arrives somewhere between thirty and sixty problems if you are recording what you got wrong.' },
    { q: 'Should I memorise solutions?',
      a: 'Memorise the eight patterns and the shape of each, not the solutions. Interviewers ask follow up questions, and a memorised answer collapses at the first variation, which is worse than not having seen the problem.' },
    { q: 'What if I freeze?',
      a: 'Say so, plainly: "I have gone blank for a second, let me go back to the brute force." It is a normal thing to say and it restarts you. Interviewers have all done it themselves and none of them mark it down; a long silence they have to interpret is worse.' },
    { q: 'Is it acceptable to look things up?',
      a: 'Ask. In a practical exercise it is usually expected, because it is what the job is. In an algorithm screen, syntax is generally fine to ask about and looking up the approach is not. Asking the question costs nothing and removes the doubt.' },
    { q: 'How do I answer "what is your weakness" without being fake?',
      a: 'Pick a real one that is not central to the job, say what it costs, and say what you do about it. "I go too deep on a problem before checking it is the right problem, so I now write down what I am trying to achieve before starting and check it after an hour" is honest, specific and finished.' },
    { q: 'I have applied to twenty places and heard nothing',
      a: 'That is normal and it is mostly about the application rather than about you. Referrals outperform applications by a large margin, so ask people who already work there, which is exactly what a public repository of measured projects is for. And apply to the companies one tier below your target as well, because two years at a smaller payments company makes the next application a different conversation.' },
    { q: 'What do I say about this project in an interview?',
      a: 'It is the one project you do not lead with, because it is preparation rather than engineering. If it comes up, the honest version is good: you kept a log of every attempt including the failures, you returned to the ones you got wrong, and you can name your weakest pattern and what you did about it. That answer says something real about how you learn.' }
  ]
});
