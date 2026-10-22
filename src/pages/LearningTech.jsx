import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Library, ListChecks, Pencil, Plus } from 'lucide-react';
import { useData } from '../context/DataContext';
import { TOPIC_STATUSES, TOPIC_STATUS_STYLE, childrenOf, colorOf, summarize, topicsOfTech } from '../lib/learning';
import { EmptyState, Spinner, PageLoader } from '../components/ui';
import { ProgressRing, QuickAdd } from '../components/learning/Bits';
import { useEditor } from '../components/learning/Editor';
import ResourceList from '../components/learning/ResourceList';
import { SortableList } from '../components/learning/Sortable';
import TopicCard from '../components/learning/TopicCard';

/** Technology view: progress, macro resources, and every topic with full detail. */
export default function LearningTech() {
  const { id } = useParams();
  const { learning, loaded, loading, learningReady, addLearning, reorderLearning, resolveId } = useData();
  const { openEditor } = useEditor();
  const navigate = useNavigate();
  const [status, setStatus] = useState('All');
  const [expanded, setExpanded] = useState({});

  const realId = resolveId(id);
  const tech = learning.find((x) => x.id === realId && x.type === 'technology');
  const cat = tech && learning.find((x) => x.id === tech.parentId);
  const topics = useMemo(() => (tech ? topicsOfTech(learning, tech.id) : []), [learning, tech]);
  const s = summarize(topics);
  const shown = status === 'All' ? topics : topics.filter((t) => t.status === status);
  const resources = tech ? childrenOf(learning, tech.id, 'resource').length : 0;
  const color = colorOf(cat);

  if (!tech) {
    return (
      <div className="page">
        {loading && !loaded ? (
          <PageLoader />
        ) : (
          <EmptyState
            icon={<ListChecks size={26} />}
            title="Technology not found"
            text="It may have been deleted."
            action={
              <Link className="btn btn-primary btn-sm" to="/learning">
                Back to the board
              </Link>
            }
          />
        )}
      </div>
    );
  }

  const toggle = (tid) => setExpanded((e) => ({ ...e, [tid]: !e[tid] }));
  const allOpen = shown.length > 0 && shown.every((t) => expanded[t.id]);

  return (
    <div className="page tech-page" style={{ '--cat': color }}>
      <nav className="crumbs" aria-label="Breadcrumb">
        <button className="icon-btn icon-btn-sm" onClick={() => navigate(`/learning?cat=${cat?.id || ''}`)} aria-label="Back to the board">
          <ArrowLeft size={15} />
        </button>
        <Link to="/learning">Learning</Link>
        <ChevronRight size={14} />
        <Link to={`/learning?cat=${cat?.id || ''}`}>{cat?.title}</Link>
        <ChevronRight size={14} />
        <span>{tech.title}</span>
      </nav>

      <section className="tech-hero clay">
        <ProgressRing value={s.pct} color={color} label={`${s.done}/${s.total}`} size={104} stroke={11} />
        <div className="tech-hero-main">
          <div className="eyebrow" style={{ color }}>
            {cat?.title}
          </div>
          <h1>{tech.title}</h1>
          {tech.notes && <p className="tech-hero-desc">{tech.notes}</p>}
          <div className="status-chips">
            {TOPIC_STATUSES.map((st) => (
              <button
                key={st}
                type="button"
                className={`status-chip ${status === st ? 'active' : ''}`}
                style={{ '--st-bg': TOPIC_STATUS_STYLE[st].bg, '--st-fg': TOPIC_STATUS_STYLE[st].fg, '--st-dot': TOPIC_STATUS_STYLE[st].dot }}
                onClick={() => setStatus(status === st ? 'All' : st)}
                aria-pressed={status === st}
              >
                <span className="dot" />
                <b>{s.counts[st]}</b> {TOPIC_STATUS_STYLE[st].short}
              </button>
            ))}
            <a className="status-chip res-jump" href="#macro-resources">
              <Library size={13} /> <b>{resources}</b> resources
            </a>
          </div>
        </div>
        {learningReady && (
          <div className="tech-hero-actions">
            <button className="btn btn-soft btn-sm" onClick={() => openEditor('technology', { item: tech })}>
              <Pencil size={14} /> Edit
            </button>
          </div>
        )}
      </section>

      <div className="tech-grid">
        <section className="card clay tech-topics">
          <div className="card-head">
            <h3>
              <ListChecks size={20} /> Topics {status !== 'All' && <span className="muted small">· {status}</span>}
            </h3>
            <div className="card-head-actions">
              {shown.length > 0 && (
                <button className="btn btn-ghost btn-sm" onClick={() => setExpanded(allOpen ? {} : Object.fromEntries(shown.map((t) => [t.id, true])))}>
                  {allOpen ? 'Collapse all' : 'Expand all'}
                </button>
              )}
              {learningReady && (
                <button className="btn btn-primary btn-sm" onClick={() => openEditor('topic', { parentId: tech.id })}>
                  <Plus size={15} /> Topic
                </button>
              )}
            </div>
          </div>
          <div className="topic-stack">
            <SortableList ids={shown.map((t) => t.id)} onReorder={reorderLearning} disabled={status !== 'All' || !learningReady}>
              {shown.map((t) => (
                <TopicCard key={t.id} topic={t} expanded={Boolean(expanded[t.id])} onToggle={toggle} sortDisabled={status !== 'All'} />
              ))}
            </SortableList>
            {shown.length === 0 && <p className="col-empty">{topics.length ? `No ${status.toLowerCase()} topics.` : 'No topics yet — add the first thing you want to learn.'}</p>}
          </div>
          {learningReady && (
            <QuickAdd label="Add topic" placeholder="Topic name, then Enter" onAdd={(title) => addLearning({ type: 'topic', parentId: tech.id, title, status: 'Not Started' }).catch(() => {})} />
          )}
        </section>

        <aside className="card clay macro-card" id="macro-resources">
          <div className="card-head">
            <h3>
              <Library size={20} /> Macro resources
            </h3>
          </div>
          <p className="muted small macro-hint">Repos, master documents and reference links for all of {tech.title}.</p>
          <ResourceList parentId={tech.id} variant="macro" />
        </aside>
      </div>
    </div>
  );
}
