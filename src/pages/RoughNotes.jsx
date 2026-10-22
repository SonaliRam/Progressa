import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Highlight } from '@tiptap/extension-highlight';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import {
  Bold, Italic, Strikethrough, List, ListOrdered, Heading2, Highlighter, Table2,
  Undo2, Redo2, Save, Plus, Pencil, Trash2, CalendarDays, StickyNote, RefreshCw, X, Pin, PinOff
} from 'lucide-react';
import { api } from '../lib/api';
import { useData } from '../context/DataContext';
import { EmptyState, Modal, PageHeader, Spinner } from '../components/ui';

const NOTE_COLORS = [
  { key: 'yellow', bg: '#fff2d3', edge: '#ffd166' },
  { key: 'pink', bg: '#ffe1e1', edge: '#f78383' },
  { key: 'purple', bg: '#eeeaff', edge: '#9d8df1' },
  { key: 'mint', bg: '#e2f6ee', edge: '#7bd3b0' },
  { key: 'peach', bg: '#ffe9dc', edge: '#ffb38a' }
];
const colorOf = (k) => NOTE_COLORS.find((c) => c.key === k) || NOTE_COLORS[0];

// Pinned notes stay at the top of the board (max 3). Sheets may return TRUE / "true".
const MAX_PINS = 3;
const isPinned = (n) => n?.pinned === true || String(n?.pinned).toLowerCase() === 'true';

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const prettyDate = (iso) => {
  if (!iso) return 'No date';
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const t = todayISO();
  if (iso === t) return 'Today';
  const yest = new Date(); yest.setDate(yest.getDate() - 1);
  if (dt.toDateString() === yest.toDateString()) return 'Yesterday';
  return dt.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
};
const timeOf = (iso) => (iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '');
const plain = (html) => {
  const el = document.createElement('div');
  el.innerHTML = (html || '').replace(/<\/(p|li|h[1-6]|td|th)>/g, ' $&');
  return (el.textContent || '').replace(/\s+/g, ' ').trim();
};

function ToolBtn({ on, active, title, children }) {
  return (
    <button type="button" className={`rn-tool ${active ? 'active' : ''}`} title={title} aria-label={title}
      onMouseDown={(e) => e.preventDefault()} onClick={on}>
      {children}
    </button>
  );
}

