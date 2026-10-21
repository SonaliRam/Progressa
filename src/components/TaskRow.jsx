import { useEffect, useRef, useState } from 'react';
import { Ban, Check, ChevronDown, Clock3, StickyNote } from 'lucide-react';
import { STATUS_STYLE, TASK_STATUSES } from '../lib/constants';
import { diffDays, fmt } from '../lib/dates';
import { dailyStatusFor, dailyStatusPatch, dayNoteFor, dayNotePatch, isMultiDay } from '../lib/model';
import { useData } from '../context/DataContext';
import { PriorityTag } from './ui';

const ICONS = { 'In Progress': Clock3, Completed: Check, Blocked: Ban };

/** Shows only the current status; click it to pick a different one. */
export function StatusSwitch({ value, onChange, disabled, onOpenChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = STATUS_STYLE[value] ? value : 'In Progress';
  const Icon = ICONS[current];
  const style = STATUS_STYLE[current];

  useEffect(() => onOpenChange?.(open), [open, onOpenChange]);

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
  }, [open]);

  const pick = (s) => {
    setOpen(false);
    if (s !== current) onChange(s);
  };

  return (
    <div className={`status-menu ${open ? 'open' : ''}`} ref={ref}>
      <button
        type="button"
        className="status-current"
        style={{ background: style.bg, color: style.fg }}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Status: ${current}. Change status`}
        title="Change status"
        onClick={() => setOpen((o) => !o)}
      >
        <Icon size={14} />
        <span className="status-label">{current}</span>
        <ChevronDown size={14} className="status-chev" />
      </button>

      {open && (
        <div className="status-options clay" role="listbox" aria-label="Status for this day">
          {TASK_STATUSES.map((s) => {
            const OptIcon = ICONS[s];
            const active = s === current;
            return (
              <button
                key={s}
                type="button"
                role="option"
                aria-selected={active}
                className={active ? 'active' : ''}
                style={{ '--st-bg': STATUS_STYLE[s].bg, '--st-fg': STATUS_STYLE[s].fg }}
                onClick={() => pick(s)}
              >
                <span className="status-opt-icon">
                  <OptIcon size={14} />
                </span>
                <span>{s}</span>
                {active && <Check size={14} className="status-opt-check" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** One task on a specific day, with that day's status and (optionally) a day note. */
export default function TaskRow({ task, dateKey, onOpen, showNote = false, showDates = false }) {
  const { updateTask, toast } = useData();
  const status = dailyStatusFor(task, dateKey);
  const done = status === 'Completed';
  const multi = isMultiDay(task);
  const dayNo = diffDays(task.startDate, dateKey) + 1;
  const span = diffDays(task.startDate, task.endDate) + 1;
  const busy = task._pending || task.id.startsWith('tmp-');

  const [menuOpen, setMenuOpen] = useState(false);

  const storedNote = dayNoteFor(task, dateKey);
  const [note, setNote] = useState(storedNote);
  useEffect(() => setNote(storedNote), [storedNote]);

  const setStatus = async (s) => {
    const patch = dailyStatusPatch(task, dateKey, s);
    try {
      await updateTask(task.id, patch, { quiet: true });
      if (multi && s === 'Completed' && patch.status !== 'Completed') toast(`Day ${dayNo} of ${span} done — keep going!`);
      else toast(`“${task.title}” → ${patch.status}`);
    } catch {
      /* toast already shown */
    }
  };

  const saveNote = async () => {
    const trimmed = note.trim();
    if (trimmed === dayNoteFor(task, dateKey)) return;
    try {
      await updateTask(task.id, dayNotePatch(task, dateKey, trimmed), { quiet: true });
      toast('Day note saved');
    } catch {
      setNote(dayNoteFor(task, dateKey));
    }
  };

  return (
    <div className={`task-row clay-soft ${done ? 'is-done' : ''} ${busy ? 'is-busy' : ''} ${menuOpen ? 'menu-open' : ''}`}>
      <button
        type="button"
        className={`check ${done ? 'checked' : ''}`}
        onClick={() => setStatus(done ? 'In Progress' : 'Completed')}
        disabled={busy}
        aria-label={done ? 'Mark as in progress' : 'Mark as completed'}
      >
        <Check size={16} strokeWidth={3} />
      </button>

      <div className="task-main" onClick={() => onOpen?.(task)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpen?.(task)}>
        <div className="task-title">{task.title}</div>
        <div className="task-meta">
          <PriorityTag priority={task.priority} />
          {multi && (
            <span className="tag tag-soft">
              Day {Math.max(1, Math.min(dayNo, span))}/{span}
            </span>
          )}
          {showDates && (
            <span className="muted small">
              {multi ? `${fmt(task.startDate)} → ${fmt(task.endDate)}` : fmt(task.startDate)}
            </span>
          )}
          {task.notes && !showNote && (
            <span className="muted small note-hint" title={task.notes}>
              <StickyNote size={12} /> note
            </span>
          )}
        </div>
        {task.description && <div className="task-desc">{task.description}</div>}
      </div>

      <StatusSwitch value={status} onChange={setStatus} disabled={busy} onOpenChange={setMenuOpen} />

      {showNote && (
        <input
          className="input input-sm day-note"
          placeholder={`Note for ${fmt(dateKey, { day: 'numeric', month: 'short' })}… (press Enter to save)`}
          value={note}
          disabled={busy}
          onChange={(e) => setNote(e.target.value)}
          onBlur={saveNote}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
      )}
    </div>
  );
}
