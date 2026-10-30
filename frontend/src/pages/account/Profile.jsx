import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { KeyRound, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { api, readData, errorMessage } from '../../lib/api';
import DashHead from '../../components/dashboard/DashHead';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { Input, Select } from '../../components/ui/Field';
import Badge from '../../components/ui/Badge';
import { useToast } from '../../components/ToastProvider';
import { useAuth } from '../../auth/AuthProvider';
import { useLanguage } from '../../i18n/LanguageProvider';

export default function Profile() {
  const auth = useAuth();
  const toast = useToast();
  const { setLang } = useLanguage();
  const [form, setForm] = useState({ name: '', phone: '', locale: 'en' });
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirm: '' });

  useEffect(() => {
    if (auth.user) {
      setForm({ name: auth.user.name || '', phone: auth.user.phone || '', locale: auth.user.locale || 'en' });
    }
  }, [auth.user]);

  const saveProfile = useMutation({
    mutationFn: () => readData(api.patch('/auth/me', { name: form.name.trim(), phone: form.phone.trim() || undefined, locale: form.locale })),
    onSuccess: async () => {
      await auth.refreshUser();
      setLang(form.locale);
      toast.success('Profile updated.');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const changePassword = useMutation({
    mutationFn: () =>
      readData(api.post('/auth/change-password', { currentPassword: passwords.currentPassword, newPassword: passwords.newPassword })),
    onSuccess: () => {
      setPasswords({ currentPassword: '', newPassword: '', confirm: '' });
      toast.success('Password changed.');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const passwordMismatch = passwords.confirm !== '' && passwords.newPassword !== passwords.confirm;
  const passwordInvalid = passwords.newPassword.length < 8 || passwordMismatch;

  return (
    <div className="mx-auto max-w-3xl">
      <DashHead eyebrow="Account settings" title="Your profile" description="Contact details and sign-in security." />

      <div className="grid gap-5">
        <Card className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-base font-bold text-ink-900">
              <UserRound className="h-4 w-4 text-primary-700" /> Traveller details
            </h2>
            <Badge tone={auth.user?.status === 'ACTIVE' ? 'emerald' : 'amber'} dot>
              {(auth.user?.status || '').replaceAll('_', ' ').toLowerCase()}
            </Badge>
          </div>

          <form
            className="mt-4 grid gap-4 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              saveProfile.mutate();
            }}
          >
            <Input label="Full name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            <Input label="Phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="+8801…" />
            <div className="sm:col-span-2">
              <label className="label">Email address</label>
              <p className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-600">
                <Mail className="h-4 w-4 text-slate-400" /> {auth.user?.email}
              </p>
            </div>
            <Select label="Preferred language" value={form.locale} onChange={(event) => setForm({ ...form, locale: event.target.value })}>
              <option value="en">English</option>
              <option value="bn">বাংলা</option>
            </Select>
            <div className="sm:col-span-2">
              <Button type="submit" loading={saveProfile.isPending} disabled={form.name.trim().length < 2}>
                Save changes
              </Button>
            </div>
          </form>
        </Card>

        <Card className="p-6">
          <h2 className="flex items-center gap-2 text-base font-bold text-ink-900">
            <KeyRound className="h-4 w-4 text-primary-700" /> Change password
          </h2>
          <form
            className="mt-4 grid gap-4 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!passwordInvalid && passwords.currentPassword) changePassword.mutate();
            }}
          >
            <Input
              label="Current password"
              type="password"
              autoComplete="current-password"
              required
              value={passwords.currentPassword}
              onChange={(event) => setPasswords({ ...passwords, currentPassword: event.target.value })}
              wrapperClassName="sm:col-span-2"
            />
            <Input
              label="New password"
              type="password"
              autoComplete="new-password"
              required
              value={passwords.newPassword}
              onChange={(event) => setPasswords({ ...passwords, newPassword: event.target.value })}
              hint="At least 8 characters with a letter and a number."
            />
            <Input
              label="Confirm new password"
              type="password"
              autoComplete="new-password"
              required
              value={passwords.confirm}
              onChange={(event) => setPasswords({ ...passwords, confirm: event.target.value })}
              error={passwordMismatch ? 'Passwords do not match.' : undefined}
            />
            <div className="sm:col-span-2">
              <Button type="submit" variant="outline" loading={changePassword.isPending} disabled={passwordInvalid || !passwords.currentPassword}>
                Update password
              </Button>
            </div>
          </form>
        </Card>

        <Card className="flex items-start gap-3 bg-primary-50/60 p-5 text-sm text-primary-900">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
          <p>
            Sessions use short-lived access tokens with rotating refresh tokens stored in an httpOnly cookie. Changing your password does not
            reveal or store it anywhere in the browser.
          </p>
        </Card>
      </div>
    </div>
  );
}
