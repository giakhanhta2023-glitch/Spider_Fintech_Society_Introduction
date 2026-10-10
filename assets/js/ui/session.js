/* =========================================================================
   The front page shows the thing the course makes.

   It used to open with a headline and a rabbit, which told you the name of the
   society and nothing about the work. This is a real session against the
   ledger from level 4: one transfer becomes two entries, equal and opposite,
   and the ledger still sums to zero. That is the idea every later level is
   built on, and it fits in eight lines.

   Every line below was produced by running solutions/level-04/ledger.py. The
   alignment comes from the f-string in the code rather than from spaces typed
   to make it look tidy.

   It types itself in once. Not for decoration: a static block says the course
   contains code, and a running one says the code works, which is the whole
   claim. Anybody who has asked for reduced motion gets the finished state
   immediately, because the point is the result rather than the typing.
   ========================================================================= */
import { html, useState, useEffect, FQ } from './lib.js';

const CALM = typeof window !== 'undefined'
  && window.matchMedia
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* kind: 'in' is a prompt line, 'cont' its continuation, 'out' what came back. */
const SESSION = [
  { kind: 'in',   text: 'ledger.transfer("alice", "bob", 2500)' },
  { kind: 'out',  text: "'TXN00002'" },
  { kind: 'in',   text: 'for e in ledger.entries[-2:]:' },
  { kind: 'cont', text: '    print(f"{e[\'account\']:<6}{e[\'amount\']:>6}")' },
  { kind: 'out',  text: 'alice  -2500' },
  { kind: 'out',  text: 'bob     2500' },
  { kind: 'in',   text: 'ledger.check_invariant()' },
  { kind: 'out',  text: 'True' },
];

/* Output lands with its input rather than a beat later, because a REPL does
   not pause before answering. */
const DELAY = 190;

export function Session() {
  const [shown, setShown] = useState(CALM ? SESSION.length : 0);

  useEffect(() => {
    if (CALM) return undefined;

    let at = 0;
    const timers = [];
    const step = () => {
      at += 1;
      setShown(at);
      if (at >= SESSION.length) return;
      /* An output line follows its input immediately; a new prompt waits. */
      const next = SESSION[at];
      timers.push(setTimeout(step, next && next.kind === 'out' ? 70 : DELAY));
    };

    timers.push(setTimeout(step, 420));
    return () => timers.forEach(clearTimeout);
  }, []);

  const done = shown >= SESSION.length;

  return html`
    <figure class="session">
      <figcaption class="session-bar">
        <span>python</span>
        <span>the ledger, level 04</span>
      </figcaption>

      <pre class="session-body" aria-label="A Python session against the level 4 ledger"><code
        >${SESSION.slice(0, shown).map((line, i) => html`
          <span class="session-line" key=${i}>
            ${line.kind === 'out'
              ? html`<span class="session-out">${line.text}</span>`
              : html`<span class="session-prompt"
                  >${line.kind === 'cont' ? '... ' : '>>> '}</span
                ><span dangerouslySetInnerHTML=${{ __html: FQ.highlight(line.text, 'python') }} />`}
          </span>`)}${done ? null : html`<span class="session-caret" aria-hidden="true"></span>`}</code></pre>

      <p class="session-note">
        One transfer, two entries, and the books still balance. Everything after
        level 4 is built on that.
      </p>
    </figure>`;
}
