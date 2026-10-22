import { useState } from 'react';
import { CheckCircle2, Hourglass, RotateCcw, Save, ExternalLink, Link2, PlugZap, Unplug, XCircle } from 'lucide-react';
import { SHEET_URL } from '../lib/constants';
import { api, getApiKey, looksLikeGasUrl } from '../lib/api';
import { useData } from '../context/DataContext';
import { Field, PageHeader, Spinner } from '../components/ui';
import { COUNTDOWN_DEFAULTS, getCountdownSettings, saveCountdownSettings } from '../lib/countdown';


export default function Settings() {
  const { apiUrl, connect, configured, tasks, learning, lastSync, error, toast } = useData();
  const [cd, setCd] = useState(getCountdownSettings);
  const cdError = !cd.label.trim() ? 'Add a title' : !cd.targetDate ? 'Pick a target date' : cd.startDate && cd.startDate >= cd.targetDate ? 'Start date must be before the target date' : '';
  const saveCountdown = (e) => {
    e.preventDefault();
    if (cdError) return;
    saveCountdownSettings({ ...cd, label: cd.label.trim() });
    toast('Countdown updated');
  };
  const resetCountdown = () => {
    saveCountdownSettings(null);
    setCd({ ...COUNTDOWN_DEFAULTS });
    toast('Countdown reset');
  };
  const [url, setUrl] = useState(apiUrl);
  const [key, setKey] = useState(getApiKey());
  const [test, setTest] = useState({ state: 'idle', msg: '' });

  const runTest = async () => {
    if (!looksLikeGasUrl(url)) {
      setTest({ state: 'err', msg: 'That does not look like an Apps Script Web App URL (https://script.google.com/macros/s/…/exec).' });
      return false;
    }
    setTest({ state: 'busy', msg: 'Contacting Apps Script…' });
    try {
      await api.ping(url, key);
      setTest({ state: 'ok', msg: 'Connected! Apps Script answered correctly.' });
      return true;
    } catch (e) {
      setTest({ state: 'err', msg: e.message });
      return false;
    }
  };

  const save = async (e) => {
    e.preventDefault();
    if (await runTest()) connect(url, key);
  };

  return (
    <div className="page">
      <PageHeader eyebrow="Settings" title="Google Sheets connection" subtitle="Your data lives in the Task and Learning tabs of your Google Sheet." />

      <div className="settings-grid">
        <section className="card clay">
          <div className="card-head">
            <h3>
              <PlugZap size={20} /> Apps Script Web App
            </h3>
            <div className="card-head-actions">
              <a className="link-btn" href={SHEET_URL} target="_blank" rel="noreferrer">
                Open sheet <ExternalLink size={14} />
              </a>
              <span className={`conn-badge ${configured && !error ? 'on' : 'off'}`}>{configured ? (error ? 'Connection issue' : 'Connected') : 'Not connected'}</span>
            </div>
          </div>
          <form className="form-grid" onSubmit={save}>
            <Field label="Web App URL" hint="Deploy → Manage deployments → copy the URL ending in /exec" full>
              <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://script.google.com/macros/s/AKfy…/exec" spellCheck={false} />
            </Field>
            <Field label="API key (optional)" hint="Only if you set API_KEY in Code.gs" full>
              <input className="input" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Leave empty if not used" spellCheck={false} />
            </Field>
            {test.state !== 'idle' && (
              <div className={`test-msg test-${test.state} field-full`}>
                {test.state === 'busy' ? <Spinner size={16} /> : test.state === 'ok' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                {test.msg}
              </div>
            )}
            <div className="form-actions field-full">
              <button type="button" className="btn btn-soft" onClick={runTest} disabled={!url || test.state === 'busy'}>
                Test connection
              </button>
              <button type="submit" className="btn btn-primary" disabled={!url || test.state === 'busy'}>
                <Link2 size={16} /> Save &amp; connect
              </button>
              {configured && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    connect('', '');
                    setUrl('');
                    setKey('');
                    setTest({ state: 'idle', msg: '' });
                  }}
                >
                  <Unplug size={16} /> Disconnect
                </button>
              )}
            </div>
          </form>
          {configured && (
            <div className="sync-info">
              <div>
                <strong>{tasks.length}</strong> tasks
              </div>
              <div>
                <strong>{learning.length}</strong> learning logs
              </div>
              <div>
                Last sync <strong>{lastSync ? lastSync.toLocaleTimeString() : '—'}</strong>
              </div>
            </div>
          )}
          {error && <p className="field-error">{error}</p>}
        </section>

        <section className="card clay">
          <div className="card-head">
            <h3>
              <Hourglass size={20} /> Dashboard countdown
            </h3>
          </div>
          <form className="form-grid" onSubmit={saveCountdown}>
            <Field label="Countdown title" hint="Shown above the big number on the Dashboard" full>
              <input className="input" value={cd.label} maxLength={60} onChange={(e) => setCd({ ...cd, label: e.target.value })} placeholder="Appraisal countdown" />
            </Field>
            <Field label="Target date" hint="The day you are counting down to">
              <input className="input" type="date" value={cd.targetDate} onChange={(e) => setCd({ ...cd, targetDate: e.target.value })} />
            </Field>
            <Field label="Start date" hint="Used for the progress bar (Day X of Y)">
              <input className="input" type="date" value={cd.startDate} onChange={(e) => setCd({ ...cd, startDate: e.target.value })} />
            </Field>
            {cdError && <p className="field-error field-full">{cdError}</p>}
            <div className="form-actions field-full">
              <button type="submit" className="btn btn-primary" disabled={!!cdError}>
                <Save size={16} /> Save countdown
              </button>
              <button type="button" className="btn btn-ghost" onClick={resetCountdown}>
                <RotateCcw size={16} /> Reset to default
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
