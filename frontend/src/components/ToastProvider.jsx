import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';

const ToastContext = createContext(null);

const TONES = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  error: 'border-rose-200 bg-rose-50 text-rose-900',
  info: 'border-sky-200 bg-sky-50 text-sky-900',
};

const ICONS = { success: CheckCircle2, error: XCircle, info: Info };

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const counter = useRef(0);

  const dismiss = useCallback((id) => {
    setItems((rows) => rows.filter((row) => row.id !== id));
  }, []);

  const push = useCallback(
    (toast) => {
      const id = ++counter.current;
      const item = { id, type: toast.type || 'info', message: toast.message };
      setItems((rows) => [...rows, item]);
      window.setTimeout(() => dismiss(id), toast.duration || 5000);
      return id;
    },
    [dismiss]
  );

  const value = useMemo(
    () => ({
      push,
      dismiss,
      success: (message, options = {}) => push({ ...options, type: 'success', message }),
      error: (message, options = {}) => push({ ...options, type: 'error', message }),
      info: (message, options = {}) => push({ ...options, type: 'info', message }),
    }),
    [push, dismiss]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:items-end sm:right-6 sm:left-auto">
        {items.map((item) => {
          const Icon = ICONS[item.type] || Info;
          return (
            <div
              key={item.id}
              role="status"
              className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-float ${TONES[item.type] || TONES.info}`}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="flex-1 leading-5">{item.message}</p>
              <button type="button" onClick={() => dismiss(item.id)} className="rounded p-0.5 hover:bg-black/5" aria-label="Dismiss">
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider');
  return context;
}
