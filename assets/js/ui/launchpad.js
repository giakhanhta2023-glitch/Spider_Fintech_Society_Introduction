/* =========================================================================
   The launchpad: the one screen a new account sees before the ladder.

   It exists to answer the question somebody has in the four seconds after
   signing in: does this get me the job. So it does three things and stops: it says what
   the curriculum builds, it names the kind of work it is aimed at, and it
   makes the reader choose a track, because a chosen track is what every
   count on every later page is counting.

   On the company names. They are set as text, never as logos, and the line
   above them says where the demand is rather than who endorses this. None of
   these companies has any relationship with a student society in Richmond,
   and a row of real logos under a trust banner would imply one. The course
   already names them where it is a fact about the work: level 18 for the JVM
   teams, level 20.1 for the Ruby monolith.

   Shown once. storage.markLaunched() is what stops it returning, and the
   reader can always change track from the switch above the index.
   ========================================================================= */
import { html, useState, useEffect, FQ, store, Btn } from './lib.js';

const FIRMS = ['Stripe', 'Adyen', 'Capital One', 'Chime'];

const TRACKS = [
  {
    id: 'eng',
    tone: 'blue',
    head: 'Backend and systems infrastructure',
    focus: 'Double-entry ledgers in Postgres, an idempotent payments API, the card lifecycle, '
         + 'reconciliation at 16,639 lines, and a schema migration on 200 million rows with the '
         + 'product still up.',
    badge: 'Prepares for: core engineering, payments and platform teams',
    badgeTone: 'blue',
  },
  {
    id: 'fpa',
    tone: 'violet',
    head: 'Quantitative strategy and forensic audits',
    focus: 'The month end close in SQL, the manual part in pandas, a three statement model that '
         + 'ties to the cent, and a reporting pack that rebuilds itself and refuses to print when '
         + 'the numbers disagree.',
    badge: 'Prepares for: risk operations, quant strategy, financial analytics',
    badgeTone: 'emerald',
  },
];

export function Launchpad({ onLaunch }) {
  const [picked, setPicked] = useState(store.track().id);
  const [leaving, setLeaving] = useState(false);

  /* The fade is an exit, so it owns the timing: the screen is gone when the
     transition ends rather than on a timer that hopes to match it. A reader
     who prefers reduced motion skips straight through. */
  useEffect(() => {
    if (!leaving) return undefined;
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t = setTimeout(() => onLaunch(picked), calm ? 0 : 520);
    return () => clearTimeout(t);
  }, [leaving, picked, onLaunch]);

  /* ladderIn is the numbered twenty, which is the number the reader was sold;
     levelsIn includes the optional language asides, which is the number of
     things there are to build. */
  const counts = (id) => ({
    levels: FQ.ladderIn(id).length,
    builds: FQ.levelsIn(id).filter((l) => l.project).length,
  });

  return html`
    <div class=${'launchpad' + (leaving ? ' is-leaving' : '')}>
      <div class="page">

        <section class="lp-hero">
          <h1 class="display">The shortest path to production.</h1>
          <p class="lp-sub">
            Stop building trivial apps. Build fintech infrastructure that survives real load and
            deliberate failure, and finish with repositories a reviewer can open.
          </p>
        </section>

        <section class="lp-firms">
          <span class="lp-firms-label">Curriculum aimed at infrastructure demand at</span>
          <ul class="lp-firms-row">
            ${FIRMS.map((name) => html`<li key=${name}>${name}</li>`)}
          </ul>
        </section>

        <section class="lp-tracks">
          ${TRACKS.map((t) => {
            const meta = FQ.track(t.id);
            const n = counts(t.id);
            const on = picked === t.id;
            return html`
              <button
                key=${t.id}
                type="button"
                class=${`lp-card tone-${t.tone}${on ? ' is-picked' : ''}`}
                aria-pressed=${on ? 'true' : 'false'}
                onClick=${() => setPicked(t.id)}>
                <span class="lp-card-track">${meta ? meta.name : t.id} track</span>
                <span class="lp-card-head">${t.head}</span>
                <span class="lp-card-focus">${t.focus}</span>
                <span class="lp-card-counts">
                  <b>${n.levels}</b> levels <i>/</i> <b>${n.builds}</b> things to build
                </span>
                <span class=${`status status-${t.badgeTone === 'emerald' ? 'ok' : 'live'} lp-badge`}>
                  ${t.badge}
                </span>
              </button>`;
          })}
        </section>

        <section class="lp-go">
          <${Btn} variant="accent" arrow onClick=${() => setLeaving(true)}>
            Initialize ${(FQ.track(picked) || {}).name || ''} track
          <//>
          <p class="lp-note">You can switch tracks at any time from the list.</p>
        </section>

      </div>
    </div>`;
}
