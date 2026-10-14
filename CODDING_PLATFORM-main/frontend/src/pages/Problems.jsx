import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Search, Video, SearchX, ServerCrash } from 'lucide-react';
import AppShell from '../components/AppShell';
import api, { errorMessage } from '../lib/api';
import { tagLabel, DIFFICULTIES, difficultyLabel } from '../lib/format';
import { Difficulty, SolvedMark, PageLoader, EmptyState } from '../components/ui';

function ProgressByDifficulty({ problems, solvedIds }) {
  return (
    <div className="grid grid-cols-3 gap-3 sm:gap-6 max-w-xl">
      {DIFFICULTIES.map((d) => {
        const all = problems.filter((p) => p.difficulty === d);
        const done = all.filter((p) => solvedIds.has(p._id)).length;
        const pct = all.length ? (done / all.length) * 100 : 0;
        const color = { easy: 'var(--ok)', medium: 'var(--warn)', hard: 'var(--bad)' }[d];
        return (
          <div key={d}>
            <div className="flex items-baseline justify-between gap-2 mb-1.5">
              <span className="text-sm font-semibold" style={{ color }}>{difficultyLabel(d)}</span>
              <span className="text-sm text-ink-2 tabular-nums">{done}<span className="text-ink-3">/{all.length}</span></span>
            </div>
            <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
              <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Problems() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [problems, setProblems] = useState(null);
  const [solvedIds, setSolvedIds] = useState(new Set());
  const [error, setError] = useState(null);

  const q = params.get('q') || '';
  const difficulty = params.get('difficulty') || 'all';
  const status = params.get('status') || 'all';
  const tag = params.get('tag') || 'all';

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (!value || value === 'all') next.delete(key); else next.set(key, value);
    setParams(next, { replace: true });
  };

  useEffect(() => {
    let alive = true;
    Promise.all([api.get('/problem/getAllProblem'), api.get('/problem/problemSolvedByUser')])
      .then(([all, solved]) => {
        if (!alive) return;
        setProblems(Array.isArray(all.data) ? all.data : []);
        setSolvedIds(new Set((solved.data || []).map((p) => p._id)));
      })
      .catch((err) => alive && setError(errorMessage(err)));
    return () => { alive = false; };
  }, []);

  const tags = useMemo(() => [...new Set((problems || []).map((p) => p.tags))].sort(), [problems]);

  const filtered = useMemo(() => (problems || []).filter((p) => {
    if (difficulty !== 'all' && p.difficulty !== difficulty) return false;
    if (tag !== 'all' && p.tags !== tag) return false;
    if (status === 'solved' && !solvedIds.has(p._id)) return false;
    if (status === 'unsolved' && solvedIds.has(p._id)) return false;
    if (q && !p.title.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [problems, difficulty, tag, status, q, solvedIds]);

  const nextUnsolved = (problems || []).find((p) => !solvedIds.has(p._id));
  const numberOf = useMemo(() => new Map((problems || []).map((p, i) => [p._id, i + 1])), [problems]);
  const filtersOn = q || difficulty !== 'all' || status !== 'all' || tag !== 'all';

  return (
    <AppShell>
      <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="flex flex-wrap items-end justify-between gap-6 mb-8">
          <div className="flex-1 min-w-[16rem]">
            <h1 className="text-3xl sm:text-4xl font-bold">Problems</h1>
            {problems && (
              <p className="text-ink-2 mt-1.5 mb-5">
                {solvedIds.size === 0 ? `${problems.length} problems to solve.` : `You've solved ${solvedIds.size} of ${problems.length}.`}
              </p>
            )}
            {problems && problems.length > 0 && <ProgressByDifficulty problems={problems} solvedIds={solvedIds} />}
          </div>
          {nextUnsolved && (
            <Link to={`/problem/${nextUnsolved._id}`} className="btn btn-primary">
              {solvedIds.size ? 'Next unsolved problem' : 'Start with the first problem'}
            </Link>
          )}
        </div>

        {error ? (
          <div className="panel"><EmptyState icon={ServerCrash} title="Couldn't load problems">{error}</EmptyState></div>
        ) : !problems ? (
          <PageLoader label="Loading problems" />
        ) : (
          <div className="panel overflow-hidden">
            <div className="flex flex-wrap items-center gap-3 p-3 border-b border-line">
              <div className="relative flex-1 min-w-[12rem]">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none" />
                <input className="input pl-9 h-9" placeholder="Search by title" value={q}
                  onChange={(e) => setParam('q', e.target.value)} aria-label="Search problems" />
              </div>
              <div className="segmented" role="group" aria-label="Difficulty">
                {['all', ...DIFFICULTIES].map((d) => (
                  <button key={d} aria-pressed={difficulty === d} onClick={() => setParam('difficulty', d)}>
                    {d === 'all' ? 'All' : difficultyLabel(d)}
                  </button>
                ))}
              </div>
              <select className="select select-sm w-auto" value={tag} onChange={(e) => setParam('tag', e.target.value)} aria-label="Topic">
                <option value="all">All topics</option>
                {tags.map((t) => <option key={t} value={t}>{tagLabel(t)}</option>)}
              </select>
              <select className="select select-sm w-auto" value={status} onChange={(e) => setParam('status', e.target.value)} aria-label="Status">
                <option value="all">Any status</option>
                <option value="solved">Solved</option>
                <option value="unsolved">Not solved</option>
              </select>
            </div>

            {filtered.length === 0 ? (
              problems.length === 0 ? (
                <EmptyState icon={SearchX} title="No problems yet">An admin can add problems from the Admin page.</EmptyState>
              ) : (
                <EmptyState icon={SearchX} title="Nothing matches these filters"
                  action={filtersOn && <button className="btn btn-outline btn-sm" onClick={() => setParams({}, { replace: true })}>Clear filters</button>} />
              )
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th className="w-14"><span className="sr-only">Status</span></th>
                      <th>Title</th>
                      <th className="hidden md:table-cell">Topic</th>
                      <th>Difficulty</th>
                      <th className="hidden sm:table-cell text-right">Acceptance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p) => (
                      <tr key={p._id} className="row-link" onClick={() => navigate(`/problem/${p._id}`)}>
                        <td><SolvedMark solved={solvedIds.has(p._id)} /></td>
                        <td>
                          <Link to={`/problem/${p._id}`} onClick={(e) => e.stopPropagation()} className="font-semibold text-ink hover:text-accent">
                            <span className="text-ink-3 tabular-nums font-normal mr-2">{numberOf.get(p._id)}.</span>{p.title}
                          </Link>
                          {p.hasVideo && <Video size={14} className="inline ml-2 text-ink-3" aria-label="Has a video editorial" />}
                        </td>
                        <td className="hidden md:table-cell"><span className="chip">{tagLabel(p.tags)}</span></td>
                        <td><Difficulty value={p.difficulty} /></td>
                        <td className="hidden sm:table-cell text-right tabular-nums text-ink-2 text-sm">
                          {p.acceptance == null ? <span className="text-ink-3">—</span> : `${p.acceptance}%`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
