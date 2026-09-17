/* =========================================================================
   Khanh: a standing grizzly, 24 pixels wide and 32 tall.

   Same technique as mou.js, one character per pixel, with two differences.
   He is a full figure rather than a face, so he needs the height; and the
   silhouette is outlined on every edge, which is what stops a pixel figure
   reading as a stack of boxes.

   What makes him a grizzly rather than a bear cub: the shoulder hump is the
   widest part of him, the head is narrow next to it, the jaw hangs open with
   the teeth showing, and the arms hang clear of the body with the claws down.
   Light falls from the upper left, so the hump and the top of the skull carry
   the lit tone and everything below the ribs is in shadow.

     .  nothing        f  fur           l  lit fur        d  shaded fur
     o  outline        k  deep shadow   m  muzzle         n  nose
     e  eye            w  tooth         t  inside the mouth
     c  claw
   ========================================================================= */
import { html } from './lib.js';

const W = 24;
const H = 32;

const PALETTE = {
  k: '#26170C',
  o: '#3A2312',
  d: '#633D1E',
  f: '#88592D',
  l: '#AD7940',
  m: '#C6A170',
  n: '#160E06',
  e: '#0E0904',
  w: '#F6ECD8',
  t: '#70262F',
  c: '#EEE3CA',
  h: '#FF6B8A'
};

const FRAME = [
  '........llllllll........',  // 0  skull
  '.....ddollllllllodd.....',  // 1  ears, on the sides of the head
  '.....offllllllllffo.....',  // 2
  '.....offllllllllffo.....',  // 3
  '......kkkkkkkkkkkk......',  // 4  brow ridge
  '......leelllllleel......',  // 5  eyes under it
  '......offmnnnnmffo......',  // 6  muzzle and nose
  '......offmnnnnmffo......',  // 7
  '......offwtwwtwffo......',  // 8  the jaw opens, upper teeth
  '.......ofttttttfo.......',  // 9
  '.......ofttttttfo.......',  // 10
  '........otttttto........',  // 11
  '........owtwwtwo........',  // 12 lower teeth
  '........dmmmmmmd........',  // 13 chin and throat
  '.....llllffffffllll.....',  // 14 shoulders
  '...olllllfffffflllllo...',  // 15
  '.ooflllllfffffflllllfoo.',  // 16 the hump, widest part of him
  '.offo.ollllffllllo.offo.',  // 17 arms hang clear of the chest
  '.offo.ollllffllllo.offo.',  // 18
  '.offo.ollllffllllo.offo.',  // 19
  '.oddo.offffffffffo.oddo.',  // 20
  '.oddo.offffffffffo.oddo.',  // 21
  '.oddo.offffffffffo.oddo.',  // 22
  '.okko.offffffffffo.okko.',  // 23 forearms in shadow
  '.okko.oddddddddddo.okko.',  // 24
  '.ccco.oddddddddddo.occc.',  // 25 claws
  '......oddddddddddo......',  // 26 hips
  '.....offfff..fffffo.....',  // 27 legs, planted apart
  '.....offfff..fffffo.....',  // 28
  '.....oddddd..dddddo.....',  // 29
  '.....oddddd..dddddo.....',  // 30
  '....cccdddd..ddddccc....'   // 31 feet
];

const MOODS = {
  /* Mid roar, which is the pose he stands in. */
  idle: {},

  /* Eyes shut: the brow drops onto them, so they merge into the ridge above.
     One row is all there is at this size, and merging reads as closing. */
  blink: {
    5: '......lkkllllllkkl......'
  },

  /* The one moment he is not roaring. The jaw shuts, the teeth go away and
     the muzzle settles into a closed mouth line: he is looking at her. */
  love: {
    8: '......offmmmmmmffo......',
    9: '.......ofmnnnnmfo.......',
    10: '.......ofmmmmmmfo.......',
    11: '........offffffo........',
    12: '........offffffo........',
    13: '........dffffffd........'
  }
};

function rowsFor(mood) {
  const face = MOODS[mood] || MOODS.idle;
  return FRAME.map((row, y) => face[y] || row);
}

function rects(rows) {
  const out = [];
  rows.forEach((row, y) => {
    /* The row's own width, not the sprite's: the heart below is seven wide
       and would otherwise be padded with rectangles of nothing. */
    const width = row.length;
    let x = 0;
    while (x < width) {
      const ch = row[x];
      let run = 1;
      while (x + run < width && row[x + run] === ch) run++;
      if (ch !== '.') {
        out.push(html`
          <rect key=${`${x}-${y}`} x=${x} y=${y} width=${run} height="1" fill=${PALETTE[ch]} />`);
      }
      x += run;
    }
  });
  return out;
}

/* `size` is his width. He is taller than he is wide, and taller than Mou, so
   the height follows from the grid rather than from the caller: square pixels
   on both sprites are what makes them belong to the same world. */
export function Bear({ mood = 'idle', size = 40, title = 'Khanh', bob = false }) {
  return html`
    <svg class=${'mou bear' + (bob ? ' is-bobbing' : '')}
      width=${size} height=${Math.round((size * H) / W)}
      viewBox=${`0 0 ${W} ${H}`} shape-rendering="crispEdges"
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

/* A mistyped row skews the whole sprite silently, and an asymmetric one gives
   him a crooked face nobody can quite explain. */
Object.keys(MOODS).forEach((mood) => {
  const rows = rowsFor(mood);
  if (rows.length !== H) {
    console.error(`Bear sprite: ${mood} has ${rows.length} rows, expected ${H}`);
  }
  rows.forEach((row, y) => {
    if (row.length !== W) {
      console.error(`Bear sprite: ${mood} row ${y} is ${row.length} pixels, expected ${W}`);
    } else if (row.slice(0, W / 2) !== row.slice(W / 2).split('').reverse().join('')) {
      console.error(`Bear sprite: ${mood} row ${y} is not symmetric`);
    }
  });
});

/* The heart is drawn by the same code, so it gets the same guard. */
HEART.forEach((row, y) => {
  if (![...row].every((ch) => ch === '.' || PALETTE[ch])) {
    console.error(`Pixel heart: row ${y} uses a colour that is not in the palette`);
  }
});
