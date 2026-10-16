import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useBlocker, useSearchParams } from 'react-router-dom';
import { ConfirmDialog } from '../components/Dialog';
import { Icon } from '../components/Icon';
import { useToast } from '../components/Toast';
import { Disclosure, SOURCE_LABEL, SampleNote, SourceTag, StatusBadge, VERIFICATION_LABEL } from '../components/ui';
import type { CourseSession } from '../domain/types';
import { ConflictDialog } from '../features/ConflictDialog';
import { DestinationDialog } from '../features/DestinationDialog';
import { CourseCard, FaqEditor, FieldsSection, MediaGrid, ReviewItem, SessionRow } from '../features/ProfileParts';
import { useReview } from '../features/review';
import { isUnresolved, profileChecklist } from '../state/selectors';
import { useStore } from '../state/store';
import { CITIES, COURSE_NAMES } from '../data/static';
import { fmtDateTime, nowIso } from '../utils/format';

const GROUPS = {
  about: { label: 'About the business', ids: ['name', 'description', 'primaryCategory', 'additionalCategories', 'openingDate'] },
  contact: { label: 'Contact and location', ids: ['website', 'phone', 'address', 'serviceAreas', 'registrationLink', 'social'] },
  hours: { label: 'Hours and attributes', ids: ['regularHours', 'specialHours', 'attributes'] },
  trust: { label: 'Why choose us and instructors', ids: ['whyChooseUs', 'credentials', 'instructors'] },
};

function Section({ id, title, summary, badge, open, onToggle, children }: { id: string; title: string; summary: ReactNode; badge?: ReactNode; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <section className={`panel psec ${open ? 'open' : ''}`} id={`sec-${id}`} aria-labelledby={`sec-${id}-h`}>
      <button className="psec-head" aria-expanded={open} aria-controls={`sec-${id}-body`} onClick={onToggle}>
        <span>
          <h2 id={`sec-${id}-h`}>{title}</h2>
          <span className="muted small">{summary}</span>
        </span>
        <span className="psec-right">
          {badge}
          <Icon name="chevronDown" className="psec-chev" />
        </span>
      </button>
      {open && (
        <div className="psec-body" id={`sec-${id}-body`}>
          {children}
        </div>
      )}
    </section>
  );
}

