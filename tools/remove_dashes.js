/**
 * Replaces every em dash and en dash in the repository with ordinary
 * punctuation, choosing the replacement from context instead of blindly:
 *
 *   paired dashes (an aside)         ->  parentheses
 *   after a bold/code label or title ->  colon
 *   before a list or noun phrase     ->  colon
 *   before an independent clause     ->  full stop, next word capitalised
 *   everything else                  ->  comma
 *
 *   node tools/remove_dashes.js                      rewrite in place
 *   node tools/remove_dashes.js --report             preview everything
 *   node tools/remove_dashes.js --report content/    preview one path
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const reportOnly = process.argv.includes('--report');
const filter = process.argv.find((a) => !a.startsWith('-') && a.includes('/')) || '';

const EM = '—';
const EN = '–';

const EXTS = new Set(['.js', '.md', '.py', '.html', '.css', '.json', '.txt']);
const SKIP_DIRS = new Set(['.git', 'node_modules', '__pycache__', '.pytest_cache']);
/* Generated from the curriculum, so they get rebuilt rather than edited. */
const SKIP_FILES = [/remove_dashes\.js$/, /quiz-key\.md$/, /solutions[\\/]level-\d\d[\\/]README\.md$/];

/* A clause opening with one of these is its own sentence; a comma would splice. */
const INDEPENDENT = /^(it|they|this|that|these|those|you|we|there|he|she|i|its|their|your|our|his|her|nothing|everything|what|why|how|where|when|who|each|both|neither|either)\b/i;
/* These read naturally after a comma. */
const CONNECTOR = /^(which|whom|whose|and|but|so|because|not|or|then|plus|though|although|while|if|unless|until|even|usually|often|always|never|now|again|instead|rather|exactly|precisely|roughly|about)\b/i;
/* An instruction after a dash wants a full stop, not a comma splice. */
const IMPERATIVE = /^(read|use|add|check|put|keep|write|run|ask|take|make|start|stop|avoid|assume|remember|treat|report|state|pick|open|copy|paste|test|try|do not|never|always|look|note)/i;
/* A finite verb near the front means a clause, not a list. */
const FINITE_VERB = /\b(is|are|was|were|has|have|had|do|does|did|can|could|will|would|should|must|may|might|make|makes|mean|means|give|gives|get|gets|go|goes|come|comes|run|runs|need|needs|take|takes|turn|turns|become|becomes|cost|costs|charge|charges|earn|earns|pay|pays|let|lets|keep|keeps|stop|stops|start|starts|end|ends|fall|falls|rise|rises|move|moves|hold|holds|stay|stays|read|reads|write|writes|send|sends|receive|receives|work|works|happen|happens|appear|appears|belong|belongs|sit|sits|live|lives|exist|exists)\b/i;

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(path.join(dir, entry.name), out);
    } else if (EXTS.has(path.extname(entry.name))) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

