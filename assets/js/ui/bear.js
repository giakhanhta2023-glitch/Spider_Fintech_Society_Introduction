/* =========================================================================
   Khanh: a 24 by 24 pixel bear who is fond of Mou.

   Same technique as mou.js: the sprite is text, one character per pixel, and
   runs of a colour are merged into one rect. He is drawn slightly heavier than
   Mou, with round ears and a broad muzzle, so the two read as different
   animals at 24 pixels rather than the same shape in two colours.

     .  nothing        f  fur           e  eye
     o  outline        p  inner ear     n  nose and mouth
     b  blush          m  muzzle        h  the heart he is holding
   ========================================================================= */
import { html } from './lib.js';

const W = 24;

const PALETTE = {
  o: '#D8B892',
  f: '#C0854B',
  p: '#F0A9B8',
  m: '#F3E2C7',
  e: '#232B3D',
  n: '#5A3B26',
  b: '#FF9BB6',
  h: '#FF6B8A'
};

const FRAME = [
  '.....ooo........ooo.....',  // 0
  '....opppo......opppo....',  // 1
  '....ofpfo......ofpfo....',  // 2
  '....offfo......offfo....',  // 3
  '...offffffffffffffffo...',  // 4
  '..offffffffffffffffffo..',  // 5
  '..offffffffffffffffffo..',  // 6
  '..offffffffffffffffffo..',  // 7
  '..offffffffffffffffffo..',  // 8  face
  '..offffffffffffffffffo..',  // 9  face
  '..ofbbffmmmmmmmmffbbfo..',  // 10 face
  '..offfffmmmnnmmmfffffo..',  // 11 face
  '..offfffmmnmmnmmfffffo..',  // 12 face
  '..offfffmmmmmmmmfffffo..',  // 13
  '..offffffffffffffffffo..',  // 14
  '...offffffffffffffffo...',  // 15
  '....offffffffffffffo....',  // 16
  '.....offffffffffffo.....',  // 17
  '....offffffffffffffo....',  // 18
  '....offfffhhhhfffffo....',  // 19 holding a heart
  '....offffffhhffffffo....',  // 20
  '....offffffffffffffo....',  // 21
  '.....offffffffffffo.....',  // 22
  '.....oooooooooooooo.....'   // 23
];

const MOODS = {
  /* Resting face: eyes forward, mouth closed. He is not staring at anybody. */
  idle: {
    8:  '..offffeeffffffeeffffo..',
    9:  '..offffeeffffffeeffffo..',
    12: '..offfffmmnnnnmmfffffo..'
  },

  /* Eyes shut for a moment. Nothing else moves, which is what makes it read
     as a blink rather than a mood. */
  blink: {
    9:  '..offffeeffffffeeffffo..',
    12: '..offfffmmnnnnmmfffffo..'
  },

  /* The one moment he looks her way: eyes shut, cheeks up, a wide smile. It
     lasts about two seconds and then he faces forward again. */
  love: {
    8:  '..offffeeffffffeeffffo..',
    9:  '..offfeffeffffeffefffo..',
    11: '..offfffmmmnnmmmfffffo..',
    12: '..offfffmnnnnnnmfffffo..',
    13: '..offfffmmnnnnmmfffffo..'
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

/* Same check mou.js makes: a mistyped row skews the whole sprite silently. */
Object.keys(MOODS).forEach((mood) => {
  rowsFor(mood).forEach((row, y) => {
    if (row.length !== W) {
      console.error(`Bear sprite: ${mood} row ${y} is ${row.length} pixels, expected ${W}`);
    }
  });
});
