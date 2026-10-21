import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BookOpen } from 'lucide-react';
import { CATEGORIES, COLORS, categoryColor } from '../lib/constants';
import { startOfWeek } from '../lib/dates';
import { round1 } from '../lib/model';
import { useData, useIsNarrow, useToday } from '../context/DataContext';
import { EmptyState, Segmented } from './ui';

const METRICS = {
  hours: { label: 'Hours', unit: 'h', title: 'Learning hours' },
  progress: { label: 'Progress', unit: '%', title: 'Latest progress' },
  sessions: { label: 'Sessions', unit: '', title: 'Sessions logged' }
};

function Tip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <div className="chart-tip clay">
      <div className="chart-tip-title">
        <span className="dot" style={{ background: r.color }} /> {r.name}
      </div>
      <div className="chart-tip-row">
        Hours <b>{round1(r.hours)}h</b>
      </div>
      <div className="chart-tip-row">
        Sessions <b>{r.sessions}</b>
      </div>
      <div className="chart-tip-row">
        Latest progress <b>{r.progress}%</b>
      </div>
      <div className="chart-tip-row">
        Skill level <b>{r.skill || '—'}</b>
      </div>
      <div className="chart-tip-hint">Click to open this category</div>
    </div>
  );
}

export default function LearningChart() {
  const { learning, loaded } = useData();
  const today = useToday();
  const navigate = useNavigate();
  const narrow = useIsNarrow(640);
  const [metric, setMetric] = useState('hours');
  const [range, setRange] = useState('all');

  const { data, totalHours, sessions } = useMemo(() => {
    const from = range === 'week' ? startOfWeek(today) : range === 'month' ? `${today.slice(0, 7)}-01` : '';
    const inRange = learning.filter((l) => l.date && (!from || (l.date >= from && l.date <= today)));
    const cats = [...CATEGORIES, ...[...new Set(learning.map((l) => l.category))].filter((c) => !CATEGORIES.includes(c)).sort()];

    const rows = cats.map((cat) => {
      const ranged = inRange.filter((l) => l.category === cat);
      // Progress & skill = most recent entry for the category (all time)
      const latest = learning
        .filter((l) => l.category === cat)
        .sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt))[0];
      return {
        name: cat,
        color: categoryColor(cat),
        hours: round1(ranged.reduce((s, l) => s + l.hours, 0)),
        sessions: ranged.length,
        progress: latest ? latest.progress : 0,
        skill: latest?.skillLevel
      };
    });
    return {
      data: rows,
      totalHours: round1(inRange.reduce((s, l) => s + l.hours, 0)),
      sessions: inRange.length
    };
  }, [learning, range, today]);

  const top = [...data].sort((a, b) => b.hours - a.hours)[0];
  const m = METRICS[metric];
  const rangeLabel = range === 'week' ? 'this week' : range === 'month' ? 'this month' : 'all time';

  return (
    <section className="chart-card clay">
      <div className="chart-head">
        <div>
          <h3>Learning progress</h3>
          <p className="muted">
            <b className="c-purple">{totalHours}h</b> across {sessions} {sessions === 1 ? 'session' : 'sessions'} {rangeLabel}
            {top && top.hours > 0 && (
              <>
                {' '}
                · top: <b style={{ color: top.color }}>{top.name}</b>
              </>
            )}
          </p>
        </div>
        <Segmented
          size="sm"
          value={metric}
          onChange={setMetric}
          ariaLabel="Learning metric"
          options={Object.entries(METRICS).map(([value, v]) => ({ value, label: v.label }))}
        />
      </div>

      <div className="chart-sub">
        {metric === 'progress' ? (
          <span className="muted small">Latest recorded progress per category</span>
        ) : (
          <Segmented
            size="sm"
            value={range}
            onChange={setRange}
            ariaLabel="Date range"
            options={[
              { value: 'week', label: 'This week' },
              { value: 'month', label: 'This month' },
              { value: 'all', label: 'All time' }
            ]}
          />
        )}
      </div>

      <div className="chart-body">
        {!loaded || learning.length === 0 ? (
          <EmptyState
            icon={<BookOpen size={26} />}
            title={loaded ? 'No learning logged yet' : 'Waiting for data'}
            text={loaded ? 'Log a learning session and your hours appear here by category.' : 'Connect your Google Sheet in Settings to see live progress.'}
          />
        ) : (
          <ResponsiveContainer width="100%" height={270}>
            <BarChart data={data} margin={{ top: 22, right: 8, left: -18, bottom: 0 }} barCategoryGap="20%">
              <CartesianGrid vertical={false} stroke="rgba(43,42,51,0.07)" />
              <XAxis
                dataKey="name"
                tickLine={false}
                axisLine={false}
                interval={0}
                height={narrow ? 56 : 30}
                angle={narrow ? -38 : 0}
                textAnchor={narrow ? 'end' : 'middle'}
                tick={{ fontSize: narrow ? 10.5 : 11.5, fill: COLORS.muted, fontWeight: 600 }}
              />
              <YAxis
                allowDecimals={metric !== 'sessions'}
                domain={metric === 'progress' ? [0, 100] : [0, 'auto']}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: COLORS.muted }}
                tickFormatter={(v) => `${v}${m.unit}`}
              />
              <Tooltip content={<Tip />} cursor={{ fill: 'rgba(157,141,241,0.10)', radius: 12 }} />
              <Bar
                dataKey={metric}
                name={m.title}
                radius={[12, 12, 6, 6]}
                maxBarSize={48}
                cursor="pointer"
                onClick={(e) => navigate(`/learning?category=${encodeURIComponent(e?.payload?.name || e?.name)}`)}
                animationDuration={600}
              >
                {data.map((d) => (
                  <Cell key={d.name} fill={d.color} />
                ))}
                <LabelList
                  dataKey={metric}
                  position="top"
                  formatter={(v) => (v ? `${v}${m.unit}` : '')}
                  style={{ fontSize: 11, fontWeight: 700, fill: COLORS.charcoal }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
