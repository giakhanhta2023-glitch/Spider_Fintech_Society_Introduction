"""
Build every logo asset from one source image.

Run from the repository root:  python tools/build_brand.py

The source is assets/img/brand/fq-logo-source.png, the F(q) mark on the site's
own ink. The background is taken out mathematically rather than by tracing:
every pixel is treated as the mark blended over that ink, and the blend is
undone, so the anti-aliased edges and the glow of the orbit keep their shape.

  assets/img/brand/fq-logo.png      transparent, white letters, for dark pages
  assets/img/brand/fq-logo-ink.png  transparent, ink letters, for light pages
  assets/img/favicon.svg            switches between the two with the OS theme
  assets/img/favicon-32.png         transparent fallback for older browsers
  assets/img/apple-touch-icon.png   180 x 180 on ink: iOS fills transparency with black anyway
  assets/img/og-card.png            1200 x 630 on ink, what a pasted link shows

The link preview keeps its background on purpose. Chat apps in light mode draw
a transparent image on white, and white letters on white are invisible.

Swap the source and run this again; nothing else needs editing.
"""

import base64
import io
import os

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, 'assets', 'img')
SOURCE = os.path.join(IMG, 'brand', 'fq-logo-source.png')

INK_LETTERS = np.array([11, 16, 32], dtype=np.float32)   # letter colour on light pages


def ink_of(im):
    """The background colour, averaged from the four corners."""
    w, h = im.size
    px = [im.getpixel(p) for p in ((8, 8), (w - 9, 8), (8, h - 9), (w - 9, h - 9))]
    return tuple(round(sum(c[i] for c in px) / 4) for i in range(3))


def unblend(im, floor=0.05):
    """Colour to alpha against the ink: the inverse of compositing onto it.

    For a pixel c over background b with coverage a, c = b + a * (f - b). Taking
    the smallest a that keeps f inside the colour cube recovers both f and a.
    Anything below `floor` is the image's grain and becomes fully transparent.
    """
    rgb = np.asarray(im.convert('RGB'), dtype=np.float32)
    bg = np.array(ink_of(im), dtype=np.float32)
    diff = np.clip(rgb - bg, 0, None)
    alpha = np.max(diff / (255.0 - bg), axis=2)
    colour = bg + diff / np.where(alpha > 0, alpha, 1.0)[..., None]
    alpha = np.clip((alpha - floor) / (1 - floor), 0, 1)
    return np.clip(colour, 0, 255), alpha


def rgba(colour, alpha):
    out = np.dstack([colour, alpha * 255.0]).round().astype(np.uint8)
    return Image.fromarray(out, 'RGBA')


def ink_version(colour):
    """Neutral pixels (the letters) turn to ink; coloured ones (the orbit) stay."""
    chroma = colour.max(axis=2) - colour.min(axis=2)
    keep = np.clip(chroma / 90.0, 0, 1)[..., None]
    return keep * colour + (1 - keep) * INK_LETTERS


def trim(img, pad):
    x0, y0, x1, y1 = img.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    p = round(max(x1 - x0, y1 - y0) * pad)
    return img.crop((x0 - p, y0 - p, x1 + p, y1 + p))


def square(img, size, pad, background=None):
    side = round(max(img.size) * (1 + 2 * pad))
    canvas = Image.new('RGBA', (side, side), background + (255,) if background else (0, 0, 0, 0))
    canvas.alpha_composite(img, ((side - img.size[0]) // 2, (side - img.size[1]) // 2))
    return canvas.resize((size, size), Image.LANCZOS)


def og_card(im):
    """Centre crop to the 1.905 ratio every preview renderer expects."""
    W, H = 1200, 630
    w, h = im.size
    crop_w = min(w, round(h * W / H))
    crop_h = round(crop_w * H / W)
    left, top = (w - crop_w) // 2, (h - crop_h) // 2
    return im.crop((left, top, left + crop_w, top + crop_h)).resize((W, H), Image.LANCZOS)


def data_uri(img):
    buf = io.BytesIO()
    img.save(buf, 'PNG', optimize=True)
    return 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()


def favicon_svg(light, dark):
    """One file that follows the OS theme: ink letters on light, white on dark."""
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
        '<style>.d{display:none}@media (prefers-color-scheme: dark){.l{display:none}.d{display:inline}}</style>'
        f'<image class="l" width="64" height="64" href="{data_uri(light)}"/>'
        f'<image class="d" width="64" height="64" href="{data_uri(dark)}"/>'
        '</svg>'
    )


def save(img, name):
    path = os.path.join(IMG, name)
    img.save(path, optimize=True)
    print(f'wrote assets/img/{name}  {img.size[0]} x {img.size[1]}  {os.path.getsize(path):,} bytes')


def main():
    src = Image.open(SOURCE).convert('RGB')
    colour, alpha = unblend(src)

    white = trim(rgba(colour, alpha), 0.03)
    ink = trim(rgba(ink_version(colour), alpha), 0.03)
    print(f'source {src.size[0]} x {src.size[1]}, background {ink_of(src)}, mark {white.size[0]} x {white.size[1]}')

    save(white, 'brand/fq-logo.png')
    save(ink, 'brand/fq-logo-ink.png')

    svg = favicon_svg(square(ink, 64, 0.02), square(white, 64, 0.02))
    with open(os.path.join(IMG, 'favicon.svg'), 'w', encoding='utf-8') as fh:
        fh.write(svg)
    print(f'wrote assets/img/favicon.svg  {len(svg):,} bytes')

    save(square(white, 32, 0.02), 'favicon-32.png')
    save(square(white, 180, 0.10, ink_of(src)).convert('RGB'), 'apple-touch-icon.png')
    save(og_card(src), 'og-card.png')


if __name__ == '__main__':
    main()
