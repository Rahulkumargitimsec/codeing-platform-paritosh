import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Terminal } from 'lucide-react';
import { VerdictCells, Pill, Spinner } from '../components/ui';
import { formatMemory, formatRuntime, toneForStatusId } from '../lib/format';

const VERDICT_WORDS = {
  accepted: 'Accepted',
  'Wrong Answer': 'Wrong answer',
  'Compilation Error': 'Compilation error',
  'Time Limit Exceeded': 'Time limit exceeded',
  'Runtime Error (NZEC)': 'Runtime error',
};
const verdictWord = (s) => VERDICT_WORDS[s] || (s?.startsWith('Runtime Error') ? 'Runtime error' : s) || 'Failed';

function Block({ label, children, tone }) {
  return (
    <div>
      <p className="text-xs font-semibold text-ink-3 mb-1">{label}</p>
      <pre className={`code-block ${tone === 'bad' ? 'text-bad' : ''}`}>{children === '' || children == null ? <span className="text-ink-3 italic">(empty)</span> : children}</pre>
    </div>
  );
}

function RunPanel({ run, running, visibleCases }) {
  const [active, setActive] = useState(0);
  useEffect(() => setActive(0), [run]);

  if (running) {
    return (
      <div className="flex items-center gap-4 p-4">
        <VerdictCells running count={visibleCases.length} size="lg" />
        <span className="text-sm text-ink-2 flex items-center gap-2"><Spinner size={15} /> Running your code on the examples…</span>
      </div>
    );
  }

  // Before running: show the example inputs
  if (!run) {
    return (
      <div className="p-4">
        <CaseTabs count={visibleCases.length} active={active} setActive={setActive} />
        {visibleCases[active] && (
          <div className="space-y-3 mt-3">
            <Block label="Input">{visibleCases[active].input}</Block>
            <Block label="Expected output">{visibleCases[active].output}</Block>
          </div>
        )}
        <p className="text-xs text-ink-3 mt-4">Run sends your code through these examples. Submit checks it against every hidden test case.</p>
      </div>
    );
  }

  if (run.requestError) {
    return <div className="p-4"><Block label="Couldn't run your code" tone="bad">{run.requestError}</Block></div>;
  }

  const compileError = run.testCases?.find((t) => t.status_id === 6)?.compile_output;
  const tc = run.testCases?.[active];
  const passed = run.testCases.filter((t) => t.status_id === 3).length;

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-3">
        <h3 className={`text-xl font-bold ${run.success ? 'text-ok' : 'text-bad'}`}>
          {run.success ? 'All examples passed' : verdictWord(run.statusText)}
        </h3>
        <span className="text-sm text-ink-2">{passed} of {run.testCases.length} passed</span>
        {run.success && <span className="text-sm text-ink-3">Runtime {formatRuntime(run.runtime)}</span>}
      </div>
      {compileError ? (
        <Block label="Compiler output" tone="bad">{compileError}</Block>
      ) : (
        <>
          <CaseTabs count={run.testCases.length} active={active} setActive={setActive} statuses={run.testCases.map((t) => t.status_id)} />
          {tc && (
            <div className="space-y-3 mt-3">
              {tc.status_id !== 3 && <Pill tone={toneForStatusId(tc.status_id)}>{verdictWord(tc.status)}</Pill>}
              <Block label="Input">{tc.stdin}</Block>
              <div className="grid sm:grid-cols-2 gap-3">
                <Block label="Your output" tone={tc.status_id === 4 ? 'bad' : undefined}>{tc.stdout?.replace(/\n$/, '')}</Block>
                <Block label="Expected output">{tc.expected_output}</Block>
              </div>
              {tc.stderr && <Block label="Error output" tone="bad">{tc.stderr}</Block>}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CaseTabs({ count, active, setActive, statuses }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="tablist">
      {Array.from({ length: count }, (_, i) => {
        const tone = statuses ? toneForStatusId(statuses[i]) : null;
        return (
          <button key={i} role="tab" aria-selected={active === i} onClick={() => setActive(i)}
            className={`h-7 px-2.5 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 border ${active === i ? 'bg-surface-2 border-line-strong text-ink' : 'border-transparent text-ink-3 hover:text-ink'}`}>
            {tone && <span className="w-1.5 h-1.5 rounded-full" style={{ background: `var(--${tone === 'run' ? 'accent' : tone})` }} />}
            Case {i + 1}
          </button>
        );
      })}
    </div>
  );
}

function SubmitPanel({ result, submitting, hiddenCount }) {
  if (submitting) {
    return (
      <div className="p-4 space-y-3">
        <VerdictCells running count={hiddenCount} size="lg" />
        <p className="text-sm text-ink-2 flex items-center gap-2"><Spinner size={15} /> Judging against {hiddenCount} hidden test cases…</p>
      </div>
    );
  }
  if (!result) {
    return <div className="p-4 text-sm text-ink-3">Submit your code to see the verdict here.</div>;
  }
  if (result.requestError) {
    return <div className="p-4"><Block label="Couldn't submit" tone="bad">{result.requestError}</Block></div>;
  }

  const isCompile = result.statusText === 'Compilation Error';
  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div>
          <h3 className={`font-display font-bold text-3xl leading-none ${result.accepted ? 'text-ok' : result.status === 'wrong' ? 'text-bad' : 'text-warn'}`}>
            {result.accepted ? 'Accepted' : verdictWord(result.statusText)}
          </h3>
          <p className="text-sm text-ink-2 mt-2">{result.passedTestCases} of {result.totalTestCases} hidden test cases passed</p>
        </div>
        {result.accepted && (
          <dl className="flex gap-6 text-sm">
            <div><dt className="text-ink-3 text-xs">Runtime</dt><dd className="font-semibold tabular-nums">{formatRuntime(result.runtime)}</dd></div>
            <div><dt className="text-ink-3 text-xs">Memory</dt><dd className="font-semibold tabular-nums">{formatMemory(result.memory)}</dd></div>
          </dl>
        )}
      </div>
      <VerdictCells statuses={result.cases || []} size="lg" animate />

      {!result.accepted && (
        isCompile ? (
          <Block label="Compiler output" tone="bad">{result.errorMessage}</Block>
        ) : (
          <>
            {result.failedCase?.input != null ? (
              <div className="space-y-3">
                <p className="text-sm font-semibold">First failing case: test {result.failedCase.number}</p>
                <Block label="Input">{result.failedCase.input}</Block>
                <div className="grid sm:grid-cols-2 gap-3">
                  <Block label="Your output" tone="bad">{result.failedCase.output?.replace(/\n$/, '')}</Block>
                  <Block label="Expected output">{result.failedCase.expected}</Block>
                </div>
              </div>
            ) : result.failedCase ? (
              <p className="text-sm text-ink-2">Test {result.failedCase.number} failed. Its input is too large to show; check edge cases and limits.</p>
            ) : null}
            {result.errorMessage && result.errorMessage !== result.statusText && result.status !== 'wrong' && (
              <Block label="Error output" tone="bad">{result.errorMessage}</Block>
            )}
          </>
        )
      )}
    </div>
  );
}

export default function Console({ tab, setTab, collapsed, setCollapsed, run, running, result, submitting, problem }) {
  return (
    <div className="h-full flex flex-col bg-surface">
      <div className="flex items-center border-b border-line pr-2">
        <div className="tabs border-0 flex-1" role="tablist">
          <button className="tab" role="tab" aria-selected={tab === 'run'} onClick={() => { setTab('run'); setCollapsed(false); }}>
            <Terminal size={15} /> Test cases
          </button>
          <button className="tab" role="tab" aria-selected={tab === 'result'} onClick={() => { setTab('result'); setCollapsed(false); }}>
            Result
            {result && !result.requestError && <span className={`w-1.5 h-1.5 rounded-full ${result.accepted ? 'bg-ok' : 'bg-bad'}`} />}
          </button>
        </div>
        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? 'Expand console' : 'Collapse console'}>
          {collapsed ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
        </button>
      </div>
      {!collapsed && (
        <div className="flex-1 overflow-auto">
          {tab === 'run'
            ? <RunPanel run={run} running={running} visibleCases={problem.visibleTestCases || []} />
            : <SubmitPanel result={result} submitting={submitting} hiddenCount={problem.hiddenTestCount || 1} />}
        </div>
      )}
    </div>
  );
}
