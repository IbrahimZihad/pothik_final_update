import { useState } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { api, readData, errorMessage } from '../lib/api';
import AuthShell from '../components/auth/AuthShell';
import Button from '../components/ui/Button';
import { Input } from '../components/ui/Field';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const data = await readData(api.post('/auth/forgot-password', { email: email.trim() }));
      setSent(true);
      if (data.resetToken) setResetToken(data.resetToken);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your account email and we will send a reset token."
      footer={
        <p>
          Remembered it?{' '}
          <Link to="/login" className="link">Back to sign in</Link>
        </p>
      }
    >
      {sent ? (
        <div className="space-y-4">
          <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            If an account exists for {email}, a reset token has been sent. The token expires in one hour.
          </p>
          {resetToken && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <p className="font-semibold">Local development mode</p>
              <p className="mt-1 text-xs leading-5">
                Email delivery is queued, so the reset token is shown here. In production this token is only sent by email.
              </p>
              <Button as={Link} to={`/reset-password?token=${encodeURIComponent(resetToken)}`} size="sm" className="mt-3">
                <KeyRound className="h-3.5 w-3.5" /> Continue to reset
              </Button>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Input label="Email address" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          <Button type="submit" className="w-full" loading={submitting}>
            Send reset token
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
