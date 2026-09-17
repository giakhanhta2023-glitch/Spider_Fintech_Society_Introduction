/* =========================================================================
   Mou: the tutor's brain. No UI in this file.

   Offline mode (the default) answers by retrieval over the whole curriculum,
   so the tutor works with zero setup. If a chat endpoint or an API key is
   configured, questions go to Claude instead and fall back here on any error.
   ========================================================================= */
const FQ = window.FQ;
const CFG = window.FQ_CONFIG;

export const LS_ENDPOINT = 'finquest.tutor.endpoint';
export const LS_KEY = 'finquest.tutor.key';

const STOP = ('a an the and or but if is are was were be been being of in on at to for with from by as it its this that ' +
  'these those i me my you your we our they them he she do does did doing have has had can could should would will ' +
  'shall may might must about into over under again further then once here there when where why how all any both each ' +
  'few more most other some such no nor not only own same so than too very s t just dont should now what which who whom')
  .split(' ');

let index = null;
export const apiState = { tried: false, working: false, warned: false };

/* ============================== INDEX ============================== */
function blocksText(blocks) {
  const out = [];
  (blocks || []).forEach((b) => {
    if (b.p) out.push(b.p);
    if (b.ul) out.push(b.ul.join(' '));
    if (b.ol) out.push(b.ol.join(' '));
    if (b.tip) out.push('Tip: ' + b.tip);
    if (b.warn) out.push('Watch out: ' + b.warn);
    if (b.money) out.push(b.money);
    if (b.h4) out.push(b.h4);
    if (b.table) {
      out.push(b.table.head.join(' ') + ' ' + b.table.rows.map((r) => r.join(' ')).join(' '));
    }
  });
  return out;
}

function firstCode(blocks) {
  for (const b of blocks || []) {
    if (b.code) return { code: b.code, lang: b.lang || 'python' };
  }
  return null;
}

function buildIndex() {
  const docs = [];
  FQ.levels.forEach((lv) => {
    let current = null;
    (lv.knowledge || []).forEach((b) => {
      if (b.h) {
        current = { title: b.h, text: [], lv: lv.id, kind: 'knowledge', tab: 'learn' };
        docs.push(current);
      } else if (b.check) {
        /* A check is already a question with a full answer under it, which is
           the closest thing in the course to what a learner types in here. It
           is indexed on its own so a question can be matched as a question. */
        docs.push({
          title: b.check.q, text: [b.check.a], lv: lv.id, kind: 'check', tab: 'learn'
        });
      } else if (current) {
        blocksText([b]).forEach((t) => current.text.push(t));
        if (b.code && !current.code) current.code = { code: b.code, lang: b.lang || 'text' };
      }
    });

    (lv.glossary || []).forEach((g) =>
      docs.push({ title: g.t, text: [g.d], lv: lv.id, kind: 'glossary', tab: 'learn' }));

    (lv.faq || []).forEach((f) =>
      docs.push({ title: f.q, text: [f.a], lv: lv.id, kind: 'faq', tab: 'tutorial' }));

    ((lv.tutorial && lv.tutorial.steps) || []).forEach((s) =>
      docs.push({
        title: s.t,
        text: blocksText(s.blocks).concat(s.check ? ['You know it worked when : ' + s.check]: []),
        code: firstCode(s.blocks),
        lv: lv.id, kind: 'tutorial', tab: 'tutorial'
      }));

    if (lv.project) {
      docs.push({
        title: lv.project.title,
        text: [lv.project.story, 'Scope: ' + lv.project.scope].concat(lv.project.requirements),
        lv: lv.id, kind: 'project', tab: 'build'
      });
    }
    if (lv.setup) {
      docs.push({
        title: lv.setup.title,
        text: [lv.setup.story].concat(lv.setup.checklist),
        lv: lv.id, kind: 'project', tab: 'build'
      });
    }
  });

  docs.forEach((d) => { d.blob = (d.title + ' ' + d.text.join(' ')).toLowerCase(); });
  return docs;
}

/* ============================ RETRIEVAL ============================ */
function tokens(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9_. ]+/g, ' ').split(/\s+/)
    .filter((t) => t.length > 2 && STOP.indexOf(t) === -1);
}

