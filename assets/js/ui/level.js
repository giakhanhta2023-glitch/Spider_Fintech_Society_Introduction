/* =========================================================================
   One level: brief, knowledge, tutorial, drill, build.
   ========================================================================= */
import {
  html, useState, useEffect, FQ, CFG, store, md, navigate, Pips, Box, Flex,
  Grid, Card, Heading, Text, Badge, Button, Link, Tabs, Progress, Callout,
  Table, Code
} from './lib.js';
import { Blocks, CodeBlock } from './blocks.js';
import { Drill, AnswerKey } from './quiz.js';

const TABS = [
  { id: 'brief', label: 'Brief' },
  { id: 'learn', label: 'Learn' },
  { id: 'tutorial', label: 'Tutorial' },
  { id: 'drill', label: 'Drill' },
  { id: 'build', label: 'Build' }
];

/* ------------------------------------------------------------------ brief */
function Brief({ level, state }) {
  const brief = level.project || level.setup;
  return html`
    <${Flex} direction="column" gap="4">
      <${Card} size="3" variant="surface">
        <${Heading} size="4" mb="2">What this level is about<//>
        <${Text} as="p" size="3" color="gray">${md(level.summary)}<//>
      <//>

      <${Grid} columns=${{ initial: '1', sm: '2' }} gap="4">
        <${Card} size="3" variant="surface">
          <${Heading} size="3" mb="3">By the end you can<//>
          <ul className="prose-list">
            ${level.objectives.map((o, i) => html`
              <li key=${i}><${Text} size="2" color="gray">${md(o)}<//></li>`)}
          </ul>
        <//>
        <${Card} size="3" variant="surface">
          <${Heading} size="3" mb="2">${level.project ? 'You will build' : 'Your mission'}<//>
          <${Text} as="p" size="3" color="blue" weight="medium" mb="2">${brief.title}<//>
          <${Text} as="p" size="2" color="gray">${md(brief.story)}<//>
          ${level.project ? html`
            <${Text} as="p" size="1" color="gray" mt="3">
              <strong>Scope:</strong> ${md(level.project.scope)}
            <//>`: null}
        <//>
      <//>

      <${Card} size="3" variant="surface">
        <${Heading} size="3" mb="3">Your progress here<//>
        <${Grid} columns=${{ initial: '2', sm: '4' }} gap="3">
          ${[
            ['best drill score', `${state.quizBest}/${level.quiz.length}`],
            ['drill attempts', state.attempts],
            [level.project ? 'project shipped' : 'setup done', state.projectDone ? 'yes' : 'no'],
            ['level cleared', store.isCleared(level.id) ? 'yes' : 'not yet']
          ].map(([label, value], i) => html`
            <${Box} key=${i} className="stat">
              <span className="stat-value figure">${value}</span>
              <span className="stat-label">${label}</span>
            <//>`)}
        <//>
        <${Flex} gap="3" mt="4" wrap="wrap">
          <${Button} onClick=${() => navigate(`#/level/${level.id}/learn`)}>Start with the knowledge<//>
          <${Button} variant="soft" color="gray"
            onClick=${() => navigate(`#/level/${level.id}/drill`)}>Jump to the drill<//>
        <//>
      <//>
    <//>`;
}

/* ------------------------------------------------------------------ learn */
function Learn({ level, onAskTutor }) {
  return html`
    <${Flex} direction="column" gap="4">
      <${Card} size="4" variant="surface">
        <${Blocks} blocks=${level.knowledge} />
      <//>
      <${Card} size="3" variant="surface">
        <${Heading} size="3" mb="3">Glossary for this level<//>
        <${Grid} columns=${{ initial: '1', sm: '2' }} gap="2">
          ${level.glossary.map((g, i) => html`
            <${Box} key=${i} className="term">
              <${Text} size="2" weight="medium" color="blue" className="figure">${g.t}<//>
              <${Text} as="p" size="2" color="gray" mt="1">${md(g.d)}<//>
            <//>`)}
        <//>
      <//>
      <${Flex} gap="3" wrap="wrap">
        <${Button} onClick=${() => navigate(`#/level/${level.id}/tutorial`)}>On to the tutorial<//>
        <${Button} variant="soft" color="gray" onClick=${onAskTutor}>Ask the tutor about this level<//>
      <//>
    <//>`;
}

