export default function DashHead({ eyebrow, title, description, actions }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 pb-6">
      <div>
        {eyebrow && <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary-700">{eyebrow}</p>}
        <h1 className="mt-1 text-2xl font-bold text-ink-900 sm:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-slate-600">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
