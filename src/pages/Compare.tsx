import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { useToast } from '../components/Toast';
import { BackLink, Disclosure, EmptyState, InfoTip, SampleNote, Segmented, Select } from '../components/ui';
import type { AiResponse, Channel, CityId, CompetitorFilters, CompetitorId, ComparisonDimension, SearchObservation } from '../domain/types';
import {
  AI_PLATFORMS,
  AI_PLATFORM_IDS,
  AI_RESPONSES,
  CITIES,
  COMPARISONS,
  COMPETITORS,
  COMPETITOR_IDS,
  EVIDENCE,
  OBSERVATIONS,
  QUERIES,
} from '../data/static';
import { EvidenceItem } from '../features/Evidence';
import { useReview } from '../features/review';
import { nextRecId } from '../state/selectors';
import { useStore } from '../state/store';
import { fmtDateTime, nowIso } from '../utils/format';

const ROW_LABEL: Record<ComparisonDimension, string> = {
  pricing: 'Course price',
  schedules: 'Upcoming dates',
  faqs: 'Common questions',
  reviews: 'Reviews',
  freshness: 'Recently updated',
  structuredData: 'Class details for search engines',
};

const CHANNELS: { value: Channel; label: string }[] = [
  { value: 'organic', label: 'Google Search' },
  { value: 'maps', label: 'Google Maps' },
  { value: 'ai', label: 'AI answers' },
];

const AI_ISSUES: Record<string, string> = {
  'AI-CG-MIA-1': 'mia-ai',
  'AI-GE-MIA-1': 'mia-ai',
  'AI-CP-MIA-1': 'mia-ai',
  'AI-GE-BOS-2': 'bos-price',
};

const DEFAULT_COMPETITOR: Record<CityId, CompetitorId> = { boston: 'harbor', miami: 'coastal' };

/** Opens the related suggestion, creating it once if needed (no duplicates). */
function useOpenSuggestion() {
  const { state, dispatch } = useStore();
  const { open } = useReview();
  const toast = useToast();
  return (issueKey: string) => {
    const existing = state.recommendations.find((r) => r.issueKey === issueKey);
    if (existing) return open(existing.id);
    const id = nextRecId(state);
    dispatch({ type: 'REC_FROM_EVIDENCE', issueKey, now: nowIso() });
    toast('New suggestion created from this evidence.');
    open(id);
  };
}

function PosCell({ cur, prev }: { cur: number | null; prev: number | null }) {
  if (cur === null) return <span className="muted">Not observed</span>;
  const delta = prev === null ? null : prev - cur;
  return (
    <span className="pos">
      <strong>#{cur}</strong>
      {delta === null ? null : delta === 0 ? (
        <span className="muted small">±0</span>
      ) : (
        <span className={`small ${delta > 0 ? 'up' : 'down'}`} aria-label={delta > 0 ? `up ${delta} since Oct 9` : `down ${-delta} since Oct 9`}>
          {delta > 0 ? '▲' : '▼'}
          {Math.abs(delta)}
        </span>
      )}
    </span>
  );
}

