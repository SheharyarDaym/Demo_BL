import { useEffect, useRef, useState } from 'react';
import { Dialog } from '../components/Dialog';
import { Icon } from '../components/Icon';
import { useToast } from '../components/Toast';
import type { ConnectionId } from '../domain/types';
import { testConnection } from '../services/demoService';
import { CONNECTION_LABEL } from '../state/selectors';
import { useStore } from '../state/store';
import { download } from '../utils/csv';
import { fmtDateTime, nowIso } from '../utils/format';
import { whereLabel } from './plain';

const CONNECTION_INFO: Record<ConnectionId, string> = {
  odoo: 'Course, schedule and price facts',
  website: 'Course pages, pricing, FAQ, trust content',
  google: 'Business profile, posts, review replies',
  searchConsole: 'Website impressions and clicks',
  aiMonitoring: 'Sample AI answers and citations',
};

export function SettingsDrawer({ open, section, onClose, onReset }: { open: boolean; section?: string; onClose: () => void; onReset: () => void }) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [testing, setTesting] = useState<ConnectionId | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  useEffect(() => {
    if (!open) setConfirmReset(false);
  }, [open]);
  const bodyRef = useRef<HTMLDivElement>(null);
  const s = state.settings;

  useEffect(() => {
    if (open && section) {
      requestAnimationFrame(() => document.getElementById(`settings-${section}`)?.scrollIntoView({ block: 'start' }));
    }
  }, [open, section]);

  const runTest = async (id: ConnectionId) => {
    setTesting(id);
    const ok = await testConnection(s.connections[id].status === 'connected');
    dispatch({ type: 'CONNECTION_TESTED', id, ok, now: nowIso() });
    setTesting(null);
    toast(ok ? `${CONNECTION_LABEL[id]} demo connection test passed.` : `${CONNECTION_LABEL[id]} demo connection test failed — it is disconnected.`, ok ? 'success' : 'error');
  };

  const exportState = () => {
    download(`lifeguard-pro-demo-state-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ note: 'Lifeguard-Pro visibility demo — simulated sample data', ...state }, null, 2), 'application/json');
    toast('Demo state exported as JSON.');
  };

  return (
    <Dialog open={open} onClose={onClose} title="Settings" subtitle="Everything here is simulated — no real accounts or passwords." variant="drawer" size="md">
      <div ref={bodyRef} className="settings">
        <section id="settings-connections" aria-labelledby="set-conn">
          <h3 id="set-conn">1. Connections</h3>
          <p className="muted small">Pretend connections to your systems. Disconnecting one stops demo updates to it until you reconnect.</p>
          <ul className="conn-list">
            {(Object.keys(s.connections) as ConnectionId[]).map((id) => {
              const c = s.connections[id];
              const on = c.status === 'connected';
              return (
                <li key={id} className="conn-card">
                  <div className="conn-head">
                    <div>
                      <strong>{CONNECTION_LABEL[id]}</strong>
                      <span className="tag-sim">Simulated</span>
                      <p className="muted small">{CONNECTION_INFO[id]}</p>
                    </div>
                    <span className={`badge ${on ? 'tone-green' : 'tone-gray'}`}>
                      <Icon name={on ? 'checkCircle' : 'plug'} size={14} />
                      {on ? 'Connected (demo)' : 'Disconnected'}
                    </span>
                  </div>
                  {c.lastTestedAt && (
                    <p className="small muted">
                      Last test: {c.lastTestResult === 'ok' ? 'passed' : 'failed'} · {fmtDateTime(c.lastTestedAt)}
                    </p>
                  )}
                  <div className="btn-row">
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        dispatch({ type: 'CONNECTION_SET', id, status: on ? 'disconnected' : 'connected', now: nowIso() });
                        toast(`${CONNECTION_LABEL[id]} demo connection ${on ? 'disconnected' : 'connected'}.`, 'info');
                      }}
                    >
                      {on ? 'Disconnect' : 'Connect demo'}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => runTest(id)} disabled={testing !== null}>
                      {testing === id ? <span className="spinner" aria-hidden="true" /> : <Icon name="refresh" size={16} />}
                      {testing === id ? 'Testing…' : 'Test demo connection'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section id="settings-checks" aria-labelledby="set-cad">
          <h3 id="set-cad">2. Automatic checks</h3>
          <p className="muted small">How often competitors would be checked. This is a demo schedule only — the demo has no real background scheduler, so nothing runs after this page closes.</p>
          <div className="radio-row" role="radiogroup" aria-labelledby="set-cad">
            {(['manual', 'daily', 'weekly'] as const).map((c) => (
              <label key={c} className="radio">
                <input type="radio" name="cadence" checked={s.cadence === c} onChange={() => dispatch({ type: 'SETTINGS_SET', patch: { cadence: c }, now: nowIso() })} />
                {c === 'manual' ? 'Only when I click' : c === 'daily' ? 'Daily' : 'Weekly'}
              </label>
            ))}
          </div>
          <label className="switch">
            <input type="checkbox" checked={s.automationPaused} onChange={(e) => dispatch({ type: 'AUTOMATION_PAUSE', paused: e.target.checked, now: nowIso() })} />
            <span className="switch-ui" aria-hidden="true" />
            Pause automatic checks and updates
          </label>
          <p className="muted small">While paused, class changes are kept in a waiting list and nothing updates until you resume.</p>
        </section>

        <section id="settings-updates" aria-labelledby="set-fresh">
          <h3 id="set-fresh">3. Automatic updates</h3>
          <p className="muted small">What happens when a class date, seat count, status or price changes.</p>
          <div className="radio-stack" role="radiogroup" aria-labelledby="set-fresh">
            <label className="radio">
              <input type="radio" name="fresh" checked={s.freshnessPolicy === 'review'} onChange={() => dispatch({ type: 'SETTINGS_SET', patch: { freshnessPolicy: 'review' }, now: nowIso() })} />
              <span>
                <strong>Ask me first (recommended)</strong>
                <span className="muted small block">A suggested update appears for you to approve. Pages don’t change on their own.</span>
              </span>
            </label>
            <label className="radio">
              <input type="radio" name="fresh" checked={s.freshnessPolicy === 'auto'} onChange={() => dispatch({ type: 'SETTINGS_SET', patch: { freshnessPolicy: 'auto' }, now: nowIso() })} />
              <span>
                <strong>Update dates, seats and prices automatically</strong>
                <span className="muted small block">You pre-approve factual updates to details already on a page. Wording, claims and review replies are never written automatically.</span>
              </span>
            </label>
          </div>
          {state.pendingSync.length > 0 ? (
            <>
              <h4 className="section-label">Waiting changes ({state.pendingSync.length})</h4>
              <ul className="pending-list">
                {state.pendingSync.map((p) => {
                  const d = state.destinations.find((x) => x.id === p.destinationId);
                  return (
                    <li key={p.id}>
                      <Icon name="clock" size={14} />
                      <span>
                        <strong>{d ? whereLabel(d) : p.destinationId}</strong> — {p.change}
                        <span className="muted small block">Waiting because: {p.reason}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
              {s.automationPaused && (
                <button className="btn btn-secondary btn-sm" onClick={() => dispatch({ type: 'AUTOMATION_PAUSE', paused: false, now: nowIso() })}>
                  Resume and process waiting changes
                </button>
              )}
            </>
          ) : (
            <p className="muted small">No changes are waiting.</p>
          )}
        </section>

        <section id="settings-demo" aria-labelledby="set-data">
          <h3 id="set-data">4. Demo controls</h3>
          <label className="switch">
            <input type="checkbox" checked={s.failNextPublish} onChange={(e) => dispatch({ type: 'SETTINGS_SET', patch: { failNextPublish: e.target.checked }, now: nowIso() })} />
            <span className="switch-ui" aria-hidden="true" />
            Make the next demo update fail
          </label>
          <p className="muted small">Shows what a failed update and Retry look like. It switches itself off after one failure.</p>
          <div className="btn-row">
            <button className="btn btn-secondary" onClick={exportState}>
              <Icon name="download" /> Export demo data (JSON)
            </button>
            {!confirmReset && (
              <button className="btn btn-danger" onClick={() => setConfirmReset(true)}>
                <Icon name="refresh" /> Reset demo…
              </button>
            )}
          </div>
          {confirmReset && (
            <div className="callout callout-warn inline-confirm" role="alertdialog" aria-label="Reset the demo?">
              <Icon name="alert" />
              <div>
                <strong>Reset the demo?</strong>
                <p>This restores the original sample data, filters, connections and settings. Your edits, approvals and demo updates in this browser will be removed.</p>
                <div className="btn-row">
                  <button className="btn btn-danger btn-sm" data-autofocus onClick={onReset}>
                    Reset demo
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setConfirmReset(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
          <p className="muted small">Demo data is stored only in this browser.</p>
        </section>
      </div>
    </Dialog>
  );
}
