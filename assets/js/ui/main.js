/* =========================================================================
   FinQuest: application root.
   Masthead, routing, toasts, tutor.
   ========================================================================= */
import {
  html, useState, useEffect, useCallback, FQ, CFG, store,
  Theme, Tooltip, Btn
} from './lib.js';
import { Mou } from './mou.js';
import { AuthGate, signOut } from './auth.js';
import { createRoot } from 'react-dom/client';
import { Home, Glossary, Dossier, Ranking } from './views.js';
import { Launchpad } from './launchpad.js';
import { LevelPage } from './level.js';
import { Tutor } from './tutor.js';
import { Toggle, resolved } from './theme.js';

/* ------------------------------------------------------------------ route */
function parseHash() {
  const raw = (window.location.hash || '#/').replace(/^#/, '');
  const parts = raw.split('/').filter(Boolean);
  if (!parts.length) return { name: 'home' };
  if (parts[0] === 'level') {
    return { name: 'level', id: parseFloat(parts[1]), tab: parts[2] || 'brief' };
  }
  if (parts[0] === 'glossary') return { name: 'glossary' };
  if (parts[0] === 'progress') return { name: 'progress' };
  if (parts[0] === 'ranking') return { name: 'ranking' };
  return { name: 'home' };
}

/* ------------------------------------------------------------------ toast */
function Toasts({ items }) {
  if (!items.length) return null;
  return html`
    <div class="toasts">
      ${items.map((t) => html`
        <div class=${'toast' + (t.tone === 'moss' ? ' is-moss' : '')} key=${t.id}>${t.text}</div>`)}
    </div>`;
}

/* --------------------------------------------------------------- masthead */
/* Radix was mounted with appearance="dark" permanently, so on a light page
   every element our own stylesheet did not explicitly colour fell through to
   a Radix dark grey: near-white list text on paper at 1.06:1, invisible. The
   appearance follows the resolved theme now. It needs an observer rather than
   state alone because the toggle writes the attribute from outside React, and
   it has to be a shared hook because the gate mounts its own Theme too. */
function useAppearance() {
  const [appearance, setAppearance] = useState(resolved);
  useEffect(() => {
    const sync = () => setAppearance(resolved());
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', sync);
    return () => { mo.disconnect(); mq.removeEventListener('change', sync); };
  }, []);
  return appearance;
}

function Masthead({ route, onOpenTutor, user }) {
  const progress = store.xpProgress();

  const link = (href, label, active) => html`
    <a href=${href} aria-current=${active ? 'page' : undefined}>${label}</a>`;

  return html`
    <header class="masthead">
      <div class="page masthead-inner">
        <a class="wordmark" href="#/">
          <span class="wordmark-text">Fin<i>Quest</i></span>
        </a>

        <nav class="mainnav">
          ${link('#/', 'levels', route.name === 'home')}
          ${link('#/glossary', 'words', route.name === 'glossary')}
          ${link('#/progress', 'progress', route.name === 'progress')}
          ${link('#/ranking', 'ranking', route.name === 'ranking')}
        </nav>

        <div class="masthead-meta">
          <${Tooltip} content=${`${progress.into} of ${progress.tier} XP into this tier`}>
            <span class="xp-plate">
              <b>${store.xp().toLocaleString()}</b><span>XP</span>
            </span>
          <//>
          <${Toggle} />
          <button class="mou-btn" type="button" onClick=${onOpenTutor}
            title="Ask Mou, or press Ctrl and K">
            <${Mou} mood="rest" size=${24} title="Mou" />
            <span>mou</span>
          </button>
          ${user ? html`
            <button class="signout" type="button" onClick=${signOut}
              title=${`Signed in as ${user.email}`}>sign out</button>` : null}
        </div>
      </div>
    </header>`;
}

/* ------------------------------------------------------------------- app */
function App({ user }) {
  const [route, setRoute] = useState(parseHash);
  const [tutorOpen, setTutorOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setTutorOpen((v) => !v);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const appearance = useAppearance();

  useEffect(() => {
    document.title = route.name === 'level' && FQ.level(route.id)
      ? `${FQ.level(route.id).title} · FinQuest`
      : 'FinQuest, a fintech training arcade';
  }, [route]);

  /* Sections arrive rather than appearing. The js class is what arms it, and
     it is set here rather than in the stylesheet so that a page whose script
     never runs renders every section normally instead of shipping a column
     of invisible blocks.

     An IntersectionObserver, never a scroll listener: a listener on scroll
     fires on every frame of every wheel tick and reflows the document each
     time, which is exactly the jank this costs nothing to avoid. The whole
     set is rebuilt per route because the router replaces the page under us,
     and anything already on screen when a view opens is marked in rather
     than animated, so arriving mid-page never leaves content hidden. */
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('js');
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;

    const targets = Array.from(document.querySelectorAll('main section, main .index-row'));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.05 });

    targets.forEach((el, i) => {
      el.classList.add('reveal');
      el.style.transitionDelay = `${Math.min(i, 5) * 55}ms`;
      if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add('is-in');
      else io.observe(el);
    });
    return () => io.disconnect();
  }, [route.name, route.id, route.tab]);

  /* Opening a level from a link, a bookmark or the tutor moves you to its
     track, so every count on every other page is counting the ladder you are
     actually standing on. */
  useEffect(() => {
    if (route.name === 'level' && FQ.level(route.id)) {
      store.setTrack(FQ.trackOfLevel(route.id));
    }
  }, [route.name, route.id]);

  const toast = useCallback((text, tone = 'accent') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => prev.concat([{ id, text, tone }]));
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3600);
  }, []);

  const refresh = useCallback(() => setVersion((n) => n + 1), []);

  /* The launchpad stands in front of the ladder exactly once, and only on the
     front page: a reader who arrives on a level link from the tutor or a
     bookmark goes straight there rather than being sent back to a sales
     screen. */
  const [launched, setLaunched] = useState(() => store.launched());
  const startTrack = useCallback((trackId) => {
    store.setTrack(trackId);
    store.markLaunched();
    setLaunched(true);
    refresh();
  }, [refresh]);

  let page;
  if (!launched && route.name === 'home') {
    page = html`<${Launchpad} onLaunch=${startTrack} />`;
  } else if (route.name === 'level') {
    /* Keyed by route only: a progress update must re-render the page, not
       remount it, or an in-progress drill would be thrown away. */
    page = html`<${LevelPage} key=${`${route.id}-${route.tab}`} id=${route.id}
      tab=${route.tab} onAskTutor=${() => setTutorOpen(true)} onProgress=${refresh} toast=${toast} />`;
  } else if (route.name === 'glossary') {
    page = html`<${Glossary} />`;
  } else if (route.name === 'progress') {
    page = html`<${Dossier} key=${version} />`;
  } else if (route.name === 'ranking') {
    page = html`<${Ranking} />`;
  } else {
    page = html`<${Home} key=${version} onAskTutor=${() => setTutorOpen(true)} />`;
  }

  return html`
    <${Theme} appearance=${appearance} accentColor="blue" grayColor="slate" radius="none"
      scaling="100%" hasBackground=${false}>
      <button class="skip" type="button" onClick=${() => {
        /* Not an anchor: the router lives in the hash, so an href of
           #content would read as a route and throw the reader back to
           the home page. */
        const target = document.getElementById('content');
        if (target) { target.focus(); target.scrollIntoView(); }
      }}>skip to the level</button>
      <${Masthead} route=${route} onOpenTutor=${() => setTutorOpen(true)} user=${user} />
      <main id="content" tabindex="-1">${page}</main>

      <footer class="footer">
        <div class="page">
          <div class="grid">
            <div class="col-1-7">
              <span class="mono">
                <a class="link" href=${CFG.repoUrl} target="_blank" rel="noopener">solution keys on GitHub →</a>
              </span>
            </div>
            <!-- What this course is and is not now lives on the terms page,
                 one click away, rather than being restated on every screen. -->
            <div class="col-9-12">
              <span class="mono-s">
                <a class="link" href="/privacy">privacy</a>
                ${' '}<a class="link" href="/terms">terms</a>
              </span>
            </div>
          </div>
        </div>
      </footer>

      <${Tutor} open=${tutorOpen} onOpenChange=${setTutorOpen}
        levelId=${route.name === 'level' ? route.id : null} />
      <${Toasts} items=${toasts} />
    <//>`;
}

/* ------------------------------------------------------------------ boot */
const mount = document.getElementById('root');

if (!FQ || !FQ.levels || !FQ.levels.length) {
  mount.innerHTML =
    '<div style="max-width:40rem;margin:4rem auto;padding:0 24px;font-family:Georgia,serif;color:#EDEAE3">' +
    '<h2>No curriculum loaded</h2><p>The level files did not load. If you opened this file ' +
    'directly from disk, serve the folder instead:</p><pre>python serve.py</pre></div>';
} else {
  /* Nothing of the course mounts until the gate has a signed in learner. */
  function Root() {
    const appearance = useAppearance();
    return html`
      <${Theme} appearance=${appearance} accentColor="blue" grayColor="slate" radius="none"
        scaling="100%" hasBackground=${false}>
        <${AuthGate}>${(user) => html`<${App} user=${user} />`}<//>
      <//>`;
  }
  createRoot(mount).render(html`<${Root} />`);
}
