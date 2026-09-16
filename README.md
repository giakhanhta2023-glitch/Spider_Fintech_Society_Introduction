# FinQuest: a fintech training arcade

A ten-level, project-based fintech course that runs in a browser tab. Each level teaches the
knowledge, walks you through the tools hands-on, drills you with 15 questions, then hands you a
build you can finish using **only what that level taught you**: with a complete, verified solution
key waiting in this repository.

Built for the Spider Fintech Society.

> **Level 1 installs nothing.** No VS Code, no PATH variables, no `pip`. You will be running Python
> in a browser tab about ten minutes after you start. A local editor only appears in Level 9, when
> you have something worth deploying and the setup finally pays for itself.

---

## Run it

**Option 1: open it** (any static host, or locally):

```bash
python -m http.server 8000
```

Then visit <http://localhost:8000>. There is no build step and no `npm install`: the interface is
React + Radix Themes loaded from a CDN import map, and the curriculum is plain JavaScript data files.

**Option 2: GitHub Pages:** Settings → Pages → deploy from `main` / root. It works as-is.

**Option 3: Vercel:** import the repo. The static site deploys, and `api/chat.js` becomes the AI
tutor endpoint if you set `ANTHROPIC_API_KEY` in the project's environment variables.

---

## The ten levels

| # | Level | You build | New tools |
|---|-------|-----------|-----------|
| 1 | Fintech Orientation & Your Zero-Install Toolkit | *(setup mission)* a working lab | Colab, GitHub |
| 2 | The Time Value of Money | Compound Growth Engine | functions, loops, f-strings |
| 3 | Reading the Money | Personal Spending Analyzer | pandas, matplotlib |
| 4 | Payments & the Double-Entry Ledger | Mini Ledger & Payment Engine | classes, exceptions |
| 5 | Market Data & APIs | Multi-Currency Portfolio Valuation | requests, JSON, caching |
| 6 | Credit, Loans & Amortization | Loan & Early-Payoff Simulator | bisection, scenario modelling |
| 7 | Risk & Return | Portfolio Risk Dashboard | numpy, volatility, drawdown |
| 8 | Fraud Detection & Decision Thresholds | Fraud Scoring Engine | scikit-learn, precision/recall |
| 9 | Shipping a Fintech Service | Deployed Loan Advisor | Streamlit, pytest, deployment |
| 10 | Compliance, Architecture & the Capstone | NeoBank Analytics platform | packages, reconciliation |

Difficulty climbs from 1/10 to 10/10. A level is cleared when you pass its drill **and** mark its
build complete; that unlocks the next one.

## How a level works

1. **Learn**: the concepts, with worked numbers and the reasoning behind them.
2. **Tutorial**: hands-on steps. Every tool the build needs is introduced here and nowhere else.
3. **Drill**: 15 questions, instant explanations, and the full answer key at the end (pass or fail).
   You need **12/15** to unlock the build.
4. **Build**: a project scoped to exactly what you know, with requirements, a starter file,
   self-check values, and a marking rubric.
5. **Compare**: read the solution key in [`solutions/`](solutions/) *after* you have written yours.

## The AI tutor

Ada sits behind the **Tutor** button (or <kbd>Ctrl</kbd>+<kbd>K</kbd>) and knows which level you are on.

| Mode | Setup | What you get |
|------|-------|--------------|
| **Course knowledge base** | none. This is the default | Retrieval over all ten levels: concepts, glossary, tutorial steps, error diagnosis, and hints tied to your next unticked requirement |
| **Hosted endpoint** | deploy with `ANTHROPIC_API_KEY` set | Claude, with the current level's material in its system prompt |
| **Your own key** | paste it in the tutor's settings | Same, straight from your browser (never do this on a shared computer) |

The tutor is built to **nudge, not to hand over answers**: ask it for a hint and it will give you the
next step and point at the tutorial section that covers it. Ask it for the whole solution and it will
tell you where the key lives and why reading it first is a bad trade.

If a model is configured but unreachable, the tutor silently falls back to the built-in knowledge
base, so it never leaves a learner stuck.

---

## What is in this repository

```
index.html              the whole app shell
assets/css/app.css      a thin layer over Radix tokens
assets/js/
  config.js             repo, XP economy, pass mark, tutor endpoint: edit this first
  core.js               curriculum registry, markdown subset, syntax highlighting
  storage.js            progress, XP, badges (localStorage)
  ui/                   React + Radix Themes interface
content/levels/         the curriculum: ten plain data files, no build step
data/                   synthetic datasets + the generator that makes them
solutions/              verified solution keys and quiz answer keys, one folder per level
api/chat.js             optional serverless tutor endpoint
tools/                  generators for quiz keys and solution READMEs
```

### Editing the course

The curriculum is data. To change a lesson, edit the matching file in `content/levels/`: each level
is one object with `knowledge`, `tutorial`, `glossary`, `quiz`, `project` and `faq`. Blocks like
`{ p: '...' }`, `{ code: '...', lang: 'python' }`, `{ warn: '...' }` and `{ table: { head, rows } }`
render themselves.

After editing, regenerate the derived files so nothing drifts:

```bash
node tools/build_quiz_keys.js        # solutions/level-XX/quiz-key.md
node tools/build_solution_readmes.js # solutions/level-XX/README.md
node tools/balance_answers.js --check # answer-position distribution per level
```

`tools/balance_answers.js` (without `--check`) rewrites each quiz so the correct answer is spread
evenly across A-D, otherwise a learner can pass by pattern instead of knowledge.

### Pointing it at your own repo

Open `assets/js/config.js` and change:

```js
repo: { owner: 'your-github-username', name: 'your-repo-name', branch: 'main' }
```

Every dataset URL, solution link and `{{RAW}}` reference in the curriculum follows it automatically.

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

## Deploying the AI tutor (optional)

1. Import this repo into Vercel (or any host that runs `api/*.js` as a Node function).
2. Add an environment variable `ANTHROPIC_API_KEY` from
   [console.anthropic.com](https://console.anthropic.com/settings/keys).
3. Deploy. The site picks the endpoint up automatically.

`api/chat.js` keeps the key server-side, chooses the model itself (callers cannot), caps message
size and history, throttles per IP, and returns a readable error rather than a stack trace. It is a
teaching-grade proxy: put it behind real authentication before pointing a large public audience at it.

Optional environment variables: `FINQUEST_MODEL` (default `claude-opus-5`), `FINQUEST_EFFORT`
(default `low`), `FINQUEST_MAX_TOKENS` (default `900`).

## Built with

- [Radix Themes](https://www.radix-ui.com/themes): the component system the whole interface uses
- React 19 and [htm](https://github.com/developit/htm), loaded from a CDN import map so there is no build step
- pandas, numpy, scikit-learn, matplotlib and Streamlit in the curriculum itself

## Progress and privacy

Scores, XP, badges and checklists live in your browser's `localStorage` and never leave the device.
There is no account, no tracking, and no server-side state. Clearing your browser data resets the
course; the **Dossier** page has a deliberate reset button too.

## A note on scope

This is educational material. It teaches how financial products are built, not what to do with your
money. Nothing here is financial advice, and the fraud and credit models are simplified teaching
examples rather than production systems. The levels say so where it matters.

## Licence

MIT: see [LICENSE](LICENSE). Use it, fork it, teach with it.
