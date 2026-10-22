import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useData } from '../../context/DataContext';
import {
  CATEGORY_SWATCHES,
  RESOURCE_KINDS,
  TOPIC_STATUSES,
  TOPIC_STATUS_STYLE,
  categoriesOf,
  childrenOf,
  colorOf,
  descendantIds,
  detectKind,
  hostOf,
  normalizeUrl
} from '../../lib/learning';
import { ConfirmDelete, Field, Modal, Segmented, Spinner } from '../ui';
import { KindIcon } from './Bits';

/**
 * One place that opens the add/edit forms for categories, technologies, topics and resources,
 * so the board, the technology view and the dashboard all behave the same.
 *   const { openEditor } = useEditor();
 *   openEditor('topic', { item })            // edit
 *   openEditor('topic', { parentId: techId }) // add
 */
const EditorContext = createContext(null);
export const useEditor = () => useContext(EditorContext);

export function EditorProvider({ children }) {
  const { learning, resolveId } = useData();
  const [state, setState] = useState({ kind: null, item: null, parentId: '' });
  const openEditor = useCallback((kind, { item = null, parentId = '' } = {}) => setState({ kind, item, parentId }), []);
  const close = useCallback(() => setState((s) => ({ ...s, kind: null })), []);
  // Always edit the latest saved copy (falls back to the opened copy while it is being deleted)
  const live = state.item ? learning.find((x) => x.id === resolveId(state.item.id)) || state.item : null;
  const props = { open: true, onClose: close, item: live, parentId: state.parentId };
  return (
    <EditorContext.Provider value={{ openEditor }}>
      {children}
      {state.kind === 'category' && <CategoryForm {...props} />}
      {state.kind === 'technology' && <TechForm {...props} />}
      {state.kind === 'topic' && <TopicForm {...props} />}
      {state.kind === 'resource' && <ResourceForm {...props} />}
    </EditorContext.Provider>
  );
}

/* ------------------------------------------------------------------ */

function useSave(onClose) {
  const [saving] = useState(false);
  // Optimistic: the board updates instantly and the save runs in the background,
  // so close right away instead of waiting for Google Sheets.
  const run = (fn) => {
    Promise.resolve().then(fn).catch(() => {});
    onClose();
  };
  return [saving, run];
}

function Footer({ editing, saving, onClose, onDelete, formId, addLabel, deleteLabel }) {
  return (
    <>
      {editing && <ConfirmDelete onConfirm={onDelete} disabled={saving} label={deleteLabel || 'Delete'} />}
      <span className="grow" />
      <button type="button" className="btn btn-ghost" onClick={onClose}>
        Cancel
      </button>
      <button type="submit" form={formId} className="btn btn-primary" disabled={saving}>
        {saving && <Spinner size={16} />}
        {editing ? 'Save changes' : addLabel}
      </button>
    </>
  );
}

/** "Also deletes 3 technologies, 12 topics, 5 resources" */
function useBranchCount(item) {
  const { learning } = useData();
  return useMemo(() => {
    if (!item) return '';
    const ids = descendantIds(learning, item.id).slice(1);
    if (!ids.length) return '';
    const n = { technology: 0, topic: 0, resource: 0 };
    ids.forEach((id) => {
      const x = learning.find((y) => y.id === id);
      if (x && n[x.type] !== undefined) n[x.type] += 1;
    });
    const words = { technology: ['technology', 'technologies'], topic: ['topic', 'topics'], resource: ['resource', 'resources'] };
    const parts = Object.entries(n)
      .filter(([, v]) => v)
      .map(([k, v]) => `${v} ${words[k][v === 1 ? 0 : 1]}`);
    return parts.length ? `Deleting also removes ${parts.join(', ')} inside it.` : '';
  }, [learning, item]);
}

/* ---------------- Category ---------------- */
function CategoryForm({ open, onClose, item }) {
  const { learning, addLearning, updateLearning, deleteLearning } = useData();
  const editing = Boolean(item);
  const [f, setF] = useState({ title: '', color: CATEGORY_SWATCHES[0], notes: '' });
  const [err, setErr] = useState('');
  const [saving, run] = useSave(onClose);
  const branch = useBranchCount(item);

  useEffect(() => {
    const used = categoriesOf(learning).map((c) => c.color);
    setF(item ? { title: item.title, color: colorOf(item), notes: item.notes } : { title: '', color: CATEGORY_SWATCHES.find((c) => !used.includes(c)) || CATEGORY_SWATCHES[0], notes: '' });
    setErr('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  const submit = (e) => {
    e.preventDefault();
    const title = f.title.trim();
    if (!title) return setErr('Name the category');
    const dup = categoriesOf(learning).find((c) => c.title.toLowerCase() === title.toLowerCase() && c.id !== item?.id);
    if (dup) return setErr(`“${dup.title}” already exists`);
    const data = { title, color: f.color, notes: f.notes.trim() };
    run(() => (editing ? updateLearning(item.id, data, { quiet: false }) : addLearning({ type: 'category', ...data })));
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit category' : 'New category'}
      width={520}
      footer={<Footer editing={editing} saving={saving} onClose={onClose} onDelete={() => run(() => deleteLearning(item.id))} formId="cat-form" addLabel="Add category" />}
    >
      <form id="cat-form" className="form-grid" onSubmit={submit} noValidate>
        <Field label="Name" error={err} full>
          <input className="input" value={f.title} maxLength={60} placeholder="e.g. DevOps, Mobile, AI" onChange={(e) => setF({ ...f, title: e.target.value })} />
        </Field>
        <Field label="Colour" full>
          <div className="swatches" role="radiogroup" aria-label="Colour">
            {CATEGORY_SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={f.color === c}
                aria-label={c}
                className={`swatch ${f.color === c ? 'active' : ''}`}
                style={{ '--sw': c }}
                onClick={() => setF({ ...f, color: c })}
              />
            ))}
          </div>
        </Field>
        <Field label="Description" hint="Optional — what this area covers or your goal for it" full>
          <textarea className="input textarea" rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
        {editing && branch && <p className="form-warn field-full">{branch}</p>}
      </form>
    </Modal>
  );
}

