import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BookOpen, Flame, Plus, Search, Timer, TrendingUp, X } from 'lucide-react';
import { CATEGORIES, SKILL_LEVELS, categoryColor } from '../lib/constants';
import { addDays, fmt, fmtLong, relativeLabel, startOfWeek } from '../lib/dates';
import { round1 } from '../lib/model';
import { useData, useToday } from '../context/DataContext';
import LearningForm from '../components/LearningForm';
import ConnectCard from '../components/ConnectCard';
import { EmptyState, PageHeader, ProgressBar } from '../components/ui';

const LEVEL_INDEX = Object.fromEntries(SKILL_LEVELS.map((l, i) => [l, i]));
const latestFirst = (a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt);

function LevelMeter({ level }) {
  const idx = LEVEL_INDEX[level] ?? -1;
  return (
    <span className="level-meter" title={level || 'No level yet'}>
      {SKILL_LEVELS.map((l, i) => (
        <i key={l} className={i <= idx ? 'on' : ''} />
      ))}
    </span>
  );
}

export default function Learning() {
  const { learning, configured, loaded } = useData();
  const today = useToday();
  const [params, setParams] = useSearchParams();
  const activeCat = params.get('category') || '';
  const [q, setQ] = useState('');
  const [form, setForm] = useState({ open: false, entry: null });

  const setCat = (cat) => {
    const next = new URLSearchParams(params);
    if (cat) next.set('category', cat);
    else next.delete('category');
    setParams(next, { replace: true });
  };

  const cats = useMemo(
    () => [...CATEGORIES, ...[...new Set(learning.map((l) => l.category))].filter((c) => !CATEGORIES.includes(c)).sort()],
    [learning]
  );

  const catStats = useMemo(
    () =>
      cats.map((cat) => {
        const list = learning.filter((l) => l.category === cat);
        const latest = [...list].sort(latestFirst)[0];
        return {
          cat,
          color: categoryColor(cat),
          hours: round1(list.reduce((s, l) => s + l.hours, 0)),
          sessions: list.length,
          progress: latest?.progress ?? 0,
          level: latest?.skillLevel,
          lastDate: latest?.date
        };
      }),
    [cats, learning]
  );

  const summary = useMemo(() => {
    const byDay = {};
    learning.forEach((l) => {
      byDay[l.date] = (byDay[l.date] || 0) + l.hours;
    });
    const last14 = Array.from({ length: 14 }, (_, i) => {
      const k = addDays(today, i - 13);
      return { key: k, hours: round1(byDay[k] || 0) };
    });
    // streak: consecutive days with learning ending today (or yesterday if nothing yet today)
    let streak = 0;
    let k = byDay[today] ? today : addDays(today, -1);
    while (byDay[k] > 0) {
      streak += 1;
      k = addDays(k, -1);
    }
    const total = round1(learning.reduce((s, l) => s + l.hours, 0));
    const weekStart = startOfWeek(today);
    const week = round1(learning.filter((l) => l.date >= weekStart && l.date <= today).reduce((s, l) => s + l.hours, 0));
    const activeDays = Object.keys(byDay).filter((d) => byDay[d] > 0).length;
    return { last14, streak, total, week, avg: activeDays ? round1(total / activeDays) : 0, max14: Math.max(1, ...last14.map((d) => d.hours)) };
  }, [learning, today]);

  const entries = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = learning
      .filter((l) => (!activeCat || l.category === activeCat) && (!term || `${l.topic} ${l.notes} ${l.category}`.toLowerCase().includes(term)))
      .sort(latestFirst);
    const groups = [];
    list.forEach((l) => {
      const g = groups[groups.length - 1];
      if (g && g.date === l.date) g.items.push(l);
      else groups.push({ date: l.date, items: [l] });
    });
    return groups;
  }, [learning, activeCat, q]);

  return (
    <div className="page">
      <PageHeader
        eyebrow="Learning tracker"
        title="Grow your skills"
        subtitle="Log study sessions by category, track hours, progress and skill level."
        actions={
          <button className="btn btn-primary" onClick={() => setForm({ open: true, entry: null })} disabled={!configured}>
            <Plus size={18} /> Log learning
          </button>
        }
      />

      {!configured && <ConnectCard />}

      <div className="cat-grid">
        {catStats.map((c) => (
          <button
            key={c.cat}
            className={`cat-card clay ${activeCat === c.cat ? 'active' : ''}`}
            style={{ '--cat': c.color }}
            onClick={() => setCat(activeCat === c.cat ? '' : c.cat)}
            aria-pressed={activeCat === c.cat}
          >
            <div className="cat-card-top">
              <span className="cat-badge">{c.cat.slice(0, 2)}</span>
              <LevelMeter level={c.level} />
            </div>
            <div className="cat-name">{c.cat}</div>
            <div className="cat-hours">
              {c.hours}
              <small>h</small>
            </div>
            <div className="cat-meta">
              {c.sessions} session{c.sessions === 1 ? '' : 's'} · {c.level || 'Not started'}
            </div>
            <ProgressBar value={c.progress} color={c.color} height={8} />
            <div className="cat-foot">
              <span>{c.progress}% progress</span>
              <span>{c.lastDate ? relativeLabel(c.lastDate, today) : '—'}</span>
            </div>
          </button>
        ))}
      </div>

      <div className="learn-summary">
        <section className="card clay">
          <div className="card-head">
            <h3>Daily progress</h3>
            <span className="muted small">Hours per day · last 14 days</span>
          </div>
          <div className="day-bars">
            {summary.last14.map((d) => (
              <div key={d.key} className={`day-bar ${d.key === today ? 'is-today' : ''}`} title={`${fmtLong(d.key)} · ${d.hours}h`}>
                <span className="day-bar-val">{d.hours ? `${d.hours}h` : ''}</span>
                <div className="day-bar-track">
                  <div className="day-bar-fill" style={{ height: `${(d.hours / summary.max14) * 100}%` }} />
                </div>
                <span className="day-bar-label">{fmt(d.key, { weekday: 'narrow' })}</span>
              </div>
            ))}
          </div>
        </section>
        <div className="mini-stats">
          <div className="stat clay tone-purple">
            <div className="stat-icon">
              <Timer size={20} />
            </div>
            <div className="stat-value">{summary.total}h</div>
            <div className="stat-label">Total learned</div>
          </div>
          <div className="stat clay tone-coral">
            <div className="stat-icon">
              <Flame size={20} />
            </div>
            <div className="stat-value">{summary.streak}</div>
            <div className="stat-label">Day streak</div>
          </div>
          <div className="stat clay tone-yellow">
            <div className="stat-icon">
              <TrendingUp size={20} />
            </div>
            <div className="stat-value">{summary.week}h</div>
            <div className="stat-label">This week</div>
          </div>
          <div className="stat clay tone-mint">
            <div className="stat-icon">
              <BookOpen size={20} />
            </div>
            <div className="stat-value">{summary.avg}h</div>
            <div className="stat-label">Avg per active day</div>
          </div>
        </div>
      </div>

      <section className="card clay">
        <div className="card-head wrap">
          <h3>
            Learning log
            {activeCat && (
              <button className="filter-chip" style={{ '--cat': categoryColor(activeCat) }} onClick={() => setCat('')}>
                {activeCat} <X size={12} />
              </button>
            )}
          </h3>
          <div className="search">
            <Search size={16} />
            <input className="input" placeholder="Search topics or notes…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>

        {entries.length === 0 ? (
          <EmptyState
            icon={<BookOpen size={26} />}
            title={learning.length ? 'Nothing matches' : 'No sessions yet'}
            text={
              learning.length
                ? 'Try another category or search term.'
                : loaded
                  ? 'Log what you learned today — it is saved to your Learning sheet.'
                  : 'Connect your sheet to load your learning history.'
            }
            action={
              configured && (
                <button className="btn btn-soft btn-sm" onClick={() => setForm({ open: true, entry: null })}>
                  <Plus size={16} /> Log a session
                </button>
              )
            }
          />
        ) : (
          entries.map((g) => (
            <div key={g.date} className="list-group">
              <div className="list-group-head">
                {relativeLabel(g.date, today)} <em>{fmtLong(g.date)}</em>
                <span>{round1(g.items.reduce((s, l) => s + l.hours, 0))}h</span>
              </div>
              <div className="list-rows">
                {g.items.map((l) => (
                  <button
                    key={l.id}
                    className={`list-row clay-soft ${l._pending ? 'is-busy' : ''}`}
                    onClick={() => !l._pending && setForm({ open: true, entry: l })}
                  >
                    <span className="lr-bar" style={{ background: categoryColor(l.category) }} />
                    <span className="lr-main">
                      <span className="lr-title">{l.topic}</span>
                      <span className="lr-sub">
                        {l.category} · {l.skillLevel}
                        {l.notes && ` · ${l.notes.slice(0, 90)}${l.notes.length > 90 ? '…' : ''}`}
                      </span>
                    </span>
                    <span className="lr-progress">
                      <ProgressBar value={l.progress} color={categoryColor(l.category)} height={6} />
                      <small>{l.progress}%</small>
                    </span>
                    <span className="lr-hours">{round1(l.hours)}h</span>
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      <LearningForm open={form.open} entry={form.entry} defaultCategory={activeCat || undefined} onClose={() => setForm({ open: false, entry: null })} />
    </div>
  );
}
