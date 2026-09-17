/* =========================================================================
   Mou and Bruno, alive.

   Two things make a sprite look alive rather than pasted on: it blinks on its
   own clock, and it reacts to something. So each of them blinks on a randomised
   timer, and every so often Bruno glances at Mou, goes pink, and a heart floats
   up between them. Mou beams back, because being looked at fondly is nice.

   All of it stops dead if the reader asked for reduced motion: then they simply
   stand there, eyes open.
   ========================================================================= */
import { html, useState, useEffect, useRef } from './lib.js';
import { Mou } from './mou.js';
import { Bear, PixelHeart } from './bear.js';

const CALM = typeof window !== 'undefined'
  && window.matchMedia
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* A blink is 140ms of closed eyes every few seconds, never on a round number,
   or the two of them blink in lockstep and look mechanical. */
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
  const [smitten, setSmitten] = useState(false);
  const mouBlink = useBlink(3200, 7000);
  const bearBlink = useBlink(2600, 6400);
  const timers = useRef([]);

  useEffect(() => {
    if (CALM) return undefined;
    let alive = true;

    const cycle = () => {
      timers.current.push(setTimeout(() => {
        if (!alive) return;
        setSmitten(true);
        timers.current.push(setTimeout(() => {
          if (!alive) return;
          setSmitten(false);
          cycle();
        }, 2600));
      }, 6000 + Math.random() * 5000));
    };

    cycle();
    return () => {
      alive = false;
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, []);

  /* A blink while he is mid swoon would cancel the expression, so the swoon wins. */
  const bearMood = smitten ? 'love' : bearBlink ? 'blink' : 'glance';
  const mouMood = smitten ? 'happy' : mouBlink ? 'rest' : 'idle';

  return html`
    <div class=${'duo ' + className} aria-label="Mou and Bruno">
      <${Bear} mood=${bearMood} size=${size} bob=${!CALM} title="Bruno" />
      <span class=${'duo-heart' + (smitten ? ' is-showing' : '')} aria-hidden="true">
        <${PixelHeart} size=${Math.round(size * 0.3)} />
      </span>
      <${Mou} mood=${mouMood} size=${size} bob=${!CALM} title="Mou" />
    </div>`;
}
