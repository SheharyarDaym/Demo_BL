import { useMemo, useState } from 'react';
import { Link, Outlet, ScrollRestoration, useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { useToast } from '../components/Toast';
import { useStore } from '../state/store';
import { DATASET_LABEL } from '../data/static';
import { AppUiContext, useAnalysisRunner } from './AppUi';
import { ReviewPanel } from './ReviewPanel';
import { SettingsDrawer } from './SettingsDrawer';

const TABS = [
  { to: '/', label: 'Dashboard', icon: 'layers', match: ['/', '/improvements', '/compare'] },
  { to: '/business', label: 'Our Business', icon: 'building', match: ['/business'] },
  { to: '/progress', label: 'Progress', icon: 'chart', match: ['/progress'] },
];

export function Layout() {
  const { state, reset, storageError } = useStore();
  const [settings, setSettings] = useState<{ open: boolean; section?: string }>({ open: false });
  const analysis = useAnalysisRunner();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const ui = useMemo(() => ({ openSettings: (section?: string) => setSettings({ open: true, section }), analysis }), [analysis]);

  const isActive = (match: string[]) =>
    match.some((m) => (m === '/' ? location.pathname === '/' : location.pathname === m || location.pathname.startsWith(`${m}/`)));

  const doReset = () => {
    analysis.dismiss();
    reset();
    setSettings({ open: false });
    navigate('/');
    toast('Demo reset to the initial sample data.', 'success');
  };

  return (
    <AppUiContext.Provider value={ui}>
      <ScrollRestoration getKey={(loc) => loc.pathname} />
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <div className="header-inner">
          <Link to="/" className="brand" aria-label="Lifeguard-Pro.org — go to Dashboard">
            <span className="brand-name">Lifeguard-Pro.org</span>
            <span className="brand-sub">Google + AI Visibility</span>
          </Link>
          <div className="header-actions">
            <span className="demo-badge" title="All data is sample data. Nothing is sent to Google or any other service.">
              <span className="dot" aria-hidden="true" />
              Demo • Sample data
            </span>
            <button className="btn btn-ghost-light" onClick={() => ui.openSettings()}>
              <Icon name="settings" />
              Settings
            </button>
          </div>
        </div>
      </header>
      <nav className="tabs" aria-label="Main">
        <div className="tabs-inner">
          {TABS.map((t) => {
            const active = isActive(t.match);
            return (
              <Link key={t.to} to={t.to} className={`tab ${active ? 'active' : ''}`} aria-current={active ? 'page' : undefined}>
                <Icon name={t.icon} size={16} />
                {t.label}
              </Link>
            );
          })}
        </div>
      </nav>
      {storageError && (
        <div className="banner banner-error" role="alert">
          <Icon name="alert" /> {storageError}
        </div>
      )}
      {state.settings.automationPaused && (
        <div className="banner banner-warn">
          <Icon name="pause" /> Automatic updates are paused{state.pendingSync.length ? ` — ${state.pendingSync.length} change(s) waiting` : ''}.
          <button className="btn btn-link btn-sm" onClick={() => ui.openSettings('updates')}>
            Resume in Settings
          </button>
        </div>
      )}
      <main id="main" className="main" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="site-footer">
        <span>
          <Icon name="info" size={14} /> All business details, competitors, rankings, AI answers and results are sample data. Nothing is sent to Google or any other service.
        </span>
        <span>{DATASET_LABEL}</span>
      </footer>
      <SettingsDrawer open={settings.open} section={settings.section} onClose={() => setSettings({ open: false })} onReset={doReset} />
      <ReviewPanel />
    </AppUiContext.Provider>
  );
}
