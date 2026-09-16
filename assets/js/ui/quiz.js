/* =========================================================================
   The 15-question drill.
   ========================================================================= */
import {
  html, useState, useMemo, CFG, store, md, navigate, Box, Flex, Card,
  Heading, Text, Badge, Button, Progress, Callout
} from './lib.js';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

function Option({ index, text, state, disabled, onPick }) {
  return html`
    <button
      type="button"
      className=${'q-option' + (state ? ' ' + state : '')}
      disabled=${disabled}
      onClick=${() => onPick(index)}>
      <span className="q-key">${LETTERS[index]}</span>
      <span className="q-text">${md(text)}</span>
    </button>`;
}

function Explanation({ correct, letter, why }) {
  return html`
    <${Callout.Root} mt="4" variant="surface" color=${correct ? 'grass' : 'violet'}>
      <${Callout.Text}>
        <span className="note-label">${correct ? 'Correct' : 'Answer: ' + letter}</span>
        ${md(why)}
      <//>
    <//>`;
}

/* ------------------------------------------------------------ answer key */
export function AnswerKey({ level, answers }) {
  return html`
    <${Flex} direction="column" gap="3">
      ${level.quiz.map((q, i) => {
        const wrong = answers && answers[i] !== q.answer;
        return html`
          <${Card} key=${i} variant="surface" className=${wrong ? 'key-card missed' : 'key-card'}>
            <${Flex} justify="between" align="start" gap="3" mb="1">
              <${Text} size="2" weight="medium">${i + 1}. ${md(q.q)}<//>
              ${answers ? html`<${Badge} color=${wrong ? 'red' : 'grass'} variant="soft">
                ${wrong ? 'missed' : 'correct'}<//>`: null}
            <//>
            <${Text} as="p" size="2" color="grass" mb="1">
              ${LETTERS[q.answer]}. ${md(q.options[q.answer])}
            <//>
            <${Text} as="p" size="2" color="gray">${md(q.why)}<//>
          <//>`;
      })}
    <//>`;
}

/* ------------------------------------------------------------- score card */
function ScoreCard({ level, score, total, answers, onRetry, onRefresh }) {
  const passed = score >= CFG.quiz.passMark;
  const pct = Math.round((score / total) * 100);
  const missed = level.quiz.filter((q, i) => answers[i] !== q.answer).length;

  return html`
    <${Flex} direction="column" gap="5">
      <${Card} size="4" variant="surface">
        <${Flex} direction="column" align="center" gap="4" py="4">
          <div className=${'score-ring' + (passed ? '' : ' fail')} style=${{ '--pct': pct }}>
            <div className="score-ring-inner">
              <span className="figure score-value">${score}/${total}</span>
              <span className="score-pct">${pct}%</span>
            </div>
          </div>
          <${Heading} size="6" align="center">
            ${passed
              ? (score === total ? 'Flawless. Nothing left to teach you here.' : 'Cleared. The build is unlocked.')
              : `Not yet. You need ${CFG.quiz.passMark} of ${total}.`}
          <//>
          <${Text} size="3" color="gray" align="center" style=${{ maxWidth: '52ch' }}>
            ${passed
              ? 'Read the key below for anything you missed, then go and build.'
              : 'Every question below shows the correct answer and why. Re-read the sections you slipped on, then run it again. Your best score is the one that counts.'}
          <//>
          <${Flex} gap="3" wrap="wrap" justify="center">
            <${Button} variant="soft" color="gray" onClick=${onRetry}>Run it again<//>
            ${passed
              ? html`<${Button} onClick=${() => navigate(`#/level/${level.id}/build`)}>Go to the build<//>`
              : html`<${Button} color="amber" onClick=${() => navigate(`#/level/${level.id}/learn`)}>
                  Back to the knowledge<//>`}
          <//>
        <//>
      <//>

      <${Box}>
        <${Flex} justify="between" align="center" mb="3" wrap="wrap" gap="2">
          <${Heading} size="4">Answer key<//>
          <${Text} size="2" color="gray">
            ${missed ? `${missed} missed, marked below`: 'every question correct'}
          <//>
        <//>
        <${AnswerKey} level=${level} answers=${answers} />
      <//>
    <//>`;
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
    <${Flex} direction="column" gap="4">
      <${Flex} align="center" gap="4" wrap="wrap">
        <${Text} size="2" color="gray">
          Question <span className="figure">${idx + 1}</span> of ${total}
        <//>
        <${Box} style=${{ flex: 1, minWidth: '160px' }}>
          <${Progress} value=${(answered / total) * 100} color="blue" size="2" />
        <//>
        <${Text} size="2" color="gray">
          <span className="figure">${correct}</span> correct · pass at ${CFG.quiz.passMark}
        <//>
      <//>

      <${Card} size="3" variant="surface">
        <${Badge} color="blue" variant="soft" radius="full" mb="2">${level.codename} · drill<//>
        <${Heading} size="4" mt="2" mb="4" weight="medium">${md(q.q)}<//>

        <${Flex} direction="column" gap="2">
          ${q.options.map((opt, i) => html`
            <${Option} key=${`${idx}-${i}`} index=${i} text=${opt} disabled=${isLocked}
              onPick=${pick}
              state=${!isLocked ? '' : i === q.answer ? 'right' : i === answers[idx] ? 'wrong' : 'muted'} />`)}
        <//>

        ${isLocked ? html`<${Explanation} correct=${answers[idx] === q.answer}
                            letter=${LETTERS[q.answer]} why=${q.why} />`: null}
      <//>

      <${Flex} gap="3" wrap="wrap">
        ${idx > 0 ? html`<${Button} variant="soft" color="gray"
          onClick=${() => setIdx(idx - 1)}>Previous<//>`: null}
        ${isLocked && idx < total - 1
          ? html`<${Button} onClick=${() => setIdx(idx + 1)}>Next question<//>`: null}
        ${isLocked && idx === total - 1
          ? html`<${Button} color="amber" onClick=${finish}>See my score<//>`: null}
      <//>
    <//>`;
}
