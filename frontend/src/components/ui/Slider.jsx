import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Slider({ children, label, itemClassName = 'w-[85%] shrink-0 snap-start sm:w-[47%] lg:w-[31.5%]', className = '' }) {
  const trackRef = useRef(null);
  const [state, setState] = useState({ atStart: true, atEnd: true, scrollable: false });

  const sync = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const next = {
      scrollable: track.scrollWidth > track.clientWidth + 4,
      atStart: track.scrollLeft <= 4,
      atEnd: track.scrollLeft + track.clientWidth >= track.scrollWidth - 4,
    };
    setState((prev) =>
      prev.scrollable === next.scrollable && prev.atStart === next.atStart && prev.atEnd === next.atEnd ? prev : next
    );
  }, []);

  const items = Array.isArray(children) ? children : [children];

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return undefined;
    sync();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(sync);
    observer.observe(track);
    return () => observer.disconnect();
  }, [sync, items.length]);

  function scrollByPage(direction) {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({ left: direction * Math.max(track.clientWidth * 0.85, 240), behavior: 'smooth' });
  }

  return (
    <div className={`relative ${className}`}>
      <div
        ref={trackRef}
        onScroll={sync}
        role="group"
        aria-label={label}
        className="-mx-1 flex snap-x snap-mandatory gap-5 overflow-x-auto px-1 py-1 [scrollbar-width:thin]"
      >
        {items.map((child, index) => (
          <div key={index} className={itemClassName}>
            {child}
          </div>
        ))}
      </div>

      {state.scrollable && (
        <>
          <button
            type="button"
            onClick={() => scrollByPage(-1)}
            disabled={state.atStart}
            aria-label={`Scroll ${label || 'items'} left`}
            className={`absolute -left-4 top-1/2 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-float transition hover:text-primary-700 sm:grid ${
              state.atStart ? 'pointer-events-none opacity-0' : 'opacity-100'
            }`}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => scrollByPage(1)}
            disabled={state.atEnd}
            aria-label={`Scroll ${label || 'items'} right`}
            className={`absolute -right-4 top-1/2 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-float transition hover:text-primary-700 sm:grid ${
              state.atEnd ? 'pointer-events-none opacity-0' : 'opacity-100'
            }`}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}
    </div>
  );
}
