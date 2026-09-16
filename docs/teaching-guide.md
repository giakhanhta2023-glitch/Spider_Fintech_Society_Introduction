# Running FinQuest as a society course

FinQuest works as self-study, but it was built for a cohort. This is how to run one.

## A ten-week shape

| Week | Level | Session focus |
|------|-------|---------------|
| 1 | 1 | Lab setup together, in the room. Nobody leaves without a notebook on GitHub. |
| 2 | 2 | Compounding. Show the 30-year mortgage total before the formula. |
| 3 | 3 | pandas. Bring a volunteer's own (anonymised) bank export if anyone offers. |
| 4 | 4 | The ledger. Run the "retry the payment" demo live. |
| 5 | 5 | APIs. Kill the wifi mid-demo on purpose and let the fallback save you. |
| 6 | 6 | Lending. Ask the room to guess the total interest before revealing it. |
| 7 | 7 | Risk. Show the asset with the best return and the worst drawdown. |
| 8 | 8 | Fraud. Run the threshold slider in front of them and argue about the cost. |
| 9 | 9 | Deploy day. Everyone ends the session with a live URL. |
| 10 | 10 | Capstone kickoff, then two weeks of build time and a demo evening. |

Levels 1-8 are roughly 1.5-3 hours each; 9 and 10 need a fortnight between them.

## Session structure that works

- **15 min**: recap last week's build. One member demos, warts included.
- **30 min**: walk the Learn tab on a projector. Skip what they can read; teach what they cannot.
- **40 min**: everyone works the Tutorial in their own Colab. You circulate.
- **10 min**: the drill, live. Show the answer key and argue about the near-misses.
- **remainder**: start the build together so nobody leaves on a blank page.

## The drill is a teaching tool, not a gate

Every question has an explanation written to be read aloud. When the room splits on an answer, that
question is the lesson. The pass mark (12/15) exists to stop people skipping to the build, not to
rank anyone, re-running a drill can only raise a score.

## Marking builds

Each project ships a rubric in its brief, totalling 100. Two things are worth more attention than the
points suggest:

- **Did it run for someone else?** Clone it, follow the README, and see.
- **Did they state a limitation?** A student who writes "this ledger is single-process" understands
  more than one who claims it is production-ready.

Use the self-check values in each brief before reading any code: if the numbers match, the logic is
almost certainly right, and you can spend your time on structure and communication instead.

## Keeping the solution keys honest

Tell people the keys exist on day one: hiding them just moves the copying somewhere you cannot see.
The rule that works: **attempt, hint, read the stuck part only, retype from memory**. The tutor is
built to support exactly that order and will refuse to dump a full solution.

## Adapting it

- **Shorter course?** Levels 1-4 and 9 make a coherent five-week "build and ship" track.
- **Analytics-only?** Levels 1, 3, 7, 8 skip the payments engineering entirely.
- **Different region?** The currencies, categories and merchant names live in
  `data/generate_datasets.py`; regenerate and the briefs' expected values update with them
  (remember to refresh the numbers quoted in the level files too).
- **Your own branding?** `assets/js/config.js` for the repo and XP economy; the `accentColor` on the
  `<Theme>` in `assets/js/ui/main.js` for the palette.

## Before the first session

- [ ] Fork the repo and set `repo` in `assets/js/config.js` to your fork
- [ ] Deploy it (GitHub Pages is enough) and share one link
- [ ] Decide whether you are running the AI tutor with a key, or leaving the offline tutor on
- [ ] Run `python data/generate_datasets.py` once and confirm the datasets load
- [ ] Do level 1 yourself, on the wifi your members will actually be using
