# Where this skill came from

`SKILL.md` and `eval.md` are vendored unchanged from
[petergyang/no-ai-slop](https://github.com/petergyang/no-ai-slop), MIT licensed,
copyright (c) 2026 Peter Yang. The licence sits beside them in `LICENSE`.

## How this project uses it

Every word a learner reads is a draft: level summaries and taglines, knowledge
blocks, tutorial steps, quiz explanations, the tutor's canned answers, the
build briefs, and the README. Run the skill over any of them before shipping.

- **Detect**, to audit without rewriting: `/no-ai-slop detect content/levels/level-04.js`
- **Edit**, to fix a specific draft: `/no-ai-slop` with the passage pasted in

`tools/slop_scan.py` does the mechanical half of a detect pass: it greps the
curriculum, the interface strings and the docs for the skill's banned words and
patterns, and prints file, line and the offending text. The judgement calls
(voice, cadence, whether a phrase earns its place) stay with the skill itself.

Two house rules already overlap with it, and the skill does not override them:
no long dashes anywhere, and sentence case except for the first word and proper
nouns.
