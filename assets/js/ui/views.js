/* =========================================================================
   Home (the mission ladder), glossary, and the progress dossier.
   ========================================================================= */
import {
  html, useState, useMemo, FQ, CFG, store, md, navigate, Pips, Box, Flex,
  Grid, Card, Heading, Text, Badge, Button, Link, Separator, TextField,
  Table, Callout, AlertDialog
} from './lib.js';

/* =============================== HOME =============================== */
function LadderRow({ level }) {
  const unlocked = store.isUnlocked(level.id);
  const cleared = store.isCleared(level.id);
  const current = store.currentLevel() === level.id && !cleared;
  const state = store.level(level.id);

  const body = html`
    <${Flex} gap="4" align="start">
      <div className=${'medallion' + (cleared ? ' done' : current ? ' current' : '')}>
        <span className="figure">${cleared ? '✓' : unlocked ? level.id : '🔒'}</span>
      </div>

      <${Box} style=${{ flex: 1, minWidth: 0 }}>
        <${Flex} justify="between" align="start" gap="3" wrap="wrap">
          <${Box} style=${{ minWidth: 0 }}>
            <${Text} size="1" color="gray" className="crumb">
              ${unlocked ? level.codename : `locked · clear level ${level.id - 1}`}
            <//>
            <${Heading} size="4" mt="1" mb="1">${level.title}<//>
            <${Text} as="p" size="2" color="gray" style=${{ maxWidth: '62ch' }}>
              ${md(level.tagline)}
            <//>
          <//>
          ${current ? html`<${Badge} color="blue" variant="solid" radius="full">you are here<//>`: null}
        <//>

        <${Flex} gap="2" mt="3" wrap="wrap" align="center">
          <${Badge} variant="surface" color="gray"><${Pips} value=${level.difficulty} /><//>
          <${Badge} variant="surface" color="gray">~${level.minutes} min<//>
          <${Badge} variant="soft" color=${state.quizPassed ? 'grass' : 'gray'}>
            drill ${state.quizBest}/${level.quiz.length}
          <//>
          <${Badge} variant="soft" color=${state.projectDone ? 'grass' : 'amber'}>
            ${level.project
              ? (state.projectDone ? 'project shipped' : 'project')
              : (state.projectDone ? 'setup done' : 'setup')}
          <//>
        <//>
      <//>
    <//>`;

  return html`
    <li className=${'rung' + (unlocked ? '' : ' locked') + (cleared ? ' cleared' : '')}>
      ${unlocked
        ? html`<a className="rung-link" href=${`#/level/${level.id}`}>
            <${Card} size="3" variant="surface" className="rung-card">${body}<//>
          </a>`
        : html`<${Card} size="3" variant="surface" className="rung-card">${body}<//>`}
    </li>`;
}

export function Home({ onAskTutor }) {
  const cleared = store.clearedCount();
  const current = store.currentLevel();
  const questions = FQ.levels.reduce((n, l) => n + l.quiz.length, 0);
  const projects = FQ.levels.filter((l) => !!l.project).length;

  return html`
    <${Flex} direction="column" gap="6">
      <${Card} size="4" className="hero">
        <${Badge} color="blue" variant="soft" radius="full" mb="3">
          Spider Fintech Society · training arcade
        <//>
        <${Heading} size=${{ initial: '7', sm: '8', md: '9' }} mb="3" className="hero-title">
          Learn fintech by <span className="accent">building</span> it.
        <//>
        <${Text} as="p" size=${{ initial: '3', sm: '4' }} color="gray" mb="5" style=${{ maxWidth: '64ch' }}>
          Every level gives you the knowledge, a hands-on tutorial, a 15-question drill with a full
          answer key, and a build you can finish with nothing but what that level taught you.
        <//>
        <${Flex} gap="3" wrap="wrap">
          <${Button} size="3" onClick=${() => navigate(`#/level/${current}`)}>
            ${cleared ? `Continue level ${current}`: 'Start level 1'}
          <//>
          <${Button} size="3" variant="surface" color="gray" onClick=${onAskTutor}>
            Meet your AI tutor
          <//>
        <//>
        <${Separator} size="4" my="5" />
        <${Grid} columns=${{ initial: '2', sm: '4' }} gap="4">
          ${[
            [`${cleared}/10`, 'levels cleared'],
            [questions, 'drill questions'],
            [projects, 'build projects'],
            [store.xp().toLocaleString(), 'total XP']
          ].map(([value, label], i) => html`
            <${Box} key=${i} className="stat">
              <span className="stat-value figure">${value}</span>
              <span className="stat-label">${label}</span>
            <//>`)}
        <//>
      <//>

      <${Box}>
        <${Flex} justify="between" align="end" gap="3" mb="4" wrap="wrap">
          <${Heading} size="6">Mission map<//>
          <${Text} size="2" color="gray">
            Clear the drill and ship the build to unlock the next level.
          <//>
        <//>
        <ol className="ladder">
          ${FQ.levels.map((lv) => html`<${LadderRow} key=${lv.id} level=${lv} />`)}
        </ol>
      <//>

      <${Box}>
        <${Heading} size="6" mb="4">How a level works<//>
        <${Grid} columns=${{ initial: '1', sm: '2', md: '4' }} gap="3">
          ${[
            ['Learn', 'Concepts, worked numbers, and the reasons behind them. No filler.'],
            ['Tutorial', 'Hands-on steps. Every tool the build needs is introduced here and nowhere else.'],
            ['Drill', `15 questions with instant explanations. ${CFG.quiz.passMark}/15 unlocks the build.`],
            ['Build', 'A project scoped to exactly what you know: with a full solution key in the repo.']
          ].map(([title, body], i) => html`
            <${Card} key=${i} size="3" variant="surface">
              <${Text} size="1" color="blue" className="figure">0${i + 1}<//>
              <${Heading} size="3" mt="1" mb="2">${title}<//>
              <${Text} as="p" size="2" color="gray">${body}<//>
            <//>`)}
        <//>
      <//>
    <//>`;
}

