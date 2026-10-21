import { NavLink } from 'react-router-dom';
import { CalendarDays, GraduationCap, LayoutDashboard, RefreshCw, Settings, Sparkles } from 'lucide-react';
import { useData } from '../context/DataContext';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/tasks', label: 'Tasks', icon: CalendarDays },
  { to: '/learning', label: 'Learning', icon: GraduationCap },
  { to: '/settings', label: 'Settings', icon: Settings }
];

function syncText(configured, syncing, error, lastSync) {
  if (!configured) return 'Not connected';
  if (syncing) return 'Syncing…';
  if (error) return 'Sync issue';
  if (lastSync) return `Synced ${lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  return 'Connecting…';
}

export default function Sidebar() {
  const { configured, syncing, error, lastSync, refresh } = useData();
  const state = !configured ? 'off' : error ? 'err' : 'ok';

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <Sparkles size={20} />
        </div>
        <div className="brand-text">
          <strong>Progressaa</strong>
          <span>Progress Over Perfection.</span>
        </div>
      </div>

      <nav className="nav">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} title={label}>
            <span className="nav-icon">
              <Icon size={20} />
            </span>
            <span className="nav-label">{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-sync clay-inset">
        <span className={`sync-dot sync-${state}`} />
        <span className="sync-text">{syncText(configured, syncing, error, lastSync)}</span>
        {configured && (
          <button
            className="icon-btn icon-btn-sm"
            onClick={() => refresh()}
            disabled={syncing}
            aria-label="Refresh from Google Sheets"
            title="Refresh from Google Sheets"
          >
            <RefreshCw size={14} className={syncing ? 'spin' : ''} />
          </button>
        )}
      </div>
    </aside>
  );
}
