/* =========================================================================
   Mou, the tutor. A panel pinned to the right edge, set like a margin note:
   mono for the machinery, serif for the answers.
   ========================================================================= */
import {
  html, useState, useEffect, useRef, FQ, store, rawHtml, Dialog, Btn, Tag
} from './lib.js';
import { Mou } from './mou.js';
import {
  offlineAnswer, askModel, chatMarkdown, apiState, endpoint, userKey,
  LS_ENDPOINT, LS_KEY
} from './tutor-engine.js';

function Bubble({ role, html: markup, source }) {
  if (role === 'user') {
    return html`<div class="bubble me">${markup}</div>`;
  }
  return html`
    <div class="bubble bot">
      ${rawHtml(markup, { class: 'bubble-body' })}
      ${source ? html`<span class="bubble-source">${source}</span>` : null}
    </div>`;
}

function Typing() {
  return html`
    <div class="bubble bot"><span class="typing"><i /><i /><i /></span></div>`;
}

function modeLabel() {
  if (userKey()) return 'model, your key';
  return apiState.working ? 'model, course endpoint' : 'course knowledge base';
}

export function Tutor({ open, onOpenChange, levelId }) {
  const [messages, setMessages] = useState([]);
  const [chips, setChips] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [endpointValue, setEndpointValue] = useState('');
  const [keyValue, setKeyValue] = useState('');
  const [status, setStatus] = useState('');
  const [mode, setMode] = useState('course knowledge base');
  const [cheer, setCheer] = useState(false);
  const logRef = useRef(null);
  const historyRef = useRef([]);
  const cheerRef = useRef(null);

  /* Mou looks up while she is working and beams for a moment once the answer
     has landed, then settles back. */
  const mood = busy ? 'thinking' : cheer ? 'happy' : 'idle';

  const level = levelId ? FQ.level(levelId) : null;

  useEffect(() => {
    try {
      setEndpointValue(window.localStorage.getItem(LS_ENDPOINT) || '');
      setKeyValue(window.localStorage.getItem(LS_KEY) || '');
    } catch (e) { /* private mode */ }
  }, []);

  useEffect(() => {
    if (!open || messages.length) return;
    const greeting = offlineAnswer('hello', { levelId });
    setMessages([{ role: 'bot', html: chatMarkdown(greeting.text) }]);
    setChips(greeting.chips || []);
  }, [open]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages, busy]);

  useEffect(() => { setMode(modeLabel()); }, [open, messages]);

  useEffect(() => () => clearTimeout(cheerRef.current), []);

  function push(msg) {
    setMessages((prev) => prev.concat([msg]));
    if (msg.role === 'bot') {
      setCheer(true);
      clearTimeout(cheerRef.current);
      cheerRef.current = setTimeout(() => setCheer(false), 2400);
    }
  }

  function ask(text) {
    const question = String(text || '').trim();
    if (!question || busy) return;

    setInput('');
    setChips([]);
    push({ role: 'user', html: question });
    historyRef.current.push({ role: 'user', content: question });
    store.bumpTutor();

    const ctx = { levelId };
    const useModel = !!userKey() || (!!endpoint() && !apiState.tried) || apiState.working;

    const answerOffline = (note) => {
      const a = offlineAnswer(question, ctx);
      push({ role: 'bot', html: chatMarkdown(a.text), source: note || a.source });
      historyRef.current.push({ role: 'assistant', content: a.text });
      setChips(a.chips || []);
      setBusy(false);
      setMode(modeLabel());
    };

    if (!useModel) {
      setBusy(true);
      setTimeout(() => answerOffline(), 160);
      return;
    }

    setBusy(true);
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 25000));

    Promise.race([askModel(question, ctx, historyRef.current.slice(0, -1)), timeout])
      .then((answer) => {
        apiState.tried = true;
        apiState.working = true;
        push({
          role: 'bot',
          html: chatMarkdown(answer),
          source: 'Claude, ' + (userKey() ? 'your key' : 'course endpoint')
        });
        historyRef.current.push({ role: 'assistant', content: answer });
        setChips(['give me an example', 'hint', 'why does that matter?']);
        setBusy(false);
        setMode(modeLabel());
      })
      .catch(() => {
        apiState.tried = true;
        apiState.working = false;
        answerOffline('course knowledge base');
      });
  }

  function saveSettings() {
    try {
      const ep = endpointValue.trim();
      const k = keyValue.trim();
      if (ep) window.localStorage.setItem(LS_ENDPOINT, ep);
      else window.localStorage.removeItem(LS_ENDPOINT);
      if (k) window.localStorage.setItem(LS_KEY, k);
      else window.localStorage.removeItem(LS_KEY);
      apiState.tried = false;
      apiState.working = false;
      apiState.warned = false;
      setStatus('saved');
      setTimeout(() => setStatus(''), 2000);
    } catch (e) {
      setStatus('could not save, storage is blocked');
    }
  }

  function clearSettings() {
    try {
      window.localStorage.removeItem(LS_ENDPOINT);
      window.localStorage.removeItem(LS_KEY);
    } catch (e) { /* ignore */ }
    setEndpointValue('');
    setKeyValue('');
    apiState.tried = false;
    apiState.working = false;
    setStatus('cleared');
    setTimeout(() => setStatus(''), 2000);
  }

  return html`
    <${Dialog.Root} open=${open} onOpenChange=${onOpenChange}>
      <${Dialog.Content} className="tutor-panel" aria-describedby=${undefined}>

        <div class="tutor-head">
          <div class="tutor-id">
            <${Mou} mood=${mood} size=${58} bob />
            <div style=${{ minWidth: 0 }}>
              <span class="kicker" style=${{ marginBottom: '4px' }}>your fintech tutor</span>
              <${Dialog.Title} className="display display-s" style=${{ margin: '0 0 10px' }}>
                Mou
              <//>
              <span class="tag-row">
                <${Tag}>
                  ${level ? `level ${String(level.id).padStart(2, '0')}, ${level.codename}` : 'no level open'}
                <//>
              </span>
              <span class="mono-s tutor-mode">${mode}</span>
            </div>
          </div>

          <div class="tutor-tools">
            <button type="button" class="tutor-x" title="connect a model"
              onClick=${() => setShowSettings(!showSettings)}>settings</button>
            <${Dialog.Close}>
              <button type="button" class="tutor-x" title="close">close</button>
            <//>
          </div>
        </div>

        ${showSettings ? html`
          <div class="tutor-settings">
            <p class="mono-s" style=${{ lineHeight: 1.7, marginTop: 0 }}>
              The tutor already answers from the course material with no setup at all.
              Connect a model if you would like a free-form conversation.
            </p>

            <label class="field">
              <span class="field-label">chat endpoint, recommended</span>
              <input class="tutor-input" type="text" placeholder="/api/chat" value=${endpointValue}
                onInput=${(e) => setEndpointValue(e.target.value)} autoComplete="off" />
            </label>
            <p class="mono-s" style=${{ lineHeight: 1.7 }}>
              Deploy this repo with <code>ANTHROPIC_API_KEY</code> set and it works on its own.
            </p>

            <details>
              <summary class="mono-s">advanced: use my own key in this browser</summary>
              <label class="field">
                <span class="field-label">api key</span>
                <input class="tutor-input" type="password" placeholder="sk-ant-..." value=${keyValue}
                  onInput=${(e) => setKeyValue(e.target.value)} autoComplete="off" />
              </label>
              <aside class="note note-warn" style=${{ marginTop: '14px' }}>
                <span class="note-label">careful</span>
                It is stored in this browser only and sent straight to Anthropic. Anyone using this
                device can read it, so never do this on a shared or public computer.
              </aside>
            </details>

            <div class="btn-row" style=${{ marginTop: '18px' }}>
              <${Btn} small onClick=${saveSettings}>save<//>
              <${Btn} small variant="quiet" onClick=${clearSettings}>clear<//>
              ${status ? html`<span class="mono-s" style=${{ color: 'var(--moss)' }}>${status}</span>` : null}
            </div>
          </div>` : null}

        <div class="tutor-log" ref=${logRef}>
          ${messages.map((m, i) => html`<${Bubble} key=${i} ...${m} />`)}
          ${busy ? html`<${Typing} />` : null}
        </div>

        <div class="tutor-foot">
          ${chips.length ? html`
            <div class="chip-row">
              ${chips.slice(0, 3).map((c, i) => html`
                <button type="button" class="chip" key=${i} onClick=${() => ask(c)}>${c}</button>`)}
            </div>` : null}

          <form onSubmit=${(e) => { e.preventDefault(); ask(input); }} class="tutor-form">
            <input class="tutor-input" type="text" value=${input} autoComplete="off"
              placeholder="ask anything, try: explain APR against APY"
              onInput=${(e) => setInput(e.target.value)}
              onKeyDown=${(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(e.target.value); }
              }} />
            <${Btn} small type="submit" variant="accent" arrow disabled=${busy || !input.trim()}>send<//>
          </form>
        </div>

      <//>
    <//>`;
}
