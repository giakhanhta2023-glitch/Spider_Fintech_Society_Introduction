<img src="assets/img/finquest-logo.svg" alt="" width="104" height="104" align="left">

# FinQuest, a fintech training arcade

A ten level fintech course built around projects that runs in a browser tab. Each level teaches the
knowledge, walks you through the tools step by step, drills you with 15 questions, then hands you a
build you can finish using **only what that level taught you**: with a complete, verified solution
key waiting in this repository.

### **[Open the course →](https://finquest-rank-nullity.vercel.app)**

Built for the Spider Fintech Society. Sign in with Google and your progress follows you to any
device. The address above is the only one to share: Vercel also keeps a private URL per deployment,
and those are snapshots of older builds rather than the live site.

> **Level 1 installs nothing.** No VS Code, no PATH variables, no `pip`. You will be running Python
> in a browser tab about ten minutes after you start. A local editor only appears in level 9, when
> you have something worth deploying and the setup finally pays for itself.

---

## Where it lives

| | Address | For |
|---|---|---|
| **The site** | [finquest-rank-nullity.vercel.app](https://finquest-rank-nullity.vercel.app) | your members. Share this one |
| Per deployment | `finquest-<hash>-rank-nullity.vercel.app` | a snapshot of one build, kept private |
| Your machine | `http://localhost:8000` | editing the course, after `python serve.py` |

## Run it locally

```bash
python serve.py
```

There is no build step and no `npm install` for the site itself: the interface is React loaded from a
CDN import map, styled by one hand written stylesheet, and the curriculum is plain JavaScript data
files.

`serve.py` is `http.server` with caching switched off. Use it while you are editing: browsers hold
ES modules in memory, so with a normal static server your changes can appear to do nothing until you
force a reload with <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd>.

Locally there is no backend, so the course skips the sign in and keeps progress in `localStorage`, as
it did before accounts existed. Nothing syncs, because there is nowhere to sync to.

**Deploying it** needs Vercel, because accounts and the tutor run as `api/*.js` functions. Import the
repo, then set the environment variables listed under [Accounts](docs/accounts-setup.md). A purely
static host such as GitHub Pages will serve the course but cannot run sign in, saved progress, or the
model backed tutor.

---

## The ten levels

| # | Level | You build | New tools |
|---|-------|-----------|-----------|
| 1 | Fintech orientation | *(setup mission)* a working lab | Colab, GitHub |
| 2 | The time value of money | Compound growth engine | functions, loops, f-strings |
| 3 | Reading the money | Personal spending analyzer | pandas, matplotlib |
| 4 | Payments and the double-entry ledger | Mini ledger and payment engine | classes, exceptions |
| 5 | Market data and APIs | Portfolio valuation in several currencies | requests, JSON, caching |
| 6 | Credit, loans and amortization | Loan and early payoff simulator | bisection, scenario modelling |
| 7 | Risk and return | Portfolio risk dashboard | numpy, volatility, drawdown |
| 8 | Fraud detection and decision thresholds | Fraud scoring engine | scikit-learn, precision and recall |
| 9 | Shipping a fintech service | A loan advisor anyone can open | Streamlit, pytest, deployment |
| 10 | Compliance, architecture and the capstone | NeoBank analytics platform | packages, reconciliation |

Difficulty climbs from 1/10 to 10/10. A level is cleared when you pass its drill **and** mark its
build complete; that unlocks the next one.

## How a level works

1. **Learn**: the concepts, with worked numbers and the reasoning behind them. Sections end with a
   **your turn** question you answer in your head before the answer is revealed, so you find out
   whether you followed before the drill tells you.
2. **Tutorial**: steps you follow along with. Every tool the build needs is introduced here and
   nowhere else.
3. **Drill**: 15 questions, instant explanations, and the full answer key at the end, pass or fail.
   You need **12/15** to unlock the build.
4. **Build**: a project scoped to exactly what you know, with requirements, a starter file,
   check values, and a marking rubric.
5. **Compare**: read the solution key in [`solutions/`](solutions/) *after* you have written yours.

What a knowledge section has to do, and the five moves it makes, is written down in
[docs/teaching-guide.md](docs/teaching-guide.md). All ten levels are written to it: 76 **your turn**
questions across the course, each one worked on the same figures the level teaches.

## Mou and Khanh

Mou is the tutor: a 24 by 24 pixel rabbit who sits behind the **mou** button, or
<kbd>Ctrl</kbd>+<kbd>K</kbd>, and knows which level you are on. Khanh is a bear who is fond of Mou
and keeps her company on the front page. Both are drawn as text, one character per pixel, in
[`assets/js/ui/mou.js`](assets/js/ui/mou.js) and [`bear.js`](assets/js/ui/bear.js), so a mood can be
edited by eye:

```
'.....owppwo..owppwo.....'
'....owwwwwwwwwwwwwwo....'
```

They blink on their own timers and Khanh grins at Mou every few seconds, all of which stops if the
reader has asked for reduced motion.

| Tutor mode | Setup | What you get |
|------|-------|--------------|
| **Course knowledge base** | none. This is the default | Retrieval over all ten levels: concepts, glossary, tutorial steps, error diagnosis, and hints tied to your next unticked requirement |
| **Hosted endpoint** | deploy with `ANTHROPIC_API_KEY` set | Claude, with the current level's material in its system prompt |
| **Your own key** | paste it in the tutor's settings | Same, straight from your browser. Never do this on a shared computer |

The tutor is built to **nudge, not to hand over answers**: ask it for a hint and it will give you the
next step and point at the tutorial section that covers it. Ask it for the whole solution and it will
tell you where the key lives and why reading it first is a bad trade.

If a model is configured but unreachable, the tutor falls back to the built in knowledge base, so it
never leaves a learner stuck.

---

## Accounts and saved progress

The course sits behind a Google sign in. Google says who the person is, a Neon Postgres database
holds the account and their progress, and a signed cookie keeps them in for thirty days. No password
is ever sent to the site, so none can leak from it.

Progress syncs both ways: what you earn on one device follows you to the next, and signing in after
playing signed out merges the two, keeping the better of each. The full setup, about ten minutes and
free, is in [docs/accounts-setup.md](docs/accounts-setup.md).

```
GET  /api/health          is this deployment wired up
POST /api/auth/google     verify a Google token, create the account, set the cookie
GET  /api/auth/me         who is signed in
POST /api/auth/logout     clear the cookie
GET  /api/progress        the signed in learner's saved state
PUT  /api/progress        replace it
GET  /api/leaderboard     the ranking: a name and two numbers per member
POST /api/chat            the tutor
```

`/api/health` is the first thing to check when something is wrong: it reports which environment
variables are present and whether the database answers, without returning a single value.

---

## What is in this repository

```
index.html              the app shell
privacy.html            the two pages Google requires before publishing a sign in
terms.html
assets/css/app.css      every visual decision, built on tokens declared at the top
assets/img/             the ribbon monogram and the link preview card, both generated in tools/
assets/js/
  config.js             repo, XP economy, pass mark, Google client id: edit this first
  core.js               curriculum registry, markdown subset, syntax highlighting
  storage.js            progress, XP, badges, and the merge that runs on sign in
  ui/
    auth.js             the gate, the Google button, progress syncing
    main.js             masthead, routing, toasts
    level.js            one level: brief, learn, tutorial, drill, build
    quiz.js             the drill and the answer key
    blocks.js           curriculum blocks, including the your turn check
    tutor.js            Mou's panel
    tutor-engine.js     retrieval, prompting, API calls: no UI in this file
    mou.js  bear.js  companions.js     the two sprites and the life in them
content/levels/         the curriculum: ten plain data files, no build step
api/                    serverless functions: auth, progress, ranking, tutor, health
  _lib/                 database, session cookies, log redaction
sql/schema.sql          the two tables, users and progress
data/                   synthetic datasets and the generator that makes them
solutions/              verified solution keys and quiz answer keys, one per level
tools/                  generators for quiz keys, solution readmes, the logo, the link card, and a slop scan
docs/                   architecture, teaching guide, accounts setup
.claude/skills/         the no-ai-slop editing rules, vendored with their licence
```

### Editing the course

The curriculum is data. To change a lesson, edit the matching file in `content/levels/`: each level
is one object with `knowledge`, `tutorial`, `glossary`, `quiz`, `project` and `faq`. Blocks like
`{ p: '...' }`, `{ code: '...', lang: 'python' }`, `{ warn: '...' }`, `{ table: { head, rows } }` and
`{ check: { q, a } }` render themselves.

After editing, regenerate the derived files so nothing drifts:

```bash
node tools/build_quiz_keys.js         # solutions/level-XX/quiz-key.md
node tools/build_solution_readmes.js  # solutions/level-XX/README.md
node tools/balance_answers.js --check # answer position distribution per level
python tools/slop_scan.py             # banned words and tired patterns in every word a learner reads
python tools/build_og.py              # assets/img/og-card.png, after a change to the sprites or the palette
```

`tools/balance_answers.js` (without `--check`) rewrites each quiz so the correct answer is spread
evenly across A to D, otherwise a learner can pass by pattern instead of knowledge.
`tools/slop_scan.py` does the mechanical half of the editing rules vendored in
`.claude/skills/no-ai-slop`; the judgement calls stay with a person.

### Pointing it at your own repo

Open `assets/js/config.js` and change:

```js
repo: { owner: 'your-github-username', name: 'your-repo-name', branch: 'main' }
```

Every dataset URL, solution link and `{{RAW}}` reference in the curriculum follows it automatically.
The Google client id lives beside it, in `auth.googleClientId`.

---

## The data is synthetic: all of it

Every CSV and JSON file in `data/` is generated by `data/generate_datasets.py`. No real customer,
account, or market data appears anywhere in this course, and the tickers (`TECHX`, `BANKCO`,
`GOLDF`, `CRYPTOZ`) are fictional. Regenerate them at any time:

```bash
python data/generate_datasets.py
```

The generator is seeded, so the numbers quoted in the level briefs stay stable.

## The solutions are verified, not aspirational

Every solution was executed against these datasets and produces exactly the figures its level brief
quotes. Levels 9 and 10 ship test suites:

```bash
cd solutions/level-09 && pytest -q    # 22 passed
cd solutions/level-10 && pytest -q    # 38 passed
```

If a solution ever disagrees with a brief, the brief is wrong: please open an issue.

---

## Deploying

1. Import this repo into Vercel and connect it in **Settings → Git**, so every push redeploys.
2. Set the environment variables:

| Variable | Needed for | Notes |
|---|---|---|
| `DATABASE_URL` | accounts | the Neon connection string |
| `GOOGLE_CLIENT_ID` | accounts | the same id as in `config.js` |
| `SESSION_SECRET` | accounts | 32 or more random characters |
| `ANTHROPIC_API_KEY` | the tutor | optional: without it the tutor answers offline |
| `ANTHROPIC_WORKSPACE_ID` | the tutor | only if that key is an organization key |
| `FINQUEST_MODEL` | the tutor | default `claude-opus-5` |
| `FINQUEST_EFFORT` | the tutor | default `low` |
| `FINQUEST_MAX_TOKENS` | the tutor | default `2000` |

3. **Settings → Deployment Protection**: Standard Protection keeps the production domain public while
   old, hashed deployment URLs stay private. Turning protection off entirely leaves every past build
   open to anyone holding the link.
4. Redeploy. Environment variables are baked into a build, so a deployment made before you added them
   will not see them.

`api/chat.js` keeps the key server side, chooses the model itself (callers cannot), caps message size
and history, throttles per IP, and returns a readable error rather than a stack trace. It is a
teaching grade proxy: put it behind real authentication before pointing a large public audience at it.

Nothing logged by any function carries a credential: every caught error goes through
`api/_lib/redact.js`, which masks connection strings, API keys, bearer tokens and passwords.

## Built with

- [Radix Themes](https://www.radix-ui.com/themes): used for behaviour only, so tabs, dialogs and
  focus handling are accessible by default. Every visual decision lives in `assets/css/app.css`
- React 19 and [htm](https://github.com/developit/htm), loaded from a CDN import map so there is no
  build step for the site
- [Neon](https://neon.tech) Postgres for accounts and progress, Google Identity Services for sign in
- pandas, numpy, scikit-learn, matplotlib and Streamlit in the curriculum itself

## Privacy

Signing in stores four things Google returns (name, email, avatar URL, account id) plus your course
progress. No password, no analytics, no advertising, no trackers, and one cookie, which exists to
keep you signed in. What you type to the tutor goes to Anthropic to be answered and is not stored.
The full statement is at [privacy.html](privacy.html), served at `/privacy`.

## A note on scope

This is educational material. It teaches how financial products are built, not what to do with your
money. Nothing here is financial advice, and the fraud and credit models are simplified teaching
examples rather than production systems. The levels say so where it matters.

## Licence

MIT: see [LICENSE](LICENSE). Use it, fork it, teach with it.
