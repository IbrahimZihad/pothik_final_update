import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { errorMessage } from '../lib/api';
import AuthShell from '../components/auth/AuthShell';
import Button from '../components/ui/Button';
import { Input } from '../components/ui/Field';

function homeFor(user) {
  const roles = user?.roles || [];
  if (roles.includes('ADMIN')) return '/admin';
  if (roles.some((role) => ['HOTEL_OWNER', 'TRANSPORT_PROVIDER', 'TOUR_GUIDE'].includes(role))) return '/provider';
  return '/account';
}

export default function Login() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const from = location.state?.from;

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const user = await auth.login(form.email.trim(), form.password);
      const target = from && !from.startsWith('/login') ? from : homeFor(user);
      navigate(target, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to manage bookings, payments and trips."
      footer={
        <p>
          New to POTHIK?{' '}
          <Link to="/register" className="link">Create an account</Link>
        </p>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Input
          label="Email address"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
          required
        />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          value={form.password}
          onChange={(event) => setForm({ ...form, password: event.target.value })}
          required
        />
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-xs font-semibold text-primary-700 hover:underline">Forgot password?</Link>
        </div>
        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <Button type="submit" className="w-full" loading={submitting}>
          <LogIn className="h-4 w-4" /> Sign in
        </Button>
        {from && <p className="text-center text-xs text-slate-500">You will return to the page you were on.</p>}
      </form>
    </AuthShell>
  );
}
