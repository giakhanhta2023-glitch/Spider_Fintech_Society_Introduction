"""The same colour, written in two files, actually being the same colour.

    python tools/check_palettes.py

app.css holds the dark palette in :root and the light one under
[data-theme="light"]. check_contrast.py keeps its own copies so it can do the
arithmetic, and says so in its docstring: "if you change a colour there, change
it here".

Copies of a palette, kept in step by remembering, will drift. This reads them
out of both files and fails when either has, which turns a silent wrong colour
into a failed check.

It compares roles, not every declaration: a palette is allowed to define
something the others do not, and only the overlap has to agree.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSS = (ROOT / "assets" / "css" / "app.css").read_text(encoding="utf-8").replace(chr(13), "")
PY = (ROOT / "tools" / "check_contrast.py").read_text(encoding="utf-8").replace(chr(13), "")


def block(pattern):
    """The declarations inside the first rule whose selector matches."""
    # A rule's selector can run over several lines before its brace, which is
    # why this skips to the first { rather than expecting one straight after.
    m = re.search(pattern + r"[^{]*\{(.*?)\n\}", CSS, re.S | re.M)
    if not m:
        sys.exit(f"could not find the {pattern} block in app.css")
    return {
        name: value.upper()
        for name, value in re.findall(r"--([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8})", m.group(1))
    }


def py_dict(name):
    m = re.search(name + r"\s*=\s*\{(.*?)\n\}", PY, re.S)
    if not m:
        sys.exit(f"could not find {name} in check_contrast.py")
    return {k: v.upper() for k, v in re.findall(r'"([a-z0-9-]+)":\s*"(#[0-9a-fA-F]{3,8})"', m.group(1))}


css_dark = block(r"^:root,\n\.radix-themes")
css_light = block(r'^:root\[data-theme="light"\],')
CHECKS = [
    # the contrast tool must be measuring the colours that actually ship
    ("check_contrast.py DARK against app.css", py_dict("DARK"), css_dark),
    ("check_contrast.py LIGHT against app.css", py_dict("LIGHT"), css_light),
]

bad = 0
for what, a, b in CHECKS:
    shared = sorted(set(a) & set(b))
    drift = [(k, a[k], b[k]) for k in shared if a[k] != b[k]]
    if drift:
        bad += len(drift)
        print(f"  DRIFT  {what}")
        for k, x, y in drift:
            print(f"           --{k}: {x} here, {y} there")
    else:
        print(f"  ok     {what}  ({len(shared)} roles agree)")

if bad:
    print(f"\n{bad} colour(s) have drifted. One palette, four copies, and they no longer match.")
    sys.exit(1)
print("\nevery copy of the palette agrees")
