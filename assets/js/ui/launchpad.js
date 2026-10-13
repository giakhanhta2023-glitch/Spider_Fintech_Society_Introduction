/* =========================================================================
   The launchpad: three steps between signing in and the ladder.

   It answers, in order, the three things somebody needs settled before they
   will spend three hundred hours here. Why the usual route stopped working.
   What this builds instead. Which of the two ladders is theirs.

   Two rules this file holds to, because both are easy to break on a page
   whose job is persuasion.

   No invented statistics. The market step argues from what a reader can check
   against their own inbox, and its chart is drawn without a scale, because
   the honest version of a number nobody measured is no number at all. The
   terminal in step two prints figures the course actually produces: 400,000
   entries and a 0.106 ms index scan from level 6, 16,639 settlement lines
   from level 10, 258 ms from the analyst capstone.

   No logos. The company names are text, they say where this kind of work is
   done, and the step says in as many words that they are not partners.

   Shown once: storage.markLaunched() retires it, and only in front of the
   front page, so a bookmark or a tutor link still lands on its level.
   ========================================================================= */
import { html, useState, useEffect, useCallback, FQ, store, Btn } from './lib.js';

/* Unlabelled on purpose. Everyone who has applied for a junior role knows the
   shape; nobody needs a ratio this course never counted. */
const MARKET = [
  { label: 'applicants', bars: 9, tone: 'crowd' },
  { label: 'open roles', bars: 2, tone: 'roles' },
];

const TERMINAL = [
  { tag: 'INIT', text: 'mounting the double-entry ledger, 400,000 entries' },
  { tag: 'BENCH', text: 'account balance on a covering index: 0.106 ms' },
  { tag: 'RECON', text: 'reconciling 16,639 settlement lines against the books' },
  { tag: 'AUDIT', text: 'every difference explained, none invented', ok: true },
  { tag: 'CLOSE', text: 'six stages, 258 ms, exit 0', ok: true },
];

const CHANNELS = [
  {
    id: 'eng',
    tone: 'blue',
    head: 'Backend and platform systems',
    body: 'Ledgers that balance, an API that survives retries, the card lifecycle, '
        + 'reconciliation, and a migration on 200 million rows with the product still up.',
    firms: ['Stripe', 'Adyen'],
  },
  {
    id: 'fpa',
    tone: 'violet',
    head: 'Quantitative strategy and risk audits',
    body: 'The month end close in SQL, the manual work in pandas, a model that ties to the '
        + 'cent, and a pack that refuses to print when the numbers disagree.',
    firms: ['Capital One', 'Chime'],
  },
];

const STEPS = ['The market', 'The work', 'Your track'];

