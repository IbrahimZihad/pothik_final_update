import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ meta, onPageChange, className }) {
  if (!meta || !meta.totalPages || meta.totalPages <= 1) return null;
  const { page, totalPages } = meta;

  const pages = [];
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const end = Math.min(totalPages, start + 4);
  for (let index = start; index <= end; index += 1) pages.push(index);

  return (
    <nav className={className || 'mt-10 flex items-center justify-center gap-1.5'} aria-label="Pagination">
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={!meta.hasPrev}
        className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-primary-400 hover:text-primary-700 disabled:opacity-40"
        aria-label="Previous page"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      {pages.map((entry) => (
        <button
          key={entry}
          type="button"
          onClick={() => onPageChange(entry)}
          aria-current={entry === page ? 'page' : undefined}
          className={
            entry === page
              ? 'h-9 min-w-9 rounded-lg bg-primary-600 px-3 text-sm font-semibold text-white'
              : 'h-9 min-w-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 transition hover:border-primary-400 hover:text-primary-700'
          }
        >
          {entry}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={!meta.hasNext}
        className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-primary-400 hover:text-primary-700 disabled:opacity-40"
        aria-label="Next page"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </nav>
  );
}