/* ============================= GLOSSARY ============================= */
export function Glossary() {
  const [query, setQuery] = useState('');

  const terms = useMemo(() => {
    const all = [];
    FQ.levels.forEach((lv) => (lv.glossary || []).forEach((g) =>
      all.push({...g, lv: lv.id, blob: (g.t + ' ' + g.d).toLowerCase() })));
    return all.sort((a, b) => a.t.toLowerCase() < b.t.toLowerCase() ? -1 : 1);
  }, []);

  const q = query.trim().toLowerCase();
  const shown = q ? terms.filter((t) => t.blob.indexOf(q) !== -1) : terms;

  return html`
    <${Flex} direction="column" gap="4">
      <${Box}>
        <${Text} size="1" color="gray" className="crumb">
          <${Link} href="#/" color="gray">Mission map<//> / glossary
        <//>
        <${Heading} size=${{ initial: '6', sm: '8' }} mt="2" mb="2">Glossary<//>
        <${Text} as="p" size="3" color="gray">
          Every term the course defines, in one place. ${terms.length} entries.
        <//>
      <//>

      <${TextField.Root} size="3" placeholder="Search: try “idempotency” or “drawdown”"
        value=${query} onChange=${(e) => setQuery(e.target.value)} />

      ${shown.length === 0
        ? html`<${Callout.Root} color="gray" variant="surface">
            <${Callout.Text}>Nothing matches that. Try a shorter word, or ask the tutor.<//>
          <//>`
        : html`
          <${Grid} columns=${{ initial: '1', sm: '2' }} gap="3">
            ${shown.map((g, i) => html`
              <${Card} key=${i} size="2" variant="surface">
                <${Flex} justify="between" align="start" gap="2" mb="1">
                  <${Text} size="3" weight="medium" color="blue" className="figure">${g.t}<//>
                  <${Link} size="1" color="gray" href=${`#/level/${g.lv}`}>level ${g.lv}<//>
                <//>
                <${Text} as="p" size="2" color="gray">${md(g.d)}<//>
              <//>`)}
          <//>`}
    <//>`;
}

