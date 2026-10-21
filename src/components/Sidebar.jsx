import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { CalendarDays, GraduationCap, LayoutDashboard, Menu, RefreshCw, Settings, Sparkles, X } from 'lucide-react';
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

function Brand() {
  return (
    <div className="brand">
      <div className="brand-mark">
        <Sparkles size={20} />
      </div>
      <div className="brand-text">
        <strong>Progressaa</strong>
        <span>Rise Every Day.</span>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const { configured, syncing, error, lastSync, refresh } = useData();
  const state = !configured ? 'off' : error ? 'err' : 'ok';
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  // close the mobile menu whenever the page changes
  useEffect(() => setMenuOpen(false), [location.pathname]);

  // Escape closes the mobile menu
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  return (
    <>
      {/* Mobile only: top bar with hamburger (hidden on desktop via CSS) */}
      <header className="mobile-bar">
        <Brand />
        <button
          type="button"
          className="hamburger"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          aria-controls="main-menu"
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>
      {menuOpen && <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />}

      <aside id="main-menu" className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <Brand />

        <nav className="nav">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              title={label}
              onClick={() => setMenuOpen(false)}
            >
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
    </>
  );
}
