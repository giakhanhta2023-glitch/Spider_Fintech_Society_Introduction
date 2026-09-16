# How FinQuest is put together

Three decisions explain most of this codebase.

## 1. The curriculum is data, not code

Each level is one plain object in `content/levels/level-XX.js`:

```js
FQ.registerLevel({
  id: 4,
  codename: 'ledger',
  title: 'Payments and the double-entry ledger',
  knowledge: [ { h: '...' }, { p: '...' }, { code: '...', lang: 'python' }, { warn: '...' } ],
  tutorial: { intro: '...', steps: [ { t: '...', blocks: [...], check: '...' } ] },
  glossary: [ { t: 'Idempotency key', d: '...' } ],
  quiz: [ { q: '...', options: [...], answer: 2, why: '...' } ],
  project: { title, story, scope, requirements, starter, tests, rubric, stretch, solutionPath },
  faq:  [ { q: '...', a: '...' } ]
});
```

Nobody needs to touch a component to fix a lesson, and the same objects feed four consumers:

- the **interface** renders them,
- the **tutor** indexes them for retrieval,
- `tools/build_quiz_keys.js` prints the answer keys in `solutions/`,
- `tools/build_solution_readmes.js` writes each solution walkthrough.

That is why the printed keys cannot drift from what the site actually asks: they are generated from
the same source.

## 2. No build step

`index.html` loads the data layer as classic scripts, then the interface as one ES module:

```
config.js → core.js → storage.js → content/levels/*.js     (plain scripts, global FQ)
assets/js/ui/main.js                                        (ES module, React + Radix)
```

React 19, Radix Themes and htm arrive through an import map pointing at a CDN, so there is no
`npm install`, no bundler, and no `dist/` to keep in sync. `htm` gives JSX-like syntax as a tagged
template, which is what makes component code readable without a compiler:

```js
html`<${Card} size="3" variant="surface">${body}<//>`
```

The trade-off is a runtime dependency on a CDN. If you would rather vendor it, replace the import map
in `index.html` with local copies: nothing else changes.

## 3. app.css owns the design system, Radix owns the behaviour

`assets/css/app.css` holds every visual decision: the type scale, the twelve column grid, the rules
that divide sections, the buttons, tags, tables, code wells, quiz options and the tutor panel. It is
built on a small set of tokens declared once at the top of the file, and the Radix visual layer is
deliberately overridden at the bottom so the component library cannot reintroduce its pill buttons
and rounded panels.

Radix Themes is kept for the parts that are genuinely hard: tab semantics, dialog focus traps,
tooltips and keyboard handling.

The rules the palette is built to:

1. Near-black canvas with a blue cast, bone text. No charcoal grey, no neon.
2. One accent, a single blue, in two weights: `--accent` when blue is text or a mark, and
   `--accent-solid` when blue is a filled surface with white on top.
3. Serif for display and reading, monospace for every label, figure and tag.
4. Structure comes from rules and column spans, never from shadows, glows or rounded panels.
5. Nothing below 12px, nothing under 4.5:1 contrast.

**Colour carries meaning, so the accent is not allowed to eat the semantics.** Each colour has
exactly one job, and success stays green whatever the brand colour becomes:

| Token | Job |
|-------|-----|
| `--accent`, `--accent-solid` | brand, links, buttons, progress, where you currently are |
| `--moss` | a state the learner achieved: correct, passed, cleared, shipped |
| `--crimson` | wrong |
| `--bone`, `--ash`, `--graphite` | the three weights of text, in that order |
| `--rule`, `--rule-mid`, `--rule-heavy` | hairline, section divider, hard stop |

To change the brand colour, edit the four accent tokens in `app.css` and the `accentColor` prop on
the `<Theme>` in `main.js` so the Radix focus ring matches. Never repoint `--moss` or `--crimson`:
the quiz's correct answer, the cleared badges, ticked requirements and the passing score all read
as meaning, not decoration.

## Layers

```
main.js          routing, HUD, toasts, theme        <- knows about everything
  views.js       home, the word list, the progress page
  level.js       one level: brief/learn/tutorial/drill/build
    quiz.js      the drill and the answer key
    blocks.js    curriculum blocks -> editorial elements
  tutor.js       the tutor panel (a dialog pinned to the right edge)
    tutor-engine.js   retrieval, prompting, API calls: no UI in this file
  lib.js         shared imports and small helpers
---------------------------------------------------------------
core.js          registry, markdown subset, syntax highlighting
storage.js       progress, XP, badges, unlock rules
config.js        repo, XP economy, pass mark, tutor endpoint
```

Dependencies point downward only. `tutor-engine.js` imports nothing from the interface, which is why
its retrieval can be tested from a console without rendering anything.

## The tutor's two modes

`tutor-engine.js` builds an index over every knowledge section, glossary entry, FAQ, tutorial step
and project brief in the course. A question is tokenised, scored against that index (title matches
weigh heaviest, the learner's current level is boosted, later levels are penalised so answers do not
spoil them), and the best section is summarised back with a link.

Specific intents are handled before retrieval: greetings, "where do I start", Python error names,
requests for the whole solution (declined, with the reason), and `hint`, which looks up the
learner's first unticked requirement and points at the tutorial step covering it.

If an endpoint or API key is configured, the question goes to Claude instead, with the current
level's material in the system prompt. Any failure (network, timeout, bad key) falls back to the
offline path, so the tutor cannot leave a learner stuck.

## Progress model

`storage.js` holds one object in `localStorage`:

```js
{ xp, levels: { "4": { quizBest, quizPassed, attempts, projectDone, reqs, answers } }, badges }
```

Rules worth knowing:

- a level is **cleared** when its drill is passed *and* its build is marked complete;
- level *n* unlocks when level *n − 1* is cleared;
- re-running a drill can only raise your best score, never lower it;
- XP is awarded once per improvement, not per attempt.

## Adding an eleventh level

1. Copy `content/levels/level-10.js` to `level-11.js` and edit the object (`id: 11`).
2. Add a `<script>` tag for it in `index.html`.
3. Write the solution in `solutions/level-11/`.
4. Add its notes to `NOTES` in `tools/build_solution_readmes.js`, then run both generators.
5. Extend `ranks` in `assets/js/config.js` if you want a new title at the top.

The unlock logic, the level list, the word list, the progress page and the tutor index all pick it up automatically.
