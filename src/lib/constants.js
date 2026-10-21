export const TASK_STATUSES = ['In Progress', 'Completed', 'Blocked'];
export const PRIORITIES = ['High', 'Medium', 'Low'];
export const CATEGORIES = ['Frontend', 'Backend', 'Git', 'Server', 'Database', 'Shopify'];
export const SKILL_LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];

// Appraisal countdown — local dates (no timezone drift).
export const COUNTDOWN_START = '2026-10-21';
export const APPRAISAL_DATE = '2027-04-01';

export const COLORS = {
  coral: '#F78383',
  coralDeep: '#E86565',
  purple: '#9D8DF1',
  purpleDeep: '#7C6BE0',
  yellow: '#FFD166',
  yellowDeep: '#F2B53A',
  pink: '#FFD6DC',
  charcoal: '#2B2A33',
  muted: '#77727F',
  mint: '#7BD3B0'
};

export const STATUS_STYLE = {
  'In Progress': { bg: '#EEEAFF', fg: '#5B4BC4', dot: COLORS.purple },
  Completed: { bg: '#E2F6EE', fg: '#24795A', dot: COLORS.mint },
  Blocked: { bg: '#FFE4E4', fg: '#C23B3B', dot: COLORS.coral }
};

export const PRIORITY_STYLE = {
  High: { bg: '#FFE0E0', fg: '#C23B3B', bar: COLORS.coral },
  Medium: { bg: '#FFF2D3', fg: '#9A6A00', bar: COLORS.yellow },
  Low: { bg: '#EEEAFF', fg: '#5B4BC4', bar: COLORS.purple }
};

export const CATEGORY_COLORS = {
  Frontend: '#F78383',
  Backend: '#9D8DF1',
  Git: '#FFB454',
  Server: '#5FBFA0',
  Database: '#6AA8F0',
  Shopify: '#E58FC8'
};
const FALLBACK_CAT = ['#C9A3F5', '#F5A97F', '#8FD1D9', '#B9C46B'];
export function categoryColor(cat) {
  if (CATEGORY_COLORS[cat]) return CATEGORY_COLORS[cat];
  let h = 0;
  for (const ch of String(cat)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return FALLBACK_CAT[h % FALLBACK_CAT.length];
}

export const SHEET_URL =
  'https://docs.google.com/spreadsheets/d/1bdt6aVBR5Hc4nDZyZsLMIXmS47Zk1fE9QxgKQHEDD7I/edit';
