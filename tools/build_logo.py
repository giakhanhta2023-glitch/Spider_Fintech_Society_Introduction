"""
Build the FinQuest ribbon monogram into assets/img/finquest-logo.svg.

Run from the repository root:  python tools/build_logo.py

The club mark is calligraphic: a ribbon whose width swells and pinches as it
turns, not a constant outline, and where the two letters weave over and under
each other. So every stroke here is a centreline plus a width profile, offset
to both sides into a filled path, and the draw order is chosen so the Q passes
over the F in one place and under it in another.

Two rules keep the offsets clean:
  - one cubic per stroke, so there is never a tangent kink to fold around
  - the radius of curvature stays well above half the ribbon width
"""

import math

# --------------------------------------------------------------------- maths
def cubic(p0, p1, p2, p3, t):
    mt = 1 - t
    return (mt ** 3 * p0[0] + 3 * mt * mt * t * p1[0]
            + 3 * mt * t * t * p2[0] + t ** 3 * p3[0],
            mt ** 3 * p0[1] + 3 * mt * mt * t * p1[1]
            + 3 * mt * t * t * p2[1] + t ** 3 * p3[1])


def cubic_d(p0, p1, p2, p3, t):
    mt = 1 - t
    return (3 * mt * mt * (p1[0] - p0[0]) + 6 * mt * t * (p2[0] - p1[0])
            + 3 * t * t * (p3[0] - p2[0]),
            3 * mt * mt * (p1[1] - p0[1]) + 6 * mt * t * (p2[1] - p1[1])
            + 3 * t * t * (p3[1] - p2[1]))


def curve(p0, p1, p2, p3, n=90):
    out = []
    for k in range(n + 1):
        t = k / n
        p = cubic(p0, p1, p2, p3, t)
        d = cubic_d(p0, p1, p2, p3, t)
        m = math.hypot(*d) or 1e-9
        out.append((p, (d[0] / m, d[1] / m)))
    return out


def arc(cx, cy, rx, ry, a0, a1, rot=0.0, n=170):
    pts = []
    ca, sa = math.cos(rot), math.sin(rot)
    for k in range(n + 1):
        a = math.radians(a0 + (a1 - a0) * k / n)
        x, y = rx * math.cos(a), ry * math.sin(a)
        dx, dy = -rx * math.sin(a), ry * math.cos(a)
        px, py = cx + x * ca - y * sa, cy + x * sa + y * ca
        tx, ty = dx * ca - dy * sa, dx * sa + dy * ca
        m = math.hypot(tx, ty) or 1e-9
        pts.append(((px, py), (tx / m, ty / m)))
    return pts


def arc_point(cx, cy, rx, ry, a, rot=0.0):
    ca, sa = math.cos(rot), math.sin(rot)
    a = math.radians(a)
    x, y = rx * math.cos(a), ry * math.sin(a)
    return cx + x * ca - y * sa, cy + x * sa + y * ca


def width_at(t, wmax, floor=0.38, pinches=(), depth=0.5, span=0.10,
             head=0.0, tail=0.0):
    w = floor + (1 - floor) * math.sin(math.pi * min(max(t, 0.0), 1.0)) ** 0.5
    for p in pinches:
        d = abs(t - p) / span
        if d < 1:
            w *= 1 - (1 - depth) * math.cos(math.pi * d / 2) ** 2
    if head and t < head:
        w *= 0.3 + 0.7 * (t / head)
    if tail and t > 1 - tail:
        w *= 0.3 + 0.7 * ((1 - t) / tail)
    return wmax * w


ALL_PTS = []


def ribbon(samples, wmax, **kw):
    n = len(samples) - 1
    left, right = [], []
    for i, (p, d) in enumerate(samples):
        w = width_at(i / n, wmax, **kw) / 2
        nx, ny = -d[1], d[0]
        left.append((p[0] + nx * w, p[1] + ny * w))
        right.append((p[0] - nx * w, p[1] - ny * w))
    pts = left + right[::-1]
    ALL_PTS.extend(pts)
    return 'M %.1f %.1f ' % pts[0] + ' '.join('L %.1f %.1f' % p for p in pts[1:]) + ' Z'


# ------------------------------------------------------------------ the mark
# A 512 grid. The Q is a ribbon loop with a tail; the F is a stem and two arms
# that cross it. Everything leans right, like the club mark, so the monogram
# reads as moving rather than sitting still.
LEAN = math.radians(-11)
QC = (332, 286)
QR = (116, 108)

