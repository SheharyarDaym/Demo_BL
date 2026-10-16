import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ConfirmDialog, Dialog } from '../components/Dialog';
import { Icon } from '../components/Icon';
import { useToast } from '../components/Toast';
import { DestinationTag, Illustration, SourceTag, StatusBadge } from '../components/ui';
import type { Course, CourseSession, Faq, MediaItem, Review } from '../domain/types';
import { CITIES, COURSE_NAMES } from '../data/static';
import { publishCheck } from '../state/selectors';
import { dependentDestinations, diffSession, sessionStatusLabel } from '../state/facts';
import { whereLabel } from './plain';
import { useReview } from './review';
import { useStore } from '../state/store';
import { compressImage, validateImage } from '../utils/image';
import { fmtDate, fmtDateTime, money, nowIso, sessionDateLabel, sessionTimeLabel } from '../utils/format';

// ---------- Validation helpers ----------

export function isUrl(v: string): boolean {
  try {
    const u = new URL(v);
    return (u.protocol === 'http:' || u.protocol === 'https:') && u.hostname.includes('.');
  } catch {
    return false;
  }
}

function useDirtyReport(dirty: boolean, onDirty: (d: boolean) => void) {
  const cb = useRef(onDirty);
  cb.current = onDirty;
  useLayoutEffect(() => {
    cb.current(dirty);
  }, [dirty]);
  useEffect(() => () => cb.current(false), []);
}

function FieldError({ id, msg }: { id: string; msg?: string }) {
  if (!msg) return null;
  return (
    <span className="field-error" id={id} role="alert">
      {msg}
    </span>
  );
}

// ---------- Generic profile fields ----------

