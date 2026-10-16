import { BackLink, Disclosure, EmptyState, Segmented, Select } from '../components/ui';
import { Icon } from '../components/Icon';
import type { RecFilters } from '../domain/types';
import { RecCard } from '../features/RecCard';
import { whereLabel } from '../features/plain';
import { STATUS_GROUPS, filterRecs } from '../state/selectors';
import { useStore } from '../state/store';
import { CITIES } from '../data/static';
import { fmtDateTime } from '../utils/format';

const CLEAR: RecFilters = { city: 'all', destination: 'all', priority: 'all', status: 'unresolved', q: '' };
const GROUPS = ['review', 'ready', 'applied', 'later', 'unresolved', 'all'] as const;

export function ImprovementsPage() {
  const { state, dispatch } = useStore();
  const f = state.ui.recFilters;
  const set = (patch: Partial<RecFilters>) => dispatch({ type: 'UI_SET', patch: { recFilters: { ...f, ...patch } } });
  const list = filterRecs(state, f);
  const run = f.runId ? state.analysisRuns.find((r) => r.id === f.runId) : undefined;
  const groupValue = (GROUPS as readonly string[]).includes(f.status) ? f.status : 'all';
  const extraFilters = f.city !== 'all' || f.destination !== 'all' || f.priority !== 'all';
  const isFiltered = JSON.stringify({ ...f, runId: undefined }) !== JSON.stringify(CLEAR) || !!f.runId;

  return (
    <div className="page">
      <BackLink to="/">Back to dashboard</BackLink>
      <header className="page-head">
        <div>
          <h1>Suggested improvements</h1>
          <p className="muted">Open one to see what would change and apply it to the demo.</p>
        </div>
      </header>

      <div className="filters panel" role="search">
        <div className="field field-inline">
          <span className="field-label">Show</span>
          <Segmented
            label="Show"
            value={groupValue}
            onChange={(v) => set({ status: v })}
            options={GROUPS.map((g) => ({ value: g, label: g === 'all' ? 'Everything' : STATUS_GROUPS[g].label }))}
          />
        </div>
        <label className="field field-search">
          <span className="field-label">Search</span>
          <span className="input-icon">
            <Icon name="search" size={16} />
            <input type="search" value={f.q} onChange={(e) => set({ q: e.target.value })} placeholder="Search by issue" />
          </span>
        </label>
        <Disclosure label="More filters" hint={extraFilters ? 'Some filters are on' : 'City, where it appears, priority'} defaultOpen={extraFilters} className="filters-more">
          <div className="filters-row">
            <Select
              label="City"
              value={f.city}
              onChange={(v) => set({ city: v })}
              options={[
                { value: 'all', label: 'Any city' },
                { value: 'boston', label: CITIES.boston.name },
                { value: 'miami', label: CITIES.miami.name },
                { value: 'none', label: 'Only “all cities” items' },
              ]}
            />
            <Select
              label="Where it appears"
              value={f.destination}
              onChange={(v) => set({ destination: v })}
              options={[{ value: 'all', label: 'Anywhere' }, ...state.destinations.map((d) => ({ value: d.id, label: whereLabel(d) }))]}
            />
            <Select
              label="Priority"
              value={f.priority}
              onChange={(v) => set({ priority: v })}
              options={[
                { value: 'all', label: 'Any priority' },
                { value: 'High', label: 'High' },
                { value: 'Medium', label: 'Medium' },
                { value: 'Low', label: 'Low' },
              ]}
            />
          </div>
        </Disclosure>
        {isFiltered && (
          <button className="btn btn-ghost btn-sm filters-clear" onClick={() => dispatch({ type: 'UI_SET', patch: { recFilters: CLEAR } })}>
            <Icon name="x" size={16} /> Clear filters
          </button>
        )}
      </div>

      {run && (
        <div className="chip-row">
          <span className="chip">
            <Icon name="filter" size={14} />
            From the check on {fmtDateTime(run.completedAt)}
            <button className="icon-btn" aria-label="Remove this filter" onClick={() => set({ runId: undefined })}>
              <Icon name="x" size={14} />
            </button>
          </span>
        </div>
      )}

      <p className="muted small" role="status" aria-live="polite">
        Showing {list.length} of {state.recommendations.length} suggestions
      </p>

      {list.length ? (
        <div className="rec-grid">
          {list.map((r) => (
            <RecCard key={r.id} rec={r} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No suggestions match"
          action={
            <button className="btn btn-secondary" onClick={() => dispatch({ type: 'UI_SET', patch: { recFilters: CLEAR } })}>
              Clear filters
            </button>
          }
        >
          Try another view or remove a filter.
        </EmptyState>
      )}
    </div>
  );
}
