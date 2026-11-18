import { useState } from "react";
import { ExternalLink, Hourglass, LogOut, RefreshCw, Save, ShieldCheck } from "lucide-react";
import { SHEET_URL } from "../lib/constants";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { Field, PageHeader } from "../components/ui";
import {
  COUNTDOWN_DEFAULTS,
  getCountdownSettings,
  saveCountdownSettings,
} from "../lib/countdown";

export default function Settings() {
  const { lastSync, error, syncing, refresh, toast } = useData();
  const { logout } = useAuth();
  const [cd, setCd] = useState(getCountdownSettings);
  const cdError = !cd.label.trim()
    ? "Add a title"
    : !cd.targetDate
      ? "Pick a target date"
      : cd.startDate && cd.startDate >= cd.targetDate
        ? "Start date must be before the target date"
        : "";
  const saveCountdown = (e) => {
    e.preventDefault();
    if (cdError) return;
    saveCountdownSettings({ ...cd, label: cd.label.trim() });
    toast("Countdown updated");
  };
  const resetCountdown = () => {
    saveCountdownSettings(null);
    setCd({ ...COUNTDOWN_DEFAULTS });
    toast("Countdown reset");
  };
  return (
    <div className="page">
      <PageHeader
        eyebrow="Settings"
        title="Sheet and Dashboard Settings"
        subtitle="Your data lives in the Task and Learning tabs of your Google Sheet."
      />

      <div className="settings-grid">
        <section className="card clay">
          <div className="card-head">
            <h3>
              <Hourglass size={20} /> Dashboard Countdown
            </h3>
          </div>
          <form className="form-grid" onSubmit={saveCountdown}>
            <Field label="Countdown Title" full>
              <input
                className="input"
                value={cd.label}
                maxLength={60}
                onChange={(e) => setCd({ ...cd, label: e.target.value })}
                placeholder="Appraisal countdown"
              />
            </Field>
            <Field label="Start Date">
              <input
                className="input"
                type="date"
                value={cd.startDate}
                onChange={(e) => setCd({ ...cd, startDate: e.target.value })}
              />
            </Field>
            <Field label="Target Date">
              <input
                className="input"
                type="date"
                value={cd.targetDate}
                onChange={(e) => setCd({ ...cd, targetDate: e.target.value })}
              />
            </Field>

            {cdError && <p className="field-error field-full">{cdError}</p>}
            <div className="form-actions field-full">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!!cdError}
              >
                <Save size={16} /> Save countdown
              </button>
            </div>
          </form>
        </section>
        <section className="card clay">
          <div className="card-head">
            <h3>
              <ShieldCheck size={20} /> Account &amp; Sync
            </h3>
            <div className="card-head-actions">
              <a className="link-btn" href={SHEET_URL} target="_blank" rel="noreferrer">
                Open sheet <ExternalLink size={14} />
              </a>
              <span className={`conn-badge ${!error ? "on" : "off"}`}>
                {error ? "Connection issue" : "Connected"}
              </span>
            </div>
          </div>
          <p className="muted">
            You are logged in with your secret key.
          </p>
          <div className="sync-info">
            <div>
              LAST SYNC :{" "}
              <strong>{lastSync ? lastSync.toLocaleTimeString() : "—"}</strong>
            </div>
          </div>
          {error && <p className="field-error">{error}</p>}
          <div className="form-actions">
            <button type="button" className="btn btn-soft" onClick={() => refresh()} disabled={syncing}>
              <RefreshCw size={16} className={syncing ? "spin" : ""} /> Sync now
            </button>
            <button type="button" className="btn btn-ghost" onClick={logout}>
              <LogOut size={16} /> Log out
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
