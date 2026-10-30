import { forwardRef, useId } from 'react';
import clsx from 'clsx';

export function Field({ label, hint, error, required, htmlFor, className, children }) {
  return (
    <div className={className}>
      {label && (
        <label className="label" htmlFor={htmlFor}>
          {label}
          {required && <span className="ml-1 text-rose-500">*</span>}
        </label>
      )}
      {children}
      {hint && !error && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}

const baseControl = (invalid) =>
  clsx('input', invalid && 'border-rose-400 focus:border-rose-500 focus:ring-rose-100');

export const Input = forwardRef(function Input({ label, error, hint, required, className, id, wrapperClassName, ...props }, ref) {
  const autoId = useId();
  const inputId = id || autoId;
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={inputId} className={wrapperClassName}>
      <input ref={ref} id={inputId} className={clsx(baseControl(error), className)} aria-invalid={Boolean(error)} {...props} />
    </Field>
  );
});

export const Select = forwardRef(function Select({ label, error, hint, required, className, id, wrapperClassName, children, ...props }, ref) {
  const autoId = useId();
  const selectId = id || autoId;
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={selectId} className={wrapperClassName}>
      <select ref={ref} id={selectId} className={clsx(baseControl(error), className)} aria-invalid={Boolean(error)} {...props}>
        {children}
      </select>
    </Field>
  );
});

export const Textarea = forwardRef(function Textarea({ label, error, hint, required, className, id, rows = 4, wrapperClassName, ...props }, ref) {
  const autoId = useId();
  const textareaId = id || autoId;
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={textareaId} className={wrapperClassName}>
      <textarea
        ref={ref}
        id={textareaId}
        rows={rows}
        className={clsx(baseControl(error), 'resize-y', className)}
        aria-invalid={Boolean(error)}
        {...props}
      />
    </Field>
  );
});

export function Checkbox({ label, error, className, id, ...props }) {
  const autoId = useId();
  const checkboxId = id || autoId;
  return (
    <div className={className}>
      <label htmlFor={checkboxId} className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-700">
        <input
          id={checkboxId}
          type="checkbox"
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
          {...props}
        />
        <span>{label}</span>
      </label>
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
