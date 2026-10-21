import { ExternalLink, GripVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useData } from '../../context/DataContext';
import { RESOURCE_KINDS, childrenOf, hostOf } from '../../lib/learning';
import { KindIcon, MenuButton } from './Bits';
import { useEditor } from './Editor';
import { SortableItem, SortableList } from './Sortable';

/**
 * Resources attached to a technology (macro) or a topic (micro).
 * Drag to reorder, ⋯ to edit/delete, filter by type when there are several kinds.
 */
export default function ResourceList({ parentId, variant = 'micro', readOnly = false }) {
  const { learning, reorderLearning, deleteLearning, learningReady } = useData();
  const { openEditor } = useEditor();
  const [kind, setKind] = useState('All');
  const all = useMemo(() => childrenOf(learning, parentId, 'resource'), [learning, parentId]);
  const kinds = RESOURCE_KINDS.filter((k) => all.some((r) => r.resourceKind === k));
  const list = kind === 'All' ? all : all.filter((r) => r.resourceKind === kind);
  const canEdit = learningReady && !readOnly;

  return (
    <div className={`res-list res-${variant}`}>
      {variant === 'macro' && kinds.length > 1 && (
        <div className="res-filter" role="tablist" aria-label="Filter resources">
          {['All', ...kinds].map((k) => (
            <button key={k} type="button" role="tab" aria-selected={kind === k} className={kind === k ? 'active' : ''} onClick={() => setKind(k)}>
              {k === 'All' ? `All ${all.length}` : `${k} ${all.filter((r) => r.resourceKind === k).length}`}
            </button>
          ))}
        </div>
      )}

      {list.length === 0 && variant === 'macro' && (
        <p className="res-empty">Add the repos, master docs and reference links you keep coming back to for this technology.</p>
      )}

      <SortableList ids={list.map((r) => r.id)} onReorder={reorderLearning} disabled={!canEdit || kind !== 'All'}>
        {list.map((r) => (
          <SortableItem key={r.id} id={r.id} disabled={!canEdit || kind !== 'All' || r._pending}>
            {({ ref, style, dragProps, handleProps, isDragging }) => (
              <div ref={ref} style={style} className={`res-row ${isDragging ? 'dragging' : ''} ${r._pending ? 'is-busy' : ''}`} {...dragProps}>
                {canEdit && kind === 'All' && list.length > 1 && (
                  <span className="grip" {...handleProps} aria-label={`Reorder ${r.title}`}>
                    <GripVertical size={14} />
                  </span>
                )}
                <KindIcon kind={r.resourceKind} size={variant === 'macro' ? 16 : 14} />
                <div className="res-main">
                  {r.url ? (
                    <a href={r.url} target="_blank" rel="noreferrer" className="res-title" onClick={(e) => e.stopPropagation()}>
                      {r.title}
                      <ExternalLink size={12} />
                    </a>
                  ) : (
                    <span className="res-title">{r.title}</span>
                  )}
                  <span className="res-sub">
                    {r.resourceKind}
                    {r.url && hostOf(r.url) && ` · ${hostOf(r.url)}`}
                    {r.notes && ` · ${r.notes}`}
                  </span>
                </div>
                {canEdit && (
                  <MenuButton
                    small
                    label={`Actions for ${r.title}`}
                    items={[
                      { label: 'Edit', icon: <Pencil size={14} />, onClick: () => openEditor('resource', { item: r }) },
                      { label: 'Delete', icon: <Trash2 size={14} />, danger: true, onClick: () => deleteLearning(r.id).catch(() => {}) }
                    ]}
                  />
                )}
              </div>
            )}
          </SortableItem>
        ))}
      </SortableList>

      {canEdit && (
        <button type="button" className={`quick-add-btn ${variant === 'micro' ? 'qa-sm' : ''}`} onClick={() => openEditor('resource', { parentId })}>
          <Plus size={15} /> {variant === 'macro' ? 'Add macro resource' : 'Add resource'}
        </button>
      )}
    </div>
  );
}
