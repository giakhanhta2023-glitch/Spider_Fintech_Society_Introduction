/* =========================================================================
   FinQuest: application root.
   Masthead, routing, toasts, tutor.
   ========================================================================= */
import {
  html, useState, useEffect, useCallback, FQ, CFG, store, navigate,
  Theme, Tooltip, Btn
} from './lib.js';
import { Mou } from './mou.js';
import { AuthGate, signOut } from './auth.js';
import { createRoot } from 'react-dom/client';
import { Home, Glossary, Dossier } from './views.js';
import { LevelPage } from './level.js';
import { Tutor } from './tutor.js';

/* ------------------------------------------------------------------ route */
function parseHash() {
  const raw = (window.location.hash || '#/').replace(/^#/, '');
  const parts = raw.split('/').filter(Boolean);
  if (!parts.length) return { name: 'home' };
  if (parts[0] === 'level') {
    return { name: 'level', id: parseInt(parts[1], 10), tab: parts[2] || 'brief' };
  }
  if (parts[0] === 'glossary') return { name: 'glossary' };
  if (parts[0] === 'progress') return { name: 'progress' };
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
        </nav>

        <div class="masthead-meta">
          <${Tooltip} content=${`${progress.into} of ${progress.tier} XP into this tier`}>
            <span class="rank-plate">${store.rank()}</span>
          <//>
          <span class="xp-plate">
            <b>${store.xp().toLocaleString()}</b><span>XP</span>
          </span>
          <button class="mou-btn" type="button" onClick=${onOpenTutor}
            title="Ask Mou, or press Ctrl and K">
            <${Mou} mood="rest" size=${24} title="Mou" />
            <span>mou</span>
          </button>
          <button class="signout" type="button" onClick=${signOut}
            title=${user ? `Signed in as ${user.email}` : 'Sign out'}>sign out</button>
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

  useEffect(() => {
    document.title = route.name === 'level' && FQ.level(route.id)
      ? `${FQ.level(route.id).title} · FinQuest`
      : 'FinQuest, a fintech training arcade';
  }, [route]);

  const toast = useCallback((text, tone = 'accent') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => prev.concat([{ id, text, tone }]));
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3600);
  }, []);

  const refresh = useCallback(() => setVersion((n) => n + 1), []);

  function reset() {
    store.reset();
    refresh();
    navigate('#/');
    toast('Progress reset.');
  }

  let page;
  if (route.name === 'level') {
    /* Keyed by route only: a progress update must re-render the page, not
       remount it, or an in-progress drill would be thrown away. */
    page = html`<${LevelPage} key=${`${route.id}-${route.tab}`} id=${route.id}
      tab=${route.tab} onAskTutor=${() => setTutorOpen(true)} onProgress=${refresh} toast=${toast} />`;
  } else if (route.name === 'glossary') {
    page = html`<${Glossary} />`;
  } else if (route.name === 'progress') {
    page = html`<${Dossier} key=${version} onReset=${reset} />`;
  } else {
    page = html`<${Home} key=${version} onAskTutor=${() => setTutorOpen(true)} />`;
  }

  return html`
    <${Theme} appearance="dark" accentColor="blue" grayColor="slate" radius="none"
      scaling="100%" hasBackground=${false}>
      <${Masthead} route=${route} onOpenTutor=${() => setTutorOpen(true)} user=${user} />
      <main>${page}</main>

      <footer class="footer">
        <div class="page">
          <div class="grid">
            <div class="col-1-7">
              <span class="mono">
                FinQuest, built for the Spider Fintech Society.
                ${' '}<a class="link" href=${CFG.repoUrl} target="_blank" rel="noopener">solution keys on GitHub →</a>
              </span>
            </div>
            <div class="col-9-12">
              <span class="mono-s">
                Educational material only. Every dataset is synthetic.
                Nothing here is financial advice.
                ${' '}<a class="link" href="/privacy">privacy</a>
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
  createRoot(mount).render(html`
    <${Theme} appearance="dark" accentColor="blue" grayColor="slate" radius="none"
      scaling="100%" hasBackground=${false}>
      <${AuthGate}>${(user) => html`<${App} user=${user} />`}<//>
    <//>`);
}
