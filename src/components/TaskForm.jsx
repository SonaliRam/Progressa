import { useEffect, useState } from 'react';
import { PRIORITIES, TASK_STATUSES, STATUS_STYLE, PRIORITY_STYLE } from '../lib/constants';
import { diffDays, isValidKey, todayKey } from '../lib/dates';
import { useData } from '../context/DataContext';
import { ConfirmDelete, Field, Modal, Segmented, Spinner } from './ui';

const blank = (date) => ({
  title: '',
  description: '',
  startDate: date || todayKey(),
  endDate: date || todayKey(),
  status: 'In Progress',
  priority: 'Medium',
  notes: ''
});

export default function TaskForm({ open, onClose, task, defaultDate }) {
  const { addTask, updateTask, deleteTask } = useData();
  const editing = Boolean(task);
  const [form, setForm] = useState(blank(defaultDate));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(task ? { ...blank(), ...task } : blank(defaultDate));
    setErrors({});
    setSaving(false);
  }, [open, task, defaultDate]);

  const set = (k) => (e) => {
    const v = e?.target ? e.target.value : e;
    setForm((f) => {
      const next = { ...f, [k]: v };
      // keep the range valid while typing
      if (k === 'startDate' && isValidKey(v) && (!f.endDate || f.endDate < v)) next.endDate = v;
      return next;
    });
  };

  const validate = () => {
    const e = {};
    if (!form.title.trim()) e.title = 'Give the task a title';
    if (!isValidKey(form.startDate)) e.startDate = 'Pick a start date';
    if (!isValidKey(form.endDate)) e.endDate = 'Pick an end date';
    else if (form.endDate < form.startDate) e.endDate = 'End date must be on or after the start date';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    setSaving(true);
    const data = { ...form, title: form.title.trim() };
    try {
      if (editing) await updateTask(task.id, data);
      else await addTask(data);
      onClose();
    } catch {
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    try {
      await deleteTask(task.id);
      onClose();
    } catch {
      setSaving(false);
    }
  };

  const span = isValidKey(form.startDate) && isValidKey(form.endDate) ? diffDays(form.startDate, form.endDate) + 1 : 1;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit task' : 'New task'}
      footer={
        <>
          {editing && <ConfirmDelete onConfirm={remove} disabled={saving || task?._pending} />}
          <span className="grow" />
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="task-form" className="btn btn-primary" disabled={saving || task?._pending}>
            {saving && <Spinner size={16} />}
            {editing ? 'Save changes' : 'Add task'}
          </button>
        </>
      }
    >
      <form id="task-form" className="form-grid" onSubmit={submit} noValidate>
        <Field label="Title" error={errors.title} full>
          <input className="input" value={form.title} onChange={set('title')} placeholder="e.g. Build checkout page" maxLength={200} />
        </Field>

        <Field label="Start date" error={errors.startDate}>
          <input type="date" className="input" value={form.startDate} onChange={set('startDate')} />
        </Field>
        <Field
          label="End date"
          error={errors.endDate}
          hint={span > 1 ? `Multi-day task · ${span} days` : 'Same as start for a one-day task'}
        >
          <input type="date" className="input" value={form.endDate} min={form.startDate} onChange={set('endDate')} />
        </Field>

        <Field label="Priority" full>
          <Segmented
            value={form.priority}
            onChange={set('priority')}
            ariaLabel="Priority"
            options={PRIORITIES.map((p) => ({
              value: p,
              label: p,
              activeStyle: { background: PRIORITY_STYLE[p].bg, color: PRIORITY_STYLE[p].fg }
            }))}
          />
        </Field>

        <Field label="Status" full>
          <Segmented
            value={form.status}
            onChange={set('status')}
            ariaLabel="Status"
            options={TASK_STATUSES.map((s) => ({
              value: s,
              label: s,
              activeStyle: { background: STATUS_STYLE[s].bg, color: STATUS_STYLE[s].fg }
            }))}
          />
        </Field>

        <Field label="Description" full>
          <textarea className="input textarea" rows={2} value={form.description} onChange={set('description')} placeholder="What needs to be done?" />
        </Field>
        <Field label="Notes" full>
          <textarea className="input textarea" rows={3} value={form.notes} onChange={set('notes')} placeholder="Links, blockers, follow-ups…" />
        </Field>
      </form>
    </Modal>
  );
}
