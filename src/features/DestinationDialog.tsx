import { useState } from 'react';
import { Dialog } from '../components/Dialog';
import { DestinationPreview } from '../components/DestinationPreview';
import { Icon } from '../components/Icon';
import { useToast } from '../components/Toast';
import { useStore } from '../state/store';
import { getDest } from '../state/selectors';
import { fmtDateTime, nowIso } from '../utils/format';
import { whereLabel } from './plain';

/** Current demo preview, version history and website restore — rendered inline (no nested overlay). */
export function DestinationView({ destId, onOpenRecommendation }: { destId: string; onOpenRecommendation?: (id: string) => void }) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [restore, setRestore] = useState<number | null>(null);
  const dest = getDest(state, destId);
  const canRestore = dest.channel === 'Website' && dest.mode === 'replace';
  const prev = [...dest.history].reverse().find((h) => h.version < dest.version && JSON.stringify(h.content) !== JSON.stringify(dest.content));

  return (
    <div className="dest-dialog">
      <div>
        <h3 className="section-label">Where this appears: {whereLabel(dest)}</h3>
        <DestinationPreview dest={dest} />
      </div>
      <div>
        <div className="panel-head">
          <h3 className="section-label">Version history</h3>
          {canRestore && prev && restore === null && (
            <button className="btn btn-secondary btn-sm" onClick={() => setRestore(prev.version)}>
              <Icon name="undo" size={16} /> Restore previous version
            </button>
          )}
        </div>
        {restore !== null && (
          <div className="callout callout-warn inline-confirm" role="alertdialog" aria-label={`Restore version ${restore}?`}>
            <Icon name="undo" />
            <div>
              <strong>Restore version {restore}?</strong>
              <p>The demo page will show version {restore} again, saved as a new version. Earlier publications stay in history. This is a demo website restore only.</p>
              <div className="btn-row">
                <button
                  className="btn btn-primary btn-sm"
                  data-autofocus
                  onClick={() => {
                    dispatch({ type: 'DEST_RESTORE', destId, version: restore, now: nowIso() });
                    toast(`Restored version ${restore} as a new version. History is kept.`);
                    setRestore(null);
                  }}
                >
                  Restore version {restore}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => setRestore(null)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
        <ol className="history">
          {[...dest.history].reverse().map((h) => (
            <li key={h.version} className={h.version === dest.version ? 'current' : ''}>
              <div>
                <strong>Version {h.version}</strong>
                {h.version === dest.version && <span className="badge tone-green">Live in demo</span>}
              </div>
              <span>{h.note}</span>
              <span className="muted small">
                {fmtDateTime(h.at)} · {h.actor}
                {h.recommendationId && onOpenRecommendation && (
                  <>
                    {' · '}
                    <button className="btn btn-link btn-sm inline" onClick={() => onOpenRecommendation(h.recommendationId!)}>
                      View suggestion
                    </button>
                  </>
                )}
              </span>
              {canRestore && h.version !== dest.version && restore === null && (
                <button className="btn btn-link btn-sm" onClick={() => setRestore(h.version)}>
                  Restore version {h.version}
                </button>
              )}
            </li>
          ))}
        </ol>
        {!canRestore && <p className="muted small">Google items are historical messages. Restore applies to demo website content only.</p>}
      </div>
    </div>
  );
}

export function DestinationDialog({ destId, onClose }: { destId: string | null; onClose: () => void }) {
  const { state } = useStore();
  const dest = destId ? getDest(state, destId) : null;
  return (
    <Dialog open={!!dest} onClose={onClose} title={dest ? whereLabel(dest) : ''} subtitle="Demo preview — local only, nothing is sent anywhere" size="xl">
      {dest && <DestinationView destId={dest.id} />}
    </Dialog>
  );
}
