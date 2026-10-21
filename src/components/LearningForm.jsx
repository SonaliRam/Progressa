import { useEffect, useMemo, useState } from 'react';
import { CATEGORIES, SKILL_LEVELS, categoryColor } from '../lib/constants';
import { isValidKey, todayKey } from '../lib/dates';
import { useData } from '../context/DataContext';
import { ConfirmDelete, Field, Modal, Segmented, Spinner } from './ui';

const blank = (category) => ({
  date: todayKey(),
  category: category || 'Frontend',
  topic: '',
  hours: '1',
  progress: 0,
  skillLevel: 'Beginner',
  notes: ''
});

export default function LearningForm({ open, onClose, entry, defaultCategory }) {
  const { learning, addLearning, updateLearning, deleteLearning } = useData();
  const editing = Boolean(entry);
  const [form, setForm] = useState(blank(defaultCategory));
  const [custom, setCustom] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Categories already used in the sheet beyond the default six
  const extraCats = useMemo(
    () => [...new Set(learning.map((l) => l.category))].filter((c) => c && !CATEGORIES.includes(c)).sort(),
    [learning]
  );

  // Latest record in a category — used to pre-fill skill level & progress
  const latestFor = (cat) =>
    learning
      .filter((l) => l.category === cat)
      .sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt))[0];

  useEffect(() => {
    if (!open) return;
    if (entry) {
      setForm({ ...blank(), ...entry, hours: String(entry.hours) });
    } else {
      const base = blank(defaultCategory);
      const last = latestFor(base.category);
      if (last) Object.assign(base, { skillLevel: last.skillLevel, progress: last.progress });
      setForm(base);
    }
    setCustom('');
    setErrors({});
    setSaving(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entry, defaultCategory]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  const pickCategory = (cat) => {
    setForm((f) => {
      const next = { ...f, category: cat };
      if (!editing && cat !== '__new') {
        const last = latestFor(cat);
        next.skillLevel = last ? last.skillLevel : 'Beginner';
        next.progress = last ? last.progress : 0;
      }
      return next;
    });
  };

  const validate = () => {
    const e = {};
    if (!isValidKey(form.date)) e.date = 'Pick a date';
    const h = Number(form.hours);
    if (!Number.isFinite(h) || h <= 0) e.hours = 'Enter hours greater than 0';
    else if (h > 24) e.hours = 'A day only has 24 hours';
    if (form.category === '__new' && !custom.trim()) e.category = 'Name the new category';
    if (!form.topic.trim()) e.topic = 'What did you learn?';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    setSaving(true);
    const data = {
      ...form,
      category: form.category === '__new' ? custom.trim() : form.category,
      topic: form.topic.trim(),
      hours: Math.round(Number(form.hours) * 100) / 100,
      progress: Number(form.progress)
    };
    try {
      if (editing) await updateLearning(entry.id, data);
      else await addLearning(data);
      onClose();
    } catch {
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    try {
      await deleteLearning(entry.id);
      onClose();
    } catch {
      setSaving(false);
    }
  };

  const catOptions = [...CATEGORIES, ...extraCats];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit learning log' : 'Log learning'}
      footer={
        <>
          {editing && <ConfirmDelete onConfirm={remove} disabled={saving || entry?._pending} />}
          <span className="grow" />
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="learning-form" className="btn btn-primary" disabled={saving || entry?._pending}>
            {saving && <Spinner size={16} />}
            {editing ? 'Save changes' : 'Save log'}
          </button>
        </>
      }
    >
      <form id="learning-form" className="form-grid" onSubmit={submit} noValidate>
        <Field label="Category" error={errors.category} full>
          <div className="cat-picker">
            {catOptions.map((c) => (
              <button
                type="button"
                key={c}
                className={`cat-chip ${form.category === c ? 'active' : ''}`}
                style={{ '--cat': categoryColor(c) }}
                onClick={() => pickCategory(c)}
              >
                <span className="dot" />
                {c}
              </button>
            ))}
            <button
              type="button"
              className={`cat-chip ${form.category === '__new' ? 'active' : ''}`}
              style={{ '--cat': '#B9B4C2' }}
              onClick={() => pickCategory('__new')}
            >
              + Other
            </button>
          </div>
          {form.category === '__new' && (
            <input className="input mt-8" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="New category name, e.g. DevOps" maxLength={40} />
          )}
        </Field>

        <Field label="Topic" error={errors.topic} full>
          <input className="input" value={form.topic} onChange={set('topic')} placeholder="e.g. React hooks, Git rebase, Liquid templates" maxLength={200} />
        </Field>

        <Field label="Date" error={errors.date}>
          <input type="date" className="input" value={form.date} onChange={set('date')} />
        </Field>
        <Field label="Hours spent" error={errors.hours} hint="Use decimals, e.g. 1.5">
          <input type="number" className="input" min="0.25" max="24" step="0.25" value={form.hours} onChange={set('hours')} />
        </Field>

        <Field label={`Progress on this topic · ${form.progress}%`} full>
          <input
            type="range"
            className="range"
            min="0"
            max="100"
            step="5"
            value={form.progress}
            onChange={set('progress')}
            style={{ '--val': `${form.progress}%` }}
          />
        </Field>

        <Field label="Skill level" full>
          <Segmented value={form.skillLevel} onChange={set('skillLevel')} ariaLabel="Skill level" options={SKILL_LEVELS.map((s) => ({ value: s, label: s }))} />
        </Field>

        <Field label="Notes" full>
          <textarea className="input textarea" rows={3} value={form.notes} onChange={set('notes')} placeholder="Key takeaways, resources, what to try next…" />
        </Field>
      </form>
    </Modal>
  );
}
