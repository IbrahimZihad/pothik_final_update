import clsx from 'clsx';
import { Loader2 } from 'lucide-react';

const VARIANTS = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  outline: 'btn-outline',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
};

export default function Button({
  as: Tag = 'button',
  variant = 'primary',
  size,
  loading = false,
  className,
  children,
  disabled,
  type,
  ...props
}) {
  const isButton = Tag === 'button';
  return (
    <Tag
      className={clsx(VARIANTS[variant] || VARIANTS.primary, size === 'sm' && 'btn-sm', className)}
      disabled={isButton ? disabled || loading : undefined}
      type={isButton ? type || 'button' : undefined}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </Tag>
  );
}
