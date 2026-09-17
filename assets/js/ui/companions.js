/* =========================================================================
   Mou and Khanh, alive.

   Two things make a sprite look alive rather than pasted on: it blinks on its
   own clock, and it reacts to something. So each of them blinks on a randomised
   timer, and every so often Khanh breaks into a grin, a heart floats up between
   them, and Mou beams back. He faces forward the rest of the time: a held stare
   reads as awkward, a brief one reads as fond.

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

  /* A blink while he is mid swoon would cancel the expression, so the swoon wins.
     The rest of the time he faces forward: a sprite locked in a sideways stare
     reads as awkward rather than fond. */
  const bearMood = smitten ? 'love' : bearBlink ? 'blink' : 'idle';
  const mouMood = smitten ? 'happy' : mouBlink ? 'rest' : 'idle';

  return html`
    <div class=${'duo ' + className} aria-label="Mou and Khanh">
      <${Bear} mood=${bearMood} size=${size} bob=${!CALM} title="Khanh" />
      <span class=${'duo-heart' + (smitten ? ' is-showing' : '')} aria-hidden="true">
        <${PixelHeart} size=${Math.round(size * 0.3)} />
      </span>
      <${Mou} mood=${mouMood} size=${size} bob=${!CALM} title="Mou" />
    </div>`;
}
