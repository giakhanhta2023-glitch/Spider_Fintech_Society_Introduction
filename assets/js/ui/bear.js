/* =========================================================================
   Khanh: a 24 by 24 pixel bear who is fond of Mou.

   Same technique as mou.js: the sprite is text, one character per pixel, and
   runs of a colour are merged into one rect.

   He is drawn heavy on purpose. At this size the things that read as a big
   male bear are a dark outline rather than a pale one, a brow ridge sitting
   straight on the eyes, a square jaw that does not taper into the neck, and
   shoulders wider than the head. No blush, and the inner ear is brown: pink
   anywhere on the face undoes all of it.

     .  nothing        f  fur           d  shaded fur: brow, jaw, arms
     o  outline        p  inner ear     e  eye
     m  muzzle         n  nose and mouth
     h  the heart he carries for her
   ========================================================================= */
import { html } from './lib.js';

const W = 24;

const PALETTE = {
  o: '#4A2F1B',
  f: '#A06A38',
  d: '#7C4E29',
  p: '#8A5A3F',
  m: '#D9C3A0',
  e: '#1B2230',
  n: '#3A2416',
  h: '#FF6B8A'
};

const FRAME = [
  '....ooooo......ooooo....',  // 0  ears, small and set wide
  '....opppo......opppo....',  // 1
  '....opppo......opppo....',  // 2
  '....offfo......offfo....',  // 3
  '...offffffffffffffffo...',  // 4
  '..offffffffffffffffffo..',  // 5
  '..offdddddffffdddddffo..',  // 6  brow ridge
  '..offfeeffffffffeefffo..',  // 7  eyes, straight under it
  '..offfeeffffffffeefffo..',  // 8
  '..offffffmmmmmmffffffo..',  // 9  muzzle
  '..offfffmmnnnnmmfffffo..',  // 10 nose
  '..offfffmmmnnmmmfffffo..',  // 11
  '..offfffmnnnnnnmfffffo..',  // 12 mouth, flat
  '..offffffmmmmmmffffffo..',  // 13
  '..offffffffffffffffffo..',  // 14 jaw, square
  '..oddddddddddddddddddo..',  // 15
  '...offffffffffffffffo...',  // 16
  '.offffffffffffffffffffo.',  // 17 shoulders, wider than the head
  '.oddffffffffffffffffddo.',  // 18 arms
  '.oddffffffhhhhffffffddo.',  // 19 the heart he carries
  '.oddfffffffhhfffffffddo.',  // 20
  '.oddffffffffffffffffddo.',  // 21
  '..offffffffffffffffffo..',  // 22
  '..oooooooooooooooooooo..'   // 23
];

const MOODS = {
  /* The resting face is the frame itself: eyes forward, mouth flat. He is not
     staring at anybody. */
  idle: {},

  /* Eyes shut for a moment: one dark row, a little wider than the open eye,
     which is how a closed eye reads at this size. Nothing else moves. */
  blink: {
    7: '..offffffffffffffffffo..',
    8: '..offeeeffffffffeeeffo..'
  },

  /* The one moment he looks her way. The brow lifts, the eyes close and the
     mouth opens into a grin. It lasts about two seconds, and the mouth is
     what carries it: two rows of it are visible at 24 pixels, an eyelid is
     barely one. */
  love: {
    6: '..ofdddddffffffdddddfo..',
    7: '..offffffffffffffffffo..',
    8: '..offeeeffffffffeeeffo..',
    12: '..offfffnnnnnnnnfffffo..',
    13: '..offffffmnnnnmffffffo..'
  }
};

function rowsFor(mood) {
  const face = MOODS[mood] || MOODS.idle;
  return FRAME.map((row, y) => face[y] || row);
}

function rects(rows) {
  const out = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < W) {
      const ch = row[x];
      let run = 1;
      while (x + run < W && row[x + run] === ch) run++;
      if (ch !== '.') {
        out.push(html`
          <rect key=${`${x}-${y}`} x=${x} y=${y} width=${run} height="1" fill=${PALETTE[ch]} />`);
      }
      x += run;
    }
  });
  return out;
}

export function Bear({ mood = 'idle', size = 40, title = 'Khanh', bob = false }) {
  return html`
    <svg class=${'mou bear' + (bob ? ' is-bobbing' : '')} width=${size} height=${size}
      viewBox=${`0 0 ${W} ${W}`} shape-rendering="crispEdges"
      role="img" aria-label=${title}>
      <title>${title}</title>
      ${rects(rowsFor(mood))}
    </svg>`;
}

/* The heart that floats up between them. Pixels, so it belongs to the same
   world as the two sprites rather than being an emoji borrowed from the font. */
const HEART = [
  '.hh.hh.',
  'hhhhhhh',
  'hhhhhhh',
  '.hhhhh.',
  '..hhh..',
  '...h...'
];

export function PixelHeart({ size = 16 }) {
  return html`
    <svg class="pixel-heart" width=${size} height=${size} viewBox="0 0 7 6"
      shape-rendering="crispEdges" aria-hidden="true">
      ${rects(HEART).map((r) => r)}
    </svg>`;
}

/* Same check mou.js makes: a mistyped row skews the whole sprite silently, and
   an asymmetric one gives him a crooked face nobody can quite explain. */
Object.keys(MOODS).forEach((mood) => {
  rowsFor(mood).forEach((row, y) => {
    if (row.length !== W) {
      console.error(`Bear sprite: ${mood} row ${y} is ${row.length} pixels, expected ${W}`);
    } else if (row.slice(0, W / 2) !== row.slice(W / 2).split('').reverse().join('')) {
      console.error(`Bear sprite: ${mood} row ${y} is not symmetric`);
    }
  });
});
