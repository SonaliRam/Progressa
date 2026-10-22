import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Download, Eye, EyeOff, FolderPlus, GripVertical, Layers, Library, Pencil, Plus, Search, Sparkles, Target, Trash2, Trophy, Flame } from 'lucide-react';
import { useData } from '../context/DataContext';
import { DEFAULT_CATEGORIES, categoriesOf, childrenOf, colorOf, summarize, topicsOfCategory, topicsOfTech } from '../lib/learning';
import { startOfWeek, toKey } from '../lib/dates';
import { useToday } from '../context/DataContext';
import ConnectCard from '../components/ConnectCard';
import { EmptyState, PageHeader, Spinner, PageLoader } from '../components/ui';
import { Bar, MenuButton, QuickAdd } from '../components/learning/Bits';
import { useEditor } from '../components/learning/Editor';
import { SortableItem, SortableList, justDragged } from '../components/learning/Sortable';
import TopicCard from '../components/learning/TopicCard';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'In progress' },
  { value: 'todo', label: 'To learn' },
  { value: 'done', label: 'Completed' }
];
const matchesFilter = (t, f) =>
  f === 'all' || (f === 'active' && (t.status === 'Learning' || t.status === 'Practicing')) || (f === 'todo' && t.status === 'Not Started') || (f === 'done' && t.status === 'Completed');

/** Stops a click that ends a drag from also opening the tab/column. */
const guard = (fn) => (e) => !justDragged() && fn(e);

