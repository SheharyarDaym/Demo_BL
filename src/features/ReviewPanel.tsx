import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog } from '../components/Dialog';
import { ContentPreview, DestinationPreview } from '../components/DestinationPreview';
import { Icon } from '../components/Icon';
import { useToast } from '../components/Toast';
import { Disclosure, EmptyState, SourceTag, StatusBadge } from '../components/ui';
import type { Recommendation } from '../domain/types';
import { CITIES, COMPARISONS, COMPARISON_LABELS, COMPETITORS, COURSE_NAMES, EVIDENCE } from '../data/static';
import { CONNECTION_LABEL, getDest, getRec, publishCheck } from '../state/selectors';
import { useStore } from '../state/store';
import { fmtDateTime, money, nowIso, sessionDateLabel } from '../utils/format';
import { useAppUi } from './AppUi';
import { ConflictChooser } from './ConflictDialog';
import { DestinationView } from './DestinationDialog';
import { EvidenceList } from './Evidence';
import { evidenceConfidence, plainCopy, targetLabel, whereLabel } from './plain';
import { proposedPreview, useReview } from './review';

type View = 'main' | 'confirm' | 'result' | 'history';

/** One focused side panel (full screen on mobile) for reviewing and applying a suggestion. */
export function ReviewPanel() {
  const { state } = useStore();
  const { current, close } = useReview();
  const rec = current ? getRec(state, current) : undefined;
  return (
    <Dialog
      open={!!current}
      onClose={close}
      locked={rec?.status === 'publishing'}
      variant="drawer"
      size="xl"
      title={rec ? plainCopy(rec, state).title : 'Suggestion not found'}
      subtitle={
        rec && (
          <span className="detail-meta">
            <StatusBadge status={rec.status} />
            <span>
              <Icon name="map" size={14} /> {targetLabel(rec, state)}
            </span>
          </span>
        )
      }
    >
      {rec ? (
        <PanelBody key={rec.id} rec={rec} />
      ) : (
        current && (
          <EmptyState title="This suggestion no longer exists" action={<button className="btn btn-secondary" onClick={close}>Close</button>}>
            It may have been removed by a demo reset.
          </EmptyState>
        )
      )}
    </Dialog>
  );
}