/* --------------------------------------------------------------- tutorial */
function Tutorial({ level }) {
  return html`
    <${Flex} direction="column" gap="4">
      <${Card} size="3" variant="surface">
        <${Heading} size="4" mb="2">Hands-on tutorial<//>
        <${Text} as="p" size="3" color="gray">${md(level.tutorial.intro)}<//>
        <${Callout.Root} color="blue" variant="surface" mt="3">
          <${Callout.Text}>
            <span className="note-label">Promise</span>
            Everything the project needs is taught here. If the build asks for something this tutorial
            did not cover, that is a bug in the course, not in you.
          <//>
        <//>
      <//>

      <ol className="steps">
        ${level.tutorial.steps.map((step, i) => html`
          <li className="step" key=${i}>
            <span className="step-number figure">${i + 1}</span>
            <${Card} size="3" variant="surface">
              <${Heading} size="3" mb="2">${md(step.t)}<//>
              <${Blocks} blocks=${step.blocks} />
              ${step.check ? html`
                <${Flex} gap="2" align="start" className="step-check" mt="3">
                  <${Badge} color="blue" variant="soft" radius="full">Check<//>
                  <${Text} size="2" color="gray">${md(step.check)}<//>
                <//>`: null}
            <//>
          </li>`)}
      </ol>

      <${Flex}>
        <${Button} onClick=${() => navigate(`#/level/${level.id}/drill`)}>Take the drill<//>
      <//>
    <//>`;
}

/* ------------------------------------------------------------------ drill */
function DrillTab({ level, state, onProgress }) {
  const [running, setRunning] = useState(false);
  const [showKey, setShowKey] = useState(false);

  if (running) {
    /* The Drill renders its own score card when it finishes, so this only
       forwards the result upward, unmounting here would hide the score. */
    return html`<${Drill} level=${level} onFinish=${onProgress} />`;
  }

  return html`
    <${Flex} direction="column" gap="4">
      <${Card} size="3" variant="surface">
        <${Heading} size="4" mb="2">Drill: ${level.quiz.length} questions<//>
        <${Text} as="p" size="3" color="gray">
          Score <strong>${CFG.quiz.passMark} of ${level.quiz.length}</strong> to unlock the build.
          Every answer comes with an explanation, and the full key is shown at the end: including
          on a fail. Your best score is the one that sticks.
        <//>
        ${state.quizPassed ? html`
          <${Callout.Root} color="grass" variant="surface" mt="3">
            <${Callout.Text}>
              <span className="note-label">Cleared</span>
              Best score ${state.quizBest}/${level.quiz.length} across
              ${' ' + state.attempts} attempt${state.attempts === 1 ? '' : 's'}.
              Running it again cannot lower it.
            <//>
          <//>`: null}
        <${Flex} gap="3" mt="4" wrap="wrap">
          <${Button} onClick=${() => setRunning(true)}>
            ${state.attempts ? 'Run the drill again' : 'Start the drill'}
          <//>
          ${state.quizPassed ? html`
            <${Button} variant="soft" color="gray" onClick=${() => setShowKey(!showKey)}>
              ${showKey ? 'Hide the answer key' : 'Show the answer key'}
            <//>`: null}
        <//>
      <//>
      ${showKey ? html`<${AnswerKey} level=${level} answers=${null} />`: null}
    <//>`;
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
    <${Box}>
      <${Flex} direction="column" gap="2">
        ${items.map((item, i) => {
          const on = !!state.reqs[String(i)];
          return html`
            <button type="button" key=${i} className=${'req' + (on ? ' checked' : '')}
              onClick=${() => toggle(i)} aria-pressed=${on}>
              <span className="req-box">${on ? '✓' : ''}</span>
              <${Text} size="2" color=${on ? undefined : 'gray'}>${md(item)}<//>
            </button>`;
        })}
      <//>
      <${Flex} align="center" gap="3" mt="3">
        <${Box} style=${{ flex: 1, maxWidth: '260px' }}>
          <${Progress} value=${(checked / items.length) * 100} color="blue" size="1" />
        <//>
        <${Text} size="1" color="gray" className="figure">${checked} / ${items.length} complete<//>
      <//>
    <//>`;
}

