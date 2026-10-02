"""
Scan every word a learner reads for the patterns in .claude/skills/no-ai-slop.

This does the mechanical half of a detect pass: banned words, empty phrases and
the patterns that can be matched with a regex. It prints file, line and the
offending text so each hit can be judged by hand. It does not rewrite anything,
and it cannot judge cadence, voice, or whether a sentence earns its place: that
is what the skill itself is for.

Run from the repository root:  python tools/slop_scan.py
                               python tools/slop_scan.py --counts
"""

import io
import os
import re
import sys

# The solutions are text a learner reads too, so they are scanned with
# everything else rather than being a blind spot the size of the curriculum.
ROOTS = ['content', 'assets/js', 'docs', 'tools', 'solutions']
FILES = ['README.md', 'index.html']
SKIP_DIRS = {'.git', 'node_modules', '__pycache__', '.venv'}

# Words the skill bans outright.
# Terms of art that contain a banned word and are not slop. A rule against
# "leverage our expertise" should not also ban "operating leverage", which is
# the name of a thing in finance and has no synonym worth using. The exception
# is deliberately narrow: the whole phrase, not the word.
ALLOWED_PHRASES = [
    'operating leverage',       # profit moving faster than revenue
    'financial leverage',       # the debt kind
    'leverage ratio',           # the regulatory one
    'unlock rules',             # the name of the gating logic in storage.js
    'unlock logic',             # likewise, in the architecture notes
    'unlock|progress',          # inside the tutor's keyword regex: a learner
                                # may well type "how do I unlock the next one"
]

#
# The second block is merged from the slop-gate vocabulary pack,
# github.com/hwajongpark/slop-gate (rules/vocabulary.json), cross checked
# against the Wikipedia field guide "Signs of AI writing". Only entries this
# list did not already have were taken, and anything that is a term of art in
# finance or engineering was left out on purpose: a curriculum about payments
# has to be able to say what it means without a scanner arguing with it.
BANNED = [
    'delve', 'foster', 'leverage', 'utilize', 'facilitate', 'empower',
    'streamline', 'robust', 'cutting-edge', 'paradigm shift', 'game changer',
    'this is huge', 'this changes everything', 'tapestry', 'realm', 'beacon',
    'multifaceted', 'meticulous', 'intricate', 'paramount', 'transformative',
    'elevate', 'embark', 'supercharge', 'harness', 'ever-evolving',
    # merged from slop-gate
    'seamless', 'seamlessly', 'unlock', 'unlocks', 'unlocking',
    'proactive', 'proactively', 'bustling', 'nestled', 'treasure trove',
    'top-notch', 'moreover', 'furthermore', 'crucial', 'pivotal', 'vibrant'
]

# Phrases that usually delay the point.
FILLER = [
    "it's worth noting", 'it is worth noting', "it's important to note",
    'it is important to note', 'at the end of the day', 'when it comes to',
    'at its core', "in today's world", 'in the age of', 'in the world of',
    'the reality is', 'the truth is', 'in terms of', 'with regard to',
    'going forward', 'in this article', "let's dive in", 'dive into',
    # merged from slop-gate
    'navigate the complexities', 'navigating the complexities',
    'comprehensive guide', 'ultimate guide', 'definitive guide',
    'feel free to', 'do not hesitate to', "don't hesitate to",
    'a testament to', 'underscore the importance',
    'underscores the importance', 'in conclusion'
]

