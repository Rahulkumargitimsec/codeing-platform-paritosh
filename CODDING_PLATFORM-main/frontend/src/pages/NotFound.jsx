import { Link } from 'react-router';
import AppShell from '../components/AppShell';

export default function NotFound() {
  return (
    <AppShell>
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-24">
        <p className="font-code text-ink-3 mb-3">404</p>
        <h1 className="text-3xl font-bold mb-2">This page doesn't exist</h1>
        <p className="text-ink-2 mb-6">The link may be broken, or the problem may have been removed.</p>
        <Link to="/" className="btn btn-primary">Go to problems</Link>
      </div>
    </AppShell>
  );
}
