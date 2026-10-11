/* Content hashes on every script the page loads.
   =====================================================================
   Run:  node tools/stamp_cache.mjs           stamp index.html
         node tools/stamp_cache.mjs --check   fail if any stamp is stale

   index.html loads 34 plain scripts, one stylesheet and one module, and the
   module imports 13 more files that index.html never names. Without a hash in
   the URL a browser has two options and both are bad: re-ask the server about
   every one of those files on every page load, or keep its copy and show a
   reader last week's lesson.

   A hash fixes both. The URL changes when, and only when, the bytes change, so
   an unchanged file is served from disk with no request at all and an edited
   one arrives as a URL the browser has never seen.

   The scripts in index.html get the hash in a query string. The 13 modules
   behind main.js cannot: nothing names them except an `import './lib.js'`
   inside another module. Those go through the import map, which the page
   already carries for React, and which remaps a resolved URL just as happily
   as it remaps a bare name.

   The audit at the end is the part that keeps vercel.json honest. Those files
   are served immutable for a year, which is only safe while every one of them
   is reached through a hashed URL. If a new file is ever loaded without one,
   this says so and stops. */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const CHECK = process.argv.includes('--check');
const INDEX = join(ROOT, 'index.html');

/* Eight hex characters of sha256. Short enough to read in a network tab,
   long enough that two lessons will not collide.

   Line endings are normalised first, and that is not cosmetic. This repository
   is checked out with core.autocrlf=true, so a file is CRLF on a Windows
   working copy and LF in the repository and on the server. Hashing the raw
   bytes would make the hash depend on which machine last touched the file:
   every checkout would flip hashes that no edit had changed, and the check
   below would fail for no reason. Hashing the normalised text makes the hash a
   function of the lesson, which is the only thing it should depend on. */
const hashOf = (rel) => createHash('sha256')
  .update(readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n'))
  .digest('hex')
  .slice(0, 8);

const walk = (dir) => readdirSync(join(ROOT, dir), { recursive: true })
  .map((f) => `${dir}/${String(f).replace(/\\/g, '/')}`)
  .filter((f) => statSync(join(ROOT, f)).isFile());

let html = readFileSync(INDEX, 'utf8');
const before = html;
const stamped = new Set();

/* ---------------------------------------------- the tags index.html carries */
html = html.replace(
  /(src|href)="((?:assets|content)\/[^"?]+\.(?:js|css))(?:\?v=[0-9a-f]+)?"/g,
  (_, attr, path) => {
    stamped.add(path);
    return `${attr}="${path}?v=${hashOf(path)}"`;
  },
);

/* ------------------------------------- the modules only another module names */
/* index.html is CRLF, so the newlines around the map are captured and put
   back exactly as they were found rather than assumed. */
const mapMatch = html.match(/(<script type="importmap">\r?\n)([\s\S]*?)(\r?\n<\/script>)/);
if (!mapMatch) {
  console.error('index.html has no import map to put the module hashes in.');
  process.exit(1);
}

const map = JSON.parse(mapMatch[2]);
for (const key of Object.keys(map.imports)) {
  if (key.startsWith('/')) delete map.imports[key];      // last run's hashes
}
for (const rel of walk('assets/js/ui').filter((f) => f.endsWith('.js')).sort()) {
  map.imports[`/${rel}`] = `/${rel}?v=${hashOf(rel)}`;
  stamped.add(rel);
}
const EOL = html.includes('\r\n') ? '\r\n' : '\n';
const printed = JSON.stringify(map, null, 2).replace(/\n/g, EOL);
html = html.replace(mapMatch[0], mapMatch[1] + printed + mapMatch[3]);

/* ------------------------------------------------------------- the audit */
const servable = [...walk('assets'), ...walk('content')]
  .filter((f) => /\.(js|css)$/.test(f));
const unreached = servable.filter((f) => !stamped.has(f));

for (const f of unreached) console.log(`unhashed  ${f}`);

const changed = html !== before;
if (CHECK) {
  if (changed) {
    console.log('index.html is out of date: run node tools/stamp_cache.mjs');
  }
  if (unreached.length) {
    console.log(`${unreached.length} file(s) are served without a hash, so immutable caching is not safe for them`);
  }
  if (changed || unreached.length) process.exit(1);
  console.log(`${stamped.size} files hashed, every one of them reached through a hashed URL.`);
} else {
  if (changed) writeFileSync(INDEX, html);
  console.log(`${stamped.size} files hashed${changed ? '' : ', nothing changed'}.`);
  if (unreached.length) {
    console.log(`WARNING: ${unreached.length} file(s) above are served without a hash.`);
    process.exit(1);
  }
}
