import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Building2, Compass, Hotel, UserRound, Car } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../auth/AuthProvider';
import { errorMessage } from '../lib/api';
import { canReturnTo, homeForUser } from '../lib/roles';
import AuthShell from '../components/auth/AuthShell';
import Button from '../components/ui/Button';
import { Input } from '../components/ui/Field';

const ROLES = [
  { code: 'CUSTOMER', label: 'Traveller', description: 'Plan trips, book and pay.', icon: UserRound },
  { code: 'HOTEL_OWNER', label: 'Hotel owner', description: 'List rooms and manage stays.', icon: Hotel },
  { code: 'TRANSPORT_PROVIDER', label: 'Transport', description: 'Fleet, drivers and calendars.', icon: Car },
  { code: 'TOUR_GUIDE', label: 'Tour guide', description: 'Publish your guiding profile.', icon: Compass },
];

export default function Register() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirm: '',
    role: 'CUSTOMER',
    businessName: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isProvider = form.role !== 'CUSTOMER';
  const from = location.state?.from;

  async function submit(event) {
    event.preventDefault();
    if (form.password !== form.confirm) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const user = await auth.register({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        password: form.password,
        role: form.role,
        ...(isProvider ? { businessName: form.businessName.trim() } : {}),
      });
      navigate(from && canReturnTo(from, user) ? from : homeForUser(user), { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Create your POTHIK account"
      subtitle="Travellers and providers share one account type. Your dashboard adapts to your role."
      footer={
        <p>
          Already have an account?{' '}
          <Link to="/login" className="link">Sign in</Link>
        </p>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <span className="label">Account type</span>
          <div className="grid gap-2 sm:grid-cols-2">
            {ROLES.map((role) => (
              <button
                key={role.code}
                type="button"
                onClick={() => setForm({ ...form, role: role.code })}
                aria-pressed={form.role === role.code}
                className={clsx(
                  'flex items-start gap-2 rounded-xl border px-3 py-2.5 text-left transition',
                  form.role === role.code ? 'border-primary-500 bg-primary-50/60' : 'border-slate-200 hover:border-primary-300'
                )}
              >
                <role.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" aria-hidden="true" />
                <span>
                  <span className="block text-sm font-semibold text-slate-900">{role.label}</span>
                  <span className="block text-[11px] leading-4 text-slate-500">{role.description}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <Input label="Full name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required minLength={2} autoComplete="name" />
        <Input label="Email address" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required autoComplete="email" />
        <Input
          label="Mobile number"
          value={form.phone}
          onChange={(event) => setForm({ ...form, phone: event.target.value })}
          placeholder="01XXXXXXXXX"
          autoComplete="tel"
          required={isProvider}
          hint={isProvider ? 'Providers must supply a reachable business number.' : 'Optional for travellers.'}
        />
        {isProvider && (
          <Input
            label="Business name"
            value={form.businessName}
            onChange={(event) => setForm({ ...form, businessName: event.target.value })}
            required
            hint="Shown to travellers after the admin approval."
          />
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Password" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required minLength={8} autoComplete="new-password" hint="8+ characters with a letter and a number." />
          <Input label="Confirm password" type="password" value={form.confirm} onChange={(event) => setForm({ ...form, confirm: event.target.value })} required minLength={8} autoComplete="new-password" />
        </div>
        {isProvider && (
          <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
            <Building2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            Provider accounts start pending. You can prepare your profile, but listings and payouts unlock after admin verification.
          </p>
        )}
        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <Button type="submit" className="w-full" loading={submitting}>
          Create account
        </Button>
      </form>
    </AuthShell>
  );
}
