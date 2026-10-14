import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Bot, RotateCcw, KeyRound } from 'lucide-react';
import api, { errorMessage } from '../lib/api';
import { useHealth } from '../lib/health';
import { ChatText } from './RichText';
import { Spinner } from '../components/ui';

const PROVIDERS = [
  { id: 'groq', label: 'Groq (Llama 3.3 70B)' },
  { id: 'gemini', label: 'Gemini 2.5 Flash' },
  { id: 'openrouter', label: 'DeepSeek R1 via OpenRouter' },
];

const STARTERS = [
  'Give me a hint for where to start',
  "What's wrong with my current code?",
  'Which edge cases should I think about?',
];

// One conversation per problem, kept while the tab is open
const memory = new Map();

export default function ChatAi({ problem, code, language }) {
  const health = useHealth();
  const configured = PROVIDERS.filter((p) => health?.ai?.[p.id]);
  const [provider, setProvider] = useState(null);
  const [messages, setMessages] = useState(() => memory.get(problem._id) || []);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const endRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => { memory.set(problem._id, messages); }, [messages, problem._id]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages, busy]);
  useEffect(() => () => clearInterval(timerRef.current), []);
  useEffect(() => { if (!provider && configured.length) setProvider(configured[0].id); }, [configured, provider]);

  const send = async (text, history = messages) => {
    const content = text.trim();
    if (!content || busy) return;
    const next = [...history, { role: 'user', parts: [{ text: content }] }];
    setMessages(next);
    setInput('');
    setBusy(true);
    await ask(next);
  };

  const ask = async (convo) => {
    try {
      const res = await api.post('/ai/chat', {
        messages: convo.filter((m) => !m.error),
        title: problem.title,
        description: problem.description,
        testCases: problem.visibleTestCases,
        startCode: problem.startCode,
        editorCode: code,
        language,
        provider,
      });
      setMessages((m) => [...m, { role: 'model', parts: [{ text: res.data.message }] }]);
      setBusy(false);
    } catch (err) {
      const retry = err.response?.status === 429 && err.response?.data?.retryAfter;
      if (retry) {
        let left = retry;
        setCountdown(left);
        clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
          left -= 1;
          setCountdown(left);
          if (left <= 0) { clearInterval(timerRef.current); ask(convo); }
        }, 1000);
        return;
      }
      setMessages((m) => [...m, { role: 'model', error: true, parts: [{ text: errorMessage(err, 'The tutor did not answer. Try again or pick another model.') }] }]);
      setBusy(false);
    }
  };

  const reset = () => { clearInterval(timerRef.current); setCountdown(0); setBusy(false); setMessages([]); };

  if (health && configured.length === 0) {
    return (
      <div className="p-6 max-w-md">
        <span className="w-11 h-11 rounded-xl bg-surface-2 border border-line flex items-center justify-center text-ink-3 mb-4"><KeyRound size={20} /></span>
        <h3 className="text-lg font-bold mb-2">Add an AI key to use the tutor</h3>
        <p className="text-sm text-ink-2 mb-3">The tutor needs at least one of these in <code className="font-code text-[0.85em] bg-surface-2 px-1 rounded">backend/.env</code>, then a server restart:</p>
        <ul className="text-sm space-y-1.5 font-code">
          <li>GROQ_API_KEY=<span className="text-ink-3">…</span> <span className="font-body text-ink-3">free at console.groq.com</span></li>
          <li>GEMINI_KEY=<span className="text-ink-3">…</span> <span className="font-body text-ink-3">free at aistudio.google.com</span></li>
          <li>OPENROUTER_API_KEY=<span className="text-ink-3">…</span></li>
        </ul>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-[24rem]">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-line">
        <select className="select select-sm w-auto max-w-[60%]" value={provider || ''} onChange={(e) => setProvider(e.target.value)} aria-label="AI model">
          {PROVIDERS.map((p) => (
            <option key={p.id} value={p.id} disabled={!health?.ai?.[p.id]}>
              {p.label}{health && !health.ai?.[p.id] ? ' (no key)' : ''}
            </option>
          ))}
        </select>
        {messages.length > 0 && (
          <button className="btn btn-ghost btn-sm ml-auto" onClick={reset}><RotateCcw size={14} /> New chat</button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="pt-4">
            <div className="flex gap-2.5 mb-5">
              <span className="w-7 h-7 rounded-full bg-surface-2 border border-line flex items-center justify-center shrink-0 text-accent"><Bot size={15} /></span>
              <p className="text-sm bg-surface-2 rounded-xl rounded-tl-sm px-3.5 py-2.5">
                I can see this problem and the code in your editor. I'll help you reason it out with questions and small hints, not full solutions.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 pl-9">
              {STARTERS.map((s) => (
                <button key={s} className="btn btn-outline btn-sm font-medium" onClick={() => send(s)} disabled={!provider}>{s}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => m.role === 'user' ? (
          <div key={i} className="flex justify-end">
            <p className="text-sm bg-accent text-accent-ink rounded-xl rounded-br-sm px-3.5 py-2 max-w-[85%] whitespace-pre-wrap">{m.parts[0].text}</p>
          </div>
        ) : (
          <div key={i} className="flex gap-2.5">
            <span className="w-7 h-7 rounded-full bg-surface-2 border border-line flex items-center justify-center shrink-0 text-accent"><Bot size={15} /></span>
            <div className={`text-sm rounded-xl rounded-tl-sm px-3.5 py-2.5 max-w-[88%] ${m.error ? 'bg-bad-soft text-bad' : 'bg-surface-2'}`}>
              <ChatText text={m.parts[0].text} />
            </div>
          </div>
        ))}

        {busy && (
          <div className="flex gap-2.5 items-center text-sm text-ink-3">
            <span className="w-7 h-7 rounded-full bg-surface-2 border border-line flex items-center justify-center shrink-0 text-accent"><Bot size={15} /></span>
            {countdown > 0 ? `Rate limited. Retrying in ${countdown}s…` : <><Spinner size={14} /> Thinking…</>}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form className="p-3 border-t border-line" onSubmit={(e) => { e.preventDefault(); send(input); }}>
        <div className="flex items-end gap-2 bg-surface border border-line-strong rounded-xl p-1.5 focus-within:border-accent focus-within:ring-3 focus-within:ring-accent-soft">
          <textarea
            rows={1}
            className="flex-1 resize-none bg-transparent border-0 outline-none px-2 py-1.5 text-sm max-h-36"
            placeholder="Ask about this problem"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
            aria-label="Message the tutor"
          />
          <button type="submit" className="btn btn-primary btn-sm btn-icon rounded-lg" disabled={busy || !input.trim() || !provider} aria-label="Send">
            <ArrowUp size={16} />
          </button>
        </div>
        <p className="text-[0.72rem] text-ink-3 mt-1.5 px-1">Enter to send, Shift+Enter for a new line</p>
      </form>
    </div>
  );
}