/* ============================== DOSSIER ============================== */
export function Dossier({ onReset }) {
  const [confirming, setConfirming] = useState(false);
  const all = store.all();
  const cleared = store.clearedCount();

  let quizzes = 0, projects = 0, answered = 0, totalQ = 0;
  FQ.levels.forEach((lv) => {
    const st = store.level(lv.id);
    if (st.quizPassed) quizzes++;
    if (st.projectDone) projects++;
    answered += st.quizBest;
    totalQ += lv.quiz.length;
  });

  return html`
    <${Flex} direction="column" gap="5">
      <${Box}>
        <${Text} size="1" color="gray" className="crumb">
          <${Link} href="#/" color="gray">Mission map<//> / dossier
        <//>
        <${Heading} size=${{ initial: '6', sm: '8' }} mt="2" mb="2">Your dossier<//>
        <${Flex} gap="2" align="center" wrap="wrap">
          <${Badge} color="amber" variant="soft" radius="full" size="2">${store.rank()}<//>
          <${Text} size="2" color="gray">stored in this browser only<//>
        <//>
      <//>

      <${Grid} columns=${{ initial: '2', sm: '5' }} gap="3">
        ${[
          [all.xp.toLocaleString(), 'total XP'],
          [`${cleared}/10`, 'levels cleared'],
          [`${quizzes}/10`, 'drills passed'],
          [projects, 'builds shipped'],
          [`${answered}/${totalQ}`, 'best answers']
        ].map(([value, label], i) => html`
          <${Card} key=${i} size="2" variant="surface">
            <${Box} className="stat">
              <span className="stat-value figure">${value}</span>
              <span className="stat-label">${label}</span>
            <//>
          <//>`)}
      <//>

      <${Box}>
        <${Heading} size="5" mb="3">Badges<//>
        <${Grid} columns=${{ initial: '2', sm: '4' }} gap="3">
          ${store.BADGES.map((b) => {
            const got = store.badgeEarned(b.id);
            return html`
              <${Card} key=${b.id} size="2" variant="surface" className=${got ? 'badge-card' : 'badge-card locked'}>
                <${Flex} direction="column" align="center" gap="1" py="2">
                  <span className="badge-ico">${b.ico}</span>
                  <${Text} size="2" weight="medium" align="center">${b.name}<//>
                  <${Text} size="1" color="gray" align="center">${got ? 'earned' : b.hint}<//>
                <//>
              <//>`;
          })}
        <//>
      <//>

      <${Box}>
        <${Heading} size="5" mb="3">Level by level<//>
        <${Card} size="1" variant="surface">
          <${Table.Root} variant="ghost" size="1">
            <${Table.Header}>
              <${Table.Row}>
                <${Table.ColumnHeaderCell}>Level<//>
                <${Table.ColumnHeaderCell}>Best drill<//>
                <${Table.ColumnHeaderCell}>Attempts<//>
                <${Table.ColumnHeaderCell}>Build<//>
                <${Table.ColumnHeaderCell}>Status<//>
              <//>
            <//>
            <${Table.Body}>
              ${FQ.levels.map((lv) => {
                const st = store.level(lv.id);
                const status = store.isCleared(lv.id)
                  ? html`<${Badge} color="grass" variant="soft">cleared<//>`
                  : store.isUnlocked(lv.id)
                    ? html`<${Badge} color="amber" variant="soft">open<//>`
                    : html`<${Badge} color="gray" variant="soft">locked<//>`;
                return html`
                  <${Table.Row} key=${lv.id}>
                    <${Table.RowHeaderCell}>
                      <${Link} href=${`#/level/${lv.id}`}>${lv.id}. ${lv.title}<//>
                    <//>
                    <${Table.Cell}><span className="figure">${st.quizBest}/${lv.quiz.length}</span><//>
                    <${Table.Cell}><span className="figure">${st.attempts || 0}</span><//>
                    <${Table.Cell}>${st.projectDone ? '✓' : '·'}<//>
                    <${Table.Cell}>${status}<//>
                  <//>`;
              })}
            <//>
          <//>
        <//>
      <//>

      <${Card} size="3" variant="surface">
        <${Heading} size="3" mb="1">Danger zone<//>
        <${Text} as="p" size="2" color="gray" mb="3">
          Wipes XP, badges, scores and checklists on this device. Your notebooks and GitHub repos
          are untouched.
        <//>
        <${AlertDialog.Root} open=${confirming} onOpenChange=${setConfirming}>
          <${AlertDialog.Trigger}>
            <${Button} color="red" variant="soft">Reset all progress<//>
          <//>
          <${AlertDialog.Content} maxWidth="440px">
            <${AlertDialog.Title}>Erase all progress?<//>
            <${AlertDialog.Description} size="2">
              This clears every score, badge and checklist stored in this browser. It cannot be undone.
            <//>
            <${Flex} gap="3" mt="4" justify="end">
              <${AlertDialog.Cancel}>
                <${Button} variant="soft" color="gray">Keep it<//>
              <//>
              <${AlertDialog.Action}>
                <${Button} color="red" onClick=${onReset}>Erase everything<//>
              <//>
            <//>
          <//>
        <//>
      <//>
    <//>`;
}