function decide(text, index, after) {
  const lineStart = text.lastIndexOf('\n', index - 1) + 1;
  const rawPrefix = text.slice(lineStart, index);
  const prevStart = text.lastIndexOf('\n', lineStart - 2) + 1;
  const prevLine = text.slice(prevStart, Math.max(prevStart, lineStart - 1));

  /* strip comment markers, markdown bullets and JS string glue */
  const prefix = rawPrefix
    .replace(/^[\s>|]*/, '')
    .replace(/^(\/\*+|\*+|#+|\/\/)\s*/, '')
    .replace(/^[-*]\s+/, '')
    .replace(/^['"`]/, '')
    .trim();

  const head = after.replace(/^[\s'"`+]+/, '');
  const firstWords = head.split(/\s+/).slice(0, 5).join(' ');

  /* A short line that starts fresh is a title or a label: "FinQuest: AI tutor
     endpoint". A short line that merely continues a wrapped sentence is not,
     which is why the line above has to close something first. */
  const prevCloses = /^\s*$/.test(prevLine)
    || /^[\s*/]*[=\-*_]{3,}\s*$/.test(prevLine)
    || /[.!?:]['"`]?\s*[,+]?\s*$/.test(prevLine);
  const isTitle = prefix.length > 0 && prefix.length <= 46
    && !/[.!?,;:]$/.test(prefix) && prevCloses;
  const isLabel = /(\*\*[^*]{1,42}\*\*|`[^`]{1,42}`|\*[^*]{1,42}\*)\s*$/.test(rawPrefix);

  if (isTitle || /^https?:\/\//.test(head)) return ': ';
  /* A contrast or continuation reads as a comma even after a label:
     "the sum of its entries, not a column you update". */
  if (CONNECTOR.test(head)) return ', ';
  if (isLabel) return ': ';
  if (IMPERATIVE.test(head)) return '. ';
  /* A bare adverb closing the sentence is an aside, not an explanation. */
  if (/^\w+ly[.,;]?$/.test(firstWords.trim())) return ', ';
  /* No verb close to the front means what follows explains, it does not assert:
     "a pipe money travels along: card networks, bank transfers". */
  if (!FINITE_VERB.test(firstWords) && !CONNECTOR.test(head)) return ': ';
  if (CONNECTOR.test(head)) return ', ';
  /* Two complete clauses joined by a dash become two sentences; a comma there
     would be a splice. */
  const tail = rawPrefix.split(/\s+/).slice(-8).join(' ');
  if (FINITE_VERB.test(firstWords) && FINITE_VERB.test(tail)) return '. ';
  if (INDEPENDENT.test(head)) return '. ';
  return ', ';
}

function capitaliseAfterStop(text) {
  return text.replace(/\. ([a-z])(?=[a-z']{1,20}\b)/g, (m, c, offset, whole) => {
    const prior = whole.slice(Math.max(0, offset - 4), offset);
    if (/\b(e\.g|i\.e|vs|etc|Mr|Dr|No)$/i.test(prior)) return m;
    return '. ' + c.toUpperCase();
  });
}

const changes = [];

for (const file of walk(root)) {
  const rel = path.relative(root, file).replace(/\\/g, '/');
  if (SKIP_FILES.some((re) => re.test(file))) continue;

  const text = fs.readFileSync(file, 'utf8');
  if (!text.includes(EM) && !text.includes(EN)) continue;

  /* --- pass 1: find genuine paired dashes (an aside inside one sentence) --
     A sentence end, or an array/argument boundary, between two dashes means
     they belong to different sentences and are not a pair. */
  const positions = [];
  for (let i = 0; i < text.length; i++) if (text[i] === EM) positions.push(i);
  const paired = new Map();                       // position -> '(' or ')'
  for (let i = 0; i < positions.length - 1; i++) {
    const gap = text.slice(positions[i] + 1, positions[i + 1]);
    /* Join JS string concatenation first, otherwise an aside that happens to
       wrap across two quoted chunks looks like an array boundary. */
    const clean = gap.replace(/['"`]\s*\+\s*\n?\s*['"`]/g, '');
    const sentenceEnd = /[.!?]/.test(clean);
    const itemBoundary = /['"`]\s*[,\])]/.test(clean) || /\n\s*['"`{[]/.test(clean);
    if (clean.length <= 110 && !sentenceEnd && !itemBoundary) {
      paired.set(positions[i], ' (');
      paired.set(positions[i + 1], ') ');
      i++;                                        // consume the partner
    }
  }

  /* --- pass 2: rewrite ------------------------------------------------- */
  let out = '';
  let cursor = 0;
  const re = new RegExp('[ \\t]*' + EM + '[ \\t]*', 'g');
  let m;
  while ((m = re.exec(text)) !== null) {
    const dashAt = m.index + m[0].indexOf(EM);
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 220);
    const replacement = paired.get(dashAt) || decide(text, m.index, after);

    out += text.slice(cursor, m.index) + replacement;
    cursor = m.index + m[0].length;

    const before = text.slice(Math.max(0, m.index - 58), m.index);
    changes.push({
      file: rel,
      from: (before + m[0] + after.slice(0, 58)).replace(/\s+/g, ' ').trim(),
      to: (before + replacement + after.slice(0, 58)).replace(/\s+/g, ' ').trim()
    });
  }
  out += text.slice(cursor);

  out = out.split(EN).join('-');                  // en dashes only appear in ranges
  out = capitaliseAfterStop(out);
  /* tidy artefacts where a dash sat against string-concatenation glue */
  out = out.replace(/(\S) +([,.:;)])/g, '$1$2')   // never touches indentation
           .replace(/\( +/g, '(')
           .replace(/([,:;]) +\n/g, '$1\n')
           /* never stack a new stop on an existing terminator: `mean?" That` */
           .replace(/([.!?]["'`”]?)\. /g, '$1 ');

  if (!reportOnly) fs.writeFileSync(file, out, 'utf8');
}

const files = new Set(changes.map((c) => c.file)).size;
console.log(`${changes.length} dashes replaced across ${files} files${reportOnly ? ' (report only)' : ''}`);

if (reportOnly) {
  const shown = filter ? changes.filter((c) => c.file.includes(filter)) : changes;
  console.log(`showing ${shown.length}${filter ? ' in ' + filter : ''}`);
  for (const c of shown) console.log(`\n${c.file}\n  -  ${c.from}\n  +  ${c.to}`);
}