export function FieldsSection({ fieldIds, onDirty, verifiable = [], label }: { fieldIds: string[]; onDirty: (d: boolean) => void; verifiable?: string[]; label?: string }) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const uid = useId();
  const fields = fieldIds.map((id) => state.profile.fields.find((f) => f.id === id)!);
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [verified, setVerified] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const dirty = editing && fields.some((f) => (values[f.id] ?? f.value) !== f.value || (verified.includes(f.id) && f.verification !== 'presenter-confirmed'));
  useDirtyReport(dirty, onDirty);

  const start = () => {
    setValues(Object.fromEntries(fields.map((f) => [f.id, f.value])));
    setVerified(fields.filter((f) => f.verification === 'presenter-confirmed').map((f) => f.id));
    setErrors({});
    setEditing(true);
  };

  const save = () => {
    const errs: Record<string, string> = {};
    for (const f of fields) {
      const v = (values[f.id] ?? '').trim();
      if (f.required && !v) errs[f.id] = `${f.label} is required.`;
      else if (v && f.kind === 'url' && !isUrl(v)) errs[f.id] = 'Enter a full web address starting with https://';
      else if (v && f.kind === 'tel' && !/^[0-9+().\-\s]{7,20}$/.test(v)) errs[f.id] = 'Enter a valid phone number.';
      else if (v && f.kind === 'date' && Number.isNaN(Date.parse(v))) errs[f.id] = 'Enter a valid date.';
      else if (v && f.id === 'social') {
        const bad = v.split(/\n+/).filter((l) => l.trim() && !isUrl(l.trim()));
        if (bad.length) errs[f.id] = 'Each line must be a full web address starting with https://';
      }
    }
    setErrors(errs);
    if (Object.keys(errs).length) {
      toast('Please fix the highlighted fields.', 'error');
      return;
    }
    dispatch({ type: 'PROFILE_SAVE_FIELDS', values, verifiedIds: verified, now: nowIso() });
    setEditing(false);
    toast('Saved.');
  };

  return (
    <div>
      {editing ? (
        <form
          className="form-grid"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          noValidate
        >
          {fields.map((f) => {
            const id = `${uid}-${f.id}`;
            const errId = `${id}-err`;
            const common = {
              id,
              value: values[f.id] ?? '',
              'aria-invalid': !!errors[f.id],
              'aria-describedby': errors[f.id] ? errId : undefined,
              onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValues({ ...values, [f.id]: e.target.value }),
              placeholder: f.prompt,
            };
            return (
              <div key={f.id} className={`field ${f.kind === 'textarea' ? 'field-full' : ''}`}>
                <label className="field-label" htmlFor={id}>
                  {f.label}
                  {f.required && <span aria-hidden="true"> *</span>}
                </label>
                {f.kind === 'textarea' ? <textarea rows={3} {...common} /> : <input type={f.kind === 'date' ? 'date' : f.kind === 'url' ? 'url' : f.kind === 'tel' ? 'tel' : 'text'} {...common} />}
                <FieldError id={errId} msg={errors[f.id]} />
                {verifiable.includes(f.id) && (
                  <label className="check small">
                    <input
                      type="checkbox"
                      checked={verified.includes(f.id)}
                      onChange={(e) => setVerified(e.target.checked ? [...verified, f.id] : verified.filter((x) => x !== f.id))}
                    />
                    I confirm this is verified (demo)
                  </label>
                )}
              </div>
            );
          })}
          <div className="btn-row field-full">
            <button type="submit" className="btn btn-primary">
              Save
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <dl className="field-list">
            {fields.map((f) => (
              <div key={f.id} className="field-row">
                <dt>{f.label}</dt>
                <dd>
                  {f.value ? (
                    <span className="pre">{f.value}</span>
                  ) : (
                    <span className="missing">
                      <Icon name="alert" size={14} /> Missing — {f.prompt ?? 'add this information.'}
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
          <button className="btn btn-secondary btn-sm" onClick={start} aria-label={`Edit ${label ?? 'these details'}`}>
            <Icon name="edit" size={16} /> Edit
          </button>
        </>
      )}
    </div>
  );
}

// ---------- Courses ----------

export function CourseCard({ course, onDirty, onResolve }: { course: Course; onDirty: (d: boolean) => void; onResolve: (s: CourseSession) => void }) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const uid = useId();
  const [draft, setDraft] = useState<Course | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  useDirtyReport(!!draft && JSON.stringify(draft) !== JSON.stringify(course), onDirty);
  const sessions = state.profile.sessions.filter((s) => s.courseId === course.id);

  const save = () => {
    if (!draft) return;
    const e: Record<string, string> = {};
    if (!draft.name.trim()) e.name = 'Course name is required.';
    if (draft.registrationUrl && !isUrl(draft.registrationUrl)) e.registrationUrl = 'Enter a full web address starting with https://';
    setErrors(e);
    if (Object.keys(e).length) return;
    dispatch({ type: 'COURSE_SAVE', course: draft, now: nowIso() });
    setDraft(null);
    toast('Course saved.');
  };

  const input = (key: keyof Course, label: string, area?: boolean) => {
    const id = `${uid}-${key}`;
    return (
      <div className={`field ${area ? 'field-full' : ''}`}>
        <label className="field-label" htmlFor={id}>
          {label}
        </label>
        {area ? (
          <textarea id={id} rows={2} value={String(draft![key])} onChange={(ev) => setDraft({ ...draft!, [key]: ev.target.value })} />
        ) : (
          <input id={id} value={String(draft![key])} aria-invalid={!!errors[key]} onChange={(ev) => setDraft({ ...draft!, [key]: ev.target.value })} />
        )}
        <FieldError id={`${id}-err`} msg={errors[key]} />
      </div>
    );
  };

  return (
    <article className="sub-card">
      <div className="sub-head">
        <h3>{course.name}</h3>
      </div>
      {draft ? (
        <div className="form-grid">
          {input('name', 'Course name *')}
          {input('duration', 'Duration')}
          {input('description', 'Description', true)}
          {input('prerequisites', 'Prerequisites', true)}
          {input('registrationUrl', 'Registration destination')}
          <div className="btn-row field-full">
            <button className="btn btn-primary" onClick={save}>
              Save
            </button>
            <button className="btn btn-secondary" onClick={() => setDraft(null)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <p>{course.description}</p>
          <dl className="kv kv-2">
            <div>
              <dt>Prerequisites</dt>
              <dd>{course.prerequisites}</dd>
            </div>
            <div>
              <dt>Duration</dt>
              <dd>{course.duration}</dd>
            </div>
            <div>
              <dt>Registration destination</dt>
              <dd>{course.registrationUrl}</dd>
            </div>
          </dl>
          <h4 className="section-label">Sample price by city</h4>
          <ul className="price-list">
            {sessions.map((s) => (
              <li key={s.id}>
                <span>{CITIES[s.cityId].name}</span>
                {s.conflict?.status === 'open' ? (
                  <span className="conflict-inline">
                    <span className="badge tone-pink">
                      <Icon name="alert" size={14} /> Two prices on record: {money(s.conflict.values.odoo)} or {money(s.conflict.values.website)}
                    </span>
                    <button className="btn btn-primary btn-sm" onClick={() => onResolve(s)}>
                      Resolve price
                    </button>
                  </span>
                ) : (
                  <span>
                    <strong>{money(s.price)}</strong>{' '}

                  </span>
                )}
              </li>
            ))}
          </ul>
          <button className="btn btn-secondary btn-sm" onClick={() => setDraft({ ...course })} aria-label={`Edit ${course.name} course`}>
            <Icon name="edit" size={16} /> Edit course
          </button>
        </>
      )}
    </article>
  );
}

// ---------- Upcoming classes ----------

export function SessionRow({ session, onDirty }: { session: CourseSession; onDirty: (d: boolean) => void }) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const navigate = useNavigate();
  const uid = useId();
  const [draft, setDraft] = useState<CourseSession | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  useDirtyReport(!!draft && JSON.stringify(draft) !== JSON.stringify(session), onDirty);
  const conflictOpen = session.conflict?.status === 'open';

  const save = () => {
    if (!draft) return;
    const e: Record<string, string> = {};
    if (!draft.venue.trim()) e.venue = 'Venue is required.';
    if (!draft.start || Number.isNaN(Date.parse(draft.start))) e.start = 'Enter a valid start date and time.';
    if (!draft.end || Number.isNaN(Date.parse(draft.end))) e.end = 'Enter a valid end date and time.';
    else if (draft.end <= draft.start) e.end = 'End must be after the start.';
    if (!draft.deadline || Number.isNaN(Date.parse(draft.deadline))) e.deadline = 'Enter a valid deadline.';
    else if (draft.deadline > draft.start.slice(0, 10)) e.deadline = 'Deadline must be on or before the start date.';
    if (!Number.isInteger(draft.capacity) || draft.capacity < 1) e.capacity = 'Capacity must be a whole number of at least 1.';
    if (!Number.isInteger(draft.available) || draft.available < 0) e.available = 'Available seats must be 0 or more.';
    else if (draft.available > draft.capacity) e.available = 'Available seats can’t exceed capacity.';
    if (!conflictOpen && (draft.price === null || Number.isNaN(draft.price) || draft.price < 0)) e.price = 'Price must be 0 or more.';
    setErrors(e);
    if (Object.keys(e).length) {
      toast('Please fix the highlighted fields.', 'error');
      return;
    }
    dispatch({ type: 'SESSION_SAVE', session: draft, now: nowIso() });
    setDraft(null);
    const s = state.settings;
    if (s.automationPaused) toast('Saved. Demo automation is paused, so the change was queued.', 'info');
    else if (s.freshnessPolicy === 'auto') toast('Saved. Factual details on affected demo pages were synced — see Activity.', 'success', { label: 'View activity', onClick: () => navigate('/activity') });
    else
      toast('Saved. Affected pages need review before they change.', 'success', {
        label: 'Review updates',
        onClick: () => {
          dispatch({ type: 'UI_SET', patch: { recFilters: { city: 'all', destination: 'all', priority: 'all', status: 'awaiting', q: '' } } });
          navigate('/recommendations');
        },
      });
  };

  const num = (key: 'capacity' | 'available' | 'price', label: string, disabled?: boolean, help?: string) => {
    const id = `${uid}-${key}`;
    return (
      <div className="field">
        <label className="field-label" htmlFor={id}>
          {label}
        </label>
        <input
          id={id}
          type="number"
          min={0}
          step={1}
          disabled={disabled}
          value={draft![key] === null ? '' : String(draft![key])}
          aria-invalid={!!errors[key]}
          aria-describedby={errors[key] ? `${id}-err` : help ? `${id}-help` : undefined}
          onChange={(ev) => setDraft({ ...draft!, [key]: ev.target.value === '' ? (key === 'price' ? null : NaN) : Number(ev.target.value) })}
        />
        {help && (
          <span className="muted small" id={`${id}-help`}>
            {help}
          </span>
        )}
        <FieldError id={`${id}-err`} msg={errors[key]} />
      </div>
    );
  };

  const text = (key: 'venue' | 'start' | 'end' | 'deadline', label: string, type: string) => {
    const id = `${uid}-${key}`;
    return (
      <div className="field">
        <label className="field-label" htmlFor={id}>
          {label}
        </label>
        <input
          id={id}
          type={type}
          value={draft![key]}
          aria-invalid={!!errors[key]}
          aria-describedby={errors[key] ? `${id}-err` : undefined}
          onChange={(ev) => setDraft({ ...draft!, [key]: ev.target.value })}
        />
        <FieldError id={`${id}-err`} msg={errors[key]} />
      </div>
    );
  };

  const label = sessionStatusLabel(session);
  return (
    <li className="session">
      <div className="session-main">
        <div>
          <strong>
            {COURSE_NAMES[session.courseId]} · {CITIES[session.cityId].name}
          </strong>
        </div>
        <div>
          {sessionDateLabel(session.start, session.end)}
          <span className="muted small block">{sessionTimeLabel(session.start, session.end)} · America/New_York</span>
        </div>
        <div>
          {session.venue}
          <span className="muted small block">Register by {fmtDate(session.deadline)}</span>
        </div>
        <div>
          <span className={`badge ${label === 'Scheduled' ? 'tone-green' : label === 'Cancelled' ? 'tone-gray' : 'tone-pink'}`}>{label}</span>
          <span className="small block">
            {session.available} of {session.capacity} seats
          </span>
        </div>
        <div>
          {conflictOpen ? <span className="badge tone-pink">Two prices on record</span> : <strong>{money(session.price)}</strong>}
        </div>
        {!draft && (
          <button className="btn btn-secondary btn-sm" onClick={() => setDraft({ ...session })} aria-label={`Edit ${COURSE_NAMES[session.courseId]} class in ${CITIES[session.cityId].name}`}>
            <Icon name="edit" size={16} /> Edit
          </button>
        )}
      </div>
      {draft && (
        <form
          className="form-grid session-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          {text('venue', 'Venue *', 'text')}
          {text('start', 'Start (ET)', 'datetime-local')}
          {text('end', 'End (ET)', 'datetime-local')}
          {text('deadline', 'Registration deadline', 'date')}
          {num('capacity', 'Capacity')}
          {num('available', 'Available seats')}
          {num('price', 'Sample price ($)', conflictOpen, conflictOpen ? 'Resolve the price first (Courses & dates).' : undefined)}
          <div className="field">
            <label className="field-label" htmlFor={`${uid}-status`}>
              Status
            </label>
            <select id={`${uid}-status`} value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as CourseSession['status'] })}>
              <option value="scheduled">Scheduled</option>
              <option value="sold-out">Sold out</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div className="btn-row field-full">
            <button type="submit" className="btn btn-primary">
              Save
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setDraft(null)}>
              Cancel
            </button>
          </div>
          <ChangeOutcome before={session} draft={draft} />
        </form>
      )}
    </li>
  );
}

