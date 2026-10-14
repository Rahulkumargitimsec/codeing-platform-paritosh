import { useEffect, useRef, useState } from 'react';
import { NavLink, Link, useNavigate } from 'react-router';
import { useDispatch, useSelector } from 'react-redux';
import { Moon, Sun, LogOut, User, Shield, ListChecks } from 'lucide-react';
import { logoutUser } from '../store/authSlice';
import { useTheme } from '../lib/theme';
import { Logo } from './ui';

export function ThemeToggle({ className = '' }) {
  const [theme, toggle] = useTheme();
  return (
    <button className={`btn btn-ghost btn-sm btn-icon ${className}`} onClick={toggle}
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      title={theme === 'dark' ? 'Light theme' : 'Dark theme'}>
      {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}

export function UserMenu() {
  const { user } = useSelector((s) => s.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  if (!user) return null;
  const initial = user.firstName?.[0]?.toUpperCase() || '?';

  const logout = async () => {
    setOpen(false);
    await dispatch(logoutUser());
    navigate('/');
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}
        className="w-8 h-8 rounded-full bg-accent text-accent-ink font-display font-bold text-sm flex items-center justify-center hover:ring-4 hover:ring-accent-soft transition-shadow">
        {initial}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-10 w-60 panel panel-raised p-1.5 pop-in z-50">
          <div className="px-3 py-2.5 border-b border-line mb-1">
            <p className="font-semibold truncate">{user.firstName} {user.lastName || ''}</p>
            <p className="text-xs text-ink-3 truncate">{user.emailId}</p>
          </div>
          <MenuLink to="/profile" icon={User} onClick={() => setOpen(false)}>Your profile</MenuLink>
          <MenuLink to="/problems" icon={ListChecks} onClick={() => setOpen(false)}>Problems</MenuLink>
          {user.role === 'admin' && <MenuLink to="/admin" icon={Shield} onClick={() => setOpen(false)}>Admin</MenuLink>}
          <button role="menuitem" onClick={logout} className="w-full flex items-center gap-2.5 px-3 h-9 rounded-md text-sm text-bad hover:bg-bad-soft">
            <LogOut size={16} /> Log out
          </button>
        </div>
      )}
    </div>
  );
}

function MenuLink({ to, icon: Icon, children, onClick }) {
  return (
    <Link role="menuitem" to={to} onClick={onClick} className="flex items-center gap-2.5 px-3 h-9 rounded-md text-sm text-ink-2 hover:bg-surface-2 hover:text-ink">
      <Icon size={16} /> {children}
    </Link>
  );
}

const navClass = ({ isActive }) =>
  `px-3 h-8 inline-flex items-center rounded-md text-sm font-semibold transition-colors ${isActive ? 'text-ink bg-surface-2' : 'text-ink-3 hover:text-ink'}`;

export function TopBar() {
  const { user } = useSelector((s) => s.auth);
  return (
    <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur border-b border-line">
      <div className="max-w-6xl mx-auto h-14 px-4 sm:px-6 flex items-center gap-4">
        <Link to={user ? '/problems' : '/'} aria-label="CodeJudge home"><Logo /></Link>
        {user && (
          <nav className="hidden sm:flex items-center gap-1 ml-4">
            <NavLink to="/problems" className={navClass}>Problems</NavLink>
            <NavLink to="/profile" className={navClass}>Profile</NavLink>
            {user.role === 'admin' && <NavLink to="/admin" className={navClass}>Admin</NavLink>}
          </nav>
        )}
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          {user ? <UserMenu /> : (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm">Log in</Link>
              <Link to="/signup" className="btn btn-primary btn-sm">Sign up</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export default function AppShell({ children, paper = true }) {
  return (
    <div className={`min-h-full flex flex-col ${paper ? 'paper' : 'bg-bg'}`}>
      <TopBar />
      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  );
}
