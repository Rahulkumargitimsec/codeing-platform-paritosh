import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Bot, Code2, Gauge } from 'lucide-react';
import AppShell from '../components/AppShell';

const TOTAL = 12;

// The one animated moment: a submission being judged, test case by test case
function JudgeDemo() {
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const [done, setDone] = useState(reduce ? TOTAL : 0);

  useEffect(() => {
    if (reduce) return;
    let i = 0;
    const start = setTimeout(() => {
      const t = setInterval(() => {
        i += 1;
        setDone(i);
        if (i >= TOTAL) clearInterval(t);
      }, 140);
    }, 700);
    return () => clearTimeout(start);
  }, [reduce]);

  const finished = done >= TOTAL;

  return (
    <div className="panel panel-raised overflow-hidden w-full max-w-[34rem]">
      <div className="flex items-center gap-2 px-4 h-10 border-b border-line bg-surface-2">
        <span className="text-xs font-semibold text-ink-2">Two Sum</span>
        <span className="text-xs text-ink-3">C++</span>
      </div>
      <pre className="font-code text-[0.8rem] leading-[1.7] px-4 py-4 overflow-x-auto text-ink m-0">
        <code>
          <span className="text-ink-3">{'// one pass, remember what we have seen\n'}</span>
          <span className="text-accent font-bold">vector</span>{'<'}<span className="text-accent font-bold">int</span>{'> twoSum(vector<int>& nums, '}<span className="text-accent font-bold">int</span>{' target) {\n'}
          {'    unordered_map<'}<span className="text-accent font-bold">int</span>{', '}<span className="text-accent font-bold">int</span>{'> seen;\n'}
          {'    '}<span className="text-accent font-bold">for</span>{' ('}<span className="text-accent font-bold">int</span>{' i = '}<span className="text-warn">0</span>{'; i < nums.size(); i++) {\n'}
          {'        '}<span className="text-accent font-bold">int</span>{' need = target - nums[i];\n'}
          {'        '}<span className="text-accent font-bold">if</span>{' (seen.count(need)) '}<span className="text-accent font-bold">return</span>{' {seen[need], i};\n'}
          {'        seen[nums[i]] = i;\n'}
          {'    }\n'}
          {'    '}<span className="text-accent font-bold">return</span>{' {};\n}'}
        </code>
      </pre>
      <div className="border-t border-line px-4 py-4 flex items-center gap-5">
        <div className="cells cells-lg" aria-hidden="true">
          {Array.from({ length: TOTAL }, (_, i) => (
            <span key={i} className="cell" data-s={i < done ? 'ok' : i === done ? 'run' : undefined} />
          ))}
        </div>
        <div className="ml-auto text-right min-w-[8.5rem]" aria-live="polite">
          <p className={`font-display font-bold text-2xl leading-none ${finished ? 'text-ok' : 'text-ink-3'}`}>
            {finished ? 'Accepted' : 'Judging…'}
          </p>
          <p className="text-xs text-ink-3 mt-1.5">{done} of {TOTAL} hidden tests</p>
        </div>
      </div>
    </div>
  );
}

const STEPS = [
  { icon: Code2, title: 'Pick a problem and write', body: 'Twelve classic interview problems are ready on first run. Write in C++, Java or JavaScript with starter code that already handles the input.' },
  { icon: Gauge, title: 'Run it on the examples', body: 'See your output next to the expected output for every visible case, with compiler errors shown exactly as the compiler printed them.' },
  { icon: VerdictIcon, title: 'Submit for a verdict', body: 'Your code runs against hidden test cases. Each square is one case. Solve it to unlock the reference solutions.' },
];

function VerdictIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      {[0, 1, 2].map((r) => [0, 1, 2].map((c) => (
        <rect key={`${r}${c}`} x={1 + c * 6.5} y={1 + r * 6.5} width="5" height="5" rx="1.2"
          fill={r === 2 && c === 2 ? 'var(--bad)' : 'var(--ok)'} />
      )))}
    </svg>
  );
}

export default function Landing() {
  return (
    <AppShell>
      <section className="max-w-6xl w-full mx-auto px-4 sm:px-6 pt-14 sm:pt-20 pb-16 grid lg:grid-cols-[1fr_auto] gap-12 lg:gap-16 items-center">
        <div className="max-w-xl">
          <h1 className="font-display font-bold text-[2.6rem] sm:text-[3.6rem] leading-[1.02] tracking-[-0.035em] text-ink">
            Practice DSA against a real judge.
          </h1>
          <p className="mt-6 text-lg text-ink-2 leading-relaxed max-w-[34rem]">
            Write code in the browser, run it against hidden test cases, and get a verdict in seconds.
            When you're stuck, an AI tutor asks the next good question instead of handing you the answer.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/signup" className="btn btn-primary btn-lg">Create a free account</Link>
            <Link to="/login" className="btn btn-outline btn-lg">Log in</Link>
          </div>
        </div>
        <div className="flex justify-center lg:justify-end">
          <JudgeDemo />
        </div>
      </section>

      <section className="border-t border-line bg-surface/70">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
          <h2 className="text-2xl font-bold mb-8">How a problem goes</h2>
          <ol className="grid md:grid-cols-3 gap-x-10 gap-y-8">
            {STEPS.map(({ icon: Icon, title, body }, i) => (
              <li key={title} className="relative pl-12">
                <span className="absolute left-0 top-0 w-9 h-9 rounded-lg border border-line bg-surface flex items-center justify-center text-accent">
                  <Icon size={20} />
                </span>
                <p className="text-xs font-semibold text-ink-3 mb-1">Step {i + 1}</p>
                <h3 className="text-lg font-bold mb-1.5">{title}</h3>
                <p className="text-ink-2 text-[0.94rem]">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-16 grid md:grid-cols-2 gap-10 items-center">
        <div>
          <h2 className="text-2xl font-bold mb-3">A tutor that won't spoil it</h2>
          <p className="text-ink-2 max-w-md">
            The AI tutor sees the problem and your current code. It points at the gap in your reasoning
            with a question, and keeps hints small. Pick Groq, Gemini or DeepSeek, whichever key you have.
          </p>
        </div>
        <div className="panel p-4 space-y-3 text-sm">
          <div className="flex justify-end"><p className="bg-accent text-accent-ink rounded-xl rounded-br-sm px-3.5 py-2 max-w-[80%]">My two-loop solution times out. What should I change?</p></div>
          <div className="flex gap-2.5">
            <span className="w-7 h-7 rounded-full bg-surface-2 border border-line flex items-center justify-center shrink-0 text-accent"><Bot size={15} /></span>
            <p className="bg-surface-2 rounded-xl rounded-tl-sm px-3.5 py-2 max-w-[85%]">
              Your inner loop searches for <code className="font-code text-[0.85em]">target - nums[i]</code> every time. What structure would let you check whether you've already seen a value in constant time?
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 text-sm text-ink-3 flex flex-wrap gap-x-6 gap-y-2 justify-between">
          <span>CodeJudge</span>
          <span>C++, Java and JavaScript</span>
        </div>
      </footer>
    </AppShell>
  );
}
