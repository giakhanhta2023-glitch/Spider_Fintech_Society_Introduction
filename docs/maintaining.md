# Maintaining FinQuest

Everything that is not for a learner. The [README](../README.md) is the student document; this is
the one for whoever runs the site and edits the course.

---

## Run it locally

```bash
python serve.py
```

There is no build step and no `npm install` for the site itself: the interface is React loaded from
a CDN import map, styled by one hand written stylesheet, and the curriculum is plain JavaScript data
files.

`serve.py` is `http.server` with caching switched off. Use it while you are editing: browsers hold
ES modules in memory, so with a normal static server your changes can appear to do nothing until you
force a reload with <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd>.

Locally there is no backend, so the course skips the sign in and keeps progress in `localStorage`.
Nothing syncs, because there is nowhere to sync to.

| | Address | For |
|---|---|---|
| **The site** | [finquest-rank-nullity.vercel.app](https://finquest-rank-nullity.vercel.app) | your members. Share this one |
| Per deployment | `finquest-<hash>-rank-nullity.vercel.app` | a snapshot of one build, kept private |
| Your machine | `http://localhost:8000` | editing the course, after `python serve.py` |

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
    mou.js  companions.js   the sprite and the life in it
content/tracks.js       the two ladders, their rank titles and their blurbs
content/levels/         the curriculum: one plain data file per level, no build step
api/                    serverless functions: auth, progress, ranking, tutor, health
  _lib/                 database, session cookies, log redaction
sql/schema.sql          the two tables, users and progress
data/                   synthetic datasets and the generator that makes them
solutions/              verified solution keys and quiz answer keys, one per level
tools/                  generators and checks: quiz keys, solution readmes, answer balance,
                        the aside invariants, the logo, the link card, and a slop scan
docs/                   architecture, teaching guide, accounts setup, this file
.claude/skills/         the no-ai-slop editing rules, vendored with their licence
```

---

## Editing the course

The curriculum is data. To change a lesson, edit the matching file in `content/levels/`: each level
is one object with `knowledge`, `tutorial`, `glossary`, `quiz`, `project` and `faq`. Blocks like
`{ p: '...' }`, `{ code: '...', lang: 'python' }`, `{ warn: '...' }`, `{ table: { head, rows } }` and
`{ check: { q, a } }` render themselves.

What a knowledge section has to do, and the five moves it makes, is in
[teaching-guide.md](teaching-guide.md).

After editing, run the checks and regenerate the derived files so nothing drifts:

```bash
node --check content/levels/level-NN.js   # the file is still valid JavaScript
node tools/check_markup.mjs               # every string renders as written
node tools/check_asides.mjs               # decimal levels do not renumber the ladder
node tools/balance_answers.js --check     # answer position distribution per level
python tools/slop_scan.py                 # banned words and tired patterns
node tools/build_quiz_keys.js             # solutions/level-XX/quiz-key.md
node tools/build_solution_readmes.js      # solutions/level-XX/README.md
python tools/build_brand.py               # og-card.png and the icons
```

`tools/balance_answers.js` without `--check` rewrites each quiz so the correct answer is spread
evenly across A to D, otherwise a learner can pass by pattern instead of knowledge.
`tools/slop_scan.py` does the mechanical half of the editing rules vendored in
`.claude/skills/no-ai-slop`; the judgement calls stay with a person.

### Adding a level in the middle

A level numbered `10.1` sits between 10 and 11 without renumbering anything after it, which matters
because levels cite each other by number constantly. Give it a decimal `id`, a string `position`,
and `aside: true`:

```js
FQ.registerLevel({ id: 10.1, position: '10.1', aside: true, /* ... */ });
```

An aside hangs off the level before it, never stands between two levels of the spine, and is not one
of the twenty rungs the rank titles count. So level 11 still opens on level 10, and clearing an
aside does not make the home page read 11 of 20. The file is named `level-10-1.js` and must be added
to the script tags in `index.html`.

`node tools/check_asides.mjs` asserts all of that against the real `core.js` and `storage.js`. Run
it after touching anything in the registry.

### Pointing it at your own repo

Open `assets/js/config.js` and change:

```js
repo: { owner: 'your-github-username', name: 'your-repo-name', branch: 'main' }
```

Every dataset URL, solution link and `{{RAW}}` reference in the curriculum follows it automatically.
The Google client id lives beside it, in `auth.googleClientId`.

---

## The datasets

Every CSV and JSON file in `data/` is generated by `data/generate_datasets.py`. No real customer,
account or market data appears anywhere, and the tickers (`TECHX`, `BANKCO`, `GOLDF`, `CRYPTOZ`) are
fictional. Regenerate at any time:

```bash
python data/generate_datasets.py
```

The generator is seeded, so the numbers quoted in the level briefs stay stable. If you change the
generator, re-run every solution that reads its output and update the figures the briefs quote.

---

## Deploying

Vercel, because accounts and the tutor run as `api/*.js` functions. A purely static host such as
GitHub Pages will serve the course but cannot run sign in, saved progress, or the model backed
tutor.

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

3. **Settings → Deployment Protection**: Standard Protection keeps the production domain public
   while old, hashed deployment URLs stay private. Turning protection off entirely leaves every past
   build open to anyone holding the link.
4. Redeploy. Environment variables are baked into a build, so a deployment made before you added
   them will not see them.

The full account setup, about ten minutes and free, is in [accounts-setup.md](accounts-setup.md).

### The API

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

`api/chat.js` keeps the key server side, chooses the model itself (callers cannot), caps message
size and history, throttles per IP, and returns a readable error rather than a stack trace. It is a
teaching grade proxy: put it behind real authentication before pointing a large public audience at
it.

Nothing logged by any function carries a credential: every caught error goes through
`api/_lib/redact.js`, which masks connection strings, API keys, bearer tokens and passwords.

### After a deploy

The level files are loaded as plain `<script src>` tags with no version marker, so a tab left open
from before a deploy keeps serving the old lesson until it is hard refreshed. Tell members to reload
after you announce a change, or add a cache busting query to the tags.

---

## Built with

- [Radix Themes](https://www.radix-ui.com/themes): used for behaviour only, so tabs, dialogs and
  focus handling are accessible by default. Every visual decision lives in `assets/css/app.css`
- React 19 and [htm](https://github.com/developit/htm), loaded from a CDN import map so there is no
  build step for the site
- [Neon](https://neon.tech) Postgres for accounts and progress, Google Identity Services for sign in
- pandas, numpy, matplotlib, FastAPI, Postgres, Kafka, Docker, Java and TypeScript in the curriculum
  itself

Further reading: [architecture.md](architecture.md), [teaching-guide.md](teaching-guide.md),
[accounts-setup.md](accounts-setup.md).
