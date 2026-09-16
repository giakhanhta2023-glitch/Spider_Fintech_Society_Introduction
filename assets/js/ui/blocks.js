/* =========================================================================
   Curriculum blocks -> editorial elements.
   The level files stay plain data; this decides how each block type sets.
   ========================================================================= */
import { html, useState, FQ, md } from './lib.js';

/* ------------------------------------------------------------- code block */
export function CodeBlock({ code, lang = 'python', label }) {
  const [copied, setCopied] = useState(false);
  const source = FQ.subst(code);

  function copy() {
    const done = () => { setCopied(true); setTimeout(() => setCopied(false), 1600); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(source).then(done, done);
    } else {
      const ta = document.createElement('textarea');
      ta.value = source;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { /* ignore */ }
      ta.remove();
    }
  }

  return html`
    <div class="codeblock">
      <div class="codeblock-bar">
        <span class="codeblock-label">${label || lang}</span>
        <button class="codeblock-copy" type="button" onClick=${copy}>
          ${copied ? 'copied' : 'copy'}
        </button>
      </div>
      <pre class="codeblock-body"><code
        dangerouslySetInnerHTML=${{ __html: FQ.highlight(source, lang) }} /></pre>
    </div>`;
}

/* ----------------------------------------------------------------- notes */
const NOTES = {
  tip:   { cls: 'note-tip', label: 'note' },
  warn:  { cls: 'note-warn', label: 'watch out' },
  money: { cls: 'note-money', label: 'why it matters in fintech' }
};

function Note({ kind, text }) {
  const meta = NOTES[kind];
  return html`
    <aside class=${'note ' + meta.cls}>
      <span class="note-label">${meta.label}</span>
      ${md(text)}
    </aside>`;
}

/* ----------------------------------------------------------------- table */
function DataTable({ head, rows }) {
  return html`
    <div class="table-wrap">
      <table class="data">
        <thead>
          <tr>${head.map((h, i) => html`<th key=${i}>${md(h)}</th>`)}</tr>
        </thead>
        <tbody>
          ${rows.map((row, r) => html`
            <tr key=${r}>${row.map((cell, c) => html`<td key=${c}>${md(cell)}</td>`)}</tr>`)}
        </tbody>
      </table>
    </div>`;
}

/* ------------------------------------------------------------------ lists */
function List({ items, ordered }) {
  const Tag = ordered ? 'ol' : 'ul';
  return html`<${Tag}>${items.map((item, i) => html`<li key=${i}>${md(item)}</li>`)}<//>`;
}

/* --------------------------------------------------------------- renderer */
export function Blocks({ blocks }) {
  if (!blocks || !blocks.length) return null;

  return html`<div class="prose">
    ${blocks.map((b, i) => {
      if (b.h) return html`<h3 key=${i}>${md(b.h)}</h3>`;
      if (b.h4) return html`<h4 key=${i}>${md(b.h4)}</h4>`;
      if (b.p) return html`<p key=${i}>${md(b.p)}</p>`;
      if (b.ul) return html`<${List} key=${i} items=${b.ul} />`;
      if (b.ol) return html`<${List} key=${i} items=${b.ol} ordered />`;
      if (b.code) return html`<${CodeBlock} key=${i} code=${b.code} lang=${b.lang} label=${b.label} />`;
      if (b.tip) return html`<${Note} key=${i} kind="tip" text=${b.tip} />`;
      if (b.warn) return html`<${Note} key=${i} kind="warn" text=${b.warn} />`;
      if (b.money) return html`<${Note} key=${i} kind="money" text=${b.money} />`;
      if (b.table) return html`<${DataTable} key=${i} head=${b.table.head} rows=${b.table.rows} />`;
      return null;
    })}
  </div>`;
}
