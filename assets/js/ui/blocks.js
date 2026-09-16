/* =========================================================================
   Curriculum content blocks -> Radix components.
   The level files stay plain data; this decides how each block type looks.
   ========================================================================= */
import {
  html, useState, FQ, md, Box, Heading, Text, Callout, Table, Button
} from './lib.js';

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
    <div className="codeblock">
      <div className="codeblock-bar">
        <span className="codeblock-label">${label || lang}</span>
        <${Button} size="1" variant="ghost" color="gray" onClick=${copy}>
          ${copied ? 'Copied' : 'Copy'}
        <//>
      </div>
      <pre className="codeblock-body"><code
        dangerouslySetInnerHTML=${{ __html: FQ.highlight(source, lang) }} /></pre>
    </div>`;
}

/* ----------------------------------------------------------------- callout */
const CALLOUTS = {
  tip: { color: 'jade', label: 'Tip' },
  warn: { color: 'amber', label: 'Watch out' },
  money: { color: 'violet', label: 'Why it matters in fintech' }
};

function Note({ kind, text }) {
  const meta = CALLOUTS[kind];
  return html`
    <${Callout.Root} color=${meta.color} variant="surface" my="4" className="note">
      <${Callout.Text}>
        <span className="note-label">${meta.label}</span>
        ${md(text)}
      <//>
    <//>`;
}

/* ------------------------------------------------------------------ table */
function DataTable({ head, rows }) {
  return html`
    <${Box} my="4" className="data-table">
      <${Table.Root} variant="surface" size="1" layout="auto">
        <${Table.Header}>
          <${Table.Row}>
            ${head.map((h, i) => html`<${Table.ColumnHeaderCell} key=${i}>${md(h)}<//>`)}
          <//>
        <//>
        <${Table.Body}>
          ${rows.map((row, r) => html`
            <${Table.Row} key=${r}>
              ${row.map((cell, c) => c === 0
                ? html`<${Table.RowHeaderCell} key=${c}>${md(cell)}<//>`
                : html`<${Table.Cell} key=${c}>${md(cell)}<//>`)}
            <//>`)}
        <//>
      <//>
    <//>`;
}

/* ------------------------------------------------------------------ lists */
function List({ items, ordered }) {
  const Tag = ordered ? 'ol' : 'ul';
  return html`
    <${Tag} className=${'prose-list' + (ordered ? ' ordered' : '')}>
      ${items.map((item, i) => html`
        <li key=${i}><${Text} size="3" color="gray" as="span">${md(item)}<//></li>`)}
    <//>`;
}

/* ---------------------------------------------------------------- renderer */
export function Blocks({ blocks }) {
  if (!blocks || !blocks.length) return null;

  return html`<${Box} className="prose">
    ${blocks.map((b, i) => {
      if (b.h) {
        return html`
          <${Heading} key=${i} as="h3" size="5" mt="6" mb="3" className="prose-h">
            ${md(b.h)}
          <//>`;
      }
      if (b.h4) {
        return html`
          <${Heading} key=${i} as="h4" size="3" mt="5" mb="2" color="jade">${md(b.h4)}<//>`;
      }
      if (b.p) {
        return html`<${Text} key=${i} as="p" size="3" color="gray" mb="3">${md(b.p)}<//>`;
      }
      if (b.ul) return html`<${List} key=${i} items=${b.ul} />`;
      if (b.ol) return html`<${List} key=${i} items=${b.ol} ordered />`;
      if (b.code) return html`<${CodeBlock} key=${i} code=${b.code} lang=${b.lang} label=${b.label} />`;
      if (b.tip) return html`<${Note} key=${i} kind="tip" text=${b.tip} />`;
      if (b.warn) return html`<${Note} key=${i} kind="warn" text=${b.warn} />`;
      if (b.money) return html`<${Note} key=${i} kind="money" text=${b.money} />`;
      if (b.table) return html`<${DataTable} key=${i} head=${b.table.head} rows=${b.table.rows} />`;
      return null;
    })}
  <//>`;
}