/** Plain-language explanation of what a class edit will affect. */
function ChangeOutcome({ before, draft }: { before: CourseSession; draft: CourseSession }) {
  const { state } = useStore();
  const { fields } = diffSession(before, draft);
  const pages = dependentDestinations(state.destinations, draft, fields).map((d) => whereLabel(d));
  const list = pages.length > 1 ? `${pages.slice(0, -1).join(', ')} and ${pages[pages.length - 1]}` : pages[0];
  const policy = state.settings.automationPaused
    ? 'Automatic updates are paused, so the change will wait until they resume.'
    : state.settings.freshnessPolicy === 'auto'
      ? 'Dates, seats, status and prices already shown on these pages will update automatically.'
      : 'Pages won’t change until you approve the suggested update.';
  return (
    <div className="outcome field-full" role="status" aria-live="polite">
      <Icon name="info" size={16} />
      <span>
        {!fields.length ? (
          'Change a value to see which pages it affects.'
        ) : (
          <>
            This change affects the <strong>{list ?? 'class list only'}</strong>. {policy}
            {draft.status === 'cancelled' && ' Cancelled classes lose their registration button.'}
            {draft.status !== 'cancelled' && (draft.status === 'sold-out' || draft.available === 0) && ' The class will show as sold out with no registration button.'}
          </>
        )}
      </span>
    </div>
  );
}