export function search(query, levelId, limit) {
  if (!index) index = buildIndex();
  const terms = tokens(query);
  if (!terms.length) return [];

  const kindBoost = { faq: 2.2, check: 2.0, glossary: 1.8, knowledge: 1.3, tutorial: 1.2, project: 1.0 };

  const scored = index.map((doc) => {
    let score = 0;
    const title = doc.title.toLowerCase();
    terms.forEach((t) => {
      if (title.indexOf(t) !== -1) score += 4;
      const hits = doc.blob.split(t).length - 1;
      if (hits) score += Math.min(hits, 4);
    });
    if (!score) return null;
    score *= (kindBoost[doc.kind] || 1);
    if (levelId && doc.lv === levelId) score *= 1.6;      // prefer where the learner is
    if (levelId && doc.lv > levelId) score *= 0.55;       // do not spoil later levels
    return { doc, score };
  }).filter(Boolean);

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit || 3);
}

/* first n sentences, written without lookbehind so older Safari can parse it */
function sentences(text, n) {
  const s = String(text).replace(/\s+/g, ' ').trim();
  const out = [];
  let count = 0, start = 0;
  for (let i = 0; i < s.length && count < n; i++) {
    const c = s.charAt(i);
    if ((c === '.' || c === '!' || c === '?') && (i + 1 >= s.length || s.charAt(i + 1) === ' ')) {
      out.push(s.slice(start, i + 1));
      start = i + 1;
      count++;
    }
  }
  if (count < n && start < s.length) out.push(s.slice(start));
  return out.join(' ').trim();
}

function levelLink(lv, tab, label) {
  return '[' + (label || ('level ' + lv)) + '](#/level/' + lv + (tab ? '/' + tab : '') + ')';
}

const ERROR_HELP = {
  nameerror: 'Python has never seen that name. Either a typo, or you never ran the cell that created it. ' +
             'In a notebook, **Runtime → Restart session** then run every cell from the top.',
  typeerror: 'You mixed types: usually text where a number was expected. `int("100") + 50` works; `"100" + 50` does not.',
  indentationerror: 'Your spaces are inconsistent. Everything inside a `def`, `if` or `for` must be indented by the same amount: use 4 spaces.',
  keyerror: 'You asked a dict for a key it does not have. Print the keys first: `print(data.keys())`. In FX code this is usually the base currency missing from the rates map.',
  valueerror: 'The value was the right type but the wrong value, often a failed conversion, or your own validation refusing bad input.',
  zerodivisionerror: 'Something divided by zero. In this course it is nearly always the annuity or payment formula at a 0% rate. Guard it with an `if` before dividing.',
  modulenotfounderror: 'That library is not installed, or you are running from the wrong folder. In Colab: `!pip install name`. For your own package: run from the project root.',
  attributeerror: 'That object does not have that method. A common one is calling `.dt` on a column that is still text: use `parse_dates` when loading.',
  settingwithcopy: 'You filtered a DataFrame and then added a column. Take a copy when you filter: `spend = df[df["amount"] < 0].copy()`.',
  filenotfounderror: 'The path is wrong relative to where the code is running. Build paths from the module location rather than the working directory.',
  indexerror: 'You asked for a position that does not exist, often `[0]` on an empty result. Check the length first.',
  syntaxerror: 'Python could not parse the line. Look at the line *above* the one reported: a missing bracket or quote usually shows up one line late.',
  importerror: 'The library exists but the name you asked for does not. Check the spelling and the version.'
};