function SolutionKey({ path, level }) {
  const url = `${CFG.repoUrl}/tree/${CFG.repo.branch}/${path}`;
  return html`
    <${Card} size="3" variant="surface">
      <${Heading} size="3" mb="2">Solution key<//>
      <${Text} as="p" size="2" color="gray" mb="2">
        A complete, commented and verified solution lives in the repository at
        ${' '}<${Code}>${path}/</${Code}>, with a walkthrough README and this level's answer key.
      <//>
      <${Callout.Root} color="amber" variant="surface" mb="3">
        <${Callout.Text}>
          <span className="note-label">Use it properly</span>
          Attempt it yourself, ask the tutor for a hint, then read only the part you are stuck on,
          and retype the fix rather than pasting it.
        <//>
      <//>
      <${Flex} gap="3" wrap="wrap">
        <${Button} asChild><a href=${url} target="_blank" rel="noopener">Open the key on GitHub</a><//>
        <${Button} variant="soft" color="gray" asChild>
          <a href=${CFG.repoUrl} target="_blank" rel="noopener">Browse the repo</a>
        <//>
      <//>
    <//>`;
}

function Build({ level, state, onComplete, onReopen, onChecklistChange }) {
  if (!state.quizPassed) {
    return html`
      <${Callout.Root} color="amber" variant="surface">
        <${Callout.Text}>
          The build unlocks at <strong>${CFG.quiz.passMark}/${level.quiz.length}</strong> on the drill.
          Best so far: ${state.quizBest}.
          ${' '}<${Link} href=${`#/level/${level.id}/drill`}>Go to the drill<//>
        <//>
      <//>`;
    }

  const project = level.project;
  const setup = level.setup;
  const items = project ? project.requirements : setup.checklist;
  const brief = project || setup;

  return html`
    <${Flex} direction="column" gap="4">
      <${Card} size="4" className="brief-card">
        <${Badge} color="violet" variant="soft" radius="full" mb="2">
          ${project ? 'build mission' : 'setup mission'}
        <//>
        <${Heading} size=${{ initial: '5', sm: '6' }} mb="2">${brief.title}<//>
        <${Text} as="p" size="3" color="gray">${md(brief.story)}<//>
        ${project ? html`
          <${Callout.Root} color="violet" variant="surface" mt="3">
            <${Callout.Text}>
              <span className="note-label">Scope</span>${md(project.scope)}
            <//>
          <//>`: null}
        ${project && project.dataset ? html`
          <${Text} as="p" size="1" color="gray" mt="3">
            Dataset: <${Code}>${FQ.subst(project.dataset)}<//>
          <//>`: null}
      <//>

      <${Card} size="3" variant="surface">
        <${Heading} size="3" mb="1">${project ? 'Requirements' : 'Checklist'}<//>
        <${Text} as="p" size="1" color="gray" mb="3">
          Tick them off as you go. Your progress is saved on this device.
        <//>
        <${Checklist} levelId=${level.id} items=${items} onChange=${onChecklistChange} />
      <//>

      ${project ? html`
        <${Card} size="3" variant="surface">
          <${Heading} size="3" mb="1">Starter file<//>
          <${Text} as="p" size="2" color="gray" mb="2">
            Copy this into your notebook and fill in the TODOs. The structure is a suggestion,
            not a cage.
          <//>
          <${CodeBlock} code=${project.starter.code} lang=${project.starter.lang}
            label=${project.starter.lang === 'text' ? 'project layout' : 'starter'} />
        <//>

        <${Card} size="3" variant="surface">
          <${Heading} size="3" mb="1">Self-check<//>
          <${Text} as="p" size="2" color="gray" mb="3">
            Your code should produce exactly these results. If a number disagrees,
            the difference is the bug.
          <//>
          <${Flex} direction="column" gap="2">
            ${project.tests.map((t, i) => html`
              <${Flex} key=${i} gap="2" align="start">
                <${Badge} color="gray" variant="soft" radius="full" className="figure">${i + 1}<//>
                <${Text} size="2" color="gray" className="mono-inline">${FQ.subst(t)}<//>
              <//>`)}
          <//>
        <//>

        <${Card} size="3" variant="surface">
          <${Heading} size="3" mb="3">How it is marked<//>
          <${Table.Root} variant="ghost" size="1">
            <${Table.Body}>
              ${project.rubric.map((r, i) => html`
                <${Table.Row} key=${i}>
                  <${Table.RowHeaderCell} width="70px">
                    <${Text} color="amber" className="figure">${r.pts} pts<//>
                  <//>
                  <${Table.Cell}>
                    <${Text} as="div" size="2" weight="medium">${r.t}<//>
                    <${Text} as="div" size="2" color="gray">${md(r.d)}<//>
                  <//>
                <//>`)}
            <//>
          <//>
        <//>

        <${Card} size="3" variant="surface">
          <${Heading} size="3" mb="3">If you want more<//>
          <ul className="prose-list">
            ${project.stretch.map((s, i) => html`
              <li key=${i}><${Text} size="2" color="gray">${md(s)}<//></li>`)}
          </ul>
        <//>`: null}

      <${SolutionKey} path=${brief.solutionPath} level=${level} />

      <${Card} size="4" variant="surface">
        <${Flex} direction="column" align="center" gap="3" py="2">
          ${state.projectDone ? html`
            <${Heading} size="4" color="grass">Shipped<//>
            <${Text} size="2" color="gray">
              ${level.id < 10 ? `Level ${level.id + 1} is open.`: 'The course is complete.'}
            <//>
            <${Flex} gap="3" wrap="wrap" justify="center">
              ${level.id < 10
                ? html`<${Button} onClick=${() => navigate(`#/level/${level.id + 1}`)}>Next level<//>`
                : html`<${Button} onClick=${() => navigate('#/progress')}>See your dossier<//>`}
              <${Button} variant="soft" color="gray" onClick=${onReopen}>Reopen it<//>
            <//>`
                : html`
            <${Heading} size="4">Finished building?<//>
            <${Text} size="2" color="gray" align="center" style=${{ maxWidth: '52ch' }}>
              Mark it complete once your code runs, the self-checks pass, and it is committed to
              your portfolio repo. This unlocks the next level.
            <//>
            <${Button} size="3" onClick=${onComplete}>
              Mark ${project ? 'project' : 'setup'} complete · +${CFG.xp.projectComplete} XP
            <//>`}
        <//>
      <//>
    <//>`;
}

