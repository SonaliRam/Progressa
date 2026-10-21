import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertOctagon, ArrowRight, BookOpen, CalendarCheck2, CheckCircle2, Clock3, Plus, Sun, Timer } from 'lucide-react';
import { categoryColor } from '../lib/constants';
import { addDays, fmtLong, relativeLabel, startOfWeek } from '../lib/dates';
import { dailyStatusFor, isOnDate, round1, sortTasks } from '../lib/model';
import { useData, useNow, useToday } from '../context/DataContext';
import Countdown from '../components/Countdown';
import TaskChart from '../components/TaskChart';
import LearningChart from '../components/LearningChart';
import TaskRow from '../components/TaskRow';
import TaskForm from '../components/TaskForm';
import LearningForm from '../components/LearningForm';
import ConnectCard from '../components/ConnectCard';
import { EmptyState, PageHeader, PriorityTag, Spinner } from '../components/ui';

function greeting(h) {
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function Stat({ icon, label, value, sub, tone }) {
  return (
    <div className={`stat clay tone-${tone}`}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const { tasks, learning, loaded, loading, configured } = useData();
  const today = useToday();
  const now = useNow(60000);
  const [taskForm, setTaskForm] = useState({ open: false, task: null });
  const [learnOpen, setLearnOpen] = useState(false);

  const s = useMemo(() => {
    const todays = sortTasks(tasks.filter((t) => isOnDate(t, today)), today);
    const todayDone = todays.filter((t) => dailyStatusFor(t, today) === 'Completed').length;
    const completed = tasks.filter((t) => t.status === 'Completed').length;
    const blocked = tasks.filter((t) => t.status === 'Blocked').length;
    const overdue = tasks.filter((t) => t.status !== 'Completed' && t.endDate < today).length;
    const weekStart = startOfWeek(today);
    const weekHours = round1(learning.filter((l) => l.date >= weekStart && l.date <= today).reduce((a, l) => a + l.hours, 0));
    const todayHours = round1(learning.filter((l) => l.date === today).reduce((a, l) => a + l.hours, 0));
    const upcoming = tasks
      .filter((t) => t.status !== 'Completed' && t.startDate > today && t.startDate <= addDays(today, 7))
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .slice(0, 5);
    const recent = [...learning].sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt)).slice(0, 4);
    return { todays, todayDone, completed, pending: tasks.length - completed, blocked, overdue, weekHours, todayHours, upcoming, recent };
  }, [tasks, learning, today]);

  const openTask = (task) => setTaskForm({ open: true, task });

  return (
    <div className="page">
      <PageHeader
        eyebrow={fmtLong(today)}
        title={`${greeting(now.getHours())} 👋`}
        subtitle={
          loaded
            ? s.todays.length
              ? `You have ${s.todays.length} task${s.todays.length > 1 ? 's' : ''} today — ${s.todayDone} done${s.todayHours ? ` · ${s.todayHours}h learned` : ''}.`
              : 'Nothing scheduled today. A great day to learn something new.'
            : 'Your tasks and learning, synced with Google Sheets.'
        }
        actions={
          <>
            <button className="btn btn-soft" onClick={() => setLearnOpen(true)} disabled={!configured}>
              <BookOpen size={18} /> Log learning
            </button>
            <button className="btn btn-primary" onClick={() => setTaskForm({ open: true, task: null })} disabled={!configured}>
              <Plus size={18} /> New task
            </button>
          </>
        }
      />

      {!configured && <ConnectCard />}

      <div className="hero-grid">
        <Countdown />
        <div className="stats-grid">
          <Stat
            tone="coral"
            icon={<Sun size={20} />}
            label="Today's tasks"
            value={loaded ? s.todays.length : '–'}
            sub={loaded ? `${s.todayDone} done · ${s.todays.length - s.todayDone} left` : ' '}
          />
          <Stat
            tone="mint"
            icon={<CheckCircle2 size={20} />}
            label="Completed"
            value={loaded ? s.completed : '–'}
            sub={loaded && tasks.length ? `${Math.round((s.completed / tasks.length) * 100)}% of all tasks` : ' '}
          />
          <Stat
            tone="yellow"
            icon={<Clock3 size={20} />}
            label="Pending"
            value={loaded ? s.pending : '–'}
            sub={loaded ? `${s.blocked} blocked${s.overdue ? ` · ${s.overdue} overdue` : ''}` : ' '}
          />
          <Stat
            tone="purple"
            icon={<Timer size={20} />}
            label="Learning this week"
            value={loaded ? `${s.weekHours}h` : '–'}
            sub={loaded ? `${s.todayHours}h today` : ' '}
          />
        </div>
      </div>

      <div className="split-grid">
        <section className="card clay">
          <div className="card-head">
            <h3>
              <CalendarCheck2 size={20} /> Today's tasks
            </h3>
            <Link className="link-btn" to={`/tasks?date=${today}`}>
              Open calendar <ArrowRight size={14} />
            </Link>
          </div>
          {loading && !loaded ? (
            <div className="center-pad">
              <Spinner size={22} />
            </div>
          ) : s.todays.length ? (
            <div className="task-list">
              {s.todays.map((t) => (
                <TaskRow key={t.id} task={t} dateKey={today} onOpen={openTask} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Sun size={26} />}
              title="No tasks for today"
              text={loaded ? 'Plan your day — add a task and it lands in your Task sheet.' : 'Connect your sheet to see today’s tasks.'}
              action={
                configured && (
                  <button className="btn btn-primary btn-sm" onClick={() => setTaskForm({ open: true, task: null })}>
                    <Plus size={16} /> Add a task for today
                  </button>
                )
              }
            />
          )}
          {s.overdue > 0 && (
            <Link to="/tasks?view=list" className="overdue-banner">
              <AlertOctagon size={16} /> {s.overdue} overdue task{s.overdue > 1 ? 's' : ''} need attention <ArrowRight size={14} />
            </Link>
          )}
        </section>

        <div className="side-stack">
          <section className="card clay">
            <div className="card-head">
              <h3>Coming up</h3>
              <span className="muted small">Next 7 days</span>
            </div>
            {s.upcoming.length ? (
              <ul className="mini-list">
                {s.upcoming.map((t) => (
                  <li key={t.id} onClick={() => openTask(t)}>
                    <span className="mini-date">{relativeLabel(t.startDate, today)}</span>
                    <span className="mini-title">{t.title}</span>
                    <PriorityTag priority={t.priority} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted small pad-y">Nothing scheduled in the next week.</p>
            )}
          </section>

          <section className="card clay">
            <div className="card-head">
              <h3>Recent learning</h3>
              <Link className="link-btn" to="/learning">
                All <ArrowRight size={14} />
              </Link>
            </div>
            {s.recent.length ? (
              <ul className="mini-list">
                {s.recent.map((l) => (
                  <li key={l.id}>
                    <span className="dot" style={{ background: categoryColor(l.category) }} />
                    <span className="mini-title">
                      {l.topic}
                      <em>
                        {l.category} · {relativeLabel(l.date, today)}
                      </em>
                    </span>
                    <b>{round1(l.hours)}h</b>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted small pad-y">No sessions logged yet.</p>
            )}
          </section>
        </div>
      </div>

      <div className="charts-grid">
        <TaskChart />
        <LearningChart />
      </div>

      <TaskForm open={taskForm.open} task={taskForm.task} defaultDate={today} onClose={() => setTaskForm({ open: false, task: null })} />
      <LearningForm open={learnOpen} onClose={() => setLearnOpen(false)} />
    </div>
  );
}
