/* =========================================================================
   The launchpad: a gate, then three steps, each one line of text and one
   picture.

   The structure is deliberate and the discipline is the point. The left
   column may hold a title, a subtitle and the controls. Nothing else goes
   there: no paragraph, no bullet list, no second thought. Everything that
   wants to be explained has to be drawn in the right panel instead, which is
   what keeps the screen quiet.

   Two rules carried over from the version before this one.

   Nothing is claimed that was not measured. The chart in step two compares a
   crowded field against a scarce one and says underneath that it is a
   relationship rather than a count, because a bar labelled with a percentile
   nobody measured is a fabricated statistic and a reader never sees the word
   illustrative. The three lines step three prints are real figures from the
   course: 400,000 entries and 0.106 ms from level 6, 16,639 settlement lines
   from level 10.

   The company names are text, never logos, and they say where this kind of
   work is done rather than who endorses this.
   ========================================================================= */
import { html, useState, useEffect, useCallback, FQ, store, Btn } from './lib.js';

/* The labels are the job each ladder is aimed at, taken from the outcome and
   final badge in content/tracks.js. A grander name than the course delivers is
   a promise it cannot keep. */
const TRACKS = [
  { id: 'eng', tone: 'blue',   label: 'Backend engineer',  firms: ['Stripe', 'Adyen'] },
  { id: 'fpa', tone: 'violet', label: 'Financial analyst', firms: ['Capital One', 'Chime'] },
];

const VERIFY = [
  { tag: 'ledger', text: '400,000 entries, balanced', tone: 'ok' },
  { tag: 'index',  text: 'account balance in 0.106 ms', tone: 'accent' },
  { tag: 'recon',  text: '16,639 lines, every difference explained', tone: 'ok' },
];

const STEPS = [
  { title: 'Choose your track.', sub: 'Two ladders with separate ranks. You can switch later.' },
  { title: 'The entry-level stack is saturated.', sub: 'A to-do app does not show that you can handle money.' },
  { title: 'Build deep infrastructure.', sub: 'Systems that survive retries and reconcile to the cent.' },
];

export function Launchpad({ onLaunch }) {
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState(store.track().id);
  const [verified, setVerified] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const last = step === STEPS.length - 1;

  useEffect(() => {
    if (!leaving) return undefined;
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t = setTimeout(() => onLaunch(picked), calm ? 0 : 400);
    return () => clearTimeout(t);
  }, [leaving, picked, onLaunch]);

  const next = useCallback(() => {
    if (last) setLeaving(true);
    else setStep((n) => n + 1);
  }, [last]);

  /* ------------------------------------------------------ the right panel */
  const trackPanel = html`
    <div class="lp-selects">
      ${TRACKS.map((t) => {
        const on = picked === t.id;
        return html`
          <button key=${t.id} type="button"
            class=${`lp-select tone-${t.tone}${on ? ' is-picked' : ''}`}
            aria-pressed=${on ? 'true' : 'false'}
            onClick=${() => setPicked(t.id)}>
            <span class="lp-select-name">${t.label}</span>
            <span class="lp-select-firms">
              ${t.firms.map((f, i) => html`
                <span key=${f}>${i ? html`<i class="lp-sep">|</i>` : null}${f}</span>`)}
            </span>
          </button>`;
      })}
    </div>`;

  const marketPanel = html`
    <div class="lp-plot">
      <div class="lp-plot-row">
        <span class="lp-plot-label">Generic portfolios</span>
        <span class="lp-plot-bar is-crowd"><i style=${{ width: '100%' }}></i></span>
      </div>
      <div class="lp-plot-row">
        <span class="lp-plot-label">Fintech infrastructure</span>
        <span class="lp-plot-bar is-rare"><i style=${{ width: '14%' }}></i></span>
      </div>
      <p class="lp-plot-note">
        A relationship, not a count. Nobody measured this for you, and a bar with a
        percentage on it would be pretending somebody had.
      </p>
    </div>`;

  const buildPanel = html`
    <div class="lp-verify">
      <div class="lp-verify-bar">
        <span>architecture</span>
        <button type="button" class="lp-run" onClick=${() => setVerified(true)} disabled=${verified}>
          <span class="lp-run-tri" aria-hidden="true"></span>
          ${verified ? 'Verified' : 'Verify Architecture'}
        </button>
      </div>
      <pre class="lp-verify-out"><code>${verified
        ? VERIFY.map((l) => html`<span class=${`lp-out is-${l.tone}`} key=${l.tag}>ok  ${l.tag}  ${l.text}
</span>`)
        : html`<span class="lp-out is-idle">awaiting verification
</span>`}</code></pre>
    </div>`;

  const panels = [trackPanel, marketPanel, buildPanel];

  /* ------------------------------------------------------------- the gate */
  if (!started) {
    return html`
      <div class="launchpad">
        <div class="lp-glow" aria-hidden="true">
          <span class="lp-orb lp-orb-a"></span>
          <span class="lp-orb lp-orb-b"></span>
          <span class="lp-orb lp-orb-c"></span>
        </div>
        <div class="lp-gate">
          <h1 class="lp-gate-title">The shortest path to production.</h1>
          <p class="lp-gate-sub">Build what a fintech company runs on: a ledger, a payments API, and a job that reconciles to the cent.</p>
          <${Btn} variant="accent" onClick=${() => setStarted(true)}>Get Started<//>
        </div>
      </div>`;
  }

  /* ----------------------------------------------------------- the wizard */
  const s = STEPS[step];
  return html`
    <div class=${'launchpad' + (leaving ? ' is-leaving' : '')}>
      <div class="lp-glow" aria-hidden="true">
        <span class="lp-orb lp-orb-a"></span>
        <span class="lp-orb lp-orb-b"></span>
        <span class="lp-orb lp-orb-c"></span>
      </div>

      <div class="lp-wizard">
        <div class="lp-left">
          <div class="lp-left-top">
            <h1 class="lp-title">${s.title}</h1>
            <p class="lp-sub">${s.sub}</p>
          </div>

          <div class="lp-controls">
            <ol class="lp-dots" aria-label=${`Step ${step + 1} of ${STEPS.length}`}>
              ${STEPS.map((_, i) => html`
                <li key=${i} class=${'lp-dot' + (i === step ? ' is-on' : '') + (i < step ? ' is-done' : '')}></li>`)}
            </ol>
            <div class="lp-btns">
              <button type="button" class="lp-back" disabled=${step === 0}
                onClick=${() => setStep((n) => Math.max(0, n - 1))}>Back</button>
              <${Btn} variant="accent" arrow onClick=${next}>
                ${last ? 'Continue' : 'Continue'}
              <//>
            </div>
          </div>
        </div>

        <div class="lp-right">${panels[step]}</div>
      </div>
    </div>`;
}
