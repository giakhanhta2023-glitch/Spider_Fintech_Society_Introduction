/**
 * Rewrites each level's `quiz:` block so the correct answer is spread evenly
 * across positions A-D instead of clustering on one letter. Deterministic:
 * running it twice produces the same file.
 *
 *   node tools/balance_answers.js            # rewrite the curriculum files
 *   node tools/balance_answers.js --check    # report the distribution only
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const checkOnly = process.argv.includes('--check');
const LETTERS = ['A', 'B', 'C', 'D'];

/* tiny deterministic PRNG (mulberry32) */
function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rand) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* Balanced target positions: each letter used as evenly as possible per level,
   with no three identical positions in a row. */
function targets(count, optionCount, rand) {
  const pool = [];
  for (let i = 0; pool.length < count; i++) pool.push(i % optionCount);
  for (let attempt = 0; attempt < 200; attempt++) {
    const order = shuffle(pool, rand);
    let runs = false;
    for (let i = 2; i < order.length; i++) {
      if (order[i] === order[i - 1] && order[i] === order[i - 2]) { runs = true; break; }
    }
    if (!runs) return order;
  }
  return shuffle(pool, rand);
}

function serialiseQuiz(quiz) {
  const out = ['  quiz: ['];
  quiz.forEach((q, i) => {
    out.push(`    { q: ${JSON.stringify(q.q)},`);
    out.push('      options: [');
    q.options.forEach((opt, j) => {
      const comma = j === q.options.length - 1 ? '' : ',';
      out.push(`        ${JSON.stringify(opt)}${comma}`);
    });
    out.push('      ],');
    out.push(`      answer: ${q.answer},`);
    out.push(`      why: ${JSON.stringify(q.why)} }${i === quiz.length - 1 ? '' : ','}`);
    if (i !== quiz.length - 1) out.push('');
  });
  out.push('  ],');
  return out.join('\n');
}

const summary = [];

/* Every level file there is, rather than a fixed ten: the advanced track adds
   more, and a tool that quietly skipped them would be worse than useless. */
const levelFiles = fs.readdirSync(path.join(root, 'content', 'levels'))
  .filter((f) => /^level-\d+\.js$/.test(f))
  .sort();

for (const name of levelFiles) {
  const id = parseInt(name.match(/\d+/)[0], 10);
  const file = path.join(root, 'content', 'levels', name);
  const src = fs.readFileSync(file, 'utf8');

  /* load the level object */
  let level = null;
  new Function('FQ', src)({ registerLevel: (lv) => { level = lv; } });

  const rand = rng(20260915 + id * 7919);
  const wanted = targets(level.quiz.length, 4, rand);

  const rebuilt = level.quiz.map((q, i) => {
    const correct = q.options[q.answer];
    const others = shuffle(q.options.filter((_, j) => j !== q.answer), rand);
    const target = Math.min(wanted[i], q.options.length - 1);
    const options = others.slice();
    options.splice(target, 0, correct);
    return { q: q.q, options, answer: options.indexOf(correct), why: q.why };
  });

  const dist = LETTERS.map((l, j) => `${l}:${rebuilt.filter((q) => q.answer === j).length}`).join(' ');
  summary.push(`level ${String(id).padStart(2)}  ${dist}`);

  if (checkOnly) continue;

  /* replace the quiz block, line-based against the file's own formatting */
  const lines = src.split('\n');
  const start = lines.findIndex((l) => l === '  quiz: [');
  if (start === -1) throw new Error(`${name}: no quiz block found`);
  let end = -1;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i] === '  ],') { end = i; break; }
  }
  if (end === -1) throw new Error(`${name}: quiz block not closed`);

  const next = [...lines.slice(0, start), serialiseQuiz(rebuilt),...lines.slice(end + 1)];
  fs.writeFileSync(file, next.join('\n'), 'utf8');

  /* verify the rewritten file still parses and keeps the same answers */
  let reparsed = null;
  new Function('FQ', fs.readFileSync(file, 'utf8'))({ registerLevel: (lv) => { reparsed = lv; } });
  if (reparsed.quiz.length !== level.quiz.length) throw new Error(`${name}: question count changed`);
  reparsed.quiz.forEach((q, i) => {
    if (q.options[q.answer] !== level.quiz[i].options[level.quiz[i].answer]) {
      throw new Error(`${name}: answer text changed at Q${i + 1}`);
    }
    if (q.options.slice().sort().join('|') !== level.quiz[i].options.slice().sort().join('|')) {
      throw new Error(`${name}: option set changed at Q${i + 1}`);
    }
  });
}

console.log(summary.join('\n'));
console.log(checkOnly ? '\n(check only : no files written)': '\nrewritten and verified');
