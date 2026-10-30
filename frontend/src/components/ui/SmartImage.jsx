import { useState } from 'react';
import clsx from 'clsx';
import { ImageOff } from 'lucide-react';

export default function SmartImage({ src, alt = '', className, wrapperClassName, fallback = null, ...props }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (!src || failed) {
    return (
      <div className={clsx('flex items-center justify-center bg-gradient-to-br from-primary-100 via-primary-50 to-secondary-50 text-primary-400', wrapperClassName, className)}>
        {fallback || <ImageOff className="h-8 w-8" aria-hidden="true" />}
      </div>
    );
  }

  return (
    <div className={clsx('relative overflow-hidden bg-slate-100', wrapperClassName)}>
      {!loaded && <div className="absolute inset-0 animate-pulse bg-slate-200" aria-hidden="true" />}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={clsx('transition-opacity duration-500', loaded ? 'opacity-100' : 'opacity-0', className)}
        {...props}
      />
    </div>
  );
}