/* ============================== ANSWERS ============================== */
export function offlineAnswer(question, ctx) {
  const q = question.toLowerCase().trim();
  const levelId = ctx.levelId;
  const lv = levelId ? FQ.level(levelId) : null;

  if (/^(hi|hey|hello|yo|good (morning|evening|afternoon))\b/.test(q)) {
    return {
      text: lv
        ? `Hello. You are on **level ${lv.id}, ${lv.title}**.\n\n${sentences(lv.summary, 2)}` +
          '\n\nAsk me about any concept here, paste an error message, or say **hint** if the build has you stuck.'
        : 'Hello, I am Mou, your tutor for this course. Open a level and I will follow you into it, or ' +
          'just ask me anything about fintech, Python, or the tools.',
      chips: lv
        ? ['What do I need for the project?', 'hint', 'Explain ' + (lv.glossary[0] ? lv.glossary[0].t : 'the basics')]
        : ['What is fintech?', 'Where do I start?', 'Do I need to install anything?']
    };
  }

  if (/where.*(start|begin)|what.*first|how.*(start|begin)/.test(q)) {
    const cur = FQ.store.currentLevel();
    return {
      text: `Start at ${levelLink(cur, 'brief', 'level ' + cur)}. Work the tabs in order: **learn**, ` +
            `**tutorial**, **drill**, **build**. The drill needs ${CFG.quiz.passMark}/15 to unlock the build, ` +
            'and the build needs nothing beyond what that level taught you.\n\nNothing to install for levels 1 to 8. ' +
            'It all runs in Google Colab in a browser tab.',
      chips: ['Do I need to install Python?', 'What is Colab?', 'How does XP work?']
    };
  }

  if (/(give|show|write|just tell).*(me)?.*(the)?(answer|solution|full code|whole code)|do (it|my project) for me/.test(q)) {
    const path = lv && (lv.project ? lv.project.solutionPath : (lv.setup ? lv.setup.solutionPath : null));
    return {
      text: 'I would rather get you unstuck than hand it over: copying a solution teaches almost nothing, and you ' +
            'will feel that in the next level.\n\nTell me **which requirement** is blocking you and I will give you the ' +
            'next step only.\n\nIf you genuinely want to read the finished version, it lives in the repo' +
            (path ? ' at `' + path + '/`' : '') + '. Read only the part you are stuck on, close it, and retype the fix ' +
            'from memory rather than pasting it.',
      chips: ['hint', 'What is my first requirement?', 'My code gives an error']
    };
  }

  if (/\bhint\b|stuck|where do i (start|begin) (the|my) (project|build)|no idea/.test(q) && lv) {
    const p = lv.project || lv.setup;
    if (p) {
      const reqs = lv.project ? lv.project.requirements : lv.setup.checklist;
      const st = FQ.store.level(lv.id);
      let nextIdx = 0;
      while (nextIdx < reqs.length && st.reqs[String(nextIdx)]) nextIdx++;
      const next = reqs[Math.min(nextIdx, reqs.length - 1)];
      const hits = search(next, lv.id, 2);
      return {
        text: 'Take the next unticked requirement on its own:\n\n> ' + next + '\n\n' +
              (hits.length
                ? `The tutorial step that covers it is **${hits[0].doc.title}**: ` +
                  sentences(hits[0].doc.text.join(' '), 2) + '\n\n' +
                  levelLink(lv.id, hits[0].doc.tab, 'Open that step')
                : 'Everything you need is in the ' + levelLink(lv.id, 'tutorial', 'tutorial') + '.') +
              '\n\nWrite just that one piece, run it, then come back and I will take the next one with you.',
        chips: ['I get an error', 'Explain this step again', 'What are the self-checks?']
      };
    }
  }

  const errorMatch = q.match(/(nameerror|typeerror|indentationerror|keyerror|valueerror|zerodivisionerror|modulenotfounderror|attributeerror|settingwithcopy|filenotfounderror|indexerror|syntaxerror|importerror)/);
  if (errorMatch) {
    const hitsErr = search(errorMatch[1] + ' ' + question, levelId, 2);
    return {
      text: `**${errorMatch[1]}**: ${ERROR_HELP[errorMatch[1]]}` +
            (hitsErr.length
              ? `\n\nRelated, from level ${hitsErr[0].doc.lv}: ${sentences(hitsErr[0].doc.text.join(' '), 2)}` +
                '\n\n' + levelLink(hitsErr[0].doc.lv, hitsErr[0].doc.tab, 'Open the section')
              : '') +
            '\n\nPaste the **last line** of the traceback if you want me to be more specific.',
      chips: ['Explain the traceback', 'hint', 'How do I restart the notebook?']
    };
  }

  if (/\bxp\b|badge|rank|unlock|progress|level up/.test(q)) {
    return {
      text: `Each correct drill answer is worth ${CFG.xp.perCorrectAnswer} XP, passing a drill adds ` +
            `${CFG.xp.quizPassBonus}, and shipping a project adds ${CFG.xp.projectComplete}. ` +
            'A level counts as cleared once you pass its drill **and** mark its build complete. That is what opens the next one.' +
            '\n\nEverything is stored in this browser only, so your progress will not follow you to another device.',
      chips: ['Where do I start?', 'What is in the repo?']
    };
  }

  const hits = search(question, levelId, 3);
  if (!hits.length) {
    return {
      text: 'I could not find that in the course material.\n\nI answer from the ten levels in front of you, so try ' +
            'naming a concept (**compounding**, **idempotency**, **drawdown**, **precision**), pasting an error message, ' +
            'or asking for a **hint** on the build you are on.' +
            (lv ? `\n\nYou are on level ${lv.id}, which covers ${lv.tags.join(', ')}.` : ''),
      chips: lv ? lv.glossary.slice(0, 3).map((g) => 'What is ' + g.t + '?')
                  : ['What is fintech?', 'What is a ledger?', 'What is APR?']
    };
  }

  const best = hits[0].doc;
  /* A check reads here the way it reads on the page: the question, then the
     answer under it. Everything else reads as a section title and its text. */
  let answer = best.kind === 'check'
    ? `From level ${best.lv}, a question much like yours:\n\n> ${best.title}\n\n${sentences(best.text.join(' '), 6)}`
    : `**${best.title}** (level ${best.lv})\n\n${sentences(best.text.join(' '), 4)}`;
  if (best.code) {
    answer += '\n\n```\n' + best.code.code.split('\n').slice(0, 14).join('\n') + '\n```';
  }
  answer += '\n\n' + levelLink(best.lv, best.tab, 'Read the full section');

  const related = hits.slice(1).map((h) => h.doc);
  return {
    text: answer,
    source: `level ${best.lv}, ${best.kind}`,
    chips: related.length
      ? related.map((doc) => {
          /* A question, or a check's scenario, is already the thing to ask:
             only a bare section title needs a verb in front of it. A check
             runs long, and cut short it still carries the words that found
             it, so clicking the chip lands on the same answer. */
          const asks = doc.kind === 'check' || /\?$/.test(doc.title);
          const text = asks ? doc.title : 'Explain ' + doc.title;
          return text.length > 58 ? text.slice(0, 55).trim() + '...' : text;
        })
      : ['Give me an example', 'hint']
  };
}

