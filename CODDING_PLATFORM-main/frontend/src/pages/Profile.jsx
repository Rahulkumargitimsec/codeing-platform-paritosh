import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useDispatch, useSelector } from 'react-redux';
import { Inbox, Trophy } from 'lucide-react';
import AppShell from '../components/AppShell';
import api, { errorMessage } from '../lib/api';
import { deleteAccount } from '../store/authSlice';
import { DIFFICULTIES, difficultyLabel, languageLabel, statusOf, timeAgo, formatRuntime, formatDate } from '../lib/format';
import { Difficulty, Pill, PageLoader, EmptyState, Alert } from '../components/ui';
import { ConfirmDialog } from '../components/Modal';
import { useToast } from '../components/Toast';

const WEEKS = 26;
const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Submission activity, one square per day, same grid language as the verdict cells
function ActivityGrid({ activity }) {
  const { weeks, months, total, activeDays, streak } = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(start.getDate() - (WEEKS * 7 - 1) - today.getDay()); // align to Sunday
    const weeks = [];
    const months = [];
    let total = 0, activeDays = 0;
    for (let w = 0; w < WEEKS + 1; w++) {
      const col = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(start); date.setDate(start.getDate() + w * 7 + d);
        if (date > today) { col.push(null); continue; }
        const n = activity[dayKey(date)] || 0;
        total += n; if (n) activeDays++;
        col.push({ date, n });
        if (date.getDate() === 1) months.push({ w, label: date.toLocaleString(undefined, { month: 'short' }) });
      }
      weeks.push(col);
    }
    let streak = 0;
    for (const d = new Date(today); activity[dayKey(d)]; d.setDate(d.getDate() - 1)) streak++;
    return { weeks, months, total, activeDays, streak };
  }, [activity]);

  const level = (n) => (n === 0 ? 0 : n < 2 ? 1 : n < 4 ? 2 : n < 7 ? 3 : 4);
  const fill = ['var(--surface-3)', 'color-mix(in srgb, var(--accent) 30%, var(--surface))', 'color-mix(in srgb, var(--accent) 55%, var(--surface))', 'color-mix(in srgb, var(--accent) 80%, var(--surface))', 'var(--accent)'];

  return (
    <div>
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink-2 mb-4">
        <span><strong className="text-ink tabular-nums">{total}</strong> submission{total === 1 ? '' : 's'} in the last 6 months</span>
        <span><strong className="text-ink tabular-nums">{activeDays}</strong> active day{activeDays === 1 ? '' : 's'}</span>
        <span>Current streak <strong className="text-ink tabular-nums">{streak}</strong> day{streak === 1 ? '' : 's'}</span>
      </div>
      <div className="overflow-x-auto pb-1">
        <div className="min-w-[34rem]">
          <div className="relative h-4 text-[0.7rem] text-ink-3 mb-1">
            {months.map((m) => <span key={`${m.w}${m.label}`} className="absolute" style={{ left: `${(m.w / weeks.length) * 100}%` }}>{m.label}</span>)}
          </div>
          <div className="grid grid-flow-col grid-rows-7 gap-[3px]" style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }}>
            {weeks.flatMap((col, w) => col.map((c, d) => (
              <span key={`${w}-${d}`} className="aspect-square rounded-[3px]"
                style={{ background: c ? fill[level(c.n)] : 'transparent' }}
                title={c ? `${c.n} submission${c.n === 1 ? '' : 's'} on ${c.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : undefined} />
            )))}
          </div>
          <div className="flex items-center justify-end gap-1.5 mt-2 text-[0.7rem] text-ink-3">
            Less {fill.map((f, i) => <span key={i} className="w-2.5 h-2.5 rounded-[2px]" style={{ background: f }} />)} More
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Profile() {
  const { user } = useSelector((s) => s.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([api.get('/problem/problemSolvedByUser'), api.get('/problem/getAllProblem'), api.get('/submission/mine')])
      .then(([solved, all, mine]) => alive && setData({ solved: solved.data || [], all: all.data || [], mine: mine.data }))
      .catch((e) => alive && setError(errorMessage(e)));
    return () => { alive = false; };
  }, []);

  const onDelete = async () => {
    setDeleting(true);
    const res = await dispatch(deleteAccount());
    setDeleting(false);
    if (res.error) { toast(res.payload || "Couldn't delete the account", 'bad'); return; }
    setConfirmDelete(false);
    navigate('/');
  };

  const solvedCount = data?.solved.length || 0;
  const totalCount = data?.all.length || 0;
  const acceptance = data?.mine.total ? Math.round((data.mine.accepted / data.mine.total) * 100) : null;

  return (
    <AppShell>
      <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
        <div className="flex flex-wrap items-center gap-5">
          <span className="w-16 h-16 rounded-2xl bg-accent text-accent-ink font-display font-bold text-3xl flex items-center justify-center">
            {user.firstName?.[0]?.toUpperCase()}
          </span>
          <div className="min-w-0">
            <h1 className="text-3xl font-bold truncate">{user.firstName} {user.lastName || ''}</h1>
            <p className="text-ink-2 truncate">{user.emailId}</p>
            {user.createdAt && <p className="text-sm text-ink-3">Joined {formatDate(user.createdAt, { month: 'long', year: 'numeric' })}</p>}
          </div>
          {user.role === 'admin' && <Pill tone="run" className="ml-auto">Admin</Pill>}
        </div>

        {error && <Alert>{error}</Alert>}
        {!data && !error && <PageLoader label="Loading your progress" />}

        {data && (
          <>
            <div className="grid md:grid-cols-[18rem_1fr] gap-6">
              <div className="panel p-5">
                <p className="text-sm font-semibold text-ink-2">Solved</p>
                <p className="font-display font-bold text-5xl tabular-nums mt-1">
                  {solvedCount}<span className="text-ink-3 text-2xl font-semibold">/{totalCount}</span>
                </p>
                <div className="space-y-3 mt-5">
                  {DIFFICULTIES.map((d) => {
                    const total = data.all.filter((p) => p.difficulty === d).length;
                    const done = data.solved.filter((p) => p.difficulty === d).length;
                    const color = { easy: 'var(--ok)', medium: 'var(--warn)', hard: 'var(--bad)' }[d];
                    return (
                      <div key={d}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-semibold" style={{ color }}>{difficultyLabel(d)}</span>
                          <span className="tabular-nums text-ink-2">{done}/{total}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: total ? `${(done / total) * 100}%` : 0, background: color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <dl className="grid grid-cols-2 gap-3 mt-6 pt-5 border-t border-line text-sm">
                  <div><dt className="text-ink-3">Submissions</dt><dd className="font-semibold text-lg tabular-nums">{data.mine.total}</dd></div>
                  <div><dt className="text-ink-3">Acceptance</dt><dd className="font-semibold text-lg tabular-nums">{acceptance == null ? '—' : `${acceptance}%`}</dd></div>
                </dl>
              </div>
              <div className="panel p-5 min-w-0">
                <h2 className="text-lg font-bold mb-3">Activity</h2>
                <ActivityGrid activity={data.mine.activity || {}} />
              </div>
            </div>

            <div className="grid lg:grid-cols-[1fr_22rem] gap-6">
              <div className="panel overflow-hidden min-w-0">
                <h2 className="text-lg font-bold px-5 pt-4 pb-3">Recent submissions</h2>
                {data.mine.recent.length === 0 ? (
                  <EmptyState icon={Inbox} title="Nothing submitted yet" action={<Link to="/problems" className="btn btn-primary btn-sm">Find a problem</Link>}>
                    Your submissions show up here with their verdicts.
                  </EmptyState>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="table text-sm">
                      <thead><tr><th>Problem</th><th>Verdict</th><th className="hidden sm:table-cell">Language</th><th className="hidden md:table-cell">Runtime</th><th>When</th></tr></thead>
                      <tbody>
                        {data.mine.recent.slice(0, 12).map((s) => {
                          const st = statusOf(s.status);
                          return (
                            <tr key={s._id} className="row-link" onClick={() => navigate(`/problem/${s.problemId}`)}>
                              <td className="font-semibold">{s.problem.title}</td>
                              <td><Pill tone={st.tone}>{st.label}</Pill></td>
                              <td className="hidden sm:table-cell text-ink-2">{languageLabel(s.language)}</td>
                              <td className="hidden md:table-cell text-ink-2 tabular-nums">{s.status === 'accepted' ? formatRuntime(s.runtime) : '—'}</td>
                              <td className="text-ink-3 whitespace-nowrap">{timeAgo(s.createdAt)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="panel overflow-hidden">
                <h2 className="text-lg font-bold px-5 pt-4 pb-3">Solved problems</h2>
                {data.solved.length === 0 ? (
                  <EmptyState icon={Trophy} title="No problems solved yet">Get an Accepted verdict and it will be listed here.</EmptyState>
                ) : (
                  <ul className="border-t border-line">
                    {data.solved.map((p) => (
                      <li key={p._id} className="border-b border-line last:border-0">
                        <Link to={`/problem/${p._id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-surface-2">
                          <span className="font-semibold truncate">{p.title}</span>
                          <Difficulty value={p.difficulty} showLabel={false} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="panel p-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-bold">Delete account</h2>
                <p className="text-sm text-ink-2">Removes your account and every submission. This can't be undone.</p>
              </div>
              <button className="btn btn-danger-ghost border-bad/40" onClick={() => setConfirmDelete(true)}>Delete account</button>
            </div>
          </>
        )}
      </div>
      <ConfirmDialog open={confirmDelete} busy={deleting} title="Delete your account?" confirmLabel="Delete account"
        message="Your account, progress and all submissions will be removed permanently."
        onConfirm={onDelete} onCancel={() => setConfirmDelete(false)} />
    </AppShell>
  );
}
