import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Layers } from 'lucide-react';
import { COLORS } from '../lib/constants';
import { TOPIC_STATUSES, TOPIC_STATUS_STYLE, categoriesOf, childrenOf, colorOf, summarize, topicsOfCategory } from '../lib/learning';
import { useData, useIsNarrow } from '../context/DataContext';
import { EmptyState, Segmented } from './ui';

function Tip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <div className="chart-tip clay">
      <div className="chart-tip-title">
        <span className="dot" style={{ background: r.color }} /> {r.name}
      </div>
      <div className="chart-tip-row">
        Completed <b>{r.pct}%</b>
      </div>
      {TOPIC_STATUSES.map((s) => (
        <div key={s} className="chart-tip-row">
          <span className="dot" style={{ background: TOPIC_STATUS_STYLE[s].dot }} />
          {s} <b>{r[s]}</b>
        </div>
      ))}
      <div className="chart-tip-row">
        Technologies <b>{r.techs}</b>
      </div>
      <div className="chart-tip-hint">Click to open this category</div>
    </div>
  );
}

/** Learning progress per category: % of topics completed, or topics by status. */
export default function LearningChart() {
  const { learning, loaded } = useData();
  const navigate = useNavigate();
  const narrow = useIsNarrow(640);
  const [view, setView] = useState('progress');

  const { data, totals } = useMemo(() => {
    const rows = categoriesOf(learning).map((c) => {
      const s = summarize(topicsOfCategory(learning, c.id));
      return { id: c.id, name: c.title, color: colorOf(c), pct: s.pct, total: s.total, techs: childrenOf(learning, c.id, 'technology').length, ...s.counts };
    });
    const all = summarize(learning.filter((x) => x.type === 'topic'));
    return { data: rows, totals: all };
  }, [learning]);

  const open = (e) => {
    const id = e?.payload?.id || e?.id;
    if (id) navigate(`/learning?cat=${id}`);
  };

  return (
    <section className="chart-card clay">
      <div className="chart-head">
        <div>
          <h3>Learning progress</h3>
          <p className="muted">
            <b className="c-mint">{totals.done}</b> of {totals.total} topics completed · <b className="c-purple">{totals.active}</b> in progress · {totals.pct}%
          </p>
        </div>
        <Segmented
          size="sm"
          value={view}
          onChange={setView}
          ariaLabel="Learning chart view"
          options={[
            { value: 'progress', label: 'Progress' },
            { value: 'status', label: 'Status' }
          ]}
        />
      </div>

      <div className="chart-sub">
        {view === 'progress' ? (
          <span className="muted small">% of topics completed in each category</span>
        ) : (
          <div className="legend">
            {TOPIC_STATUSES.map((s) => (
              <span key={s} className="legend-item">
                <span className="dot" style={{ background: TOPIC_STATUS_STYLE[s].dot }} />
                {s}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="chart-body">
        {!loaded || data.length === 0 ? (
          <EmptyState
            icon={<Layers size={26} />}
            title={loaded ? 'No learning board yet' : 'Waiting for data'}
            text={loaded ? 'Add categories, technologies and topics on the Learning page — progress shows up here.' : 'Connect your Google Sheet in Settings to see live progress.'}
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
                allowDecimals={false}
                domain={view === 'progress' ? [0, 100] : [0, 'auto']}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: COLORS.muted }}
                tickFormatter={(v) => (view === 'progress' ? `${v}%` : v)}
              />
              <Tooltip content={<Tip />} cursor={{ fill: 'rgba(157,141,241,0.10)', radius: 12 }} />
              {view === 'progress' ? (
                <Bar dataKey="pct" name="Completed" radius={[12, 12, 6, 6]} maxBarSize={48} cursor="pointer" onClick={open} animationDuration={600}>
                  {data.map((d) => (
                    <Cell key={d.id} fill={d.color} />
                  ))}
                  <LabelList dataKey="pct" position="top" formatter={(v) => `${v}%`} style={{ fontSize: 11, fontWeight: 700, fill: COLORS.charcoal }} />
                </Bar>
              ) : (
                [...TOPIC_STATUSES].reverse().map((s, i) => (
                  <Bar
                    key={s}
                    dataKey={s}
                    name={s}
                    stackId="t"
                    fill={TOPIC_STATUS_STYLE[s].dot}
                    radius={i === TOPIC_STATUSES.length - 1 ? [10, 10, 4, 4] : [0, 0, 0, 0]}
                    maxBarSize={46}
                    cursor="pointer"
                    onClick={open}
                    animationDuration={600}
                  />
                ))
              )}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
