/* =========================================================================
   Ada: the tutor panel. A Radix Dialog pinned to the right edge.
   ========================================================================= */
import {
  html, useState, useEffect, useRef, FQ, store, rawHtml, Box, Flex, Text,
  Badge, Button, IconButton, Dialog, TextField, Callout
} from './lib.js';
import {
  offlineAnswer, askModel, chatMarkdown, apiState, endpoint, userKey,
  LS_ENDPOINT, LS_KEY
} from './tutor-engine.js';

function Bubble({ role, html: markup, source }) {
  if (role === 'user') {
    return html`<div className="bubble me"><${Text} size="2">${markup}<//></div>`;
  }
  return html`
    <div className="bubble bot">
      ${rawHtml(markup, { className: 'bubble-body' })}
      ${source ? html`<span className="bubble-source">${source}</span>`: null}
    </div>`;
}

function Typing() {
  return html`<div className="bubble bot"><span className="typing"><i /><i /><i /></span></div>`;
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
  const logRef = useRef(null);
  const historyRef = useRef([]);

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

  useEffect(() => {
    setMode(userKey() ? 'model · your key' : apiState.working ? 'model · course endpoint' : 'course knowledge base');
  }, [open, messages]);

  function push(msg) { setMessages((prev) => prev.concat([msg])); }

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
      setMode(userKey() ? 'model · your key' : apiState.working ? 'model · course endpoint' : 'course knowledge base');
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
          source: 'Claude · ' + (userKey() ? 'your key' : 'course endpoint')
        });
        historyRef.current.push({ role: 'assistant', content: answer });
        setChips(['Give me an example', 'hint', 'Why does that matter?']);
        setBusy(false);
        setMode(userKey() ? 'model · your key' : 'model · course endpoint');
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
      setStatus('could not save. Storage is blocked');
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
        <${Flex} justify="between" align="start" gap="3" mb="2">
          <${Box}>
            <${Dialog.Title} mb="1">
              Ada <${Text} size="2" weight="regular" color="gray">your fintech tutor<//>
            <//>
            <${Flex} gap="2" align="center" wrap="wrap">
              <${Badge} color="blue" variant="soft" radius="full">
                ${level ? `Level ${level.id} · ${level.codename}`: 'no level open'}
              <//>
              <${Text} size="1" color="gray" className="figure">${mode}<//>
            <//>
          <//>
          <${Flex} gap="1">
            <${IconButton} size="1" variant="ghost" color="gray" title="Connect a model"
              onClick=${() => setShowSettings(!showSettings)}>⚙<//>
            <${Dialog.Close}>
              <${IconButton} size="1" variant="ghost" color="gray" title="Close">✕<//>
            <//>
          <//>
        <//>

        ${showSettings ? html`
          <${Box} className="tutor-settings" mb="3">
            <${Text} as="p" size="2" color="gray" mb="3">
              The tutor already answers from the course material, with no setup at all.
              Connect a model if you would like a free-form conversation.
            <//>
            <${Text} as="label" size="1" color="gray">Chat endpoint (recommended)<//>
            <${TextField.Root} mt="1" mb="2" size="2" placeholder="/api/chat"
              value=${endpointValue}
              onChange=${(e) => setEndpointValue(e.target.value)} />
            <${Text} as="p" size="1" color="gray" mb="3">
              Deploy this repo with <code>ANTHROPIC_API_KEY</code> set and it works automatically.
            <//>
            <details>
              <summary><${Text} size="1" color="gray">Advanced: use my own API key in this browser<//></summary>
              <${TextField.Root} mt="2" size="2" type="password" placeholder="sk-ant-..."
                value=${keyValue} onChange=${(e) => setKeyValue(e.target.value)} />
              <${Callout.Root} color="amber" variant="surface" size="1" mt="2">
                <${Callout.Text}>
                  Stored in this browser only and sent straight to Anthropic. Anyone using this device
                  can read it, never do this on a shared or public computer.
                <//>
              <//>
            </details>
            <${Flex} gap="2" mt="3" align="center">
              <${Button} size="1" onClick=${saveSettings}>Save<//>
              <${Button} size="1" variant="soft" color="gray" onClick=${clearSettings}>Clear<//>
              ${status ? html`<${Text} size="1" color="grass">${status}<//>`: null}
            <//>
          <//>`: null}

        <div className="tutor-log" ref=${logRef}>
          ${messages.map((m, i) => html`<${Bubble} key=${i}...${m} />`)}
          ${busy ? html`<${Typing} />`: null}
        </div>

        ${chips.length ? html`
          <${Flex} gap="2" wrap="wrap" mb="2">
            ${chips.slice(0, 3).map((c, i) => html`
              <${Button} key=${i} size="1" variant="surface" color="gray"
                onClick=${() => ask(c)}>${c}<//>`)}
          <//>`: null}

        <form onSubmit=${(e) => { e.preventDefault(); ask(input); }}>
          <${Flex} gap="2">
            <${Box} style=${{ flex: 1 }}>
              <${TextField.Root} size="2" placeholder="Ask anything: e.g. “explain APR vs APY”"
                value=${input} onChange=${(e) => setInput(e.target.value)} autoComplete="off" />
            <//>
            <${Button} type="submit" disabled=${busy || !input.trim()}>Send<//>
          <//>
        </form>
      <//>
    <//>`;
}
