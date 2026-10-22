import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertOctagon, ArrowRight, BookOpen, CalendarCheck2, CheckCircle2, Clock3, Plus, Sun, Trophy } from 'lucide-react';
import { addDays, fmtLong, relativeLabel, startOfWeek, toKey } from '../lib/dates';
import { dailyStatusFor, isOnDate, sortTasks } from '../lib/model';
import { TOPIC_STATUS_STYLE, categoriesOf, colorOf, summarize } from '../lib/learning';
import { useEditor } from '../components/learning/Editor';
import { useData, useNow, useToday } from '../context/DataContext';
import Countdown from '../components/Countdown';
import TaskChart from '../components/TaskChart';
import LearningChart from '../components/LearningChart';
import TaskRow from '../components/TaskRow';
import TaskForm from '../components/TaskForm';
import ConnectCard from '../components/ConnectCard';
import { EmptyState, PageHeader, PriorityTag, Spinner } from '../components/ui';

function greeting(h) {
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
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
  const { tasks, learning, loaded, loading, configured, resolveId, learningReady } = useData();
  const { openEditor } = useEditor();
  const navigate = useNavigate();
  const today = useToday();
  const now = useNow(60000);
  const [taskForm, setTaskForm] = useState({ open: false, task: null });
  // The form always edits the latest copy of the task (falls back to the opened copy if it was just deleted)
  const liveTask = taskForm.task && (tasks.find((t) => t.id === resolveId(taskForm.task.id)) || taskForm.task);

  const s = useMemo(() => {
    const todays = sortTasks(tasks.filter((t) => isOnDate(t, today)), today);
    const todayDone = todays.filter((t) => dailyStatusFor(t, today) === 'Completed').length;
    const completed = tasks.filter((t) => t.status === 'Completed').length;
    const blocked = tasks.filter((t) => t.status === 'Blocked').length;
    const overdue = tasks.filter((t) => t.status !== 'Completed' && t.endDate < today).length;
    const weekStart = startOfWeek(today);
    // Learning: what you learn, practise and complete (no hours)
    const byId = Object.fromEntries(learning.map((x) => [x.id, x]));
    const topics = learning.filter((x) => x.type === 'topic' && byId[x.parentId]);
    const learn = summarize(topics);
    const doneToday = topics.filter((t) => t.status === 'Completed' && t.completedAt && toKey(new Date(t.completedAt)) === today).length;
    const doneWeek = topics.filter((t) => t.status === 'Completed' && t.completedAt && toKey(new Date(t.completedAt)) >= weekStart).length;
    const withPath = (t) => {
      const tech = byId[t.parentId];
      const cat = tech && byId[tech.parentId];
      return { ...t, tech, cat };
    };
    const focus = topics
      .filter((t) => t.status === 'Learning' || t.status === 'Practicing')
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 5)
      .map(withPath);
    const firstTech = categoriesOf(learning)
      .map((c) => learning.find((x) => x.type === 'technology' && x.parentId === c.id))
      .find(Boolean);
    const upcoming = tasks
      .filter((t) => t.status !== 'Completed' && t.startDate > today && t.startDate <= addDays(today, 7))
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .slice(0, 5);
    return { todays, todayDone, completed, pending: tasks.length - completed, blocked, overdue, upcoming, learn, doneToday, doneWeek, focus, firstTech };
  }, [tasks, learning, today]);

  const openTask = (task) => setTaskForm({ open: true, task });

  return (
    <div className="page">
      <PageHeader
        eyebrow={fmtLong(today)}
        title={`${greeting(now.getHours())}`}
        subtitle={
          loaded
            ? s.todays.length
              ? `You have ${s.todays.length} task${s.todays.length > 1 ? 's' : ''} today — ${s.todayDone} done${s.doneToday ? ` · ${s.doneToday} topic${s.doneToday > 1 ? 's' : ''} completed` : ''}.`
              : 'Nothing scheduled today. A great day to learn something new.'
            : 'Your tasks and learning, synced with Google Sheets.'
        }
        actions={
          <>
            <button
              className="btn btn-soft"
              onClick={() => (learningReady && s.firstTech ? openEditor('topic', { parentId: s.firstTech.id }) : navigate('/learning'))}
              disabled={!configured}
            >
              <BookOpen size={18} /> Add topic
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
            icon={<Trophy size={20} />}
            label="Topics completed"
            value={loaded ? `${s.learn.done}/${s.learn.total}` : '–'}
            sub={loaded ? `${s.doneWeek} this week · ${s.learn.active} in progress` : ' '}
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
              <h3>Learning focus</h3>
              <Link className="link-btn" to="/learning">
                Board <ArrowRight size={14} />
              </Link>
            </div>
            {s.focus.length ? (
              <ul className="mini-list">
                {s.focus.map((t) => (
                  <li key={t.id} onClick={() => navigate(`/learning/tech/${t.tech.id}`)}>
                    <span className="dot" style={{ background: colorOf(t.cat) }} />
                    <span className="mini-title">
                      {t.title}
                      <em>
                        {t.tech.title}
                        {t.cat ? ` · ${t.cat.title}` : ''}
                      </em>
                    </span>
                    <span className="pill pill-sm" style={{ background: TOPIC_STATUS_STYLE[t.status].bg, color: TOPIC_STATUS_STYLE[t.status].fg }}>
                      {t.status}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted small pad-y">
                Nothing in progress. Set a topic to <b>Learning</b> or <b>Practicing</b> on your board and it shows up here.
              </p>
            )}
          </section>
        </div>
      </div>

      <div className="charts-grid">
        <TaskChart />
        <LearningChart />
      </div>

      <TaskForm open={taskForm.open} task={liveTask} defaultDate={today} onClose={() => setTaskForm({ open: false, task: null })} />
    </div>
  );
}