export default function RoughNotes() {
  const { toast, configured, syncedNotes, refresh, rememberNotes, notesSnapshot } = useData();
  // Start from the copy saved in this browser so the board appears instantly.
  // Notes already loaded by the app's main sync show instantly when you open this page.
  const [notes, setNotes] = useState(() => notesSnapshot() || []);
  const [loading, setLoading] = useState(() => !notesSnapshot());
  const [saving] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(todayISO());
  const [color, setColor] = useState('yellow');
  const [editingId, setEditingId] = useState(null);
  const [openNote, setOpenNote] = useState(null);
  const [isEmpty, setIsEmpty] = useState(true);

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Table.configure({ resizable: true }),
      TableRow, TableHeader, TableCell
    ],
    content: '',
    immediatelyRender: false,
    editorProps: { attributes: { class: 'rn-editor-body', 'data-placeholder': 'Start writing your note…' } },
    onUpdate: ({ editor: ed }) => setIsEmpty(ed.isEmpty)
  });

  // Optimistic saving: the board changes instantly, and saves run one at a time in the
  // background (in order), so a slow Google Sheets reply never blocks the screen.
  const queue = useRef(Promise.resolve());
  const pending = useRef(0);
  const idMap = useRef({}); // temporary id -> real sheet id
  const realId = (id) => idMap.current[id] || id;
  const enqueue = (job) => {
    pending.current += 1;
    const run = queue.current.then(job);
    queue.current = run.catch(() => {});
    return run.finally(() => { pending.current -= 1; });
  };

  // Notes come with the app's main sync (one Apps Script request for everything).
  // Fallback: ask for the Notes tab alone if the deployed script doesn't send notes yet.
  const load = useCallback(async ({ force = false } = {}) => {
    if (!configured) { setLoading(false); return; }
    if (pending.current > 0) return; // don't overwrite changes that are still saving
    const known = notesSnapshot();
    if (known && !force) { setLoading(false); return; } // already showing them
    if (!known) setLoading(true);
    try {
      const data = await refresh({ silent: true });
      if (Array.isArray(data?.Notes)) {
        if (pending.current === 0) setNotes(data.Notes);
        return;
      }
      const fresh = (await api.listNotes()) || [];
      if (pending.current === 0) setNotes(fresh);
    } catch (e) {
      toast(`Couldn't load notes: ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured, toast, refresh]);

  useEffect(() => { load(); }, [load]);

  // A background sync brought a fresh copy of the notes.
  useEffect(() => {
    if (!syncedNotes || pending.current > 0) return;
    setNotes(syncedNotes);
    setLoading(false);
  }, [syncedNotes]);

  // Remember what's on screen (minus notes not yet in the sheet) for the next visit.
  useEffect(() => {
    if (!loading) rememberNotes(notes.filter((x) => !String(x.id).startsWith('tmp-')));
  }, [notes, loading, rememberNotes]);

  const resetEditor = () => {
    setTitle(''); setDate(todayISO()); setColor('yellow'); setEditingId(null);
    editor?.commands.clearContent(); setIsEmpty(true);
  };

  const save = () => {
    if (!editor) return;
    if (editor.isEmpty && !title.trim()) { toast('Write something before saving', 'error'); return; }
    const data = { title: title.trim() || plain(editor.getHTML()).slice(0, 40) || 'Untitled', date, color, content: editor.getHTML() };
    const now = new Date().toISOString();

    if (editingId) {
      const id = realId(editingId);
      const prev = notes.find((x) => x.id === id);
      setNotes((n) => n.map((x) => (x.id === id ? { ...x, ...data, updatedAt: now } : x)));
      toast('Note updated');
      enqueue(() => api.updateNote(realId(id), data))
        .then((saved) => setNotes((n) => n.map((x) => (x.id === realId(id) ? { ...x, ...saved } : x))))
        .catch((e) => {
          if (prev) setNotes((n) => n.map((x) => (x.id === realId(id) ? prev : x)));
          toast(`Couldn't update note: ${e.message}`, 'error');
        });
    } else {
      const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setNotes((n) => [{ ...data, id: tempId, createdAt: now, updatedAt: now }, ...n]);
      toast('Note saved');
      enqueue(async () => {
        const saved = await api.createNote(data);
        idMap.current[tempId] = saved.id; // later edits / deletes / pins use the real id
        return saved;
      })
        .then((saved) => {
          setNotes((n) => n.map((x) => (x.id === tempId ? { ...x, ...saved, pinned: x.pinned } : x)));
          // If you already left this page, still remember the new note for your next visit.
          const memo = notesSnapshot();
          if (memo && !memo.some((x) => x.id === saved.id)) rememberNotes([saved, ...memo]);
        })
        .catch((e) => {
          setNotes((n) => n.filter((x) => x.id !== tempId));
          toast(`Couldn't save note: ${e.message}`, 'error');
        });
    }
    resetEditor();
  };

  const startEdit = (note) => {
    setOpenNote(null);
    setEditingId(note.id); setTitle(note.title); setDate(note.date || todayISO()); setColor(note.color || 'yellow');
    editor?.commands.setContent(note.content || ''); setIsEmpty(editor?.isEmpty ?? false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const remove = (note) => {
    const id = realId(note.id);
    const prev = notes.find((x) => x.id === id) || note;
    setNotes((n) => n.filter((x) => x.id !== id));
    setOpenNote(null);
    if (editingId === note.id || editingId === id) resetEditor();
    toast('Note deleted');
    enqueue(() => api.deleteNote(realId(id))).catch((e) => {
      setNotes((n) => (n.some((x) => x.id === prev.id) ? n : [prev, ...n]));
      toast(`Couldn't delete note: ${e.message}`, 'error');
    });
  };

  const togglePin = (note) => {
    const next = !isPinned(note);
    if (next && notes.filter(isPinned).length >= MAX_PINS) {
      toast(`You can pin up to ${MAX_PINS} notes. Unpin one first.`, 'error');
      return;
    }
    const id = realId(note.id);
    const setPin = (v) => {
      setNotes((n) => n.map((x) => (x.id === realId(id) ? { ...x, pinned: v } : x)));
      setOpenNote((o) => (o && realId(o.id) === realId(id) ? { ...o, pinned: v } : o));
    };
    setPin(next);
    toast(next ? 'Note pinned' : 'Note unpinned');
    enqueue(() => api.updateNote(realId(id), { pinned: next })).catch((e) => {
      setPin(!next);
      toast(`Couldn't update pin: ${e.message}`, 'error');
    });
  };

  // Pinned notes shown separately at the top, newest first.
  const pinned = useMemo(() => notes.filter(isPinned)
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || '')), [notes]);

  // Group the other notes date-wise, newest date first; inside a day, newest first.
  const groups = useMemo(() => {
    const sorted = notes.filter((n) => !isPinned(n)).sort((a, b) =>
      (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || ''));
    const map = new Map();
    sorted.forEach((n) => {
      const k = n.date || '';
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(n);
    });
    return [...map.entries()];
  }, [notes]);

  const [armed, setArmed] = useState(false);
  useEffect(() => { setArmed(false); }, [openNote]);

  return (
    <div className="page rn-page">
      <PageHeader eyebrow="Rough Notes" title="Jot It Down"
        subtitle="Write a note, save it, and it sticks to your board — grouped by date." />

      <div className="rn-layout">
        {/* ---------- writing area ---------- */}
        <section className="clay rn-writer">
          <div className="rn-writer-head">
            <input className="rn-title" placeholder="Note title" value={title}
              onChange={(e) => setTitle(e.target.value)} maxLength={120} />
            {editingId && <span className="tag tag-soft">Editing</span>}
          </div>

          <div className="rn-meta">
            <label className="rn-date">
              <CalendarDays size={16} />
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <div className="rn-swatches" role="radiogroup" aria-label="Note colour">
              {NOTE_COLORS.map((c) => (
                <button key={c.key} type="button" role="radio" aria-checked={color === c.key} title={c.key}
                  className={`rn-swatch ${color === c.key ? 'on' : ''}`}
                  style={{ background: c.bg, borderColor: c.edge }} onClick={() => setColor(c.key)} />
              ))}
            </div>
          </div>

          {editor && (
            <div className="rn-toolbar clay-inset">
              <ToolBtn title="Heading" active={editor.isActive('heading', { level: 2 })} on={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 size={17} /></ToolBtn>
              <ToolBtn title="Bold" active={editor.isActive('bold')} on={() => editor.chain().focus().toggleBold().run()}><Bold size={17} /></ToolBtn>
              <ToolBtn title="Italic" active={editor.isActive('italic')} on={() => editor.chain().focus().toggleItalic().run()}><Italic size={17} /></ToolBtn>
              <ToolBtn title="Strikethrough" active={editor.isActive('strike')} on={() => editor.chain().focus().toggleStrike().run()}><Strikethrough size={17} /></ToolBtn>
              <span className="rn-sep" />
              <ToolBtn title="Bullet list" active={editor.isActive('bulletList')} on={() => editor.chain().focus().toggleBulletList().run()}><List size={17} /></ToolBtn>
              <ToolBtn title="Numbered list" active={editor.isActive('orderedList')} on={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={17} /></ToolBtn>
              <ToolBtn title="Highlight" active={editor.isActive('highlight')} on={() => editor.chain().focus().toggleHighlight({ color: '#ffd166' }).run()}><Highlighter size={17} /></ToolBtn>
              <label className="rn-tool rn-color" title="Text colour">
                <span style={{ background: editor.getAttributes('textStyle').color || 'var(--ink)' }} />
                <input type="color" onChange={(e) => editor.chain().focus().setColor(e.target.value).run()} />
              </label>
              <ToolBtn title="Insert table" on={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><Table2 size={17} /></ToolBtn>
              <span className="rn-sep" />
              <ToolBtn title="Undo" on={() => editor.chain().focus().undo().run()}><Undo2 size={17} /></ToolBtn>
              <ToolBtn title="Redo" on={() => editor.chain().focus().redo().run()}><Redo2 size={17} /></ToolBtn>
            </div>
          )}

          <div className={`rn-editor ${isEmpty ? 'is-empty' : ''}`} onClick={() => editor?.commands.focus()}>
            <EditorContent editor={editor} />
          </div>

          <div className="rn-actions">
            {(editingId || !isEmpty || title) && (
              <button className="btn btn-ghost" onClick={resetEditor} disabled={saving}>
                {editingId ? <><X size={16} /> Cancel edit</> : <><Plus size={16} /> New note</>}
              </button>
            )}
            <button className="btn btn-primary" onClick={save} disabled={saving || !configured}>
              {saving ? <Spinner size={16} /> : <Save size={16} />}
              {editingId ? 'Update note' : 'Save note'}
            </button>
          </div>
          {!configured && <p className="muted rn-hint">Connect your Google Sheet in Settings to save notes.</p>}
        </section>

        {/* ---------- sticky-note column ---------- */}
        <aside className="rn-board">
          <div className="rn-board-head">
            <h3><StickyNote size={18} /> Saved notes <span className="rn-count">{notes.length}</span></h3>
            <button className="icon-btn icon-btn-sm" onClick={() => load({ force: true })} title="Refresh" aria-label="Refresh"><RefreshCw size={14} /></button>
          </div>
          <div className="rn-board-list">
            {loading ? (
              <div className="rn-loading"><Spinner /> Loading notes…</div>
            ) : notes.length === 0 ? (
              <EmptyState icon={<StickyNote size={26} />} title="No notes yet" text="Saved notes will stick here." />
            ) : (
              <>
              {pinned.length > 0 && (
                <div className="rn-day rn-pinned">
                  <div className="rn-day-label"><Pin size={13} /> Pinned ({pinned.length}/{MAX_PINS})</div>
                  {pinned.map((n, i) => {
                    const c = colorOf(n.color);
                    return (
                      <button key={n.id} type="button" className="rn-sticky is-pinned"
                        style={{ background: c.bg, '--edge': c.edge, '--tilt': `${i % 2 ? 0.8 : -0.8}deg` }}
                        onClick={() => setOpenNote(n)}>
                        <span className="rn-pin" />
                        <strong>{n.title || 'Untitled'}</strong>
                        <span className="rn-snippet">{plain(n.content) || '—'}</span>
                        <span className="rn-time">{prettyDate(n.date)}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              {groups.map(([d, list]) => (
                <div key={d} className="rn-day">
                  <div className="rn-day-label">{prettyDate(d)}</div>
                  {list.map((n, i) => {
                    const c = colorOf(n.color);
                    return (
                      <button key={n.id} type="button" className="rn-sticky"
                        style={{ background: c.bg, '--edge': c.edge, '--tilt': `${i % 2 ? 0.8 : -0.8}deg` }}
                        onClick={() => setOpenNote(n)}>
                        <span className="rn-pin" />
                        <strong>{n.title || 'Untitled'}</strong>
                        <span className="rn-snippet">{plain(n.content) || '—'}</span>
                        <span className="rn-time">{timeOf(n.createdAt)}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
              </>
            )}
          </div>
        </aside>
      </div>

      <Modal open={!!openNote} title={openNote?.title || 'Note'} onClose={() => setOpenNote(null)} width={720}
        footer={openNote && (
          <>
            <span className="muted rn-modal-date"><CalendarDays size={15} /> {prettyDate(openNote.date)}</span>
            <span style={{ flex: 1 }} />
            <button className={`btn btn-sm ${armed ? 'btn-danger' : 'btn-ghost'}`}
              onClick={() => (armed ? remove(openNote) : setArmed(true))}>
              <Trash2 size={15} /> {armed ? 'Click to confirm' : 'Delete'}
            </button>
            <button className="btn btn-sm btn-ghost" onClick={() => togglePin(openNote)}>
              {isPinned(openNote) ? <><PinOff size={15} /> Unpin</> : <><Pin size={15} /> Pin</>}
            </button>
            <button className="btn btn-sm btn-soft" onClick={() => startEdit(openNote)}><Pencil size={15} /> Edit</button>
          </>
        )}>
        {openNote && (
          <div className="rn-view" style={{ '--edge': colorOf(openNote.color).edge, background: colorOf(openNote.color).bg }}
            dangerouslySetInnerHTML={{ __html: openNote.content || '<p>(empty)</p>' }} />
        )}
      </Modal>
    </div>
  );
}
