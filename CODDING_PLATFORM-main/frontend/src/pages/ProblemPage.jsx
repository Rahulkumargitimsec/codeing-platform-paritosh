import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import Editor from '@monaco-editor/react';
import { ArrowLeft, Play, Send, RotateCcw, FileText, Video, BookLock, BookOpen, History, Bot, AlertTriangle } from 'lucide-react';
import '../lib/monaco';
import { editorTheme } from '../lib/monaco';
import api, { errorMessage } from '../lib/api';
import { useTheme } from '../lib/theme';
import { useHealth } from '../lib/health';
import { LANGUAGES, codeFor } from '../lib/format';
import { ThemeToggle, UserMenu } from '../components/AppShell';
import { Logo, PageLoader, EmptyState, Spinner } from '../components/ui';
import { ConfirmDialog } from '../components/Modal';
import { useToast } from '../components/Toast';
import { useSplit, useMediaQuery } from '../workspace/useSplit';
import Console from '../workspace/Console';
import ChatAi from '../workspace/ChatAi';
import { Description, Editorial, Solutions, Submissions } from '../workspace/LeftTabs';

const draftKey = (pid, lang) => `cj:draft:${pid}:${lang}`;
const readDraft = (pid, lang) => { try { return localStorage.getItem(draftKey(pid, lang)); } catch { return null; } };
const writeDraft = (pid, lang, code) => { try { localStorage.setItem(draftKey(pid, lang), code); } catch { /* ignore */ } };
const clearDraft = (pid, lang) => { try { localStorage.removeItem(draftKey(pid, lang)); } catch { /* ignore */ } };
const readLang = () => { try { return localStorage.getItem('cj:lang') || 'cpp'; } catch { return 'cpp'; } };

