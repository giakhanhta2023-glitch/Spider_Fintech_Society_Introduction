"""
Build the link preview card into assets/img/og-card.png.

Run from the repository root:  python tools/build_og.py

A chat app that is handed a bare URL shows whatever the page declares, so this
draws the card the site would have drawn itself: the same ink, the same blue,
the same display face, and the same two animals. Nothing here is decorative for
its own sake. The card exists so that a link pasted into a group chat says what
the thing is before anybody clicks it.

The two typefaces are fetched from Google Fonts at build time and cached in the
system temp directory. They are not committed: the only output is the PNG.
"""

import io
import os
import re
import tempfile
import urllib.request

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'img', 'og-card.png')

W, H = 1200, 630

INK = (5, 7, 13)
BONE = (233, 236, 244)
ASH = (155, 164, 184)
GRAPHITE = (120, 129, 154)
RULE_MID = (42, 50, 69)
ACCENT = (91, 140, 255)

# Pinned so a rebuild in six months produces the same card.
FONTS = {
    'serif': 'https://fonts.gstatic.com/s/instrumentserif/v5/jizBRFtNs2ka5fXjeivQ4LroWlx-2zI.ttf',
    'serif-italic': 'https://fonts.gstatic.com/s/instrumentserif/v5/jizHRFtNs2ka5fXjeivQ4LroWlx-6zATiw.ttf',
    'mono': 'https://fonts.gstatic.com/s/jetbrainsmono/v24/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKxjPQ.ttf',
}


# ------------------------------------------------------------------- fonts
def font_file(name):
    """Download once into the temp directory, then reuse it."""
    cache = os.path.join(tempfile.gettempdir(), 'finquest-fonts')
    os.makedirs(cache, exist_ok=True)
    path = os.path.join(cache, name + '.ttf')
    if not os.path.exists(path):
        req = urllib.request.Request(FONTS[name], headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=30) as r:
            data = r.read()
        with open(path, 'wb') as fh:
            fh.write(data)
    return path


def load(name, size):
    return ImageFont.truetype(font_file(name), size)


def tracked(draw, xy, text, font, fill, track=0.0):
    """Draw text with letter spacing, and return the width used.

    Pillow has no tracking, and the site's mono labels are spaced, so the
    characters are placed one at a time.
    """
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=font, fill=fill)
        x += draw.textlength(ch, font=font) + track
    return x - xy[0]


# ------------------------------------------------------------------ sprites
def sprite(path, mood):
    """Read a 24 by 24 sprite out of its JavaScript module.

    The sprites are authored as text in assets/js/ui, one character per pixel,
    so the card can render exactly what the site renders without anyone having
    to keep a second copy of the artwork in step.
    """
    src = io.open(os.path.join(ROOT, path), encoding='utf-8').read()

    palette = {}
    block = re.search(r'const PALETTE = \{(.*?)\};', src, re.S).group(1)
    for key, value in re.findall(r"(\w+):\s*'(#[0-9A-Fa-f]{6})'", block):
        palette[key] = tuple(int(value[i:i + 2], 16) for i in (1, 3, 5))

    block = re.search(r'const FRAME = \[(.*?)\];', src, re.S).group(1)
    rows = re.findall(r"'([^']{24})'", block)
    if not rows:
        raise SystemExit('%s: no sprite rows found' % path)

    block = re.search(r'\b%s: \{(.*?)\}' % mood, src, re.S).group(1)
    for index, row in re.findall(r"(\d+):\s*'([^']{24})'", block):
        rows[int(index)] = row

    return rows, palette


def draw_sprite(img, rows, palette, origin, scale):
    d = ImageDraw.Draw(img)
    ox, oy = origin
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == '.' or ch not in palette:
                continue
            d.rectangle([ox + x * scale, oy + y * scale,
                         ox + (x + 1) * scale - 1, oy + (y + 1) * scale - 1],
                        fill=palette[ch])


# --------------------------------------------------------------------- wash
def ambient(img):
    """The faint blue lift the site paints behind the page.

    Drawn as a low resolution radial and scaled up, which is both quick and
    smoother than plotting it pixel by pixel.
    """
    small = Image.new('L', (60, 32), 0)
    px = small.load()
    cx, cy = 54, 0
    for y in range(32):
        for x in range(60):
            dx, dy = (x - cx) / 40.0, (y - cy) / 30.0
            fall = max(0.0, 1.0 - (dx * dx + dy * dy))
            px[x, y] = int(255 * fall * fall * 0.17)
    mask = small.resize((W, H), Image.BICUBIC)
    img.paste(Image.new('RGB', (W, H), (37, 99, 235)), (0, 0), mask)


# --------------------------------------------------------------------- card
def build():
    img = Image.new('RGB', (W, H), INK)
    ambient(img)
    d = ImageDraw.Draw(img)

    left = 92

    # Wordmark, set the way the masthead sets it.
    mark = load('serif', 62)
    mark_i = load('serif-italic', 62)
    x = left
    d.text((x, 74), 'Fin', font=mark, fill=BONE)
    x += d.textlength('Fin', font=mark)
    d.text((x, 74), 'Quest', font=mark_i, fill=ACCENT)

    # The promise, in the display face, on two lines.
    title = load('serif', 104)
    d.text((left, 196), 'Learn fintech', font=title, fill=BONE)
    d.text((left, 300), 'by building it', font=title, fill=BONE)

    d.line([(left, 452), (left + 300, 452)], fill=RULE_MID, width=1)

    label = load('mono', 22)
    tracked(d, (left, 484), 'ten levels. learn, drill, build, ship.', label, ASH, 0.6)

    foot = load('mono', 21)
    tracked(d, (left, 538), 'finquest-rank-nullity.vercel.app', foot, GRAPHITE, 0.6)

    # Khanh and Mou, at the same pixel size, standing on one baseline. He is a
    # standing figure and taller than she is, so each sprite's own row count
    # decides where it starts.
    scale = 9
    size = 24 * scale
    base = 498
    gap = 30
    bear_x = W - 92 - size * 2 - gap
    mou_x = W - 92 - size
    bear, bear_palette = sprite('assets/js/ui/bear.js', 'idle')
    mou, mou_palette = sprite('assets/js/ui/mou.js', 'idle')
    draw_sprite(img, bear, bear_palette, (bear_x, base - len(bear) * scale), scale)
    draw_sprite(img, mou, mou_palette, (mou_x, base - len(mou) * scale), scale)

    names = load('mono', 19)
    for x, name in ((bear_x, 'khanh'), (mou_x, 'mou')):
        width = sum(d.textlength(c, font=names) + 1.0 for c in name) - 1.0
        tracked(d, (x + (size - width) / 2, base + 18), name, names, GRAPHITE, 1.0)

    img.save(OUT, optimize=True)
    print('wrote %s (%d x %d, %.0f kB)'
          % (OUT, W, H, os.path.getsize(OUT) / 1024))


if __name__ == '__main__':
    build()
