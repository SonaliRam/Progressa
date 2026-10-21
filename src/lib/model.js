import { TASK_STATUSES, PRIORITIES, SKILL_LEVELS } from './constants';
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

export function normLearning(r = {}) {
  const hours = Number(r.hours);
  const progress = Number(r.progress);
  return {
    id: str(r.id),
    date: normDate(r.date),
    category: str(r.category).trim() || 'Other',
    topic: str(r.topic),
    hours: Number.isFinite(hours) ? Math.max(0, hours) : 0,
    progress: Number.isFinite(progress) ? Math.min(100, Math.max(0, progress)) : 0,
    skillLevel: SKILL_LEVELS.includes(r.skillLevel) ? r.skillLevel : 'Beginner',
    notes: str(r.notes),
    createdAt: str(r.createdAt),
    updatedAt: str(r.updatedAt),
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

export function learningPayload(l) {
  return {
    date: l.date,
    category: l.category,
    topic: l.topic,
    hours: Number(l.hours) || 0,
    progress: Number(l.progress) || 0,
    skillLevel: l.skillLevel,
    notes: l.notes
  };
}

export const isMultiDay = (t) => t.endDate && t.endDate !== t.startDate;
export const isOnDate = (t, key) => t.startDate && t.startDate <= key && key <= (t.endDate || t.startDate);
export const isDone = (t) => t.status === 'Completed';

/** Status of a task on a given day (daily log wins, otherwise the overall status). */
export function dailyStatusFor(t, key) {
  return t.dailyLog?.[key]?.status || t.status;
}

export const dayNoteFor = (t, key) => t.dailyLog?.[key]?.note || '';

/**
 * Returns the patch to save when the user sets a task's status for one day.
 * Single-day tasks: the day status is the task status.
 * Multi-day tasks: "Completed" only finishes the whole task on/after its last day;
 * earlier days just log progress. "Blocked" blocks the task.
 */
export function dailyStatusPatch(t, key, status) {
  const dailyLog = { ...(t.dailyLog || {}), [key]: { ...(t.dailyLog?.[key] || {}), status } };
  let overall = status;
  if (isMultiDay(t)) {
    if (status === 'Completed') overall = key >= t.endDate ? 'Completed' : 'In Progress';
    else overall = status;
  }
  return { dailyLog, status: overall };
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