export function ComparePage() {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const f = state.ui.compFilters;
  const set = (patch: Partial<CompetitorFilters>) => dispatch({ type: 'UI_SET', patch: { compFilters: { ...f, ...patch } } });
  const [competitor, setCompetitor] = useState<CompetitorId>(DEFAULT_COMPETITOR[f.city]);
  const [details, setDetails] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);
  const openSuggestion = useOpenSuggestion();
  useEffect(() => setCompetitor(DEFAULT_COMPETITOR[f.city]), [f.city]);

  const viewSuggestions = () => {
    dispatch({ type: 'UI_SET', patch: { recFilters: { city: f.city, destination: 'all', priority: 'all', status: 'unresolved', q: '' } } });
    navigate('/improvements');
  };

  const cityQueries = QUERIES.filter((q) => q.cityId === f.city);
  const queries = cityQueries.filter((q) => f.course === 'all' || q.courseId === f.course);
  const visibleQueries = f.queryId === 'all' ? queries : queries.filter((q) => q.id === f.queryId);
  const obs = (qid: string, ch: Channel = f.channel) => OBSERVATIONS.find((o) => o.queryId === qid && o.channel === ch) as SearchObservation;
  const best = (who: 'lgp' | CompetitorId) => {
    const vals = cityQueries.map((q) => obs(q.id)?.positions[who]).filter((v): v is number => v != null);
    return vals.length ? `#${Math.min(...vals)}` : 'Not observed';
  };
  const cmp = COMPARISONS.find((c) => c.competitorId === competitor && c.cityId === f.city);
  const evidenceIds = f.channel === 'ai' ? [] : [...new Set(visibleQueries.flatMap((q) => obs(q.id).evidenceIds))];
  const sample = visibleQueries[0] ? obs(visibleQueries[0].id) : undefined;

  return (
    <div className="page">
      <BackLink to="/">Back to dashboard</BackLink>
      <header className="page-head" ref={topRef}>
        <div>
          <h1>Compare with competitors</h1>
          <p className="muted">What customers can find about Lifeguard-Pro and a fictional sample competitor. Sample observations from Oct 16, 2026.</p>
        </div>
      </header>

      <div className="filters panel">
        <Select label="City" value={f.city} onChange={(v) => set({ city: v, queryId: 'all' })} options={[{ value: 'boston', label: 'Boston' }, { value: 'miami', label: 'Miami' }]} />
        <div className="field field-inline">
          <span className="field-label">Where customers look</span>
          <Segmented<Channel> label="Where customers look" value={f.channel} onChange={(v) => set({ channel: v })} options={CHANNELS} />
        </div>
        {f.channel !== 'ai' && (
          <Select label="Competitor" value={competitor} onChange={setCompetitor} options={COMPETITOR_IDS.map((c) => ({ value: c, label: COMPETITORS[c].name }))} />
        )}
      </div>

      {f.channel !== 'ai' ? (
        <>
          <section className="panel" aria-labelledby="cmp-h">
            <h2 id="cmp-h">What customers can find</h2>
            {cmp ? (
              <div className="table-scroll">
                <table className="table simple-compare">
                  <thead>
                    <tr>
                      <th scope="col">What customers can find</th>
                      <th scope="col" className="col-us">
                        Lifeguard-Pro
                      </th>
                      <th scope="col">{COMPETITORS[competitor].name}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th scope="row">
                        Best position in {f.channel === 'organic' ? 'Google Search' : 'Google Maps'}
                        <span className="muted small block">Across {cityQueries.length} tracked phrases</span>
                      </th>
                      <td className="col-us">{best('lgp')}</td>
                      <td>{best(competitor)}</td>
                    </tr>
                    {(Object.keys(cmp.dims) as ComparisonDimension[]).map((k) => (
                      <tr key={k}>
                        <th scope="row">{ROW_LABEL[k]}</th>
                        <td className={`col-us ${cmp.dims[k].ours === 'Not assessed' ? 'muted' : ''}`}>{cmp.dims[k].ours}</td>
                        <td className={cmp.dims[k].theirs === 'Not assessed' ? 'muted' : ''}>{cmp.dims[k].theirs}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="No comparison captured for this competitor" />
            )}
            <SampleNote>
              “Not assessed” means no evidence was captured — it does not mean something is missing. Differences are observations; we don’t claim to know why rankings differ.
            </SampleNote>
            <div className="btn-row">
              <button className="btn btn-primary" onClick={viewSuggestions}>
                View suggestions <Icon name="arrowRight" />
              </button>
            </div>
          </section>

          <Disclosure label="See rankings and evidence" hint="Positions by search phrase, date, device and location, plus the sample pages behind each finding" open={details} onToggle={setDetails}>
            <div className="stack">
              <div className="filters-row">
                <Select
                  label="Course"
                  value={f.course}
                  onChange={(v) => set({ course: v, queryId: 'all' })}
                  options={[
                    { value: 'all', label: 'All courses' },
                    { value: 'cert', label: 'Lifeguard certification' },
                    { value: 'recert', label: 'Lifeguard recertification' },
                  ]}
                />
                <Select label="Search phrase" value={f.queryId} onChange={(v) => set({ queryId: v })} options={[{ value: 'all', label: 'All tracked phrases' }, ...queries.map((q) => ({ value: q.id, label: q.text }))]} />
              </div>
              {visibleQueries.length && sample ? (
                <div className="table-scroll">
                  <table className="table matrix">
                    <caption>
                      {f.channel === 'organic' ? 'Organic results only — ads are not counted.' : 'Maps positions from one sample point — not a city-wide rank.'} Sample point: {sample.location} · {sample.device} · observed{' '}
                      {fmtDateTime(sample.observedAt)}. Change compared with Oct 9.
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col" className="sticky-col">
                          Business
                        </th>
                        {visibleQueries.map((q) => (
                          <th key={q.id} scope="col">
                            “{q.text}”
                          </th>
                        ))}
                        <th scope="col">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(['lgp', ...COMPETITOR_IDS] as const).map((b) => (
                        <tr key={b} className={b === 'lgp' ? 'row-us' : ''}>
                          <th scope="row" className="sticky-col">
                            {b === 'lgp' ? 'Lifeguard-Pro' : COMPETITORS[b].name}
                            {b !== 'lgp' && <span className="muted small block">{COMPETITORS[b].domain}</span>}
                          </th>
                          {visibleQueries.map((q) => (
                            <td key={q.id}>
                              <PosCell cur={obs(q.id).positions[b]} prev={obs(q.id).previous[b]} />
                            </td>
                          ))}
                          <td>
                            {b !== 'lgp' && (
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => {
                                  setCompetitor(b);
                                  topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                }}
                              >
                                Compare
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState title="No tracked phrases for this selection" action={<button className="btn btn-secondary" onClick={() => set({ course: 'all', queryId: 'all' })}>Clear filters</button>} />
              )}
              <h3 className="section-label">Evidence</h3>
              <ul className="evidence-list evidence-grid">
                {evidenceIds.map((id) => {
                  const ev = EVIDENCE.find((e) => e.id === id)!;
                  return (
                    <EvidenceItem key={id} ev={ev}>
                      {ev.issueKey && (
                        <button className="btn btn-link btn-sm" onClick={() => openSuggestion(ev.issueKey!)}>
                          {state.recommendations.some((r) => r.issueKey === ev.issueKey) ? 'Open related suggestion' : 'Create suggestion'}
                        </button>
                      )}
                    </EvidenceItem>
                  );
                })}
              </ul>
            </div>
          </Disclosure>
        </>
      ) : (
        <AiView city={f.city} course={f.course} onCourse={(v) => set({ course: v })} onOpen={openSuggestion} onViewSuggestions={viewSuggestions} />
      )}
    </div>
  );
}

function AiView({
  city,
  course,
  onCourse,
  onOpen,
  onViewSuggestions,
}: {
  city: CityId;
  course: CompetitorFilters['course'];
  onCourse: (v: CompetitorFilters['course']) => void;
  onOpen: (issueKey: string) => void;
  onViewSuggestions: () => void;
}) {
  const all = AI_RESPONSES.filter((r) => r.cityId === city && (course === 'all' || r.courseId === course));
  return (
    <section className="panel" aria-labelledby="ai-h">
      <div className="panel-head">
        <h2 id="ai-h">AI answers · {CITIES[city].name}</h2>
        <Select
          label="Course"
          value={course}
          onChange={onCourse}
          options={[
            { value: 'all', label: 'All courses' },
            { value: 'cert', label: 'Lifeguard certification' },
            { value: 'recert', label: 'Lifeguard recertification' },
          ]}
        />
      </div>
      <SampleNote>Every answer here is a simulated response written for this demo. No AI service was asked.</SampleNote>
      {all.length ? (
        <div className="ai-platforms">
          {AI_PLATFORM_IDS.map((p) => {
            const rs = all.filter((r) => r.platform === p);
            if (!rs.length) return null;
            const m = rs.filter((r) => r.mentionsLgp).length;
            const c = rs.filter((r) => r.citesLgp).length;
            return (
              <section key={p} className="ai-platform" aria-label={AI_PLATFORMS[p]}>
                <div className="ai-platform-head">
                  <h3>{AI_PLATFORMS[p]}</h3>
                  <span className={`badge ${m ? 'tone-green' : 'tone-gray'}`}>
                    Mentioned in {m} of {rs.length}
                  </span>
                  <span className={`badge ${c ? 'tone-green' : 'tone-gray'}`}>
                    Linked to your site in {c} of {rs.length}
                  </span>
                  <InfoTip label={`About ${AI_PLATFORMS[p]} counts`}>A mention, a recommendation and a link (citation) are counted separately. A mention without a link stays uncited.</InfoTip>
                </div>
                <ul className="ai-answers">
                  {rs.map((r) => (
                    <AiAnswer key={r.id} r={r} onOpen={onOpen} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      ) : (
        <EmptyState title="No sample answers for this course" action={<button className="btn btn-secondary" onClick={() => onCourse('all')}>Show all courses</button>} />
      )}
      <div className="btn-row">
        <button className="btn btn-primary" onClick={onViewSuggestions}>
          View suggestions <Icon name="arrowRight" />
        </button>
      </div>
    </section>
  );
}

function AiAnswer({ r, onOpen }: { r: AiResponse; onOpen: (issueKey: string) => void }) {
  const { state } = useStore();
  const [open, setOpen] = useState(false);
  return (
    <li className="ai-answer">
      <div className="ai-answer-row">
        <span className="ai-q">“{r.prompt}”</span>
        <span className="indicators">
          <span className={r.mentionsLgp ? 'yes' : 'no'}>
            <Icon name={r.mentionsLgp ? 'check' : 'x'} size={14} /> {r.mentionsLgp ? 'Mentioned' : 'Not mentioned'}
          </span>
          <span className={r.citesLgp ? 'yes' : 'no'}>
            <Icon name={r.citesLgp ? 'check' : 'x'} size={14} /> {r.citesLgp ? 'Cited' : 'Not cited'}
          </span>
          {r.factsCorrect === false && (
            <span className="warn">
              <Icon name="alert" size={14} /> Wrong facts
            </span>
          )}
        </span>
        <button className="btn btn-secondary btn-sm" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? 'Hide sample answer' : 'View sample answer'}
        </button>
      </div>
      {open && (
        <div className="ai-card">
          <div className="ai-head">
            <strong>{AI_PLATFORMS[r.platform]}</strong>
            <span className="badge tone-purple">Simulated response</span>
            <span className="muted small">{fmtDateTime(r.capturedAt)}</span>
          </div>
          <p className="ai-prompt">
            <span className="muted small">Prompt</span>
            {r.prompt}
          </p>
          <blockquote>{r.response}</blockquote>
          <ul className="indicators" aria-label="Indicators">
            <li className={r.mentionsLgp ? 'yes' : 'no'}>{r.mentionsLgp ? 'Mentioned' : 'Not mentioned'}</li>
            <li className={r.recommendsLgp ? 'yes' : 'no'}>{r.recommendsLgp ? 'Recommended' : 'Not recommended'}</li>
            <li className={r.citesLgp ? 'yes' : 'no'}>{r.citesLgp ? 'Cited' : 'Not cited'}</li>
            <li className={r.factsCorrect === null ? 'na' : r.factsCorrect ? 'yes' : 'warn'}>
              {r.factsCorrect === null ? 'Facts not assessed' : r.factsCorrect ? 'Facts consistent' : 'Factual inconsistency'}
            </li>
          </ul>
          <dl className="kv kv-2">
            <div>
              <dt>Brands mentioned</dt>
              <dd>{r.mentionedBrands.join(', ')}</dd>
            </div>
            <div>
              <dt>Sources cited</dt>
              <dd>{r.citations.length ? r.citations.map((c) => <span key={c} className="cite">{c}</span>) : <span className="muted">No citations</span>}</dd>
            </div>
          </dl>
          <p className="small">
            <strong>Accuracy note:</strong> {r.accuracyNote}
          </p>
          {AI_ISSUES[r.id] && (
            <button className="btn btn-link btn-sm" onClick={() => onOpen(AI_ISSUES[r.id])}>
              {state.recommendations.some((x) => x.issueKey === AI_ISSUES[r.id]) ? 'Open related suggestion' : 'Create suggestion'} <Icon name="arrowRight" size={14} />
            </button>
          )}
        </div>
      )}
    </li>
  );
}
