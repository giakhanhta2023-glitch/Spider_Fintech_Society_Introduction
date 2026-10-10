/* =========================================================================
   One level: brief, knowledge, tutorial, drill, build.
   ========================================================================= */
import {
  html, useState, useEffect, FQ, CFG, store, md, navigate,
  Gauge, Btn, Tag, SectionHead, Tabs
} from './lib.js';
import { Blocks, CodeBlock } from './blocks.js';
import { Drill, AnswerKey } from './quiz.js';

/* Level 1 finishes with a setup checklist rather than a build, so the last
   tab changes its name with the level. */
function tabsFor(level) {
  return [
    { id: 'brief', label: 'brief' },
    { id: 'learn', label: 'learn' },
    { id: 'tutorial', label: 'tutorial' },
    { id: 'drill', label: 'drill' },
    { id: 'build', label: level.project ? 'build' : 'setup' }
  ];
}

/* ------------------------------------------------------------------ brief */
function Brief({ level, state }) {
  const brief = level.project || level.setup;
  return html`
    <div class="grid" style=${{ rowGap: '46px' }}>
      <div class="col-1-7 stack stack-5">
        <div>
          <span class="kicker">what this level is about</span>
          <p class="lede">${md(level.summary)}</p>
        </div>

        <div>
          <${SectionHead} title="By the end you can" />
          <ol class="steps">
            ${level.objectives.map((o, i) => html`
              <li class="step" key=${i} style=${{ padding: '14px 0' }}>
                <span class="step-num">${String(i + 1).padStart(2, '0')}</span>
                <span class="index-sub" style=${{ margin: 0 }}>${md(o)}</span>
              </li>`)}
          </ol>
        </div>
      </div>

      <div class="col-9-12 stack stack-5">
        <div class="panel">
          <span class="kicker">${level.project ? 'you will build' : 'your mission'}</span>
          <h3 class="display display-m" style=${{ marginBottom: '14px' }}>${brief.title}</h3>
          <p class="index-sub">${md(brief.story)}</p>
          ${level.project ? html`
            <p class="mono-s" style=${{ marginTop: '18px', lineHeight: 1.6 }}>
              scope: ${FQ.subst(level.project.scope)}
            </p>` : null}
        </div>

        <div>
          <${SectionHead} title="Progress" />
          <table class="data">
            <tbody>
              ${[
                ['best drill', `${state.quizBest} / ${level.quiz.length}`],
                ['attempts', String(state.attempts)],
                [level.project ? 'build shipped' : 'setup done', state.projectDone ? 'yes' : 'no'],
                ['level cleared', store.isCleared(level.id) ? 'yes' : 'not yet']
              ].map(([k, v], i) => html`
                <tr key=${i}>
                  <td class="mono" style=${{ color: 'var(--graphite)' }}>${k}</td>
                  <td class="figure" style=${{ textAlign: 'right', color: 'var(--bone)' }}>${v}</td>
                </tr>`)}
            </tbody>
          </table>
        </div>

        <div class="btn-row">
          <${Btn} variant="accent" arrow
            onClick=${() => navigate(`#/level/${level.id}/learn`)}>start reading<//>
          <${Btn} variant="quiet"
            onClick=${() => navigate(`#/level/${level.id}/drill`)}>jump to the drill<//>
        </div>
      </div>
    </div>`;
}

/* ------------------------------------------------------------------ learn */
function Learn({ level, onAskTutor }) {
  return html`
    <div class="grid" style=${{ rowGap: '46px' }}>
      <div class="col-1-8">
        <${Blocks} blocks=${level.knowledge} />
        <div class="btn-row" style=${{ marginTop: '44px' }}>
          <${Btn} variant="accent" arrow
            onClick=${() => navigate(`#/level/${level.id}/tutorial`)}>on to the tutorial<//>
          <${Btn} variant="quiet" onClick=${onAskTutor}>ask the tutor<//>
        </div>
      </div>

      <aside class="col-9-12">
        <div class="rail">
          <${Contents} level=${level} />

          <p class="rail-label">
            <span>Terms</span><span>${level.glossary.length}</span>
          </p>
          <dl class="deflist" style=${{ borderTop: 0 }}>
            ${level.glossary.map((g, i) => html`
              <div key=${i} style=${{ padding: '12px 0', borderBottom: '1px solid var(--rule)' }}>
                <dt class="mono" style=${{ color: 'var(--bone)', marginBottom: '4px' }}>${g.t}</dt>
                <dd style=${{ margin: 0, color: 'var(--ash)', fontSize: '0.92rem', lineHeight: 1.5 }}>
                  ${md(g.d)}
                </dd>
              </div>`)}
          </dl>
        </div>
      </aside>
    </div>`;
}

/* What is in this lesson, and where you are in it.
 *
 * The knowledge blocks already carry their own headings, so the list is the
 * data rather than a second copy of it that can fall out of step. The marker
 * follows the heading nearest the top of the screen, which is what a reader
 * means by "where am I" on a page this long.
 */
function Contents({ level }) {
  const headings = (level.knowledge || [])
    .filter((b) => b.h)
    .map((b, i) => ({ h: b.h, id: `s${i}` }));

  const [here, setHere] = useState(headings.length ? headings[0].id : null);

  useEffect(() => {
    if (!headings.length) return undefined;

    /* Give every heading in the prose the id the list points at. The blocks
       render themselves, so this is the one place that knows both. */
    const nodes = [...document.querySelectorAll('.prose h3')];
    nodes.forEach((node, i) => { if (headings[i]) node.id = headings[i].id; });

    /* Position rather than crossings. An IntersectionObserver only fires when
       something passes through its band, so jumping down the page with a link
       or the keyboard can skip the band entirely and leave the marker behind.
       Asking where the headings are now is both simpler and always right. */
    let queued = false;
    const read = () => {
      queued = false;
      const above = nodes.filter((n) => n.getBoundingClientRect().top <= 160);
      setHere(above.length ? above[above.length - 1].id : nodes[0].id);
    };
    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(read);
    };

    read();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [level.id]);

  if (headings.length < 3) return null;   /* a list of two is not a contents */

  return html`
    <nav class="contents" aria-label="Sections in this lesson">
      <p class="rail-label"><span>In this level</span><span>${headings.length}</span></p>
      <ol>
        ${headings.map(({ h, id }) => html`
          <li key=${id} class=${id === here ? 'is-here' : ''}>
            <!-- A button rather than an anchor. The whole app is hash routed,
                 so href="#s6" would set the route to something the router does
                 not recognise and drop the reader on the home page the one
                 time the click handler did not run. -->
            <button type="button" onClick=${() => {
              const node = document.getElementById(id);
              if (node) node.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}>${h}</button>
          </li>`)}
      </ol>
    </nav>`;
}

/* --------------------------------------------------------------- tutorial */
function Tutorial({ level }) {
  return html`
    <div class="grid">
      <div class="col-1-8 stack stack-5">
        <div>
          <span class="kicker">hands on</span>
          <p class="lede">${md(level.tutorial.intro)}</p>
        </div>

        <aside class="note note-tip">
          <span class="note-label">promise</span>
          Everything the ${level.project ? 'build' : 'checklist'} needs is taught right here.
          If it ever asks for something this tutorial did not cover, that is our bug, not yours.
        </aside>

        <ol class="steps">
          ${level.tutorial.steps.map((step, i) => html`
            <li class="step" key=${i}>
              <span class="step-num">${String(i + 1).padStart(2, '0')}</span>
              <div>
                <h3 class="title title-m" style=${{ marginBottom: '16px' }}>${md(step.t)}</h3>
                <${Blocks} blocks=${step.blocks} />
                ${step.check ? html`
                  <div class="step-check">
                    <span class="mono">check</span>
                    <span>${md(step.check)}</span>
                  </div>` : null}
              </div>
            </li>`)}
        </ol>

        <div class="btn-row">
          <${Btn} variant="accent" arrow
            onClick=${() => navigate(`#/level/${level.id}/drill`)}>take the drill<//>
        </div>
      </div>
    </div>`;
}

/* ------------------------------------------------------------------ drill */
function DrillTab({ level, state, onProgress }) {
  const [running, setRunning] = useState(false);
  const [showKey, setShowKey] = useState(false);

  if (running) {
    /* The Drill renders its own score card when it finishes, so this only
       forwards the result upward. */
    return html`<div class="col-1-8"><${Drill} level=${level} onFinish=${onProgress} /></div>`;
  }

  return html`
    <div class="grid" style=${{ rowGap: '36px' }}>
      <div class="col-1-7 stack stack-4">
        <div>
          <span class="kicker">${level.quiz.length} questions</span>
          <h2 class="display display-l">The drill</h2>
        </div>
        <p class="index-sub" style=${{ maxWidth: '52ch' }}>
          Score <strong>${CFG.quiz.passMark} of ${level.quiz.length}</strong> to open the${' '}
          ${level.project ? 'build' : 'setup checklist'}.
          Every answer comes with an explanation, and the full key is shown at the end, pass or
          fail. Your best score is the one that sticks.
        </p>
        <div class="btn-row">
          <${Btn} variant="accent" arrow onClick=${() => setRunning(true)}>
            ${state.attempts ? 'run it again' : 'begin'}
          <//>
          ${state.quizPassed ? html`
            <${Btn} variant="quiet" onClick=${() => setShowKey(!showKey)}>
              ${showKey ? 'hide the key' : 'show the key'}
            <//>` : null}
        </div>
      </div>

      <div class="col-9-12">
        ${state.attempts ? html`
          <table class="data">
            <tbody>
              <tr><td class="mono" style=${{ color: 'var(--graphite)' }}>best score</td>
                  <td class="figure" style=${{ textAlign: 'right' }}>${state.quizBest}/${level.quiz.length}</td></tr>
              <tr><td class="mono" style=${{ color: 'var(--graphite)' }}>attempts</td>
                  <td class="figure" style=${{ textAlign: 'right' }}>${state.attempts}</td></tr>
              <tr><td class="mono" style=${{ color: 'var(--graphite)' }}>status</td>
                  <td style=${{ textAlign: 'right' }}>
                    <${Tag} variant=${state.quizPassed ? 'moss' : ''}>
                      ${state.quizPassed ? 'passed' : 'not yet'}<//>
                  </td></tr>
            </tbody>
          </table>` : html`
          <p class="mono-s" style=${{ lineHeight: 1.7 }}>
            You have not taken this one yet. Nothing is recorded until you finish.
          </p>`}
      </div>

      ${showKey ? html`
        <div class="col-1-8"><${AnswerKey} level=${level} answers=${null} /></div>` : null}
    </div>`;
}

/* ------------------------------------------------------------------ build */
function Checklist({ levelId, items, onChange }) {
  const state = store.level(levelId);
  const [, force] = useState(0);
  const checked = Object.keys(state.reqs).length;

  function toggle(i) {
    store.toggleReq(levelId, i);
    force((n) => n + 1);
    if (onChange) onChange();
  }

  return html`
    <div>
      ${items.map((item, i) => {
        const on = !!state.reqs[String(i)];
        return html`
          <button type="button" key=${i} class=${'req' + (on ? ' is-checked' : '')}
            onClick=${() => toggle(i)} aria-pressed=${on}>
            <span class="req-box">✓</span>
            <span class="req-text">${md(item)}</span>
          </button>`;
      })}
      <div style=${{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '18px' }}>
        <div class="meter" style=${{ flex: 1, maxWidth: '240px' }}>
          <span style=${{ width: `${(checked / items.length) * 100}%` }} />
        </div>
        <span class="mono">${checked} of ${items.length} done</span>
      </div>
    </div>`;
}

function Build({ level, state, onComplete, onReopen, onChecklistChange }) {
  if (!state.quizPassed) {
    return html`
      <div class="col-1-8">
        <p class="notice">
          The ${level.project ? 'build' : 'setup checklist'} opens once you reach${' '}
          <strong>${CFG.quiz.passMark} of ${level.quiz.length}</strong> on the drill.
          Your best so far is ${state.quizBest}.
          ${' '}<a class="link" href=${`#/level/${level.id}/drill`}>go to the drill →</a>
        </p>
      </div>`;
  }

  const project = level.project;
  const setup = level.setup;
  const brief = project || setup;
  const items = project ? project.requirements : setup.checklist;
  const keyUrl = `${CFG.repoUrl}/tree/${CFG.repo.branch}/${brief.solutionPath}`;
  const next = siblings(level).next;

  return html`
    <div class="stack stack-6">
      <div class="grid">
        <div class="col-1-7">
          <span class="kicker">${project ? 'build' : 'setup'} <b>/</b> level ${num(level)}</span>
          <h2 class="display display-l" style=${{ marginBottom: '20px' }}>${brief.title}</h2>
          <p class="lede">${md(brief.story)}</p>
        </div>
        <div class="col-9-12">
          ${project ? html`
            <div class="panel">
              <span class="note-label">scope</span>
              <p class="index-sub" style=${{ margin: 0 }}>${md(project.scope)}</p>
              ${project.dataset ? html`
                <p class="mono-s" style=${{ marginTop: '16px', lineHeight: 1.6 }}>
                  dataset: ${FQ.subst(project.dataset)}
                </p>` : null}
            </div>` : null}
        </div>
      </div>

      <div class="grid" style=${{ rowGap: '46px' }}>
        <div class="col-1-7">
          <${SectionHead} title=${project ? 'Requirements' : 'Checklist'}
            note="ticks are saved on this device" />
          <${Checklist} levelId=${level.id} items=${items} onChange=${onChecklistChange} />
        </div>

        <div class="col-9-12 stack stack-5">
          ${project ? html`
            <div>
              <${SectionHead} title="Check your numbers" />
              <p class="index-sub" style=${{ marginTop: 0, marginBottom: '16px' }}>
                Your code should land on exactly these numbers. If one disagrees, that difference
                is your bug, and it is usually a quick fix.
              </p>
              <ol class="steps">
                ${project.tests.map((t, i) => html`
                  <li class="step" key=${i} style=${{ padding: '10px 0', gridTemplateColumns: '2.6rem minmax(0, 1fr)' }}>
                    <span class="step-num">${String(i + 1).padStart(2, '0')}</span>
                    <span class="mono" style=${{ lineHeight: 1.6, color: 'var(--ash)' }}>
                      ${FQ.subst(t)}
                    </span>
                  </li>`)}
              </ol>
            </div>` : null}

          <div>
            <${SectionHead} title="Solution key" />
            <p class="index-sub" style=${{ marginTop: 0 }}>
              A complete, verified solution sits in the repository at
              ${' '}<code>${brief.solutionPath}/</code>, with a walkthrough and this level's
              answer key.
            </p>
            <aside class="note note-warn" style=${{ marginBottom: '20px' }}>
              <span class="note-label">use it properly</span>
              Have a proper go first, ask the tutor for a hint, then read only the part you are
              stuck on. Retype the fix rather than pasting it, it sticks much better that way.
            </aside>
            <div class="btn-row">
              <${Btn} href=${keyUrl} target="_blank" rel="noopener" arrow>open the key<//>
              <${Btn} variant="quiet" href=${CFG.repoUrl} target="_blank" rel="noopener">browse the repo<//>
            </div>
          </div>
        </div>
      </div>

      ${project ? html`
        <div class="grid">
          <div class="col-1-8">
            <${SectionHead} title="Starter" note="a suggestion, not a rule" />
            <${CodeBlock} code=${project.starter.code} lang=${project.starter.lang}
              label=${project.starter.lang === 'text' ? 'project layout' : 'starter'} />
          </div>
        </div>

        <div class="grid" style=${{ rowGap: '46px' }}>
          <div class="col-1-7">
            <${SectionHead} title="How it is marked" note="100 points" />
            <table class="data">
              <tbody>
                ${project.rubric.map((r, i) => html`
                  <tr key=${i}>
                    <td class="figure" style=${{ width: '4.5rem', color: 'var(--accent)' }}>${r.pts}</td>
                    <td>
                      <span class="title title-s" style=${{ display: 'block', marginBottom: '4px' }}>${r.t}</span>
                      <span class="index-sub" style=${{ display: 'block', margin: 0 }}>${md(r.d)}</span>
                    </td>
                  </tr>`)}
              </tbody>
            </table>
          </div>
          <div class="col-9-12">
            <${SectionHead} title="If you want more" />
            <ul class="prose" style=${{ paddingLeft: '1.2em' }}>
              ${project.stretch.map((s, i) => html`<li key=${i}>${md(s)}</li>`)}
            </ul>
          </div>
        </div>` : null}

      <div class="grid">
        <div class="col-1-8">
          <hr class="rule-heavy" />
          <div style=${{ paddingTop: '28px' }}>
            ${state.projectDone ? html`
              <div class="stack stack-4">
                <h3 class="display display-m" style=${{ color: 'var(--moss)' }}>
                  ${project ? 'Shipped.' : 'Lab ready.'}
                </h3>
                <p class="index-sub" style=${{ margin: 0 }}>
                  ${next ? `Level ${num(next)}, ${next.title}, is open.`
                         : `That is the last level of ${FQ.track(FQ.trackIdOf(level)).title.toLowerCase()}.`}
                </p>
                <div class="btn-row">
                  ${next
                    ? html`<${Btn} variant="accent" arrow
                        onClick=${() => navigate(`#/level/${next.id}`)}>next level<//>`
                    : html`<${Btn} variant="accent" arrow
                        onClick=${() => navigate('#/progress')}>see how you did<//>`}
                  <${Btn} variant="quiet" onClick=${onReopen}>reopen it<//>
                </div>
              </div>` : html`
              <div class="stack stack-4">
                <h3 class="display display-m">
                  ${project ? 'All done building?' : 'Everything set up?'}
                </h3>
                <p class="index-sub" style=${{ margin: 0, maxWidth: '56ch' }}>
                  ${project
                    ? 'Mark it complete once your code runs, the checks below pass, and it is safely in your portfolio repo. That opens the next level.'
                    : `Mark it complete once your notebook runs and your repository is live. That opens level ${num(next)}.`}
                </p>
                <div class="btn-row">
                  <${Btn} variant="accent" onClick=${onComplete} arrow>
                    mark complete, +${CFG.xp.projectComplete} XP
                  <//>
                </div>
              </div>`}
          </div>
        </div>
      </div>
    </div>`;
}

