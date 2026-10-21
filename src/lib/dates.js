// All dates in the app are "date keys": local yyyy-MM-dd strings.
// They compare correctly as strings and never shift across timezones.

const pad = (n) => String(n).padStart(2, '0');

export const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function parseKey(key) {
  const [y, m, d] = String(key).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export const todayKey = (now = new Date()) => toKey(now);

export function isValidKey(key) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(key || ''));
}

export function normDate(v) {
  if (!v) return '';
  const s = String(v);
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  return m ? `${m[1]}-${pad(m[2])}-${pad(m[3])}` : '';
}

export function addDays(key, n) {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return toKey(d);
}

/** Whole calendar days from a → b (b - a). DST-safe. */
export function diffDays(a, b) {
  const A = parseKey(a);
  const B = parseKey(b);
  const ua = Date.UTC(A.getFullYear(), A.getMonth(), A.getDate());
  const ub = Date.UTC(B.getFullYear(), B.getMonth(), B.getDate());
  return Math.round((ub - ua) / 86400000);
}

export function countWeekdays(fromKey, toKeyExclusive) {
  let count = 0;
  let k = fromKey;
  while (k < toKeyExclusive) {
    const day = parseKey(k).getDay();
    if (day !== 0 && day !== 6) count += 1;
    k = addDays(k, 1);
  }
  return count;
}

/** Monday of the week containing key. */
export function startOfWeek(key) {
  const d = parseKey(key);
  const dow = (d.getDay() + 6) % 7; // Mon=0
  d.setDate(d.getDate() - dow);
  return toKey(d);
}

/** 42 date keys (6 weeks, Monday first) covering the given month. */
export function monthGrid(year, month) {
  const first = toKey(new Date(year, month, 1));
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export function monthLabel(year, month) {
  return new Date(year, month, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

export function fmt(key, opts = { weekday: 'short', day: 'numeric', month: 'short' }) {
  if (!isValidKey(key)) return '';
  return parseKey(key).toLocaleDateString('en-GB', opts);
}

export function fmtLong(key) {
  return fmt(key, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function relativeLabel(key, today = todayKey()) {
  const d = diffDays(today, key);
  if (d === 0) return 'Today';
  if (d === 1) return 'Tomorrow';
  if (d === -1) return 'Yesterday';
  return fmt(key);
}

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
