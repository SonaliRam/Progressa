import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api, getApiUrl, saveConnection } from '../lib/api';
import { normTask, taskPayload } from '../lib/model';
import { DEFAULT_CATEGORIES, CATEGORY_SWATCHES, categoriesOf, childrenOf, descendantIds, learningPayload, nextOrder, normLearning } from '../lib/learning';

const DataContext = createContext(null);

const REFRESH_MS = 60000; // pick up edits made directly in the sheet
const NAV_REFRESH_MS = 15000; // re-check the sheet when you switch pages, at most this often

/**
 * One store for the whole app. Google Sheets is the source of truth:
 * - every page reads tasks/learning from here (no per-page copies),
 * - every change is shown immediately (optimistic) and saved through Apps Script,
 * - saves run one at a time, in the order you made them, so a later change can never be
 *   overwritten by an earlier one,
 * - background syncs never replace data while a save is still on its way.
 */
export function DataProvider({ children }) {
  const [tasks, setTasks] = useState([]);
  const [learning, setLearning] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [lastSync, setLastSync] = useState(null);
  const [apiUrl, setApiUrl] = useState(getApiUrl());
  const [toasts, setToasts] = useState([]);
  const [apiVersion, setApiVersion] = useState(0); // Code.gs version, from getAll
  const location = useLocation();

  // Refs hold the latest lists synchronously, so two quick changes in a row both see the newest data.
  const tasksRef = useRef(tasks);
  const learningRef = useRef(learning);
  const queue = useRef(Promise.resolve()); // serial write queue
  const pendingWrites = useRef(0); // writes queued or running
  const writeGen = useRef(0); // bumps on every write start/finish
  const pendingById = useRef({}); // record id -> writes still on their way
  const idMap = useRef({}); // temporary id -> real sheet id
  const lastSyncAt = useRef(0);
  const refreshRef = useRef(null);

  const commitTasks = useCallback((fn) => {
    const next = fn(tasksRef.current);
    tasksRef.current = next;
    setTasks(next);
  }, []);
  const commitLearning = useCallback((fn) => {
    const next = fn(learningRef.current);
    learningRef.current = next;
    setLearning(next);
  }, []);

  const toast = useCallback((message, type = 'success') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), type === 'error' ? 6000 : 3000);
  }, []);
  const dismissToast = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const resolveId = useCallback((id) => idMap.current[id] || id, []);

  /** Runs `job` after every earlier write has finished. */
  const enqueue = useCallback((job) => {
    pendingWrites.current += 1;
    writeGen.current += 1;
    const run = queue.current.then(() => job());
    queue.current = run.catch(() => {});
    return run.finally(() => {
      pendingWrites.current -= 1;
      writeGen.current += 1;
    });
  }, []);

  /** Re-read the sheet once all queued saves are done. */
  const resyncAfterWrites = useCallback(() => {
    queue.current.then(() => refreshRef.current?.({ silent: true }));
  }, []);

  const refresh = useCallback(
    async ({ silent = false } = {}) => {
      if (!getApiUrl()) {
        setLoaded(false);
        return;
      }
      if (!silent) setLoading(true);
      setSyncing(true);
      const gen = writeGen.current;
      try {
        const data = await api.getAll();
        if (pendingWrites.current === 0 && gen === writeGen.current) {
          commitTasks(() => (data?.Task || []).map(normTask));
          commitLearning(() => (data?.Learning || []).map(normLearning));
          setApiVersion(Number(data?.meta?.version) || 1);
          lastSyncAt.current = Date.now();
          setLastSync(new Date());
        } else {
          // A save happened while we were reading — this copy may be older. Read again after the saves.
          resyncAfterWrites();
        }
        setLoaded(true);
        setError('');
      } catch (e) {
        setError(e.message);
        if (!silent) toast(e.message, 'error');
      } finally {
        setSyncing(false);
        if (!silent) setLoading(false);
      }
    },
    [toast, commitTasks, commitLearning, resyncAfterWrites]
  );
  refreshRef.current = refresh;

  // Initial load + whenever the connection changes
  useEffect(() => {
    commitTasks(() => []);
    commitLearning(() => []);
    setLoaded(false);
    if (apiUrl) refresh();
  }, [apiUrl, refresh, commitTasks, commitLearning]);

  // Background sync: every minute while visible, and when the tab/app comes back into view
  useEffect(() => {
    if (!apiUrl) return undefined;
    const tick = () => {
      if (document.visibilityState === 'visible' && pendingWrites.current === 0) refresh({ silent: true });
    };
    const id = setInterval(tick, REFRESH_MS);
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', tick);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [apiUrl, refresh]);

  // Switching pages re-checks the sheet (throttled), so every page shows the latest saved data.
  useEffect(() => {
    if (!apiUrl || !lastSyncAt.current) return;
    if (Date.now() - lastSyncAt.current > NAV_REFRESH_MS && pendingWrites.current === 0) refresh({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const connect = useCallback(
    (url, key) => {
      saveConnection(url, key);
      const next = getApiUrl();
      if (next === apiUrl) {
        if (next) refresh();
      } else setApiUrl(next);
    },
    [apiUrl, refresh]
  );

  /** Optimistic create / update / delete, saved in order, re-synced with the sheet on failure. */
  const makeCrud = (sheet, commit, listRef, norm, payload, label) => ({
    async create(input, { quiet = false } = {}) {
      const now = new Date().toISOString();
      const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const temp = norm({ ...input, id: tempId, createdAt: now, updatedAt: now, _pending: true });
      commit((l) => [...l, temp]);
      try {
        // parentId may point at an item that was itself just created — use its real id by now.
        const saved = await enqueue(async () => {
          const res = await api.create(sheet, payload({ ...temp, parentId: temp.parentId && resolveId(temp.parentId) }));
          // Record the real id before the next queued save runs (it may be a child of this item).
          idMap.current[tempId] = res.id;
          return res;
        });
        commit((l) =>
          l.map((x) => (x.id === tempId ? norm(saved) : x.parentId === tempId ? { ...x, parentId: saved.id } : x))
        );
        if (!quiet) toast(`${label} added`);
        return saved;
      } catch (e) {
        commit((l) => l.filter((x) => x.id !== tempId));
        toast(`Couldn't add ${label.toLowerCase()}: ${e.message}`, 'error');
        resyncAfterWrites();
        throw e;
      }
    },
    async update(rawId, patch, { quiet = false } = {}) {
      const id = rawId;
      const cur = () => resolveId(id); // a just-created item gets its real id while we wait
      const prev = listRef.current.find((x) => x.id === cur());
      if (!prev) return null;
      const next = norm({ ...prev, ...patch, _pending: true });
      commit((l) => l.map((x) => (x.id === cur() ? next : x)));
      pendingById.current[id] = (pendingById.current[id] || 0) + 1;

      // Send only the fields that changed; Apps Script merges them into the row.
      const full = payload(next);
      const body = Object.fromEntries(Object.keys(full).filter((k) => k in patch).map((k) => [k, full[k]]));
      if (body.parentId) body.parentId = resolveId(body.parentId);
      try {
        const saved = await enqueue(() => api.update(sheet, cur(), Object.keys(body).length ? body : full));
        pendingById.current[id] -= 1;
        // Only take the server copy once no newer change for this record is still on its way.
        if (!pendingById.current[id]) commit((l) => l.map((x) => (x.id === cur() ? norm(saved) : x)));
        if (!quiet) toast(`${label} updated`);
        return saved;
      } catch (e) {
        pendingById.current[id] -= 1;
        if (!pendingById.current[id]) commit((l) => l.map((x) => (x.id === cur() ? { ...prev, _pending: false } : x)));
        toast(`Couldn't update ${label.toLowerCase()}: ${e.message}`, 'error');
        resyncAfterWrites();
        throw e;
      }
    },
    async remove(rawId) {
      const id = resolveId(rawId);
      const list = listRef.current;
      const index = list.findIndex((x) => x.id === id);
      if (index < 0) return;
      const prev = list[index];
      commit((l) => l.filter((x) => x.id !== id));
      try {
        await enqueue(() => api.remove(sheet, resolveId(id)));
        toast(`${label} deleted`);
      } catch (e) {
        commit((l) => {
          const copy = [...l];
          copy.splice(Math.min(index, copy.length), 0, { ...prev, _pending: false });
          return copy;
        });
        toast(`Couldn't delete ${label.toLowerCase()}: ${e.message}`, 'error');
        resyncAfterWrites();
        throw e;
      }
    }
  });

  const taskCrud = makeCrud('Task', commitTasks, tasksRef, normTask, taskPayload, 'Task');
  const learnCrud = makeCrud('Learning', commitLearning, learningRef, normLearning, learningPayload, 'Item');

  /* ---------------- Learning board helpers ---------------- */
  const LABEL = { category: 'Category', technology: 'Technology', topic: 'Topic', resource: 'Resource' };
  const learningReady = apiVersion >= 2;

  /** Several learning changes in one Apps Script request (ids resolved when it is sent). */
  const learningBatch = async (ops, successMsg) => {
    try {
      const res = await enqueue(() =>
        api.batch(
          ops.map((op) => ({
            sheet: 'Learning',
            action: op.action,
            id: op.id && resolveId(op.id),
            data: op.data && op.data.parentId ? { ...op.data, parentId: resolveId(op.data.parentId) } : op.data
          }))
        )
      );
      if (successMsg) toast(successMsg);
      return res;
    } catch (e) {
      toast(`Couldn't save: ${e.message}`, 'error');
      resyncAfterWrites();
      throw e;
    }
  };

  const addLearning = async (data, { quiet = false } = {}) => {
    const siblings = childrenOf(learningRef.current, data.parentId || '', data.type);
    const item = { order: nextOrder(siblings), ...data };
    if (item.type === 'topic' && item.status === 'Completed') item.completedAt = new Date().toISOString();
    const saved = await learnCrud.create(item, { quiet: true });
    if (!quiet) toast(`${LABEL[item.type] || 'Item'} added`);
    return saved;
  };

  const updateLearning = (id, patch, opts = {}) => {
    const cur = learningRef.current.find((x) => x.id === resolveId(id));
    const p = { ...patch };
    if (cur?.type === 'topic' && 'status' in p) p.completedAt = p.status === 'Completed' ? cur.completedAt || new Date().toISOString() : '';
    return learnCrud.update(id, p, { ...opts, quiet: opts.quiet ?? true });
  };

  /** Deletes an item and everything inside it (technologies, topics, resources). */
  const deleteLearning = async (id) => {
    const list = learningRef.current;
    const item = list.find((x) => x.id === resolveId(id));
    if (!item) return;
    const ids = descendantIds(list, item.id);
    const before = list;
    commitLearning((l) => l.filter((x) => !ids.includes(x.id)));
    try {
      await learningBatch(
        ids.map((x) => ({ action: 'delete', id: x })),
        ids.length > 1 ? `${LABEL[item.type]} and ${ids.length - 1} item${ids.length > 2 ? 's' : ''} inside deleted` : `${LABEL[item.type]} deleted`
      );
    } catch (e) {
      commitLearning(() => before);
      throw e;
    }
  };

  /** Saves a new order for siblings (ids in their new order). Only rows that moved are written. */
  const reorderLearning = async (orderedIds) => {
    const list = learningRef.current;
    const changes = [];
    orderedIds.forEach((id, i) => {
      const x = list.find((y) => y.id === id);
      if (x && x.order !== i + 1) changes.push({ id, order: i + 1 });
    });
    if (!changes.length) return;
    const before = list;
    commitLearning((l) => l.map((x) => {
      const c = changes.find((y) => y.id === x.id);
      return c ? { ...x, order: c.order } : x;
    }));
    try {
      await learningBatch(changes.map((c) => ({ action: 'update', id: c.id, data: { order: c.order } })));
    } catch (e) {
      commitLearning(() => before);
    }
  };

  /** Creates Frontend, Backend, Git, Server, Database, Shopify (skips names that already exist). */
  const seedDefaultCategories = async () => {
    const have = new Set(categoriesOf(learningRef.current).map((c) => c.title.toLowerCase()));
    const start = nextOrder(categoriesOf(learningRef.current));
    const todo = DEFAULT_CATEGORIES.filter((c) => !have.has(c.toLowerCase()));
    const created = await learningBatch(
      todo.map((title, i) => ({ action: 'create', data: { type: 'category', title, color: CATEGORY_SWATCHES[DEFAULT_CATEGORIES.indexOf(title)], order: start + i } })),
      'Categories added'
    );
    commitLearning((l) => [...l, ...created.map(normLearning)]);
  };

  /**
   * Turns rows from the old hours-based log into topics:
   * old Category → category, a "General" technology inside it, old Topic → topic.
   * Rows are converted in place (nothing is deleted); old Hours/Date columns are left as they are.
   */
  const importLegacy = async () => {
    const legacyRows = learningRef.current.filter((x) => !x.type);
    if (!legacyRows.length) return;
    const cats = [...categoriesOf(learningRef.current)];
    let catOrder = nextOrder(cats);
    const findCat = (name) => cats.find((c) => c.title.toLowerCase() === name.toLowerCase());
    for (const name of [...new Set(legacyRows.map((r) => String(r.legacy?.category || 'General').trim() || 'General'))]) {
      if (!findCat(name)) {
        const idx = DEFAULT_CATEGORIES.findIndex((d) => d.toLowerCase() === name.toLowerCase());
        const saved = await learnCrud.create({ type: 'category', title: name, color: CATEGORY_SWATCHES[idx >= 0 ? idx : cats.length % CATEGORY_SWATCHES.length], order: catOrder++ }, { quiet: true });
        cats.push(normLearning(saved));
      }
    }
    const techFor = {};
    for (const cat of cats) {
      const rows = legacyRows.filter((r) => (String(r.legacy?.category || 'General').trim() || 'General').toLowerCase() === cat.title.toLowerCase());
      if (!rows.length) continue;
      const existing = childrenOf(learningRef.current, cat.id, 'technology').find((t) => t.title === 'General');
      techFor[cat.id] = existing ? existing.id : (await learnCrud.create({ type: 'technology', parentId: cat.id, title: 'General', order: nextOrder(childrenOf(learningRef.current, cat.id, 'technology')) }, { quiet: true })).id;
    }
    const ops = legacyRows.map((r, i) => {
      const cat = findCat(String(r.legacy?.category || 'General').trim() || 'General');
      const progress = Number(r.legacy?.progress) || 0;
      const status = progress >= 100 ? 'Completed' : progress > 0 ? 'Learning' : 'Not Started';
      return { action: 'update', id: r.id, data: { type: 'topic', parentId: techFor[cat.id], title: String(r.legacy?.topic || '').trim() || 'Untitled topic', status, notes: r.notes, order: i + 1 } };
    });
    const saved = await learningBatch(ops, `${ops.length} old log${ops.length === 1 ? '' : 's'} imported as topics`);
    commitLearning((l) => l.map((x) => {
      const s = saved.find((y) => y.id === x.id);
      return s ? normLearning(s) : x;
    }));
  };

  const value = {
    tasks,
    learning,
    loaded,
    loading,
    syncing,
    error,
    lastSync,
    configured: Boolean(apiUrl),
    apiUrl,
    connect,
    refresh,
    resolveId,
    toast,
    toasts,
    dismissToast,
    addTask: taskCrud.create,
    updateTask: taskCrud.update,
    deleteTask: taskCrud.remove,
    learningReady,
    apiVersion,
    addLearning,
    updateLearning,
    deleteLearning,
    reorderLearning,
    seedDefaultCategories,
    importLegacy
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside <DataProvider>');
  return ctx;
}

/** Re-render every `ms` so "today", countdowns, etc. roll over at midnight. */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

export function useToday() {
  const now = useNow(30000);
  return useMemo(() => {
    const d = now;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, [now]);
}

/** True when the viewport is at most `px` wide (for compact chart labels). */
export function useIsNarrow(px = 640) {
  const query = `(max-width: ${px}px)`;
  const get = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false);
  const [narrow, setNarrow] = useState(get);
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia(query);
    const on = () => setNarrow(mq.matches);
    mq.addEventListener ? mq.addEventListener('change', on) : mq.addListener(on);
    return () => (mq.removeEventListener ? mq.removeEventListener('change', on) : mq.removeListener(on));
  }, [query]);
  return narrow;
}
