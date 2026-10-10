"""Every foreground on every background, in both themes, against WCAG.

    python tools/check_contrast.py

The stylesheet's own rule 5 is "nothing below 12px, nothing under 4.5:1". This
is the half of that rule a person cannot check by looking, because a colour
that reads fine to someone with good sight on a good monitor can still be below
the line.

The palettes here are copies of the ones in assets/css/app.css. If you change a
colour there, change it here and run this. It found two live failures the day it
was written: code comments were 3.42:1 in the dark theme, which had shipped.

Code is measured against --ink-deep, the code well, which is only correct
because .codeblock code clears the inline-code background. When that rule was
missing, block code carried --code-inline on top of the well and comments
landed at 4.47:1 rather than the 5.0 this file reports.

Hairline rules are deliberately not in the list. A 1px divider is not a control
somebody has to perceive to operate, and holding it to 3:1 would mean giving up
the quiet rules the whole layout is built from.
"""


def srgb(c):
    c = c / 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def luminance(hexstr):
    h = hexstr.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b)


def ratio(fg, bg):
    a, b = luminance(fg), luminance(bg)
    hi, lo = max(a, b), min(a, b)
    return (hi + 0.05) / (lo + 0.05)


DARK = {
    "ink": "#05070D", "ink-raised": "#0A0E18", "ink-deep": "#020306",
    "bone": "#E9ECF4", "ash": "#9BA4B8", "graphite": "#78819A",
    "rule": "#171C29", "rule-mid": "#2A3245",
    "accent": "#5B8CFF", "accent-solid": "#2563EB",
    "moss": "#6E9C70", "crimson": "#C25E5E",
    "syntax-comment": "#737D94", "syntax-number": "#9CC4FF",
}

# The light theme keeps the blue cast. A warm cream paper would be a different
# identity, and a worse one: this palette's whole character is that the neutral
# leans blue rather than grey or beige.
LIGHT = {
    "ink": "#F2F5FC", "ink-raised": "#FFFFFF", "ink-deep": "#E7ECF8",
    "bone": "#0C101A", "ash": "#495369", "graphite": "#5A6480",
    "rule": "#DEE4F1", "rule-mid": "#BFC9DE",
    "accent": "#1D4ED8", "accent-solid": "#2563EB",
    "moss": "#3F6B45", "crimson": "#A63F3F",
    "syntax-comment": "#5A6475", "syntax-number": "#1B4FA8",
}

# foreground, background, the floor it must clear, and what a reader sees
PAIRS = [
    ("bone", "ink", 4.5, "primary text on the page"),
    ("bone", "ink-raised", 4.5, "primary text on a panel"),
    ("bone", "ink-deep", 4.5, "primary text in a code well"),
    ("ash", "ink", 4.5, "secondary text"),
    ("ash", "ink-raised", 4.5, "secondary text on a panel"),
    ("graphite", "ink", 4.5, "tertiary: mono labels, the index metadata"),
    ("graphite", "ink-raised", 4.5, "tertiary on a panel"),
    ("accent", "ink", 4.5, "accent as text"),
    ("accent", "ink-raised", 4.5, "accent as text on a panel"),
    ("moss", "ink", 4.5, "right answers, shipped"),
    ("crimson", "ink", 4.5, "wrong answers"),
    ("syntax-comment", "ink-deep", 4.5, "code comments"),
    ("syntax-number", "ink-deep", 4.5, "numbers in code"),
    ("moss", "ink-deep", 4.5, "strings in code"),
    ("accent", "ink-deep", 4.5, "keywords in code"),
]

for name, T in (("DARK", DARK), ("LIGHT", LIGHT)):
    print(f"\n{'=' * 64}\n{name}\n{'=' * 64}")
    worst = 99
    for fg, bg, floor, what in PAIRS:
        r = ratio(T[fg], T[bg])
        ok = "ok  " if r >= floor else "FAIL"
        if r < worst:
            worst = r
        print(f"  {ok} {r:5.2f}  (>= {floor})  {fg:>14} on {bg:<11} {what}")
    print(f"  lowest: {worst:.2f}")

# White on the filled accent button, which is the one inverted pair.
for name, T in (("DARK", DARK), ("LIGHT", LIGHT)):
    r = ratio("#FFFFFF", T["accent-solid"])
    print(f"\n{name}: white on accent-solid = {r:.2f} (>= 4.5)")
