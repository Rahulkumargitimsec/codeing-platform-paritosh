import { useEffect, useMemo, useState } from 'react';
import Editor from '@monaco-editor/react';
import { Lock, Video, Inbox, Copy, Check } from 'lucide-react';
import api, { errorMessage } from '../lib/api';
import { useTheme } from '../lib/theme';
import { editorTheme } from '../lib/monaco';
import { Difficulty, Pill, EmptyState, PageLoader, SolvedMark, Alert } from '../components/ui';
import Modal from '../components/Modal';
import { ProblemText } from './RichText';
import { LANGUAGES, codeFor, formatMemory, formatRuntime, languageLabel, statusOf, tagLabel, timeAgo, formatDate } from '../lib/format';

export function Description({ problem }) {
  return (
    <div className="px-5 py-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <h1 className="text-2xl font-bold">{problem.title}</h1>
        {problem.solved && <span className="mt-1"><SolvedMark solved /></span>}
      </div>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <Difficulty value={problem.difficulty} />
        <span className="chip">{tagLabel(problem.tags)}</span>
      </div>
      <ProblemText text={problem.description} />

      <div className="mt-6 space-y-5">
        {(problem.visibleTestCases || []).map((tc, i) => (
          <div key={i}>
            <h3 className="text-[0.95rem] font-bold mb-2">Example {i + 1}</h3>
            <div className="border-l-2 border-line-strong pl-4 space-y-2 text-sm">
              <div>
                <p className="text-xs font-semibold text-ink-3 mb-1">Input</p>
                <pre className="code-block">{tc.input}</pre>
              </div>
              <div>
                <p className="text-xs font-semibold text-ink-3 mb-1">Output</p>
                <pre className="code-block">{tc.output}</pre>
              </div>
              {tc.explanation && <p className="text-ink-2"><span className="font-semibold text-ink">Explanation: </span>{tc.explanation}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Editorial({ problem }) {
  if (!problem.secureUrl) {
    return (
      <EmptyState icon={Video} title="No video editorial yet">
        When an admin uploads a walkthrough for this problem, it will play here.
      </EmptyState>
    );
  }
  return (
    <div className="p-5">
      <h2 className="text-lg font-bold mb-3">Video walkthrough</h2>
      <video src={problem.secureUrl} poster={problem.thumbnailUrl} controls preload="metadata"
        className="w-full aspect-video rounded-lg bg-black border border-line" />
    </div>
  );
}

export function Solutions({ problem }) {
  const [theme] = useTheme();
  const available = useMemo(() => LANGUAGES.filter((l) => codeFor(problem.referenceSolution, l.id, 'completeCode')), [problem.referenceSolution]);
  const [lang, setLang] = useState(available[0]?.id);
  const [copied, setCopied] = useState(false);

  if (problem.solutionsLocked) {
    return (
      <EmptyState icon={Lock} title="Solve it first">
        Reference solutions unlock once you get an Accepted verdict on this problem. Try the AI tutor if you're stuck.
      </EmptyState>
    );
  }
  if (!available.length) return <EmptyState icon={Inbox} title="No reference solutions" />;

  const code = codeFor(problem.referenceSolution, lang, 'completeCode');
  const copy = async () => {
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-line">
        <div className="segmented" role="group" aria-label="Language">
          {available.map((l) => <button key={l.id} aria-pressed={lang === l.id} onClick={() => setLang(l.id)}>{l.label}</button>)}
        </div>
        <button className="btn btn-ghost btn-sm ml-auto" onClick={copy}>{copied ? <><Check size={15} /> Copied</> : <><Copy size={15} /> Copy</>}</button>
      </div>
      <div className="flex-1 min-h-[24rem]">
        <Editor value={code} language={LANGUAGES.find((l) => l.id === lang)?.monaco} theme={editorTheme(theme)}
          options={{ readOnly: true, minimap: { enabled: false }, fontSize: 13, fontFamily: 'JetBrains Mono Variable, monospace', scrollBeyondLastLine: false, padding: { top: 12 }, domReadOnly: true }} />
      </div>
    </div>
  );
}

export function Submissions({ problemId, refreshKey }) {
  const [list, setList] = useState(null);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(null);

  useEffect(() => {
    let alive = true;
    setError(null);
    api.get(`/problem/submittedProblem/${problemId}`)
      .then((r) => alive && setList(Array.isArray(r.data) ? r.data : []))
      .catch((e) => alive && setError(errorMessage(e)));
    return () => { alive = false; };
  }, [problemId, refreshKey]);

  if (error) return <div className="p-5"><Alert>{error}</Alert></div>;
  if (!list) return <PageLoader label="Loading submissions" />;
  if (!list.length) {
    return <EmptyState icon={Inbox} title="No submissions yet">Your submissions for this problem will be listed here, newest first.</EmptyState>;
  }

  return (
    <div>
      <table className="table text-sm">
        <thead>
          <tr><th>Verdict</th><th>Language</th><th className="hidden sm:table-cell">Runtime</th><th className="hidden sm:table-cell">Tests</th><th>When</th></tr>
        </thead>
        <tbody>
          {list.map((s) => {
            const st = statusOf(s.status);
            return (
              <tr key={s._id} className="row-link" onClick={() => setOpen(s)}>
                <td><Pill tone={st.tone}>{st.label}</Pill></td>
                <td className="text-ink-2">{languageLabel(s.language)}</td>
                <td className="hidden sm:table-cell tabular-nums text-ink-2">{s.status === 'accepted' ? formatRuntime(s.runtime) : '—'}</td>
                <td className="hidden sm:table-cell tabular-nums text-ink-2">{s.testCasesPassed}/{s.testCasesTotal}</td>
                <td className="text-ink-3 whitespace-nowrap" title={formatDate(s.createdAt)}>{timeAgo(s.createdAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Modal open={!!open} onClose={() => setOpen(null)} title="Submission" width="max-w-3xl">
        {open && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 items-center">
              <Pill tone={statusOf(open.status).tone}>{statusOf(open.status).label}</Pill>
              <Pill>{languageLabel(open.language)}</Pill>
              <Pill>{open.testCasesPassed}/{open.testCasesTotal} tests</Pill>
              {open.status === 'accepted' && <Pill>{formatRuntime(open.runtime)}</Pill>}
              {open.status === 'accepted' && formatMemory(open.memory) !== '—' && <Pill>{formatMemory(open.memory)}</Pill>}
              <span className="text-sm text-ink-3 ml-auto">{formatDate(open.createdAt)}</span>
            </div>
            {open.errorMessage && open.status !== 'accepted' && <pre className="code-block text-bad">{open.errorMessage}</pre>}
            <pre className="code-block max-h-[55vh]">{open.code}</pre>
          </div>
        )}
      </Modal>
    </div>
  );
}
