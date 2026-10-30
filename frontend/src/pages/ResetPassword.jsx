import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useToast } from '../components/ToastProvider';
import { api, errorMessage } from '../lib/api';
import AuthShell from '../components/auth/AuthShell';
import Button from '../components/ui/Button';
import { Input } from '../components/ui/Field';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [token, setToken] = useState(params.get('token') || '');
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (form.password !== form.confirm) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await api.post('/auth/reset-password', { token: token.trim(), password: form.password });
      toast.success('Password reset. You can sign in now.');
      navigate('/login', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Choose a new password"
      subtitle="Reset tokens expire one hour after they are issued."
      footer={
        <p>
          Need a new token?{' '}
          <Link to="/forgot-password" className="link">Request another</Link>
        </p>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Input
          label="Reset token"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          required
          minLength={10}
          autoComplete="one-time-code"
          hint="Paste the token from the reset email or the development banner."
        />
        <Input label="New password" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required minLength={8} autoComplete="new-password" hint="8+ characters with a letter and a number." />
        <Input label="Confirm new password" type="password" value={form.confirm} onChange={(event) => setForm({ ...form, confirm: event.target.value })} required minLength={8} autoComplete="new-password" />
        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <Button type="submit" className="w-full" loading={submitting}>
          Reset password
        </Button>
      </form>
    </AuthShell>
  );
}
