import { useState } from 'react';
import { CheckCircle2, ExternalLink, Link2, PlugZap, Unplug, XCircle } from 'lucide-react';
import { SHEET_URL } from '../lib/constants';
import { api, getApiKey, looksLikeGasUrl } from '../lib/api';
import { useData } from '../context/DataContext';
import { Field, PageHeader, Spinner } from '../components/ui';

const TASK_COLS = ['ID', 'Title', 'Description', 'Start Date', 'End Date', 'Status', 'Priority', 'Notes', 'Daily Log', 'Created At', 'Updated At', 'Completed At'];
const LEARN_COLS = ['ID', 'Date', 'Category', 'Topic', 'Hours', 'Progress (%)', 'Skill Level', 'Notes', 'Created At', 'Updated At'];

export default function Settings() {
  const { apiUrl, connect, configured, tasks, learning, lastSync, error } = useData();
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
            <span className={`conn-badge ${configured && !error ? 'on' : 'off'}`}>{configured ? (error ? 'Connection issue' : 'Connected') : 'Not connected'}</span>
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
            <h3>Quick setup</h3>
            <a className="link-btn" href={SHEET_URL} target="_blank" rel="noreferrer">
              Open sheet <ExternalLink size={14} />
            </a>
          </div>
          <ol className="steps">
            <li>
              Open the sheet → <b>Extensions → Apps Script</b>.
            </li>
            <li>
              Paste <code>Code.gs</code> from the download, click <b>Save</b>.
            </li>
            <li>
              Choose the <b>setup</b> function → <b>Run</b> → allow access. Headers appear in both tabs.
            </li>
            <li>
              <b>Deploy → New deployment → Web app</b>. Execute as <b>Me</b>, access <b>Anyone</b>.
            </li>
            <li>Copy the Web App URL, paste it on the left and click Save &amp; connect.</li>
          </ol>
          <div className="cols">
            <div>
              <div className="eyebrow">Task tab columns</div>
              <div className="col-tags">
                {TASK_COLS.map((c) => (
                  <span key={c}>{c}</span>
                ))}
              </div>
            </div>
            <div>
              <div className="eyebrow">Learning tab columns</div>
              <div className="col-tags">
                {LEARN_COLS.map((c) => (
                  <span key={c}>{c}</span>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
