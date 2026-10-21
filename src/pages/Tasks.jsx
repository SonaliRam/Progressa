import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarDays, ChevronLeft, ChevronRight, List, Plus, Search, CalendarPlus } from 'lucide-react';
import { PRIORITIES, PRIORITY_STYLE, STATUS_STYLE, TASK_STATUSES } from '../lib/constants';
import { WEEKDAYS, fmt, fmtLong, isValidKey, monthGrid, monthLabel, parseKey, relativeLabel } from '../lib/dates';
import { dailyStatusFor, isOnDate, sortTasks } from '../lib/model';
import { useData, useToday } from '../context/DataContext';
import TaskRow from '../components/TaskRow';
import TaskForm from '../components/TaskForm';
import ConnectCard from '../components/ConnectCard';
import { EmptyState, PageHeader, PriorityTag, Segmented, StatusPill } from '../components/ui';

const MAX_CHIPS = 3;

function CalendarCell({ dateKey, inMonth, isToday, selected, tasks, onSelect, onAdd }) {
  const d = parseKey(dateKey);
  const dow = (d.getDay() + 6) % 7; // Mon=0
  const shown = tasks.slice(0, MAX_CHIPS);
  const more = tasks.length - shown.length;
  return (
    <div
      className={`cal-cell ${inMonth ? '' : 'out'} ${isToday ? 'today' : ''} ${selected ? 'selected' : ''}`}
      onClick={() => onSelect(dateKey)}
      onDoubleClick={() => onAdd(dateKey)}
      role="button"
      tabIndex={0}
      aria-label={`${fmtLong(dateKey)}, ${tasks.length} task${tasks.length === 1 ? '' : 's'}`}
      onKeyDown={(e) => e.key === 'Enter' && onSelect(dateKey)}
    >
      <div className="cal-cell-top">
        <span className="cal-num">{d.getDate()}</span>
        <button
          className="cal-add"
          onClick={(e) => {
            e.stopPropagation();
            onAdd(dateKey);
          }}
          aria-label={`Add task on ${fmt(dateKey)}`}
          title="Add task"
        >
          <Plus size={13} />
        </button>
      </div>
      <div className="cal-chips">
        {shown.map((t) => {
          const st = dailyStatusFor(t, dateKey);
          const contL = t.startDate < dateKey && dow !== 0;
          const contR = t.endDate > dateKey && dow !== 6;
          return (
            <div
              key={t.id}
              className={`cal-chip ${contL ? 'cont-l' : ''} ${contR ? 'cont-r' : ''} st-${st.replace(' ', '-').toLowerCase()}`}
              style={{ '--chip': PRIORITY_STYLE[t.priority].bar }}
              title={`${t.title} · ${st} · ${t.priority}`}
            >
              {t.title}
            </div>
          );
        })}
        {more > 0 && <div className="cal-more">+{more} more</div>}
      </div>
      {tasks.length > 0 && (
        <div className="cal-dots" aria-hidden="true">
          {tasks.slice(0, 4).map((t) => (
            <span key={t.id} style={{ background: STATUS_STYLE[dailyStatusFor(t, dateKey)].dot }} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Tasks() {
  const { tasks, configured, loaded, resolveId } = useData();
  const today = useToday();
  const [params, setParams] = useSearchParams();

  const view = params.get('view') === 'list' ? 'list' : 'calendar';
  const paramDate = params.get('date');
  const selected = isValidKey(paramDate) ? paramDate : today;

  const [cursor, setCursor] = useState(() => {
    const d = parseKey(selected);
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  useEffect(() => {
    const d = parseKey(selected);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
  }, [selected]);

  // Filters live in the URL so chart links (e.g. "Blocked") and refreshes keep them.
  const statusF = TASK_STATUSES.includes(params.get('status')) ? params.get('status') : 'All';
  const priorityF = PRIORITIES.includes(params.get('priority')) ? params.get('priority') : 'All';
  const [q, setQ] = useState('');

  const [form, setForm] = useState({ open: false, task: null, date: null });
  const liveTask = form.task && (tasks.find((t) => t.id === resolveId(form.task.id)) || form.task);

  const setParam = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next, { replace: true });
  };

  // Search + priority apply everywhere; the status filter is checked per day on the calendar
  // (a multi-day task can be Completed on Monday and In Progress on Tuesday) and on the
  // overall status in the list.
  const base = useMemo(() => {
    const term = q.trim().toLowerCase();
    return tasks.filter(
      (t) => (priorityF === 'All' || t.priority === priorityF) && (!term || `${t.title} ${t.description} ${t.notes}`.toLowerCase().includes(term))
    );
  }, [tasks, priorityF, q]);
  const filtered = useMemo(() => base.filter((t) => statusF === 'All' || t.status === statusF), [base, statusF]);
  const onDay = (list, k) => list.filter((t) => isOnDate(t, k) && (statusF === 'All' || dailyStatusFor(t, k) === statusF));

  const grid = useMemo(() => monthGrid(cursor.y, cursor.m), [cursor]);
  const byDay = useMemo(() => {
    const map = {};
    grid.forEach((k) => {
      map[k] = sortTasks(onDay(base, k), k);
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid, base, statusF]);

  const dayTasks = useMemo(
    () => sortTasks(onDay(base, selected), selected),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [base, selected, statusF]
  );

  const groups = useMemo(() => {
    const overdue = [];
    const active = [];
    const upcoming = [];
    const done = [];
    filtered.forEach((t) => {
      if (t.status === 'Completed') done.push(t);
      else if (t.endDate < today) overdue.push(t);
      else if (t.startDate <= today) active.push(t);
      else upcoming.push(t);
    });
    const byStart = (a, b) => a.startDate.localeCompare(b.startDate);
    return [
      { key: 'overdue', title: 'Overdue', items: overdue.sort(byStart), tone: 'coral' },
      { key: 'active', title: 'In progress now', items: sortTasks(active), tone: 'purple' },
      { key: 'upcoming', title: 'Upcoming', items: upcoming.sort(byStart), tone: 'yellow' },
      { key: 'done', title: 'Completed', items: done.sort((a, b) => b.endDate.localeCompare(a.endDate)), tone: 'mint' }
    ];
  }, [filtered, today]);

  const moveMonth = (delta) =>
    setCursor((c) => {
      const d = new Date(c.y, c.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

  const openNew = (date) => setForm({ open: true, task: null, date: date || selected });
  const openEdit = (task) => setForm({ open: true, task, date: null });

  const monthCount = useMemo(() => {
    const prefix = `${cursor.y}-${String(cursor.m + 1).padStart(2, '0')}`;
    const inMonth = filtered.filter((t) => t.startDate.slice(0, 7) <= prefix && t.endDate.slice(0, 7) >= prefix);
    return { total: inMonth.length, done: inMonth.filter((t) => t.status === 'Completed').length };
  }, [filtered, cursor]);

  const filters = (
    <div className="filters">
      <div className="search">
        <Search size={16} />
        <input className="input" placeholder="Search tasks…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <select className="input select" value={statusF} onChange={(e) => setParam({ status: e.target.value === 'All' ? '' : e.target.value })} aria-label="Filter by status">
        <option value="All">All statuses</option>
        {TASK_STATUSES.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>
      <select className="input select" value={priorityF} onChange={(e) => setParam({ priority: e.target.value === 'All' ? '' : e.target.value })} aria-label="Filter by priority">
        <option value="All">All priorities</option>
        {PRIORITIES.map((p) => (
          <option key={p}>{p}</option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="page">
      <PageHeader
        eyebrow="Task manager"
        title="Plan your days"
        subtitle="Schedule tasks on the calendar, track daily status and multi-day work."
        actions={
          <>
            <Segmented
              value={view}
              onChange={(v) => setParam({ view: v === 'list' ? 'list' : '' })}
              ariaLabel="View"
              options={[
                { value: 'calendar', label: 'Calendar', icon: <CalendarDays size={16} /> },
                { value: 'list', label: 'List', icon: <List size={16} /> }
              ]}
            />
            <button className="btn btn-primary" onClick={() => openNew()} disabled={!configured}>
              <Plus size={18} /> New task
            </button>
          </>
        }
      />

      {!configured && <ConnectCard />}

      {view === 'calendar' ? (
        <div className="cal-layout">
          <section className="card clay cal-card">
            <div className="cal-toolbar">
              <div className="cal-month">
                <button className="icon-btn" onClick={() => moveMonth(-1)} aria-label="Previous month">
                  <ChevronLeft size={18} />
                </button>
                <h3>{monthLabel(cursor.y, cursor.m)}</h3>
                <button className="icon-btn" onClick={() => moveMonth(1)} aria-label="Next month">
                  <ChevronRight size={18} />
                </button>
                <button className="btn btn-soft btn-sm" onClick={() => setParam({ date: today })}>
                  Today
                </button>
              </div>
              <span className="muted small">
                {monthCount.total} task{monthCount.total === 1 ? '' : 's'} this month · {monthCount.done} completed
              </span>
            </div>
            {filters}
            <div className="cal-grid" role="grid">
              {WEEKDAYS.map((w) => (
                <div key={w} className="cal-head">
                  {w}
                </div>
              ))}
              {grid.map((k) => (
                <CalendarCell
                  key={k}
                  dateKey={k}
                  inMonth={parseKey(k).getMonth() === cursor.m}
                  isToday={k === today}
                  selected={k === selected}
                  tasks={byDay[k] || []}
                  onSelect={(key) => setParam({ date: key })}
                  onAdd={openNew}
                />
              ))}
            </div>
            <p className="muted small cal-tip">Tip: double-click a day (or tap +) to add a task on that date.</p>
          </section>

          <section className="card clay day-panel">
            <div className="card-head">
              <div>
                <div className="eyebrow">{relativeLabel(selected, today)}</div>
                <h3>{fmtLong(selected)}</h3>
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => openNew(selected)} disabled={!configured}>
                <CalendarPlus size={16} /> Add
              </button>
            </div>
            {dayTasks.length ? (
              <>
                <div className="day-summary">
                  {TASK_STATUSES.map((s) => {
                    const n = dayTasks.filter((t) => dailyStatusFor(t, selected) === s).length;
                    return n ? (
                      <span key={s} className="day-count" style={{ color: STATUS_STYLE[s].fg, background: STATUS_STYLE[s].bg }}>
                        {n} {s}
                      </span>
                    ) : null;
                  })}
                </div>
                <div className="task-list">
                  {dayTasks.map((t) => (
                    <TaskRow key={t.id} task={t} dateKey={selected} onOpen={openEdit} showNote />
                  ))}
                </div>
              </>
            ) : (
              <EmptyState
                icon={<CalendarDays size={26} />}
                title="Free day"
                text={loaded ? 'No tasks on this date with the current filters.' : 'Connect your sheet to load tasks.'}
                action={
                  configured && (
                    <button className="btn btn-soft btn-sm" onClick={() => openNew(selected)}>
                      <Plus size={16} /> Plan a task
                    </button>
                  )
                }
              />
            )}
          </section>
        </div>
      ) : (
        <section className="card clay">
          {filters}
          {filtered.length === 0 ? (
            <EmptyState
              icon={<List size={26} />}
              title={tasks.length ? 'No tasks match these filters' : 'No tasks yet'}
              text={tasks.length ? 'Try clearing the search or filters.' : 'Create a task and it is saved to your Task sheet.'}
            />
          ) : (
            groups
              .filter((g) => g.items.length)
              .map((g) => (
                <div key={g.key} className="list-group">
                  <div className={`list-group-head tone-${g.tone}`}>
                    {g.title} <span>{g.items.length}</span>
                  </div>
                  <div className="list-rows">
                    {g.items.map((t) => (
                      <button key={t.id} className="list-row clay-soft" onClick={() => openEdit(t)}>
                        <span className="lr-bar" style={{ background: PRIORITY_STYLE[t.priority].bar }} />
                        <span className="lr-main">
                          <span className={`lr-title ${t.status === 'Completed' ? 'done' : ''}`}>{t.title}</span>
                          <span className="lr-sub">
                            {t.endDate !== t.startDate ? `${fmt(t.startDate)} → ${fmt(t.endDate)}` : fmt(t.startDate)}
                            {t.notes && ` · ${t.notes.slice(0, 80)}${t.notes.length > 80 ? '…' : ''}`}
                          </span>
                        </span>
                        <PriorityTag priority={t.priority} />
                        <StatusPill status={t.status} small />
                      </button>
                    ))}
                  </div>
                </div>
              ))
          )}
        </section>
      )}

      <TaskForm open={form.open} task={liveTask} defaultDate={form.date} onClose={() => setForm({ open: false, task: null, date: null })} />
    </div>
  );
}
