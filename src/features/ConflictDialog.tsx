import { useState } from 'react';
import { Dialog } from '../components/Dialog';
import { Icon } from '../components/Icon';
import { useToast } from '../components/Toast';
import { SOURCE_LABEL } from '../components/ui';
import type { CourseSession } from '../domain/types';
import { CITIES, COURSE_NAMES } from '../data/static';
import { useStore } from '../state/store';
import { fmtDateTime, money, nowIso } from '../utils/format';

/** Choose the authoritative price — shows both values and asks for confirmation before anything changes. */
export function ConflictChooser({ session, onDone, onCancel }: { session: CourseSession; onDone: () => void; onCancel: () => void }) {
  const { dispatch } = useStore();
  const toast = useToast();
  const [choice, setChoice] = useState<'odoo' | 'website' | null>(null);
  const [confirming, setConfirming] = useState(false);
  const c = session.conflict;
  if (!c || c.status !== 'open') return null;

  const confirm = () => {
    if (!choice) return;
    dispatch({ type: 'CONFLICT_RESOLVE', sessionId: session.id, source: choice, now: nowIso() });
    toast(`Price set to ${money(c.values[choice])}. Suggestions that used the other price were updated for review.`);
    onDone();
  };

  return (
    <div className="chooser">
      {!confirming ? (
        <fieldset className="conflict">
          <legend>
            Which price is correct for {COURSE_NAMES[session.courseId].toLowerCase()} in {CITIES[session.cityId].name}?
          </legend>
          {(['odoo', 'website'] as const).map((src) => (
            <label key={src} className={`conflict-opt ${choice === src ? 'on' : ''}`}>
              <input type="radio" name={`conflict-${session.id}`} checked={choice === src} onChange={() => setChoice(src)} />
              <span className="conflict-price">{money(c.values[src])}</span>
              <span>
                <strong>{SOURCE_LABEL[src]}</strong>
                <span className="muted small block">Updated {fmtDateTime(src === 'odoo' ? c.odooUpdatedAt : c.websiteUpdatedAt)}</span>
              </span>
            </label>
          ))}
          <p className="muted small">The demo doesn’t assume either is right. Pick the one you trust.</p>
          <div className="btn-row">
            <button className="btn btn-primary btn-sm" disabled={!choice} onClick={() => setConfirming(true)}>
              Continue
            </button>
            <button className="btn btn-secondary btn-sm" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </fieldset>
      ) : (
        choice && (
          <div className="callout callout-warn" role="alertdialog" aria-label="Confirm price">
            <Icon name="alert" />
            <div>
              <strong>Use {money(c.values[choice])} as the correct price?</strong>
              <p>Suggestions that used the other price will be updated and need review again. Nothing is applied until someone approves it.</p>
              <div className="btn-row">
                <button className="btn btn-primary btn-sm" onClick={confirm} data-autofocus>
                  Use {money(c.values[choice])}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => setConfirming(false)}>
                  Back
                </button>
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
}

export function ConflictDialog({ session, onClose }: { session: CourseSession | null; onClose: () => void }) {
  return (
    <Dialog open={!!session?.conflict && session.conflict.status === 'open'} onClose={onClose} title="Resolve price" subtitle="Two sources disagree · sample data" size="md">
      {session && <ConflictChooser session={session} onDone={onClose} onCancel={onClose} />}
    </Dialog>
  );
}
