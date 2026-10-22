import { Check, ChevronDown, FlaskConical, GripVertical, Lightbulb, Link2, Pencil, StickyNote } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { childrenOf } from '../../lib/learning';
import { ConfirmDelete } from '../ui';
import { RichText, TopicStatusMenu } from './Bits';
import { useEditor } from './Editor';
import ResourceList from './ResourceList';
import { SortableItem, justDragged } from './Sortable';

/**
 * Expandable topic card. Collapsed: checkbox, title, status, what's inside.
 * Expanded: notes, key takeaways, practical evidence and the topic's own (micro) resources.
 */
export default function TopicCard({ topic, expanded, onToggle, sortDisabled, showPath }) {
  const { learning, updateLearning, deleteLearning, learningReady } = useData();
  const { openEditor } = useEditor();
  const done = topic.status === 'Completed';
  // Stays usable while saving; only a brand-new topic (no sheet id yet) can't be dragged.
  const busy = false;
  const isNew = topic.id.startsWith('tmp-');
  const resources = childrenOf(learning, topic.id, 'resource');
  const takeaways = topic.takeaways
    .split('\n')
    .map((l) => l.replace(/^\s*[-•*]\s*/, '').trim())
    .filter(Boolean);
  const editable = learningReady;

  const setStatus = (status) => updateLearning(topic.id, { status }).catch(() => {});
  const toggleDone = () => setStatus(done ? (topic.evidence ? 'Practicing' : 'Learning') : 'Completed');

  return (
    <SortableItem id={topic.id} disabled={sortDisabled || !editable || isNew}>
      {({ ref, style, dragProps, handleProps, isDragging }) => (
        <article
          ref={ref}
          style={style}
          className={`topic-card ${done ? 'is-done' : ''} ${expanded ? 'is-open' : ''} ${isDragging ? 'dragging' : ''} ${busy ? 'is-busy' : ''}`}
          data-status={topic.status}
        >
          <div className="topic-head" {...dragProps} onClick={() => !justDragged() && onToggle(topic.id)}>
            <button
              type="button"
              className={`check ${done ? 'checked' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                toggleDone();
              }}
              disabled={!editable || busy}
              aria-label={done ? `Mark “${topic.title}” not completed` : `Mark “${topic.title}” completed`}
            >
              <Check size={15} strokeWidth={3} />
            </button>
            <div className="topic-main">
              {showPath && <div className="topic-path">{showPath}</div>}
              <div className="topic-title">{topic.title}</div>
              <div className="topic-meta">
                <TopicStatusMenu value={topic.status} onChange={setStatus} disabled={!editable || busy} size="sm" />
                {topic.notes && (
                  <span className="meta-ico" title="Has notes">
                    <StickyNote size={13} />
                  </span>
                )}
                {topic.takeaways && (
                  <span className="meta-ico" title={`${takeaways.length} key takeaway${takeaways.length === 1 ? '' : 's'}`}>
                    <Lightbulb size={13} /> {takeaways.length}
                  </span>
                )}
                {topic.evidence && (
                  <span className="meta-ico ev" title="Has practical evidence">
                    <FlaskConical size={13} />
                  </span>
                )}
                {resources.length > 0 && (
                  <span className="meta-ico" title={`${resources.length} resource${resources.length === 1 ? '' : 's'}`}>
                    <Link2 size={13} /> {resources.length}
                  </span>
                )}
              </div>
            </div>
            <div className="topic-side">
              {editable && !sortDisabled && (
                <span className="grip" {...handleProps} onClick={(e) => e.stopPropagation()} aria-label={`Reorder ${topic.title}`}>
                  <GripVertical size={15} />
                </span>
              )}
              <button
                type="button"
                className="topic-toggle"
                aria-expanded={expanded}
                aria-label={expanded ? 'Collapse topic' : 'Expand topic'}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle(topic.id);
                }}
              >
                <ChevronDown size={16} />
              </button>
            </div>
          </div>

          {expanded && (
            <div className="topic-body">
              <Section icon={<StickyNote size={14} />} title="Notes" empty="No notes yet." text={topic.notes} />
              <section className="tsec">
                <h5>
                  <Lightbulb size={14} /> Key takeaways
                </h5>
                {takeaways.length ? (
                  <ul className="takeaways">
                    {takeaways.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="tsec-empty">What clicked? Add one takeaway per line.</p>
                )}
              </section>
              <Section icon={<FlaskConical size={14} />} title="Practical evidence" empty="What did you build or practise to prove it?" text={topic.evidence} accent />
              <section className="tsec">
                <h5>
                  <Link2 size={14} /> Topic resources
                </h5>
                <ResourceList parentId={topic.id} variant="micro" />
              </section>
              {editable && (
                <div className="topic-actions">
                  <button type="button" className="btn btn-soft btn-sm" onClick={() => openEditor('topic', { item: topic })} disabled={busy}>
                    <Pencil size={14} /> Edit topic
                  </button>
                  <span className="grow" />
                  <ConfirmDelete onConfirm={() => deleteLearning(topic.id).catch(() => {})} disabled={busy} />
                </div>
              )}
            </div>
          )}
        </article>
      )}
    </SortableItem>
  );
}

function Section({ icon, title, text, empty, accent }) {
  return (
    <section className={`tsec ${accent ? 'tsec-accent' : ''}`}>
      <h5>
        {icon} {title}
      </h5>
      {text ? <RichText text={text} /> : <p className="tsec-empty">{empty}</p>}
    </section>
  );
}