/** Source, last update and verification for a set of fields — kept out of the default view. */
function FieldSources({ ids }: { ids: string[] }) {
  const { state } = useStore();
  const fields = ids.map((id) => state.profile.fields.find((f) => f.id === id)!).filter(Boolean);
  return (
    <ul className="sources">
      {fields.map((f) => (
        <li key={f.id}>
          <strong>{f.label}</strong>
          <span>
            <SourceTag source={f.source} updatedAt={f.updatedAt} verification={f.verification} />
          </span>
          <span className="muted small">
            {VERIFICATION_LABEL[f.verification]} · updated {fmtDateTime(f.updatedAt)} · used on {f.destination}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function BusinessPage() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const { open: openReview } = useReview();
  const [params] = useSearchParams();
  const [open, setOpen] = useState<Set<string>>(() => new Set([params.get('open') ?? 'courses']));
  const [conflict, setConflict] = useState<CourseSession | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [postText, setPostText] = useState('');
  const [postError, setPostError] = useState('');
  const [collapseAsk, setCollapseAsk] = useState<string | null>(null);
  const dirty = useRef<Record<string, boolean>>({});
  const [anyDirty, setAnyDirty] = useState(false);

  const report = useCallback(
    (key: string) => (d: boolean) => {
      dirty.current[key] = d;
      setAnyDirty(Object.values(dirty.current).some(Boolean));
    },
    [],
  );
  const sectionDirty = (id: string) => Object.entries(dirty.current).some(([k, v]) => v && k.startsWith(`${id}:`));

  // Read the ref so a click straight after the last keystroke is still guarded.
  const blocker = useBlocker(({ currentLocation, nextLocation }) => Object.values(dirty.current).some(Boolean) && currentLocation.pathname !== nextLocation.pathname);
  useEffect(() => {
    if (!anyDirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [anyDirty]);

  useEffect(() => {
    const o = params.get('open');
    if (o) {
      setOpen((s) => new Set(s).add(o));
      requestAnimationFrame(() => document.getElementById(`sec-${o}`)?.scrollIntoView({ block: 'start' }));
    }
  }, [params]);

  const toggle = (id: string) => {
    if (open.has(id) && sectionDirty(id)) {
      setCollapseAsk(id);
      return;
    }
    setOpen((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const checklist = profileChecklist(state);
  const filled = checklist.filter((c) => c.filled).length;
  const verified = checklist.filter((c) => c.verification === 'Verified identity' || c.verification === 'Presenter-confirmed (demo)').length;
  const missingIn = (ids: string[]) => checklist.filter((c) => ids.includes(c.id) && !c.filled).length;
  const missingBadge = (ids: string[]) => {
    const n = missingIn(ids);
    return n ? <span className="badge tone-amber">{n} missing</span> : <span className="badge tone-green">Complete</span>;
  };

  const openConflicts = state.profile.sessions.filter((s) => s.conflict?.status === 'open');
  const postRecs = state.recommendations.filter((r) => r.destinationId === 'DEST-GBP-POSTS' && isUnresolved(r));
  const posts = state.destinations.find((d) => d.id === 'DEST-GBP-POSTS')!.content.items ?? [];
  const detailIds = [...GROUPS.about.ids, ...GROUPS.contact.ids, ...GROUPS.hours.ids];
  const trustMediaIds = [...GROUPS.trust.ids, ...state.profile.media.map((m) => m.id)];

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Our Business</h1>
          <p className="muted">The facts customers see on your website and Google profile. Open a section to read or edit it.</p>
        </div>
      </header>

      {openConflicts.length > 0 && (
        <div className="callout callout-warn">
          <Icon name="alert" />
          <div>
            <strong>One detail needs a decision</strong>
            <p>Your records show two prices for the Boston certification class. Some suggestions are waiting for this.</p>
            <button className="btn btn-primary btn-sm" onClick={() => setConflict(openConflicts[0])}>
              Resolve price
            </button>
          </div>
        </div>
      )}

      <Disclosure label="Check missing information" hint={`${filled} of ${checklist.length} items filled`} className="panel-disclosure">
        <div className="completeness">
          <p>
            <strong>
              Profile information: {filled} of {checklist.length} applicable items filled
            </strong>{' '}
            · {verified} verified or confirmed by you.
          </p>
          <div className="meter" role="img" aria-label={`${filled} of ${checklist.length} items filled`}>
            <span style={{ width: `${(filled / checklist.length) * 100}%` }} />
          </div>
          <p className="muted small">This measures how complete the demo information is. It is not a Google ranking score. Missing items count as missing; sample values are not counted as verified.</p>
          <ul className="checklist">
            {checklist.map((c) => (
              <li key={c.id} className={c.filled ? 'ok' : 'missing'}>
                <Icon name={c.filled ? 'checkCircle' : 'alert'} size={16} />
                <span>{c.label}</span>
                <span className="muted small">{c.verification}</span>
              </li>
            ))}
          </ul>
          <SampleNote>The brand name and website are real identity details; the live site was not audited. Everything else is sample data, and unknown details are left empty.</SampleNote>
        </div>
      </Disclosure>

      <Section id="details" title="Business details" summary="Description, categories, contact, location, hours and attributes" badge={missingBadge(detailIds)} open={open.has('details')} onToggle={() => toggle('details')}>
        {(['about', 'contact', 'hours'] as const).map((g) => (
          <div key={g} className="field-group">
            <h3 className="section-label">{GROUPS[g].label}</h3>
            <FieldsSection fieldIds={GROUPS[g].ids} onDirty={report(`details:${g}`)} label={GROUPS[g].label.toLowerCase()} />
          </div>
        ))}
        <Disclosure label="Where this information comes from" hint="Sources, last updates and verification">
          <FieldSources ids={detailIds} />
        </Disclosure>
      </Section>

      <Section
        id="courses"
        title="Courses & dates"
        summary="Course descriptions, prices and upcoming classes"
        badge={openConflicts.length ? <span className="badge tone-pink">Price needs a decision</span> : <span className="badge tone-blue">{state.profile.sessions.length} classes</span>}
        open={open.has('courses')}
        onToggle={() => toggle('courses')}
      >
        <div className="sub-grid">
          {state.profile.courses.map((c) => (
            <CourseCard key={c.id} course={c} onDirty={report(`courses:${c.id}`)} onResolve={setConflict} />
          ))}
        </div>
        <h3 className="section-label sessions-h">Upcoming classes (Eastern Time)</h3>
        <ul className="sessions">
          {state.profile.sessions.map((s) => (
            <SessionRow key={s.id} session={s} onDirty={report(`courses:${s.id}`)} />
          ))}
        </ul>
        <div className="btn-row">
          <span className="muted small">See how classes appear:</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setPreview('DEST-WEB-BOS-COURSE')}>
            <Icon name="eye" size={16} /> Boston course page
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setPreview('DEST-WEB-MIA-COURSE')}>
            <Icon name="eye" size={16} /> Miami course page
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setPreview('DEST-WEB-PRICING')}>
            <Icon name="eye" size={16} /> Pricing section
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setPreview('DEST-WEB-SCHEMA')}>
            <Icon name="eye" size={16} /> Details for search engines
          </button>
        </div>
        <Disclosure label="Where this information comes from" hint="Sources, record references, versions and price decisions">
          <ul className="sources">
            {state.profile.courses.map((c) => (
              <li key={c.id}>
                <strong>{c.name} (course)</strong>
                <span>
                  <SourceTag source={c.source} updatedAt={c.updatedAt} verification="sample" />
                </span>
                <span className="muted small">
                  Version {c.version} · updated {fmtDateTime(c.updatedAt)}
                </span>
              </li>
            ))}
            {state.profile.sessions.map((s) => (
              <li key={s.id}>
                <strong>
                  {COURSE_NAMES[s.courseId]} · {CITIES[s.cityId].name}
                </strong>
                <span>
                  <SourceTag source={s.source} updatedAt={s.updatedAt} verification="sample" />
                </span>
                <span className="muted small">
                  Record {s.id} · version {s.version} · updated {fmtDateTime(s.updatedAt)}
                  {s.conflict?.status === 'resolved' && ` · price decided: ${SOURCE_LABEL[s.conflict.chosen!]}`}
                  {s.conflict?.status === 'open' && ' · two prices on record'}
                </span>
              </li>
            ))}
          </ul>
          {state.pendingSync.length > 0 && <p className="muted small">{state.pendingSync.length} class change(s) are waiting while automatic updates are paused.</p>}
        </Disclosure>
      </Section>

      <Section id="trust" title="Trust & media" summary="Why choose us, credentials, instructors, common questions, photos and video" badge={missingBadge(trustMediaIds)} open={open.has('trust')} onToggle={() => toggle('trust')}>
        <div className="field-group">
          <h3 className="section-label">{GROUPS.trust.label}</h3>
          <FieldsSection fieldIds={GROUPS.trust.ids} onDirty={report('trust:fields')} verifiable={['credentials', 'instructors']} label="trust details" />
        </div>
        <div className="field-group">
          <FaqEditor onDirty={report('trust:faq')} />
        </div>
        <div className="field-group">
          <h3 className="section-label">Photos and video</h3>
          <MediaGrid />
        </div>
        <Disclosure label="Where this information comes from" hint="Sources, last updates and verification">
          <FieldSources ids={GROUPS.trust.ids} />
        </Disclosure>
      </Section>

      <Section
        id="reviews"
        title="Reviews & posts"
        summary="Sample reviews, replies and Google posts"
        badge={<span className="badge tone-blue">{state.profile.reviews.filter((r) => !r.publishedReply).length} without reply</span>}
        open={open.has('reviews')}
        onToggle={() => toggle('reviews')}
      >
        <div className="sub-grid">
          <div>
            <h3 className="section-label">Sample reviews</h3>
            <ul className="review-list">
              {state.profile.reviews.map((r) => (
                <ReviewItem key={r.id} review={r} />
              ))}
            </ul>
          </div>
          <div>
            <h3 className="section-label">Google posts (demo)</h3>
            {postRecs.length > 0 && (
              <ul className="post-list">
                {postRecs.map((r) => (
                  <li key={r.id}>
                    <StatusBadge status={r.status} />
                    <span>{r.proposed.text}</span>
                    <button className="btn btn-link btn-sm" onClick={() => openReview(r.id)}>
                      Review
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <ul className="post-list">
              {posts.map((p) => (
                <li key={p.id}>
                  <span className="badge tone-green">Posted (demo)</span>
                  <span>
                    {p.text}
                    <span className="muted small block">{fmtDateTime(p.at)}</span>
                  </span>
                </li>
              ))}
            </ul>
            <form
              className="new-post"
              onSubmit={(e) => {
                e.preventDefault();
                if (postText.trim().length < 10) {
                  setPostError('Write at least 10 characters.');
                  return;
                }
                dispatch({ type: 'POST_CREATE', text: postText.trim(), now: nowIso() });
                setPostText('');
                setPostError('');
                toast('Post saved as a draft. Open it from the list above to approve and apply.');
              }}
            >
              <label className="field">
                <span className="field-label">New demo post</span>
                <textarea rows={2} value={postText} onChange={(e) => setPostText(e.target.value)} placeholder="Short announcement for your Google profile" aria-invalid={!!postError} />
              </label>
              {postError && (
                <p className="field-error" role="alert">
                  {postError}
                </p>
              )}
              <button className="btn btn-secondary btn-sm" type="submit">
                Save post draft
              </button>
            </form>
          </div>
        </div>
      </Section>

      <ConflictDialog session={conflict} onClose={() => setConflict(null)} />
      <DestinationDialog destId={preview} onClose={() => setPreview(null)} />
      <ConfirmDialog
        open={blocker.state === 'blocked'}
        title="Discard unsaved changes?"
        confirmLabel="Discard and leave"
        danger
        onCancel={() => blocker.reset?.()}
        onConfirm={() => {
          dirty.current = {};
          setAnyDirty(false);
          blocker.proceed?.();
        }}
      >
        <p>You have edits in Our Business that haven’t been saved.</p>
      </ConfirmDialog>
      <ConfirmDialog
        open={!!collapseAsk}
        title="Discard unsaved changes?"
        confirmLabel="Discard"
        danger
        onCancel={() => setCollapseAsk(null)}
        onConfirm={() => {
          const id = collapseAsk!;
          setCollapseAsk(null);
          setOpen((s) => {
            const n = new Set(s);
            n.delete(id);
            return n;
          });
        }}
      >
        <p>This section has edits that haven’t been saved.</p>
      </ConfirmDialog>
    </div>
  );
}
