import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, Newspaper, Pencil, Plus } from 'lucide-react';
import { api, readData, errorMessage } from '../../lib/api';
import DashHead from '../../components/dashboard/DashHead';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Pagination from '../../components/ui/Pagination';
import { Input, Select, Textarea } from '../../components/ui/Field';
import Badge from '../../components/ui/Badge';
import { PageLoader } from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { useToast } from '../../components/ToastProvider';
import { formatDate } from '../../lib/format';

const EMPTY = {
  title: '',
  slug: '',
  titleBn: '',
  excerpt: '',
  content: '',
  coverImage: '',
  authorName: '',
  status: 'DRAFT',
  publishedAt: '',
};

function blogToForm(blog) {
  return {
    title: blog.title || '',
    slug: blog.slug || '',
    titleBn: blog.titleBn || '',
    excerpt: blog.excerpt || '',
    content: blog.content || '',
    coverImage: blog.coverImage || '',
    authorName: blog.authorName || '',
    status: blog.status || 'DRAFT',
    publishedAt: blog.publishedAt ? String(blog.publishedAt).slice(0, 16) : '',
  };
}

export default function AdminBlogs() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const blogs = useQuery({
    queryKey: ['admin', 'blogs', { status, search, page }],
    queryFn: () =>
      readData(
        api.get('/admin/blogs', {
          params: { page, limit: 20, ...(status ? { status } : {}), ...(search ? { search } : {}) },
        })
      ),
  });

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        title: form.title.trim(),
        slug: form.slug.trim() || undefined,
        titleBn: form.titleBn.trim() || undefined,
        excerpt: form.excerpt.trim() || undefined,
        content: form.content.trim() || undefined,
        coverImage: form.coverImage.trim() || undefined,
        authorName: form.authorName.trim() || undefined,
        status: form.status,
        publishedAt: form.publishedAt || undefined,
      };
      return dialog?.mode === 'edit'
        ? readData(api.patch(`/admin/blogs/${dialog.blog.id}`, payload))
        : readData(api.post('/admin/blogs', payload));
    },
    onSuccess: () => {
      toast.success(dialog?.mode === 'edit' ? 'Post updated.' : 'Post created.');
      setDialog(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'blogs'] });
      queryClient.invalidateQueries({ queryKey: ['blogs'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const archive = useMutation({
    mutationFn: (id) => readData(api.delete(`/admin/blogs/${id}`)),
    onSuccess: () => {
      toast.success('Post archived to draft.');
      queryClient.invalidateQueries({ queryKey: ['admin', 'blogs'] });
      queryClient.invalidateQueries({ queryKey: ['blogs'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const invalid = form.title.trim().length < 3;

  return (
    <div>
      <DashHead
        eyebrow="Journal"
        title="Editorial posts"
        description="Drafts stay invisible on the public journal until published."
        actions={
          <Button onClick={() => { setForm(EMPTY); setDialog({ mode: 'create' }); }}>
            <Plus className="h-4 w-4" /> New post
          </Button>
        }
      />

      <form
        className="mb-4 flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setSearch(term.trim());
          setPage(1);
        }}
      >
        <input className="input max-w-xs" placeholder="Search title" value={term} onChange={(event) => setTerm(event.target.value)} aria-label="Search posts" />
        <select
          className="input w-auto"
          value={status}
          onChange={(event) => { setStatus(event.target.value); setPage(1); }}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
        </select>
        <Button type="submit" size="sm" variant="outline">Search</Button>
      </form>

      {blogs.isLoading ? (
        <PageLoader />
      ) : blogs.isError ? (
        <EmptyState icon={Newspaper} title="Posts could not be loaded" />
      ) : blogs.data?.items?.length ? (
        <>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px]">
                <thead className="border-b border-slate-100 bg-slate-50/70">
                  <tr>
                    <th className="table-head">Post</th>
                    <th className="table-head">Slug</th>
                    <th className="table-head">Author</th>
                    <th className="table-head">State</th>
                    <th className="table-head">Published</th>
                    <th className="table-head text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {blogs.data.items.map((blog) => (
                    <tr key={blog.id} className="hover:bg-slate-50/60">
                      <td className="table-cell">
                        <p className="font-semibold text-ink-900">{blog.title}</p>
                        {blog.titleBn && <p className="text-[11px] text-slate-500">{blog.titleBn}</p>}
                      </td>
                      <td className="table-cell font-mono text-xs text-slate-500">{blog.slug}</td>
                      <td className="table-cell text-xs text-slate-600">{blog.authorName || '—'}</td>
                      <td className="table-cell">
                        <Badge tone={blog.status === 'PUBLISHED' ? 'emerald' : 'slate'} dot>{blog.status.toLowerCase()}</Badge>
                      </td>
                      <td className="table-cell text-xs text-slate-500">{blog.publishedAt ? formatDate(blog.publishedAt) : '—'}</td>
                      <td className="table-cell text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button size="sm" variant="outline" onClick={() => { setForm(blogToForm(blog)); setDialog({ mode: 'edit', blog }); }}>
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </Button>
                          {blog.status === 'PUBLISHED' && (
                            <Button size="sm" variant="ghost" className="text-rose-600 hover:bg-rose-50" loading={archive.isPending} onClick={() => archive.mutate(blog.id)}>
                              <Archive className="h-3.5 w-3.5" /> Unpublish
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Pagination meta={blogs.data.meta} onPageChange={setPage} />
        </>
      ) : (
        <EmptyState icon={Newspaper} title="No posts found" description="Write the first story for the Pothik journal." />
      )}

      <Modal
        open={Boolean(dialog)}
        onClose={() => setDialog(null)}
        size="xl"
        title={dialog?.mode === 'edit' ? `Edit “${dialog.blog.title}”` : 'New journal post'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>Cancel</Button>
            <Button loading={save.isPending} disabled={invalid} onClick={() => save.mutate()}>
              {dialog?.mode === 'edit' ? 'Save post' : 'Create post'}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Title" required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} wrapperClassName="sm:col-span-2" />
          <Input label="Bangla title" value={form.titleBn} onChange={(event) => setForm({ ...form, titleBn: event.target.value })} />
          <Input label="Slug" value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} hint="Leave blank to generate from the title." />
          <Input label="Author" value={form.authorName} onChange={(event) => setForm({ ...form, authorName: event.target.value })} hint="Defaults to your account name." />
          <Input label="Cover image URL" value={form.coverImage} onChange={(event) => setForm({ ...form, coverImage: event.target.value })} placeholder="/images/journal/cover.jpg" />
          <Textarea label="Excerpt" rows={2} value={form.excerpt} onChange={(event) => setForm({ ...form, excerpt: event.target.value })} wrapperClassName="sm:col-span-2" hint="Shown on journal cards. Max 500 characters." />
          <Textarea label="Content" rows={12} value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} wrapperClassName="sm:col-span-2" hint="Plain text or markdown; rendered by the public article page." />
          <Select label="Status" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
          </Select>
          <Input
            label="Publish date"
            type="datetime-local"
            value={form.publishedAt}
            onChange={(event) => setForm({ ...form, publishedAt: event.target.value })}
            hint="Optional. Defaults to now when publishing."
          />
        </div>
      </Modal>
    </div>
  );
}
