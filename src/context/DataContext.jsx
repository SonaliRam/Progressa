import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, getApiUrl, saveConnection } from '../lib/api';
import { learningPayload, normLearning, normTask, taskPayload } from '../lib/model';

const DataContext = createContext(null);

const REFRESH_MS = 60000; // pick up edits made directly in the sheet

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

  const tasksRef = useRef(tasks);
  const learningRef = useRef(learning);
  tasksRef.current = tasks;
  learningRef.current = learning;
  const inFlight = useRef(0); // writes in progress — skip background refreshes meanwhile

  const toast = useCallback((message, type = 'success') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), type === 'error' ? 6000 : 3000);
  }, []);
  const dismissToast = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const refresh = useCallback(
    async ({ silent = false } = {}) => {
      if (!getApiUrl()) {
        setLoaded(false);
        return;
      }
      if (!silent) setLoading(true);
      setSyncing(true);
      try {
        const data = await api.getAll();
        if (inFlight.current === 0) {
          setTasks((data?.Task || []).map(normTask));
          setLearning((data?.Learning || []).map(normLearning));
        }
        setLoaded(true);
        setError('');
        setLastSync(new Date());
      } catch (e) {
        setError(e.message);
        if (!silent) toast(e.message, 'error');
      } finally {
        setSyncing(false);
        if (!silent) setLoading(false);
      }
    },
    [toast]
  );

  // Initial load + whenever the connection changes
  useEffect(() => {
    setTasks([]);
    setLearning([]);
    setLoaded(false);
    if (apiUrl) refresh();
  }, [apiUrl, refresh]);

  // Background sync: every minute while visible, and when the tab regains focus
  useEffect(() => {
    if (!apiUrl) return undefined;
    const tick = () => {
      if (document.visibilityState === 'visible' && inFlight.current === 0) refresh({ silent: true });
    };
    const id = setInterval(tick, REFRESH_MS);
    window.addEventListener('focus', tick);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', tick);
    };
  }, [apiUrl, refresh]);

  const connect = useCallback((url, key) => {
    saveConnection(url, key);
    setApiUrl(getApiUrl());
  }, []);

  /** Optimistic create / update / delete with rollback on failure. */
  const makeCrud = (sheet, setList, listRef, norm, payload, label) => ({
    async create(input) {
      const temp = norm({ ...input, id: `tmp-${Date.now()}`, _pending: true });
      setList((l) => [...l, temp]);
      inFlight.current += 1;
      try {
        const saved = await api.create(sheet, payload(temp));
        setList((l) => l.map((x) => (x.id === temp.id ? norm(saved) : x)));
        toast(`${label} added`);
        return saved;
      } catch (e) {
        setList((l) => l.filter((x) => x.id !== temp.id));
        toast(`Couldn't add ${label.toLowerCase()}: ${e.message}`, 'error');
        throw e;
      } finally {
        inFlight.current -= 1;
      }
    },
    async update(id, patch, { quiet = false } = {}) {
      const prev = listRef.current.find((x) => x.id === id);
      if (!prev) return null;
      const next = norm({ ...prev, ...patch, _pending: true });
      setList((l) => l.map((x) => (x.id === id ? next : x)));
      inFlight.current += 1;
      try {
        const saved = await api.update(sheet, id, payload(next));
        setList((l) => l.map((x) => (x.id === id ? norm(saved) : x)));
        if (!quiet) toast(`${label} updated`);
        return saved;
      } catch (e) {
        setList((l) => l.map((x) => (x.id === id ? prev : x)));
        toast(`Couldn't update ${label.toLowerCase()}: ${e.message}`, 'error');
        throw e;
      } finally {
        inFlight.current -= 1;
      }
    },
    async remove(id) {
      const list = listRef.current;
      const index = list.findIndex((x) => x.id === id);
      if (index < 0) return;
      const prev = list[index];
      setList((l) => l.filter((x) => x.id !== id));
      inFlight.current += 1;
      try {
        await api.remove(sheet, id);
        toast(`${label} deleted`);
      } catch (e) {
        setList((l) => {
          const copy = [...l];
          copy.splice(Math.min(index, copy.length), 0, prev);
          return copy;
        });
        toast(`Couldn't delete ${label.toLowerCase()}: ${e.message}`, 'error');
        throw e;
      } finally {
        inFlight.current -= 1;
      }
    }
  });

  const taskCrud = makeCrud('Task', setTasks, tasksRef, normTask, taskPayload, 'Task');
  const learnCrud = makeCrud('Learning', setLearning, learningRef, normLearning, learningPayload, 'Learning log');

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
    toast,
    toasts,
    dismissToast,
    addTask: taskCrud.create,
    updateTask: taskCrud.update,
    deleteTask: taskCrud.remove,
    addLearning: learnCrud.create,
    updateLearning: learnCrud.update,
    deleteLearning: learnCrud.remove
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