/* ------------------------------------------------------------------ page */
export function LevelPage({ id, tab, onAskTutor, onProgress, toast }) {
  const level = FQ.level(id);
  const [, force] = useState(0);
  const refresh = () => force((n) => n + 1);

  useEffect(() => { window.scrollTo({ top: 0 }); }, [id, tab]);

  if (!level) {
    return html`
      <${Card} size="3"><${Heading} size="4">Level not found<//>
        <${Link} href="#/">Back to the map<//><//>`;
  }

  if (!store.isUnlocked(level.id)) {
    return html`
      <${Flex} direction="column" gap="3">
        <${Text} size="1" color="gray" className="crumb">
          <${Link} href="#/" color="gray">Mission map<//> / level ${level.id}
        <//>
        <${Heading} size=${{ initial: '6', sm: '7' }}>${level.title}<//>
        <${Callout.Root} color="amber" variant="surface">
          <${Callout.Text}>
            This level is locked. Clear
            ${' '}<${Link} href=${`#/level/${level.id - 1}`}>level ${level.id - 1}<//>
            ${' '} (pass its drill and mark its build complete) to open it.
          <//>
        <//>
      <//>`;
  }

  const state = store.level(level.id);
  const active = tab || 'brief';

  function complete() {
    const items = level.project ? level.project.requirements : level.setup.checklist;
    const ticked = store.reqCount(level.id);
    if (ticked < Math.ceil(items.length * 0.6)) {
      toast(`Tick off what you have actually finished first: ${ticked}/${items.length} so far.`, 'amber');
      return;
    }
    const res = store.completeProject(level.id);
    if (!res.already) {
      toast(`Build shipped · +${CFG.xp.projectComplete} XP`, 'grass');
      (res.badges || []).forEach((b, i) =>
        setTimeout(() => toast(`Badge unlocked: ${b.name}`, 'violet'), 700 * (i + 1)));
      if (level.id === 10) {
        setTimeout(() => toast('Course complete. You are a Chief Fintech Officer.', 'grass'), 1400);
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
    <${Flex} direction="column" gap="4">
      <${Box}>
        <${Text} size="1" color="gray" className="crumb">
          <${Link} href="#/" color="gray">Mission map<//> / level ${level.id} / ${level.codename}
        <//>
        <${Heading} size=${{ initial: '6', sm: '8' }} mt="2" mb="2">${level.title}<//>
        <${Text} as="p" size="3" color="gray" style=${{ maxWidth: '70ch' }}>${md(level.tagline)}<//>
        <${Flex} gap="2" mt="3" wrap="wrap" align="center">
          <${Badge} variant="surface" color="gray"><${Pips} value=${level.difficulty} /> ${level.difficulty}/10<//>
          <${Badge} variant="surface" color="gray">~${level.minutes} min<//>
          ${level.tags.map((t, i) => html`<${Badge} key=${i} variant="soft" color="gray">${t}<//>`)}
          ${store.isCleared(level.id)
            ? html`<${Badge} color="grass" variant="soft">cleared</${Badge}>`: null}
        <//>
      <//>

      <${Tabs.Root} value=${active}
        onValueChange=${(v) => navigate(`#/level/${level.id}/${v}`)}>
        <${Tabs.List} size="2">
          ${TABS.map((t) => html`
            <${Tabs.Trigger} key=${t.id} value=${t.id}>
              ${t.label}
              ${t.id === 'drill' ? html`
                <${Badge} ml="2" size="1" variant="soft" color=${state.quizPassed ? 'grass' : 'gray'}>
                  ${state.quizBest}/${level.quiz.length}
                <//>`: null}
              ${t.id === 'build' && state.projectDone ? html`
                <${Badge} ml="2" size="1" variant="soft" color="grass">done<//>`: null}
              ${t.id === 'build' && !state.projectDone && !state.quizPassed ? html`
                <${Badge} ml="2" size="1" variant="soft" color="gray">locked<//>`: null}
            <//>`)}
        <//>

        <${Box} pt="5">
          ${active === 'brief' ? html`<${Brief} level=${level} state=${state} />`: null}
          ${active === 'learn' ? html`<${Learn} level=${level} onAskTutor=${onAskTutor} />`: null}
          ${active === 'tutorial' ? html`<${Tutorial} level=${level} />`: null}
          ${active === 'drill' ? html`
            <${DrillTab} level=${level} state=${state} onProgress=${(outcome, score) => {
              if (outcome.firstPass) {
                toast(`Drill cleared · +${CFG.xp.quizPassBonus + score * CFG.xp.perCorrectAnswer} XP`, 'grass');
              }
              (outcome.badges || []).forEach((b, i) =>
                setTimeout(() => toast(`Badge unlocked: ${b.name}`, 'violet'), 700 * (i + 1)));
              refresh();
              onProgress();
            }} />`: null}
          ${active === 'build' ? html`
            <${Build} level=${level} state=${state} onComplete=${complete} onReopen=${reopen}
              onChecklistChange=${refresh} />`: null}
        <//>
      <//>
    <//>`;
}
