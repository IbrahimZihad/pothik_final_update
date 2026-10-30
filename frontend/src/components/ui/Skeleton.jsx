import clsx from 'clsx';

export default function Skeleton({ className }) {
  return <div className={clsx('animate-pulse rounded-xl bg-slate-200/80', className)} aria-hidden="true" />;
}

export function CardSkeleton({ count = 6 }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="card overflow-hidden">
          <Skeleton className="h-44 w-full rounded-none" />
          <div className="space-y-3 p-5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