/* ============================ MODEL MODE ============================ */
/* The passages the retrieval found for this question, handed to the model so
   it answers with the course's own numbers rather than its own. A tutor that
   says the mortgage costs "around $1,400 a month" while the page says
   $1,419.47 teaches the learner to distrust one of them. */
function grounding(question, levelId) {
  const hits = search(question, levelId, 3);
  if (!hits.length) return '';
  const parts = hits.map((h) => {
    const body = sentences(h.doc.text.join(' '), 6);
    return `[level ${h.doc.lv}, ${h.doc.kind}] ${h.doc.title}\n${body}`;
  });
  let out = '';
  for (const part of parts) {
    if (out.length + part.length > 2400) break;
    out += (out ? '\n\n' : '') + part;
  }
  return out
    ? '\n\nCOURSE MATERIAL for this question. Every figure below is verified against the ' +
      'course datasets, so use these numbers rather than any you would otherwise produce, and say ' +
      'plainly when the question falls outside them:\n\n' + out
    : '';
}

export function systemPrompt(ctx, question) {
  const lv = ctx.levelId ? FQ.level(ctx.levelId) : null;
  const base =
    'You are Mou, a small rabbit who tutors inside FinQuest, a 10-level project-based fintech course for ' +
    'university students. You are warm, patient and encouraging, and you explain things plainly. ' +
    'Teach in plain English, use small worked numbers, and keep answers under about 200 words unless asked for more. ' +
    'You help learners reason to their own answer: give the next step or a hint, never a complete project solution, ' +
    'even if asked directly: point them to the repo solution key instead and tell them to read only what they are stuck on. ' +
    'Python runs in Google Colab for levels 1-8, so never tell a beginner to install an IDE before level 9. ' +
    'Money is stored as integer minor units, never floats. You are not a financial adviser: no investment recommendations. ' +
    'If something is outside the course, say so briefly and bring it back to the level they are on.';

  const found = question ? grounding(question, ctx.levelId) : '';

  if (!lv) return base + found;

  let ctxText = `\n\nThe learner is on LEVEL ${lv.id}: ${lv.title}.\n` +
    `Summary: ${lv.summary}\n` +
    `Objectives: ${lv.objectives.join('; ')}\n` +
    `Key terms: ${lv.glossary.map((g) => g.t + ' = ' + g.d).join(' | ')}\n` +
    `Tutorial steps: ${lv.tutorial.steps.map((s) => s.t).join('; ')}`;

  if (lv.project) {
    ctxText += `\nProject: ${lv.project.title}. Scope limit: ${lv.project.scope}` +
      `\nRequirements: ${lv.project.requirements.join('; ')}` +
      `\nSolution key path (mention, never reproduce): ${lv.project.solutionPath}`;
  }
  ctxText += "\nDo not introduce tools or libraries beyond this level's scope.";
  return base + ctxText + found;
}

