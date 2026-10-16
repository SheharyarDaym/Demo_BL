import { useState } from 'react';
import { Dialog } from '../components/Dialog';
import { Icon } from '../components/Icon';
import { ActivityBadge, BackLink, EmptyState, Segmented } from '../components/ui';
import type { ActivityEvent } from '../domain/types';
import { DestinationView } from '../features/DestinationDialog';
import { useReview } from '../features/review';
import { whereLabel } from '../features/plain';
import { useAppUi } from '../features/AppUi';
import { useStore } from '../state/store';
import { fmtDateTime } from '../utils/format';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'analysis', label: 'Checks' },
  { value: 'approval', label: 'Approvals' },
  { value: 'publishing', label: 'Demo updates' },
  { value: 'sync', label: 'Automatic updates' },
  { value: 'other', label: 'Business info & settings' },
  { value: 'errors', label: 'Problems' },
];

const CATEGORY_LABEL: Record<ActivityEvent['category'], string> = {
  analysis: 'Check',
  approval: 'Approval',
  publishing: 'Demo update',
  sync: 'Automatic update',
  profile: 'Business info',
  settings: 'Settings',
};

function matches(e: ActivityEvent, f: string) {
  if (f === 'all') return true;
  if (f === 'errors') return e.status === 'failed';
  if (f === 'other') return e.category === 'profile' || e.category === 'settings';
  return e.category === f;
}

export function HistoryPage() {
  const { state, dispatch } = useStore();
  const { openSettings } = useAppUi();
  const f = state.ui.activityFilter;
  const [detail, setDetail] = useState<ActivityEvent | null>(null);
  const [dest, setDest] = useState<string | null>(null);
  const { open: openReview } = useReview();
  const events = state.activity.filter((e) => matches(e, f));
  const destFor = (e: ActivityEvent) => state.destinations.find((d) => d.name === e.destination);

  return (
    <div className="page">
      <BackLink to="/progress">Back to Progress</BackLink>
      <header className="page-head">
        <div>
          <h1>Change history</h1>
          <p className="muted">Every check, approval, demo update and automatic update — who did it and what changed.</p>
        </div>
      </header>

      <div className="filters panel">
        <div className="field field-inline">
          <span className="field-label">Show</span>
          <Segmented label="Activity type" value={f} onChange={(v) => dispatch({ type: 'UI_SET', patch: { activityFilter: v } })} options={FILTERS} />
        </div>
      </div>

      {state.pendingSync.length > 0 && (
        <div className="callout callout-warn">
          <Icon name="clock" />
          <div>
            <strong>{state.pendingSync.length} change(s) queued</strong>
            <p>{state.pendingSync[0].reason}. Queued changes are processed when this is resolved.</p>
            <button className="btn btn-secondary btn-sm" onClick={() => openSettings('updates')}>
              Open Settings
            </button>
          </div>
        </div>
      )}

      <p className="muted small" role="status" aria-live="polite">
        {events.length} event(s). Times shown in Eastern Time. “Sample record” marks seeded history; other entries were created in this demo session.
      </p>

      {events.length ? (
        <div className="table-scroll">
          <table className="table activity-table">
            <caption className="sr-only">Activity</caption>
            <thead>
              <tr>
                <th scope="col">Time</th>
                <th scope="col">Event</th>
                <th scope="col">Destination</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="sr-only">Details</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td className="nowrap">
                    {fmtDateTime(e.at)}
                    <span className="muted small block">{e.sample ? 'Sample record' : 'This demo session'}</span>
                  </td>
                  <td>
                    <span className="muted small block">{CATEGORY_LABEL[e.category]}</span>
                    {e.action}
                  </td>
                  <td>{e.destination ?? <span className="muted">—</span>}</td>
                  <td>
                    <ActivityBadge status={e.status} />
                  </td>
                  <td>
                    <button className="btn btn-secondary btn-sm" onClick={() => setDetail(e)}>
                      View details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="No activity of this type yet"
          action={
            <button className="btn btn-secondary" onClick={() => dispatch({ type: 'UI_SET', patch: { activityFilter: 'all' } })}>
              Clear filters
            </button>
          }
        />
      )}

      <Dialog
        open={!!detail}
        onClose={() => {
          setDetail(null);
          setDest(null);
        }}
        variant="drawer"
        size={dest ? 'xl' : 'md'}
        title={dest ? 'Page and history' : 'Change details'}
        subtitle={detail ? `${detail.sample ? 'Sample record' : 'This demo session'} · ${detail.id}` : ''}
      >
        {detail && dest && (
          <div className="detail">
            <button className="back-link" onClick={() => setDest(null)}>
              <Icon name="arrowRight" size={16} className="flip" /> Back to change details
            </button>
            <DestinationView destId={dest} />
          </div>
        )}
        {detail && !dest && (
          <div className="activity-detail">
            <h3>{detail.action}</h3>
            <ActivityBadge status={detail.status} />
            <dl className="kv">
              <div>
                <dt>When</dt>
                <dd>{fmtDateTime(detail.at)}</dd>
              </div>
              <div>
                <dt>Done by</dt>
                <dd>{detail.actor}</dd>
              </div>
              <div>
                <dt>Type</dt>
                <dd>{CATEGORY_LABEL[detail.category]}</dd>
              </div>
              {detail.destination && (
                <div>
                  <dt>Where</dt>
                  <dd>{destFor(detail) ? whereLabel(destFor(detail)!) : detail.destination}</dd>
                </div>
              )}
              {detail.recommendationId && (
                <div>
                  <dt>Related suggestion</dt>
                  <dd>
                    <button
                      className="btn btn-link btn-sm inline"
                      onClick={() => {
                        const id = detail.recommendationId!;
                        setDetail(null);
                        openReview(id);
                      }}
                    >
                      {state.recommendations.find((r) => r.id === detail.recommendationId)?.title ?? detail.recommendationId}
                    </button>
                  </dd>
                </div>
              )}
            </dl>
            {(detail.before || detail.after) && (
              <div className="compare compare-text">
                <div>
                  <h4 className="section-label">Before</h4>
                  <p className="pre">{detail.before ?? '—'}</p>
                </div>
                <div>
                  <h4 className="section-label">After</h4>
                  <p className="pre">{detail.after ?? '—'}</p>
                </div>
              </div>
            )}
            {detail.details && <p className="muted">{detail.details}</p>}
            {destFor(detail) && (
              <button className="btn btn-secondary btn-sm" onClick={() => setDest(destFor(detail)!.id)}>
                <Icon name="eye" size={16} /> View page and history
              </button>
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
}