export function Launchpad({ onLaunch }) {
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState(store.track().id);
  const [leaving, setLeaving] = useState(false);

  const last = step === STEPS.length - 1;

  useEffect(() => {
    if (!leaving) return undefined;
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t = setTimeout(() => onLaunch(picked), calm ? 0 : 420);
    return () => clearTimeout(t);
  }, [leaving, picked, onLaunch]);

  const next = useCallback(() => {
    if (last) setLeaving(true);
    else setStep((n) => n + 1);
  }, [last]);

  const counts = (id) => ({
    levels: FQ.ladderIn(id).length,
    builds: FQ.levelsIn(id).filter((l) => l.project).length,
  });

  /* ------------------------------------------------------------- step 1 */
  const market = html`
    <div class="lp-step">
      <h1 class="lp-head">The entry-level market is saturated.</h1>
      <div class="lp-split">
        <div class="lp-col">
          <ul class="lp-points">
            <li>A tutorial project and a to-do app no longer clear an automated screen. They
                describe themselves the same way as everything else in the stack.</li>
            <li>Generalist roles absorb the volume. The postings that still reply quickly are
                the ones asking for something specific you can show.</li>
            <li>Fintech asks the specific question early: what happens to the money when the
                request is retried, the job half fails, or two people press pay at once.</li>
          </ul>
        </div>
        <figure class="lp-chart">
          <figcaption class="lp-chart-title">Junior applicants against open roles</figcaption>
          <div class="lp-chart-plot">
            ${MARKET.map((row) => html`
              <div class="lp-chart-row" key=${row.label}>
                <span class="lp-chart-label">${row.label}</span>
                <span class=${`lp-bars is-${row.tone}`}>
                  ${Array.from({ length: row.bars }, (_, i) => html`<i key=${i}></i>`)}
                </span>
              </div>`)}
          </div>
          <span class="lp-chart-note">A shape, not a measurement. No figure here was counted by us.</span>
        </figure>
      </div>
    </div>`;

  /* ------------------------------------------------------------- step 2 */
  const work = html`
    <div class="lp-step">
      <h1 class="lp-head">Build systems a reviewer will actually open.</h1>
      <div class="lp-split">
        <div class="lp-col">
          <p class="lp-body">
            You will not be writing wrappers around somebody else's API. You will build
            repositories that show idempotency, a schema that refuses money which does not
            balance, failure that is recovered rather than avoided, and arithmetic that is
            exact to the cent.
          </p>
          <p class="lp-body">
            Every number in the panel beside this one is measured on your own machine while
            you build it, rather than claimed on a landing page.
          </p>
        </div>
        <figure class="lp-term">
          <figcaption class="lp-term-bar"><span>build log</span><span>levels 05, 06, 10</span></figcaption>
          <pre class="lp-term-body"><code>${TERMINAL.map((l) => html`<span class="lp-line" key=${l.tag}><span class=${'lp-tag' + (l.ok ? ' is-ok' : '')}>[${l.tag}]</span> ${l.text}
</span>`)}</code></pre>
        </figure>
      </div>
    </div>`;

  /* ------------------------------------------------------------- step 3 */
  const channel = html`
    <div class="lp-step">
      <h1 class="lp-head">Select your infrastructure channel.</h1>
      <p class="lp-body lp-body-wide">
        The two ladders are separate. Whichever you pick is what every count on every later
        page is counting, and you can change it at any time from the list.
      </p>
      <div class="lp-channels">
        ${CHANNELS.map((c) => {
          const meta = FQ.track(c.id);
          const n = counts(c.id);
          const on = picked === c.id;
          return html`
            <button key=${c.id} type="button"
              class=${`lp-card tone-${c.tone}${on ? ' is-picked' : ''}`}
              aria-pressed=${on ? 'true' : 'false'}
              onClick=${() => setPicked(c.id)}>
              <span class="lp-card-track">${meta ? meta.name : c.id} track</span>
              <span class="lp-card-head">${c.head}</span>
              <span class="lp-card-focus">${c.body}</span>
              <span class="lp-firm-row">
                ${c.firms.map((f) => html`<span class="lp-firm" key=${f}>${f}</span>`)}
              </span>
              <span class="lp-card-counts">
                <b>${n.levels}</b> levels <i>/</i> <b>${n.builds}</b> to build
              </span>
            </button>`;
        })}
      </div>
      <p class="lp-foot-note">
        Those names are where this kind of work is done. They are not partners and have not
        endorsed this course.
      </p>
    </div>`;

  const panes = [market, work, channel];

  return html`
    <div class=${'launchpad' + (leaving ? ' is-leaving' : '')}>
      <div class="lp-shell">

        <ol class="lp-rail" aria-label="Introduction progress">
          ${STEPS.map((name, i) => html`
            <li key=${name}
              class=${'lp-rail-item' + (i === step ? ' is-on' : '') + (i < step ? ' is-done' : '')}>
              <span class="lp-rail-num">${String(i + 1).padStart(2, '0')}</span>
              <span class="lp-rail-name">${name}</span>
            </li>`)}
        </ol>

        <div class="lp-pane" key=${step}>${panes[step]}</div>

        <div class="lp-nav">
          <span class="lp-nav-count">Step ${step + 1} of ${STEPS.length}</span>
          <div class="lp-nav-btns">
            <button type="button" class="lp-back" disabled=${step === 0}
              onClick=${() => setStep((n) => Math.max(0, n - 1))}>Back</button>
            <${Btn} variant="accent" arrow onClick=${next}>
              ${last ? `Continue to the ${(FQ.track(picked) || {}).name || ''} track` : 'Continue'}
            <//>
          </div>
        </div>

      </div>
    </div>`;
}
