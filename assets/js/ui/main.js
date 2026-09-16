/* =========================================================================
   FinQuest — application root.
   Radix Themes provides the design system; this file wires routing, the HUD,
   toasts, and the tutor panel together.
   ========================================================================= */
import {
  html, useState, useEffect, useCallback, FQ, CFG, store, navigate, Theme,
  Container, Flex, Box, Text, Badge, Button, Progress, Link, Callout,
  Separator, Tooltip
} from './lib.js';
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

/* ----------------------------------------------------------------- ticker */
const TICKER = [
  ['AUTH', 'approve is not settle'],
  ['LEDGER', 'entries must sum to zero'],
  ['MONEY', 'integers, never floats'],
  ['RETRY', 'idempotency keys or double charges'],
  ['APR', 'includes the fees'],
  ['APY', 'includes the compounding'],
  ['VOL', 'scales with sqrt(252)'],
  ['SHARPE', 'return per unit of risk'],
  ['DRAWDOWN', 'the number people feel'],
  ['FRAUD', '98.2% accurate = caught nothing'],
  ['KYC', 'verify before you hold funds'],
  ['SECRETS', 'never in the repo'],
  ['README', 'link, screenshot, limitations'],
  ['RULE 1', '0.1 + 0.2 is not 0.3']
];

function Ticker() {
  const row = TICKER.map(([tag, text], i) => html`
    <span className="tick" key=${i}>
      <b>${tag}</b><i>·</i>${text}
    </span>`);
  return html`
    <div className="ticker" aria-hidden="true">
      <div className="ticker-track">${row}${row}</div>
    </div>`;
}

/* ------------------------------------------------------------------ toast */
function Toasts({ items }) {
  if (!items.length) return null;
  return html`
    <div className="toasts">
      ${items.map((t) => html`
        <${Callout.Root} key=${t.id} color=${t.color} variant="surface" size="1" className="toast">
          <${Callout.Text}>${t.text}<//>
        <//>`)}
    </div>`;
}

/* ------------------------------------------------------------------- HUD */
function Header({ route, onOpenTutor, version }) {
  const xp = store.xp();
  const progress = store.xpProgress();

  const navLink = (href, label, active) => html`
    <a className=${'navlink' + (active ? ' active' : '')} href=${href}>${label}</a>`;

  return html`
    <header className="topbar">
      <${Container} size="4" px=${{ initial: '3', sm: '5' }}>
        <${Flex} align="center" gap="4">
          <a className="brand" href="#/">
            <span className="brand-mark figure">FQ</span>
            <span className="brand-text">Fin<em>Quest</em></span>
          </a>

          <nav className="topnav">
            ${navLink('#/', 'Map', route.name === 'home')}
            ${navLink('#/glossary', 'Glossary', route.name === 'glossary')}
            ${navLink('#/progress', 'Dossier', route.name === 'progress')}
          </nav>

          <${Flex} align="center" gap="3" ml="auto">
            <${Tooltip} content=${`${progress.into} / ${progress.tier} XP to the next tier`}>
              <${Flex} align="center" gap="2" className="hud-xp">
                <${Badge} color="amber" variant="surface" radius="full">${store.rank()}<//>
                <${Box} className="hud-bar"><${Progress} value=${progress.pct} color="jade" size="1" /><//>
                <${Text} size="1" color="gray" className="figure">${xp.toLocaleString()} XP<//>
              <//>
            <//>
            <${Button} size="2" variant="surface" onClick=${onOpenTutor}>
              <span className="pulse" /> Tutor
            <//>
          <//>
        <//>
      <//>
    </header>`;
}

/* ------------------------------------------------------------------- app */
function App() {
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
      ? `Level ${route.id} — ${FQ.level(route.id).title} · FinQuest`
      : 'FinQuest — Fintech Training Arcade';
  }, [route]);

  const toast = useCallback((text, color = 'jade') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => prev.concat([{ id, text, color }]));
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3600);
  }, []);

  const refresh = useCallback(() => setVersion((n) => n + 1), []);

  function reset() {
    store.reset();
    refresh();
    navigate('#/');
    toast('Progress reset.', 'gray');
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
    <${Theme} appearance="dark" accentColor="jade" grayColor="slate" radius="medium" scaling="100%">
      <${Header} route=${route} onOpenTutor=${() => setTutorOpen(true)} version=${version} />
      <${Ticker} />

      <${Container} size="4" px=${{ initial: '3', sm: '5' }} py=${{ initial: '5', sm: '7' }}>
        ${page}
      <//>

      <footer className="footer">
        <${Container} size="4" px="4">
          <${Separator} size="4" mb="5" />
          <${Flex} direction="column" align="center" gap="1">
            <${Text} size="2" color="gray">
              FinQuest · built for the Spider Fintech Society ·
              ${' '}<${Link} href=${CFG.repoUrl} target="_blank" rel="noopener">solution keys on GitHub<//>
            <//>
            <${Text} size="1" color="gray">
              Educational material only. Every dataset is synthetic. Nothing here is financial advice.
            <//>
          <//>
        <//>
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
    '<div style="max-width:40rem;margin:4rem auto;font-family:system-ui;color:#c4d0e6">' +
    '<h2>No curriculum loaded</h2><p>The level files did not load. If you opened this file ' +
    'directly from disk, serve the folder instead:</p><pre>python -m http.server 8000</pre></div>';
} else {
  createRoot(mount).render(html`<${App} />`);
}
