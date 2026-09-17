/* =========================================================================
   Khanh: a black bear sitting down, 24 pixels wide and 26 tall.

   Same technique as mou.js, one character per pixel, with two differences.
   He is a whole animal rather than a face, so he needs the extra height; and
   every edge of the silhouette carries the outline, which is what stops a
   pixel figure reading as a stack of boxes.

   A black bear is a problem on a near black page: painted in true black he is
   a hole in the screen. So he is painted the way illustrators paint them, in
   dark blues, with a colder blue along the lit edge. The two things that read
   at this size are the tan muzzle and the light in his eyes, and both are
   drawn brighter than they would be on paper.

     .  nothing        f  fur           b  fur catching the light
     o  outline        k  fur in shadow l  the blue rim down his left side
     m  muzzle         n  nose          p  the sole of a foot
     e  eye            w  the light in it
     h  the heart that floats up when he looks at her
   ========================================================================= */
import { html } from './lib.js';

const W = 24;
const H = 26;

const PALETTE = {
  o: '#04060A',
  k: '#0A0E1A',
  f: '#1A2338',
  b: '#2B3A5C',
  l: '#3F5280',
  m: '#B49C82',
  p: '#8B7A67',
  n: '#07090F',
  e: '#05070C',
  w: '#DCE4F4',
  h: '#FF6B8A'
};

const FRAME = [
  '...oooo..........oooo...',  // 0  ears, round, on the corners
  '...obbb..........bbbo...',  // 1
  '...obbboooooooooobbbo...',  // 2
  '....olfffffffffffflo....',  // 3  head
  '....olbbffffffffbblo....',  // 4
  '....olewffffffffwelo....',  // 5  eyes: the glint is most of it
  '....olfffffffffffflo....',  // 6
  '....olfffmnnnnmffflo....',  // 7  nose across the top of the muzzle
  '....olffmmmmmmmmfflo....',  // 8
  '.....olfmmmnnmmmflo.....',  // 9  mouth
  '.....olffmmmmmmfflo.....',  // 10
  '......olfffffffflo......',  // 11 what passes for a neck
  '...oooffffffffffffooo...',  // 12 shoulders
  '..obffffffffffffffffbo..',  // 13
  '.obffffffffffffffffffbo.',  // 14
  '.okkkffffffffffffffkkko.',  // 15 front legs down the sides
  'obkkkbffffffffffffbkkkbo',  // 16 widest, sitting
  'obkkkbffffffffffffbkkkbo',  // 17
  'obkkkbffffffffffffbkkkbo',  // 18
  'obkkkbffffffffffffbkkkbo',  // 19
  'okppkfkkkkkkkkkkkkfkppko',  // 20 soles turned towards you
  'oppppfkkkkkkkkkkkkfppppo',  // 21
  'oppppfkkkkkkkkkkkkfppppo',  // 22
  '.kppkfkkkkkkkkkkkkfkppk.',  // 23
  '..ooffkkkkkkkkkkkkffoo..',  // 24
  '....ookkkkkkkkkkkkoo....'   // 25
];

const MOODS = {
  /* Sitting, looking straight out. */
  idle: {},

  /* Eyes shut for a moment: the glint goes and the fur closes over it. One
     row is all there is at this size, and losing the light reads as closing. */
  blink: {
    5: '....olbbffffffffbblo....'
  },

  /* The one moment he turns to her: eyes shut, mouth wider. He is a calm
     animal, so the tell is small on purpose. */
  love: {
    5: '....olbbffffffffbblo....',
    9: '.....olfmmnnnnmmflo.....'
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

/* `size` is his width. He is a little taller than he is wide, so the height
   follows from the grid rather than from the caller: square pixels on both
   sprites are what makes them belong to the same world. */
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
