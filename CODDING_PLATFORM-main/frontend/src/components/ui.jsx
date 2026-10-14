import { Check, Loader2 } from 'lucide-react';
import { difficultyLabel, toneForStatusId } from '../lib/format';

export function Logo({ size = 28, withWord = true, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="7" fill="var(--accent)" />
        <path d="M11 9 6 16l5 7" fill="none" stroke="var(--accent-ink)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m14 16.5 3 3 7-8" fill="none" stroke="var(--accent-ink)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {withWord && <span className="font-display font-bold text-[1.15rem] tracking-tight text-ink">CodeJudge</span>}
    </span>
  );
}

export function Spinner({ size = 18, className = '' }) {
  return <Loader2 size={size} className={`spin ${className}`} aria-label="Loading" />;
}

export function PageLoader({ label = 'Loading' }) {
  return (
    <div className="flex-1 flex items-center justify-center gap-3 text-ink-3 py-24">
      <Spinner /> <span className="text-sm">{label}…</span>
    </div>
  );
}

// Three ticks, filled up to the difficulty — readable without colour alone
const DIFF_LEVEL = { easy: 1, medium: 2, hard: 3 };
const DIFF_TONE = { easy: 'var(--ok)', medium: 'var(--warn)', hard: 'var(--bad)' };
export function Difficulty({ value, showLabel = true }) {
  const level = DIFF_LEVEL[value] || 0;
  const color = DIFF_TONE[value] || 'var(--ink-3)';
  return (
    <span className="inline-flex items-center gap-2" title={difficultyLabel(value)}>
      <span className="inline-flex gap-[3px] items-end" aria-hidden="true">
        {[1, 2, 3].map((i) => (
          <span key={i} className="w-[5px] rounded-[1.5px]" style={{ height: 6 + i * 3, background: i <= level ? color : 'var(--surface-3)' }} />
        ))}
      </span>
      {showLabel && <span className="text-sm font-semibold" style={{ color }}>{difficultyLabel(value)}</span>}
    </span>
  );
}

export function SolvedMark({ solved }) {
  return solved ? (
    <span className="inline-flex w-5 h-5 rounded-full bg-ok text-white items-center justify-center" title="Solved" aria-label="Solved">
      <Check size={13} strokeWidth={3} />
    </span>
  ) : (
    <span className="inline-block w-5 h-5 rounded-full border-[1.5px] border-dashed border-line-strong" title="Not solved yet" aria-label="Not solved" />
  );
}

const TONE_CLASS = {
  ok: 'bg-ok-soft text-ok',
  bad: 'bg-bad-soft text-bad',
  warn: 'bg-warn-soft text-warn',
  run: 'bg-accent-soft text-accent',
  muted: 'bg-surface-2 text-ink-2',
};
export function Pill({ tone = 'muted', children, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1.5 h-6 px-2 rounded-[5px] text-xs font-semibold whitespace-nowrap ${TONE_CLASS[tone]} ${className}`}>
      {children}
    </span>
  );
}

// One square per test case, coloured by its verdict
export function VerdictCells({ statuses = [], count, running = false, size = 'md', animate = false }) {
  const n = running ? count || 0 : statuses.length;
  return (
    <div className={`cells ${size === 'lg' ? 'cells-lg' : ''} ${animate ? 'animate' : ''}`} role="img"
      aria-label={running ? `Judging ${n} test cases` : `${statuses.filter((s) => s === 3).length} of ${n} test cases passed`}>
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className="cell" style={{ '--i': i }} data-s={running ? 'run' : toneForStatusId(statuses[i])} />
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="flex flex-col items-center text-center py-14 px-6">
      {Icon && (
        <span className="w-12 h-12 rounded-xl bg-surface-2 border border-line flex items-center justify-center text-ink-3 mb-4">
          <Icon size={22} />
        </span>
      )}
      <h3 className="text-lg font-bold mb-1">{title}</h3>
      {children && <div className="text-ink-2 text-sm max-w-sm">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Alert({ tone = 'bad', children, className = '' }) {
  const cls = { bad: 'bg-bad-soft text-bad border-bad/30', warn: 'bg-warn-soft text-warn border-warn/30', info: 'bg-accent-soft text-accent border-accent/30', ok: 'bg-ok-soft text-ok border-ok/30' }[tone];
  return <div role="alert" className={`border rounded-lg px-3.5 py-2.5 text-sm whitespace-pre-line ${cls} ${className}`}>{children}</div>;
}
