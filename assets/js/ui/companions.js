/* =========================================================================
   Mou, alive.

   One thing makes a sprite look alive rather than pasted on: it blinks on its
   own clock. So Mou blinks on a randomised timer, never on a round number,
   because a blink you can predict reads as a loading spinner.

   It stops dead if the reader asked for reduced motion: then he simply stands
   there with his eyes open.
   ========================================================================= */
import { html, useState, useEffect, useRef } from './lib.js';
import { Mou } from './mou.js';

const CALM = typeof window !== 'undefined'
  && window.matchMedia
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* A blink is 140ms of closed eyes every few seconds. */
function useBlink(minGap, maxGap) {
  const [blinking, setBlinking] = useState(false);
  const timers = useRef([]);

  useEffect(() => {
    if (CALM) return undefined;
    let alive = true;

    const schedule = () => {
      const wait = minGap + Math.random() * (maxGap - minGap);
      timers.current.push(setTimeout(() => {
        if (!alive) return;
        setBlinking(true);
        timers.current.push(setTimeout(() => {
          if (!alive) return;
          setBlinking(false);
          schedule();
        }, 140));
      }, wait));
    };

    schedule();
    return () => {
      alive = false;
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [minGap, maxGap]);

  return blinking;
}

export function Companions({ size = 56, className = '' }) {
  const blinking = useBlink(3200, 7000);

  return html`
    <div class=${'companion ' + className} aria-label="Mou">
      <${Mou} mood=${blinking ? 'rest' : 'idle'} size=${size} bob=${!CALM} title="Mou" />
    </div>`;
}