// ---------- FAQs ----------

export function FaqEditor({ onDirty }: { onDirty: (d: boolean) => void }) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [draft, setDraft] = useState<Faq[] | null>(null);
  const [error, setError] = useState('');
  useDirtyReport(!!draft && JSON.stringify(draft) !== JSON.stringify(state.profile.faqs), onDirty);
  const save = () => {
    if (!draft) return;
    if (draft.some((f) => !f.question.trim() || !f.answer.trim())) {
      setError('Every question needs both a question and an answer.');
      return;
    }
    dispatch({ type: 'FAQS_SAVE', faqs: draft, now: nowIso() });
    setDraft(null);
    setError('');
    toast('FAQs saved.');
  };
  return (
    <div>
      <h3 className="section-label">Common questions</h3>
      {draft ? (
        <div className="faq-edit">
          {draft.map((f, i) => (
            <fieldset key={f.id} className="faq-item">
              <legend className="sr-only">Question {i + 1}</legend>
              <label className="field">
                <span className="field-label">Question {i + 1}</span>
                <input value={f.question} onChange={(e) => setDraft(draft.map((x, j) => (j === i ? { ...x, question: e.target.value } : x)))} />
              </label>
              <label className="field">
                <span className="field-label">Answer</span>
                <textarea rows={2} value={f.answer} onChange={(e) => setDraft(draft.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)))} />
              </label>
              <button className="btn btn-ghost btn-sm" onClick={() => setDraft(draft.filter((_, j) => j !== i))}>
                <Icon name="trash" size={16} /> Remove question
              </button>
            </fieldset>
          ))}
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <div className="btn-row">
            <button className="btn btn-ghost" onClick={() => setDraft([...draft, { id: `FAQ-${Date.now()}`, question: '', answer: '', source: 'manual', updatedAt: nowIso() }])}>
              + Add question
            </button>
            <button className="btn btn-primary" onClick={save}>
              Save
            </button>
            <button className="btn btn-secondary" onClick={() => setDraft(null)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <dl className="faq-list">
            {state.profile.faqs.map((f) => (
              <div key={f.id}>
                <dt>
                  {f.question} <SourceTag source={f.source} updatedAt={f.updatedAt} verification="sample" />
                </dt>
                <dd>{f.answer}</dd>
              </div>
            ))}
          </dl>
          <button className="btn btn-secondary btn-sm" onClick={() => setDraft(state.profile.faqs.map((f) => ({ ...f })))}>
            <Icon name="edit" size={16} /> Edit FAQs
          </button>
        </>
      )}
    </div>
  );
}

