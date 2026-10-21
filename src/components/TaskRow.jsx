import { useEffect, useState } from 'react';
import { Ban, Check, Clock3, StickyNote } from 'lucide-react';
import { STATUS_STYLE, TASK_STATUSES } from '../lib/constants';
import { diffDays, fmt } from '../lib/dates';
import { dailyStatusFor, dailyStatusPatch, dayNoteFor, dayNotePatch, isMultiDay } from '../lib/model';
import { useData } from '../context/DataContext';
import { PriorityTag } from './ui';

const ICONS = { 'In Progress': Clock3, Completed: Check, Blocked: Ban };

export function StatusSwitch({ value, onChange, disabled }) {
  return (
    <div className="status-switch" role="radiogroup" aria-label="Status for this day">
      {TASK_STATUSES.map((s) => {
        const Icon = ICONS[s];
        const active = value === s;
        return (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            title={s}
            className={active ? 'active' : ''}
            style={active ? { background: STATUS_STYLE[s].bg, color: STATUS_STYLE[s].fg } : undefined}
            onClick={() => !active && onChange(s)}
          >
            <Icon size={14} />
            <span>{s}</span>
          </button>
        );
      })}
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
    <div className={`task-row clay-soft ${done ? 'is-done' : ''} ${busy ? 'is-busy' : ''}`}>
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

      <StatusSwitch value={status} onChange={setStatus} disabled={busy} />

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
