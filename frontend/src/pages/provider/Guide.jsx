import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Compass, Star } from 'lucide-react';
import { api, readData, errorMessage } from '../../lib/api';
import DashHead from '../../components/dashboard/DashHead';
import BlockDatesDialog from '../../components/dashboard/BlockDatesDialog';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Input, Select, Textarea } from '../../components/ui/Field';
import { StatusBadge } from '../../components/ui/Badge';
import { PageLoader } from '../../components/ui/Spinner';
import { useToast } from '../../components/ToastProvider';
import { formatCurrency } from '../../lib/format';

const EMPTY = {
  bio: '',
  languages: '',
  expertise: '',
  yearsExperience: '0',
  dailyRate: '',
  hourlyRate: '',
  serviceLocations: '',
  photo: '',
  status: 'PENDING_REVIEW',
};

export default function ProviderGuide() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const [availabilityOpen, setAvailabilityOpen] = useState(false);

  const guide = useQuery({
    queryKey: ['provider', 'guide'],
    queryFn: () => readData(api.get('/provider/guide')),
  });

  useEffect(() => {
    if (guide.data) {
      setForm({
        bio: guide.data.bio || '',
        languages: (guide.data.languages || []).join(', '),
        expertise: (guide.data.expertise || []).join(', '),
        yearsExperience: String(guide.data.yearsExperience ?? 0),
        dailyRate: String(guide.data.dailyRate ?? ''),
        hourlyRate: guide.data.hourlyRate ? String(guide.data.hourlyRate) : '',
        serviceLocations: (guide.data.serviceLocations || []).join(', '),
        photo: guide.data.photo || '',
        status: guide.data.status || 'PENDING_REVIEW',
      });
    }
  }, [guide.data]);

  const save = useMutation({
    mutationFn: () =>
      readData(
        api.put('/provider/guide', {
          bio: form.bio.trim() || undefined,
          languages: form.languages.trim() ? form.languages.split(',').map((item) => item.trim()).filter(Boolean) : undefined,
          expertise: form.expertise.trim() ? form.expertise.split(',').map((item) => item.trim()).filter(Boolean) : undefined,
          yearsExperience: Number(form.yearsExperience || 0),
          dailyRate: Number(form.dailyRate),
          hourlyRate: form.hourlyRate ? Number(form.hourlyRate) : undefined,
          serviceLocations: form.serviceLocations.trim() ? form.serviceLocations.split(',').map((item) => item.trim()).filter(Boolean) : undefined,
          photo: form.photo.trim() || undefined,
          status: form.status,
        })
      ),
    onSuccess: () => {
      toast.success('Guide profile saved.');
      queryClient.invalidateQueries({ queryKey: ['provider', 'guide'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'provider'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (guide.isLoading) return <PageLoader />;

  return (
    <div>
      <DashHead
        eyebrow="Guide profile"
        title="Your guiding business"
        description="Rates, specialities and the dates you can lead trips."
        actions={
          <>
            {guide.data && <StatusBadge status={guide.data.status} />}
            <Button variant="outline" disabled={!guide.data} onClick={() => setAvailabilityOpen(true)}>
              <CalendarDays className="h-4 w-4" /> Availability
            </Button>
          </>
        }
      />

      {!guide.data && (
        <p className="mb-5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No guide profile yet. Save one below — daily rate is required.
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <h2 className="flex items-center gap-2 text-base font-bold text-ink-900">
            <Compass className="h-4 w-4 text-primary-700" /> Profile and rates
          </h2>
          <form
            className="mt-4 grid gap-4 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate();
            }}
          >
            <Input
              label="Daily rate (BDT)"
              type="number"
              min="1"
              required
              value={form.dailyRate}
              onChange={(event) => setForm({ ...form, dailyRate: event.target.value })}
              hint="Applied per travel day by the server."
            />
            <Input
              label="Hourly rate (optional)"
              type="number"
              min="1"
              value={form.hourlyRate}
              onChange={(event) => setForm({ ...form, hourlyRate: event.target.value })}
              hint="Only used when a trip requests hours."
            />
            <Input
              label="Years of experience"
              type="number"
              min="0"
              max="70"
              value={form.yearsExperience}
              onChange={(event) => setForm({ ...form, yearsExperience: event.target.value })}
            />
            <Select label="Status" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
              <option value="ACTIVE">Active</option>
              <option value="PENDING_REVIEW">Pending review</option>
              <option value="INACTIVE">Inactive</option>
            </Select>
            <Input label="Languages" value={form.languages} onChange={(event) => setForm({ ...form, languages: event.target.value })} hint="Comma separated, e.g. Bangla, English" />
            <Input label="Expertise" value={form.expertise} onChange={(event) => setForm({ ...form, expertise: event.target.value })} hint="Comma separated, e.g. Trekking, Sundarbans" />
            <Input
              label="Service locations"
              value={form.serviceLocations}
              onChange={(event) => setForm({ ...form, serviceLocations: event.target.value })}
              hint="Comma separated cities or regions"
              wrapperClassName="sm:col-span-2"
            />
            <Input label="Photo URL" value={form.photo} onChange={(event) => setForm({ ...form, photo: event.target.value })} wrapperClassName="sm:col-span-2" />
            <Textarea
              label="About you"
              rows={6}
              maxLength={10000}
              value={form.bio}
              onChange={(event) => setForm({ ...form, bio: event.target.value })}
              wrapperClassName="sm:col-span-2"
              placeholder="Local knowledge, favourite routes, what a day with you looks like…"
            />
            <div className="sm:col-span-2">
              <Button type="submit" loading={save.isPending} disabled={Number(form.dailyRate) <= 0}>
                Save guide profile
              </Button>
            </div>
          </form>
        </Card>

        <Card className="h-fit p-6">
          <h2 className="text-base font-bold text-ink-900">Preview</h2>
          {guide.data ? (
            <>
              <p className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-ink-900">{formatCurrency(guide.data.dailyRate)}</span>
                <span className="text-xs text-slate-500">per day</span>
              </p>
              {guide.data.hourlyRate ? <p className="text-xs text-slate-500">{formatCurrency(guide.data.hourlyRate)} per hour</p> : null}
              <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                {guide.data.rating?.average ? Number(guide.data.rating.average).toFixed(1) : 'New'} · {guide.data.rating?.count || 0} reviews
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-600">{guide.data.bio || 'Add a bio so travellers know your routes.'}</p>
              {guide.data.languages?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {guide.data.languages.map((language) => (
                    <span key={language} className="chip bg-slate-100 text-slate-600">{language}</span>
                  ))}
                </div>
              )}
              <p className="mt-4 text-xs text-slate-500">
                Visibility: {guide.data.status.toLowerCase().replaceAll('_', ' ')}. Admin approval is required before your profile appears publicly.
              </p>
            </>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Save the profile to see a preview.</p>
          )}
        </Card>
      </div>

      <BlockDatesDialog
        open={availabilityOpen}
        path={guide.data ? '/provider/guide/availability' : null}
        title="Guide availability"
        resourceLabel="Guide"
        onClose={() => setAvailabilityOpen(false)}
      />
    </div>
  );
}
