import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, readData } from './api';

export default function useTargetReviews(targetType, targetId, { limit = 6 } = {}) {
  const [page, setPage] = useState(1);

  const list = useQuery({
    queryKey: ['reviews', targetType, targetId, page, limit],
    queryFn: () => readData(api.get('/reviews', { params: { targetType, targetId, page, limit } })),
    enabled: Boolean(targetId),
  });

  const summary = useQuery({
    queryKey: ['reviews', targetType, targetId, 'summary'],
    queryFn: () => readData(api.get('/reviews/summary', { params: { targetType, targetId } })),
    enabled: Boolean(targetId),
  });

  const review = useMemo(() => {
    const items = (list.data?.items || []).map((row) => ({
      id: row.id,
      rating: row.rating,
      title: row.title,
      comment: row.comment,
      createdAt: row.created_at,
      verified: row.is_verified,
      providerReply: row.provider_reply,
      user: row.user ? { id: row.user.id, name: row.user.name } : null,
    }));
    return {
      summary: {
        // The server aggregate covers every approved review, not just the visible page.
        average: summary.data?.average ?? 0,
        total: summary.data?.total ?? list.data?.meta?.total ?? items.length,
        items,
      },
      meta: list.data?.meta,
    };
  }, [list.data, summary.data]);

  const changePage = useCallback((next) => {
    setPage(next);
    document.getElementById('reviews')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  return { ...review, page, changePage };
}
