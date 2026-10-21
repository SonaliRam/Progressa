import { TASK_STATUSES, PRIORITIES } from './constants';
import { normDate } from './dates';

const str = (v) => (v === null || v === undefined ? '' : String(v));

function parseLog(v) {
  if (!v) return {};
  if (typeof v === 'object') return v;
  try {
    const o = JSON.parse(v);
    return o && typeof o === 'object' ? o : {};
  } catch {
    return {};
  }
}

export function normTask(r = {}) {
  const startDate = normDate(r.startDate);
  let endDate = normDate(r.endDate) || startDate;
  if (endDate < startDate) endDate = startDate;
  return {
    id: str(r.id),
    title: str(r.title),
    description: str(r.description),
    startDate,
    endDate,
    status: TASK_STATUSES.includes(r.status) ? r.status : 'In Progress',
    priority: PRIORITIES.includes(r.priority) ? r.priority : 'Medium',
    notes: str(r.notes),
    dailyLog: parseLog(r.dailyLog),
    createdAt: str(r.createdAt),
    updatedAt: str(r.updatedAt),
    completedAt: str(r.completedAt),
    _pending: Boolean(r._pending)
  };
}

/** Fields the sheet stores, in the shape Apps Script expects. */
export function taskPayload(t) {
  return {
    title: t.title,
    description: t.description,
    startDate: t.startDate,
    endDate: t.endDate || t.startDate,
    status: t.status,
    priority: t.priority,
    notes: t.notes,
    dailyLog: JSON.stringify(t.dailyLog || {})
  };
}

export const isMultiDay = (t) => t.endDate && t.endDate !== t.startDate;
export const isOnDate = (t, key) => t.startDate && t.startDate <= key && key <= (t.endDate || t.startDate);
export const isDone = (t) => t.status === 'Completed';

/**
 * Status of a task on a given day — the single rule every page uses.
 * - One-day task: the day status IS the task status (the Status column).
 * - Multi-day task that is Completed: every day shows Completed.
 * - Otherwise the day's own entry in Daily Log wins, falling back to the task status.
 */
export function dailyStatusFor(t, key) {
  if (!isMultiDay(t) || t.status === 'Completed') return t.status;
  const day = t.dailyLog?.[key]?.status;
  return TASK_STATUSES.includes(day) ? day : t.status;
}

export const dayNoteFor = (t, key) => t.dailyLog?.[key]?.note || '';

/**
 * Returns the patch to save when the user sets a task's status for one day.
 * One-day tasks: only the Status column changes.
 * Multi-day tasks: the day is logged in Daily Log. "Completed" finishes the whole task
 * only on/after its last day (earlier days just log progress). "Blocked" blocks the task.
 */
export function dailyStatusPatch(t, key, status) {
  if (!isMultiDay(t)) return { status };
  const dailyLog = { ...(t.dailyLog || {}), [key]: { ...(t.dailyLog?.[key] || {}), status } };
  const overall = status === 'Completed' && key < t.endDate ? 'In Progress' : status;
  return { dailyLog, status: overall };
}

/**
 * Daily Log to save when a task is edited in the form: drops days outside the new
 * date range and, when the overall status is changed on a multi-day task, records
 * that status for today so the Dashboard/calendar show the same thing as the list.
 */
export function dailyLogForEdit(task, form, today) {
  const log = {};
  Object.entries(task?.dailyLog || {}).forEach(([k, v]) => {
    if (k >= form.startDate && k <= form.endDate) log[k] = v;
  });
  const multi = form.endDate !== form.startDate;
  const changed = !task || form.status !== task.status;
  if (multi && changed && form.status !== 'Completed' && today >= form.startDate && today <= form.endDate) {
    log[today] = { ...(log[today] || {}), status: form.status };
  }
  return log;
}

export function dayNotePatch(t, key, note) {
  const entry = { ...(t.dailyLog?.[key] || {}) };
  if (note) entry.note = note;
  else delete entry.note;
  const dailyLog = { ...(t.dailyLog || {}) };
  if (Object.keys(entry).length) dailyLog[key] = entry;
  else delete dailyLog[key];
  return { dailyLog };
}

const PRIORITY_RANK = { High: 0, Medium: 1, Low: 2 };
const STATUS_RANK = { Blocked: 0, 'In Progress': 1, Completed: 2 };
export function sortTasks(list, key) {
  return [...list].sort((a, b) => {
    const sa = key ? dailyStatusFor(a, key) : a.status;
    const sb = key ? dailyStatusFor(b, key) : b.status;
    return (
      STATUS_RANK[sa] - STATUS_RANK[sb] ||
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
      a.startDate.localeCompare(b.startDate) ||
      a.title.localeCompare(b.title)
    );
  });
}

export const round1 = (n) => Math.round(n * 10) / 10;
export const fmtHours = (n) => `${round1(n)}h`;
