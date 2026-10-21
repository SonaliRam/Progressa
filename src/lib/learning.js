// Learning board model: Category → Technology → Topic, plus Resources.
// Everything is one flat list of rows from the "Learning" sheet, linked by parentId.
import { categoryColor } from './constants';

export const LEARNING_TYPES = ['category', 'technology', 'topic', 'resource'];
export const TOPIC_STATUSES = ['Not Started', 'Learning', 'Practicing', 'Completed'];
export const RESOURCE_KINDS = ['GitHub', 'Document', 'Link', 'Video', 'Course'];
export const DEFAULT_CATEGORIES = ['Frontend', 'Backend', 'Git', 'Server', 'Database', 'Shopify'];

export const TOPIC_STATUS_STYLE = {
  'Not Started': { bg: '#F2EFF4', fg: '#6B6675', dot: '#C7C2CC', short: 'To learn' },
  Learning: { bg: '#EEEAFF', fg: '#5B4BC4', dot: '#9D8DF1', short: 'Learning' },
  Practicing: { bg: '#FFF2D3', fg: '#946500', dot: '#FFD166', short: 'Practicing' },
  Completed: { bg: '#E2F6EE', fg: '#24795A', dot: '#7BD3B0', short: 'Done' }
};

/** Swatches offered for categories (brand palette first). */
export const CATEGORY_SWATCHES = ['#F78383', '#9D8DF1', '#FFB454', '#5FBFA0', '#6AA8F0', '#E58FC8', '#2B2A33', '#F2B53A'];

const str = (v) => (v === null || v === undefined ? '' : String(v));

export function normLearning(r = {}) {
  const type = LEARNING_TYPES.includes(r.type) ? r.type : '';
  const order = Number(r.order);
  return {
    id: str(r.id),
    type,
    parentId: str(r.parentId),
    order: Number.isFinite(order) ? order : 0,
    title: str(r.title),
    status: type === 'topic' ? (TOPIC_STATUSES.includes(r.status) ? r.status : 'Not Started') : '',
    color: str(r.color),
    url: str(r.url),
    resourceKind: type === 'resource' ? (RESOURCE_KINDS.includes(r.resourceKind) ? r.resourceKind : 'Link') : '',
    notes: str(r.notes),
    takeaways: str(r.takeaways),
    evidence: str(r.evidence),
    createdAt: str(r.createdAt),
    updatedAt: str(r.updatedAt),
    completedAt: str(r.completedAt),
    legacy: type ? null : r.legacy || {},
    _pending: Boolean(r._pending)
  };
}

/** Fields the sheet stores, in the shape Apps Script expects. */
export function learningPayload(l) {
  return {
    type: l.type,
    parentId: l.parentId,
    order: Number(l.order) || 0,
    title: l.title,
    status: l.status,
    color: l.color,
    url: l.url,
    resourceKind: l.resourceKind,
    notes: l.notes,
    takeaways: l.takeaways,
    evidence: l.evidence
  };
}

const byOrder = (a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt) || a.title.localeCompare(b.title);

export function childrenOf(items, parentId, type) {
  return items.filter((x) => x.parentId === parentId && (!type || x.type === type)).sort(byOrder);
}
export const categoriesOf = (items) => items.filter((x) => x.type === 'category').sort(byOrder);
export const nextOrder = (siblings) => (siblings.length ? Math.max(...siblings.map((s) => s.order)) + 1 : 1);

/** Every id under (and including) `id` — used to delete a whole branch. */
export function descendantIds(items, id) {
  const out = [id];
  for (let i = 0; i < out.length; i++) items.forEach((x) => x.parentId === out[i] && out.push(x.id));
  return out;
}

export function colorOf(cat) {
  return cat?.color || categoryColor(cat?.title || '');
}

/** Topic counts by status + % completed. */
export function summarize(topics) {
  const counts = Object.fromEntries(TOPIC_STATUSES.map((s) => [s, 0]));
  topics.forEach((t) => (counts[t.status] += 1));
  const total = topics.length;
  const done = counts.Completed;
  return { total, done, active: counts.Learning + counts.Practicing, counts, pct: total ? Math.round((done / total) * 100) : 0 };
}

export const topicsOfTech = (items, techId) => childrenOf(items, techId, 'topic');
export function topicsOfCategory(items, catId) {
  return childrenOf(items, catId, 'technology').flatMap((t) => topicsOfTech(items, t.id));
}

/** Guess the resource kind from a URL. */
export function detectKind(url) {
  const u = String(url || '').toLowerCase();
  if (!u) return 'Link';
  if (u.includes('github.com') || u.includes('gitlab.com') || u.includes('bitbucket.org')) return 'GitHub';
  if (/youtube\.com|youtu\.be|vimeo\.com|loom\.com/.test(u)) return 'Video';
  if (/udemy\.com|coursera\.org|frontendmasters|egghead|educative|pluralsight|scrimba/.test(u)) return 'Course';
  if (/docs\.google\.com|notion\.(so|site)|\.pdf($|\?)|confluence|drive\.google\.com|dropbox/.test(u)) return 'Document';
  return 'Link';
}

export function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** Adds https:// when a user types "github.com/…". */
export function normalizeUrl(url) {
  const u = String(url || '').trim();
  if (!u) return '';
  return /^[a-z][a-z0-9+.-]*:/i.test(u) ? u : `https://${u}`;
}