export default function ProblemPage() {
  const { problemId } = useParams();
  const toast = useToast();
  const health = useHealth();
  const [theme] = useTheme();
  const isWide = useMediaQuery('(min-width: 1024px)');

  const [problem, setProblem] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [language, setLanguage] = useState(readLang);
  const [code, setCode] = useState('');
  const [leftTab, setLeftTab] = useState('description');
  const [consoleTab, setConsoleTab] = useState('run');
  const [consoleCollapsed, setConsoleCollapsed] = useState(false);
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [runResult, setRunResult] = useState(null);
  const [submitResult, setSubmitResult] = useState(null);
  const [submissionsKey, setSubmissionsKey] = useState(0);
  const [confirmReset, setConfirmReset] = useState(false);

  const mainRef = useRef(null);
  const rightRef = useRef(null);
  const codeRef = useRef(code);
  codeRef.current = code;

  const horizontal = useSplit({ key: 'cj:split-x', initial: 44, min: 25, max: 70, axis: 'x', containerRef: mainRef });
  const vertical = useSplit({ key: 'cj:split-y', initial: 280, min: 120, max: 640, axis: 'y', containerRef: rightRef, invert: true });

  const loadProblem = useCallback(async () => {
    try {
      const { data } = await api.get(`/problem/problemById/${problemId}`);
      setProblem(data);
      return data;
    } catch (err) {
      setLoadError(err.response?.status === 404 ? 'not-found' : errorMessage(err));
      return null;
    }
  }, [problemId]);

  useEffect(() => {
    setProblem(null); setLoadError(null); setRunResult(null); setSubmitResult(null); setLeftTab('description');
    loadProblem();
  }, [loadProblem]);

  // Load the saved draft or the starter code whenever the problem or language changes
  useEffect(() => {
    if (!problem) return;
    setCode(readDraft(problem._id, language) ?? codeFor(problem.startCode, language));
  }, [problem?._id, language]); // eslint-disable-line react-hooks/exhaustive-deps

  const onCodeChange = (value) => {
    setCode(value ?? '');
    if (problem) writeDraft(problem._id, language, value ?? '');
  };

  const changeLanguage = (lang) => {
    setLanguage(lang);
    try { localStorage.setItem('cj:lang', lang); } catch { /* ignore */ }
  };

  const resetCode = () => {
    clearDraft(problem._id, language);
    setCode(codeFor(problem.startCode, language));
    setConfirmReset(false);
  };

  const langAvailable = !health || health.languages?.[language] !== false;

  const handleRun = useCallback(async () => {
    if (running || submitting || !problem) return;
    setRunning(true); setRunResult(null); setConsoleTab('run'); setConsoleCollapsed(false);
    try {
      const { data } = await api.post(`/submission/run/${problem._id}`, { code: codeRef.current, language });
      setRunResult(data);
    } catch (err) {
      setRunResult({ requestError: errorMessage(err) });
    } finally {
      setRunning(false);
    }
  }, [running, submitting, problem, language]);

  const handleSubmit = useCallback(async () => {
    if (running || submitting || !problem) return;
    setSubmitting(true); setSubmitResult(null); setConsoleTab('result'); setConsoleCollapsed(false);
    try {
      const { data } = await api.post(`/submission/submit/${problem._id}`, { code: codeRef.current, language });
      setSubmitResult(data);
      if (data.accepted) {
        const wasSolved = problem.solved;
        const fresh = await loadProblem(); // unlocks reference solutions
        if (!wasSolved && fresh?.solved) toast('Solved. Reference solutions are now unlocked.', 'ok');
      }
    } catch (err) {
      setSubmitResult({ requestError: errorMessage(err) });
    } finally {
      setSubmitting(false);
      setSubmissionsKey((k) => k + 1);
    }
  }, [running, submitting, problem, language, loadProblem, toast]);

  // Ctrl/Cmd + Enter runs, Ctrl/Cmd + Shift + Enter submits
  const shortcuts = useRef({});
  shortcuts.current = { handleRun, handleSubmit };
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) shortcuts.current.handleSubmit(); else shortcuts.current.handleRun();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  const header = (
    <header className="h-12 shrink-0 flex items-center gap-2 px-2 sm:px-3 bg-surface border-b border-line">
      <Link to="/problems" className="btn btn-ghost btn-sm" aria-label="Back to problems">
        <ArrowLeft size={16} /> <span className="hidden md:inline">Problems</span>
      </Link>
      <Link to="/problems" className="hidden lg:block mr-1" aria-label="CodeJudge"><Logo size={24} withWord={false} /></Link>
      <span className="font-display font-bold truncate min-w-0 hidden sm:block">{problem?.title}</span>
      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <button className="btn btn-outline btn-sm" onClick={handleRun} disabled={!problem || running || submitting || !langAvailable} title="Run on the examples (Ctrl+Enter)">
          {running ? <Spinner size={15} /> : <Play size={15} />} Run
        </button>
        <button className="btn btn-ok btn-sm" onClick={handleSubmit} disabled={!problem || running || submitting || !langAvailable} title="Submit for a verdict (Ctrl+Shift+Enter)">
          {submitting ? <Spinner size={15} /> : <Send size={15} />} Submit
        </button>
        <span className="w-px h-6 bg-line mx-1 hidden sm:block" />
        <ThemeToggle className="hidden sm:inline-flex" />
        <UserMenu />
      </div>
    </header>
  );

  if (loadError) {
    return (
      <div className="h-full flex flex-col bg-bg">
        {header}
        <div className="flex-1 flex items-center justify-center">
          <EmptyState icon={AlertTriangle} title={loadError === 'not-found' ? "This problem doesn't exist" : "Couldn't load the problem"}
            action={<Link to="/problems" className="btn btn-primary">Back to problems</Link>}>
            {loadError === 'not-found' ? 'It may have been deleted.' : loadError}
          </EmptyState>
        </div>
      </div>
    );
  }

  if (!problem) {
    return <div className="h-full flex flex-col bg-bg">{header}<PageLoader label="Opening problem" /></div>;
  }

  const LEFT_TABS = [
    { id: 'description', label: 'Description', icon: FileText },
    { id: 'editorial', label: 'Editorial', icon: Video },
    { id: 'solutions', label: 'Solutions', icon: problem.solutionsLocked ? BookLock : BookOpen },
    { id: 'submissions', label: 'Submissions', icon: History },
    { id: 'ai', label: 'AI tutor', icon: Bot },
  ];

  const left = (
    <section className="flex flex-col min-h-0 h-full bg-surface lg:rounded-lg lg:border lg:border-line overflow-hidden">
      <div className="tabs" role="tablist">
        {LEFT_TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} className="tab" role="tab" aria-selected={leftTab === id} onClick={() => setLeftTab(id)}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {leftTab === 'description' && <Description problem={problem} />}
        {leftTab === 'editorial' && <Editorial problem={problem} />}
        {leftTab === 'solutions' && <Solutions key={String(problem.solutionsLocked)} problem={problem} />}
        {leftTab === 'submissions' && <Submissions problemId={problem._id} refreshKey={submissionsKey} />}
        {leftTab === 'ai' && <ChatAi problem={problem} code={code} language={language} />}
      </div>
    </section>
  );

  const editor = (
    <section className="flex flex-col min-h-0 h-full bg-surface lg:rounded-lg lg:border lg:border-line overflow-hidden">
      <div className="flex items-center gap-2 px-2 h-10 border-b border-line shrink-0">
        <select className="select select-sm w-auto border-transparent bg-transparent font-semibold hover:bg-surface-2" value={language}
          onChange={(e) => changeLanguage(e.target.value)} aria-label="Language">
          {LANGUAGES.map((l) => (
            <option key={l.id} value={l.id} disabled={health?.languages?.[l.id] === false}>
              {l.label}{health?.languages?.[l.id] === false ? ' (not installed)' : ''}
            </option>
          ))}
        </select>
        <button className="btn btn-ghost btn-sm ml-auto" onClick={() => setConfirmReset(true)} title="Reset to starter code">
          <RotateCcw size={14} /> <span className="hidden sm:inline">Reset</span>
        </button>
      </div>
      {!langAvailable && (
        <div className="px-3 py-2 text-xs bg-warn-soft text-warn border-b border-line">
          {language === 'cpp' ? 'g++ is' : 'A Java JDK is'} not installed on the machine running the backend, so this language can't run. Install it or pick another language.
        </div>
      )}
      <div className="flex-1 min-h-[18rem]">
        <Editor
          language={LANGUAGES.find((l) => l.id === language)?.monaco}
          value={code}
          onChange={onCodeChange}
          theme={editorTheme(theme)}
          loading={<Spinner />}
          options={{
            fontSize: 14,
            fontFamily: 'JetBrains Mono Variable, JetBrains Mono, monospace',
            fontLigatures: false,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 4,
            padding: { top: 12, bottom: 12 },
            smoothScrolling: true,
            renderLineHighlight: 'line',
            stickyScroll: { enabled: false },
          }}
        />
      </div>
    </section>
  );

  const consolePanel = (
    <section className="min-h-0 h-full bg-surface lg:rounded-lg lg:border lg:border-line overflow-hidden">
      <Console tab={consoleTab} setTab={setConsoleTab} collapsed={consoleCollapsed} setCollapsed={setConsoleCollapsed}
        run={runResult} running={running} result={submitResult} submitting={submitting} problem={problem} />
    </section>
  );

  return (
    <div className="h-full flex flex-col bg-bg">
      {header}
      {isWide ? (
        <main ref={mainRef} className="flex-1 min-h-0 flex p-2">
          <div style={{ width: `${horizontal.size}%` }} className="min-w-0">{left}</div>
          <div {...horizontal.handleProps} aria-label="Resize panels" />
          <div ref={rightRef} className="flex-1 min-w-0 flex flex-col">
            <div className="flex-1 min-h-0">{editor}</div>
            {!consoleCollapsed && <div {...vertical.handleProps} aria-label="Resize console" />}
            <div style={{ height: consoleCollapsed ? 42 : vertical.size }} className={`shrink-0 ${consoleCollapsed ? 'mt-2' : ''}`}>{consolePanel}</div>
          </div>
        </main>
      ) : (
        <main className="flex-1 overflow-y-auto">
          <div className="max-h-[70vh] flex flex-col border-b border-line">{left}</div>
          <div className="h-[60vh] border-b border-line">{editor}</div>
          <div className={consoleCollapsed ? '' : 'min-h-[18rem]'}>{consolePanel}</div>
        </main>
      )}

      <ConfirmDialog open={confirmReset} title="Reset your code?" tone="danger" confirmLabel="Reset code"
        message="This replaces what's in the editor with the starter code. Your past submissions are kept."
        onConfirm={resetCode} onCancel={() => setConfirmReset(false)} />
    </div>
  );
}
