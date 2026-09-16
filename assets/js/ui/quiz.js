/* =========================================================================
   The 15-question drill.
   ========================================================================= */
import { html, useState, useMemo, CFG, store, md, navigate, Btn } from './lib.js';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

function Option({ index, text, state, disabled, onPick }) {
  return html`
    <button type="button" class=${'q-option' + (state ? ' is-' + state : '')}
      disabled=${disabled} onClick=${() => onPick(index)}>
      <span class="q-key">${LETTERS[index]}</span>
      <span>${md(text)}</span>
    </button>`;
}

/* ------------------------------------------------------------ answer key */
export function AnswerKey({ level, answers }) {
  return html`
    <div>
      ${level.quiz.map((q, i) => {
        const wrong = answers && answers[i] !== q.answer;
        return html`
          <div class=${'key-item' + (wrong ? ' is-missed' : '')} key=${i}>
            <span class="kicker">
              <b>${String(i + 1).padStart(2, '0')}</b>
              ${answers ? (wrong ? ' / missed' : ' / correct') : ''}
            </span>
            <p class="title title-s" style=${{ margin: '0 0 10px' }}>${md(q.q)}</p>
            <p class="index-sub" style=${{ margin: '0 0 6px', color: 'var(--moss)' }}>
              ${LETTERS[q.answer]}. ${md(q.options[q.answer])}
            </p>
            <p class="index-sub" style=${{ margin: 0 }}>${md(q.why)}</p>
          </div>`;
      })}
    </div>`;
}

/* ------------------------------------------------------------- score card */
function ScoreCard({ level, score, total, answers, onRetry }) {
  const passed = score >= CFG.quiz.passMark;
  const pct = Math.round((score / total) * 100);
  const missed = level.quiz.filter((q, i) => answers[i] !== q.answer).length;

  return html`
    <div class="stack stack-6">
      <div class=${'score ' + (passed ? 'is-pass' : 'is-fail')}>
        <div>
          <span class="score-figure">
            ${score}/${total}
            <small>${pct}% · pass mark ${CFG.quiz.passMark}</small>
          </span>
        </div>
        <div class="stack stack-4">
          <h2 class="display display-m">
            ${passed
              ? (score === total
                  ? 'Flawless. Nothing left to teach you here.'
                  : `Nicely done. The ${level.project ? 'build' : 'setup checklist'} is open.`)
              : `Not quite yet. You need ${CFG.quiz.passMark} of ${total}.`}
          </h2>
          <p class="index-sub" style=${{ maxWidth: '54ch' }}>
            ${passed
              ? (level.project
                  ? 'Have a look at the key below for anything you missed, then go and build it.'
                  : 'Have a look at the key below for anything you missed, then go and finish setting up.')
              : 'No problem at all. Every question below shows the right answer and why, so re-read the bits you slipped on and run it again. Your best score is the one that counts.'}
          </p>
          <div class="btn-row">
            <${Btn} variant="quiet" onClick=${onRetry}>run it again<//>
            ${passed
              ? html`<${Btn} variant="accent" arrow
                  onClick=${() => navigate(`#/level/${level.id}/build`)}>
                  ${level.project ? 'go to the build' : 'go to the setup'}<//>`
              : html`<${Btn} arrow
                  onClick=${() => navigate(`#/level/${level.id}/learn`)}>back to the knowledge<//>`}
          </div>
        </div>
      </div>

      <div>
        <div class="section-head">
          <h2>Answer key</h2>
          <span class="mono">${missed ? `${missed} missed, marked in the margin` : 'every question correct'}</span>
        </div>
        <${AnswerKey} level=${level} answers=${answers} />
      </div>
    </div>`;
}

/* ------------------------------------------------------------------ drill */
export function Drill({ level, onFinish }) {
  const total = level.quiz.length;
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState(() => new Array(total).fill(null));
  const [locked, setLocked] = useState(() => new Array(total).fill(false));
  const [done, setDone] = useState(false);
  const [result, setResult] = useState(null);

  const correct = useMemo(
    () => answers.reduce((n, a, i) => n + (a === level.quiz[i].answer ? 1 : 0), 0),
    [answers, level]);

  const answered = locked.filter(Boolean).length;
  const q = level.quiz[idx];
  const isLocked = locked[idx];

  function pick(choice) {
    if (isLocked) return;
    const nextAnswers = answers.slice();
    const nextLocked = locked.slice();
    nextAnswers[idx] = choice;
    nextLocked[idx] = true;
    setAnswers(nextAnswers);
    setLocked(nextLocked);
  }

  function finish() {
    const score = answers.reduce((n, a, i) => n + (a === level.quiz[i].answer ? 1 : 0), 0);
    const outcome = store.recordQuiz(level.id, score, total, answers.slice());
    setResult({ score, outcome });
    setDone(true);
    if (onFinish) onFinish(outcome, score);
  }

  function restart() {
    setAnswers(new Array(total).fill(null));
    setLocked(new Array(total).fill(false));
    setIdx(0);
    setDone(false);
    setResult(null);
  }

  if (done) {
    return html`<${ScoreCard} level=${level} score=${result.score} total=${total}
                  answers=${answers} onRetry=${restart} />`;
  }

  return html`
    <div class="stack stack-5">
      <div>
        <div class="section-head" style=${{ marginBottom: '14px' }}>
          <h2 class="mono" style=${{ fontSize: '0.82rem', color: 'var(--ash)' }}>
            question ${String(idx + 1).padStart(2, '0')} of ${total}
          </h2>
          <span class="mono">${correct} correct · pass at ${CFG.quiz.passMark}</span>
        </div>
        <div class="meter"><span style=${{ width: `${(answered / total) * 100}%` }} /></div>
      </div>

      <div>
        <span class="kicker">${level.codename} <b>/</b> drill</span>
        <h3 class="display display-m" style=${{ margin: '0 0 26px', maxWidth: '44ch' }}>
          ${md(q.q)}
        </h3>

        <div>
          ${q.options.map((opt, i) => html`
            <${Option} key=${`${idx}-${i}`} index=${i} text=${opt} disabled=${isLocked} onPick=${pick}
              state=${!isLocked ? '' : i === q.answer ? 'right' : i === answers[idx] ? 'wrong' : 'muted'} />`)}
        </div>

        ${isLocked ? html`
          <aside class=${'note ' + (answers[idx] === q.answer ? 'note-money' : 'note-warn')}
            style=${{ marginTop: '26px' }}>
            <span class="note-label">
              ${answers[idx] === q.answer ? 'correct' : 'answer: ' + LETTERS[q.answer]}
            </span>
            ${md(q.why)}
          </aside>` : null}
      </div>

      <div class="btn-row">
        ${idx > 0 ? html`<${Btn} variant="quiet" onClick=${() => setIdx(idx - 1)}>previous<//>` : null}
        ${isLocked && idx < total - 1
          ? html`<${Btn} onClick=${() => setIdx(idx + 1)} arrow>next question<//>` : null}
        ${isLocked && idx === total - 1
          ? html`<${Btn} variant="accent" onClick=${finish} arrow>see my score<//>` : null}
      </div>
    </div>`;
}
