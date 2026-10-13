/* =========================================================================
   The launchpad: four screens, one centre line.

   Everything stacks down the middle and the reader never has to decide which
   half of the page to look at. The two-column version put a title on the left
   and a picture on the right, which on a wide screen read as two half-empty
   halves.

   Three rules survive from every earlier version of this file.

   Nothing is claimed that was not measured. The three figures on the last
   screen are real: 400,000 entries and 0.106 ms from level 6, 16,639
   settlement lines from level 10. The percentage bars that used to sit on
   screen three are gone, because a bar labelled with a percentile nobody
   measured is a fabricated statistic however honest the caption under it is.
   A sentence can make the same point without pretending to be data.

   The company names are text, never logos, and they say where this kind of
   work is done rather than who endorses this.

   Motion is gated. Every animation here is an enhancement of a state that is
   already correct and already visible, so a reader with reduced motion on, or
   a renderer that never runs the effect, sees the finished screen.
   ========================================================================= */
import { html, useState, useEffect, useRef, useCallback, store, Btn } from './lib.js';
import { animate, stagger } from 'motion';

const CALM = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* The labels are the job each ladder is aimed at, taken from the outcome and
   final badge in content/tracks.js. A grander name than the course delivers is
   a promise it cannot keep. */
const TRACKS = [
  {
    id: 'eng', tone: 'blue', label: 'Software engineer',
    sub: 'Build production-grade backend infrastructure and the system integrations ' +
         'companies like Stripe, Adyen and Chime run on.',
  },
  {
    id: 'fpa', tone: 'violet', label: 'Financial analyst',
    sub: 'Learn the technical toolkits, analytical frameworks and data tools that ' +
         'modern financial models are built with.',
  },
];

/* Screen three: two sentences, no chart, and it answers to the track chosen on
   screen two. A finance student and a computer science student are not failing
   the same screen, so they should not be shown the same one.

   The figures in the FinQuest half are the levels' own: 3,778 invoices and 235
   merchants from fpa-02, 39 milliseconds from fpa-03, fifteen months across
   four scenarios from fpa-04, 400,000 entries from level 6 and 16,639
   settlement lines from level 10. Nothing here was estimated. */
const COMPARE = {
  eng: {
    title: 'The entry-level stack is saturated.',
    sub: 'Writing code is no longer the scarce part.',
    rows: [
      { label: 'the market', tone: 'muted',
        text: 'Computer science graduates sit at 7.0% unemployment and computer ' +
              'engineering at 7.8%, the second highest of 73 majors. Across all ' +
              'majors it is 4.2%.',
        source: 'New York Fed, outcomes by major, 2024 census data' },
      { label: 'what finquest gives you', tone: 'bright',
        text: 'You finish holding the work a screen asks about: a ledger that balances ' +
              'across 400,000 entries, an HTTP API other systems depend on, and a ' +
              'reconciliation job that explains every difference across 16,639 ' +
              'settlement lines.' },
    ],
  },
  fpa: {
    title: 'Excel is no longer enough.',
    sub: 'The analyst work that gets noticed is the part you stopped doing by hand.',
    rows: [
      { label: 'the market', tone: 'muted',
        text: '39.4% of recent graduates are underemployed, in jobs that do not require ' +
              'a degree. Finance is not the worst hit, which is the point: the degree ' +
              'alone does not separate you from everyone else holding one.',
        source: 'New York Fed, outcomes by major, 2024 census data' },
      { label: 'what finquest gives you', tone: 'bright',
        text: 'You finish holding the technical half of the job: ten questions answered ' +
              'from 3,778 invoices in SQL, the same close pack rebuilt in pandas so it ' +
              'runs in 39 milliseconds, and a fifteen-month model that balances across ' +
              'all four scenarios.' },
    ],
  },
};

/* Screen four. Every figure here came out of running the course's own code. */
const SIGNALS = [
  { id: 'ledger', name: 'Ledger balance', value: '400,000 entries verified', tone: 'ok' },
  { id: 'index',  name: 'Index latency',  value: '0.106 ms response',        tone: 'accent' },
  { id: 'recon',  name: 'Reconciliation', value: '16,639 lines to the cent', tone: 'ok' },
];

/* Screen three takes its heading from COMPARE, so the title and the two cards
   can never disagree about which track the reader picked. */
const STEPS = [
  { title: 'Choose your track.', sub: 'Two ladders with separate ranks. You can switch later.' },
  null,
  { title: 'Build deep infrastructure.', sub: 'Systems that survive retries and reconcile to the cent.' },
];