function PanelBody({ rec }: { rec: Recommendation }) {
  const { state, dispatch, publish } = useStore();
  const { openSettings } = useAppUi();
  const { close, open } = useReview();
  const navigate = useNavigate();
  const toast = useToast();
  const dest = getDest(state, rec.destinationId);
  const copy = plainCopy(rec, state);
  const [view, setView] = useState<View>(rec.status === 'published' ? 'main' : 'main');
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(rec.proposed.text);
  const [resolving, setResolving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [facts, setFacts] = useState({ credentials: '', instructors: '', confirm: false });
  const [factsError, setFactsError] = useState('');
  const [applyError, setApplyError] = useState('');

  useEffect(() => setText(rec.proposed.text), [rec.proposed.text, rec.revision]);

  const dirty = editing && text !== rec.proposed.text;
  const editable = !['blocked', 'rejected', 'deferred', 'publishing'].includes(rec.status);
  const sessions = rec.sessionIds.map((id) => state.profile.sessions.find((s) => s.id === id)!).filter(Boolean);
  const conflictSession = sessions.find((s) => s.conflict?.status === 'open');
  const needsApproval = rec.status === 'draft' || rec.status === 'awaiting';
  // Would this be publishable once the current revision is approved?
  const check = publishCheck(state, needsApproval ? { ...rec, status: 'approved', approvedRevision: rec.revision } : rec);
  const now = nowIso;

  const saveEdit = () => {
    if (!text.trim()) {
      toast('The suggested content can’t be empty.', 'error');
      return false;
    }
    if (!dirty) return true;
    const wasApproved = rec.status === 'approved' || rec.status === 'failed';
    dispatch({ type: 'REC_SAVE', id: rec.id, text, now: now() });
    setEditing(false);
    toast(wasApproved ? 'Saved. The earlier approval no longer applies — confirm the new version before applying.' : 'Saved.', wasApproved ? 'info' : 'success');
    return true;
  };

  const goConfirm = () => {
    if (dirty && !saveEdit()) return;
    setEditing(false);
    setApplyError('');
    setView('confirm');
  };

  const apply = async (approveFirst: boolean) => {
    setApplyError('');
    const r = await publish(rec.id, { approveFirst });
    if (r === 'ok') {
      setView('result');
      toast('Demo updated.');
    } else if (r === 'failed') {
      setView('main');
    } else {
      setView('main');
      setApplyError(check.reason ?? 'This can’t be applied right now.');
    }
  };

  const notNow = () => {
    dispatch({ type: 'REC_DEFER', id: rec.id, now: now() });
    toast('Moved to Later.', 'info', { label: 'Undo', onClick: () => dispatch({ type: 'REC_REOPEN', id: rec.id, now: nowIso() }) });
    close();
  };

  const submitFacts = () => {
    if (!facts.credentials.trim()) return setFactsError('Enter at least one credential.');
    if (!facts.confirm) return setFactsError('Confirm that these details are verified for this demo.');
    setFactsError('');
    dispatch({ type: 'REC_PROVIDE_FACTS', id: rec.id, credentials: facts.credentials, instructors: facts.instructors, now: now() });
    setResolving(false);
    toast('Thanks — a suggestion was written from the details you supplied only.');
  };

  const settingsLink = (
    <button
      className="btn btn-link btn-sm"
      onClick={() => {
        close();
        openSettings('connections');
      }}
    >
      Open Settings
    </button>
  );

  // ---------- Confirm ----------
  if (view === 'confirm') {
    const busy = rec.status === 'publishing';
    return (
      <div className="detail">
        <button className="back-link" onClick={() => setView('main')} disabled={busy}>
          <Icon name="arrowRight" size={16} className="flip" /> Back to suggestion
        </button>
        <h3 className="rv-h">Check before applying</h3>
        <dl className="kv">
          <div>
            <dt>Where this will appear</dt>
            <dd>
              {whereLabel(dest)} <span className="muted small">({dest.channel})</span>
            </dd>
          </div>
          <div>
            <dt>What happens</dt>
            <dd>{dest.mode === 'replace' ? 'The demo page is replaced with the content below. The current version is kept in history.' : 'This is added as a new item. Earlier items stay.'}</dd>
          </div>
          <div>
            <dt>Approval</dt>
            <dd>{needsApproval ? `Confirming approves this version (revision ${rec.revision}) as ${'Demo presenter'}.` : `Revision ${rec.approvedRevision} approved by ${rec.approvedBy}.`}</dd>
          </div>
        </dl>
        <ContentPreview dest={dest} content={proposedPreview(rec, dest)} label="after applying" />
        <div className="callout callout-info">
          <Icon name="shield" />
          <div>
            <strong>This only updates the demo.</strong>
            <p>Nothing is sent to Google, the live website, or any other service.</p>
          </div>
        </div>
        {state.settings.failNextPublish && (
          <div className="callout callout-warn">
            <Icon name="alert" />
            <div>
              <strong>A simulated error is switched on.</strong>
              <p>This attempt will fail so you can show Retry. (Settings → Demo controls)</p>
            </div>
          </div>
        )}
        <p className="live" role="status" aria-live="polite">
          {busy ? 'Applying to the demo…' : ''}
        </p>
        <div className="btn-row rv-actions">
          <button className="btn btn-primary btn-lg" onClick={() => apply(needsApproval)} disabled={busy || !check.ok} aria-busy={busy}>
            {busy ? <span className="spinner" aria-hidden="true" /> : <Icon name="check" />}
            {busy ? 'Applying…' : 'Confirm & apply'}
          </button>
          <button className="btn btn-secondary" onClick={() => setView('main')} disabled={busy}>
            Cancel
          </button>
        </div>
        {!check.ok && (
          <p className="publish-reason">
            <Icon name="info" size={14} /> {check.reason} {check.needsSettings && settingsLink}
          </p>
        )}
      </div>
    );
  }

  // ---------- Result ----------
  if (view === 'result') {
    return (
      <div className="detail">
        <div className="callout callout-success">
          <Icon name="checkCircle" />
          <div>
            <strong>Demo updated</strong>
            <p>
              {whereLabel(dest)} now shows the new version. Nothing was sent to Google or the live website.
            </p>
          </div>
        </div>
        <h3 className="section-label">Updated page (demo)</h3>
        <DestinationPreview dest={dest} />
        <div className="btn-row rv-actions">
          <button className="btn btn-primary" onClick={() => navigate('/')}>
            Back to dashboard
          </button>
          <button className="btn btn-secondary" onClick={() => setView('history')}>
            <Icon name="history" /> View history
          </button>
        </div>
      </div>
    );
  }

  // ---------- History ----------
  if (view === 'history') {
    return (
      <div className="detail">
        <button className="back-link" onClick={() => setView('main')}>
          <Icon name="arrowRight" size={16} className="flip" /> Back to suggestion
        </button>
        <DestinationView destId={dest.id} onOpenRecommendation={(id) => (id === rec.id ? setView('main') : open(id, { replace: true }))} />
      </div>
    );
  }

  // ---------- Main ----------
  return (
    <div className="detail">
      {rec.status === 'blocked' && (
        <div className="callout callout-warn">
          <Icon name="alert" />
          <div>
            <strong>We need one detail first</strong>
            <p>
              {rec.blockKind === 'source-conflict'
                ? 'Your records show two different prices for this class. Choose the correct one before this can be applied.'
                : 'Instructor credentials haven’t been added yet. We never invent them, so please add the real details first.'}
            </p>
            {!resolving && (
              <button className="btn btn-primary btn-sm" onClick={() => setResolving(true)}>
                {rec.blockKind === 'source-conflict' ? 'Resolve price' : 'Add missing information'}
              </button>
            )}
          </div>
        </div>
      )}
      {resolving && rec.status === 'blocked' && rec.blockKind === 'source-conflict' && conflictSession && (
        <ConflictChooser session={conflictSession} onDone={() => setResolving(false)} onCancel={() => setResolving(false)} />
      )}
      {resolving && rec.status === 'blocked' && rec.blockKind === 'missing-facts' && (
        <section className="panel panel-tint">
          <h3>Add instructor details</h3>
          <div className="form-grid">
            <label className="field field-full">
              <span className="field-label">Credentials (required)</span>
              <textarea rows={2} value={facts.credentials} onChange={(e) => setFacts({ ...facts, credentials: e.target.value })} placeholder="e.g. Sample: all instructors hold a current instructor certification" />
            </label>
            <label className="field field-full">
              <span className="field-label">Instructors (optional)</span>
              <input value={facts.instructors} onChange={(e) => setFacts({ ...facts, instructors: e.target.value })} placeholder="e.g. Sample Instructor A, Sample Instructor B" />
            </label>
            <label className="check field-full">
              <input type="checkbox" checked={facts.confirm} onChange={(e) => setFacts({ ...facts, confirm: e.target.checked })} />I confirm these details are verified (demo)
            </label>
          </div>
          {factsError && (
            <p className="field-error" role="alert">
              {factsError}
            </p>
          )}
          <div className="btn-row">
            <button className="btn btn-primary btn-sm" onClick={submitFacts}>
              Save details
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => setResolving(false)}>
              Cancel
            </button>
          </div>
        </section>
      )}
      {rec.status === 'failed' && (
        <div className="callout callout-error">
          <Icon name="alert" />
          <div>
            <strong>The demo update didn’t go through</strong>
            <p>{rec.error} The page was not changed.</p>
          </div>
        </div>
      )}
      {applyError && (
        <p className="publish-reason" role="alert">
          <Icon name="info" size={14} /> {applyError}
        </p>
      )}
      {rec.status === 'published' && (
        <div className="callout callout-success">
          <Icon name="checkCircle" />
          <div>
            <strong>Applied to the demo</strong>
            <p>Editing the suggestion creates a new version for approval; what was applied stays in history.</p>
          </div>
        </div>
      )}
      {(rec.status === 'deferred' || rec.status === 'rejected') && (
        <div className="callout callout-info">
          <Icon name="pause" />
          <div>
            <strong>{rec.status === 'deferred' ? 'Saved for later' : 'Rejected'}</strong>
            <p>{rec.rejectReason ? `Reason: ${rec.rejectReason}` : 'Reopen it whenever you’re ready.'}</p>
          </div>
        </div>
      )}
      {rec.changeNote && (
        <div className="callout callout-info">
          <Icon name="refresh" />
          <div>
            <strong>What changed</strong>
            <p className="pre">{rec.changeNote}</p>
          </div>
        </div>
      )}

      <section className="rv-sec">
        <h3 className="rv-h">What needs improving</h3>
        <p className="rv-lead">{copy.why}</p>
      </section>
      <section className="rv-sec">
        <h3 className="rv-h">Where it will change</h3>
        <p className="rv-where">
          <Icon name={dest.channel === 'Website' ? 'globe' : 'map'} /> {whereLabel(dest)} <span className="muted">· {dest.channel}</span>
        </p>
      </section>

      <div className="compare">
        <div>
          <h4 className="section-label">Current information</h4>
          <ContentPreview dest={dest} content={dest.content} label="now" />
        </div>
        <div>
          <h4 className="section-label">Suggested update</h4>
          {editing ? (
            <div className="rv-edit">
              <label className="field">
                <span className="field-label">Suggested wording {rec.factKind !== 'text' && <span className="muted">(class dates, seats and prices are filled in from your records)</span>}</span>
                <textarea rows={7} value={text} onChange={(e) => setText(e.target.value)} data-autofocus />
              </label>
              {(rec.status === 'approved' || rec.status === 'failed') && dirty && (
                <p className="field-warn">
                  <Icon name="alert" size={14} /> Saving means this new version must be confirmed again.
                </p>
              )}
              <div className="btn-row">
                <button className="btn btn-secondary btn-sm" onClick={saveEdit} disabled={!dirty}>
                  Save draft
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setText(rec.proposed.text);
                    setEditing(false);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <ContentPreview dest={dest} content={proposedPreview(rec, dest)} label={`suggested · version ${rec.revision}`} />
          )}
          {!editing && editable && (
            <button className="btn btn-link btn-sm" onClick={() => setEditing(true)}>
              <Icon name="edit" size={14} /> Edit suggestion
            </button>
          )}
        </div>
      </div>

      <div className="rv-actions">
        <div className="btn-row">
          {needsApproval && (
            <button className="btn btn-primary btn-lg" onClick={goConfirm} disabled={!check.ok}>
              <Icon name="check" /> Approve &amp; apply demo
            </button>
          )}
          {rec.status === 'approved' && (
            <button className="btn btn-primary btn-lg" onClick={goConfirm} disabled={!check.ok || dirty}>
              <Icon name="send" /> Apply demo
            </button>
          )}
          {rec.status === 'failed' && (
            <button className="btn btn-primary btn-lg" onClick={() => apply(false)} disabled={!check.ok}>
              <Icon name="refresh" /> Retry
            </button>
          )}
          {rec.status === 'publishing' && (
            <button className="btn btn-primary btn-lg" disabled>
              <span className="spinner" aria-hidden="true" /> Applying…
            </button>
          )}
          {rec.status === 'published' && (
            <>
              <button className="btn btn-primary btn-lg" onClick={() => setView('result')}>
                <Icon name="eye" /> View result
              </button>
              <button className="btn btn-secondary" onClick={() => setView('history')}>
                <Icon name="history" /> View history
              </button>
            </>
          )}
          {(rec.status === 'deferred' || rec.status === 'rejected') && (
            <button
              className="btn btn-primary btn-lg"
              onClick={() => {
                dispatch({ type: 'REC_REOPEN', id: rec.id, now: now() });
                toast('Reopened.');
              }}
            >
              Reopen
            </button>
          )}
          {['draft', 'awaiting', 'blocked', 'approved', 'failed'].includes(rec.status) && (
            <button className="btn btn-secondary" onClick={notNow}>
              Not now
            </button>
          )}
        </div>
        {!check.ok && ['draft', 'awaiting', 'approved', 'failed'].includes(rec.status) && (
          <p className="publish-reason">
            <Icon name="info" size={14} /> {check.reason} {check.needsSettings && settingsLink}
          </p>
        )}
      </div>

      <Disclosure label="Why this was suggested" hint="Evidence, competitor comparison, source facts and confidence">
        <WhySuggested rec={rec} />
      </Disclosure>

      <Disclosure label="More actions" hint="Save draft, approve only, reject, reopen, history">
        <div className="more-actions">
          <div className="btn-row">
            {editable && (
              <button className="btn btn-secondary btn-sm" onClick={() => (editing ? saveEdit() : setEditing(true))} disabled={editing && !dirty}>
                <Icon name="edit" size={16} /> {editing ? 'Save draft' : 'Edit and save draft'}
              </button>
            )}
            {rec.status === 'draft' && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  if (dirty && !saveEdit()) return;
                  dispatch({ type: 'REC_SUBMIT', id: rec.id, now: now() });
                  toast('Sent for approval.');
                }}
              >
                Send for approval
              </button>
            )}
            {needsApproval && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  if (dirty && !saveEdit()) return;
                  if (rec.status === 'draft') dispatch({ type: 'REC_SUBMIT', id: rec.id, now: now() });
                  dispatch({ type: 'REC_APPROVE', id: rec.id, now: now() });
                  toast('Approved. Use Apply demo when you’re ready.');
                }}
              >
                <Icon name="check" size={16} /> Approve only
              </button>
            )}
            {['draft', 'awaiting', 'approved', 'failed'].includes(rec.status) && (
              <button className="btn btn-secondary btn-sm" aria-expanded={rejecting} onClick={() => setRejecting((r) => !r)}>
                Reject…
              </button>
            )}
            {(rec.status === 'deferred' || rec.status === 'rejected') && (
              <button className="btn btn-secondary btn-sm" onClick={() => dispatch({ type: 'REC_REOPEN', id: rec.id, now: now() })}>
                Reopen
              </button>
            )}
            {dest.history.length > 1 && (
              <button className="btn btn-ghost btn-sm" onClick={() => setView('history')}>
                <Icon name="history" size={16} /> Page history
              </button>
            )}
          </div>
          {rejecting && (
            <div className="reject-box">
              <label className="field">
                <span className="field-label">Reason (optional)</span>
                <input value={reason} onChange={(e) => setReason(e.target.value)} />
              </label>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => {
                  dispatch({ type: 'REC_REJECT', id: rec.id, reason, now: now() });
                  setRejecting(false);
                  toast('Rejected. You can reopen it from the Later list.', 'info');
                }}
              >
                Confirm reject
              </button>
            </div>
          )}
          <p className="muted small">
            {rec.approvedBy && rec.approvedRevision === rec.revision
              ? `Approved by ${rec.approvedBy} · ${fmtDateTime(rec.approvedAt!)} · version ${rec.approvedRevision}`
              : 'Not approved yet.'}
          </p>
        </div>
      </Disclosure>
    </div>
  );
}