# F first, then Q, the way the name reads. The F takes the left and descends
# past the baseline; the Q sits to its right, a loop that passes over its own
# start so it closes into a letter instead of trailing off like a C.
f_stem = curve((168, 74), (148, 200), (136, 322), (132, 448))
f_top = curve((156, 126), (222, 96), (300, 86), (372, 100))
f_mid = curve((140, 268), (196, 244), (252, 238), (306, 248))

q_loop = arc(QC[0], QC[1], QR[0], QR[1], 104, 474, rot=LEAN)
q_over = arc(QC[0], QC[1], QR[0], QR[1], 138, 242, rot=LEAN, n=90)

tail_start = arc_point(QC[0], QC[1], QR[0], QR[1], 58, rot=LEAN)
q_tail = curve(tail_start, (408, 404), (432, 424), (462, 452))

SHAPES = [
    # The loop goes down first, so the F can cross over it.
    (ribbon(q_loop, 52, pinches=(0.24, 0.72), depth=0.42, head=0.09, tail=0.11),
     'gQ', 1.0),
    (ribbon(q_tail, 40, floor=0.58, head=0.24, tail=0.3), 'gQT', 1.0),
    (ribbon(f_stem, 50, pinches=(0.44,), depth=0.52, head=0.12, tail=0.1),
     'gF', 1.0),
    (ribbon(f_top, 42, floor=0.52, head=0.18, tail=0.4), 'gFA', 1.0),
    (ribbon(f_mid, 36, floor=0.52, head=0.18, tail=0.4), 'gFB', 1.0),
    # and the left of the loop comes back over the F arms, so the two letters
    # weave through each other rather than sitting one on top of the other.
    (ribbon(q_over, 52, floor=0.74, head=0.3, tail=0.3), 'gQO', 1.0),
]

GRADIENTS = """
  <linearGradient id="gQ" x1="226" y1="188" x2="440" y2="392" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#63E5F8"/>
    <stop offset="0.45" stop-color="#26A2F2"/>
    <stop offset="1" stop-color="#0B39D0"/>
  </linearGradient>
  <linearGradient id="gQT" x1="386" y1="356" x2="468" y2="458" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#1C79EE"/>
    <stop offset="1" stop-color="#0A2ABE"/>
  </linearGradient>
  <linearGradient id="gF" x1="170" y1="74" x2="130" y2="448" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#0B39D0"/>
    <stop offset="0.5" stop-color="#2E9DF4"/>
    <stop offset="1" stop-color="#0C46DA"/>
  </linearGradient>
  <linearGradient id="gFA" x1="156" y1="126" x2="374" y2="100" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#1668EA"/>
    <stop offset="1" stop-color="#77EBF9"/>
  </linearGradient>
  <linearGradient id="gFB" x1="140" y1="268" x2="308" y2="248" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#1974EE"/>
    <stop offset="1" stop-color="#5FDFF7"/>
  </linearGradient>
  <linearGradient id="gQO" x1="216" y1="236" x2="262" y2="356" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#22B6F4"/>
    <stop offset="1" stop-color="#1157E4"/>
  </linearGradient>
"""

body = '\n'.join('    <path d="%s" fill="url(#%s)"%s/>'
                 % (d, g, '' if o == 1.0 else ' opacity="%.2f"' % o)
                 for d, g, o in SHAPES)

# Centre the mark in its own box: everything that shows an icon crops it
# square, so the drawing cannot sit off to one side.
BOX, PAD = 512, 34
xs = [q[0] for q in ALL_PTS]
ys = [q[1] for q in ALL_PTS]
x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
scale = (BOX - 2 * PAD) / max(x1 - x0, y1 - y0)
tx = (BOX - (x1 - x0) * scale) / 2 - x0 * scale
ty = (BOX - (y1 - y0) * scale) / 2 - y0 * scale
print('bbox %.0f,%.0f to %.0f,%.0f, scale %.3f' % (x0, y0, x1, y1, scale))
body = ('  <g transform="translate(%.2f %.2f) scale(%.4f)">\n%s\n  </g>'
        % (tx, ty, scale, body))

svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" '
       'role="img" aria-label="FinQuest">\n'
       '  <title>FinQuest</title>\n'
       '  <defs>%s</defs>\n%s\n</svg>\n' % (GRADIENTS, body))

open('assets/img/finquest-logo.svg', 'w', encoding='utf-8').write(svg)
print('wrote assets/img/finquest-logo.svg,', len(svg), 'bytes')