export function endpoint() {
  try { return window.localStorage.getItem(LS_ENDPOINT) || CFG.tutor.endpoint; }
  catch (e) { return CFG.tutor.endpoint; }
}

export function userKey() {
  try { return window.localStorage.getItem(LS_KEY) || ''; } catch (e) { return ''; }
}

export function askModel(question, ctx, history) {
  const msgs = history.slice(-8).concat([{ role: 'user', content: question }]);
  const key = userKey();

  if (key) {
    return fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: CFG.tutor.model,
        max_tokens: CFG.tutor.maxTokens,
        system: systemPrompt(ctx, question),
        messages: msgs
      })
    }).then((r) => {
      if (!r.ok) throw new Error('anthropic ' + r.status);
      return r.json();
    }).then((data) => {
      const out = (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');
      if (!out) throw new Error('empty response');
      return out;
    });
  }

  const url = endpoint();
  if (!url) return Promise.reject(new Error('no endpoint'));

  return fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      messages: msgs,
      system: systemPrompt(ctx, question),
      model: CFG.tutor.model,
      max_tokens: CFG.tutor.maxTokens,
      level: ctx.levelId || null
    })
  }).then((r) => {
    if (!r.ok) throw new Error('endpoint ' + r.status);
    return r.json();
  }).then((data) => {
    const out = data.text || data.reply || data.content;
    if (typeof out !== 'string' || !out.trim()) throw new Error('bad payload');
    return out;
  });
}

/* Markdown subset -> HTML, for the chat bubbles only. */
export function chatMarkdown(text) {
  const out = [];
  const lines = String(text).split('\n');
  let buf = [], list = [], code = null;

  const flushP = () => { if (buf.length) { out.push('<p>' + FQ.md(buf.join(' ')) + '</p>'); buf = []; } };
  const flushL = () => {
    if (list.length) {
      out.push('<ul>' + list.map((i) => '<li>' + FQ.md(i) + '</li>').join('') + '</ul>');
      list = [];
    }
  };

  lines.forEach((line) => {
    if (/^```/.test(line)) {
      if (code === null) { flushP(); flushL(); code = []; }
      else { out.push('<pre>' + FQ.esc(code.join('\n')) + '</pre>'); code = null; }
      return;
    }
    if (code !== null) { code.push(line); return; }
    if (/^\s*[-*]\s+/.test(line)) { flushP(); list.push(line.replace(/^\s*[-*]\s+/, '')); return; }
    if (/^\s*>\s?/.test(line)) {
      flushP(); flushL();
      out.push('<blockquote>' + FQ.md(line.replace(/^\s*>\s?/, '')) + '</blockquote>');
      return;
    }
    if (!line.trim()) { flushP(); flushL(); return; }
    buf.push(line);
  });
  if (code !== null) out.push('<pre>' + FQ.esc(code.join('\n')) + '</pre>');
  flushP(); flushL();
  return out.join('');
}
