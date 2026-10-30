import { Link, Navigate, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { PageLoader } from '../components/ui/Spinner';
import Button from '../components/ui/Button';
import { dashboardPathFor } from '../components/PublicNav';

export function Forbidden({ message = 'You do not have access to this page.' }) {
  const auth = useAuth();
  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-rose-50 text-rose-600">
        <ShieldAlert className="h-7 w-7" aria-hidden="true" />
      </span>
      <h1 className="mt-5 text-2xl font-bold text-ink-900">403 — Not allowed</h1>
      <p className="mt-2 max-w-md text-sm text-slate-600">{message}</p>
      <div className="mt-6 flex gap-2">
        <Button as={Link} to={dashboardPathFor(auth)} variant="primary">
          Go to my dashboard
        </Button>
        <Button as={Link} to="/" variant="outline">
          Back to home
        </Button>
      </div>
    </div>
  );
}

export default function ProtectedRoute({ roles, children }) {
  const auth = useAuth();
  const location = useLocation();

  if (auth.loading) return <PageLoader label="Checking your session…" />;
  if (!auth.isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }
  if (roles?.length && !auth.hasRole(...roles)) {
    return <Forbidden message="This area is reserved for a different account type." />;
  }
  return children;
}

export function GuestRoute({ children }) {
  const auth = useAuth();
  if (auth.loading) return <PageLoader />;
  if (auth.isAuthenticated) return <Navigate to={dashboardPathFor(auth)} replace />;
  return children;
}
