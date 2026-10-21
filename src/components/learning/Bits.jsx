import { Fragment, useEffect, useRef, useState } from 'react';
import { BookOpen, Check, ChevronDown, FileText, Github, Link2, MonitorPlay, MoreHorizontal, Plus, X } from 'lucide-react';
import { TOPIC_STATUSES, TOPIC_STATUS_STYLE } from '../../lib/learning';

/** Closes on outside click / Escape. */
function useDismiss(open, setOpen, ref) {
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, setOpen, ref]);
}

/** Current topic status as a pill; click to choose another. */
export function TopicStatusMenu({ value, onChange, disabled, size = 'md' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useDismiss(open, setOpen, ref);
  const st = TOPIC_STATUS_STYLE[value] || TOPIC_STATUS_STYLE['Not Started'];
  return (
    <div className={`lmenu ${open ? 'open' : ''}`} ref={ref} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className={`tstatus tstatus-${size}`}
        style={{ background: st.bg, color: st.fg }}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Status: ${value}. Change status`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="dot" style={{ background: st.dot }} />
        {value}
        <ChevronDown size={13} className="lmenu-chev" />
      </button>
      {open && (
        <div className="lmenu-pop clay" role="listbox">
          {TOPIC_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              role="option"
              aria-selected={s === value}
              className={s === value ? 'active' : ''}
              style={{ '--st-bg': TOPIC_STATUS_STYLE[s].bg, '--st-fg': TOPIC_STATUS_STYLE[s].fg }}
              onClick={() => {
                setOpen(false);
                if (s !== value) onChange(s);
              }}
            >
              <span className="dot" style={{ background: TOPIC_STATUS_STYLE[s].dot }} />
              {s}
              {s === value && <Check size={14} className="lmenu-check" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** "⋯" button with a small action menu. items: [{label, icon, onClick, danger}] */
export function MenuButton({ items, label = 'More actions', small }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useDismiss(open, setOpen, ref);
  return (
    <div className={`lmenu ${open ? 'open' : ''}`} ref={ref} onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
      <button type="button" className={`icon-btn ${small ? 'icon-btn-sm' : ''}`} aria-label={label} title={label} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <MoreHorizontal size={small ? 15 : 18} />
      </button>
      {open && (
        <div className="lmenu-pop lmenu-actions clay" role="menu">
          {items.filter(Boolean).map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              className={it.danger ? 'danger' : ''}
              onClick={() => {
                setOpen(false);
                it.onClick();
              }}
            >
              {it.icon}
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Trello-style inline adder: click, type, Enter (stays open for the next one), Esc to close. */
export function QuickAdd({ label, placeholder, onAdd, disabled, className = '' }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const inputRef = useRef(null);
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);
  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onAdd(t);
    setText('');
    inputRef.current?.focus();
  };
  if (!open)
    return (
      <button type="button" className={`quick-add-btn ${className}`} onClick={() => setOpen(true)} disabled={disabled}>
        <Plus size={16} /> {label}
      </button>
    );
  return (
    <div className={`quick-add ${className}`}>
      <input
        ref={inputRef}
        className="input input-sm"
        value={text}
        placeholder={placeholder}
        maxLength={200}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
          if (e.key === 'Escape') {
            setOpen(false);
            setText('');
          }
        }}
      />
      <div className="quick-add-actions">
        <button type="button" className="btn btn-primary btn-sm" onClick={submit} disabled={!text.trim()}>
          Add
        </button>
        <button
          type="button"
          className="icon-btn icon-btn-sm"
          aria-label="Cancel"
          onClick={() => {
            setOpen(false);
            setText('');
          }}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

/** Circular progress (percentage in the middle). */
export function ProgressRing({ value, size = 88, stroke = 10, color = 'var(--coral)', label }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value || 0));
  return (
    <div className="pring" style={{ width: size, height: size }} role="img" aria-label={`${v}% complete`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F6E6E8" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (v / 100) * c}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="pring-label">
        <strong>{v}%</strong>
        {label && <span>{label}</span>}
      </div>
    </div>
  );
}

export const KIND_ICON = { GitHub: Github, Document: FileText, Link: Link2, Video: MonitorPlay, Course: BookOpen };

export function KindIcon({ kind, size = 16 }) {
  const Icon = KIND_ICON[kind] || Link2;
  return (
    <span className={`kind-icon kind-${String(kind || 'Link').toLowerCase()}`}>
      <Icon size={size} />
    </span>
  );
}

/** Plain text with clickable links and preserved line breaks. */
export function RichText({ text }) {
  const parts = String(text || '').split(/(https?:\/\/[^\s)]+)/g);
  return (
    <div className="rich">
      {parts.map((p, i) =>
        /^https?:\/\//.test(p) ? (
          <a key={i} href={p} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
            {p.replace(/^https?:\/\/(www\.)?/, '').slice(0, 60)}
          </a>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        )
      )}
    </div>
  );
}

/** Thin horizontal progress bar with a colour. */
export function Bar({ value, color = 'var(--coral)', height = 8 }) {
  const v = Math.max(0, Math.min(100, value || 0));
  return (
    <div className="lbar" style={{ height }}>
      <div className="lbar-fill" style={{ width: `${v}%`, background: color }} />
    </div>
  );
}
