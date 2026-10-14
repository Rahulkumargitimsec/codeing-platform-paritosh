import { useEffect, useState } from 'react';

const current = () => document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';

// Shared theme state: every component using this hook stays in sync
const listeners = new Set();
export const setTheme = (t) => {
  document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem('theme', t); } catch { /* storage may be blocked */ }
  listeners.forEach((fn) => fn(t));
};

export const useTheme = () => {
  const [theme, set] = useState(current);
  useEffect(() => {
    listeners.add(set);
    return () => listeners.delete(set);
  }, []);
  return [theme, () => setTheme(theme === 'dark' ? 'light' : 'dark')];
};
