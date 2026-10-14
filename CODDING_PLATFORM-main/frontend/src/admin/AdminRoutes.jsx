import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, NavLink, Link, useNavigate, useParams } from 'react-router';
import axios from 'axios';
import { LayoutGrid, ListChecks, PlusSquare, Video, Pencil, Trash2, Upload, FileVideo, CheckCircle2, XCircle, Inbox, ExternalLink } from 'lucide-react';
import AppShell from '../components/AppShell';
import api, { errorMessage } from '../lib/api';
import { useHealth } from '../lib/health';
import { tagLabel } from '../lib/format';
import { Difficulty, PageLoader, EmptyState, Alert, Pill, Spinner } from '../components/ui';
import { ConfirmDialog } from '../components/Modal';
import { useToast } from '../components/Toast';
import ProblemForm, { toFormValues } from './ProblemForm';

const NAV = [
  { to: '/admin', end: true, label: 'Overview', icon: LayoutGrid },
  { to: '/admin/problems', label: 'Problems', icon: ListChecks },
  { to: '/admin/create', label: 'Add a problem', icon: PlusSquare },
  { to: '/admin/videos', label: 'Video editorials', icon: Video },
];

function AdminLayout({ title, description, actions, children }) {
  return (
    <AppShell>
      <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 grid lg:grid-cols-[13rem_1fr] gap-8">
        <aside>
          <p className="text-sm font-semibold text-ink-3 mb-2 px-3">Admin</p>
          <nav className="flex lg:flex-col gap-1 overflow-x-auto">
            {NAV.map(({ to, end, label, icon: Icon }) => (
              <NavLink key={to} to={to} end={end}
                className={({ isActive }) => `flex items-center gap-2.5 px-3 h-9 rounded-md text-sm font-semibold whitespace-nowrap ${isActive ? 'bg-surface text-ink border border-line shadow-sm' : 'text-ink-2 hover:text-ink border border-transparent'}`}>
                <Icon size={16} /> {label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <div className="min-w-0">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold">{title}</h1>
              {description && <p className="text-ink-2 mt-1">{description}</p>}
            </div>
            {actions}
          </div>
          {children}
        </div>
      </div>
    </AppShell>
  );
}

function useProblems() {
  const [problems, setProblems] = useState(null);
  const [error, setError] = useState(null);
  const load = () => api.get('/problem/getAllProblem').then((r) => setProblems(r.data)).catch((e) => setError(errorMessage(e)));
  useEffect(() => { load(); }, []);
  return { problems, setProblems, error, reload: load };
}

function Check({ ok, label, hint }) {
  return (
    <li className="flex items-start gap-3 py-3 border-b border-line last:border-0">
      {ok ? <CheckCircle2 size={18} className="text-ok mt-0.5 shrink-0" /> : <XCircle size={18} className="text-ink-3 mt-0.5 shrink-0" />}
      <div>
        <p className="font-semibold text-sm">{label}</p>
        {hint && <p className="text-sm text-ink-2">{hint}</p>}
      </div>
    </li>
  );
}

function Overview() {
  const health = useHealth();
  const { problems } = useProblems();
  const counts = { easy: 0, medium: 0, hard: 0 };
  (problems || []).forEach((p) => { counts[p.difficulty] = (counts[p.difficulty] || 0) + 1; });
  const anyAi = health && Object.values(health.ai || {}).some(Boolean);
  const langs = health?.languages || {};

  return (
    <AdminLayout title="Overview" description="Problem set and what this server has configured.">
      <div className="grid md:grid-cols-2 gap-6">
        <div className="panel p-5">
          <h2 className="text-lg font-bold mb-1">Problem set</h2>
          {!problems ? <PageLoader /> : (
            <>
              <p className="font-display font-bold text-5xl tabular-nums">{problems.length}</p>
              <div className="flex gap-5 mt-3">
                {['easy', 'medium', 'hard'].map((d) => <span key={d} className="flex items-center gap-2"><Difficulty value={d} /> <span className="tabular-nums text-ink-2">{counts[d]}</span></span>)}
              </div>
              <div className="flex flex-wrap gap-2 mt-6">
                <Link to="/admin/create" className="btn btn-primary btn-sm"><PlusSquare size={15} /> Add a problem</Link>
                <Link to="/admin/problems" className="btn btn-outline btn-sm">Manage problems</Link>
              </div>
            </>
          )}
        </div>
        <div className="panel p-5">
          <h2 className="text-lg font-bold mb-1">Server setup</h2>
          {!health ? <PageLoader /> : (
            <ul>
              <Check ok label={health.runner === 'judge0' ? 'Code runs on Judge0' : 'Code runs on this machine'}
                hint={health.runner === 'judge0' ? undefined : `Languages: ${Object.entries(langs).filter(([, v]) => v).map(([k]) => ({ cpp: 'C++', java: 'Java', javascript: 'JavaScript' }[k])).join(', ')}${Object.values(langs).some((v) => !v) ? '. Install g++ or a JDK to enable the rest.' : '.'}`} />
              <Check ok={anyAi} label="AI tutor" hint={anyAi ? 'At least one AI key is set.' : 'Add GROQ_API_KEY, GEMINI_KEY or OPENROUTER_API_KEY to backend/.env.'} />
              <Check ok={health.video} label="Video uploads" hint={health.video ? 'Cloudinary is configured.' : 'Add the three CLOUDINARY_ variables to backend/.env.'} />
            </ul>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

function ManageProblems() {
  const toast = useToast();
  const navigate = useNavigate();
  const { problems, setProblems, error } = useProblems();
  const [toDelete, setToDelete] = useState(null);
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/problem/delete/${toDelete._id}`);
      setProblems((list) => list.filter((p) => p._id !== toDelete._id));
      toast(`Deleted "${toDelete.title}"`, 'ok');
      setToDelete(null);
    } catch (err) {
      toast(errorMessage(err), 'bad');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminLayout title="Problems" description="Edit or delete existing problems."
      actions={<Link to="/admin/create" className="btn btn-primary"><PlusSquare size={16} /> Add a problem</Link>}>
      {error && <Alert>{error}</Alert>}
      {!problems && !error && <PageLoader />}
      {problems && (
        <div className="panel overflow-hidden">
          {problems.length === 0 ? (
            <EmptyState icon={Inbox} title="No problems yet" action={<Link to="/admin/create" className="btn btn-primary btn-sm">Add the first one</Link>} />
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>Title</th><th className="hidden md:table-cell">Topic</th><th>Difficulty</th><th className="hidden sm:table-cell text-right">Submissions</th><th className="text-right">Actions</th></tr></thead>
                <tbody>
                  {problems.map((p, i) => (
                    <tr key={p._id}>
                      <td className="font-semibold"><span className="text-ink-3 font-normal tabular-nums mr-2">{i + 1}.</span>{p.title}</td>
                      <td className="hidden md:table-cell"><span className="chip">{tagLabel(p.tags)}</span></td>
                      <td><Difficulty value={p.difficulty} /></td>
                      <td className="hidden sm:table-cell text-right tabular-nums text-ink-2">{p.submissions}</td>
                      <td>
                        <div className="flex justify-end gap-1">
                          <Link to={`/problem/${p._id}`} className="btn btn-ghost btn-sm btn-icon" title="Open problem" aria-label={`Open ${p.title}`}><ExternalLink size={15} /></Link>
                          <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/admin/edit/${p._id}`)}><Pencil size={14} /> Edit</button>
                          <button className="btn btn-danger-ghost btn-sm" onClick={() => setToDelete(p)}><Trash2 size={14} /> Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      <ConfirmDialog open={!!toDelete} busy={busy} title="Delete this problem?" confirmLabel="Delete problem"
        message={toDelete && `"${toDelete.title}" will be removed along with every submission and video for it.`}
        onConfirm={remove} onCancel={() => setToDelete(null)} />
    </AdminLayout>
  );
}

function CreateProblem() {
  const toast = useToast();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState(null);

  const submit = async (values) => {
    setServerError(null);
    try {
      await api.post('/problem/create', values);
      toast(`Added "${values.title}"`, 'ok');
      navigate('/admin/problems');
    } catch (err) {
      setServerError(errorMessage(err));
    }
  };

  return (
    <AdminLayout title="Add a problem" description="Reference solutions are run against every test case before the problem is saved.">
      <ProblemForm onSubmit={submit} submitLabel="Add problem" busyLabel="Checking solutions…" serverError={serverError} />
    </AdminLayout>
  );
}

function EditProblem() {
  const { id } = useParams();
  const toast = useToast();
  const navigate = useNavigate();
  const [values, setValues] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [serverError, setServerError] = useState(null);

  useEffect(() => {
    api.get(`/problem/problemById/${id}`).then((r) => setValues(toFormValues(r.data))).catch((e) => setLoadError(errorMessage(e)));
  }, [id]);

  const submit = async (v) => {
    setServerError(null);
    try {
      await api.put(`/problem/update/${id}`, v);
      toast(`Saved "${v.title}"`, 'ok');
      navigate('/admin/problems');
    } catch (err) {
      setServerError(errorMessage(err));
    }
  };

  return (
    <AdminLayout title={values ? `Edit ${values.title}` : 'Edit problem'} description="Saving re-runs the reference solutions against every test case.">
      {loadError && <Alert>{loadError}</Alert>}
      {!values && !loadError && <PageLoader />}
      {values && <ProblemForm defaultValues={values} onSubmit={submit} submitLabel="Save changes" busyLabel="Checking solutions…" serverError={serverError} />}
    </AdminLayout>
  );
}

function Videos() {
  const toast = useToast();
  const health = useHealth();
  const { problems, setProblems, error } = useProblems();
  const [toDelete, setToDelete] = useState(null);
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/video/delete/${toDelete._id}`);
      setProblems((list) => list.map((p) => (p._id === toDelete._id ? { ...p, hasVideo: false } : p)));
      toast('Video deleted', 'ok');
      setToDelete(null);
    } catch (err) {
      toast(errorMessage(err), 'bad');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminLayout title="Video editorials" description="Upload a walkthrough video for any problem. It plays in the Editorial tab.">
      {health && !health.video && (
        <Alert tone="warn" className="mb-5">Uploads need Cloudinary. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET to backend/.env and restart the server.</Alert>
      )}
      {error && <Alert>{error}</Alert>}
      {!problems && !error && <PageLoader />}
      {problems && (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Problem</th><th>Video</th><th className="text-right">Actions</th></tr></thead>
              <tbody>
                {problems.map((p) => (
                  <tr key={p._id}>
                    <td className="font-semibold">{p.title}</td>
                    <td>{p.hasVideo ? <Pill tone="ok">Uploaded</Pill> : <Pill>None</Pill>}</td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <Link to={`/admin/upload/${p._id}`} className="btn btn-ghost btn-sm"><Upload size={14} /> {p.hasVideo ? 'Replace' : 'Upload'}</Link>
                        {p.hasVideo && <button className="btn btn-danger-ghost btn-sm" onClick={() => setToDelete(p)}><Trash2 size={14} /> Delete</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <ConfirmDialog open={!!toDelete} busy={busy} title="Delete this video?" confirmLabel="Delete video"
        message={toDelete && `The editorial video for "${toDelete.title}" will be removed.`} onConfirm={remove} onCancel={() => setToDelete(null)} />
    </AdminLayout>
  );
}

const MAX_MB = 100;
const fmtSize = (b) => (b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);

function UploadVideo() {
  const { problemId } = useParams();
  const toast = useToast();
  const navigate = useNavigate();
  const [problem, setProblem] = useState(null);
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => { api.get(`/problem/problemById/${problemId}`).then((r) => setProblem(r.data)).catch((e) => setError(errorMessage(e))); }, [problemId]);

  const pick = (f) => {
    setError(null);
    if (!f) return setFile(null);
    if (!f.type.startsWith('video/')) return setError('Choose a video file (MP4, MOV, WebM…).');
    if (f.size > MAX_MB * 1024 * 1024) return setError(`That file is ${fmtSize(f.size)}. The limit is ${MAX_MB} MB.`);
    setFile(f);
  };

  const upload = async () => {
    setError(null);
    setProgress(0);
    try {
      const { data: sig } = await api.get(`/video/create/${problemId}`);
      const form = new FormData();
      form.append('file', file);
      form.append('signature', sig.signature);
      form.append('timestamp', sig.timestamp);
      form.append('public_id', sig.public_id);
      form.append('api_key', sig.api_key);
      const { data: up } = await axios.post(sig.upload_url, form, {
        onUploadProgress: (e) => e.total && setProgress(Math.round((e.loaded / e.total) * 100)),
      });
      await api.post('/video/save', { problemId, cloudinaryPublicId: up.public_id, secureUrl: up.secure_url, duration: up.duration });
      toast('Video uploaded', 'ok');
      navigate('/admin/videos');
    } catch (err) {
      setError(errorMessage(err, 'Upload failed. Try again.'));
      setProgress(null);
    }
  };

  const uploading = progress !== null;
  return (
    <AdminLayout title="Upload a video" description={problem ? `Editorial for ${problem.title}` : undefined}>
      <div className="panel p-6 max-w-xl">
        <label htmlFor="video" className={`flex flex-col items-center justify-center text-center gap-2 border-2 border-dashed rounded-xl px-6 py-10 cursor-pointer transition-colors ${file ? 'border-accent bg-accent-soft' : 'border-line-strong hover:border-accent'}`}
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files?.[0]); }}>
          <FileVideo size={28} className="text-accent" />
          {file ? (
            <><span className="font-semibold">{file.name}</span><span className="text-sm text-ink-2">{fmtSize(file.size)}</span></>
          ) : (
            <><span className="font-semibold">Drop a video here or click to choose one</span><span className="text-sm text-ink-2">Up to {MAX_MB} MB</span></>
          )}
          <input id="video" type="file" accept="video/*" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} disabled={uploading} />
        </label>

        {uploading && (
          <div className="mt-5">
            <div className="flex justify-between text-sm mb-1.5"><span>{progress < 100 ? 'Uploading…' : 'Saving…'}</span><span className="tabular-nums">{progress}%</span></div>
            <div className="h-2 rounded-full bg-surface-3 overflow-hidden"><div className="h-full bg-accent transition-[width]" style={{ width: `${progress}%` }} /></div>
          </div>
        )}
        {error && <Alert className="mt-5">{error}</Alert>}

        <div className="flex gap-2 justify-end mt-6">
          <Link to="/admin/videos" className="btn btn-ghost">Cancel</Link>
          <button className="btn btn-primary" onClick={upload} disabled={!file || uploading}>
            {uploading ? <><Spinner size={16} /> Uploading</> : <><Upload size={16} /> Upload video</>}
          </button>
        </div>
      </div>
    </AdminLayout>
  );
}

export default function AdminRoutes() {
  return (
    <Routes>
      <Route index element={<Overview />} />
      <Route path="problems" element={<ManageProblems />} />
      <Route path="create" element={<CreateProblem />} />
      <Route path="edit/:id" element={<EditProblem />} />
      <Route path="videos" element={<Videos />} />
      <Route path="upload/:problemId" element={<UploadVideo />} />
      {/* old paths */}
      <Route path="update" element={<Navigate to="/admin/problems" replace />} />
      <Route path="delete" element={<Navigate to="/admin/problems" replace />} />
      <Route path="video" element={<Navigate to="/admin/videos" replace />} />
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}
