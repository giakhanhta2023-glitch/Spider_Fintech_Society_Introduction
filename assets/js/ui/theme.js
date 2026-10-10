/* =========================================================================
   Light and dark.

   Three states, not two. A reader who has never touched the control is
   following their own machine, and that is a real state rather than a default
   dressed up as one: if they change their laptop to light at dusk, the page
   follows without being asked. Choosing light or dark pins it and stops the
   page changing under them.

   The flash is the part worth caring about. CSS alone cannot avoid it: the
   stylesheet loads, the browser paints the dark canvas, and then a script
   decides it should have been paper. So the choice is read from storage and
   written to the root element by a blocking inline script in index.html,
   before the first paint. This module only handles changing it afterwards.
   ========================================================================= */
import { html, useState, useEffect } from './lib.js';

const KEY = 'fq.theme';

/* What the reader chose, which is not the same as what they are looking at.
   Nothing stored means they have not chosen, which is its own answer. */
export function current() {
  let pinned = null;
  try { pinned = localStorage.getItem(KEY); } catch (err) { /* private window */ }
  return pinned === 'light' || pinned === 'dark' ? pinned : 'system';
}

function machine() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches
    ? 'light' : 'dark';
}

/* What is actually on screen. The attribute always holds a concrete answer,
   because the inline script in index.html resolved it before the first paint. */
export function resolved() {
  const on = document.documentElement.getAttribute('data-theme');
  return on === 'light' ? 'light' : 'dark';
}

export function setTheme(choice) {
  try {
    if (choice === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
  } catch (err) { /* private window: the choice lasts for this tab only */ }

  document.documentElement.setAttribute(
    'data-theme', choice === 'system' ? machine() : choice,
  );
  window.dispatchEvent(new CustomEvent('fq:theme', { detail: choice }));
}

/* One button rather than three. Most readers want the other one, and the two
   who want to go back to following the machine can hold shift. The title says
   so, because a hidden modifier nobody is told about is not a feature. */
export function Toggle() {
  const [, force] = useState(0);

  useEffect(() => {
    const redraw = () => force((n) => n + 1);
    window.addEventListener('fq:theme', redraw);

    /* Following the machine means following it as it changes, not only at
       load: somebody whose laptop turns light at dawn should see the page turn
       with it. A reader who has pinned a choice is left alone. */
    const follow = () => { if (current() === 'system') setTheme('system'); redraw(); };
    const media = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)');
    if (media && media.addEventListener) media.addEventListener('change', follow);

    return () => {
      window.removeEventListener('fq:theme', redraw);
      if (media && media.removeEventListener) media.removeEventListener('change', follow);
    };
  }, []);

  const showing = resolved();
  const following = current() === 'system';
  const next = showing === 'light' ? 'dark' : 'light';

  const click = (event) => {
    setTheme(event.shiftKey ? 'system' : next);
  };

  return html`
    <button class="themetoggle" type="button" onClick=${click}
      aria-label=${`Switch to the ${next} theme`}
      title=${following
        ? `Following your system, which is ${showing}. Click for ${next}.`
        : `Showing ${showing}. Click for ${next}, shift click to follow your system.`}>
      <${Glyph} showing=${showing} />
      <span>${following ? 'auto' : showing}</span>
    </button>`;
}

/* Drawn rather than an emoji, so it inherits the mono weight of the labels
   beside it and does not change shape between platforms. */
function Glyph({ showing }) {
  return showing === 'light'
    ? html`
      <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" focusable="false">
        <circle cx="8" cy="8" r="3.1" fill="none" stroke="currentColor" stroke-width="1.4" />
        ${[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
          const r = (deg * Math.PI) / 180;
          return html`<line key=${deg}
            x1=${8 + Math.cos(r) * 5.4} y1=${8 + Math.sin(r) * 5.4}
            x2=${8 + Math.cos(r) * 6.9} y2=${8 + Math.sin(r) * 6.9}
            stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />`;
        })}
      </svg>`
    : html`
      <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" focusable="false">
        <path d="M13.2 10.1A5.6 5.6 0 0 1 6.2 2.9a5.9 5.9 0 1 0 7 7.2Z"
          fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" />
      </svg>`;
}
