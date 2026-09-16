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

for (let i = 1; i <= 10; i++) {
  const file = path.join(root, 'content', 'levels', `level-${String(i).padStart(2, '0')}.js`);
  // The curriculum files are plain scripts that call FQ.registerLevel(...).
  const src = fs.readFileSync(file, 'utf8');
  new Function('FQ', src)(globalThis.FQ);
}
levels.sort((a, b) => a.id - b.id);

for (const lv of levels) {
  const dir = path.join(root, 'solutions', `level-${String(lv.id).padStart(2, '0')}`);
  fs.mkdirSync(dir, { recursive: true });

  const lines = [];
  lines.push(`# Level ${lv.id}: ${lv.title}: quiz answer key`);
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
  console.log(`level-${String(lv.id).padStart(2, '0')}/quiz-key.md  (${lv.quiz.length} questions)`);
}

const total = levels.reduce((n, l) => n + l.quiz.length, 0);
console.log(`\n${levels.length} levels, ${total} questions written.`);
