/* =========================================================================
   Home (masthead and contents index), glossary, dossier, ranking.
   ========================================================================= */
import {
  html, useState, useEffect, useMemo, FQ, CFG, store, md, navigate,
  Gauge, Btn, Tag, SectionHead, AlertDialog
} from './lib.js';
import { Mou } from './mou.js';
import { Companions } from './companions.js';

/* =============================== HOME =============================== */
function IndexRow({ level }) {
  const unlocked = store.isUnlocked(level.id);
  const cleared = store.isCleared(level.id);
  const current = store.currentLevel() === level.id && !cleared;
  const state = store.level(level.id);

  const cls = ['index-row',
    cleared && 'is-done',
    current && 'is-current',
    !unlocked && 'is-locked'].filter(Boolean).join(' ');

  const body = html`
    <span class="index-num">${String(level.id).padStart(2, '0')}</span>

    <span>
      <span class="index-title">${level.title}</span>
      <p class="index-sub">${md(level.tagline)}</p>
    </span>

    <span class="index-meta">
      ${unlocked ? null : html`<${Tag}>locked<//>`}
      <${Tag}><${Gauge} value=${level.difficulty} /><//>
      <${Tag}>${level.minutes} min<//>
      <${Tag} variant=${state.quizPassed ? 'moss' : ''}>
        drill ${state.quizBest}/${level.quiz.length}
      <//>
      <${Tag} variant=${state.projectDone ? 'moss' : ''}>
        ${level.project ? (state.projectDone ? 'shipped' : 'build') : (state.projectDone ? 'ready' : 'setup')}
      <//>
      ${current ? html`<${Tag} variant="accent">you are here<//>` : null}
    </span>`;

  return unlocked
    ? html`<a class=${cls} href=${`#/level/${level.id}`}>${body}</a>`
    : html`<div class=${cls} title=${`Clear level ${level.id - 1} first`}>${body}</div>`;
}

export function Home({ onAskTutor }) {
  const cleared = store.clearedCount();
  const current = store.currentLevel();
  const questions = FQ.levels.reduce((n, l) => n + l.quiz.length, 0);
  const projects = FQ.levels.filter((l) => !!l.project).length;

  return html`
    <div class="page">

      <!-- Masthead: title occupies the left seven columns, the standfirst and
           entry point sit in the right four. Deliberately off-centre. -->
      <section class="section grid">
        <div class="col-1-7">
          <span class="kicker">Spider Fintech Society <b>/</b> ten levels</span>
          <h1 class="display display-xl">
            Learn fintech<br />by building it
          </h1>
          <div style=${{ marginTop: '30px' }}>
            <${Companions} size=${76} />
            <!-- One line, picked by the date rather than at random, so the
                 whole society sees the same one on the same day. -->
            ${(() => {
              const said = FQ.quoteOfTheDay();
              return said ? html`
                <figure class="daily">
                  <span class="daily-label">today</span>
                  <blockquote class="daily-quote">${said.q}</blockquote>
                  <figcaption class="daily-who">${said.who}</figcaption>
                </figure>` : null;
            })()}
          </div>
        </div>

        <div class="col-9-12">
          <p class="lede">
            Every level hands you the knowledge, a walkthrough you can follow along with, a
            15-question drill with a full answer key, and something to build using only what
            you just learned.
          </p>
          <div class="btn-row" style=${{ marginTop: '28px' }}>
            <${Btn} variant="accent" onClick=${() => navigate(`#/level/${current}`)} arrow>
              ${cleared ? `continue level ${current}` : 'start level 01'}
            <//>
            <button class="mou-btn mou-btn-l" type="button" onClick=${onAskTutor}>
              <${Mou} mood="idle" size=${30} title="Mou" />
              <span>meet Mou, your tutor</span>
            </button>
          </div>
        </div>
      </section>

      <!-- The numbers, set as a ruled table rather than four glowing cards. -->
      <div class="datastrip">
        <div><span class="v">${cleared}/10</span><span class="k">levels cleared</span></div>
        <div><span class="v">${questions}</span><span class="k">drill questions</span></div>
        <div><span class="v">${projects}</span><span class="k">things to build</span></div>
        <div><span class="v">${store.xp().toLocaleString()}</span><span class="k">experience</span></div>
      </div>

      <!-- Contents page. -->
      <section class="section">
        <${SectionHead} title="The ten levels"
          note="pass the drill, ship the build, the next level opens" />
        <div class="index">
          ${FQ.levels.map((lv) => html`<${IndexRow} key=${lv.id} level=${lv} />`)}
        </div>
      </section>

      <!-- How a level works, as four numbered columns under one rule. -->
      <section class="section-tight">
        <${SectionHead} title="How a level works" note="the same four, every level" />
        <div class="grid" style=${{ rowGap: '28px' }}>
          ${[
            ['01', 'Learn', 'The ideas, with real numbers worked through and the reasons behind them.'],
            ['02', 'Tutorial', 'Follow along step by step. Everything the build needs is introduced right here.'],
            ['03', 'Drill', `15 questions with instant explanations. ${CFG.quiz.passMark} of 15 opens the build.`],
            ['04', 'Build', 'Something to make using only what you know, with a full solution if you get stuck.']
          ].map(([n, title, body], i) => html`
            <div key=${i} style=${{ gridColumn: 'span 3' }} class="how-col">
              <span class="kicker"><b>${n}</b></span>
              <h3 class="title title-m">${title}</h3>
              <p class="index-sub">${body}</p>
            </div>`)}
        </div>
      </section>
    </div>`;
}

/* ============================= GLOSSARY ============================= */
export function Glossary() {
  const [query, setQuery] = useState('');

  /* Ordered the way the course teaches it: level by level, and alphabetically
     inside each level, so reading top to bottom follows your own progress. */
  const groups = useMemo(() => FQ.levels.map((lv) => ({
    id: lv.id,
    title: lv.title,
    terms: (lv.glossary || [])
      .map((g) => ({ ...g, lv: lv.id, blob: (g.t + ' ' + g.d).toLowerCase() }))
      .sort((a, b) => (a.t.toLowerCase() < b.t.toLowerCase() ? -1 : 1))
  })), []);

  const total = groups.reduce((n, g) => n + g.terms.length, 0);
  const q = query.trim().toLowerCase();
  const shown = groups
    .map((g) => (q ? { ...g, terms: g.terms.filter((t) => t.blob.indexOf(q) !== -1) } : g))
    .filter((g) => g.terms.length);
  const found = shown.reduce((n, g) => n + g.terms.length, 0);

  return html`
    <div class="page">
      <section class="section grid">
        <div class="col-1-7">
          <span class="kicker">${total} words <b>/</b> in the order you meet them</span>
          <h1 class="display display-l">Every word we use</h1>
        </div>
        <div class="col-9-12">
          <p class="lede">
            Every term the course explains, grouped by the level that teaches it. If a word ever
            throws you mid-level, this is the page to come back to.
          </p>
        </div>
      </section>

      <input class="search" type="search" value=${query} autoComplete="off"
        placeholder="type a word, try idempotency or drawdown"
        onInput=${(e) => setQuery(e.target.value)} />

      ${q ? html`
        <p class="mono" style=${{ marginTop: '14px' }}>
          ${found} ${found === 1 ? 'word' : 'words'} match that
        </p>` : null}

      <section class="section-tight">
        ${shown.length === 0
          ? html`<p class="notice">Nothing matches that one. Try a shorter word, or just ask the tutor.</p>`
          : shown.map((g) => html`
            <div key=${g.id} style=${{ marginBottom: '44px' }}>
              <${SectionHead} title=${`Level ${String(g.id).padStart(2, '0')}, ${g.title}`}
                note=${html`
                  ${g.terms.length} ${g.terms.length === 1 ? 'word' : 'words'}
                  ${' '}<a class="link" href=${`#/level/${g.id}`}>open the level →</a>`} />
              <dl class="deflist" style=${{ borderTop: 0 }}>
                ${g.terms.map((t, i) => html`
                  <div class="defrow" key=${i}>
                    <dt>${t.t}</dt>
                    <dd>${md(t.d)}</dd>
                  </div>`)}
              </dl>
            </div>`)}
      </section>
    </div>`;
}

/* ============================== DOSSIER ============================== */
export function Dossier({ onReset, user }) {
  const [confirming, setConfirming] = useState(false);
  const all = store.all();
  const cleared = store.clearedCount();
  const rank = store.rank();
  const article = /^[aeiou]/i.test(rank) ? 'an' : 'a';

  let quizzes = 0, projects = 0, answered = 0, totalQ = 0;
  FQ.levels.forEach((lv) => {
    const st = store.level(lv.id);
    if (st.quizPassed) quizzes++;
    if (st.projectDone) projects++;
    answered += st.quizBest;
    totalQ += lv.quiz.length;
  });

  return html`
    <div class="page">
      <section class="section grid">
        <div class="col-1-7">
          <span class="kicker">
            ${user ? html`saved to your account <b>/</b> and to the ranking`
                   : html`saved on this device <b>/</b> nothing is uploaded`}
          </span>
          <h1 class="display display-l">How you are doing</h1>
        </div>
        <div class="col-9-12">
          <p class="lede">
            You are ${article} <strong>${rank}</strong> so far.
            ${user ? html`${' '}This is saved to your account, so it follows you to any device you
              sign in on, and your name with these two numbers appears on the
              ${' '}<a class="link" href="#/ranking">ranking</a>.`
                   : html`${' '}Everything on this page is kept in this browser, so it never leaves
              your device.`}
          </p>
        </div>
      </section>

      <div class="datastrip">
        <div><span class="v">${all.xp.toLocaleString()}</span><span class="k">experience</span></div>
        <div><span class="v">${cleared}/10</span><span class="k">levels cleared</span></div>
        <div><span class="v">${quizzes}/10</span><span class="k">drills passed</span></div>
        <div><span class="v">${answered}/${totalQ}</span><span class="k">best answers</span></div>
      </div>

      <section class="section-tight">
        <${SectionHead} title="Badges" note=${`${store.all().badges.length} of ${store.BADGES.length}`} />
        <div class="grid" style=${{ rowGap: '16px' }}>
          ${store.BADGES.map((b) => {
            const got = store.badgeEarned(b.id);
            return html`
              <div key=${b.id} style=${{ gridColumn: 'span 3' }}
                class=${'medal ' + (got ? 'is-earned' : 'is-locked')}>
                <span class="ico">${b.ico}</span>
                <b>${b.name}</b>
                <span>${got ? 'earned' : b.hint}</span>
              </div>`;
          })}
        </div>
      </section>

      <section class="section-tight">
        <${SectionHead} title="Level by level" note="click a row to open it" />
        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr><th>level</th><th>best drill</th><th>attempts</th><th>build</th><th>status</th></tr>
            </thead>
            <tbody>
              ${FQ.levels.map((lv) => {
                const st = store.level(lv.id);
                const status = store.isCleared(lv.id) ? 'cleared'
                  : store.isUnlocked(lv.id) ? 'open' : 'locked';
                return html`
                  <tr key=${lv.id}>
                    <td><a class="link" href=${`#/level/${lv.id}`}>
                      ${String(lv.id).padStart(2, '0')} ${lv.title}</a></td>
                    <td><span class="figure">${st.quizBest}/${lv.quiz.length}</span></td>
                    <td><span class="figure">${st.attempts || 0}</span></td>
                    <td><span class="figure">${st.projectDone ? 'yes' : 'no'}</span></td>
                    <td><${Tag} variant=${status === 'cleared' ? 'moss' : status === 'open' ? 'accent' : ''}>
                      ${status}<//></td>
                  </tr>`;
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section class="section-tight">
        <${SectionHead} title="Starting over" />
        <div class="grid">
          <div class="col-1-7">
            <p class="index-sub" style=${{ maxWidth: '52ch' }}>
              This wipes your experience, badges, scores and ticked boxes${user
                ? ', here and in your account, which takes you back to the bottom of the ranking'
                : ' on this device'}.
              Your notebooks and GitHub repos are left exactly as they are.
            </p>
          </div>
          <div class="col-9-12">
            <${AlertDialog.Root} open=${confirming} onOpenChange=${setConfirming}>
              <${AlertDialog.Trigger}>
                <button class="btn btn-quiet">erase everything</button>
              <//>
              <${AlertDialog.Content} maxWidth="440px" class="panel">
                <${AlertDialog.Title} class="title title-m">Erase all progress?<//>
                <${AlertDialog.Description}>
                  <p class="index-sub">
                    This clears every score, badge and checklist${user
                      ? ' in this browser and in your account'
                      : ' stored in this browser'}. It cannot be undone.
                  </p>
                <//>
                <div class="btn-row" style=${{ marginTop: '22px' }}>
                  <${AlertDialog.Cancel}><button class="btn btn-quiet">keep it</button><//>
                  <${AlertDialog.Action}>
                    <button class="btn" onClick=${onReset}>erase everything</button>
                  <//>
                </div>
              <//>
            <//>
          </div>
        </div>
      </section>
    </div>`;
}

/* ============================== RANKING ==============================
   The one page that shows other people. It reads /api/leaderboard, which
   returns a name, two numbers and a position for each member and nothing
   else, so there is no email or photo here to leak or to look at. */
export function Ranking() {
  const [state, setState] = useState({ status: 'loading', board: [], you: null, total: 0 });

  useEffect(() => {
    let cancelled = false;
    fetch('/api/leaderboard', { credentials: 'same-origin' })
      .then(async (r) => {
        /* No functions behind `python serve.py`, so the board is a deployment
           only feature and says so rather than looking broken. */
        if (r.status === 404) return { status: 'no-backend' };
        if (r.status === 401) return { status: 'signed-out' };
        if (!r.ok) return { status: 'error' };
        const data = await r.json();
        return {
          status: 'ready',
          board: data.board || [],
          you: data.you || null,
          total: data.total || 0
        };
      })
      .catch(() => ({ status: 'error' }))
      .then((next) => { if (!cancelled) setState(next); });
    return () => { cancelled = true; };
  }, []);

  const rankOf = (cleared) => CFG.ranks[Math.min(cleared, CFG.ranks.length - 1)];

  const notice = {
    loading: 'Reading the board...',
    'no-backend': 'The ranking lives on the deployed site, because it needs the database. ' +
                  'Running the course locally shows you everything else.',
    'signed-out': 'Sign in again to see the ranking.',
    error: 'The board could not be reached. Try again in a moment.'
  }[state.status];

  return html`
    <div class="page">
      <section class="section grid">
        <div class="col-1-7">
          <span class="kicker">everyone who has signed in</span>
          <h1 class="display display-l">The ranking</h1>
        </div>
        <div class="col-9-12">
          <p class="lede">
            Ordered by levels cleared first, then experience. A level counts once its drill is
            passed and its build is marked done, which is the same rule your own page uses.
          </p>
        </div>
      </section>

      ${notice ? html`<p class="notice" style=${{ maxWidth: '58ch' }}>${notice}</p>` : null}

      ${state.status === 'ready' ? html`
        <div class="datastrip">
          <div>
            <span class="v">${state.total}</span>
            <span class="k">${state.total === 1 ? 'member' : 'members'}</span>
          </div>
          <div>
            <span class="v">${state.you ? '#' + state.you.pos : '--'}</span>
            <span class="k">where you sit</span>
          </div>
          <div>
            <span class="v">${state.you ? state.you.cleared : 0}/10</span>
            <span class="k">your levels</span>
          </div>
          <div>
            <span class="v">${(state.you ? state.you.xp : 0).toLocaleString()}</span>
            <span class="k">your experience</span>
          </div>
        </div>

        <section class="section-tight">
          <${SectionHead} title="Member by member"
            note=${state.total === 1 ? 'nobody else yet' : 'you are highlighted'} />
          <div class="table-wrap">
            <table class="data board">
              <thead>
                <tr>
                  <th>#</th><th>member</th><th class="col-wide">rank</th>
                  <th>levels</th><th>xp</th><th class="col-wide">last seen</th>
                </tr>
              </thead>
              <tbody>
                ${state.board.map((row) => html`
                  <tr key=${row.pos} class=${row.you ? 'is-you' : ''}>
                    <td><span class="figure">${row.pos}</span></td>
                    <td>
                      ${row.name}
                      ${row.you ? html`${' '}<${Tag} variant="accent">you<//>` : null}
                    </td>
                    <td class="col-wide"><span class="mono-s">${rankOf(row.cleared)}</span></td>
                    <td><span class="figure">${row.cleared}/10</span></td>
                    <td><span class="figure">${row.xp.toLocaleString()}</span></td>
                    <td class="col-wide"><span class="mono-s">${row.active || 'not yet'}</span></td>
                  </tr>`)}
              </tbody>
            </table>
          </div>
        </section>

        <p class="index-sub" style=${{ maxWidth: '58ch' }}>
          Your name is here because you signed in with Google; the board shows it to other
          signed in members and nothing else about you. Progress syncs a moment after you earn
          it, so a fresh score can take a few seconds to appear.
        </p>` : null}
    </div>`;
}
