import { useState, useRef, useEffect } from 'react';

/**
 * InfoTooltip
 * ───────────
 * A tiny, unobtrusive "?" glyph that reveals an explanatory popup on hover
 * or tap. Designed to clarify KPI tiles, metric definitions, and derived
 * values without stealing layout space.
 *
 * Props:
 *   title       — short heading (e.g. "Tier")
 *   children    — body text (React node or string)
 *   side        — 'top' | 'bottom' | 'left' | 'right' (default 'bottom')
 *   size        — 'xs' | 'sm' | 'md' (default 'sm')
 *   tone        — 'neutral' | 'orange' (default 'neutral')
 */
export default function InfoTooltip({
  title,
  children,
  side = 'bottom',
  size = 'sm',
  tone = 'neutral',
}) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const wrapRef = useRef(null);

  // Click-outside to close when opened via click
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [open]);

  const visible = open || hovered;

  const sizeMap = {
    xs: { btn: 'w-3 h-3 text-[7px]', icon: 9 },
    sm: { btn: 'w-[14px] h-[14px] text-[8px]', icon: 10 },
    md: { btn: 'w-4 h-4 text-[9px]', icon: 11 },
  };
  const s = sizeMap[size] || sizeMap.sm;

  const toneStyles =
    tone === 'orange'
      ? {
          background: 'rgba(249,115,22,0.12)',
          border: '1px solid rgba(249,115,22,0.35)',
          color: '#fb923c',
        }
      : {
          background: 'rgba(148,163,184,0.08)',
          border: '1px solid rgba(148,163,184,0.22)',
          color: '#94a3b8',
        };

  // Position the popup
  const posStyle = (() => {
    const gap = 8;
    switch (side) {
      case 'top':
        return {
          bottom: `calc(100% + ${gap}px)`,
          left: '50%',
          transform: 'translateX(-50%)',
        };
      case 'left':
        return {
          right: `calc(100% + ${gap}px)`,
          top: '50%',
          transform: 'translateY(-50%)',
        };
      case 'right':
        return {
          left: `calc(100% + ${gap}px)`,
          top: '50%',
          transform: 'translateY(-50%)',
        };
      case 'bottom':
      default:
        return {
          top: `calc(100% + ${gap}px)`,
          right: 0,
        };
    }
  })();

  return (
    <span
      ref={wrapRef}
      className="relative inline-flex items-center"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        aria-label={title ? `Info: ${title}` : 'Info'}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className={`${s.btn} rounded-full mono-font font-bold leading-none flex items-center justify-center transition-all cursor-help`}
        style={{
          ...toneStyles,
          opacity: visible ? 1 : 0.55,
        }}
      >
        ?
      </button>

      {visible && (
        <div
          role="tooltip"
          className="absolute z-50 pointer-events-none"
          style={{
            ...posStyle,
            width: 'max-content',
            maxWidth: '260px',
            minWidth: '180px',
          }}
        >
          <div
            className="rounded-lg px-3 py-2.5 text-left"
            style={{
              background: 'rgba(10,13,20,0.96)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(249,115,22,0.22)',
              boxShadow: '0 12px 32px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.02)',
            }}
          >
            {title && (
              <div
                className="mono-font text-[9px] uppercase tracking-[0.2em] mb-1"
                style={{ color: '#fb923c' }}
              >
                {title}
              </div>
            )}
            <div
              className="text-[11px] leading-[1.45] text-slate-200"
              style={{ fontFamily: 'inherit' }}
            >
              {children}
            </div>
          </div>
        </div>
      )}
    </span>
  );
}
