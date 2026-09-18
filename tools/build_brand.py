"""
Build every logo asset from one source image.

Run from the repository root:  python tools/build_brand.py

The source is assets/img/brand/fq-logo-source.png, the F(q) mark on the site's
own ink. Everything a browser or a chat app asks for is cut from it:

  assets/img/og-card.png           1200 x 630, what a pasted link shows
  assets/img/icon-512.png          512 x 512, the mark on its own
  assets/img/apple-touch-icon.png  180 x 180, a phone home screen
  assets/img/favicon-32.png        32 x 32, a browser tab

Swap the source and run this again; nothing else needs editing.
"""

import os

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, 'assets', 'img')
SOURCE = os.path.join(IMG, 'brand', 'fq-logo-source.png')


def ink_of(im):
    """The background colour, read from the corner so the padding matches it."""
    return im.getpixel((8, 8))


def mark_box(im, threshold=60):
    """Bounding box of everything noticeably brighter than the background."""
    grey = im.convert('L').point(lambda v: 255 if v > threshold else 0)
    return grey.getbbox()


def og_card(im):
    """Centre crop to the 1.905 ratio every preview renderer expects."""
    W, H = 1200, 630
    w, h = im.size
    crop_w = min(w, round(h * W / H))
    crop_h = round(crop_w * H / W)
    left = (w - crop_w) // 2
    top = (h - crop_h) // 2
    return im.crop((left, top, left + crop_w, top + crop_h)).resize((W, H), Image.LANCZOS)


def square_icon(im, size, pad):
    """The mark alone, centred on a square of the same ink."""
    x0, y0, x1, y1 = mark_box(im)
    mark = im.crop((x0, y0, x1, y1))
    side = round(max(mark.size) * (1 + 2 * pad))
    canvas = Image.new('RGB', (side, side), ink_of(im))
    canvas.paste(mark, ((side - mark.size[0]) // 2, (side - mark.size[1]) // 2))
    return canvas.resize((size, size), Image.LANCZOS)


def main():
    im = Image.open(SOURCE).convert('RGB')
    print(f'source {im.size[0]} x {im.size[1]}, mark at {mark_box(im)}')

    outputs = {
        'og-card.png': og_card(im),
        'icon-512.png': square_icon(im, 512, 0.06),
        'apple-touch-icon.png': square_icon(im, 180, 0.08),
        'favicon-32.png': square_icon(im, 32, 0.02),
    }
    for name, out in outputs.items():
        path = os.path.join(IMG, name)
        out.save(path, optimize=True)
        print(f'wrote assets/img/{name}  {out.size[0]} x {out.size[1]}  {os.path.getsize(path):,} bytes')


if __name__ == '__main__':
    main()