/* ---------------- Technology ---------------- */
function TechForm({ open, onClose, item, parentId }) {
  const { learning, addLearning, updateLearning, deleteLearning } = useData();
  const editing = Boolean(item);
  const cats = categoriesOf(learning);
  const [f, setF] = useState({ title: '', parentId: '', notes: '' });
  const [err, setErr] = useState('');
  const [saving, run] = useSave(onClose);
  const branch = useBranchCount(item);

  useEffect(() => {
    setF(item ? { title: item.title, parentId: item.parentId, notes: item.notes } : { title: '', parentId: parentId || cats[0]?.id || '', notes: '' });
    setErr('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id, parentId]);

  const submit = (e) => {
    e.preventDefault();
    const title = f.title.trim();
    if (!title) return setErr('Name the technology');
    if (!f.parentId) return setErr('Pick a category');
    const data = { title, notes: f.notes.trim() };
    if (editing) {
      if (f.parentId !== item.parentId) Object.assign(data, { parentId: f.parentId, order: childrenOf(learning, f.parentId, 'technology').length + 1 });
      run(() => updateLearning(item.id, data, { quiet: false }));
    } else run(() => addLearning({ type: 'technology', parentId: f.parentId, ...data }));
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit technology' : 'New technology'}
      width={540}
      footer={<Footer editing={editing} saving={saving} onClose={onClose} onDelete={() => run(() => deleteLearning(item.id))} formId="tech-form" addLabel="Add technology" />}
    >
      <form id="tech-form" className="form-grid" onSubmit={submit} noValidate>
        <Field label="Name" error={err} full>
          <input className="input" value={f.title} maxLength={80} placeholder="e.g. React, Node.js, Liquid, MySQL" onChange={(e) => setF({ ...f, title: e.target.value })} />
        </Field>
        <Field label="Category" full>
          <select className="input select" value={f.parentId} onChange={(e) => setF({ ...f, parentId: e.target.value })}>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Description / goal" hint="Optional — e.g. “Build and ship a full app with hooks + router”" full>
          <textarea className="input textarea" rows={3} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
        {editing && branch && <p className="form-warn field-full">{branch}</p>}
      </form>
    </Modal>
  );
}

/* ---------------- Topic ---------------- */
function TopicForm({ open, onClose, item, parentId }) {
  const { learning, addLearning, updateLearning, deleteLearning } = useData();
  const editing = Boolean(item);
  const cats = categoriesOf(learning);
  const [f, setF] = useState({ title: '', parentId: '', status: 'Not Started', notes: '', takeaways: '', evidence: '' });
  const [errs, setErrs] = useState({});
  const [saving, run] = useSave(onClose);
  const branch = useBranchCount(item);
  const firstTech = cats.map((c) => childrenOf(learning, c.id, 'technology')[0]).find(Boolean);

  useEffect(() => {
    setF(
      item
        ? { title: item.title, parentId: item.parentId, status: item.status, notes: item.notes, takeaways: item.takeaways, evidence: item.evidence }
        : { title: '', parentId: parentId || firstTech?.id || '', status: 'Not Started', notes: '', takeaways: '', evidence: '' }
    );
    setErrs({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id, parentId]);

  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e?.target ? e.target.value : e }));

  const submit = (e) => {
    e.preventDefault();
    const er = {};
    if (!f.title.trim()) er.title = 'What is the topic?';
    if (!f.parentId) er.parentId = 'Pick a technology';
    setErrs(er);
    if (Object.keys(er).length) return;
    const data = { title: f.title.trim(), status: f.status, notes: f.notes.trim(), takeaways: f.takeaways.trim(), evidence: f.evidence.trim() };
    if (editing) {
      if (f.parentId !== item.parentId) Object.assign(data, { parentId: f.parentId, order: childrenOf(learning, f.parentId, 'topic').length + 1 });
      run(() => updateLearning(item.id, data, { quiet: false }));
    } else run(() => addLearning({ type: 'topic', parentId: f.parentId, ...data }));
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit topic' : 'New topic'}
      width={640}
      footer={<Footer editing={editing} saving={saving} onClose={onClose} onDelete={() => run(() => deleteLearning(item.id))} formId="topic-form" addLabel="Add topic" />}
    >
      <form id="topic-form" className="form-grid" onSubmit={submit} noValidate>
        <Field label="Topic" error={errs.title} full>
          <input className="input" value={f.title} maxLength={200} placeholder="e.g. useEffect cleanup, Git rebase, Shopify sections" onChange={set('title')} />
        </Field>
        <Field label="Technology" error={errs.parentId} full>
          <select className="input select" value={f.parentId} onChange={set('parentId')}>
            {!f.parentId && <option value="">Choose…</option>}
            {cats.map((c) => (
              <optgroup key={c.id} label={c.title}>
                {childrenOf(learning, c.id, 'technology').map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>
        <Field label="Status" full>
          <Segmented
            value={f.status}
            onChange={set('status')}
            ariaLabel="Status"
            options={TOPIC_STATUSES.map((s) => ({ value: s, label: s, activeStyle: { background: TOPIC_STATUS_STYLE[s].bg, color: TOPIC_STATUS_STYLE[s].fg } }))}
          />
        </Field>
        <Field label="Notes" full>
          <textarea className="input textarea" rows={3} value={f.notes} onChange={set('notes')} placeholder="What you are learning, questions, links…" />
        </Field>
        <Field label="Key takeaways" hint="One per line — they show as a list" full>
          <textarea className="input textarea" rows={3} value={f.takeaways} onChange={set('takeaways')} placeholder={'Cleanup runs before the next effect\nDeps array controls re-runs'} />
        </Field>
        <Field label="Practical evidence" hint="What you built, practised or shipped — paste repo / demo / PR links" full>
          <textarea className="input textarea" rows={3} value={f.evidence} onChange={set('evidence')} placeholder="Built a debounced search: https://github.com/…" />
        </Field>
        {editing && branch && <p className="form-warn field-full">{branch}</p>}
      </form>
    </Modal>
  );
}

/* ---------------- Resource ---------------- */
function ResourceForm({ open, onClose, item, parentId }) {
  const { learning, addLearning, updateLearning, deleteLearning } = useData();
  const editing = Boolean(item);
  const [f, setF] = useState({ url: '', title: '', resourceKind: 'Link', notes: '' });
  const [kindTouched, setKindTouched] = useState(false);
  const [err, setErr] = useState('');
  const [saving, run] = useSave(onClose);
  const parent = learning.find((x) => x.id === (item?.parentId || parentId));

  useEffect(() => {
    setF(item ? { url: item.url, title: item.title === item.url ? '' : item.title, resourceKind: item.resourceKind, notes: item.notes } : { url: '', title: '', resourceKind: 'Link', notes: '' });
    setKindTouched(Boolean(item));
    setErr('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id, parentId]);

  const submit = (e) => {
    e.preventDefault();
    const url = normalizeUrl(f.url);
    if (!url && !f.title.trim()) return setErr('Paste a link or give it a name');
    const data = { url, title: f.title.trim() || hostOf(url) || url, resourceKind: f.resourceKind, notes: f.notes.trim() };
    run(() => (editing ? updateLearning(item.id, data, { quiet: false }) : addLearning({ type: 'resource', parentId, ...data })));
  };

  const scope = parent?.type === 'technology' ? `Macro resource · ${parent.title}` : parent ? `Topic resource · ${parent.title}` : 'Resource';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit resource' : 'Add resource'}
      width={540}
      footer={<Footer editing={editing} saving={saving} onClose={onClose} onDelete={() => run(() => deleteLearning(item.id))} formId="res-form" addLabel="Add resource" />}
    >
      <form id="res-form" className="form-grid" onSubmit={submit} noValidate>
        <p className="form-scope field-full">{scope}</p>
        <Field label="Link" error={err} full>
          <input
            className="input"
            value={f.url}
            inputMode="url"
            placeholder="https://github.com/… · docs · article · video"
            onChange={(e) => setF((x) => ({ ...x, url: e.target.value, resourceKind: kindTouched ? x.resourceKind : detectKind(e.target.value) }))}
          />
        </Field>
        <Field label="Name" hint="Optional — defaults to the website name" full>
          <input className="input" value={f.title} maxLength={140} placeholder="e.g. React docs — Effects" onChange={(e) => setF({ ...f, title: e.target.value })} />
        </Field>
        <Field label="Type" full>
          <div className="kind-picker">
            {RESOURCE_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                className={`kind-chip ${f.resourceKind === k ? 'active' : ''}`}
                onClick={() => {
                  setKindTouched(true);
                  setF({ ...f, resourceKind: k });
                }}
              >
                <KindIcon kind={k} size={14} /> {k}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Note" hint="Optional — why it is useful" full>
          <textarea className="input textarea" rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
      </form>
    </Modal>
  );
}
