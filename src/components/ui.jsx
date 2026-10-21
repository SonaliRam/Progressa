import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, X } from 'lucide-react';
import { PRIORITY_STYLE, STATUS_STYLE } from '../lib/constants';
import { useData } from '../context/DataContext';

export function PageHeader({ eyebrow, title, subtitle, actions }) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {subtitle && <p className="subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function StatusPill({ status, small }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE['In Progress'];
  return (
    <span className={`pill ${small ? 'pill-sm' : ''}`} style={{ background: s.bg, color: s.fg }}>
      <span className="dot" style={{ background: s.dot }} />
      {status}
    </span>
  );
}

export function PriorityTag({ priority }) {
  const s = PRIORITY_STYLE[priority] || PRIORITY_STYLE.Medium;
  return (
    <span className="tag" style={{ background: s.bg, color: s.fg }}>
      {priority}
    </span>
  );
}

/** Segmented control. options: [{value,label,icon?,style?}] */
export function Segmented({ value, onChange, options, size, ariaLabel }) {
  return (
    <div className={`seg ${size === 'sm' ? 'seg-sm' : ''}`} role="tablist" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          className={value === o.value ? 'active' : ''}
          style={value === o.value ? o.activeStyle : undefined}
          onClick={() => onChange(o.value)}
          title={o.title || o.label}
        >
          {o.icon}
          {o.label && <span>{o.label}</span>}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, text, action }) {
  return (
    <div className="empty">
      {icon && <div className="empty-icon">{icon}</div>}
      <div className="empty-title">{title}</div>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

export function Spinner({ size = 18 }) {
  return <Loader2 size={size} className="spin" aria-label="Loading" />;
}

export function Field({ label, hint, error, children, full }) {
  return (
    <label className={`field ${full ? 'field-full' : ''}`}>
      <span className="field-label">{label}</span>
      {children}
      {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

export function Modal({ open, title, onClose, children, footer, width = 620 }) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && closeRef.current();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    setTimeout(() => ref.current?.querySelector('input, textarea, select')?.focus(), 30);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal clay" style={{ maxWidth: width }} ref={ref} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/** Two-step delete button: first click arms, second confirms. */
export function ConfirmDelete({ onConfirm, label = 'Delete', disabled }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return undefined;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      type="button"
      className={`btn ${armed ? 'btn-danger' : 'btn-ghost'}`}
      disabled={disabled}
      onClick={() => (armed ? onConfirm() : setArmed(true))}
    >
      {armed ? 'Tap again to confirm' : label}
    </button>
  );
}

export function Toasts() {
  const { toasts, dismissToast } = useData();
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast clay toast-${t.type}`}>
          {t.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
          <span>{t.message}</span>
          <button className="icon-btn icon-btn-sm" onClick={() => dismissToast(t.id)} aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

export function ProgressBar({ value, color = 'var(--coral)', height = 10 }) {
  const v = Math.max(0, Math.min(100, value || 0));
  return (
    <div className="pbar" style={{ height }}>
      <div className="pbar-fill" style={{ width: `${v}%`, background: color }} />
    </div>
  );
}
