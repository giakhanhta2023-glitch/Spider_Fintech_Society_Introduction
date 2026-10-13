"""Build every icon from the Mou mark, keeping its colour.

Run from the repository root:  python tools/build_mou_brand.py

    assets/img/brand/mou-logo-source.png   the render, as delivered
    assets/img/brand/mou-logo.png          trimmed, background transparent
    assets/img/favicon-32.png              32 x 32, transparent
    assets/img/favicon.svg                 the mark, same in both themes
    assets/img/apple-touch-icon.png        180 x 180 on ink
    assets/img/og-card.png                 1200 x 630 on ink

Why this exists next to build_brand.py rather than replacing it. That script
takes a one-colour wordmark on a known ink, undoes the blend, and emits a
white version and an ink version so the favicon can follow the OS theme. Both
of those steps destroy this mark: it has fifty one thousand colours, and
flattening it to one would leave a rabbit-shaped silhouette. build_brand.py
still builds the F(q) wordmark, and its source is untouched.

The background is removed by flooding inward from the edges rather than by
keying every near-black pixel, and that distinction is the whole job here.
The mark's own sunglasses are near-black too. A global key punches two holes
through the face; a flood only takes the black that is connected to the
border, so the glasses survive.

The alpha edge is then blurred by half a pixel and re-sharpened. Without it a
3D render against a flat key shows a one pixel fringe of the old background,
which reads as a dark halo at favicon size.
"""

import base64
import io
import os

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, 'assets', 'img')
SOURCE = os.path.join(IMG, 'brand', 'mou-logo-source.png')

INK = (5, 7, 13)          # --ink, the page the mark was drawn against
TOLERANCE = 26            # how far from the corner colour still counts as background


def cut_background(im):
    """RGBA with the connected border background removed."""
    rgb = np.asarray(im.convert('RGB')).astype(np.int16)
    h, w, _ = rgb.shape

    corners = np.array([rgb[0, 0], rgb[0, w - 1], rgb[h - 1, 0], rgb[h - 1, w - 1]])
    bg = corners.mean(axis=0)

    near = (np.abs(rgb - bg).max(axis=2) <= TOLERANCE)

    # Only the background connected to the edge. The sunglasses are the same
    # black and are not connected to anything outside the rabbit.
    labels, _ = ndimage.label(near)
    edge = set(labels[0, :]) | set(labels[-1, :]) | set(labels[:, 0]) | set(labels[:, -1])
    edge.discard(0)
    outside = np.isin(labels, list(edge))

    alpha = np.where(outside, 0, 255).astype(np.uint8)
    out = Image.fromarray(np.dstack([np.asarray(im.convert('RGB')), alpha]), 'RGBA')

    # Feather, then pull the midpoint back so the mark does not grow a halo.
    a = out.getchannel('A').filter(ImageFilter.GaussianBlur(0.6)).point(
        lambda v: 0 if v < 110 else (255 if v > 190 else int((v - 110) * 255 / 80)))
    out.putalpha(a)
    return out


def trim(img, pad=0.03):
    box = img.getchannel('A').getbbox()
    img = img.crop(box)
    p = int(max(img.size) * pad)
    out = Image.new('RGBA', (img.width + 2 * p, img.height + 2 * p), (0, 0, 0, 0))
    out.paste(img, (p, p))
    return out


def square(img, size, background=None):
    side = max(img.size)
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    canvas.paste(img, ((side - img.width) // 2, (side - img.height) // 2))
    canvas = canvas.resize((size, size), Image.LANCZOS)
    if background is None:
        return canvas
    plate = Image.new('RGBA', (size, size), background + (255,))
    plate.alpha_composite(canvas)
    return plate


def og_card(mark, background, size=(1200, 630), fill=0.72):
    card = Image.new('RGBA', size, background + (255,))
    target = int(size[1] * fill)
    scale = target / max(mark.size)
    art = mark.resize((max(1, int(mark.width * scale)), max(1, int(mark.height * scale))), Image.LANCZOS)
    card.alpha_composite(art, ((size[0] - art.width) // 2, (size[1] - art.height) // 2))
    return card.convert('RGB')


def favicon_svg(mark):
    """One mark, both themes. A colour logo does not invert."""
    buf = io.BytesIO()
    square(mark, 128).save(buf, 'PNG', optimize=True)
    uri = 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode('ascii')
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">\n'
        '  <!-- Built by tools/build_mou_brand.py. The mark carries its own\n'
        '       colour, so unlike the old wordmark it does not switch with the\n'
        '       OS theme: there is no ink version of a green banknote. -->\n'
        f'  <image href="{uri}" width="128" height="128"/>\n'
        '</svg>\n')


def save(img, name):
    path = os.path.join(IMG, name)
    img.save(path, optimize=True)
    print(f'  {os.path.relpath(path, ROOT).replace(os.sep, "/"):<42} {img.size[0]}x{img.size[1]}')


def main():
    if not os.path.exists(SOURCE):
        raise SystemExit(f'missing {SOURCE}')
    src = Image.open(SOURCE)
    print(f'source {src.size[0]}x{src.size[1]}')

    mark = trim(cut_background(src))
    save(mark, 'brand/mou-logo.png')
    save(square(mark, 32), 'favicon-32.png')
    save(square(mark, 180, INK).convert('RGB'), 'apple-touch-icon.png')
    save(og_card(mark, INK), 'og-card.png')

    path = os.path.join(IMG, 'favicon.svg')
    with open(path, 'w', encoding='utf-8') as fh:
        fh.write(favicon_svg(mark))
    print(f'  {os.path.relpath(path, ROOT).replace(os.sep, "/"):<42} 128x128')


if __name__ == '__main__':
    main()
