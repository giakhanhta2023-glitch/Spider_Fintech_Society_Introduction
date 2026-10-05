<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/img/brand/fq-logo.png">
  <img src="assets/img/brand/fq-logo-ink.png" alt="FinQuest F(q) logo" width="360">
</picture>

# FinQuest

Learn fintech by building it. Every level teaches the ideas, walks you through the tools step by
step, drills you with 15 questions, then hands you something to build using **only what that level
taught you**. A complete, working solution waits in this repository for after you have written
yours.

### **[Open the course →](https://finquest-rank-nullity.vercel.app)**

Built for the Spider Fintech Society. Sign in with Google and your progress follows you to any
device.

> **Nothing to install to start.** No VS Code, no PATH variables, no `pip`. You will be running
> Python in a browser tab about ten minutes in.

---

## Two tracks

Pick the one that matches the job you want. They are separate ladders with separate ranks, and you
can switch between them on the front page at any time.

### The engineering track

Twenty levels, from a first ledger to a payments platform that survives an hour of load and four
injected failures. For computer science students and anybody who wants to build the systems.

| # | Level | You build |
|---|-------|-----------|
| 1 | Fintech orientation | a working lab, and the vocabulary |
| 2 | The time value of money | a compound growth engine |
| 3 | Reading the money | a personal spending analyser |
| 4 | Payments and the double-entry ledger | a mini ledger and payment engine |
| 5 | The money library everything else imports | an exact Money library, tested and packaged |
| 6 | The ledger in Postgres | a schema, measured with `EXPLAIN` |
| 7 | The payments API other systems depend on | an HTTP API over the ledger |
| 8 | Eight requests, one balance, minus $540 | a race reproduced, then fixed three ways |
| 9 | The life of a card payment | a card lifecycle service and network simulator |
| 10 | The processor says one thing, your ledger says another | a reconciliation engine |
| 10.1 | The half of the payment the customer can see | a typed checkout that cannot be talked into charging the wrong amount |
| 10.2 | Scala, and the job that runs at four in the morning | the same reconciliation as level 10, agreeing with it to the cent |
| 11 | The event you thought you published | an outbox, idempotent consumers, partitioning |
| 12 | The payout that half happened | a saga with compensation and a sweeper |
| 13 | The table that outgrew the machine | partition it, migrate it, backfill it live |
| 14 | The p99 you promised | measure the tail, then cache, limit and shed |
| 15 | The keys to the money | a card vault with envelope encryption |
| 16 | The pager, and what it is allowed to wake you for | instrument it, then break it on purpose |
| 17 | The deploy you can undo | container, pipeline, infrastructure, blue green |
| 18 | Java, for somebody who already writes Python | port the payments API to Spring Boot, and one component in Go |
| 19 | The screen that filters you out | forty problems, four exercises, an honest log |
| 20 | The whiteboard, and the thing you hand over | the platform assembled, load tested, packaged |
| 20.1 | Ruby, and the rules that change every week | a refund policy a risk lead can read, as a small language of its own |

**The decimal levels are asides rather than rungs,** and they are marked *optional* in the course
itself. 10.1 is the only TypeScript, 10.2 the only Scala, 20.1 the only Ruby. They exist because
the postings this track aims at ask for those languages: Stripe's own listing says they work
mostly in Java, Ruby, JavaScript, Scala and Go. None of them blocks anything, so level 11 opens
on level 10 and the track still ends at 20.

### The analyst track

Five levels for finance students who want the tech half of the job. It assumes you can use a
spreadsheet and assumes nothing else.

| # | Level | You build |
|---|-------|-----------|
| 1 | Mission zero: a lab that works | somewhere to run code, and an account to keep it in |
| 2 | SQL for the month end close | the queries finance asks every month, written once |
| 3 | The part you used to do by hand | the same pack, from the same files, in milliseconds |
| 4 | A model that ties | a three statement model that balances, with the circularity resolved |
| 5 | The pack that rebuilds itself | a reporting pack that regenerates from raw data |

Ends at a corporate finance or planning analyst job, where automating your own reporting is the
thing that gets noticed.

---

## How a level works

1. **Brief**: what you are about to build, what it assumes, and what is new.
2. **Learn**: the ideas, with real numbers worked through and the reasoning behind them. Sections
   end with a **your turn** question you answer in your head before the answer appears, so you find
   out whether you followed before the drill tells you. There are 91 of them across the course.
3. **Tutorial**: steps you follow along with. Every tool the build needs is introduced here and
   nowhere else.
4. **Drill**: 15 questions with instant explanations. **12 out of 15** opens the build.
5. **Build**: a project scoped to exactly what you know, with requirements, a starter file, check
   values you can test against, and a marking rubric.

A level is cleared when you pass its drill **and** mark its build complete. That opens the next one.

### What you need

Levels 1 to 4 of the engineering track, and the whole analyst track, run in a browser tab. There is
nothing to install and nothing to configure.

From **level 5** onward you work on your own machine, because the subject becomes packaging, a real
database, containers and deployment, and those cannot be faked in a notebook. Level 5 walks you
through that setup from scratch.

---

## Mou

Mou is the tutor: a pixel rabbit behind the **mou** button, or <kbd>Ctrl</kbd>+<kbd>K</kbd>, who
knows which level you are on and which requirement you have not ticked yet.

She is built to **nudge rather than hand over answers**. Ask for a hint and you get the next step
and a pointer at the tutorial section that covers it. Ask for the whole solution and she will tell
you where the key lives and why reading it first is a bad trade.

If no model is configured or reachable, she falls back to a search over the course material, so she
never leaves you stuck.

---

## The solutions

Every solution in [`solutions/`](solutions/) was executed and produces exactly the figures its level
brief quotes. They are not sketches, and they are not aspirational: if a solution ever disagrees
with a brief, the brief is wrong, so please open an issue.

Each one has a README explaining the design decisions, the mistakes people actually make, and how to
run it.

**Read yours into existence first.** The solution is for comparing against, and the comparison is
where most of the learning is: you will find three things you did differently and one of them will
be better than the key. Opening it before you have written anything turns a build into a reading
exercise, and you will feel like you understood it right up until the next level.

---

## Progress, and the ranking

Signing in stores four things Google returns (name, email, avatar, account id) plus your course
progress. No password is ever sent to the site, so none can leak from it. One cookie, which exists
to keep you signed in. No analytics, no advertising, no trackers.

Progress syncs both ways, so what you earn on one device follows you to the next, and signing in
after playing signed out merges the two and keeps the better of each.

The ranking page lists society members by levels cleared. It covers the engineering track only.

What you type to Mou goes to Anthropic to be answered and is not stored. The full statement is at
[privacy.html](privacy.html).

---

## The data is synthetic, all of it

Every dataset in the course is generated. No real customer, account or market data appears anywhere,
and the companies and tickers are invented. You can regenerate the lot at any time, and the
generator is seeded, so the numbers in the briefs stay the same as the numbers on your screen.

## A note on scope

This is educational material. It teaches how financial products are built, not what to do with your
money. Nothing here is financial advice, and the fraud and credit models are simplified teaching
examples rather than production systems. The levels say so where it matters.

## Licence

MIT: see [LICENSE](LICENSE). Use it, fork it, teach with it.

---

*Running the site or editing the course? Everything for that is in
[docs/maintaining.md](docs/maintaining.md).*
