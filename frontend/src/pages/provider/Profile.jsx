import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, FileCheck2, FileUp, ShieldCheck } from 'lucide-react';
import { api, readData, errorMessage } from '../../lib/api';
import DashHead from '../../components/dashboard/DashHead';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Input, Select, Textarea } from '../../components/ui/Field';
import Badge, { StatusBadge } from '../../components/ui/Badge';
import { PageLoader } from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { useToast } from '../../components/ToastProvider';
import { formatDate } from '../../lib/format';

const DOC_TYPES = ['TRADE_LICENSE', 'TIN_CERTIFICATE', 'NID', 'OWNER_PHOTO', 'VEHICLE_REGISTRATION', 'INSURANCE', 'GUIDE_LICENSE', 'OTHER'];

export default function ProviderProfile() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const fileInput = useRef(null);
  const [form, setForm] = useState({ businessName: '', description: '', phone: '', address: '', logo: '' });
  const [docType, setDocType] = useState('TRADE_LICENSE');

  const profile = useQuery({
    queryKey: ['provider', 'profile'],
    queryFn: () => readData(api.get('/provider/profile')),
  });

  useEffect(() => {
    if (profile.data) {
      setForm({
        businessName: profile.data.businessName || '',
        description: profile.data.description || '',
        phone: profile.data.phone || '',
        address: profile.data.address || '',
        logo: profile.data.logo || '',
      });
    }
  }, [profile.data]);

  const save = useMutation({
    mutationFn: () => readData(api.patch('/provider/profile', {
      businessName: form.businessName.trim(),
      description: form.description.trim() || undefined,
      phone: form.phone.trim() || undefined,
      address: form.address.trim() || undefined,
      logo: form.logo.trim() || undefined,
    })),
    onSuccess: () => {
      toast.success('Business profile saved.');
      queryClient.invalidateQueries({ queryKey: ['provider', 'profile'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const upload = useMutation({
    mutationFn: (file) => {
      const body = new FormData();
      body.append('file', file);
      body.append('type', docType);
      return readData(api.post('/provider/documents', body));
    },
    onSuccess: () => {
      toast.success('Document uploaded for review.');
      queryClient.invalidateQueries({ queryKey: ['provider', 'profile'] });
      if (fileInput.current) fileInput.current.value = '';
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (profile.isLoading) return <PageLoader />;
  if (profile.isError) {
    return <EmptyState icon={Building2} title="Profile unavailable" description={profile.error?.message} />;
  }

  const data = profile.data;

  return (
    <div>
      <DashHead
        eyebrow="Business profile"
        title={data.businessName}
        description="Approval unlocks listings, bookings and payouts."
        actions={<StatusBadge status={data.status} />}
      />

      {data.status === 'REJECTED' && data.rejectionReason && (
        <p className="mb-5 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">Rejected: {data.rejectionReason}</p>
      )}
      {data.status === 'PENDING' && (
        <p className="mb-5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Your application is waiting for an administrator. You can complete your profile and documents in the meantime.
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <h2 className="flex items-center gap-2 text-base font-bold text-ink-900">
            <Building2 className="h-4 w-4 text-primary-700" /> Business details
          </h2>
          <form
            className="mt-4 grid gap-4 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate();
            }}
          >
            <Input
              label="Business name"
              required
              value={form.businessName}
              onChange={(event) => setForm({ ...form, businessName: event.target.value })}
              wrapperClassName="sm:col-span-2"
            />
            <Input label="Phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="+8801…" />
            <Input label="Logo URL" value={form.logo} onChange={(event) => setForm({ ...form, logo: event.target.value })} placeholder="/uploads/logo.png" />
            <Input label="Address" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} wrapperClassName="sm:col-span-2" />
            <Textarea
              label="About your business"
              rows={5}
              maxLength={5000}
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              wrapperClassName="sm:col-span-2"
            />
            <div className="sm:col-span-2">
              <Button type="submit" loading={save.isPending} disabled={form.businessName.trim().length < 2}>
                Save profile
              </Button>
            </div>
          </form>
        </Card>

        <div className="space-y-5">
          <Card className="p-6">
            <h2 className="text-base font-bold text-ink-900">Account</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-2"><dt className="text-slate-500">Type</dt><dd className="font-semibold text-slate-800">{data.type}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-slate-500">Status</dt><dd><Badge tone={data.status === 'APPROVED' ? 'emerald' : 'amber'}>{data.status.toLowerCase()}</Badge></dd></div>
              <div className="flex justify-between gap-2"><dt className="text-slate-500">Commission</dt><dd className="font-semibold text-slate-800">{Number(data.commissionRate || 0).toFixed(1)}%</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-slate-500">Approved</dt><dd className="text-slate-700">{data.approvedAt ? formatDate(data.approvedAt) : '—'}</dd></div>
            </dl>
            <p className="mt-3 flex items-start gap-2 text-xs text-slate-500">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" />
              Commission rates are set by POTHIK administrators and snapshotted into every booking line.
            </p>
          </Card>

          <Card className="p-6">
            <h2 className="flex items-center gap-2 text-base font-bold text-ink-900">
              <FileCheck2 className="h-4 w-4 text-primary-700" /> Verification documents
            </h2>
            <ul className="mt-3 space-y-2">
              {data.documents?.length ? (
                data.documents.map((document) => (
                  <li key={document.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <a href={document.fileUrl} target="_blank" rel="noreferrer" className="truncate font-medium text-slate-700 hover:text-primary-700">
                      {document.type.replaceAll('_', ' ').toLowerCase()}
                    </a>
                    <StatusBadge status={document.status} />
                  </li>
                ))
              ) : (
                <li className="text-sm text-slate-500">No documents uploaded yet.</li>
              )}
            </ul>

            <form
              className="mt-4 space-y-3 border-t border-slate-100 pt-4"
              onSubmit={(event) => {
                event.preventDefault();
                const file = fileInput.current?.files?.[0];
                if (file) upload.mutate(file);
              }}
            >
              <Select label="Document type" value={docType} onChange={(event) => setDocType(event.target.value)}>
                {DOC_TYPES.map((type) => (
                  <option key={type} value={type}>{type.replaceAll('_', ' ').toLowerCase()}</option>
                ))}
              </Select>
              <input
                ref={fileInput}
                type="file"
                accept="image/*,application/pdf"
                required
                className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-primary-50 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-primary-700 hover:file:bg-primary-100"
              />
              <Button type="submit" variant="outline" size="sm" loading={upload.isPending}>
                <FileUp className="h-4 w-4" /> Upload for review
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