# Patterns. Each is (label, regex, note).
PATTERNS = [
    ('binary contrast', r"\b(?:is|are|was|were|it's|its)\s+not\s+(?:just\s+)?[^.,;:]{2,40},?\s+(?:it's|it is|but)\b",
     'state the second half directly'),
    ('binary contrast', r"\bthe question (?:isn't|is not)\b", 'state the claim directly'),
    ('throat clearing', r"\b(?:here's the thing|here's what i mean|let me be clear|i'll be honest|the uncomfortable truth)\b",
     'cut it and state the point'),
    ('faux insight', r"\b(?:most people (?:skip|get wrong|miss)|nobody tells you|everyone misses|what nobody)\b",
     'let the claim stand on its own'),
    ('importance puffery', r"\b(?:stands as a testament|pivotal moment|plays a vital role|solidifies its position|underscores (?:its )?significance)\b",
     'state the fact, let the reader judge'),
    ('superficial analysis', r",\s+(?:highlighting|underscoring|reflecting|showcasing)\b",
     'say what it does for the reader instead'),
    ('metadiscourse', r"\b(?:the key point is|as you can see|this distinction matters|that last part matters|in other words)\b",
     'delete the aside or replace it with a fact'),
    ('weasel attribution', r"\b(?:experts agree|industry reports suggest|many argue|widely regarded as|studies show)\b",
     'name the source or cut the claim'),
    ('fake strong verb', r"\b(?:serves as|acts as)\s+a\b", 'use is or has'),
    ('weak verb phrase', r"\b(?:made a decision|has the ability to|make use of|provide(?:s)? the ability)\b",
     'use a direct verb'),
    ('rhetorical setup', r"\b(?:what if i told you|think about it:|plot twist:)",
     'drop it and make the point'),
    ('recap ending', r"^\s*(?:in conclusion|ultimately|overall|to sum up)\b",
     'end on the last concrete point'),
    ('negative listing', r"\bnot a [^.,;:]{2,30}\.\s+not a\b", 'just say what it is'),
    ('long dash', r"[—–]", 'house rule: use a colon, comma or full stop'),
    ('emoji heading', r"^\s*#{1,6}\s*[\U0001F300-\U0001FAFF☀-➿]", 'headings carry no emoji'),
]

# Prose only: skip code, imports, and the scanner's own word lists.
CODE_HINTS = re.compile(r"^\s*(?:import|export|const|let|var|function|class|return|\}|#|//|/\*|\*)")


def interesting(path):
    return path.endswith(('.js', '.md', '.html', '.py'))


def walk():
    seen = []
    for f in FILES:
        if os.path.exists(f):
            seen.append(f)
    for root in ROOTS:
        for dirpath, dirs, names in os.walk(root):
            dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
            for n in names:
                p = os.path.join(dirpath, n).replace('\\', '/')
                # remove_dashes.js holds the dash characters it strips, so it
                # always matches and always should be skipped.
                if interesting(p) and 'slop_scan' not in p and 'remove_dashes' not in p:
                    seen.append(p)
    return seen


def scan():
    hits = []
    word_res = [(w, re.compile(r'\b' + re.escape(w) + r'\b', re.I)) for w in BANNED]
    phrase_res = [(p, re.compile(re.escape(p), re.I)) for p in FILLER]
    pattern_res = [(label, re.compile(rx, re.I | re.M), note) for label, rx, note in PATTERNS]

    for path in walk():
        try:
            text = io.open(path, encoding='utf-8').read()
        except (OSError, UnicodeDecodeError):
            continue
        for i, line in enumerate(text.split('\n'), 1):
            stripped = line.strip()
            if not stripped:
                continue
            cleaned = line
            for phrase in ALLOWED_PHRASES:
                cleaned = re.sub(re.escape(phrase), '', cleaned, flags=re.I)
            for w, rx in word_res:
                if rx.search(cleaned):
                    hits.append((path, i, 'banned word', w, stripped))
            for p, rx in phrase_res:
                if rx.search(line):
                    hits.append((path, i, 'filler phrase', p, stripped))
            for label, rx, note in pattern_res:
                if rx.search(line):
                    hits.append((path, i, label, note, stripped))
    return hits


def main():
    # A flagged line can contain any character the curriculum uses, and a
    # Windows console defaults to cp1252, which cannot print a minus sign or a
    # box drawing character. Printing a report should never be the thing that
    # crashes: unprintable characters become question marks and the report
    # still arrives.
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(errors='replace')

    hits = scan()
    if '--counts' in sys.argv:
        tally = {}
        for _, _, kind, what, _ in hits:
            tally[(kind, what)] = tally.get((kind, what), 0) + 1
        for (kind, what), n in sorted(tally.items(), key=lambda kv: -kv[1]):
            print('%3d  %-20s %s' % (n, kind, what))
    else:
        for path, line, kind, what, text in hits:
            print('%s:%d  [%s: %s]' % (path, line, kind, what))
            print('     %s' % text[:150])
    print('\n%d hits across %d files' % (len(hits), len(set(h[0] for h in hits))))


if __name__ == '__main__':
    main()
