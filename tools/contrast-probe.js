window.FQ_CONTRAST = /* Contrast on a translucent interface, measured the only way that is true.

   getComputedStyle(el).backgroundColor on a glass panel returns the glass,
   not what shows through it, so a near-black heading on a near-black page
   inside a 4% white panel reports 19:1 and is actually unreadable. That is a
   real bug this design shipped for about ten minutes.

   This walks the ancestor chain, collects every background layer including
   the colour inside a solid linear-gradient, composites them bottom up with
   real alpha, and only then computes the ratio.

   Paste the whole file into the console on a page you want to judge, then
   call FQ_CONTRAST(). Two things it learned the hard way:

     Disable transitions first. Flipping the theme and measuring immediately
     reads colours mid-interpolation, which reported a nav link at 1.06:1
     that was fine once it settled:
       document.head.insertAdjacentHTML('beforeend',
         '<style>*{transition:none !important}</style>');

     A blank page has no text and so no failures. A crashed render once
     reported a clean pass, which is why anything under twenty text nodes
     comes back as failures: -1 rather than zero. */
(() => {
  const parse = (c) => {
    if (!c || c === 'transparent') return null;
    const m = c.match(/[\d.]+/g);
    if (!m) return null;
    const [r, g, b, a] = m.map(Number);
    return { r, g, b, a: a === undefined ? 1 : a };
  };
  const over = (top, bot) => {
    const a = top.a + bot.a * (1 - top.a);
    if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
    return {
      r: (top.r * top.a + bot.r * bot.a * (1 - top.a)) / a,
      g: (top.g * top.a + bot.g * bot.a * (1 - top.a)) / a,
      b: (top.b * top.a + bot.b * bot.a * (1 - top.a)) / a,
      a,
    };
  };
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const lum = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
  const ratio = (f, b) => {
    const L1 = lum(f), L2 = lum(b);
    return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
  };

  /* every background layer on one element, bottom (colour) then top (image) */
  const layersOf = (el) => {
    const cs = getComputedStyle(el);
    const out = [];
    const bg = parse(cs.backgroundColor);
    if (bg && bg.a > 0) out.push(bg);
    const img = cs.backgroundImage;
    if (img && img !== 'none') {
      const c = img.match(/rgba?\([^)]+\)/);
      if (c) { const p = parse(c[0]); if (p && p.a > 0) out.push(p); }
    }
    return out;
  };

  const effectiveBg = (el) => {
    const chain = [];
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) chain.push(n);
    chain.push(document.documentElement);
    const stack = [];
    for (const n of chain) stack.unshift(...layersOf(n));   /* root first */
    let acc = { r: 255, g: 255, b: 255, a: 1 };
    for (const layer of stack) acc = over(layer, acc);
    return acc;
  };

  const isText = (el) => {
    for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim().length > 1) return true;
    return false;
  };

  const fails = [];
  let checked = 0;
  document.querySelectorAll('main *, .masthead *').forEach((el) => {
    if (!isText(el)) return;
    const b = el.getBoundingClientRect();
    if (b.width < 2 || b.height < 2) return;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.opacity === '0') return;
    const fg = parse(cs.color);
    if (!fg) return;
    const bg = effectiveBg(el);
    const comp = fg.a < 1 ? over(fg, bg) : fg;
    const size = parseFloat(cs.fontSize);
    const bold = (parseInt(cs.fontWeight, 10) || 400) >= 700;
    const large = size >= 24 || (size >= 18.66 && bold);
    const floor = large ? 3 : 4.5;
    const r = ratio(comp, bg);
    checked += 1;
    if (r < floor) {
      fails.push({
        text: el.textContent.trim().slice(0, 34),
        cls: String(el.className).slice(0, 26),
        ratio: +r.toFixed(2), floor, size: Math.round(size),
      });
    }
  });
  /* A blank page has no text and therefore no failures, which once let a
     crashed render report a clean pass. Anything under 20 checked elements on
     a real view means the page did not render, and that is reported as a
     failure of the check rather than a success of the design. */
  const blank = checked < 20;
  return {
    checked, blank,
    failures: blank ? -1 : fails.length,
    note: blank ? 'PAGE DID NOT RENDER: too few text nodes to judge' : undefined,
    worst: fails.sort((a, b) => a.ratio - b.ratio).slice(0, 8),
  };
});
