import { useCallback, useEffect, useMemo, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Highlight } from '@tiptap/extension-highlight';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import {
  Bold, Italic, Strikethrough, List, ListOrdered, Heading2, Highlighter, Table2,
  Undo2, Redo2, Save, Plus, Pencil, Trash2, CalendarDays, StickyNote, RefreshCw, X
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
  const { toast, configured } = useData();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

  const load = useCallback(async () => {
    if (!configured) { setLoading(false); return; }
    setLoading(true);
    try {
      setNotes((await api.listNotes()) || []);
    } catch (e) {
      toast(`Couldn't load notes: ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [configured, toast]);

  useEffect(() => { load(); }, [load]);

  const resetEditor = () => {
    setTitle(''); setDate(todayISO()); setColor('yellow'); setEditingId(null);
    editor?.commands.clearContent(); setIsEmpty(true);
  };

  const save = async () => {
    if (!editor) return;
    if (editor.isEmpty && !title.trim()) { toast('Write something before saving', 'error'); return; }
    const data = { title: title.trim() || plain(editor.getHTML()).slice(0, 40) || 'Untitled', date, color, content: editor.getHTML() };
    setSaving(true);
    try {
      if (editingId) {
        const saved = await api.updateNote(editingId, data);
        setNotes((n) => n.map((x) => (x.id === editingId ? saved : x)));
        toast('Note updated');
      } else {
        const saved = await api.createNote(data);
        setNotes((n) => [saved, ...n]);
        toast('Note saved');
      }
      resetEditor();
    } catch (e) {
      toast(`Couldn't save note: ${e.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (note) => {
    setOpenNote(null);
    setEditingId(note.id); setTitle(note.title); setDate(note.date || todayISO()); setColor(note.color || 'yellow');
    editor?.commands.setContent(note.content || ''); setIsEmpty(editor?.isEmpty ?? false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const remove = async (note) => {
    {
      try {
        await api.deleteNote(note.id);
        setNotes((n) => n.filter((x) => x.id !== note.id));
        setOpenNote(null);
        if (editingId === note.id) resetEditor();
        toast('Note deleted');
      } catch (e) {
        toast(`Couldn't delete note: ${e.message}`, 'error');
      }
    }
  };

  // Group notes date-wise, newest date first; inside a day, newest first.
  const groups = useMemo(() => {
    const sorted = [...notes].sort((a, b) =>
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
            <button className="icon-btn icon-btn-sm" onClick={load} title="Refresh" aria-label="Refresh"><RefreshCw size={14} /></button>
          </div>
          <div className="rn-board-list">
            {loading ? (
              <div className="rn-loading"><Spinner /> Loading notes…</div>
            ) : notes.length === 0 ? (
              <EmptyState icon={<StickyNote size={26} />} title="No notes yet" text="Saved notes will stick here." />
            ) : (
              groups.map(([d, list]) => (
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
              ))
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