export function Launchpad({ onLaunch }) {
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  /* store.track() is the track id, the way every caller in views.js reads it.
     This asked for .id on the string, so picked started undefined: no card
     showed as chosen on arrival, screen three always fell back to the
     engineering copy, and onLaunch handed setTrack an undefined it rejected. */
  const [picked, setPicked] = useState(store.track());
  const [leaving, setLeaving] = useState(false);
  const stackRef = useRef(null);

  const last = step === STEPS.length - 1;

  /* Each screen's rows rise in sequence. The rows are already in place and
     already opaque; this animates from a visible resting state, so nothing
     depends on the effect running. */
  useEffect(() => {
    const el = stackRef.current;
    if (!el || CALM()) return;
    const rows = el.querySelectorAll('[data-rise]');
    if (!rows.length) return;
    animate(rows, { opacity: [0, 1], transform: ['translateY(14px)', 'translateY(0px)'] },
            { delay: stagger(0.07), duration: 0.55, ease: [0.16, 1, 0.3, 1] });
  }, [started, step]);

  useEffect(() => {
    if (!leaving) return undefined;
    const t = setTimeout(() => onLaunch(picked), CALM() ? 0 : 380);
    return () => clearTimeout(t);
  }, [leaving, picked, onLaunch]);

  const next = useCallback(() => {
    if (last) setLeaving(true);
    else setStep((n) => n + 1);
  }, [last]);

  /* ------------------------------------------------------------- screen 1 */
  if (!started) {
    return html`
      <div class="launchpad" ref=${stackRef}>
        <div class="lp-stack">
          <h1 class="lp-title lp-title-xl" data-rise>The shortest path to learn fintech.</h1>
          <ul class="lp-pills" data-rise>
            <li class="lp-pill tone-blue">For computer science students</li>
            <li class="lp-pill tone-violet">For finance students</li>
          </ul>
          <p class="lp-sub lp-sub-wide" data-rise>
            Build what a fintech company runs on: a ledger, a payments API, and a job
            that reconciles to the cent.
          </p>
          <div data-rise>
            <${Btn} variant="accent" onClick=${() => setStarted(true)}>Get started<//>
          </div>
        </div>
      </div>`;
  }

  /* ------------------------------------------------------- screens 2 to 4 */
  const compare = COMPARE[picked] || COMPARE.eng;
  const s = STEPS[step] || compare;
  return html`
    <div class=${'launchpad' + (leaving ? ' is-leaving' : '')} ref=${stackRef}>
      <div class="lp-stack">
        <h1 class="lp-title" data-rise>${s.title}</h1>
        <p class="lp-sub" data-rise>${s.sub}</p>

        <div class="lp-panel" data-rise>
          ${step === 0 ? html`
            <div class="lp-selects">
              ${TRACKS.map((t) => {
                const on = picked === t.id;
                return html`
                  <button key=${t.id} type="button"
                    class=${`lp-select tone-${t.tone}${on ? ' is-picked' : ''}`}
                    aria-pressed=${on ? 'true' : 'false'}
                    onClick=${() => setPicked(t.id)}>
                    <span class="lp-select-name">${t.label}</span>
                    <span class="lp-select-sub">${t.sub}</span>
                  </button>`;
              })}
            </div>` : null}

          ${step === 1 ? html`
            <div class="lp-compare">
              ${compare.rows.map((c) => html`
                <div class=${`lp-compare-row is-${c.tone}`} key=${c.label}>
                  <span class="lp-compare-label">${c.label}</span>
                  <p class="lp-compare-text">${c.text}</p>
                  ${c.source ? html`<span class="lp-compare-source">${c.source}</span>` : null}
                </div>`)}
            </div>` : null}

          ${step === 2 ? html`
            <div class="lp-signals">
              <div class="lp-signals-bar">
                <span>system traffic</span>
                <span class="lp-live"><i class="lp-live-dot" aria-hidden="true"></i>live</span>
              </div>
              <ul class="lp-signal-list">
                ${SIGNALS.map((g) => html`
                  <li class=${`lp-signal is-${g.tone}`} key=${g.id}>
                    <i class="lp-signal-dot" aria-hidden="true"></i>
                    <span class="lp-signal-name">${g.name}</span>
                    <span class="lp-signal-value">${g.value}</span>
                  </li>`)}
              </ul>
            </div>` : null}
        </div>

        <div class="lp-controls" data-rise>
          <ol class="lp-dots" aria-label=${`Step ${step + 1} of ${STEPS.length}`}>
            ${STEPS.map((_, i) => html`
              <li key=${i} class=${'lp-dot' + (i === step ? ' is-on' : '') + (i < step ? ' is-done' : '')}></li>`)}
          </ol>
          <div class="lp-btns">
            <button type="button" class="lp-back" disabled=${step === 0}
              onClick=${() => setStep((n) => Math.max(0, n - 1))}>Back</button>
            <${Btn} variant="accent" arrow onClick=${next}>Continue<//>
          </div>
        </div>
      </div>
    </div>`;
}
