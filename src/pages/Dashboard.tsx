import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { EmptyState, InfoTip } from '../components/ui';
import type { Channel, CityId, CourseId, RecFilters } from '../domain/types';
import { useAppUi } from '../features/AppUi';
import { RecCard } from '../features/RecCard';
import { ANALYSIS_STAGES } from '../services/demoService';
import { CHANNEL_LABELS, CITIES, QUERIES } from '../data/static';
import { byPriority, dashboardCounts, filterRecs } from '../state/selectors';
import { useStore } from '../state/store';
import { nowIso } from '../utils/format';

const STEPS = ['Check', 'Review', 'Apply'];

export function DashboardPage() {
  const { state, dispatch } = useStore();
  const { analysis } = useAppUi();
  const navigate = useNavigate();
  const city = state.ui.compFilters.city;
  const [showSettings, setShowSettings] = useState(false);
  const [course, setCourse] = useState<CourseId | 'all'>('all');
  const [queryId, setQueryId] = useState('');
  const [platforms, setPlatforms] = useState<Channel[]>(['organic', 'maps', 'ai']);
  const [error, setError] = useState('');
  const counts = dashboardCounts(state);

  const setCity = (c: CityId) => {
    dispatch({ type: 'UI_SET', patch: { compFilters: { ...state.ui.compFilters, city: c, queryId: 'all' } } });
    setQueryId('');
  };

  const openList = (patch: Partial<RecFilters>) => {
    dispatch({ type: 'UI_SET', patch: { recFilters: { city: 'all', destination: 'all', priority: 'all', status: 'unresolved', q: '', ...patch } } });
    navigate('/improvements');
  };

  const check = () => {
    if (!platforms.length) {
      setError('Choose at least one place to check in Search settings.');
      setShowSettings(true);
      return;
    }
    setError('');
    analysis.start({ cityId: city, courseId: course, platforms, queryId: queryId || undefined });
  };

  // Actionable suggestions for the selected city: ones that can move forward first, blocked ones last.
  const forCity = filterRecs(state, { city, destination: 'all', priority: 'all', status: 'unresolved', q: '' });
  const actionable = [...forCity].sort((a, b) => Number(a.status === 'blocked') - Number(b.status === 'blocked') || byPriority(a, b));
  const top = actionable.slice(0, 3);
  const latestRun = state.analysisRuns.find((r) => r.status === 'completed');
  const isNew = (id: string) => analysis.phase === 'done' && !!analysis.run && analysis.run.findingIds.includes(id) && state.recommendations.find((r) => r.id === id)?.detectionCount === 1;
  const queries = QUERIES.filter((q) => q.cityId === city && (course === 'all' || q.courseId === course));

  return (
    <div className="page dashboard">
      <section className="hero action-panel" aria-labelledby="dash-h">
        <div className="hero-text">
          <ol className="steps-caption" aria-label="How it works">
            {STEPS.map((s, i) => (
              <li key={s}>
                {s}
                {i < STEPS.length - 1 && <Icon name="arrowRight" size={14} />}
              </li>
            ))}
          </ol>
          <h1 id="dash-h">Help more customers find Lifeguard-Pro</h1>
          <p>Check competitors and review improvements for your business.</p>
        </div>
        <div className="action-row">
          <label className="field hero-field">
            <span className="field-label">City</span>
            <select value={city} onChange={(e) => setCity(e.target.value as CityId)} disabled={analysis.phase === 'running'}>
              <option value="boston">Boston</option>
              <option value="miami">Miami</option>
            </select>
          </label>
          <button className="btn btn-primary btn-lg" onClick={check} disabled={analysis.phase === 'running'}>
            {analysis.phase === 'running' ? <span className="spinner" aria-hidden="true" /> : <Icon name="search" />}
            {analysis.phase === 'running' ? 'Checking…' : 'Check competitors'}
          </button>
          <button className="btn btn-link hero-link" aria-expanded={showSettings} onClick={() => setShowSettings((s) => !s)}>
            Search settings
          </button>
        </div>

        <div className="check-status" role="status" aria-live="polite">
          {analysis.phase === 'running' && (
            <div className="check-progress">
              <div>
                <strong>Checking competitors in {CITIES[city].name}…</strong>
                <span>
                  Step {analysis.stage + 1} of {ANALYSIS_STAGES.length}: {ANALYSIS_STAGES[analysis.stage]}
                </span>
                <span className="bar" aria-hidden="true">
                  <span style={{ width: `${((analysis.stage + 1) / ANALYSIS_STAGES.length) * 100}%` }} />
                </span>
              </div>
              <button className="btn btn-ghost-light btn-sm" onClick={analysis.cancel}>
                Cancel
              </button>
            </div>
          )}
          {analysis.phase === 'done' && analysis.run && (
            <div className="check-done">
              <Icon name="checkCircle" />
              <span>
                <strong>Your suggestions are ready.</strong> {analysis.run.findingIds.length} found
                {analysis.run.newCount ? ` — ${analysis.run.newCount} new` : ' — nothing new since the last check'}. A suggestion is an opportunity, not a guaranteed ranking change.
              </span>
              <button className="icon-btn" aria-label="Dismiss" onClick={analysis.dismiss}>
                <Icon name="x" />
              </button>
            </div>
          )}
          {analysis.phase === 'cancelled' && (
            <div className="check-done">
              <Icon name="info" />
              <span>Check cancelled. Nothing was changed.</span>
              <button className="btn btn-ghost-light btn-sm" onClick={check}>
                Check again
              </button>
            </div>
          )}
          {error && <span className="hero-error">{error}</span>}
        </div>
      </section>

      {showSettings && (
        <section className="panel search-settings" aria-label="Search settings">
          <div className="panel-head">
            <h2>Search settings</h2>
            <span className="muted small">Optional — the defaults check everything for the selected city.</span>
          </div>
          <div className="form-grid form-grid-4">
            <label className="field">
              <span className="field-label">Course</span>
              <select
                value={course}
                onChange={(e) => {
                  setCourse(e.target.value as CourseId | 'all');
                  setQueryId('');
                }}
              >
                <option value="all">All courses</option>
                <option value="cert">Lifeguard certification</option>
                <option value="recert">Lifeguard recertification</option>
              </select>
            </label>
            <label className="field">
              <span className="field-label">Search phrase</span>
              <select
                value={queryId}
                onChange={(e) => {
                  setQueryId(e.target.value);
                  const q = QUERIES.find((x) => x.id === e.target.value);
                  if (q) setCourse(q.courseId);
                }}
              >
                <option value="">All tracked phrases</option>
                {queries.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.text}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="field">
              <legend className="field-label">Where to check</legend>
              <div className="check-stack">
                {(['organic', 'maps', 'ai'] as Channel[]).map((c) => (
                  <label key={c} className="check">
                    <input
                      type="checkbox"
                      checked={platforms.includes(c)}
                      onChange={() => setPlatforms((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]))}
                    />
                    {CHANNEL_LABELS[c]}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="field">
              <legend className="field-label">Automatic checks</legend>
              <div className="check-stack">
                {(['manual', 'daily', 'weekly'] as const).map((c) => (
                  <label key={c} className="radio">
                    <input type="radio" name="dash-cadence" checked={state.settings.cadence === c} onChange={() => dispatch({ type: 'SETTINGS_SET', patch: { cadence: c }, now: nowIso() })} />
                    {c === 'manual' ? 'Only when I click' : c === 'daily' ? 'Daily' : 'Weekly'}
                  </label>
                ))}
              </div>
              <span className="muted small">Demo schedule only — nothing runs after this page closes.</span>
            </fieldset>
          </div>
        </section>
      )}

      <section className="summary-cards" aria-label="Summary">
        <div className="sum-card sum-review">
          <button className="sum-main" onClick={() => openList({ status: 'review' })}>
            <span className="sum-label">To review</span>
            <span className="sum-value">{counts.review}</span>
            <span className="sum-note">
              Suggestions that need you <Icon name="arrowRight" size={14} />
            </span>
          </button>
          <InfoTip label="How “To review” is counted">Counts drafts, suggestions awaiting approval, ones waiting for a missing detail, and failed demo updates — across all cities.</InfoTip>
        </div>
        <div className="sum-card sum-ready">
          <button className="sum-main" onClick={() => openList({ status: 'ready' })}>
            <span className="sum-label">Ready to apply</span>
            <span className="sum-value">{counts.ready}</span>
            <span className="sum-note">
              Approved, not yet applied <Icon name="arrowRight" size={14} />
            </span>
          </button>
        </div>
        <div className="sum-card sum-applied">
          <button className="sum-main" onClick={() => openList({ status: 'applied' })}>
            <span className="sum-label">Applied</span>
            <span className="sum-value">{counts.applied}</span>
            <span className="sum-note">
              Demo changes made <Icon name="arrowRight" size={14} />
            </span>
          </button>
        </div>
      </section>

      <section className="panel" aria-labelledby="sugg-h">
        <div className="panel-head">
          <h2 id="sugg-h">Suggested improvements · {CITIES[city].name}</h2>
          {latestRun && <span className="muted small">Includes items for all cities</span>}
        </div>
        {top.length ? (
          <div className="rec-stack">
            {top.map((r) => (
              <RecCard key={r.id} rec={r} isNew={isNew(r.id)} />
            ))}
          </div>
        ) : (
          <EmptyState title="Nothing to review for this city">Click Check competitors to look for new improvements.</EmptyState>
        )}
        <button className="btn btn-link view-all" onClick={() => openList({ city, status: 'unresolved' })}>
          View all improvements ({forCity.length}) <Icon name="arrowRight" size={14} />
        </button>
      </section>

      <nav className="secondary-links" aria-label="More">
        <Link to="/compare" className="sec-link">
          <Icon name="target" />
          <span>
            <strong>Compare with competitors</strong>
            <span className="muted small">What customers can find about you and them</span>
          </span>
        </Link>
        <Link
          to="/progress/history"
          className="sec-link"
          onClick={() => dispatch({ type: 'UI_SET', patch: { activityFilter: 'all' } })}
        >
          <Icon name="history" />
          <span>
            <strong>View recent changes</strong>
            <span className="muted small">Checks, approvals and demo updates</span>
          </span>
        </Link>
      </nav>
    </div>
  );
}