// ---------- Media ----------

export function MediaGrid() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [removing, setRemoving] = useState<MediaItem | null>(null);

  const onFile = async (m: MediaItem, file: File | undefined) => {
    if (!file) return;
    const err = validateImage(file);
    if (err) {
      setErrors({ ...errors, [m.id]: err });
      return;
    }
    setBusy(m.id);
    try {
      const data = await compressImage(file);
      dispatch({ type: 'MEDIA_SET', id: m.id, dataUrl: data, now: nowIso() });
      setErrors({ ...errors, [m.id]: '' });
      toast(`${m.label} updated. Stored locally in this browser only.`);
    } catch (e) {
      setErrors({ ...errors, [m.id]: e instanceof Error ? e.message : 'Upload failed.' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <ul className="media-grid">
        {state.profile.media.map((m) => {
          const filled = Boolean(m.dataUrl || m.illustration);
          return (
            <li key={m.id} className="media-card">
              <div className="media-frame">
                {m.dataUrl ? (
                  <img src={m.dataUrl} alt={`${m.label} (uploaded in demo)`} />
                ) : m.illustration ? (
                  <Illustration kind={m.illustration} />
                ) : (
                  <div className="media-empty">
                    <Icon name="image" size={26} />
                    <span>No {m.kind === 'video' ? 'video' : 'image'} yet</span>
                  </div>
                )}
                {m.sample && filled && <span className="media-flag">Sample media</span>}
              </div>
              <div className="media-info">
                <strong>{m.label}</strong>
                <span className="muted small">{m.caption}</span>
                <DestinationTag>{m.destination}</DestinationTag>
              </div>
              <div className="btn-row">
                {m.kind === 'image' ? (
                  <label className={`btn btn-secondary btn-sm file-btn ${busy === m.id ? 'disabled' : ''}`}>
                    <Icon name="upload" size={16} />
                    {busy === m.id ? 'Processing…' : filled ? 'Replace' : 'Upload'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="sr-only"
                      disabled={busy !== null}
                      onChange={(e) => {
                        onFile(m, e.target.files?.[0]);
                        e.target.value = '';
                      }}
                    />
                  </label>
                ) : (
                  <span className="muted small">Video upload isn’t part of this demo.</span>
                )}
                {filled && (
                  <button className="btn btn-ghost btn-sm" onClick={() => setRemoving(m)}>
                    <Icon name="trash" size={16} /> Remove
                  </button>
                )}
              </div>
              {errors[m.id] && (
                <p className="field-error" role="alert">
                  {errors[m.id]}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <p className="muted small">PNG, JPEG, WebP or GIF up to 5 MB. Images are resized and kept only in this browser’s demo storage.</p>
      <ConfirmDialog
        open={!!removing}
        title={`Remove ${removing?.label.toLowerCase()}?`}
        confirmLabel="Remove"
        danger
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          dispatch({ type: 'MEDIA_SET', id: removing!.id, dataUrl: null, now: nowIso() });
          toast(`${removing!.label} removed.`, 'info');
          setRemoving(null);
        }}
      >
        <p>The slot will be empty and count as missing in the profile checklist.</p>
      </ConfirmDialog>
    </>
  );
}

// ---------- Reviews ----------

export function Stars({ n }: { n: number }) {
  return (
    <span className="stars" role="img" aria-label={`${n} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
          <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" fill={i <= n ? '#e0a100' : '#d5dde8'} />
        </svg>
      ))}
    </span>
  );
}

function demoReply(r: Review): string {
  if (r.rating >= 5) return `Thank you for the kind words, ${r.author}! We’re glad the course went well and hope to see you at a future class.`;
  return `Thank you for your feedback, ${r.author}. We’re glad you enjoyed the instructors, and we’re working to make upcoming class dates easier to find on our website.`;
}

/** Inline review reply: write or generate, save a draft, then review & apply in the review panel. */
export function ReviewItem({ review }: { review: Review }) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const { open } = useReview();
  const rec = review.recommendationId ? state.recommendations.find((r) => r.id === review.recommendationId) : undefined;
  const [writing, setWriting] = useState(false);
  const [text, setText] = useState('');
  useEffect(() => setText(rec?.proposed.text ?? ''), [rec?.proposed.text]);
  const locked = rec && ['publishing', 'blocked', 'rejected', 'deferred', 'published'].includes(rec.status);

  const save = () => {
    if (!text.trim()) {
      toast('Write or generate a reply first.', 'error');
      return;
    }
    dispatch({ type: 'REVIEW_DRAFT_REPLY', reviewId: review.id, text, now: nowIso() });
    setWriting(false);
    toast('Reply saved as a draft. Review & apply it when ready.');
  };

  return (
    <li className="review-item">
      <div className="review-top">
        <Stars n={review.rating} />
        <strong>{review.author}</strong>
        <span className="muted small">
          {fmtDate(review.date)} · {CITIES[review.cityId].name} · sample review
        </span>
      </div>
      <p>“{review.text}”</p>
      {review.publishedReply && (
        <p className="reply-shown">
          <strong>Your reply (demo):</strong> {review.publishedReply}
        </p>
      )}
      {writing && (
        <div className="reply-edit">
          <label className="field">
            <span className="field-label">Reply to {review.author}</span>
            <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a reply, or generate a demo reply" data-autofocus />
          </label>
          {rec && (rec.status === 'approved' || rec.status === 'failed') && text !== rec.proposed.text && (
            <p className="field-warn">
              <Icon name="alert" size={14} /> Saving means the new reply must be approved again.
            </p>
          )}
          <div className="btn-row">
            <button className="btn btn-ghost btn-sm" onClick={() => setText(demoReply(review))}>
              <Icon name="spark" size={16} /> Generate demo reply
            </button>
            <button className="btn btn-secondary btn-sm" onClick={save}>
              Save draft
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setWriting(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
      <div className="review-foot">
        {review.publishedReply ? (
          <span className="badge tone-green">Replied (demo)</span>
        ) : rec ? (
          <StatusBadge status={rec.status} />
        ) : (
          <span className="badge tone-gray">No reply yet</span>
        )}
        <div className="btn-row">
          {!writing && !locked && !review.publishedReply && (
            <button className="btn btn-secondary btn-sm" onClick={() => setWriting(true)}>
              {rec ? 'Edit reply' : 'Write reply'}
            </button>
          )}
          {rec && (
            <button className="btn btn-primary btn-sm" onClick={() => open(rec.id)}>
              {rec.status === 'published' ? 'View reply' : 'Review & apply'}
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