/* ------------------------------------------------------------------- page */
/* The number a reader sees, and the levels either side of this one. Both are
   within the level's own track: the analyst track counts 01 to 05 and does not
   continue the engineering numbering. */
function num(level) {
  return level ? String(FQ.positionOf(level)).padStart(2, '0') : '';
}

function siblings(level) {
  const all = FQ.levelsIn(FQ.trackIdOf(level));
  const at = all.indexOf(level);
  return { all, at, prev: all[at - 1] || null, next: all[at + 1] || null };
}

export function LevelPage({ id, tab, onAskTutor, onProgress, toast }) {
  const level = FQ.level(id);
  const [, force] = useState(0);
  const refresh = () => force((n) => n + 1);

  useEffect(() => { window.scrollTo({ top: 0 }); }, [id, tab]);

  if (!level) {
    return html`
      <div class="page section">
        <h1 class="display display-l">Level not found</h1>
        <p><a class="link" href="#/">back to the levels →</a></p>
      </div>`;
  }

  if (!store.isUnlocked(level.id)) {
    const back = siblings(level).prev;
    return html`
      <div class="page section">
        <span class="kicker">level ${num(level)}</span>
        <h1 class="display display-l" style=${{ margin: '0 0 24px', maxWidth: '18ch' }}>${level.title}</h1>
        <p class="notice" style=${{ maxWidth: '60ch' }}>
          This one is still locked. Finish
          ${' '}<a class="link" href=${`#/level/${back.id}`}>level ${num(back)}, ${back.title}</a>
          ${' '}(pass its drill, mark its build complete) and it opens straight away.
        </p>
      </div>`;
  }

  const state = store.level(level.id);
  const active = tab || 'brief';

  function complete() {
    const items = level.project ? level.project.requirements : level.setup.checklist;
    const ticked = store.reqCount(level.id);
    if (ticked < Math.ceil(items.length * 0.6)) {
      toast(`Tick off what you have actually finished first, ${ticked} of ${items.length} so far.`);
      return;
    }
    const res = store.completeProject(level.id);
    if (!res.already) {
      toast(`Build shipped, +${CFG.xp.projectComplete} XP`, 'moss');
      (res.badges || []).forEach((b, i) =>
        setTimeout(() => toast(`Badge unlocked: ${b.name}`), 700 * (i + 1)));
      const track = FQ.track(FQ.trackIdOf(level));
      if (!siblings(level).next && track) {
        setTimeout(() => toast(
          `${track.title} complete. You are a ${track.ranks[track.ranks.length - 1]}.`,
          'moss'), 1400);
      }
    }
    refresh();
    onProgress();
  }

  function reopen() {
    store.reopenProject(level.id);
    refresh();
    onProgress();
  }

  return html`
    <div class="page">
      <!-- Level masthead: title left, metadata right, divided by a rule. -->
      <section class="section grid" style=${{ paddingBottom: '0' }}>
        <div class="col-1-7">
          <!-- The number and the name, and nothing else. The tagline and the
               codename both belong on the level list, where you are choosing;
               here you have already chosen. -->
          <span class="kicker">${FQ.track(FQ.trackIdOf(level)).name} <b>/</b> level ${num(level)}</span>
          <h1 class="display display-l" style=${{ margin: '0' }}>${level.title}</h1>
        </div>

        <div class="col-9-12">
          <table class="data" style=${{ marginTop: '6px' }}>
            <tbody>
              <tr>
                <td class="mono" style=${{ color: 'var(--graphite)' }}>difficulty</td>
                <td style=${{ textAlign: 'right' }}>
                  <${Gauge} value=${level.difficulty} />
                  <span class="figure" style=${{ marginLeft: '10px', color: 'var(--bone)' }}>
                    ${level.difficulty}/10
                  </span>
                </td>
              </tr>
              <tr>
                <td class="mono" style=${{ color: 'var(--graphite)' }}>time</td>
                <td class="figure" style=${{ textAlign: 'right', color: 'var(--bone)' }}>
                  about ${level.minutes} min
                </td>
              </tr>
              <tr>
                <td class="mono" style=${{ color: 'var(--graphite)' }}>covers</td>
                <!-- A list of three short words does not need three boxes
                     drawn round it, and boxes right-justified against a narrow
                     column wrap into an orphan. It is a list; set it as one. -->
                <td class="figure" style=${{ textAlign: 'right', color: 'var(--bone)' }}>
                  ${level.tags.join(', ')}
                </td>
              </tr>
              ${store.isCleared(level.id) ? html`
                <tr>
                  <td class="mono" style=${{ color: 'var(--graphite)' }}>status</td>
                  <td class="figure" style=${{ textAlign: 'right', color: 'var(--moss)' }}>cleared</td>
                </tr>` : null}
            </tbody>
          </table>
        </div>
      </section>

      <${Tabs.Root} value=${active} onValueChange=${(v) => navigate(`#/level/${level.id}/${v}`)}>
        <${Tabs.List} style=${{ marginTop: '44px' }}>
          ${tabsFor(level).map((t) => html`
            <${Tabs.Trigger} key=${t.id} value=${t.id}>
              ${t.label}
              ${t.id === 'drill' ? ` ${state.quizBest}/${level.quiz.length}` : ''}
              ${t.id === 'build' && state.projectDone ? ' ✓' : ''}
              ${t.id === 'build' && !state.projectDone && !state.quizPassed ? ' (locked)' : ''}
            <//>`)}
        <//>

        <div class="section">
          ${active === 'brief' ? html`<${Brief} level=${level} state=${state} />` : null}
          ${active === 'learn' ? html`<${Learn} level=${level} onAskTutor=${onAskTutor} />` : null}
          ${active === 'tutorial' ? html`<${Tutorial} level=${level} />` : null}
          ${active === 'drill' ? html`
            <div class="grid"><div class="col-1-12">
              <${DrillTab} level=${level} state=${state} onProgress=${(outcome) => {
                if (outcome.firstPass) {
                  toast(`Drill cleared, +${outcome.gained} XP`, 'moss');
                } else if (outcome.gained) {
                  toast(`Best score improved, +${outcome.gained} XP`, 'moss');
                }
                (outcome.badges || []).forEach((b, i) =>
                  setTimeout(() => toast(`Badge unlocked: ${b.name}`), 700 * (i + 1)));
                refresh();
                onProgress();
              }} />
            </div></div>` : null}
          ${active === 'build' ? html`
            <div class="grid"><div class="col-1-12">
              <${Build} level=${level} state=${state} onComplete=${complete} onReopen=${reopen}
                onChecklistChange=${refresh} />
            </div></div>` : null}
        </div>
      <//>
    </div>`;
}