function WhySuggested({ rec }: { rec: Recommendation }) {
  const { state } = useStore();
  const dest = getDest(state, rec.destinationId);
  const sessions = rec.sessionIds.map((id) => state.profile.sessions.find((s) => s.id === id)!).filter(Boolean);
  const competitorEv = rec.evidenceIds.map((id) => EVIDENCE.find((e) => e.id === id)).find((e) => e?.competitorId);
  const cmp = competitorEv && rec.cityId ? COMPARISONS.find((c) => c.competitorId === competitorEv.competitorId && c.cityId === rec.cityId) : undefined;
  return (
    <div className="why">
      <dl className="kv">
        <div>
          <dt>What we found</dt>
          <dd>{rec.finding}</dd>
        </div>
        <div>
          <dt>Why it matters</dt>
          <dd>{rec.whyItMatters}</dd>
        </div>
        <div>
          <dt>Expected benefit</dt>
          <dd>{rec.benefit}</dd>
        </div>
        <div>
          <dt>Confidence</dt>
          <dd>{evidenceConfidence(rec)} Any link to rankings is a possibility, not a proven cause.</dd>
        </div>
        <div>
          <dt>Detected</dt>
          <dd>
            {fmtDateTime(rec.detectedAt)}
            {rec.detectionCount > 1 ? ` · seen in ${rec.detectionCount} checks` : ''}
          </dd>
        </div>
        <div>
          <dt>Priority</dt>
          <dd>{rec.priority}</dd>
        </div>
      </dl>

      {cmp && (
        <>
          <h4 className="section-label">Compared with {COMPETITORS[cmp.competitorId].name}</h4>
          <div className="table-scroll">
            <table className="table table-compact">
              <thead>
                <tr>
                  <th scope="col">What customers can find</th>
                  <th scope="col" className="col-us">
                    Lifeguard-Pro
                  </th>
                  <th scope="col">{COMPETITORS[cmp.competitorId].name}</th>
                </tr>
              </thead>
              <tbody>
                {(Object.keys(cmp.dims) as (keyof typeof cmp.dims)[]).map((k) => (
                  <tr key={k}>
                    <th scope="row">{COMPARISON_LABELS[k]}</th>
                    <td className="col-us">{cmp.dims[k].ours}</td>
                    <td className={cmp.dims[k].theirs === 'Not assessed' ? 'muted' : ''}>{cmp.dims[k].theirs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h4 className="section-label">Evidence</h4>
      {rec.evidenceIds.length ? (
        <EvidenceList ids={rec.evidenceIds} />
      ) : (
        <p className="muted">Based on a direct check of your own demo data: the current class list differs from what this page shows.</p>
      )}

      {sessions.length > 0 && (
        <>
          <h4 className="section-label">Class facts used</h4>
          <div className="table-scroll">
            <table className="table table-compact">
              <thead>
                <tr>
                  <th scope="col">Class</th>
                  <th scope="col">Date</th>
                  <th scope="col">Seats</th>
                  <th scope="col">Price</th>
                  <th scope="col">Source</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id}>
                    <th scope="row">
                      {COURSE_NAMES[s.courseId]} · {CITIES[s.cityId].name}
                    </th>
                    <td>{sessionDateLabel(s.start, s.end)}</td>
                    <td>{s.status === 'cancelled' ? 'Cancelled' : s.status === 'sold-out' ? 'Sold out' : `${s.available}/${s.capacity}`}</td>
                    <td>{s.conflict?.status === 'open' ? <span className="badge tone-pink">Two prices</span> : money(s.price)}</td>
                    <td>
                      <SourceTag source={s.source} updatedAt={s.updatedAt} verification="sample" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h4 className="section-label">Technical details</h4>
      <dl className="kv small">
        <div>
          <dt>Reference</dt>
          <dd>
            {rec.id} · version {rec.revision}
            {rec.approvedRevision ? ` · approved version ${rec.approvedRevision}` : ''}
          </dd>
        </div>
        <div>
          <dt>Destination</dt>
          <dd>
            {dest.name} · {dest.path} · {CONNECTION_LABEL[dest.connection]} demo connection {state.settings.connections[dest.connection].status}
          </dd>
        </div>
        {sessions.length > 0 && (
          <div>
            <dt>Source versions</dt>
            <dd>{sessions.map((s) => `${s.id} v${rec.sourceVersions[s.id] ?? '?'} (current v${s.version})`).join(', ')}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
