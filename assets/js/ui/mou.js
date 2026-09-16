/* =========================================================================
   Mou: the tutor, drawn as a 24 by 24 pixel rabbit.

   The sprite is authored as text, one character per pixel, so a mood can be
   edited by eye. Every row must be exactly 24 characters, which the check at
   the bottom of this file enforces the first time the module loads. Runs of
   the same colour are merged into one rect, so a 576 pixel sprite costs
   roughly 90 elements.

     .  nothing        w  fur          e  eye
     o  outline        p  inner ear    n  nose and mouth
     b  blush          c  book         s  pages and sparkles

   Proportions are deliberately babyish: a head nine pixels taller than the
   body, eyes set low and wide, everything else small.
   ========================================================================= */
import { html } from './lib.js';

const W = 24;

const PALETTE = {
  o: '#AEB8D0',
  w: '#FFFFFF',
  p: '#FFB0C6',
  b: '#FF9BB6',
  e: '#232B3D',
  n: '#FF7A9C',
  c: 'var(--accent-solid)',
  s: 'var(--accent)'
};

/* Ears, skull, paws and book. Only the face rows change between moods. */
const FRAME = [
  '.......oo......oo.......',  // 0
  '......oppo....oppo......',  // 1
  '......oppo....oppo......',  // 2
  '......oppo....oppo......',  // 3
  '......oppo....oppo......',  // 4
  '......oppo....oppo......',  // 5
  '.....owppwo..owppwo.....',  // 6
  '.....owppwo..owppwo.....',  // 7
  '....owwwwwwwwwwwwwwo....',  // 8
  '...owwwwwwwwwwwwwwwwo...',  // 9
  '..owwwwwwwwwwwwwwwwwwo..',  // 10
  '..owwwwwwwwwwwwwwwwwwo..',  // 11
  '..owwwwwwwwwwwwwwwwwwo..',  // 12  face
  '..owwwwwwwwwwwwwwwwwwo..',  // 13  face
  '..owwwwwwwwwwwwwwwwwwo..',  // 14  face
  '..owwwwwwwwwwwwwwwwwwo..',  // 15  face
  '..owwwwwwwwwwwwwwwwwwo..',  // 16  face
  '..owwwwwwwwwwwwwwwwwwo..',  // 17  face
  '..owwwwwwwwwwwwwwwwwwo..',  // 18
  '...owwwwwwwwwwwwwwwwo...',  // 19
  '....owwwwwwwwwwwwwwo....',  // 20
  '.....owwwwwwwwwwwwo.....',  // 21
  '.....owwwccssccwwwo.....',  // 22  paws holding a book
  '.....ooooccccccoooo.....'   // 23
];

const MOODS = {
  /* A two pixel curve is not enough to read as a smile at this size, so the
     mouth is drawn open: four pixels wide, tapering to two. It sits a clear
     row below the nose so the two marks never merge into one blob. */
  idle: {
    13: '..owwwweewwwwwweewwwwo..',
    14: '..owwwweewwwwwweewwwwo..',
    15: '..owbbwwwwwnnwwwwwbbwo..',
    16: '..owbbwwwwwwwwwwwwbbwo..',
    17: '..owwwwwwwnnnnwwwwwwwo..',
    18: '..owwwwwwwwnnwwwwwwwwo..'
  },

  /* Eyes squeezed shut, mouth wide: the moment an answer lands. */
  happy: {
    13: '..owwwweewwwwwweewwwwo..',
    14: '..owwwewwewwwwewwewwwo..',
    15: '..owbbwwwwwnnwwwwwbbwo..',
    16: '..owbbwwwwwwwwwwwwbbwo..',
    17: '..owwwwwwnnnnnnwwwwwwo..',
    18: '..owwwwwwwnnnnwwwwwwwo..'
  },

  /* Eyes lifted, a sparkle over one ear, still smiling: Mou is on your question. */
  thinking: {
    2:  '......oppo....oppo..s...',
    3:  '......oppo....oppo.sss..',
    4:  '......oppo....oppo..s...',
    12: '..owwwweewwwwwweewwwwo..',
    13: '..owwwweewwwwwweewwwwo..',
    15: '..owbbwwwwwnnwwwwwbbwo..',
    16: '..owbbwwwwwwwwwwwwbbwo..',
    17: '..owwwwwwwnnnnwwwwwwwo..',
    18: '..owwwwwwwwnnwwwwwwwwo..'
  },

  /* The masthead button: eyes closed in a contented smile. */
  rest: {
    13: '..owwwweewwwwwweewwwwo..',
    14: '..owwwewwewwwwewwewwwo..',
    15: '..owbbwwwwwnnwwwwwbbwo..',
    16: '..owbbwwwwwwwwwwwwbbwo..',
    17: '..owwwwwwwnnnnwwwwwwwo..',
    18: '..owwwwwwwwnnwwwwwwwwo..'
  }
};

function rowsFor(mood) {
  const face = MOODS[mood] || MOODS.idle;
  return FRAME.map((row, y) => face[y] || row);
}

/* One rect per run of identical colour, so the sprite stays cheap to render. */
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

export function Mou({ mood = 'idle', size = 40, title = 'Mou, your tutor', bob = false }) {
  return html`
    <svg class=${'mou' + (bob ? ' is-bobbing' : '')} width=${size} height=${size}
      viewBox=${`0 0 ${W} ${W}`} shape-rendering="crispEdges"
      role="img" aria-label=${title}>
      <title>${title}</title>
      ${rects(rowsFor(mood))}
    </svg>`;
}

/* A mistyped row would silently skew the whole sprite, so say so loudly. */
Object.keys(MOODS).forEach((mood) => {
  rowsFor(mood).forEach((row, y) => {
    if (row.length !== W) {
      console.error(`Mou sprite: ${mood} row ${y} is ${row.length} pixels, expected ${W}`);
    }
  });
});
