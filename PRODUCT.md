# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Any student who finds the link. The course is public and needs no affiliation: the Spider Fintech
Society is where it came from, not a gate in front of it.

Two audiences arrive by different doors and never mix ladders:

- Computer science students, and anybody who wants to build the systems, on the engineering track.
- Finance students who want the tech half of the job, on the analyst track. It assumes a
  spreadsheet and assumes nothing else.

They are working alone, self-paced, usually with no fintech job yet and nothing in a portfolio that
proves they can be trusted with money.

## Product Purpose

Teach fintech by building it. Each level teaches the ideas, walks through the tools step by step,
drills fifteen questions, then hands over a project scoped to exactly what that level taught. A
complete worked solution waits in the repository for after the student has written theirs.

Success is the artifacts. A student finishes with real repositories they can show: an exact Money
library, a ledger in Postgres, an HTTP payments API, a reconciliation engine, a three statement
model that ties. Not a certificate, not a score.

## Positioning

- **The build never needs a tool the level did not teach.** The tutorial introduces every tool the
  build requires, and nothing is introduced anywhere else.
- **Nothing to install to start.** No editor, no PATH, no `pip`. Python runs in a browser tab about
  ten minutes in. Later engineering levels leave the browser on purpose, once that is the lesson.
- **Every number the course publishes was produced by running code in this repository**, and the
  repository carries the tools that keep it that way.
- **The solutions ship with it.** Every level has a complete working solution in `solutions/`,
  readable after the student has tried.

## Operating Context

- A browser tab. Google sign-in carries progress to any device; the sign-in exists for that, not to
  restrict access.
- Deployed at `https://finquest-rank-nullity.vercel.app`. Auth, progress, leaderboard and the tutor
  are serverless functions under `api/`.
- Two ladders with separate ranks and separate ideas of finishing. A student switches between them
  on the front page at any time.
- Later engineering levels move outward into Postgres, HTTP APIs, containers, pipelines, and five
  further languages, because the jobs ask for them.

## Capabilities and Constraints

- 28 level files: 23 on the engineering track (20 numbered, plus 10.1, 10.2 and 20.1, which are
  optional and block nothing) and 5 on the analyst track.
- A level runs brief, learn, tutorial, drill, build. It is cleared by scoring 12 of 15 on the drill
  **and** marking the build complete, which opens the next one.
- 96 `check` blocks across the course, each rendering as a "your turn" question the student answers
  before the answer appears. (`README.md` still says 91; the count has grown.)
- The curriculum is data: `FQ.registerLevel({...})` in `content/levels/*.js`. Block types are `h`,
  `h4`, `p`, `ul`, `ol`, `code`, `tip`, `warn`, `money`, `table`, `check`.
- All text passes through `FQ.md()`, which supports `**bold**`, `*em*` and `[text](url)` only.
  Underscores are literal.
- No build step. Plain scripts plus React, htm and Radix through an import map. No Tailwind, and no
  bundler to add one.
- Every script and stylesheet reference in `index.html` is content-hashed by
  `tools/stamp_cache.mjs`, so a reader is never served a stale lesson.
- The merge gate: `node --check`, `tools/check_markup.mjs`, `tools/slop_scan.py`,
  `tools/balance_answers.js`, `tools/check_asides.mjs`, `tools/check_contrast.py`,
  `tools/check_palettes.py`, `tools/stamp_cache.mjs --check`.
- Datasets are synthetic. No real personal or financial data is committed, ever.
- No API keys in the repository, environment variables only. The serverless tutor keeps its key
  server-side and callers cannot choose the model.

## Brand Commitments

- The name is FinQuest. The wordmark is F(q) (`assets/img/brand/fq-logo.png`). Mou, a rabbit, is
  both the in-product tutor and the mascot (`assets/img/brand/mou-logo.png`).
- Built for the Spider Fintech Society, and it says so.
- Voice: sentence case except the first word and proper nouns. No em dashes or en dashes anywhere.
  No `&` in prose. No AI-slop phrasing, enforced mechanically by `tools/slop_scan.py` rather than by
  taste.
- Any role, rank or outcome named on a surface must match what the course actually delivers, as
  recorded in `content/tracks.js`.

## Evidence on Hand

- Complete worked solutions for every level, in `solutions/`.
- Figures verified by running the course's own code, and safe to publish: 400,000 ledger entries
  balanced and an account balance returned in 0.106 ms (level 6); 16,639 settlement lines with every
  difference explained (level 10); `allocate(1000, [1, 1, 1])` returning `[334, 333, 333]`.
- Brand assets in `assets/img/brand/`, plus `og-card.png` and the favicon set.
- A launch video and poster in `brag-output/`.
- There are no testimonials, no enrollment figures, no completion rates and no outcome statistics.
  None exist. Future work must not invent them.

## Product Principles

1. A build never needs a tool the level did not teach.
2. Every published number is produced by running code in this repository, before it is published.
3. Nothing to install to start, until installing something is itself the lesson.
4. Names promise only what the course delivers. A grander title than the ladder reaches is a lie.
5. The student leaves with artifacts, not a score.

## Accessibility & Inclusion

- WCAG AA contrast is a merge requirement, not an aspiration: 4.5:1 for body text and 3:1 for large
  text (24px and up, or 18.66px and up when bold). `tools/check_contrast.py` checks the declared
  palettes and `tools/contrast-probe.js` measures the rendered page, compositing every translucent
  layer, in both themes.
- Light and dark themes both ship, resolved before first paint.
- The progress store fails soft in private mode rather than breaking the page.