export default function Learning() {
  const { learning, configured, loaded, loading, learningReady, addLearning, reorderLearning, seedDefaultCategories, importLegacy } = useData();
  const { openEditor } = useEditor();
  const navigate = useNavigate();
  const today = useToday();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState({});
  const [busy, setBusy] = useState(false);

  const cats = useMemo(() => categoriesOf(learning), [learning]);
  const legacy = useMemo(() => learning.filter((x) => !x.type), [learning]);
  const activeId = cats.some((c) => c.id === params.get('cat')) ? params.get('cat') : cats[0]?.id;
  const active = cats.find((c) => c.id === activeId);
  const techs = useMemo(() => (active ? childrenOf(learning, active.id, 'technology') : []), [learning, active]);

  const overall = useMemo(() => {
    const topics = learning.filter((x) => x.type === 'topic');
    const s = summarize(topics);
    const weekStart = startOfWeek(today);
    const week = topics.filter((t) => t.status === 'Completed' && t.completedAt && toKey(new Date(t.completedAt)) >= weekStart).length;
    return { ...s, week, resources: learning.filter((x) => x.type === 'resource').length };
  }, [learning, today]);

  const setCat = (id) => {
    const next = new URLSearchParams(params);
    next.set('cat', id);
    setParams(next, { replace: true });
  };
  const toggle = (id) => setExpanded((e) => ({ ...e, [id]: !e[id] }));
  const term = q.trim().toLowerCase();
  const filtering = Boolean(term) || filter !== 'all';
  const visibleTopics = (techId) =>
    topicsOfTech(learning, techId).filter(
      (t) => matchesFilter(t, filter) && (!term || `${t.title} ${t.notes} ${t.takeaways} ${t.evidence}`.toLowerCase().includes(term))
    );

  const run = async (fn) => {
    setBusy(true);
    try {
      await fn();
    } catch {
      /* toast shown */
    } finally {
      setBusy(false);
    }
  };

  /* ---------- states before the board ---------- */
  let body = null;
  if (!configured) body = <ConnectCard />;
  else if (loading && !loaded)
    body = (
      <PageLoader />
    );
  else if (loaded && !learningReady) body = <UpgradeNotice />;
  else if (loaded && cats.length === 0)
    body = (
      <section className="card clay lboard-empty">
        <EmptyState
          icon={<Layers size={28} />}
          title="Build your learning board"
          text={`Start with ${DEFAULT_CATEGORIES.join(', ')} — then add technologies (React, Node.js, MySQL…) and the topics inside them.`}
          action={
            <div className="empty-actions">
              <button className="btn btn-primary" disabled={busy} onClick={() => run(seedDefaultCategories)}>
                {busy ? <Spinner size={16} /> : <Sparkles size={16} />} Add the 6 default categories
              </button>
              <button className="btn btn-soft" onClick={() => openEditor('category')}>
                <FolderPlus size={16} /> Create my own
              </button>
            </div>
          }
        />
      </section>
    );

  return (
    <div className="page learning-page">
      <PageHeader
        eyebrow="Learning tracker"
        title="Learning Board"
        subtitle="Category → technology → topics. Learn it, practise it, prove it, tick it off."
        actions={
          learningReady &&
          cats.length > 0 && (
            <>
              <button className="btn btn-soft" onClick={() => openEditor('category')}>
                <FolderPlus size={18} /> Category
              </button>
              <button className="btn btn-primary" onClick={() => (techs[0] ? openEditor('topic', { parentId: techs[0].id }) : openEditor('technology', { parentId: activeId }))}>
                <Plus size={18} /> {techs[0] ? 'Topic' : 'Technology'}
              </button>
            </>
          )
        }
      />

      {learningReady && legacy.length > 0 && (
        <section className="legacy-banner clay">
          <Download size={20} />
          <div className="grow">
            <strong>
              {legacy.length} entr{legacy.length === 1 ? 'y' : 'ies'} from your old learning log
            </strong>
            <p>Import them as topics (grouped under each category → “General”). Rows stay in your sheet; hours are no longer tracked.</p>
          </div>
          <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => run(importLegacy)}>
            {busy ? <Spinner size={14} /> : null} Import as topics
          </button>
        </section>
      )}

      {body || (
        <>
          <div className="lstats">
            <MiniStat icon={<Trophy size={18} />} tone="mint" value={`${overall.done}/${overall.total}`} label="Topics completed" sub={`${overall.pct}% overall`} />
            <MiniStat icon={<Flame size={18} />} tone="coral" value={overall.active} label="In progress" sub="Learning + practising" />
            <MiniStat icon={<Target size={18} />} tone="yellow" value={overall.week} label="Done this week" sub="Topics ticked off" />
            <MiniStat icon={<Library size={18} />} tone="purple" value={overall.resources} label="Resources saved" sub="Repos, docs & links" />
          </div>

          {/* Category tabs */}
          <nav className="cat-tabs" aria-label="Categories">
            <SortableList ids={cats.map((c) => c.id)} onReorder={reorderLearning} horizontal disabled={!learningReady}>
              {cats.map((c) => {
                const s = summarize(topicsOfCategory(learning, c.id));
                return (
                  <SortableItem key={c.id} id={c.id} disabled={c._pending}>
                    {({ ref, style, dragProps, isDragging }) => (
                      <button
                        ref={ref}
                        style={{ ...style, '--cat': colorOf(c) }}
                        {...dragProps}
                        className={`cat-tab ${c.id === activeId ? 'active' : ''} ${isDragging ? 'dragging' : ''}`}
                        onClick={guard(() => setCat(c.id))}
                        aria-current={c.id === activeId ? 'page' : undefined}
                      >
                        <span className="cat-tab-top">
                          <span className="cat-dot" />
                          <span className="cat-tab-name">{c.title}</span>
                          <span className="cat-tab-pct">{s.pct}%</span>
                        </span>
                        <Bar value={s.pct} color={colorOf(c)} height={5} />
                        <span className="cat-tab-sub">
                          {s.done}/{s.total} topics
                        </span>
                      </button>
                    )}
                  </SortableItem>
                );
              })}
            </SortableList>
            <button className="cat-tab cat-tab-add" onClick={() => openEditor('category')}>
              <Plus size={16} /> Category
            </button>
          </nav>

          {active && (
            <CategoryHeader
              cat={active}
              techs={techs}
              onEdit={() => openEditor('category', { item: active })}
              onAddTech={() => openEditor('technology', { parentId: active.id })}
            />
          )}

          {active && techs.length > 0 && (
            <div className="board-tools">
              <div className="search">
                <Search size={16} />
                <input className="input" placeholder="Search topics, notes, takeaways…" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <div className="seg seg-sm" role="tablist" aria-label="Filter topics">
                {FILTERS.map((f) => (
                  <button key={f.value} type="button" role="tab" aria-selected={filter === f.value} className={filter === f.value ? 'active' : ''} onClick={() => setFilter(f.value)}>
                    {f.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setExpanded((e) => (Object.values(e).some(Boolean) ? {} : Object.fromEntries(techs.flatMap((t) => topicsOfTech(learning, t.id)).map((t) => [t.id, true]))))}
              >
                {Object.values(expanded).some(Boolean) ? <EyeOff size={15} /> : <Eye size={15} />}
                {Object.values(expanded).some(Boolean) ? 'Collapse all' : 'Expand all'}
              </button>
            </div>
          )}

          {active && (
            <div className="board" style={{ '--cat': colorOf(active) }}>
              <SortableList ids={techs.map((t) => t.id)} onReorder={reorderLearning} horizontal disabled={!learningReady}>
                {techs.map((t) => (
                  <TechColumn
                    key={t.id}
                    tech={t}
                    topics={visibleTopics(t.id)}
                    allCount={topicsOfTech(learning, t.id).length}
                    filtering={filtering}
                    expanded={expanded}
                    onToggle={toggle}
                    onOpen={() => navigate(`/learning/tech/${t.id}`)}
                    onEdit={() => openEditor('technology', { item: t })}
                    onAddTopic={(title) => addLearning({ type: 'topic', parentId: t.id, title, status: 'Not Started' }).catch(() => {})}
                    onReorder={reorderLearning}
                    resources={childrenOf(learning, t.id, 'resource').length}
                    color={colorOf(active)}
                  />
                ))}
              </SortableList>
              <div className="tech-col tech-col-new">
                <QuickAdd
                  label={techs.length ? 'Add technology' : 'Add your first technology'}
                  placeholder="e.g. React, Node.js, Liquid…"
                  onAdd={(title) => addLearning({ type: 'technology', parentId: active.id, title }).catch(() => {})}
                />
                {techs.length === 0 && <p className="muted small">Technologies become columns. Topics go inside them.</p>}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MiniStat({ icon, value, label, sub, tone }) {
  return (
    <div className={`lstat clay tone-${tone}`}>
      <div className="stat-icon">{icon}</div>
      <div>
        <div className="lstat-value">{value}</div>
        <div className="lstat-label">{label}</div>
        <div className="lstat-sub">{sub}</div>
      </div>
    </div>
  );
}

function CategoryHeader({ cat, techs, onEdit, onAddTech }) {
  const { learning } = useData();
  const s = summarize(topicsOfCategory(learning, cat.id));
  return (
    <section className="cat-head clay" style={{ '--cat': colorOf(cat) }}>
      <div className="cat-head-main">
        <div className="cat-head-badge">{cat.title.slice(0, 2)}</div>
        <div className="grow">
          <h2>{cat.title}</h2>
          <p className="muted small">
            {techs.length} technolog{techs.length === 1 ? 'y' : 'ies'} · {s.total} topics · {s.active} in progress
            {cat.notes ? ` · ${cat.notes}` : ''}
          </p>
        </div>
        <div className="cat-head-actions">
          <button className="btn btn-soft btn-sm" onClick={onAddTech}>
            <Plus size={15} /> Technology
          </button>
          <MenuButton
            label={`Actions for ${cat.title}`}
            items={[
              { label: 'Edit category', icon: <Pencil size={14} />, onClick: onEdit },
              { label: 'Delete category…', icon: <Trash2 size={14} />, danger: true, onClick: onEdit } // opens the form: shows what else gets deleted
            ]}
          />
        </div>
      </div>
      <div className="cat-head-progress">
        <Bar value={s.pct} color={colorOf(cat)} height={12} />
        <strong>{s.pct}%</strong>
        <span className="muted small">
          {s.done}/{s.total} completed
        </span>
      </div>
    </section>
  );
}

function TechColumn({ tech, topics, allCount, filtering, expanded, onToggle, onOpen, onEdit, onAddTopic, onReorder, resources, color }) {
  const { learning, learningReady } = useData();
  const s = summarize(topicsOfTech(learning, tech.id));
  // Stays usable while saving; only a brand-new column (no sheet id yet) can't be dragged.
  const busy = false;
  return (
    <SortableItem id={tech.id} disabled={tech.id.startsWith('tmp-')}>
      {({ ref, style, dragProps, handleProps, isDragging }) => (
        <section ref={ref} style={style} className={`tech-col clay ${isDragging ? 'dragging' : ''} ${busy ? 'is-busy' : ''}`} aria-label={tech.title}>
          <header className="tech-col-head" {...dragProps}>
            <div className="tech-col-title">
              <span className="grip" {...handleProps} aria-label={`Reorder ${tech.title}`}>
                <GripVertical size={15} />
              </span>
              <button className="tech-name" onClick={guard(onOpen)} title="Open technology view">
                {tech.title}
              </button>
              <MenuButton
                small
                label={`Actions for ${tech.title}`}
                items={[
                  { label: 'Open technology view', icon: <ArrowRight size={14} />, onClick: onOpen },
                  { label: 'Edit', icon: <Pencil size={14} />, onClick: onEdit },
                  { label: 'Delete…', icon: <Trash2 size={14} />, danger: true, onClick: onEdit }
                ]}
              />
            </div>
            <div className="tech-col-progress">
              <Bar value={s.pct} color={color} height={7} />
              <span>{s.pct}%</span>
            </div>
            <div className="tech-col-meta">
              <span>
                {s.done}/{s.total} done
              </span>
              <button className="res-chip" onClick={guard(onOpen)}>
                <Library size={12} /> {resources} resource{resources === 1 ? '' : 's'}
              </button>
            </div>
          </header>

          <div className="tech-col-body">
            <SortableList ids={topics.map((t) => t.id)} onReorder={onReorder} disabled={filtering || !learningReady}>
              {topics.map((t) => (
                <TopicCard key={t.id} topic={t} expanded={Boolean(expanded[t.id])} onToggle={onToggle} sortDisabled={filtering} />
              ))}
            </SortableList>
            {topics.length === 0 && <p className="col-empty">{filtering && allCount ? 'No topics match.' : 'No topics yet.'}</p>}
          </div>
          <div className="tech-col-foot">
            <QuickAdd label="Add topic" placeholder="Topic name, then Enter" onAdd={onAddTopic} />
            <Link className="link-btn" to={`/learning/tech/${tech.id}`}>
              Open <ArrowRight size={13} />
            </Link>
          </div>
        </section>
      )}
    </SortableItem>
  );
}

function UpgradeNotice() {
  return (
    <section className="card clay upgrade-card">
      <h3>One step to switch on the new Learning board</h3>
      <p className="muted">
        The Learning tab now stores categories, technologies, topics and resources. Your Google Apps Script needs the updated <code>Code.gs</code> before the app can save
        this — until then nothing is written to your Learning sheet.
      </p>
      <ol className="steps">
        <li>
          Open your sheet → <b>Extensions → Apps Script</b>.
        </li>
        <li>
          Replace everything in <code>Code.gs</code> with the new <code>apps-script/Code.gs</code> from the project folder → <b>Save</b>.
        </li>
        <li>
          <b>Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy</b> (the URL stays the same).
        </li>
        <li>Come back here and press the refresh icon in the sidebar.</li>
      </ol>
    </section>
  );
}
