import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router';
import { useDispatch, useSelector } from 'react-redux';
import { checkAuth } from './store/authSlice';
import { fetchHealth } from './lib/health';
import { Logo, Spinner } from './components/ui';
import Landing from './pages/Landing';
import { Login, Signup } from './pages/Auth';
import Problems from './pages/Problems';
import Profile from './pages/Profile';
import NotFound from './pages/NotFound';

// The editor pulls in Monaco, so load those screens on demand
const ProblemPage = lazy(() => import('./pages/ProblemPage'));
const AdminRoutes = lazy(() => import('./admin/AdminRoutes'));

function Splash({ label = 'Loading' }) {
  return (
    <div className="h-full paper flex flex-col items-center justify-center gap-4">
      <Logo size={36} />
      <span className="flex items-center gap-2 text-sm text-ink-3"><Spinner size={16} /> {label}…</span>
    </div>
  );
}

function RequireAuth({ children, admin = false }) {
  const { isAuthenticated, user } = useSelector((s) => s.auth);
  const location = useLocation();
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (admin && user?.role !== 'admin') return <Navigate to="/problems" replace />;
  return children;
}

function GuestOnly({ children }) {
  const { isAuthenticated } = useSelector((s) => s.auth);
  const location = useLocation();
  if (isAuthenticated) return <Navigate to={location.state?.from || '/problems'} replace />;
  return children;
}

export default function App() {
  const dispatch = useDispatch();
  const { initialized, isAuthenticated } = useSelector((s) => s.auth);

  useEffect(() => {
    dispatch(checkAuth());
    fetchHealth();
  }, [dispatch]);

  if (!initialized) return <Splash />;

  return (
    <Suspense fallback={<Splash />}>
      <Routes>
        <Route path="/" element={isAuthenticated ? <Navigate to="/problems" replace /> : <Landing />} />
        <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
        <Route path="/signup" element={<GuestOnly><Signup /></GuestOnly>} />
        <Route path="/problems" element={<RequireAuth><Problems /></RequireAuth>} />
        <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
        <Route path="/problem/:problemId" element={<RequireAuth><ProblemPage /></RequireAuth>} />
        <Route path="/admin/*" element={<RequireAuth admin><AdminRoutes /></RequireAuth>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
