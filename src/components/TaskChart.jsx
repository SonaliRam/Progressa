import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChevronLeft, ChevronRight, ListChecks } from 'lucide-react';
import { COLORS, PRIORITIES, STATUS_STYLE, TASK_STATUSES } from '../lib/constants';
import { addDays, fmt, parseKey, startOfWeek } from '../lib/dates';
import { dailyStatusFor, isOnDate } from '../lib/model';
import { useData, useToday } from '../context/DataContext';
import { EmptyState, Segmented } from './ui';

const SERIES = [
  { key: 'completed', label: 'Completed', color: COLORS.mint },
  { key: 'pending', label: 'Pending', color: COLORS.coral }
];

function ClayTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="chart-tip clay">
      <div className="chart-tip-title">{row.full || label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="chart-tip-row">
          <span className="dot" style={{ background: p.payload.fill || p.color }} />
          {p.name}
          <b>{p.value}</b>
        </div>
      ))}
      {row.hint && <div className="chart-tip-hint">{row.hint}</div>}
    </div>
  );
}

export default function TaskChart() {
  const { tasks, loaded } = useData();
  const today = useToday();
  const navigate = useNavigate();
  const [view, setView] = useState('week');
  const [weekOffset, setWeekOffset] = useState(0);
  const [hidden, setHidden] = useState({});

  const weekStart = addDays(startOfWeek(today), weekOffset * 7);

  const data = useMemo(() => {
    if (view === 'week') {
      return Array.from({ length: 7 }, (_, i) => {
        const key = addDays(weekStart, i);
        const active = tasks.filter((t) => isOnDate(t, key));
        const completed = active.filter((t) => dailyStatusFor(t, key) === 'Completed').length;
        return {
          name: fmt(key, { weekday: 'short' }),
          full: `${fmt(key, { weekday: 'long', day: 'numeric', month: 'short' })}${key === today ? ' · Today' : ''}`,
          key,
          completed,
          pending: active.length - completed,
          hint: 'Click to open this day'
        };
      });
    }
    if (view === 'priority') {
      return PRIORITIES.map((p) => {
        const list = tasks.filter((t) => t.priority === p);
        const completed = list.filter((t) => t.status === 'Completed').length;
        return { name: p, full: `${p} priority`, priority: p, completed, pending: list.length - completed, hint: 'Click to see these tasks' };
      });
    }
    return TASK_STATUSES.map((s) => ({
      name: s,
      full: s,
      status: s,
      count: tasks.filter((t) => t.status === s).length,
      fill: STATUS_STYLE[s].dot,
      hint: 'Click to see these tasks'
    }));
  }, [tasks, view, weekStart, today]);

  const totals = useMemo(() => {
    const completed = tasks.filter((t) => t.status === 'Completed').length;
    return { total: tasks.length, completed, pending: tasks.length - completed, rate: tasks.length ? Math.round((completed / tasks.length) * 100) : 0 };
  }, [tasks]);

  const onBarClick = (entry) => {
    const row = entry?.payload || entry;
    if (!row) return;
    if (row.key) navigate(`/tasks?date=${row.key}`);
    else if (row.priority) navigate(`/tasks?view=list&priority=${encodeURIComponent(row.priority)}`);
    else if (row.status) navigate(`/tasks?view=list&status=${encodeURIComponent(row.status)}`);
  };

  const weekLabel = `${fmt(weekStart, { day: 'numeric', month: 'short' })} – ${fmt(addDays(weekStart, 6), { day: 'numeric', month: 'short' })}`;
  const isStacked = view !== 'status';
  const weekEmpty = view === 'week' && data.every((d) => d.completed + d.pending === 0);

  return (
    <section className="chart-card clay">
      <div className="chart-head">
        <div>
          <h3>Task progress</h3>
          <p className="muted">
            <b className="c-mint">{totals.completed}</b> completed · <b className="c-coral">{totals.pending}</b> pending · {totals.rate}% done
          </p>
        </div>
        <Segmented
          size="sm"
          value={view}
          onChange={setView}
          ariaLabel="Task chart view"
          options={[
            { value: 'week', label: 'Week' },
            { value: 'priority', label: 'Priority' },
            { value: 'status', label: 'Status' }
          ]}
        />
      </div>

      <div className="chart-sub">
        {view === 'week' ? (
          <div className="week-nav">
            <button className="icon-btn icon-btn-sm" onClick={() => setWeekOffset((w) => w - 1)} aria-label="Previous week">
              <ChevronLeft size={16} />
            </button>
            <span>{weekOffset === 0 ? `This week · ${weekLabel}` : weekLabel}</span>
            <button className="icon-btn icon-btn-sm" onClick={() => setWeekOffset((w) => w + 1)} aria-label="Next week">
              <ChevronRight size={16} />
            </button>
            {weekOffset !== 0 && (
              <button className="link-btn" onClick={() => setWeekOffset(0)}>
                Today
              </button>
            )}
          </div>
        ) : (
          <span className="muted small">{view === 'priority' ? 'Completed vs pending by priority (all tasks)' : 'All tasks by current status'}</span>
        )}
        {isStacked && (
          <div className="legend">
            {SERIES.map((s) => (
              <button
                key={s.key}
                className={`legend-item ${hidden[s.key] ? 'off' : ''}`}
                onClick={() => setHidden((h) => ({ ...h, [s.key]: !h[s.key] }))}
                aria-pressed={!hidden[s.key]}
              >
                <span className="dot" style={{ background: s.color }} />
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="chart-body">
        {!loaded || totals.total === 0 ? (
          <EmptyState
            icon={<ListChecks size={26} />}
            title={loaded ? 'No tasks yet' : 'Waiting for data'}
            text={loaded ? 'Add your first task and this chart fills in automatically.' : 'Connect your Google Sheet in Settings to see live progress.'}
          />
        ) : (
          <>
            <ResponsiveContainer width="100%" height={270}>
              <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barCategoryGap="22%">
                <CartesianGrid vertical={false} stroke="rgba(43,42,51,0.07)" />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                  height={view === 'week' ? 42 : 30}
                  tick={({ x, y, payload }) => {
                    const row = data[payload.index] || {};
                    const isToday = view === 'week' && row.key === today;
                    const color = isToday ? COLORS.coralDeep : COLORS.muted;
                    const weight = isToday ? 700 : 500;
                    return view === 'week' ? (
                      <g>
                        <text x={x} y={y + 13} textAnchor="middle" fontSize={11.5} fontWeight={weight} fill={color}>
                          {payload.value}
                        </text>
                        <text x={x} y={y + 29} textAnchor="middle" fontSize={11.5} fontWeight={700} fill={isToday ? COLORS.coralDeep : COLORS.charcoal}>
                          {parseKey(row.key).getDate()}
                        </text>
                      </g>
                    ) : (
                      <text x={x} y={y + 14} textAnchor="middle" fontSize={12} fontWeight={500} fill={color}>
                        {payload.value}
                      </text>
                    );
                  }}
                />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: COLORS.muted }} />
                <Tooltip content={<ClayTooltip />} cursor={{ fill: 'rgba(247,131,131,0.08)', radius: 12 }} />
                {isStacked ? (
                  SERIES.map((s, i) =>
                    hidden[s.key] ? null : (
                      <Bar
                        key={s.key}
                        dataKey={s.key}
                        name={s.label}
                        stackId="a"
                        fill={s.color}
                        radius={i === SERIES.length - 1 || hidden.pending ? [10, 10, 4, 4] : [4, 4, 4, 4]}
                        maxBarSize={46}
                        cursor="pointer"
                        onClick={onBarClick}
                        animationDuration={600}
                      />
                    )
                  )
                ) : (
                  <Bar dataKey="count" name="Tasks" radius={[12, 12, 6, 6]} maxBarSize={64} cursor="pointer" onClick={onBarClick} animationDuration={600}>
                    {data.map((d) => (
                      <Cell key={d.name} fill={d.fill} />
                    ))}
                  </Bar>
                )}
              </BarChart>
            </ResponsiveContainer>
            {weekEmpty && <div className="chart-note">No tasks scheduled in this week.</div>}
          </>
        )}
      </div>
    </section>
  );
}
