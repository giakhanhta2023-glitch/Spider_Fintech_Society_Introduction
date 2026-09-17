/* =========================================================================
   The gate. Nothing of the course renders until Google says who you are.

   Flow:
     1. ask /api/auth/me whether this browser already has a session
     2. if not, show the sign in screen and let Google render its own button
     3. Google hands us an ID token, we post it to /api/auth/google, which
        verifies it and sets the session cookie
     4. pull the saved progress down, merge it with anything this device did
        while signed out, and hand it to the store

   The Google client id in config.js is public by design: it identifies the
   site, it does not authorise anything. The secret half never leaves Google.
   ========================================================================= */
import { html, useState, useEffect, useRef, CFG, store, Btn } from './lib.js';
import { Companions } from './companions.js';

const GSI = 'https://accounts.google.com/gsi/client';

/* ------------------------------------------------------------- server calls */
/* Three outcomes, not two: signed in, signed out, and no backend at all.
   `python serve.py` serves the course with no functions behind it, so every
   auth route 404s. Treating that as signed out would lock the author out of
   their own course while editing it, so on localhost it means guest instead.
   Anywhere else a missing route is a broken deployment, and the gate holds. */
const LOCAL = typeof window !== 'undefined'
  && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);

async function getSession() {
  try {
    const r = await fetch('/api/auth/me', { credentials: 'same-origin' });
    if (r.status === 404 && LOCAL) return 'no-backend';
    if (!r.ok) return null;
    const data = await r.json();
    return data.user || null;
  } catch {
    return LOCAL ? 'no-backend' : null;
  }
}

async function signInWithCredential(credential) {
  const r = await fetch('/api/auth/google', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ credential })
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'Sign in failed');
  return data.user;
}

export async function signOut() {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
  } catch { /* the cookie expires on its own soon enough */ }
  window.location.reload();
}

/* --------------------------------------------------------- progress syncing */
async function pullProgress() {
  try {
    const r = await fetch('/api/progress', { credentials: 'same-origin' });
    if (!r.ok) return null;
    const data = await r.json();
    return data.state || null;
  } catch {
    return null;
  }
}

let pushTimer = null;
function pushProgressSoon(state) {
  clearTimeout(pushTimer);
  /* A drill fires a dozen writes in a minute. Wait for the learner to settle
     before spending a request. */
  pushTimer = setTimeout(() => {
    fetch('/api/progress', {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ state })
    }).catch(() => { /* stays in localStorage, syncs on the next change */ });
  }, 1500);
}

/* --------------------------------------------------------------- the screen */
function SignIn({ onSignedIn }) {
  const slot = useRef(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const clientId = (CFG.auth && CFG.auth.googleClientId) || '';

  useEffect(() => {
    if (!clientId) return;

    function render() {
      const g = window.google;
      if (!g || !g.accounts || !slot.current) return;
      g.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
          setBusy(true);
          setError('');
          try {
            const user = await signInWithCredential(response.credential);
            onSignedIn(user);
          } catch (err) {
            setError(err.message);
            setBusy(false);
          }
        }
      });
      /* Google's own button, per their branding rules. Everything around it is
         ours; the button itself has to look like Google's. */
      g.accounts.id.renderButton(slot.current, {
        theme: 'filled_blue', size: 'large', shape: 'rectangular',
        text: 'continue_with', logo_alignment: 'left', width: 280
      });
    }

    if (window.google && window.google.accounts) return render();
    const tag = document.createElement('script');
    tag.src = GSI;
    tag.async = true;
    tag.defer = true;
    tag.onload = render;
    tag.onerror = () => setError('Could not reach Google. Check your connection and reload.');
    document.head.appendChild(tag);
  }, [clientId]);

  return html`
    <div class="page gate">
      <div class="grid">
        <div class="col-1-7 stack stack-5">
          <div>
            <span class="kicker">Spider Fintech Society <b>/</b> ten levels</span>
            <h1 class="display display-xl">Learn fintech<br />by building it</h1>
          </div>
          <p class="lede">
            Ten levels, 150 drill questions and nine things to build, with a tutor who knows which
            level you are on. Sign in to start, and your progress follows you to any device.
          </p>
          <div>
            <${Companions} size=${64} />
            <p class="mono-s" style=${{ marginTop: '12px' }}>
              Mou tutors. Bruno keeps her company.
            </p>
          </div>
        </div>

        <div class="col-9-12">
          <div class="panel gate-card">
            <span class="kicker">sign in to continue</span>
            <h2 class="display display-m" style=${{ marginBottom: '18px' }}>Welcome</h2>
            <p class="index-sub" style=${{ marginTop: 0 }}>
              We use your Google account, so there is no password to invent and none for us to keep.
              We store your name, your email and your progress. Nothing else.
            </p>

            ${clientId ? html`
              <div class="gate-google" ref=${slot} />
              ${busy ? html`<p class="mono-s">signing you in...</p>` : null}` : html`
              <p class="notice" style=${{ marginTop: '18px' }}>
                Sign in is not configured yet. Add your Google client id to
                ${' '}<code>assets/js/config.js</code> and set the matching environment variables
                on the deployment. The setup is written down in
                ${' '}<code>docs/accounts-setup.md</code>.
              </p>`}

            ${error ? html`<p class="notice" style=${{ marginTop: '18px' }}>${error}</p>` : null}

            <p class="mono-s" style=${{ marginTop: '22px', lineHeight: 1.7 }}>
              Educational material only. Every dataset in the course is synthetic.
              ${' '}<a class="link" href="/privacy">privacy</a>
              ${' '}<a class="link" href="/terms">terms</a>
            </p>
          </div>
        </div>
      </div>
    </div>`;
}

function Loading() {
  return html`
    <div class="page gate">
      <p class="mono" style=${{ paddingTop: '30vh' }}>checking your session...</p>
    </div>`;
}

/* ------------------------------------------------------------------- gate */
export function AuthGate({ children }) {
  const [state, setState] = useState({ status: 'checking', user: null });

  async function adopt(user) {
    /* Anything earned before signing in is merged upward, so a first sign in
       never looks like losing your work. */
    const remote = await pullProgress();
    if (remote) store.merge(remote);
    pushProgressSoon(store.all());
    store.onChange(pushProgressSoon);
    setState({ status: 'in', user });
  }

  useEffect(() => {
    let cancelled = false;
    getSession().then((user) => {
      if (cancelled) return;
      if (user === 'no-backend') {
        /* Local editing: the course runs on localStorage, as it did before
           accounts existed. Nothing is synced because there is nowhere to
           sync to. */
        setState({ status: 'in', user: null });
      } else if (user) {
        adopt(user);
      } else {
        setState({ status: 'out', user: null });
      }
    });
    return () => { cancelled = true; };
  }, []);

  if (state.status === 'checking') return html`<${Loading} />`;
  if (state.status === 'out') return html`<${SignIn} onSignedIn=${adopt} />`;
  return children(state.user);
}
