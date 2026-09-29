/**
 * Generates solutions/level-XX/quiz-key.md from the curriculum files, so the
 * printed answer keys can never drift from what the site actually asks.
 *
 *   node tools/build_quiz_keys.js
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const LETTERS = ['A', 'B', 'C', 'D', 'E'];

const levels = [];
globalThis.FQ = { registerLevel: (lv) => levels.push(lv) };

/* Every level file in the folder, so a new level needs no edit here. */
const levelFiles = fs.readdirSync(path.join(root, 'content', 'levels'))
  .filter((f) => /^(?:level|fpa)-\d+\.js$/.test(f))
  .sort();
for (const name of levelFiles) {
  const file = path.join(root, 'content', 'levels', name);
  // The curriculum files are plain scripts that call FQ.registerLevel(...).
  const src = fs.readFileSync(file, 'utf8');
  new Function('FQ', src)(globalThis.FQ);
}
levels.sort((a, b) => a.id - b.id);


/* Where a level's solution lives. The curriculum says so itself, in the brief's
   solutionPath, because a second track does not number its folders level-NN. */
function solutionDir(lv) {
  const brief = lv.project || lv.setup || {};
  if (brief.solutionPath) return brief.solutionPath;
  return `solutions/level-${String(lv.id).padStart(2, '0')}`;
}

/* The number and the track a reader sees, rather than the global id. */
function levelLabel(lv, all) {
  const inTrack = all.filter((l) => (l.track || 'eng') === (lv.track || 'eng'));
  const position = lv.position || inTrack.indexOf(lv) + 1;
  return { position, count: inTrack.length, track: lv.track || 'eng' };
}

for (const lv of levels) {
  const dir = path.join(root, solutionDir(lv));
  fs.mkdirSync(dir, { recursive: true });

  const lines = [];
  const at = levelLabel(lv, levels);
  /* The engineering keys have been numbered 1 to 20 since before there was a
     second track, so they keep that. A second track counts within itself. */
  const shown = at.track === 'eng' ? String(lv.id) : String(at.position).padStart(2, '0');
  lines.push(`# Level ${shown}: ${lv.title}: quiz answer key`);
  lines.push('');
  lines.push(`> ${lv.quiz.length} questions. Pass mark is 12/15 (80%).`);
  lines.push('> Generated from `content/levels/` by `tools/build_quiz_keys.js`: do not edit by hand.');
  lines.push('');
  lines.push('| # | Answer |');
  lines.push('|---|--------|');
  lv.quiz.forEach((q, i) => lines.push(`| ${i + 1} | **${LETTERS[q.answer]}** |`));
  lines.push('');
  lines.push('---');
  lines.push('');

  lv.quiz.forEach((q, i) => {
    lines.push(`### ${i + 1}. ${q.q}`);
    lines.push('');
    q.options.forEach((opt, j) => {
      const mark = j === q.answer ? '**' : '';
      const tick = j === q.answer ? ' ✅' : '';
      lines.push(`- ${mark}${LETTERS[j]}. ${opt}${mark}${tick}`);
    });
    lines.push('');
    lines.push(`**Why:** ${q.why}`);
    lines.push('');
  });

  fs.writeFileSync(path.join(dir, 'quiz-key.md'), lines.join('\n'), 'utf8');
  console.log(`${solutionDir(lv)}/quiz-key.md  (${lv.quiz.length} questions)`);
}

const total = levels.reduce((n, l) => n + l.quiz.length, 0);
console.log(`\n${levels.length} levels, ${total} questions written.`);
